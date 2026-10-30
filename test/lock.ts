// ST-LN-67: one vitest run per machine. ST-LN-66 caps the forks of a run, but each session runs its own suite, and
// several at once still ran a 32 GB host out of memory. The root config takes this lock as its globalSetup, so
// tests.full and tests.affected from every clone and worktree wait their turn; a CI runner has one run and never waits.
// ST-LN-73: once the run holds the lock it waits until the free memory fits the memory kept free for the rest of the
// machine plus one fork, then lowers the fork count of every project to what the free memory allows; vitest reads the
// count when the tests start, after globalSetup; watch mode runs globalSetup once, so a rerun keeps the first count;
// os.freemem() reads the host's memory, not a container's memory limit; on macOS the run takes the lock and changes
// nothing else, so a run there can still exhaust memory (D-08).
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { freemem, platform, tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * In the OS temp folder, so every clone and worktree of this user shares it. Named by user id on POSIX, where /tmp
 * is shared and one user cannot remove another's stale file; Windows already gives each user its own temp folder.
 */
const uid = process.getuid?.();
export const LOCK = join(tmpdir(), uid === undefined ? 'accord-test-run.lock' : `accord-test-run-${uid}.lock`);

export const GB = 1_000_000_000;

// ST-LN-73 (D-06): measured at dd93c14 with one full run at ACCORD_TEST_WORKERS=4 on Windows 11 (20 CPUs, 34.0 GB), 91
// files, 1694 passed, 627 s, sampled every 500 ms: the free memory fell from 9.32 GB to 7.10 GB, 2.22 GB over 4 forks,
// 0.55 GB a fork, rounded up to 0.6 GB. The fall counts memory the run commits but does not keep resident, which the
// 1.21 GB working-set peak misses.
export const PER_FORK = 600_000_000;

// ST-LN-73 (D-09): set from that measurement and the 2026-10-30 stop: 8.2 GB free less 10 forks at the measured
// 0.55 GB leaves about 2.7 GB, where Claude Code stopped the run as critically low; 4 GB keeps a margin above that.
// GB is 10^9 bytes.
export const RESERVE = 4_000_000_000;

interface Options {
  /** Milliseconds between tries while another run holds the lock. */
  poll?: number;
  /** Prints the one waiting line. */
  log?: (line: string) => void;
  /** Milliseconds after which a lock file with no readable owner counts as abandoned. */
  settle?: number;
}

/** The part of the TestProject vitest hands a globalSetup that `setup` reads and writes. */
export interface VitestRun {
  vitest: { config: { maxWorkers?: number }; projects: readonly { config: { maxWorkers?: number } }[] };
}

interface SetupOptions extends Options {
  /** The lock file; default LOCK. */
  lock?: string;
  /** The free memory in bytes; default freemem from node:os. */
  free?: () => number;
  /** Memory one fork needs, in bytes; default PER_FORK. */
  perFork?: number;
  /** Memory kept free for the rest of the machine, in bytes; default RESERVE. */
  reserve?: number;
  /** The OS the run is on, default os.platform(); on 'darwin' setup takes the lock and changes nothing else (D-08). */
  platform?: NodeJS.Platform;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: the process exists but belongs to someone else.
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function read(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw e;
  }
}

/** The run named in a lock file's text; an empty or half-written file names none. */
function holder(text: string): { pid?: number; cwd?: string } {
  try {
    const { pid, cwd } = JSON.parse(text) as { pid?: unknown; cwd?: unknown };
    return { pid: Number.isInteger(pid) ? (pid as number) : undefined, cwd: typeof cwd === 'string' ? cwd : undefined };
  } catch {
    return {};
  }
}

/** Tries once to create `file`; true when this process now holds it. */
function create(file: string, body: string): boolean {
  try {
    writeFileSync(file, body, { flag: 'wx' });
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw e;
  }
}

/**
 * Removes `file` when it still holds `text` and that owner is gone. A second lock file guards the check and the
 * removal, so two waiters that both saw the dead owner cannot each remove a lock the other has just taken.
 */
function takeOver(file: string, text: string, settle: number): void {
  const guard = file + '.takeover';
  if (!create(guard, String(process.pid))) {
    // A guard left by a waiter killed between create and remove; the guarded step takes milliseconds.
    try {
      if (Date.now() - statSync(guard).mtimeMs > 10_000) rmSync(guard, { force: true });
    } catch {
      // Gone already.
    }
    return;
  }
  try {
    if (read(file) !== text) return;
    const { pid } = holder(text);
    const abandoned = pid === undefined ? Date.now() - statSync(file).mtimeMs > settle : !alive(pid);
    if (abandoned) rmSync(file, { force: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  } finally {
    rmSync(guard, { force: true });
  }
}

/** Waits until this process holds `file`; resolves to the release. */
export async function acquire(file: string, options: Options = {}): Promise<() => void> {
  const { poll = 1000, settle = 10_000 } = options;
  const log = options.log ?? ((line: string) => process.stderr.write(line + '\n'));
  const body = JSON.stringify({ pid: process.pid, cwd: process.cwd(), started: new Date().toISOString() });
  let told = false;
  while (!create(file, body)) {
    const text = read(file);
    if (text === undefined) continue;
    const { pid, cwd } = holder(text);
    if (pid === undefined || !alive(pid)) takeOver(file, text, settle);
    if (read(file) === text) {
      if (!told) {
        log(`accord: waiting for another test run to finish (pid ${pid ?? 'unknown'}${cwd ? ' in ' + cwd : ''}; lock ${file})`);
        told = true;
      }
      await new Promise((resolve) => setTimeout(resolve, poll));
    }
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    process.off('exit', release);
    if (read(file) === body) rmSync(file, { force: true });
  };
  // A run that throws past its teardown still frees the lock; a killed one leaves it to takeOver.
  process.on('exit', release);
  return release;
}

const gb = (bytes: number) => String(Number((bytes / GB).toFixed(1)));

/**
 * vitest globalSetup; holds the lock for the whole run. Except on macOS, it then waits until the free memory fits the
 * reserve plus one fork and lowers every project's fork count to what the free memory allows.
 */
export default async function setup(project: VitestRun, options: SetupOptions = {}): Promise<() => void> {
  const release = await acquire(options.lock ?? LOCK, options);
  if ((options.platform ?? platform()) === 'darwin') return release;
  const freeNow = options.free ?? freemem;
  const perFork = options.perFork ?? PER_FORK;
  const reserve = options.reserve ?? RESERVE;
  const log = options.log ?? ((line: string) => process.stderr.write(line + '\n'));
  const poll = options.poll ?? 1000;
  const needed = reserve + perFork;
  let free = freeNow();
  let told = false;
  while (free < needed) {
    if (!told) {
      log(`accord: waiting for free memory (${gb(free)} GB free, ${gb(needed)} GB needed: ${gb(reserve)} GB kept free for the rest of the machine plus ${gb(perFork)} GB for one fork)`);
      told = true;
    }
    await new Promise((resolve) => setTimeout(resolve, poll));
    free = freeNow();
  }
  const fit = Math.floor((free - reserve) / perFork);
  const cap = (n: number | undefined) => (n !== undefined && n > 0 ? Math.min(n, fit) : fit);
  const root = project.vitest.config.maxWorkers;
  for (const p of project.vitest.projects) p.config.maxWorkers = cap(p.config.maxWorkers || root);
  project.vitest.config.maxWorkers = cap(root);
  return release;
}
