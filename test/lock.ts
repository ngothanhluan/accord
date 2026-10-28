// ST-LN-67: one vitest run per machine. ST-LN-66 caps the forks of a run, but each session runs its own suite, and
// several at once still ran a 32 GB host out of memory. The root config takes this lock as its globalSetup, so
// tests.full and tests.affected from every clone and worktree wait their turn; a CI runner has one run and never waits.
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * In the OS temp folder, so every clone and worktree of this user shares it. Named by user id on POSIX, where /tmp
 * is shared and one user cannot remove another's stale file; Windows already gives each user its own temp folder.
 */
const uid = process.getuid?.();
export const LOCK = join(tmpdir(), uid === undefined ? 'accord-test-run.lock' : `accord-test-run-${uid}.lock`);

interface Options {
  /** Milliseconds between tries while another run holds the lock. */
  poll?: number;
  /** Prints the one waiting line. */
  log?: (line: string) => void;
  /** Milliseconds after which a lock file with no readable owner counts as abandoned. */
  settle?: number;
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

/** vitest globalSetup: hold the lock for the whole run. */
export default async function setup(): Promise<() => void> {
  return acquire(LOCK);
}
