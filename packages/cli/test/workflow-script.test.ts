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
import { execFile, execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
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

// Ticket texts shared by the cases. The draft carries a commented `# approved_hash:` line and no key.
const DRAFT_TICKET = '---\nid: DRAFT-1\nstatus: draft\n# approved_hash:\n# ac_hash:\n---\n\n## Intent\nwhy\n';
const APPROVED_TICKET =
  '---\nid: OLD-1\nstatus: open\napproved_hash: "fnv1a64:0000000000000000"\n---\n\n## Intent\nold\n';
const CODE = 'export const a = 1;\n';
const FLOW_TICKET =
  '---\n{id: OLD-1, status: open, approved_hash: "fnv1a64:0000000000000000"}\n---\n\n## Intent\nold\n';

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
function sandbox(
  change: (repo: string) => void,
  seed?: (repo: string) => void,
): { repo: string; base: string } {
  const repo = makeEmptyRepo();
  repos.push(repo);
  write(repo, 'accord/tickets/OLD-1.md', APPROVED_TICKET);
  write(repo, 'docs/readme.md', 'base\n');
  seed?.(repo);
  const base = commitAll(repo);
  change(repo);
  commitAll(repo);
  return { repo, base };
}

// The stub-run fixtures of the gating cases, at module level so the test for the workflow of this
// repository replays the very cases the tests of the emitted script run.
interface Case {
  change: (repo: string) => void;
  seed?: (repo: string) => void;
  fail?: string;
}
const DROPPED_TICKET = '---\nid: OLD-1\nstatus: dropped\n---\n\n## Intent\nold\n\n## Dropped\nno longer needed\n';
const NO_KEY_TICKET = '---\nid: OLD-1\nstatus: open\n---\n\n## Intent\nold\n';
const addDrafts = (r: string): void => {
  write(r, 'accord/tickets/ST-8.md', DRAFT_TICKET);
  write(r, 'accord/tickets/ST-9.md', DRAFT_TICKET);
};
const UNAPPROVED: Case[] = [
  { change: addDrafts },
  {
    change: (r) => write(r, 'accord/tickets/DRAFT-1.md', DRAFT_TICKET + 'more\n'),
    seed: (r) => write(r, 'accord/tickets/DRAFT-1.md', DRAFT_TICKET),
  },
  { change: addDrafts, fail: 'lint' },
];
const droppedText = (statusLine: string): string =>
  `---\nid: OLD-1\n${statusLine}\napproved_hash: "fnv1a64:0000000000000000"\n---\n\n## Intent\nold\n\n## Dropped\nsuperseded by NEW-2\n`;
// `* -text` keeps the CR byte through `git add -A` under core.autocrlf=true.
const keepCr = (r: string): void => write(r, '.gitattributes', '* -text\n');
const DROPPED: Case[] = ['status: "dropped"   # superseded by NEW-2\r', 'status:\tdropped '].map((line) => ({
  change: (r: string) => write(r, 'accord/tickets/OLD-1.md', droppedText(line)),
  seed: keepCr,
}));
// A nested status under another key is not the ticket's status: the approved ticket is still gated.
const NESTED_STATUS: Case = {
  change: (r) =>
    write(r, 'accord/tickets/OLD-1.md', APPROVED_TICKET.replace('---\n\n', 'notes:\n  status: dropped\n---\n\n')),
};
const GATED: Array<Case & { id: string }> = [
  {
    id: 'ST-8',
    change: (r) => {
      write(r, 'accord/tickets/ST-8.md', DRAFT_TICKET);
      write(r, 'src/app.ts', CODE);
    },
  },
  {
    id: 'OLD-1',
    change: (r) => {
      write(r, 'accord/tickets/OLD-1.md', DROPPED_TICKET);
      write(r, 'src/app.ts', CODE);
    },
  },
  {
    id: 'ST-8',
    change: (r) => {
      rmSync(join(r, 'docs', 'readme.md'));
      write(r, 'accord/tickets/ST-8.md', DRAFT_TICKET);
    },
  },
  {
    // A rename that changes the id and drops approved_hash: the base version lives at the old path.
    id: 'REN-2',
    seed: (r) => write(r, 'accord/tickets/OLD-1.md', APPROVED_TICKET + 'body line\n'.repeat(30)),
    change: (r) => {
      rmSync(join(r, 'accord', 'tickets', 'OLD-1.md'));
      write(
        r,
        'accord/tickets/REN-2.md',
        APPROVED_TICKET.replace('OLD-1', 'REN-2').replace(/approved_hash.*\n/, '') + 'body line\n'.repeat(30),
      );
    },
  },
  {
    // Same rename without padding: git sees delete plus add, so only the deleted approved ticket gates it.
    id: 'REN-2',
    change: (r) => {
      rmSync(join(r, 'accord', 'tickets', 'OLD-1.md'));
      write(r, 'accord/tickets/REN-2.md', APPROVED_TICKET.replace('OLD-1', 'REN-2').replace(/approved_hash.*\n/, ''));
    },
  },
  { id: 'NEW-1', change: (r) => write(r, 'accord/tickets/NEW-1.md', APPROVED_TICKET.replace('OLD-1', 'NEW-1')) },
  { id: 'OLD-1', change: (r) => write(r, 'accord/tickets/OLD-1.md', NO_KEY_TICKET) },
  {
    // Dropped with no ## Dropped section is not dropped as lint defines it: the approved ticket is gated.
    id: 'OLD-1',
    change: (r) => write(r, 'accord/tickets/OLD-1.md', APPROVED_TICKET.replace('status: open', 'status: dropped')),
  },
  {
    // A reason that is only a comment is no reason.
    id: 'OLD-1',
    change: (r) =>
      write(r, 'accord/tickets/OLD-1.md', APPROVED_TICKET.replace('status: open', 'status: dropped') + '\n## Dropped\n<!-- why -->\n'),
  },
  { id: 'OLD-1', change: (r) => write(r, 'accord/tickets/OLD-1.md', NO_KEY_TICKET), fail: 'OLD-1' },
];

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
function prepare(
  repo: string,
  opts: { base: string; script?: string; fail?: string; forward?: boolean },
): { cwd: string; encoding: 'utf8'; env: NodeJS.ProcessEnv } {
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
  return { cwd: repo, encoding: 'utf8' as const, env };
}

function callsOf(repo: string): string[] {
  return readFileSync(join(repo, 'calls.log'), 'utf8')
    .split('\n')
    .filter((l) => l !== '');
}

function runScript(
  repo: string,
  opts: { base: string; script?: string; fail?: string; forward?: boolean },
): Run {
  const options = prepare(repo, opts);
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
  return { code, out, err, calls: callsOf(repo) };
}

const execFileAsync = promisify(execFile);

/** The same run as `runScript`, awaitable, so a case can start all its scripts at once; a run writes only inside its own sandbox. */
async function runScriptAsync(
  repo: string,
  opts: { base: string; script?: string; fail?: string; forward?: boolean },
): Promise<Run> {
  const options = prepare(repo, opts);
  let code = 0;
  let out: string;
  let err = '';
  try {
    out = (await execFileAsync(BASH, ['script.sh'], options)).stdout;
  } catch (e) {
    // execFile reports the exit status in `code`, not `status`.
    const failure = e as { code?: number; stdout?: string; stderr?: string };
    code = typeof failure.code === 'number' ? failure.code : -1;
    out = String(failure.stdout ?? '');
    err = String(failure.stderr ?? '');
  }
  return { code, out, err, calls: callsOf(repo) };
}

// Guard the guard, OUTSIDE the skipped describe (T-07-35): on a POSIX host this case fails rather than
// letting the ubuntu CI leg report green having executed nothing.
describe('the emitted workflow script — what is under test', () => {
  it('is a multi-line script lifted from the emitted document, and bash resolved', () => {
    expect(SCRIPT.length).toBeGreaterThan(0);
    expect(SCRIPT.split('\n').length).toBeGreaterThan(1);
    expect(NOTHING_TO_GATE.length, 'no echoed line found in the script').toBeGreaterThan(0);
  });
});

it.skipIf(process.platform === 'win32')('risk:regression bash runs on a posix host so the executed workflow script cases are not skipped there', () => {
  expect(noBash, `${BASH} did not run on a POSIX host; set ACCORD_BASH`).toBe(false);
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
    const { repo, base } = sandbox((r) => {
      write(r, 'accord/tickets/SIGNUP-1.md', 'id: SIGNUP-1\n');
      write(r, 'src/app.ts', CODE);
    });
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
    const { repo, base } = sandbox((r) => {
      write(r, 'accord/tickets/SIGNUP-1.md', 'id: SIGNUP-1\n');
      write(r, 'src/app.ts', CODE);
    });
    const result = runScript(repo, { base, fail: 'SIGNUP-1' });
    expect(result.code).toBe(1);
    expect(result.calls.length, result.calls.join(' | ')).toBe(2);
    expect(result.calls[0].endsWith(' lint')).toBe(true);
  });

  it('a failing lint exits 1 and the gates still ran (A-10, the other direction)', () => {
    const { repo, base } = sandbox((r) => {
      write(r, 'accord/tickets/SIGNUP-1.md', 'id: SIGNUP-1\n');
      write(r, 'src/app.ts', CODE);
    });
    const result = runScript(repo, { base, fail: 'lint' });
    expect(result.code).toBe(1);
    expect(result.calls.length, result.calls.join(' | ')).toBe(2);
    expect(result.calls[1].endsWith(' gate done SIGNUP-1')).toBe(true);
  });

  it('unapproved tickets in an accord-only diff: lint runs and no gate done runs and the exit follows lint', async () => {
    const [add, edit, failing] = UNAPPROVED;
    const added = sandbox(add.change, add.seed);
    const edited = sandbox(edit.change, edit.seed);
    const bad = sandbox(failing.change, failing.seed);
    const [r1, r2, r3] = await Promise.all([
      runScriptAsync(added.repo, { base: added.base }),
      runScriptAsync(edited.repo, { base: edited.base }),
      runScriptAsync(bad.repo, { base: bad.base, fail: failing.fail }),
    ]);
    expect(r1.code, r1.err).toBe(0);
    expect(r1.calls.length, r1.calls.join(' | ')).toBe(1);
    expect(r1.calls[0].endsWith(' lint')).toBe(true);
    expect(r1.calls.join(' ')).not.toContain(' gate done ');

    expect(r2.code, r2.err).toBe(0);
    expect(r2.calls.length, r2.calls.join(' | ')).toBe(1);
    expect(r2.calls[0].endsWith(' lint')).toBe(true);

    expect(r3.code).toBe(1);
    expect(r3.calls.length, r3.calls.join(' | ')).toBe(1);
    expect(r3.calls[0].endsWith(' lint')).toBe(true);
  });

  it('code in the diff or an approved ticket: gate done runs and its failure fails the job', async () => {
    const built = GATED.map((c) => sandbox(c.change, c.seed));
    const runs = await Promise.all(
      GATED.map((c, i) => runScriptAsync(built[i].repo, { base: built[i].base, fail: c.fail })),
    );
    const codes = GATED.map((c, i) => {
      const r = runs[i];
      expect(r.calls.length, r.calls.join(' | ')).toBe(2);
      expect(r.calls[0].endsWith(' lint')).toBe(true);
      expect(r.calls[1].endsWith(` gate done ${c.id}`)).toBe(true);
      return r.code;
    });
    expect(codes[0]).toBe(0);
    expect(codes[codes.length - 1]).toBe(1);
  });

  it('risk:security a ticket approved at the base and lane S at the head fails the job naming the ticket', () => {
    const laneS = '---\nid: OLD-1\nstatus: open\nlane: "S"\nac_hash: "fnv1a64:0000000000000000"\n---\n\n## Understood\nx\n\n## Done when\ny\n';
    const s = sandbox((r) => write(r, 'accord/tickets/OLD-1.md', laneS));
    const r = runScript(s.repo, { base: s.base });
    expect(r.code).toBe(1);
    expect(r.out + r.err).toContain('OLD-1');
    expect(r.out + r.err).toContain('lane cannot drop after approval');
    expect(r.calls.some((c) => c.endsWith(' gate done OLD-1'))).toBe(false);
  });

  it('risk:parsing BOM and CRLF frontmatter and unreadable blocks and large files read as approved', async () => {
    // Each call starts its sandbox's script run at once; every check runs when its run resolves.
    const runs: Array<Promise<void>> = [];
    const expectGated = (id: string, s: { repo: string; base: string }): void => {
      runs.push(
        runScriptAsync(s.repo, { base: s.base }).then((r) => {
          expect(r.calls.length, r.calls.join(' | ')).toBe(2);
          expect(r.calls[1].endsWith(` gate done ${id}`)).toBe(true);
        }),
      );
    };
    const crlf = (t: string): string => '﻿' + t.replace(/\n/g, '\r\n');
    expectGated(
      'OLD-1',
      sandbox(
        (r) => write(r, 'accord/tickets/OLD-1.md', crlf('---\nid: OLD-1\nstatus: open\n---\n\n## Intent\nold\n')),
        (r) => {
          write(r, '.gitattributes', '* -text\n');
          write(r, 'accord/tickets/OLD-1.md', crlf(APPROVED_TICKET));
        },
      ),
    );
    expectGated(
      'OLD-1',
      sandbox(
        (r) => write(r, 'accord/tickets/OLD-1.md', DRAFT_TICKET),
        (r) => write(r, 'accord/tickets/OLD-1.md', '---\nid: OLD-1\nstatus: open\n\n## Intent\nold\n'),
      ),
    );
    expectGated(
      'OLD-1',
      sandbox(
        (r) => write(r, 'accord/tickets/OLD-1.md', FLOW_TICKET + 'edited\n'),
        (r) => write(r, 'accord/tickets/OLD-1.md', FLOW_TICKET),
      ),
    );
    // Approved in YAML spellings the line greps cannot read: a body-only edit stays gated.
    for (const fm of [
      'id: OLD-1\n?\n  approved_hash\n: "x"\n',
      'id: OLD-1\n? approved_hash\n: "x"\n',
      '!!map {id: OLD-1, approved_hash: "x"}\n',
      '  id: OLD-1\n  approved_hash: "x"\n',
    ]) {
      expectGated(
        'OLD-1',
        sandbox(
          (r) => write(r, 'accord/tickets/OLD-1.md', '---\n' + fm + '---\n\n## Intent\nedited\n'),
          (r) => write(r, 'accord/tickets/OLD-1.md', '---\n' + fm + '---\n\n## Intent\nold\n'),
        ),
      );
    }
    expectGated(
      'BIG-1',
      sandbox((r) =>
        write(
          r,
          'accord/tickets/BIG-1.md',
          '---\nid: BIG-1\napproved_hash: "x"\n---\n\n' + 'filler line\n'.repeat(160_000),
        ),
      ),
    );
    await Promise.all(runs);
  });

  it('the workflow of this repository gates the same tickets with the same exit as the emitted one', async () => {
    const yml = readFileSync(fileURLToPath(new URL('../../../.github/workflows/accord.yml', import.meta.url)), 'utf8');
    const named = (parse(yml) as unknown as { jobs: { accord: { steps: Array<Step & { name?: string }> } } }).jobs
      .accord.steps.filter((s) => s.name === 'lint and gate');
    expect(named.length, 'exactly one step is named lint and gate').toBe(1);
    const own = named[0].run as string;
    const gatedIds = (calls: string[]): string[] =>
      calls.filter((c) => c.includes('gate done ')).map((c) => c.slice(c.indexOf('gate done ') + 'gate done '.length));
    const all: Case[] = [...UNAPPROVED, ...DROPPED, NESTED_STATUS, ...GATED];
    // All sandboxes first, then every script run at once.
    const built = all.map((c) => [SCRIPT, own].map((script) => ({ script, s: sandbox(c.change, c.seed) })));
    const ran = await Promise.all(
      all.map((c, i) =>
        Promise.all(built[i].map(({ script, s }) => runScriptAsync(s.repo, { base: s.base, script, fail: c.fail }))),
      ),
    );
    for (const [i] of all.entries()) {
      const results = ran[i];
      expect(results[1].code, results[1].calls.join(' | ')).toBe(results[0].code);
      expect(gatedIds(results[1].calls)).toEqual(gatedIds(results[0].calls));
    }
    // 24+ sandboxes of git work: its own budget so load cannot time it out.
  }, 300_000);

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

it.skipIf(noBash)('risk:security a lane S ticket that passed gate ready is gated in an accord-only diff and a queued one is not', async () => {
  const READY_S = '---\nid: LS-1\nstatus: open\nlane: S   # S: one small change\nac_hash: "fnv1a64:0000000000000000"\n---\n\n## Understood\nx\n';
  const QUOTED_S = READY_S.replace('lane: S   # S: one small change', 'lane: "S"');
  const QUEUED_S = READY_S.replace('ac_hash: "fnv1a64:0000000000000000"', '# ac_hash:');
  const M_HASH = READY_S.replace('lane: S   # S: one small change', 'lane: M');
  const yml = readFileSync(fileURLToPath(new URL('../../../.github/workflows/accord.yml', import.meta.url)), 'utf8');
  const named = (parse(yml) as unknown as { jobs: { accord: { steps: Array<Step & { name?: string }> } } }).jobs
    .accord.steps.filter((s) => s.name === 'lint and gate');
  const own = named[0].run as string;
  // Both scripts over all four texts: every sandbox first, then the eight runs at once.
  const texts: Array<[string, boolean]> = [[READY_S, true], [QUOTED_S, true], [QUEUED_S, false], [M_HASH, false]];
  const jobs = [SCRIPT, own].flatMap((script) =>
    texts.map(([text, gated]) => ({ script, gated, s: sandbox((r) => write(r, 'accord/tickets/LS-1.md', text)) })),
  );
  const runs = await Promise.all(jobs.map(({ script, s }) => runScriptAsync(s.repo, { base: s.base, script })));
  for (const [i, { gated }] of jobs.entries()) {
    const r = runs[i];
    if (gated) {
      expect(r.calls.length, r.calls.join(' | ')).toBe(2);
      expect(r.calls[1].endsWith(' gate done LS-1')).toBe(true);
    } else {
      expect(r.calls.length, r.calls.join(' | ')).toBe(1);
      expect(r.out).toContain('not gating LS-1');
    }
  }
}, 300_000);

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

  it('dropped ticket in an accord-only diff: no gate done on it and a missing Dropped reason fails through lint', async () => {
    const ticket = 'accord/tickets/SIGNUP-1.md';
    const reason = 'a dropped ticket needs a "## Dropped" section saying why';
    const drop = (r: string, approved: boolean, section: string): void => {
      const text = readFileSync(join(r, ...ticket.split('/')), 'utf8');
      const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
      const lines = (fm?.[1] ?? '').split(/\r?\n/).filter((l) => !/^(status|approved_hash)\s*:/.test(l));
      lines.push('status: dropped');
      if (approved) lines.push('approved_hash: "fnv1a64:0000000000000000"');
      write(r, ticket, `---\n${lines.join('\n')}\n---\n${fm?.[2] ?? ''}${section}`);
    };
    // Every sandbox first, then the six runs at once.
    const droppedBuilt = DROPPED.map((c) => sandbox(c.change, c.seed));
    const nested = sandbox(NESTED_STATUS.change);
    const withReason = exampleRepo((r) => drop(r, true, '\n## Dropped\nsuperseded by another ticket\n'));
    const sections = ['', '\n## Dropped\n<!-- why -->\n'];
    const badBuilt = sections.map((section) => exampleRepo((r) => drop(r, false, section)));
    const [droppedRuns, rn, ok, badRuns] = await Promise.all([
      Promise.all(droppedBuilt.map(({ repo, base }) => runScriptAsync(repo, { base }))),
      runScriptAsync(nested.repo, { base: nested.base }),
      runScriptAsync(withReason.repo, { base: withReason.base, forward: true }),
      Promise.all(badBuilt.map((bad) => runScriptAsync(bad.repo, { base: bad.base, forward: true }))),
    ]);

    for (const [i] of DROPPED.entries()) {
      const r = droppedRuns[i];
      expect(r.code, r.err).toBe(0);
      expect(r.calls.length, r.calls.join(' | ')).toBe(1);
      expect(r.calls.join(' ')).not.toContain(' gate done ');
    }

    expect(rn.calls.length, rn.calls.join(' | ')).toBe(2);
    expect(rn.calls[1].endsWith(' gate done OLD-1')).toBe(true);

    expect(ok.code, ok.out + ok.err).toBe(0);
    expect(ok.calls.length, ok.calls.join(' | ')).toBe(1);
    expect(ok.out + ok.err).not.toContain(reason);

    for (const [i] of sections.entries()) {
      const res = badRuns[i];
      expect(res.code, res.out + res.err).toBe(1);
      expect(res.calls.length, res.calls.join(' | ')).toBe(1);
      expect(res.out + res.err).toContain(reason);
    }
  });
});
