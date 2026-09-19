// CLI-02, the behavioural half: the `run:` body of the workflow `accord init` emits is EXECUTED here,
// not grepped. Before this file the no-ticket branch (D-138), the `--diff-filter=d` exclusion (A-09),
// the `[^/]+` level bound and the `code` accumulator (A-10) had never run inside `npm test` — a shell
// script asserted by substring is a script nobody has run.
//
// Three properties make the assertions mean what they say:
//   1. The script is lifted out of the emitted document (`initFiles` -> `parse` -> the one step with a
//      `run`), never re-typed. A re-typed copy proves only that the copy works.
//   2. It runs VERBATIM. The two `npx --yes <pkg>@<version>` invocations are intercepted by a stub
//      named `npx` placed first on `PATH` (A-24), so no text is substituted and nothing reaches the
//      network. The stub records its argv, which is how "which invocations were made, in which order"
//      becomes an assertion rather than a hope.
//   3. `BASE` arrives through the environment, exactly as the emitted `env:` mapping supplies it on a
//      runner — T-07-11's mitigation exercised rather than described.
//
// The last two cases go further than the plan's stub (07-03 F-3: a stub proves the shell logic, not
// that the real binary matches the script's assumptions about its arguments and exit codes). There the
// stub forwards to the built `dist/cli.js` under `node`, so the real `accord lint` and the real
// `accord gate done <id>` run — still no `npx`, still no network.
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initFiles } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitAll, makeEmptyRepo } from './helpers/repo.js';

// Narrow local shapes, as in core/test/scaffold.test.ts: the document is data, not a typed API.
interface Step {
  run?: string;
}
interface Workflow {
  jobs: { accord: { steps: Step[] } };
}

/**
 * The script the emitted workflow carries, taken from the document rather than from a literal.
 *
 * `toBe(1)` on the count, not `find`: a future split into two `run:` steps must fail loudly here
 * rather than silently leave half the script untested.
 */
function scriptOf(yml: string): string {
  const steps = (parse(yml) as unknown as Workflow).jobs.accord.steps.filter((s) => s.run !== undefined);
  expect(steps.length, 'exactly one step carries a run: body').toBe(1);
  return steps[0].run as string;
}

const SCRIPT = scriptOf(
  initFiles({ name: pkg.name, version: pkg.version }).find((f) => f.path === '.github/workflows/accord.yml')
    ?.text ?? '',
);

// Read out of the script, never re-typed: the claim is "it prints the line it carries", and 07-03's
// shape test already pins the wording.
const NOTHING_TO_GATE = (/echo "([^"]+)"/.exec(SCRIPT) ?? [])[1] ?? '';

// A-25: one environment knob, because a Windows host whose PATH resolves `bash` to the WSL shim sees a
// different filesystem and would fail for a reason that has nothing to do with the script.
const BASH = process.env.ACCORD_BASH ?? 'bash';
let noBash = false;
try {
  execFileSync(BASH, ['-c', 'exit 0'], { stdio: 'ignore' });
} catch {
  noBash = true;
}

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

const repos: string[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) cleanup(repo);
});

function write(repo: string, path: string, text: string): void {
  const file = join(repo, ...path.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/**
 * A sandbox whose base commit holds one ticket and one doc, plus whatever `change` does on top of it,
 * committed. Both shas come from `commitAll`, so no test body calls git itself — the helper's refusal
 * to run git outside a temporary directory is what keeps a missing `cwd` off the author's tree (T-07-31).
 */
function sandbox(change: (repo: string) => void): { repo: string; base: string } {
  const repo = makeEmptyRepo();
  repos.push(repo);
  write(repo, 'accord/tickets/OLD-1.md', 'id: OLD-1\n');
  write(repo, 'docs/readme.md', 'base\n');
  const base = commitAll(repo);
  change(repo);
  commitAll(repo);
  return { repo, base };
}

interface Run {
  code: number;
  out: string;
  err: string;
  calls: string[];
}

/**
 * Run the script in the sandbox with `npx` shadowed.
 *
 * `fail` names the LAST argument of the invocation the stub should fail — `lint` for the lint call,
 * the ticket id for a `gate done` call. `forward` swaps the recording stub for one that also execs the
 * built CLI, so the case drives the real binary.
 *
 * `PATH` is built into the `env` object passed to `execFileSync` and `process.env` is never mutated, so
 * a parallel test file cannot inherit the stub (T-07-32).
 */
function runScript(
  repo: string,
  opts: { base: string; script?: string; fail?: string; forward?: boolean },
): Run {
  const script = opts.script ?? SCRIPT;
  const bin = join(repo, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(repo, 'script.sh'), script);
  writeFileSync(
    join(bin, 'npx'),
    opts.forward === true
      ? '#!/bin/sh\n' +
          'printf \'%s\\n\' "$*" >> "$ACCORD_STUB_LOG"\n' +
          '# Drop `--yes <pkg>@<version>` and hand the rest to the built CLI: the real binary, no registry.\n' +
          'shift 2\n' +
          'exec node "$ACCORD_CLI" "$@"\n'
      : '#!/bin/sh\n' +
          'printf \'%s\\n\' "$*" >> "$ACCORD_STUB_LOG"\n' +
          'last=\nfor a in "$@"; do last=$a; done\n' +
          'if [ "$last" = "$ACCORD_STUB_FAIL" ]; then exit 1; fi\nexit 0\n',
  );
  chmodSync(join(bin, 'npx'), 0o755);
  writeFileSync(join(repo, 'calls.log'), '');

  // Relative paths for the script and the log: the shell resolves both against `cwd`, so no Windows
  // path ever reaches a POSIX redirect.
  const env = {
    ...process.env,
    PATH: bin + delimiter + (process.env.PATH ?? ''),
    BASE: opts.base,
    ACCORD_STUB_LOG: 'calls.log',
    ACCORD_STUB_FAIL: opts.fail ?? '--no invocation ends with this argument--',
    ACCORD_CLI: CLI,
  };
  const options = { cwd: repo, encoding: 'utf8' as const, env };
  let code = 0;
  let out: string;
  let err = '';
  try {
    out = execFileSync(BASH, ['script.sh'], options);
  } catch (e) {
    const failure = e as { status?: number; stdout?: string; stderr?: string };
    code = failure.status ?? -1;
    out = String(failure.stdout ?? '');
    err = String(failure.stderr ?? '');
  }
  const calls = readFileSync(join(repo, 'calls.log'), 'utf8')
    .split('\n')
    .filter((l) => l !== '');
  return { code, out, err, calls };
}

// Guard the guard, OUTSIDE the skipped describe (T-07-35): on a POSIX host this case fails rather than
// letting the ubuntu CI leg report green having executed nothing.
describe('the emitted workflow script — what is under test', () => {
  it('is a multi-line script lifted from the emitted document, and bash resolved', () => {
    expect(SCRIPT.length).toBeGreaterThan(0);
    expect(SCRIPT.split('\n').length).toBeGreaterThan(1);
    expect(NOTHING_TO_GATE.length, 'no echoed line found in the script').toBeGreaterThan(0);
    if (process.platform !== 'win32') {
      expect(noBash, `${BASH} did not run on a POSIX host; set ACCORD_BASH`).toBe(false);
    }
  });
});

// Each case spawns git twice and bash once; on Windows, under a full parallel `npm test`, that
// overruns the 5 s default. The budget is generous on purpose — a timeout here reads as a flake, and a
// flaky case is one someone eventually deletes.
describe.skipIf(noBash)('the emitted workflow script — executed', { timeout: 60_000 }, () => {
  it('docs-only diff: says why there is nothing to gate, exits with lint’s code, gates nothing (D-138)', () => {
    const { repo, base } = sandbox((r) => write(r, 'docs/note.md', 'new\n'));
    const result = runScript(repo, { base });
    expect(result.code, result.err).toBe(0);
    expect(result.out).toContain(NOTHING_TO_GATE);
    expect(result.calls.length, result.calls.join(' | ')).toBe(1);
    expect(result.calls[0].endsWith(' lint')).toBe(true);
  });

  it('ticket-adding diff: gates that ticket by the id in its file name (D-137)', () => {
    const { repo, base } = sandbox((r) => write(r, 'accord/tickets/SIGNUP-1.md', 'id: SIGNUP-1\n'));
    const result = runScript(repo, { base });
    expect(result.code, result.err).toBe(0);
    expect(result.calls.length, result.calls.join(' | ')).toBe(2);
    expect(result.calls[0].endsWith(' lint')).toBe(true);
    expect(result.calls[1].endsWith(' gate done SIGNUP-1')).toBe(true);
    expect(result.out).not.toContain(NOTHING_TO_GATE);
  });

  it('ticket-deleting diff: does not gate the ticket the pull request removes (A-09)', () => {
    const { repo, base } = sandbox((r) => rmSync(join(r, 'accord', 'tickets', 'OLD-1.md')));
    const result = runScript(repo, { base });
    expect(result.code, result.err).toBe(0);
    expect(result.calls.length, result.calls.join(' | ')).toBe(1);
    expect(result.calls[0].endsWith(' lint')).toBe(true);
    expect(result.out).toContain(NOTHING_TO_GATE);
  });

  it('nested-path diff: accord/tickets/<id>/verification.md is not a ticket ([^/]+)', () => {
    const { repo, base } = sandbox((r) => write(r, 'accord/tickets/SIGNUP-1/verification.md', 'v\n'));
    const result = runScript(repo, { base });
    expect(result.code, result.err).toBe(0);
    expect(result.calls.length, result.calls.join(' | ')).toBe(1);
    expect(result.calls[0].endsWith(' lint')).toBe(true);
  });

  it('a failing gate exits 1 and lint still ran first (A-10)', () => {
    const { repo, base } = sandbox((r) => write(r, 'accord/tickets/SIGNUP-1.md', 'id: SIGNUP-1\n'));
    const result = runScript(repo, { base, fail: 'SIGNUP-1' });
    expect(result.code).toBe(1);
    expect(result.calls.length, result.calls.join(' | ')).toBe(2);
    expect(result.calls[0].endsWith(' lint')).toBe(true);
  });

  it('a failing lint exits 1 and the gates still ran (A-10, the other direction)', () => {
    const { repo, base } = sandbox((r) => write(r, 'accord/tickets/SIGNUP-1.md', 'id: SIGNUP-1\n'));
    const result = runScript(repo, { base, fail: 'lint' });
    expect(result.code).toBe(1);
    expect(result.calls.length, result.calls.join(' | ')).toBe(2);
    expect(result.calls[1].endsWith(' gate done SIGNUP-1')).toBe(true);
  });

  // Task 2. Without this, "the test passes" and "the test would fail if the script were wrong" are two
  // different claims, and only the first is evidenced.
  it('mutation probe: the deletion filter and the level bound are what cause those two results', () => {
    // Both fragments are named in the script's own comments, and `replace` takes the FIRST match — so
    // each pattern below carries enough of the command around it to be unique to the command line. A
    // mutation that lands in a comment changes the text and changes no behaviour, which would make the
    // "it changed" guard pass for the wrong reason (F-1).
    const noFilter = SCRIPT.replace('--name-only --diff-filter=d ', '--name-only ');
    expect(noFilter, 'the --diff-filter=d flag was not found on the git diff line').not.toBe(SCRIPT);
    const deleted = sandbox((r) => rmSync(join(r, 'accord', 'tickets', 'OLD-1.md')));
    const withoutFilter = runScript(deleted.repo, { base: deleted.base, script: noFilter });
    expect(withoutFilter.calls.length, withoutFilter.calls.join(' | ')).toBe(2);
    expect(withoutFilter.calls[1].endsWith(' gate done OLD-1')).toBe(true);

    // A function replacer, not a string: the pattern ends `$'`, which in a string replacement means
    // "everything after the match" and would splice the rest of the script in (F-2).
    const anyDepth = SCRIPT.replace(
      "'^accord/tickets/[^/]+[.]md$'",
      () => "'^accord/tickets/.+[.]md$'",
    );
    expect(anyDepth, 'the [^/]+ bound was not found in the grep pattern').not.toBe(SCRIPT);
    const nested = sandbox((r) => write(r, 'accord/tickets/SIGNUP-1/verification.md', 'v\n'));
    const withoutBound = runScript(nested.repo, { base: nested.base, script: anyDepth });
    expect(withoutBound.calls.length, withoutBound.calls.join(' | ')).toBe(2);
  });
});

// 07-03 F-3: the stub proves the shell logic, not that the real binary takes the arguments the script
// gives it or returns the exit codes the script assumes. These two run the built CLI.
describe.skipIf(noBash)('the emitted workflow script — against the real CLI', { timeout: 60_000 }, () => {
  const example = fileURLToPath(new URL('../../../examples/build/', import.meta.url));

  /** A sandbox holding the shipped example, so the real `lint` has a real repository to read. */
  function exampleRepo(change: (repo: string) => void): { repo: string; base: string } {
    const repo = makeEmptyRepo();
    repos.push(repo);
    cpSync(example, repo, { recursive: true });
    const base = commitAll(repo);
    change(repo);
    commitAll(repo);
    return { repo, base };
  }

  it('is built', () => {
    expect(existsSync(CLI), 'run npm run build first').toBe(true);
  });

  it('docs-only diff, real accord lint: the job goes green and reports why it gated nothing', () => {
    const { repo, base } = exampleRepo((r) => write(r, 'docs/note.md', 'new\n'));
    const result = runScript(repo, { base, forward: true });
    expect(result.code, result.out + result.err).toBe(0);
    expect(result.out).toContain('0 errors, 0 warnings');
    expect(result.out).toContain(NOTHING_TO_GATE);
    expect(result.calls.length, result.calls.join(' | ')).toBe(1);
  });

  it('ticket-touching diff, real accord gate done: the id is one the binary knows, its failure is the job’s', () => {
    const ticket = 'accord/tickets/SIGNUP-1.md';
    const { repo, base } = exampleRepo((r) => write(r, 'docs/note.md', 'new\n'));
    // Touch the ticket in a second commit so the diff carries it, changing nothing lint reads. The gate
    // then fails on the example's placeholder tick sha, which is the point: a real non-zero exit from the
    // real binary reaching the accumulator, with lint still clean beside it.
    write(repo, ticket, readFileSync(join(repo, ...ticket.split('/')), 'utf8') + '\n');
    commitAll(repo);
    const result = runScript(repo, { base, forward: true });
    expect(result.code).toBe(1);
    expect(result.out, 'lint was clean; only the gate failed').toContain('0 errors, 0 warnings');
    expect(result.calls.length, result.calls.join(' | ')).toBe(2);
    expect(result.calls[1].endsWith(' gate done SIGNUP-1')).toBe(true);
    // The id came from the file name and the binary recognised it: an id it did not know would be
    // reported as gate.ticket-unknown instead.
    expect(result.out + result.err).not.toContain('gate.ticket-unknown');
  });
});
