// Phase 08.7 D-02, D-04, A-03: `accord show <id> --json` carries the ticket's session log `log`: its commits since the default branch, its executor and fix reports by name and time
// (never their text), and each `accord gate` run from the git-ignored gate log. The CLI is the one source; no gate reads the record; the text output stays as it was (D-09).
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { appendGateRun, readGateRuns } from '../src/load/ticket-log.js';
import { cleanup, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { discussFor, discussPath, P, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const T1 = new Date('2026-03-01T10:00:00Z');
const T2 = new Date('2026-03-01T11:00:00Z');
const T3 = new Date('2026-03-01T12:00:00Z');
const secs = (d: Date): number => Math.floor(d.getTime() / 1000);

/** A lane sandbox committed on its first branch with `origin/main` at that commit, then on branch `t/T-1`. */
function branchRepo(): string {
  const repo = makeLaneRepo();
  commitMsg(repo, 'chore: base', T1);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  return repo;
}

/** The three commits of the first case: two touch the ticket's file or folder, one does not. Returns the sandbox. */
function threeCommits(): string {
  const repo = branchRepo();
  writeFiles(repo, { 'accord/tickets/T-1.md': readTicket(repo) + '\n<!-- claim -->\n' });
  commitMsg(repo, 'claim: T-1', T1);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': readPlan(repo) + '\n<!-- plan -->\n' });
  commitMsg(repo, 'plan: T-1 ready', T2);
  writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n' });
  commitMsg(repo, 'chore: src', T3);
  return repo;
}

const readTicket = (repo: string): string => readFileSync(join(repo, 'accord', 'tickets', 'T-1.md'), 'utf8');
const readPlan = (repo: string): string => readFileSync(join(repo, 'accord', 'tickets', 'T-1', 'plan.md'), 'utf8');

type Entry = { at: number; kind: string; text: string; fail?: true };
const logOf = (out: string): Entry[] | undefined => (JSON.parse(out) as { log?: Entry[] }).log;

// Phase 08.7 D-02, D-04: the ticket's commits since the default branch, newest first, with their committer time.
it("risk:parsing show json lists the ticket's commits since the default branch newest first with their time (D-02 D-04)", async () => {
  const repo = threeCommits();
  try {
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect(logOf(out)).toEqual([
      { at: secs(T2), kind: 'commit', text: 'plan: T-1 ready' },
      { at: secs(T1), kind: 'commit', text: 'claim: T-1' },
    ]);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7 D-02, D-04: a report is listed by name and modification time; its text, and any file that is no report, never.
it("risk:parsing show json lists the ticket's executor and fix reports by name and time and never their text (D-02 D-04)", async () => {
  const repo = threeCommits();
  try {
    const dir = join(repo, '.accord-reports', 'T-1');
    mkdirSync(join(dir, 'task-3.md'), { recursive: true }); // a folder named like a report is no report
    writeFileSync(join(repo, '.accord-reports', '.gitignore'), '*\n');
    const mid = new Date(T1.getTime() + 1_800_000);
    const late = new Date(T3.getTime() + 600_000);
    for (const [name, when] of [['task-1.md', mid], ['fix-2.md', late]] as const) {
      writeFileSync(join(dir, name), 'SECRET-REPORT-TEXT\n');
      utimesSync(join(dir, name), when, when);
    }
    for (const name of ['brief-1.md', 'task-0.md', 'Task-4.md']) writeFileSync(join(dir, name), 'SECRET-REPORT-TEXT\n');
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect(logOf(out)).toEqual([
      { at: secs(late), kind: 'report', text: 'fix report 2' },
      { at: secs(T2), kind: 'commit', text: 'plan: T-1 ready' },
      { at: secs(mid), kind: 'report', text: 'executor report task 1' },
      { at: secs(T1), kind: 'commit', text: 'claim: T-1' },
    ]);
    expect(out).not.toContain('SECRET-REPORT-TEXT');
    expect(out).not.toContain('brief-1');
    expect(out).not.toContain('task-3');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7 D-02: a commit subject is repository text; control and bidi code points reach the JSON as spaces (T-08.7-01).
it('risk:security a commit subject cannot put control or bidi characters into the show json log (D-02)', async () => {
  const repo = branchRepo();
  try {
    writeFiles(repo, { 'accord/tickets/T-1.md': readTicket(repo) + '\n<!-- claim -->\n' });
    commitMsg(repo, 'claim: T-1 ‮evil\u0007bell', T2);
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect(logOf(out)?.[0]?.text).toBe('claim: T-1  evil bell');
    expect(out).not.toContain('‮');
    expect(out).not.toContain('\u0007');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7 D-02 (T-08.7-22): a report folder that is a link lists nothing through it.
it('risk:security a report folder that is a link lists no report through it (D-02)', async () => {
  const repo = threeCommits();
  const outside = mkdtempSync(join(tmpdir(), 'accord-outside-'));
  try {
    writeFileSync(join(outside, 'task-1.md'), 'SECRET-REPORT-TEXT\n');
    mkdirSync(join(repo, '.accord-reports'), { recursive: true });
    try {
      symlinkSync(outside, join(repo, '.accord-reports', 'T-1'), 'junction');
    } catch {
      return; // the host cannot make a link here: nothing to prove
    }
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect((logOf(out) ?? []).filter((e) => e.kind === 'report')).toEqual([]);
    expect(out).not.toContain('SECRET-REPORT-TEXT');
  } finally {
    cleanup(repo);
    cleanup(outside);
  }
}, 120_000);

// Phase 08.7 D-04: no `log` key when there is nothing to list, a cap of fifty, and the text output untouched (D-09).
it('risk:complex-branching show json has no log on the default branch or without a default ref and caps it at fifty (D-04)', async () => {
  const repo = branchRepo();
  const bare = makeLaneRepo();
  try {
    // on the default branch: HEAD is origin/main
    gitRun(repo, 'switch', '-q', '-');
    expect(logOf((await run(['show', 'T-1', '--json'], repo)).out)).toBeUndefined();
    gitRun(repo, 'switch', '-q', 't/T-1');
    // no origin ref, no report
    commitMsg(bare, 'chore: base', T1);
    const none = await run(['show', 'T-1', '--json'], bare);
    expect(none.code).toBe(0);
    expect('log' in (JSON.parse(none.out) as object)).toBe(false);
    // no origin ref, one report: it alone
    mkdirSync(join(bare, '.accord-reports', 'T-1'), { recursive: true });
    writeFileSync(join(bare, '.accord-reports', '.gitignore'), '*\n');
    writeFileSync(join(bare, '.accord-reports', 'T-1', 'task-1.md'), 'text\n');
    utimesSync(join(bare, '.accord-reports', 'T-1', 'task-1.md'), T2, T2);
    expect(logOf((await run(['show', 'T-1', '--json'], bare)).out)).toEqual([{ at: secs(T2), kind: 'report', text: 'executor report task 1' }]);
    // 55 commits on the branch: fifty entries, the newest first
    const base = readTicket(repo);
    for (let i = 1; i <= 55; i++) {
      writeFiles(repo, { 'accord/tickets/T-1.md': base + '\n<!-- ' + i + ' -->\n' });
      commitMsg(repo, 'claim: T-1 step ' + i, new Date(T1.getTime() + i * 60_000));
    }
    const log = logOf((await run(['show', 'T-1', '--json'], repo)).out);
    expect(log).toHaveLength(50);
    expect(log?.[0]).toEqual({ at: secs(new Date(T1.getTime() + 55 * 60_000)), kind: 'commit', text: 'claim: T-1 step 55' });
  } finally {
    cleanup(repo);
    cleanup(bare);
  }
}, 240_000);

// Phase 08.7 D-04, A-03: a ticket that passes `gate ready` and fails `gate done`, in a sandbox with no claim or default ref.
function gateRepo(): string {
  const files: Files = {};
  ready(files, 'T-1');
  return makeLaneRepo({ [P('T-1')]: files[P('T-1')], [discussPath('T-1')]: discussFor('T-1') });
}
const GATE_LINE = /^[0-9]+\t(ready|plan|done)\t(pass|fail)\t[^\t]*$/;
const gateLog = (repo: string): string[] => readFileSync(join(repo, '.accord-reports', 'T-1', 'gate.log'), 'utf8').split('\n').filter((l) => l !== '');

// Phase 08.7 D-04, A-03: each gate run appends one line to the git-ignored gate log, and show json lists it, a FAIL with its mark.
it('risk:regression a gate run appends one line to the git-ignored gate log and show json lists it with a fail mark (D-04)', async () => {
  const repo = gateRepo();
  try {
    const pass = await run(['gate', 'ready', 'T-1', '--json'], repo);
    expect(pass.code).toBe(0);
    expect(() => JSON.parse(pass.out)).not.toThrow();
    const fail = await run(['gate', 'done', 'T-1', '--json'], repo);
    expect(fail.code).toBe(1);
    const found = (JSON.parse(fail.out) as { findings: { rule: string; level: string }[] }).findings.find((f) => f.level === 'error');
    const lines = gateLog(repo);
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).toMatch(GATE_LINE);
    expect(lines[0].split('\t').slice(1)).toEqual(['ready', 'pass', '']);
    expect(lines[1].split('\t')[3].startsWith(found?.rule ?? 'no error finding')).toBe(true);
    expect(readFileSync(join(repo, '.accord-reports', '.gitignore'), 'utf8')).toBe('*\n');
    expect(gitRun(repo, 'status', '--porcelain')).not.toContain('.accord-reports');
    const log = logOf((await run(['show', 'T-1', '--json'], repo)).out) ?? [];
    const gates = log.filter((e) => e.kind === 'gate');
    expect(gates).toHaveLength(2);
    const failed = gates.find((e) => e.fail === true);
    expect(failed?.text.startsWith('gate done FAIL: ')).toBe(true);
    const passed = gates.find((e) => e.fail === undefined);
    expect(passed).toEqual({ at: passed?.at, kind: 'gate', text: 'gate ready PASS' });
    expect(passed && 'fail' in passed).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7 D-02, A-03 (T-08.7-02, T-08.7-03): a forged gate log changes no verdict; a link at the report folder is never written through.
it('risk:security a forged gate log changes no gate verdict and a link at the report folder is never written through (D-02)', async () => {
  const repo = gateRepo();
  const other = gateRepo();
  const outside = mkdtempSync(join(tmpdir(), 'accord-outside-'));
  try {
    const first = await run(['gate', 'done', 'T-1', '--json'], repo);
    expect(first.code).toBe(1);
    writeFileSync(join(repo, '.accord-reports', 'T-1', 'gate.log'), '1700000000\tdone\tpass\t\n1700000000\tdone\tpass\t\nnot a line\n1700000001\tdone\tmaybe\tx\n');
    const second = await run(['gate', 'done', 'T-1', '--json'], repo);
    expect([second.code, second.out]).toEqual([first.code, first.out]);
    const log = logOf((await run(['show', 'T-1', '--json'], repo)).out) ?? [];
    expect(log.filter((e) => e.at === 1700000001)).toEqual([]);
    expect(log.some((e) => e.text === 'gate done PASS')).toBe(true); // a forged line shows; it moves no verdict
    // a link at the report folder: nothing is written through it
    mkdirSync(join(other, '.accord-reports'), { recursive: true });
    try {
      symlinkSync(outside, join(other, '.accord-reports', 'T-1'), 'junction');
    } catch {
      return; // the host cannot make a link here: nothing more to prove
    }
    const linked = await run(['gate', 'done', 'T-1', '--json'], other);
    expect([linked.code, linked.out]).toEqual([first.code, first.out]);
    expect(readdirSync(outside)).toEqual([]);
    // this fixture has no default branch, so gate done also says its done-ticket freeze was not checked (A-WR-04); that line is not the one this case is about
    const lines = linked.err.split('\n').filter((l) => l !== '' && !l.startsWith('done-ticket freeze not checked: '));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('could not record the gate run in .accord-reports/')).toBe(true);
  } finally {
    cleanup(repo);
    cleanup(other);
    cleanup(outside);
  }
}, 180_000);

// Phase 08.7 D-04: an unknown ticket leaves no gate log; a clean second `gate ready` still prints an empty stderr.
it('risk:complex-branching a gate for an unknown ticket writes no gate log and a failed append keeps the verdict and exit code (D-04)', async () => {
  const repo = gateRepo();
  try {
    const unknown = await run(['gate', 'ready', 'NOSUCH'], repo);
    expect(unknown.code).toBe(1);
    expect(existsSync(join(repo, '.accord-reports'))).toBe(false);
    expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
    const again = await run(['gate', 'ready', 'T-1'], repo);
    expect(again.code).toBe(0);
    expect(again.err).toBe('');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 W1 (08.7 review WR-01): a clone with no `origin` remote reads its commits against the local main, so the log of a ticket on its branch lists them; on main itself it lists none.
it('risk:regression a clone without origin lists the branch commits of the ticket against the local main (W1)', async () => {
  const repo = makeLaneRepo();
  try {
    commitMsg(repo, 'chore: base', T1);
    gitRun(repo, 'branch', '-M', 'main');
    expect(gitRun(repo, 'remote').trim()).toBe('');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1.md': readTicket(repo) + '\n<!-- claim -->\n' });
    commitMsg(repo, 'claim: T-1', T1);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': readPlan(repo) + '\n<!-- plan -->\n' });
    commitMsg(repo, 'plan: T-1 ready', T2);
    writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n' });
    commitMsg(repo, 'chore: src', T3);
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect(logOf(out)).toEqual([
      { at: secs(T2), kind: 'commit', text: 'plan: T-1 ready' },
      { at: secs(T1), kind: 'commit', text: 'claim: T-1' },
    ]);
    gitRun(repo, 'switch', '-q', 'main');
    expect(logOf((await run(['show', 'T-1', '--json'], repo)).out)).toBeUndefined();
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 W2 (08.7 review WR-02): the log is display only, so a report folder or gate log the process cannot read leaves the log without those entries and the ticket is still shown. Needs a mode 000 folder: not on Windows, not as root.
it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('risk:regression an unreadable report folder and gate log leave the log without them and show json still exits 0 (W2)', async () => {
  const repo = threeCommits();
  const dir = join(repo, '.accord-reports', 'T-1');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(repo, '.accord-reports', '.gitignore'), '*\n');
    writeFileSync(join(dir, 'task-1.md'), 'text\n');
    writeFileSync(join(dir, 'gate.log'), '1700000000\tdone\tpass\t\n');
    chmodSync(dir, 0o000);
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect((JSON.parse(out) as { id: string }).id).toBe('T-1');
    expect(logOf(out)).toEqual([
      { at: secs(T2), kind: 'commit', text: 'plan: T-1 ready' },
      { at: secs(T1), kind: 'commit', text: 'claim: T-1' },
    ]);
  } finally {
    chmodSync(dir, 0o755);
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 IN-04 (08.7 review): nothing in CI reads the display-only gate log, so a gate run with CI set writes none; the verdict and the exit code stay.
it('risk:regression a gate run with CI set writes no gate log (IN-04)', async () => {
  const repo = gateRepo();
  const file = join(repo, '.accord-reports', 'T-1', 'gate.log');
  try {
    const ci = await run(['gate', 'ready', 'T-1'], repo, { CI: 'true' });
    expect(ci.code).toBe(0);
    expect(ci.err).toBe('');
    expect(existsSync(file)).toBe(false);
    // a person's own CI=false (or 0, or empty) is no CI: the line is written
    for (const value of ['false', '0', '']) {
      rmSync(join(repo, '.accord-reports'), { recursive: true, force: true });
      expect((await run(['gate', 'ready', 'T-1'], repo, { CI: value })).code).toBe(0);
      expect(existsSync(file)).toBe(true);
    }
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 audit of Phase 08.7 (T-08.7-05, D-04): a gate log of any size costs `show` one bounded read: only its last 64 KiB are read, and the reason a failing run is recorded with is cut to 200 code points
// with control code points turned into spaces. Read straight from the loader: a sandbox repository adds nothing to what these two bounds prove.
it('risk:resource the gate log is read from its last 64 KiB only and a recorded reason is cut to 200 code points (D-04)', () => {
  const root = mkdtempSync(join(tmpdir(), 'accord-gatelog-'));
  try {
    const folder = join(root, '.accord-reports', 'T-1');
    mkdirSync(folder, { recursive: true });
    const oldRun = '1700000000\tdone\tfail\told run\n';
    const junk = ('x'.repeat(99) + '\n').repeat(700); // 70000 bytes that are no gate line
    writeFileSync(join(folder, 'gate.log'), oldRun + junk);
    expect(readGateRuns(root, 'T-1')).toEqual([]); // the run lies before the last 64 KiB: it is never read
    writeFileSync(join(folder, 'gate.log'), junk + oldRun);
    expect(readGateRuns(root, 'T-1')).toEqual([{ at: 1700000000, kind: 'gate', text: 'gate done FAIL: old run', fail: true }]);
    const long = 'é'.repeat(300) + '\u0007\n\t'.repeat(3);
    appendGateRun(root, 'T-2', { gate: 'done', ticket: 'T-2', verdict: 'fail', findings: [{ file: 'accord/tickets/T-2.md', rule: 'lint.x', reason: long, level: 'error' }] }, 1700000002);
    const line = readFileSync(join(root, '.accord-reports', 'T-2', 'gate.log'), 'utf8');
    expect(line.endsWith('\n')).toBe(true);
    expect(line.split('\n')).toHaveLength(2); // one line: the line breaks of the reason became spaces
    const reason = line.trimEnd().split('\t')[3];
    expect([...reason]).toHaveLength(200);
    expect(reason).not.toMatch(/\p{Cc}/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
