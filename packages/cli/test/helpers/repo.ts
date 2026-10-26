// Sandbox git repositories for every CLI command test in Phase 5.
//
// The guard is copied verbatim from packages/cli/test/load.test.ts: `execFileSync` defaults to
// `process.cwd()`, which under vitest is the accord repository root, so a single omitted `cwd` would
// run git against the author's working tree inside a green test run. It throws rather than expects, so
// it fires outside a test body too.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/run.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../../test/helpers/lane.js';

const fixtures = fileURLToPath(new URL('../../../core/test/fixtures/', import.meta.url));

function gitIn(tmp: string, env?: NodeJS.ProcessEnv) {
  // `.native`, not plain `realpathSync`: the plain form leaves a Windows 8.3 short component in place,
  // so `C:\Users\RUNNER~1\...` and `C:\Users\runneradmin\...` compare unequal for one directory. The
  // sibling guard in test/load.test.ts carries the full account.
  const root = realpathSync.native(tmp);
  if (!root.startsWith(realpathSync.native(tmpdir())) || root === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run git outside a temporary sandbox: ' + tmp);
  }
  return (...args: string[]) =>
    execFileSync('git', args, {
      cwd: tmp,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(env === undefined ? {} : { env: { ...process.env, ...env } }),
    });
}

/** A throwaway git repository holding one core fixture; nothing is staged, so ls-files sees it via --others. */
export function makeRepo(fixture = 'valid-build'): string {
  const tmp = mkdtempSync(join(tmpdir(), 'accord-cli-'));
  cpSync(join(fixtures, fixture), tmp, { recursive: true });
  gitIn(tmp)('init', '-q');
  return tmp;
}

/**
 * A throwaway git repository with nothing in it — no `accord/` folder, no fixture. `accord init` is the one
 * command whose starting state is precisely this, and `makeRepo` always copies a fixture that already
 * carries the folder `init` exists to create.
 *
 * A separate function rather than `makeRepo(fixture?)`: a caller that forgot the argument would then
 * silently get an empty repository, and every other command's test reads a fixture it never named.
 */
export function makeEmptyRepo(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'accord-cli-'));
  gitIn(tmp)('init', '-q');
  return tmp;
}

/**
 * Commit everything in the sandbox and return the HEAD sha. Needed by the Done gate, whose rules read
 * `git.commit` (D-78): without a commit every `gate done` fails on `gate.commit-missing`, so the pass
 * verdict would be unreachable from the CLI. Identity and signing are supplied per invocation so the
 * host's global git config cannot change the result; the `gitIn` guard still applies.
 */
export function commitAll(repo: string, message = 'fixture'): string {
  return commitAllAt(repo, undefined, message);
}

/** `commitAll` with author and committer date set to `when`, so a test can age a commit. */
export function commitAllAt(repo: string, when?: Date, message = 'fixture'): string {
  const stamp = when === undefined ? undefined : `@${Math.floor(when.getTime() / 1000)} +0000`;
  const git = gitIn(repo, stamp === undefined ? undefined : { GIT_COMMITTER_DATE: stamp, GIT_AUTHOR_DATE: stamp });
  git('add', '-A');
  git(
    '-c', 'user.email=fixture@example.invalid',
    '-c', 'user.name=fixture',
    '-c', 'commit.gpgsign=false',
    'commit', '-q', '--no-verify', '-m', message,
  );
  return git('rev-parse', 'HEAD').trim();
}

/** git object files are read-only on Windows; retries let rmSync win the race with the index writer. */
export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}

/**
 * Drive the whole CLI in-process with PassThrough streams and an explicit cwd (STACK Decision 7); no
 * test body ever reads `process.cwd()`. The streams stay paused, so `read()` returns everything
 * written synchronously during the call and the assertions need no stream event.
 */
export async function run(
  argv: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
  stdin?: string,
): Promise<{ code: number; out: string; err: string }> {
  // H8: a copy with an unset or wrong path must never run accord (clean, drop) in a real checkout. The
  // folder may not exist yet, so the check is made on its nearest existing ancestor, as `gitIn` does.
  let existing = resolve(cwd);
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const root = realpathSync.native(existing);
  if (!root.startsWith(realpathSync.native(tmpdir())) || root === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run accord outside a temporary sandbox: ' + cwd);
  }
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const code = await runCli(argv, { cwd, stdout, stderr, env, ...(stdin === undefined ? {} : { stdin }) });
  return { code, out: String(stdout.read() ?? ''), err: String(stderr.read() ?? '') };
}

/** Run git in a sandbox; the same guard as every other spawn in this file. */
export function gitRun(repo: string, ...args: string[]): string {
  return gitIn(repo)(...args);
}

/** Commit everything with `-F <file> --cleanup=verbatim` (conventions.md), never `-m`; returns the new HEAD sha. */
export function commitMsg(dir: string, text: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, text + '\n');
    gitRun(dir, 'add', '-A');
    gitRun(dir, 'commit', '-q', '-F', file, '--cleanup=verbatim');
    return gitRun(dir, 'rev-parse', 'HEAD').trim();
  } finally {
    cleanup(folder);
  }
}

/** Merge `ref` with `--no-ff` using `-F <file> --cleanup=verbatim`, never `-m`; returns the new HEAD sha. */
export function mergeMsg(dir: string, ref: string, text: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, text + '\n');
    gitRun(dir, 'merge', '-q', '--no-ff', '-F', file, '--cleanup=verbatim', ref);
    return gitRun(dir, 'rev-parse', 'HEAD').trim();
  } finally {
    cleanup(folder);
  }
}

/** Write repo-relative posix paths into the sandbox, creating folders. */
export function writeFiles(repo: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(repo, ...rel.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
}

/** A sandbox holding one unapproved lane ticket T-1, its two-task plan, and a green report. */
export function makeLaneRepo(extra: Record<string, string> = {}): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'accord/tickets/T-1/plan.md': PLAN,
    'src/export.ts': 'export const write = 1;\n', // the file the plan's tasks name, so it exists at baseline
    [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    ...extra,
  });
  return repo;
}
