// ST-LN-97 D-12 the team script adapter, contract version 1. A script is untrusted committed content: it
// gets the issue keys on stdin only, and what it prints is display text, never a verdict or an exit code
// (D-01). Nothing here reaches a network. Fixture scripts are `.mjs` files written into a temp folder and
// run as `node "<path>"` (never `./x.sh`: cmd.exe cannot run it, RESEARCH Pitfall 7). The 10 s timeout is
// proved by handing the adapter a runner that records its options, not by sleeping 10 s (the real kill is
// team-run.test.ts's case); the 1 MiB cap is proved with the real runner because it ends in milliseconds.
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { TeamRun, TeamRunOptions } from '../src/load/team-run.js';
import { runTeamCommand } from '../src/load/team-run.js';
import { adapterFor } from '../src/tracker/index.js';
import type { TrackerIo } from '../src/tracker/index.js';
import { fetchScript } from '../src/tracker/script.js';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const dir = mkdtempSync(join(tmpdir(), 'accord-tracker-script-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const TICKETS = 'accord/tickets';
const posix = (p: string): string => p.replaceAll('\\', '/');
const ENV: NodeJS.ProcessEnv = { ...process.env };

let counter = 0;
/** A fixture script written as a `.mjs` file; returns the command text that runs it. */
function script(body: string): string {
  counter += 1;
  const path = posix(join(dir, 'fixture' + counter + '.mjs'));
  writeFileSync(path, body);
  return `node "${path}"`;
}

/** The v1 answer a well-behaved script prints. */
const answer = (issues: Record<string, unknown>, version: unknown = 1): string => JSON.stringify({ version, issues });
const printing = (text: string): string => script(`process.stdout.write(${JSON.stringify(text)});\n`);

/** A script that reads stdin to the end, then runs `then` with it as `input`. */
const reading = (then: string): string =>
  script(`let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => { ${then} });
`);

/** A schema-valid ticket carrying whatever frontmatter the case is about. */
function addTicket(repo: string, id: string, extra: string): void {
  writeFileSync(
    join(repo, ...TICKETS.split('/'), id + '.md'),
    `---
id: ${id}
title: ${id} fixture
type: story
${extra}
---

## Intent
Added by the tracker script test sandbox.

## Requirements
- WHEN a case needs this ticket the system SHALL render one row

## Acceptance criteria
\`\`\`gherkin
Feature: ${id}

  @ac-1
  Scenario: One row
    When status runs
    Then the row appears
\`\`\`

## Open questions
- [x] None.

## Plan
- [x] Done
`,
  );
}

/** Point the sandbox's config.yml at the script adapter with this command. */
function configureScript(repo: string, command: string): void {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8').replace('tracker:\n  adapter: none', `tracker:\n  adapter: script\n  command: ${JSON.stringify(command)}`);
  expect(text).toContain('adapter: script');
  writeFileSync(file, text);
}

/** A sandbox with two tickets linking ENG-1 and ENG-2 through the script adapter. */
function scriptRepo(command: string): string {
  const repo = makeRepo('valid-build');
  configureScript(repo, command);
  addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  script: "ENG-1"');
  addTicket(repo, 'ISS-8', 'status: open\ntracker:\n  script: "ENG-2"');
  return repo;
}

const rowOf = (out: string, id: string): string => out.split('\n').find((l) => l.startsWith(id)) ?? '';

/** An adapter io whose runner is the real one, recording what it was asked. */
function recordingIo(seen: { command?: string; options?: TeamRunOptions }): TrackerIo {
  return {
    fetchImpl: (() => {
      throw new Error('a script adapter must not use fetch');
    }) as unknown as typeof fetch,
    root: dir,
    run: (command, options) => {
      seen.command = command;
      seen.options = options;
      return runTeamCommand(command, options);
    },
  };
}

/** An adapter io whose runner is a stub returning `result`. */
function stubIo(result: Partial<TeamRun> | Error): TrackerIo {
  return {
    fetchImpl: fetch,
    root: dir,
    run: () => {
      if (result instanceof Error) throw result;
      return { code: 0, signal: null, stdout: '', stderr: '', timedOut: false, oversize: false, ...result };
    },
  };
}

describe('the script contract version 1 (ST-LN-97 t3-ac-2)', () => {
  it('risk:security a team tracker script gets the keys on stdin and its answer is display only (ST-LN-97 t3-ac-2)', async () => {
    const seenFile = posix(join(dir, 'seen.json'));
    const command = reading(
      `import('node:fs').then(({ writeFileSync }) => {
        writeFileSync(${JSON.stringify(seenFile)}, JSON.stringify({ argv: process.argv.slice(2), input, tracker: process.env.ACCORD_TRACKER, root: process.env.ACCORD_ROOT, cwd: process.cwd() }));
        process.stdout.write(${JSON.stringify(
          answer({
            'ENG-1': { title: 'Fix', state: 'Doing', labels: ['ui', 'csv'] },
            'ENG-2': { title: 'Add login', state: 'Todo', labels: [] },
            'ZZ-9': { title: 'Not asked for', state: 'Done', labels: [] },
          }),
        )});
      });`,
    );
    const repo = scriptRepo(command);
    try {
      const { code, out, err } = await run(['status'], repo, ENV);
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(rowOf(out, 'ISS-7')).toContain('ENG-1 Doing Fix ui,csv');
      expect(rowOf(out, 'ISS-8')).toContain('ENG-2 Todo Add login');
      expect(out).not.toContain('Not asked for');

      const seen = JSON.parse(readFileSync(seenFile, 'utf8')) as { argv: string[]; input: string; tracker: string; root: string; cwd: string };
      // Nothing accord added reaches argv or the command text; the keys are on stdin and nowhere else.
      expect(seen.argv).toEqual([]);
      expect(command).not.toContain('ENG-');
      expect(seen.input).toMatch(/^\{"version":1,"keys":\[[^\n]*\]\}\n$/);
      const asked = JSON.parse(seen.input) as { version: number; keys: string[] };
      expect(asked.version).toBe(1);
      expect([...asked.keys].sort()).toEqual(['ENG-1', 'ENG-2']);
      expect(seen.tracker).toBe('script');
      expect(realpathSync.native(seen.root)).toBe(realpathSync.native(repo));
      expect(realpathSync.native(seen.cwd)).toBe(realpathSync.native(repo));
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security the runner gets a 10 s timeout, a 1 MiB output cap, the repository as cwd and the keys as one stdin line (ST-LN-97 t3-ac-2)', async () => {
    const seen: { command?: string; options?: TeamRunOptions } = {};
    const command = printing(answer({}));
    const result = await fetchScript(command, ['ENG-1', 'ENG-2', 'ENG-1'], { PATH: ENV.PATH, SystemRoot: ENV.SystemRoot, KEEP_ME: 'yes' }, recordingIo(seen));
    expect(result).toEqual({ issues: {} });
    expect(seen.command).toBe(command);
    expect(seen.options?.timeoutMs).toBe(10_000);
    expect(seen.options?.maxBuffer).toBe(1024 * 1024);
    expect(seen.options?.cwd).toBe(dir);
    expect(seen.options?.input).toBe('{"version":1,"keys":["ENG-1","ENG-2"]}\n');
    // The caller's environment is inherited; accord adds exactly two names.
    expect(seen.options?.env).toMatchObject({ KEEP_ME: 'yes', ACCORD_TRACKER: 'script', ACCORD_ROOT: dir });
    expect(Object.keys(seen.options?.env ?? {}).filter((k) => k.startsWith('ACCORD_')).sort()).toEqual(['ACCORD_ROOT', 'ACCORD_TRACKER']);
  });

  it('risk:security a key that looks like shell is data on stdin and is never run (ST-LN-97 t3-ac-2)', async () => {
    const pwned = posix(join(dir, 'pwned.txt'));
    const hostile = `ENG-1";touch ${pwned};echo "$(touch ${pwned})`;
    const seen: { command?: string; options?: TeamRunOptions } = {};
    const command = reading(`process.stdout.write(JSON.stringify({ version: 1, issues: { [JSON.parse(input).keys[0]]: { title: 'hostile', state: 'Todo', labels: [] } } }));`);
    const result = await fetchScript(command, [hostile], ENV, recordingIo(seen));
    expect(existsSync(pwned)).toBe(false);
    expect(seen.command).toBe(command);
    expect(seen.options?.input).toBe(JSON.stringify({ version: 1, keys: [hostile] }) + '\n');
    expect(result.warning).toBeUndefined();
    expect(Object.keys(result.issues)).toEqual([hostile]);
  });

  it('risk:complex-branching unknown keys are ignored, a missing key is an empty cell without a warning, and an inherited name is never a key (ST-LN-97 t3-ac-2)', async () => {
    const stdout = JSON.stringify({ version: 1, issues: { 'ENG-1': { title: 'One', state: 'Todo', labels: [] }, 'ZZ-9': { title: 'Unasked', state: 'Done', labels: [] } } });
    const result = await fetchScript('x', ['ENG-1', 'ENG-2', 'constructor', '__proto__'], ENV, stubIo({ stdout }));
    expect(result.warning).toBeUndefined();
    expect(Object.keys(result.issues)).toEqual(['ENG-1']);
    expect(result.issues['ENG-1']).toEqual({ title: 'One', state: 'Todo', labels: [] });
    expect(result.issues['constructor']).toBeUndefined();
    expect(result.issues['__proto__']).toBeUndefined();
    expect(Object.getPrototypeOf(result.issues)).not.toBe(Object.prototype);
  });

  it('risk:complex-branching no key means no script (ST-LN-97 t3-ac-2)', async () => {
    const io = stubIo(new Error('the runner must not be reached with no key'));
    expect(await fetchScript('x', [], ENV, io)).toEqual({ issues: {} });
  });

  it('risk:security every shown field is printable ASCII, a title with an escape sequence included (ST-LN-97 t3-ac-2)', async () => {
    const hostile = { title: '\u001b[31mred\u001b[0m\r\nfake line‮evil', state: 'Do\u0007ne', labels: ['ok\u001b[2J', '\u0000'] };
    const result = await fetchScript('x', ['ENG-1'], ENV, stubIo({ stdout: answer({ 'ENG-1': hostile }) }));
    expect(result.warning).toBeUndefined();
    const facts = result.issues['ENG-1'];
    expect(facts).toEqual({ title: '[31mred [0m fake line evil', state: 'Do ne', labels: ['ok [2J'] });
    for (const text of [facts.title, facts.state, ...facts.labels]) expect(text).toMatch(/^[\x20-\x7e]*$/);
  });
});

describe('every bad answer is one warning and no verdict (ST-LN-97 t3-ac-2)', () => {
  const warn = async (io: TrackerIo, keys: string[] = ['ENG-1', 'ENG-2']) => fetchScript('x', keys, ENV, io);

  it('risk:security an exit other than 0, a kill, a timeout and over-size output are each one named reason (ST-LN-97 t3-ac-2)', async () => {
    const ok = answer({ 'ENG-1': { title: 'T', state: 'S', labels: [] } });
    const cases: [Partial<TeamRun>, string][] = [
      [{ code: 1, stdout: ok }, 'tracker script: exited 1'],
      [{ code: null, signal: 'SIGKILL' }, 'tracker script: was killed by SIGKILL'],
      [{ code: null, signal: 'SIGKILL', timedOut: true, stdout: ok }, 'tracker script: timed out after 10 s'],
      [{ code: null, signal: 'SIGKILL', oversize: true, stdout: ok }, 'tracker script: printed more than 1 MiB'],
    ];
    for (const [result, expected] of cases) {
      const r = await warn(stubIo(result));
      expect(r.issues).toEqual({});
      expect(r.warning).toBe(expected);
    }
  });

  it('risk:security the first line of the script stderr rides on the warning, as printable ASCII (ST-LN-97 t3-ac-2)', async () => {
    const r = await warn(stubIo({ code: 3, stderr: '\n  \u001b[31mtoken expired\u001b[0m\u0007\nsecond line\n' }));
    expect(r.warning).toBe('tracker script: exited 3; [31mtoken expired [0m');
    expect(r.warning).not.toContain('second line');
    expect(r.warning).toMatch(/^[\x20-\x7e]*$/);
    expect(r.warning).not.toContain('\n');
    // A very long stderr line is cut, so one warning stays one short line.
    const long = await warn(stubIo({ code: 1, stderr: 'x'.repeat(5000) }));
    expect((long.warning ?? '').length).toBeLessThan(400);
  });

  it('risk:security output that is not JSON, not an object, or has the wrong version is one warning with no cell (ST-LN-97 t3-ac-2)', async () => {
    const cases: [string, string][] = [
      ['not json', 'tracker script: output is not JSON'],
      ['', 'tracker script: output is not JSON'],
      ['null', 'tracker script: output is not a JSON object'],
      ['[1]', 'tracker script: output is not a JSON object'],
      ['"text"', 'tracker script: output is not a JSON object'],
      [answer({}, 2), 'tracker script: version 2 is not supported, this accord reads version 1'],
      [answer({}, '1'), 'tracker script: version "1" is not supported, this accord reads version 1'],
      [JSON.stringify({ issues: {} }), 'tracker script: output has no version, this accord reads version 1'],
      [JSON.stringify({ version: 1 }), 'tracker script: issues is not an object'],
      [JSON.stringify({ version: 1, issues: [] }), 'tracker script: issues is not an object'],
      [JSON.stringify({ version: 1, issues: null }), 'tracker script: issues is not an object'],
    ];
    for (const [stdout, expected] of cases) {
      const r = await warn(stubIo({ stdout }));
      expect(r.issues, stdout).toEqual({});
      expect(r.warning, stdout).toBe(expected);
    }
  });

  it('risk:complex-branching a malformed entry is skipped and named while the good one is shown (ST-LN-97 t3-ac-2)', async () => {
    const good = { title: 'Good', state: 'Todo', labels: ['a'] };
    const bad: Record<string, unknown> = {
      numericTitle: { title: 5, state: 'Todo', labels: [] },
      numericState: { title: 'T', state: 5, labels: [] },
      noLabels: { title: 'T', state: 'Todo' },
      labelsNotArray: { title: 'T', state: 'Todo', labels: 'a' },
      labelNotString: { title: 'T', state: 'Todo', labels: ['a', 1] },
      nullEntry: null,
      arrayEntry: [],
      stringEntry: 'x',
    };
    for (const [name, entry] of Object.entries(bad)) {
      const r = await warn(stubIo({ stdout: answer({ 'ENG-1': good, 'ENG-2': entry }) }));
      expect(Object.keys(r.issues), name).toEqual(['ENG-1']);
      expect(r.warning, name).toBe('tracker script: ENG-2 malformed entry');
    }
    // Two bad ones keep the order of the keys asked for, and stderr rides along.
    const two = await warn(stubIo({ stdout: answer({ 'ENG-2': 1, 'ENG-1': 2 }), stderr: 'hint\n' }));
    expect(two.warning).toBe('tracker script: ENG-1 malformed entry, ENG-2 malformed entry; hint');
    // A malformed entry for a key nobody asked about is not this run's business.
    const unasked = await warn(stubIo({ stdout: answer({ 'ENG-1': good, 'ZZ-9': 7 }) }), ['ENG-1']);
    expect(unasked.warning).toBeUndefined();
  });

  it('risk:security a runner that throws is a warning, never a rejection (ST-LN-97 t3-ac-2)', async () => {
    const r = await warn(stubIo(new Error('worker failed \u001b[31m to start')));
    expect(r.issues).toEqual({});
    expect(r.warning).toBe('tracker script: could not run: worker failed [31m to start');
  });
});

describe('accord status with tracker.adapter: script (ST-LN-97 t3-ac-2)', () => {
  const emptyCells = (out: string): void => {
    expect(rowOf(out, 'ISS-7')).not.toMatch(/ENG-/);
    expect(rowOf(out, 'ISS-8')).not.toMatch(/ENG-/);
    // The rest of the table still printed.
    expect(out).toContain('EPIC-1');
  };

  it('risk:security a script that exits 1, prints not-JSON, prints version 2 or prints 2 MiB gives one warning, empty cells and exit 0 (ST-LN-97 t3-ac-2)', async () => {
    const fixtures: [string, string, string][] = [
      ['exit 1', script("console.error('boom from script'); console.log(" + JSON.stringify(answer({})) + '); process.exit(1);\n'), 'tracker script: exited 1; boom from script'],
      ['not json', printing('not json'), 'tracker script: output is not JSON'],
      ['version 2', printing(answer({ 'ENG-1': { title: 'T', state: 'S', labels: [] } }, 2)), 'tracker script: version 2 is not supported, this accord reads version 1'],
      ['2 MiB', script("process.stdout.write('x'.repeat(2 * 1024 * 1024));\n"), 'tracker script: printed more than 1 MiB'],
    ];
    for (const [name, command, expected] of fixtures) {
      const repo = scriptRepo(command);
      try {
        const { code, out, err } = await run(['status'], repo, ENV);
        expect(code, name).toBe(0);
        expect(err, name).toBe(expected + '\n');
        emptyCells(out);
      } finally {
        cleanup(repo);
      }
    }
  });

  it('risk:security a script with a numeric title for one key shows the other row and names the bad one (ST-LN-97 t3-ac-2)', async () => {
    const command = printing(answer({ 'ENG-1': { title: 'Fine', state: 'Todo', labels: [] }, 'ENG-2': { title: 7, state: 'Todo', labels: [] } }));
    const repo = scriptRepo(command);
    try {
      const { code, out, err } = await run(['status'], repo, ENV);
      expect(code).toBe(0);
      expect(err).toBe('tracker script: ENG-2 malformed entry\n');
      expect(rowOf(out, 'ISS-7')).toContain('ENG-1 Todo Fine');
      expect(rowOf(out, 'ISS-8')).not.toMatch(/ENG-/);
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security a title with an escape sequence is printed as printable ASCII and so is a stderr line (ST-LN-97 t3-ac-2)', async () => {
    const repo = scriptRepo(printing(answer({ 'ENG-1': { title: '\u001b[31mred\u001b[0m', state: 'Todo', labels: [] } })));
    const failing = scriptRepo(script("console.error('\\u001b[2Jwiped'); process.exit(2);\n"));
    try {
      const shown = await run(['status'], repo, ENV);
      expect(shown.out + shown.err).not.toContain('\u001b');
      expect(rowOf(shown.out, 'ISS-7')).toContain('ENG-1 Todo [31mred [0m');
      const failed = await run(['status'], failing, ENV);
      expect(failed.err).toBe('tracker script: exited 2; [2Jwiped\n');
      expect(failed.out + failed.err).not.toContain('\u001b');
    } finally {
      cleanup(repo);
      cleanup(failing);
    }
  });

  it('risk:security status --json and the gate and lint verdicts never run the script, and equal those under adapter none (ST-LN-97 t3-ac-2)', async () => {
    const marker = posix(join(dir, 'ran.txt'));
    const command = script(`import('node:fs').then(({ appendFileSync }) => { appendFileSync(${JSON.stringify(marker)}, 'ran\\n'); process.exit(1); });\n`);
    const none = makeRepo('gate-ready');
    const withScript = makeRepo('gate-ready');
    try {
      configureScript(withScript, command);
      // The same link in both sandboxes, so finding line numbers match; only `withScript` configures an adapter.
      for (const repo of [none, withScript]) {
        const file = join(repo, ...TICKETS.split('/'), 'CLEAN.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace('id: CLEAN', 'id: CLEAN\ntracker:\n  script: "ENG-1"'));
      }
      // A passing `gate ready` writes ac_hash into the ticket (D-96); settle that write before comparing.
      await run(['gate', 'ready', 'CLEAN', '--json'], none, ENV);
      await run(['gate', 'ready', 'CLEAN', '--json'], withScript, ENV);
      for (const args of [['gate', 'ready', 'CLEAN', '--json'], ['gate', 'done', 'CLEAN', '--json'], ['lint', '--json']]) {
        const a = await run(args, none, ENV);
        const b = await run(args, withScript, ENV);
        expect(b.code).toBe(a.code);
        expect(b.out).toBe(a.out);
        expect(b.err).toBe(a.err);
      }
      const json = await run(['status', '--json'], withScript, ENV);
      expect(json.code).toBe(0);
      expect(json.err).toBe('');
      expect(existsSync(marker)).toBe(false);
      // And a failing script on a plain status leaves the exit code at 0: the same marker proves it ran this time.
      const shown = await run(['status'], withScript, ENV);
      expect(shown.code).toBe(0);
      expect(existsSync(marker)).toBe(true);
      expect(shown.err).toBe('tracker script: exited 1\n');
    } finally {
      cleanup(none);
      cleanup(withScript);
    }
  });
});

describe('adapterFor with the script adapter (ST-LN-97 t3-ac-1)', () => {
  it('risk:complex-branching script with a command is the script adapter and script without one reads nothing (ST-LN-97 t3-ac-1)', () => {
    const adapter = adapterFor({ adapter: 'script', command: 'node x.mjs' });
    expect(adapter?.name).toBe('script');
    expect(adapterFor({ adapter: 'script' })).toBeUndefined();
    expect(adapterFor({ adapter: 'none' })).toBeUndefined();
    expect(adapterFor({ adapter: 'linear' })?.name).toBe('linear');
  });
});
