// ST-LN-96 D-03, D-01: the one runner for committed team commands (`git.sync`, `tracker.command`).
// The second shell site, beside `runSetup` in proc.ts (it runs in a worker thread so a timeout can kill the whole process tree): the command is committed repository content, so its callers run it only after `accord trust` allowed it (load/script-trust.ts).
// The ticket id, branch and paths reach the script ONLY through the `env` the caller passes (ACCORD_TICKET, ACCORD_BRANCH,
// ACCORD_BASE_REF, ACCORD_ROOT), never through the command text. A script's output is never a verdict: the caller judges
// the result by exit code and by re-reading git.
import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads';

export interface TeamRun {
  /** The exit code; null when the process was killed (timeout) or never started. */
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  /** The command outlived `timeoutMs` and was killed. */
  timedOut: boolean;
  /** The output outgrew `maxBuffer` and the process was killed; the output kept is what fitted. */
  oversize: boolean;
}

export interface TeamRunOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Written to the command's stdin; absent means empty (never the terminal). */
  input?: string;
  timeoutMs: number;
  maxBuffer: number;
  /** A test seam: holds the completion of the tree kill back by this many ms, as a slow `taskkill /T /F` does; the kill itself is sent at once. Production callers leave it out. */
  killDelayMs?: number;
}

/**
 * The runner, as the source of a worker thread (a CommonJS script, run with `eval: true`, so no second file has to be bundled).
 * Why a worker: `spawnSync` can only kill the shell on a timeout, and the script's own children run on and hold the ticket's
 * worktree. The worker starts the shell with the event loop `spawnSync` lacks, so on a timeout or oversize output it can kill the
 * whole process tree first (`taskkill /T /F` on Windows; on POSIX the shell leads its own process group and the group is killed),
 * wait until the kill has returned and the output pipes have closed, and only then report - the caller removes the folder the moment `runTeamCommand` returns.
 * The POSIX group is also out of the terminal's reach, and the caller blocks in `Atomics.wait` where no signal handler can run, so Ctrl-C
 * or a kill of accord would leave the script running. A guard process in a session of its own holds a pipe the worker keeps open: a normal
 * end writes a line to it and the guard leaves; the pipe closing any other way (accord gone) makes the guard kill the script's group.
 */
const RUNNER = String.raw`
const { workerData } = require('node:worker_threads');
const { spawn } = require('node:child_process');
const { command, cwd, env, input, timeoutMs, maxBuffer, killDelayMs, port, flag } = workerData;
const win = process.platform === 'win32';
const out = { stdout: [], stderr: [] };
const size = { stdout: 0, stderr: 0 };
let timedOut = false;
let oversize = false;
let child;
let guard;
let timer;
let settled = false;
/** The promise of the tree kill, set when a stop begins: a stopped command is reported only after it settles. */
let killed;

/** Tells the guard the command ended normally, so it leaves the group alone, and waits until the line is written: a closed pipe is the signal to kill. */
function release(next) {
  const g = guard;
  guard = undefined;
  if (!g) return next();
  let called = false;
  const go = () => {
    if (called) return;
    called = true;
    clearTimeout(wait);
    next();
  };
  const wait = setTimeout(go, 2000);
  g.stdio[3].on('error', go);
  g.stdio[3].end('\n', go);
}

function done(result) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  release(() => {
    port.postMessage(result);
    Atomics.store(flag, 0, 1);
    Atomics.notify(flag, 0);
  });
}

function finish(code, signal, error) {
  const killed = timedOut || oversize;
  done({
    code: killed ? null : code,
    signal: killed ? 'SIGKILL' : signal,
    stdout: Buffer.concat(out.stdout).toString('utf8'),
    stderr: Buffer.concat(out.stderr).toString('utf8'),
    timedOut,
    oversize,
    error,
  });
}

function sendKill() {
  if (win) {
    return new Promise((resolve) => {
      const k = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      k.on('error', resolve);
      k.on('close', resolve);
    });
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try { child.kill('SIGKILL'); } catch {}
  }
  return Promise.resolve();
}

function killTree() {
  const sent = sendKill();
  return killDelayMs > 0 ? sent.then(() => new Promise((resolve) => setTimeout(resolve, killDelayMs))) : sent;
}

function stop() {
  if (killed) return;
  killed = killTree();
  // the shell's pipes can close before the kill has returned (taskkill /T /F is still walking the tree), and the report must not come before it:
  // close joins this promise. The safety net starts with the stop and keeps a stuck kill or a stuck pipe from hanging the caller for longer than before.
  setTimeout(() => finish(null, 'SIGKILL'), 10000).unref();
}

function take(name, chunk) {
  if (oversize) return;
  const room = maxBuffer - size[name];
  if (chunk.length > room) {
    if (room > 0) out[name].push(chunk.subarray(0, room));
    size[name] = maxBuffer;
    oversize = true;
    stop();
    return;
  }
  out[name].push(chunk);
  size[name] += chunk.length;
}

try {
  child = spawn(command, { cwd, env, shell: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: !win });
  if (!win && child.pid !== undefined) {
    guard = spawn('/bin/sh', ['-c', 'read -r _ <&3 && exit 0; kill -s KILL "-$1" 2>/dev/null || kill -s KILL -- "-$1"', 'guard', String(child.pid)], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'pipe'] });
    guard.on('error', () => {});
    guard.stdio[3].on('error', () => {});
    guard.unref();
  }
  child.stdout.on('data', (c) => take('stdout', c));
  child.stderr.on('data', (c) => take('stderr', c));
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  child.on('error', (e) => finish(null, null, String(e)));
  child.on('close', (code, signal) => {
    if (killed === undefined) return finish(code, signal);
    killed.then(() => finish(code, signal));
  });
  timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
} catch (e) {
  finish(null, null, String(e));
}
`;

interface RunnerResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  oversize: boolean;
  error?: string;
}

/** The longest the caller waits for the worker beyond the command's own timeout: the kill, the pipes closing, the worker's start. */
const GRACE_MS = 30_000;

/**
 * Runs `command` through the platform shell (`npm` and `node` shims need it on Windows). Never throws, and is synchronous: the caller
 * blocks until the command and, after a timeout or oversize output, its whole process tree has ended.
 */
export function runTeamCommand(command: string, o: TeamRunOptions): TeamRun {
  const flag = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(RUNNER, {
    eval: true,
    workerData: { command, cwd: o.cwd, env: { ...o.env }, input: o.input ?? '', timeoutMs: o.timeoutMs, maxBuffer: o.maxBuffer, killDelayMs: o.killDelayMs ?? 0, port: port2, flag },
    transferList: [port2],
  });
  const woke = Atomics.wait(flag, 0, 0, o.timeoutMs + GRACE_MS);
  const message = receiveMessageOnPort(port1)?.message as RunnerResult | undefined;
  void worker.terminate();
  port1.close();
  if (woke === 'timed-out' || message === undefined) {
    return { code: null, signal: 'SIGKILL', stdout: '', stderr: 'the team command runner did not report', timedOut: false, oversize: false };
  }
  return {
    // a killed or unstarted process has no exit code (null), which a caller must not read as success
    code: message.code,
    signal: message.signal,
    stdout: message.stdout,
    stderr: message.stderr + (message.error === undefined ? '' : `${message.stderr ? '\n' : ''}${message.error}`),
    timedOut: message.timedOut,
    oversize: message.oversize,
  };
}
