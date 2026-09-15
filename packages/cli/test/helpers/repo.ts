// Sandbox git repositories for every CLI command test in Phase 5.
//
// The guard is copied verbatim from packages/cli/test/load.test.ts: `execFileSync` defaults to
// `process.cwd()`, which under vitest is the accord repository root, so a single omitted `cwd` would
// run git against the author's working tree inside a green test run. It throws rather than expects, so
// it fires outside a test body too.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/run.js';

const fixtures = fileURLToPath(new URL('../../../core/test/fixtures/', import.meta.url));

function gitIn(tmp: string) {
  // `.native`, not plain `realpathSync`: the plain form leaves a Windows 8.3 short component in place,
  // so `C:\Users\RUNNER~1\...` and `C:\Users\runneradmin\...` compare unequal for one directory. The
  // sibling guard in test/load.test.ts carries the full account.
  const root = realpathSync.native(tmp);
  if (!root.startsWith(realpathSync.native(tmpdir())) || root === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run git outside a temporary sandbox: ' + tmp);
  }
  return (...args: string[]) =>
    execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** A throwaway git repository holding one core fixture; nothing is staged, so ls-files sees it via --others. */
export function makeRepo(fixture = 'valid-build'): string {
  const tmp = mkdtempSync(join(tmpdir(), 'accord-cli-'));
  cpSync(join(fixtures, fixture), tmp, { recursive: true });
  gitIn(tmp)('init', '-q');
  return tmp;
}

/**
 * Commit everything in the sandbox and return the HEAD sha. Needed by the Done gate, whose rules read
 * `git.commit` (D-78): without a commit every `gate done` fails on `gate.commit-missing`, so the pass
 * verdict would be unreachable from the CLI. Identity and signing are supplied per invocation so the
 * host's global git config cannot change the result; the `gitIn` guard still applies.
 */
export function commitAll(repo: string): string {
  const git = gitIn(repo);
  git('add', '-A');
  git(
    '-c', 'user.email=fixture@example.invalid',
    '-c', 'user.name=fixture',
    '-c', 'commit.gpgsign=false',
    'commit', '-q', '--no-verify', '-m', 'fixture',
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
): Promise<{ code: number; out: string; err: string }> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const code = await runCli(argv, { cwd, stdout, stderr, env });
  return { code, out: String(stdout.read() ?? ''), err: String(stderr.read() ?? '') };
}
