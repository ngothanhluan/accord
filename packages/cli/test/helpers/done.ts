// Helpers of the ST-LN-55 clean tests (worktree-clean.test.ts) that helpers/worktree.ts does not hold.
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { runCli } from '../../src/run.js';

/** The process table in which LIVE runs and DEAD does not. */
export const ALIVE = [
  { pid: process.pid, ppid: 1, start: 'self' },
  { pid: 4242, ppid: 1, start: 'S2' },
];

/** Gone: nothing at all at the path, a dangling link included. */
export const gone = (p: string): boolean => lstatSync(p, { throwIfNoEntry: false }) === undefined;

/** `run` of repo.ts, but the output sinks keep every write: a PassThrough read once returns only its 64 KiB buffer. */
export async function runWhole(argv: string[], cwd: string, stdin?: string): Promise<{ code: number; out: string; err: string }> {
  let existing = resolve(cwd);
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const root = realpathSync.native(existing);
  if (!root.startsWith(realpathSync.native(tmpdir())) || root === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run accord outside a temporary sandbox: ' + cwd);
  }
  let out = '';
  let err = '';
  const sink = (add: (s: string) => void) =>
    ({
      write(chunk: string | Uint8Array): boolean {
        add(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      },
    }) as unknown as NodeJS.WritableStream;
  const code = await runCli(argv, {
    cwd,
    stdout: sink((s) => (out += s)),
    stderr: sink((s) => (err += s)),
    env: {},
    ...(stdin === undefined ? {} : { stdin }),
  });
  return { code, out, err };
}
