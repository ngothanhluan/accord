// Phase 08.7 D-02, D-04, A-03: `accord show <id> --json` carries the ticket's session log `log`: its commits since the default branch, its executor and fix reports by name and time
// (never their text), and each `accord gate` run from the git-ignored gate log. The CLI is the one source; no gate reads the record; the text output stays as it was (D-09).
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

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
