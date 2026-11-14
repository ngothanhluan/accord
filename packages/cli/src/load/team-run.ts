// ST-LN-96 D-03, D-01: the one runner for committed team commands (`git.sync` now, `tracker.command` later).
// The second shell site, beside `runSetup` in proc.ts: the command is committed repository content, trusted as `setup` is.
// The ticket id, branch and paths reach the script ONLY through the `env` the caller passes (ACCORD_TICKET, ACCORD_BRANCH,
// ACCORD_BASE_REF, ACCORD_ROOT), never through the command text. A script's output is never a verdict: the caller judges
// the result by exit code and by re-reading git.
import { spawnSync } from 'node:child_process';

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
}

/** Runs `command` through the platform shell (`npm` and `node` shims need it on Windows). Never throws. */
export function runTeamCommand(command: string, o: TeamRunOptions): TeamRun {
  const r = spawnSync(command, {
    cwd: o.cwd,
    env: o.env,
    input: o.input ?? '',
    shell: true,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: o.timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: o.maxBuffer,
    windowsHide: true,
  });
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  const timedOut = code === 'ETIMEDOUT';
  const oversize = code === 'ENOBUFS';
  const failed = r.error !== undefined && !timedOut && !oversize;
  return {
    // a killed or unstarted process has no exit code (null), which a caller must not read as success
    code: r.status,
    signal: r.signal,
    stdout: typeof r.stdout === 'string' ? r.stdout : '',
    stderr: (typeof r.stderr === 'string' ? r.stderr : '') + (failed ? `${r.stderr ? '\n' : ''}${String(r.error)}` : ''),
    timedOut,
    oversize,
  };
}
