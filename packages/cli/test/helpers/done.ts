// Helpers of the ST-LN-55 clean tests (worktree-clean.test.ts) that helpers/worktree.ts does not hold.
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

/** Append each pattern and a newline to `.git/info/exclude`, which every worktree of the clone reads. */
export function exclude(c: { root: string }, patterns: string[]): void {
  mkdirSync(`${c.root}/.git/info`, { recursive: true });
  appendFileSync(`${c.root}/.git/info/exclude`, patterns.map((p) => p + '\n').join(''));
}

/** A link at `at` to `target`: a junction on Windows (no admin right needed); elsewhere Node ignores the type and makes a symlink. */
export function link(target: string, at: string): void {
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(target, at, 'junction');
}

/** Leaves a folder git no longer lists: the worktree is removed with `--force`, then an empty folder is made at its path. */
export function forget(c: { git(...args: string[]): string; sibling(id: string): string }, id: string): void {
  c.git('worktree', 'remove', '--force', c.sibling(id));
  mkdirSync(c.sibling(id));
}

/** The lines of the record `.git/accord/worktrees` as `{ id, path }`, or `[]` when the file is missing. */
export function recorded(c: { root: string }): { id: string; path: string }[] {
  const file = `${c.root}/.git/accord/worktrees`;
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => {
      const t = l.indexOf('\t');
      return { id: l.slice(0, t), path: l.slice(t + 1) };
    });
}

/** The sorted lines of a walk that never follows a link: `<rel> -> <target>`, `<rel>/` for a folder, `<rel>: <content>` for a file. */
export function listing(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(dir, rel))) {
      const r = rel === '' ? name : `${rel}/${name}`;
      const p = join(dir, r);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) out.push(`${r} -> ${readlinkSync(p)}`);
      else if (st.isDirectory()) {
        out.push(`${r}/`);
        walk(r);
      } else out.push(`${r}: ${readFileSync(p, 'utf8')}`);
    }
  };
  walk('');
  return out.sort();
}
