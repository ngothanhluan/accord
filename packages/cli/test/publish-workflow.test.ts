// D-149 and D-94, the behavioural half: the tag-vs-manifest check in `.github/workflows/publish.yml`
// is EXECUTED here, not grepped. Before this file the one rule that stops a release from publishing a
// package whose version differs from the tag that names it had never run — and that mismatch is the
// one the D-94 pin cannot recover from afterwards, because a version on npm can be deprecated but
// never replaced.
//
// Three properties make the assertions mean what they say, all lifted from workflow-script.test.ts:
//   1. The script comes out of the document, never re-typed. A re-typed copy proves only that the
//      copy works. The source here is `readFileSync` over a repository file rather than `initFiles`,
//      because this document is not something `accord init` emits.
//   2. `TAG` arrives through the environment, exactly as the workflow's `env:` mapping supplies it on
//      a runner — T-09-10's mitigation exercised rather than described.
//   3. `GITHUB_ENV` and `GITHUB_OUTPUT` point at real scratch files, so "it appended the version" is
//      an assertion on two files rather than on the absence of an error.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { cleanup, makeEmptyRepo } from './helpers/repo.js';

// Narrow local shapes, as in core/test/scaffold.test.ts: the document is data, not a typed API.
interface Step {
  id?: string;
  run?: string;
  env?: Record<string, string>;
}
interface Job {
  steps: Step[];
  permissions?: Record<string, string>;
  'timeout-minutes'?: number;
}
interface Workflow {
  jobs: Record<string, Job>;
}

const YML = fileURLToPath(new URL('../../../.github/workflows/publish.yml', import.meta.url));

/** One job of the document, by name. */
function jobOf(yml: string, job: string): Job {
  const found = (parse(yml) as unknown as Workflow).jobs[job];
  expect(found, `the document has a job named ${job}`).toBeDefined();
  return found;
}

/** One step of a job, by `id:`. */
function stepOf(yml: string, job: string, id: string): Step {
  const steps = jobOf(yml, job).steps.filter((s) => s.id === id);
  expect(steps.length, `exactly one step in job ${job} carries id: ${id}`).toBe(1);
  return steps[0];
}

/**
 * A step's script, taken from the document rather than from a literal.
 *
 * Selected by `id:`, not by "the one step with a `run:`": the `publish` job carries three of those,
 * so a count of one would be wrong here. `toBe(1)` on the selection is still what matters — a rename
 * that left the selector matching nothing would silently test an empty string, which passes.
 */
function scriptOf(yml: string, job: string, id: string): string {
  return stepOf(yml, job, id).run as string;
}

const YML_TEXT = readFileSync(YML, 'utf8');
const SCRIPT = scriptOf(YML_TEXT, 'publish', 'version');
const SMOKE = scriptOf(YML_TEXT, 'smoke', 'smoke');
// The package name comes out of the smoke step's own env, never from a literal here.
const PKG = stepOf(YML_TEXT, 'smoke', 'smoke').env?.PKG ?? '';

// A-25: one environment knob, because a Windows host whose PATH resolves `bash` to the WSL shim sees a
// different filesystem and would fail for a reason that has nothing to do with the script.
const BASH = process.env.ACCORD_BASH ?? 'bash';
let noBash = false;
try {
  execFileSync(BASH, ['-c', 'exit 0'], { stdio: 'ignore' });
} catch {
  noBash = true;
}

// Obviously a fixture, never the real version: an assertion anchored to the repository's actual
// version would quietly start passing for the wrong reason after a real bump.
const FIXTURE_VERSION = '7.7.7-fixture';

const repos: string[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) cleanup(repo);
});

interface Run {
  code: number;
  err: string;
  env: string;
  output: string;
}

/** Run the check in a sandbox whose manifest names {@link FIXTURE_VERSION}, with `TAG` set to `tag`. */
function runCheck(tag: string): Run {
  const repo = makeEmptyRepo();
  repos.push(repo);
  // The script reads `./packages/cli/package.json` at a repo-relative path. Without this file the
  // step fails on a missing module, which is a green-looking red for the wrong reason.
  mkdirSync(join(repo, 'packages', 'cli'), { recursive: true });
  writeFileSync(
    join(repo, 'packages', 'cli', 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: FIXTURE_VERSION }, null, 2)}\n`,
  );
  writeFileSync(join(repo, 'script.sh'), SCRIPT);
  writeFileSync(join(repo, 'github_env'), '');
  writeFileSync(join(repo, 'github_output'), '');

  // Relative paths for the script and the two scratch files: the shell resolves all three against
  // `cwd`, so no Windows path ever reaches a POSIX redirection.
  //
  // `PATH` aside, this object is built for `execFileSync` and `process.env` is never mutated, so a
  // parallel test file cannot inherit `TAG`, `GITHUB_ENV` or `GITHUB_OUTPUT` (T-07-32).
  const env = {
    ...process.env,
    TAG: tag,
    GITHUB_ENV: 'github_env',
    GITHUB_OUTPUT: 'github_output',
  };
  const options = { cwd: repo, encoding: 'utf8' as const, env };
  let code = 0;
  let err = '';
  try {
    execFileSync(BASH, ['script.sh'], options);
  } catch (e) {
    const failure = e as { status?: number; stderr?: string };
    code = failure.status ?? -1;
    err = String(failure.stderr ?? '');
  }
  return {
    code,
    err,
    env: readFileSync(join(repo, 'github_env'), 'utf8'),
    output: readFileSync(join(repo, 'github_output'), 'utf8'),
  };
}

// Guard the guard, OUTSIDE the skipped describe (T-07-35): on a POSIX host this case fails rather than
// letting the ubuntu CI leg report green having executed nothing.
describe('the publish workflow version check — what is under test', () => {
  it('is a multi-line script lifted from the document, and bash resolved', () => {
    expect(SCRIPT.split('\n').length).toBeGreaterThan(1);
  });
});

it.skipIf(process.platform === 'win32')('risk:regression bash runs on a posix host so the executed version check cases are not skipped there', () => {
  expect(noBash, `${BASH} did not run on a POSIX host; set ACCORD_BASH`).toBe(false);
});

describe.skipIf(noBash)('the publish workflow version check — executed', { timeout: 60_000 }, () => {
  it('a matching tag passes and writes the version into GITHUB_ENV', () => {
    // The happy path alone proves nothing about the rule; it proves the step does not crash. It is
    // here because the later publish step reads $VERSION out of the environment this line writes.
    const result = runCheck(`v${FIXTURE_VERSION}`);
    expect(result.code, result.err).toBe(0);
    expect(result.env.trim()).toBe(`VERSION=${FIXTURE_VERSION}`);
  });

  it('the same run also writes the version into GITHUB_OUTPUT', () => {
    // The half the smoke job reads. GITHUB_ENV does not cross a job boundary, so a check that wrote
    // only the first file would leave needs.publish.outputs.version empty and the smoke job would
    // npx a package at version "" — green publish, no proof.
    const result = runCheck(`v${FIXTURE_VERSION}`);
    expect(result.code, result.err).toBe(0);
    expect(result.output.trim()).toBe(`VERSION=${FIXTURE_VERSION}`);
  });

  it('a tag naming a different version fails and writes nothing to either file', () => {
    // The case the rule exists for: a release that publishes a package whose version differs from
    // the tag that names it cannot be undone, only deprecated.
    const result = runCheck('v9.9.9');
    expect(result.code).not.toBe(0);
    expect(result.env, 'GITHUB_ENV was written on a mismatch').toBe('');
    expect(result.output, 'GITHUB_OUTPUT was written on a mismatch').toBe('');
  });

  it('the failure names both the tag’s version and the manifest’s', () => {
    // A refusal that says only "version mismatch" sends the reader to two files to find out which
    // one is wrong; pin.ts names both for the same reason.
    const result = runCheck('v9.9.9');
    expect(result.err).toContain('9.9.9');
    expect(result.err).toContain(FIXTURE_VERSION);
  });

  it('a tag with no leading v is compared on its bare value', () => {
    // The `v` strip is the ONLY transformation applied — no semver parse, no normalisation. A tag
    // that already carries the bare version therefore still matches, and `v` is not stripped twice.
    const result = runCheck(FIXTURE_VERSION);
    expect(result.code, result.err).toBe(0);
    expect(result.env.trim()).toBe(`VERSION=${FIXTURE_VERSION}`);
  });
});

interface Smoke {
  code: number;
  out: string;
  err: string;
  calls: number;
  summary: string;
}

/**
 * Run the smoke script with a fake `npx` that replays `plan`, one line per call (the last line repeats):
 * `<exit code>|<text>`, with a literal backslash-n for a line break. Text goes to stdout on exit 0
 * and to stderr otherwise, as npx does. The fake sits first on PATH inside bash, so no Windows path is ever
 * converted by the shell.
 */
function runSmoke(plan: string[], extraEnv: Record<string, string> = {}): Smoke {
  const repo = makeEmptyRepo();
  repos.push(repo);
  mkdirSync(join(repo, 'bin'), { recursive: true });
  writeFileSync(join(repo, 'script.sh'), SMOKE);
  writeFileSync(join(repo, 'summary'), '');
  writeFileSync(join(repo, 'npx-plan'), `${plan.join('\n')}\n`);
  writeFileSync(
    join(repo, 'bin', 'npx'),
    [
      '#!/usr/bin/env bash',
      'n=$(cat npx-count 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > npx-count',
      'echo "$@" >> npx-calls',
      // NPX_HANG replaces the process with a sleep (what a black-holed connection does, so the
      // script's per-call cap has something to kill); NPX_SLEEP is a slow call that still answers.
      '[ -n "${NPX_HANG:-}" ] && exec sleep "$NPX_HANG"',
      '[ -n "${NPX_SLEEP:-}" ] && sleep "$NPX_SLEEP"',
      'line=$(sed -n "${n}p" npx-plan); [ -n "$line" ] || line=$(tail -n 1 npx-plan)',
      'code="${line%%|*}"; text="${line#*|}"',
      String.raw`if [ "$code" = 0 ]; then printf '%b\n' "$text"; else printf '%b\n' "$text" >&2; fi`,
      'exit "$code"',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PKG,
    VERSION: FIXTURE_VERSION,
    SMOKE_ATTEMPTS: '4',
    SMOKE_INTERVAL: '0',
    GITHUB_STEP_SUMMARY: 'summary',
    ...extraEnv,
  };
  let code = 0;
  let out: string;
  let err = '';
  try {
    out = execFileSync(BASH, ['-c', 'export PATH="$PWD/bin:$PATH"; exec bash script.sh'], {
      cwd: repo,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const failure = e as { status?: number; stdout?: string; stderr?: string };
    code = failure.status ?? -1;
    out = String(failure.stdout ?? '');
    err = String(failure.stderr ?? '');
  }
  const countFile = join(repo, 'npx-count');
  let calls: number;
  try {
    calls = Number(readFileSync(countFile, 'utf8').trim());
  } catch {
    calls = 0;
  }
  return { code, out, err, calls, summary: readFileSync(join(repo, 'summary'), 'utf8') };
}

// npm 11's own texts (RESEARCH, BUG-LN-26): the two lines npx prints when a version is not visible.
const etarget = (pkg: string, version: string): string =>
  `1|npm error code ETARGET\\nnpm error notarget No matching version found for ${pkg}@${version}.`;
const VISIBLE = `0|${FIXTURE_VERSION}`;
const ENCODED = PKG.replace('/', '%2f');
const netError = (code: string): string => `1|npm error code ${code}\\nnpm error network request failed`;

describe.skipIf(noBash)('the publish workflow smoke step — executed', { timeout: 60_000 }, () => {
  it('risk:regression the smoke step retries while the version is not visible and prints why (D-07)', () => {
    const result = runSmoke([etarget(PKG, FIXTURE_VERSION), etarget(PKG, FIXTURE_VERSION), VISIBLE]);
    expect(result.code, result.err).toBe(0);
    expect(result.calls).toBe(3);
    const notarget = `npm error notarget No matching version found for ${PKG}@${FIXTURE_VERSION}`;
    expect(result.out).toContain(`attempt 1: not visible yet: ${notarget}`);
    expect(result.out).toContain(`attempt 2: not visible yet: ${notarget}`);
    expect(result.out).toContain(`attempt 3: ${FIXTURE_VERSION}`);
  });

  it('risk:regression the smoke step retries on an E404 for this package and on a network error (D-07)', () => {
    const notFound = `1|npm error code E404\\nnpm error 404 Not Found - GET https://registry.npmjs.org/${ENCODED} - Not found`;
    const missing = runSmoke([notFound, VISIBLE]);
    expect(missing.code, missing.err).toBe(0);
    expect(missing.calls).toBe(2);
    expect(missing.out).toContain('attempt 1: not visible yet: npm error 404 Not Found');
    const reset = runSmoke([netError('ECONNRESET'), VISIBLE]);
    expect(reset.code, reset.err).toBe(0);
    expect(reset.calls).toBe(2);
    expect(reset.out).toContain('attempt 1: network error: npm error code ECONNRESET');
  });

  it('risk:regression the smoke step fails at once on a failure that is not visibility (D-07)', () => {
    const integrity = `1|npm error code EINTEGRITY\\nnpm error sha512-AAAA integrity checksum failed`;
    const broken = runSmoke([integrity]);
    expect(broken.code).toBe(1);
    expect(broken.calls).toBe(1);
    expect(broken.err).toContain('npm error code EINTEGRITY');
    expect(broken.err).toContain('npm error sha512-AAAA integrity checksum failed');
    expect(broken.err).toContain('not visibility');
    // A dependency's ETARGET is not this release being invisible.
    const dependency = runSmoke([etarget('left-pad', '9.9.9')]);
    expect(dependency.code).toBe(1);
    expect(dependency.calls).toBe(1);
    // Another package's E404 names another URL, so it is not this release being invisible.
    const other = runSmoke([
      `1|npm error code E404\\nnpm error 404 Not Found - GET https://registry.npmjs.org/${ENCODED}-extra - Not found`,
    ]);
    expect(other.code).toBe(1);
    expect(other.calls).toBe(1);
    // A visible version that prints something else is a broken package, not a slow registry.
    const wrong = runSmoke(['0|0.0.1']);
    expect(wrong.code).toBe(1);
    expect(wrong.calls).toBe(1);
    expect(wrong.err).toContain('0.0.1');
    expect(wrong.err).toContain(FIXTURE_VERSION);
    // A network error never softens a later real failure.
    const later = runSmoke([netError('ECONNRESET'), integrity]);
    expect(later.code).toBe(1);
    expect(later.calls).toBe(2);
    expect(later.err).toContain('npm error code EINTEGRITY');
    expect(later.out).not.toContain('::warning');
    expect(later.summary).toBe('');
    // An empty VERSION would install the latest release: refuse before npx is ever called.
    const empty = runSmoke([VISIBLE], { VERSION: '' });
    expect(empty.code).toBe(1);
    expect(empty.calls).toBe(0);
  });

  it('risk:regression the smoke step passes with a warning when the version never showed (D-07)', () => {
    const result = runSmoke([etarget(PKG, FIXTURE_VERSION)]);
    expect(result.code, result.err).toBe(0);
    expect(result.calls).toBe(4);
    expect(result.out.match(/::warning title=not visible yet::/g)?.length).toBe(1);
    expect(result.out).toContain(`${PKG}@${FIXTURE_VERSION}`);
    const lines = result.summary.trim().split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain(`${PKG}@${FIXTURE_VERSION}`);
    expect(lines[0]).toContain('publish passed');
    expect(lines[0]).toContain('not a failed release');
    expect(result.out).not.toContain('could not reach the registry');
    expect(result.summary).not.toContain('could not reach the registry');
    // The last attempt decides the wording: network errors before a final not-visible stay plain.
    const mixed = runSmoke([netError('ECONNRESET'), netError('ECONNRESET'), netError('ECONNRESET'), etarget(PKG, FIXTURE_VERSION)]);
    expect(mixed.code, mixed.err).toBe(0);
    expect(mixed.calls).toBe(4);
    expect(mixed.out).toContain('::warning title=not visible yet::');
    expect(mixed.out).not.toContain('could not reach the registry');
    expect(mixed.summary).not.toContain('could not reach the registry');
    expect(mixed.summary).toContain('publish passed');
  });

  it('risk:regression the smoke step passes with a network warning when its last attempt could not reach the registry (D-07)', () => {
    const timeout = `1|npm error code ETIMEDOUT\\nnpm error network request to https://registry.npmjs.org/x failed`;
    const result = runSmoke([etarget(PKG, FIXTURE_VERSION), etarget(PKG, FIXTURE_VERSION), etarget(PKG, FIXTURE_VERSION), timeout]);
    expect(result.code, result.err).toBe(0);
    expect(result.calls).toBe(4);
    const warnings = result.out.split('\n').filter((l) => l.startsWith('::warning title=not visible yet::'));
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain(`${PKG}@${FIXTURE_VERSION}`);
    expect(warnings[0]).toContain('could not reach the registry');
    expect(warnings[0]).toContain('ETIMEDOUT');
    const tail = result.out.slice(result.out.indexOf('npx output of the last attempt:'));
    expect(tail).toContain('npm error code ETIMEDOUT');
    expect(tail).toContain('npm error network request to https://registry.npmjs.org/x failed');
    const lines = result.summary.trim().split('\n');
    expect(lines.length).toBe(1);
    for (const part of [`${PKG}@${FIXTURE_VERSION}`, 'not visible yet', 'could not reach the registry', 'ETIMEDOUT', 'not a failed release']) {
      expect(lines[0]).toContain(part);
    }
    // A registry down for the whole wait is told apart from a slow one by its code.
    const outage = runSmoke([netError('ECONNRESET')]);
    expect(outage.code, outage.err).toBe(0);
    expect(outage.calls).toBe(4);
    expect(outage.out).toContain('could not reach the registry');
    expect(outage.out).toContain('ECONNRESET');
    expect(outage.out).toContain('npx output of the last attempt:');
    expect(outage.summary).toContain('ECONNRESET');
    expect(outage.summary).toContain('could not reach the registry');
  });
});

describe.skipIf(noBash)('the publish workflow smoke step — time bound (WR-01, D-07)', { timeout: 60_000 }, () => {
  it('risk:regression the wait ends soft once its time budget is spent, not only after the attempt count', () => {
    // Every call takes one second and the budget is two, so a loop bounded by attempts alone would
    // make all twenty calls (about twenty seconds) where the budget allows two or three.
    const result = runSmoke([etarget(PKG, FIXTURE_VERSION)], {
      SMOKE_ATTEMPTS: '20',
      SMOKE_BUDGET: '2',
      NPX_SLEEP: '1',
    });
    expect(result.code, result.err).toBe(0);
    expect(result.calls).toBeGreaterThanOrEqual(2);
    expect(result.calls).toBeLessThanOrEqual(4);
    expect(result.out).toContain('::warning title=not visible yet::');
    expect(result.summary).toContain('not a failed release');
  });

  it('risk:regression one hung npx is cut at its own cap and counts as the network class', () => {
    // The fake never answers. Without a per-call cap the first call sits until the sleep ends and the
    // step cannot reach its soft end inside the job timeout.
    const result = runSmoke([VISIBLE], {
      SMOKE_ATTEMPTS: '2',
      SMOKE_CALL_TIMEOUT: '1',
      NPX_HANG: '5',
    });
    expect(result.code, result.err).toBe(0);
    expect(result.calls).toBe(2);
    const warnings = result.out.split('\n').filter((l) => l.startsWith('::warning title=not visible yet::'));
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('could not reach the registry');
    expect(warnings[0]).toContain('ETIMEDOUT');
    expect(result.summary).toContain('ETIMEDOUT');
  });
});

describe('the publish workflow smoke step — what the document says', () => {
  it('risk:security the smoke step reads its inputs through env and holds no permissions (D-07)', () => {
    expect(SMOKE).toContain('${SMOKE_ATTEMPTS:-60}');
    expect(SMOKE).toContain('${SMOKE_INTERVAL:-15}');
    expect(SMOKE).not.toContain('${{');
    const job = jobOf(YML_TEXT, 'smoke');
    expect('permissions' in job, 'the smoke job must carry no permissions key (T-09-11)').toBe(false);
    expect(job['timeout-minutes']).toBe(25);
    expect(stepOf(YML_TEXT, 'smoke', 'smoke').env).toEqual({
      PKG: '@accord-dev/accord',
      VERSION: '${{ needs.publish.outputs.version }}',
    });
  });
});
