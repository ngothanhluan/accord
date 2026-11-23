// ST-LN-36 36-ac-2: `accord gate done` holds each recorded review round against the security triggers its own package had, on real git. The CLI here runs as the
// cut-off release (0.7.0), so a repository pinned to 0.7.0 can be claimed under 0.7.0 and under 0.6.0 (the older answer).
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadSnapshot, parseSecurityFile, pluginTargets } from '@accord-dev/accord-core';
import type { RepoSnapshot, SkillFile } from '@accord-dev/accord-core';
import pkg from '../package.json' with { type: 'json' };
import { renderedFiles } from '../src/commands/branch-fact.js';
import { securitySections } from '../src/commands/review-package.js';
import { withClaimPins } from '../src/load/claim-facts.js';
import { loadFromFs } from '../src/load/fs.js';
import { exemptCopies, withSecurityFacts } from '../src/load/security-facts.js';
import { countedSync } from './helpers/git-spawns.js';
import { counted } from './helpers/runs.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.7.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const RULE = 'gate.security-unreviewed';
const RUN_BASE = 'export const one = 1;\nexport const two = 2;\nexport const three = 3;\n';
const RUN_NEW = "export const one = 1;\nexport const two = 2;\nspawnSync('git', ['status']);\nexport const three = 3;\n";
const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', ...lines].join('\n')}\n`;

interface Found { rule: string; level: string; file?: string; line?: number; reason: string }
async function security(repo: string): Promise<Found[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE);
}

/** A ticket claimed under `claim` on its own branch: base, the claim commit, one code commit (`code`), then review.md headed by that code commit. */
function claimed(o: { lane?: 'M' | 'S'; claim?: string; base?: Record<string, string>; code: Record<string, string>; review: (head: string) => string }): { repo: string; head: string } {
  const lane = o.lane ?? 'M';
  const repo = makeEmptyRepo();
  writeFiles(repo, {
    'accord/config.yml': pinned(o.claim ?? '0.7.0'),
    'accord/tickets/T-1.md': lane === 'S' ? laneTicket('T-1', { lane: 'S', body: LANE_S_BODY }) : laneTicket('T-1'),
    'src/run.ts': RUN_BASE,
    'src/plain.ts': 'export const a = 0;\n',
    ...o.base,
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/config.yml': pinned('0.7.0'), ...(lane === 'M' ? { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) } : {}), ...o.code });
  const head = commitMsg(repo, 'code');
  writeFiles(repo, { [REVIEW]: o.review(head) });
  commitMsg(repo, 'round 1');
  return { repo, head };
}

it('risk:security gate done refuses a lane M round whose package matched a pattern and records no security review, on real git (ST-LN-36 36-ac-2)', async () => {
  const spawned = claimed({ code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const refused = await security(spawned.repo);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ level: 'error', file: REVIEW });
    expect(refused[0].reason).toContain('round 1');
    expect(refused[0].reason).toContain('src/run.ts:3: spawn');
    // the round records the lens, and the refusal is gone
    writeFiles(spawned.repo, { [REVIEW]: record(spawned.head, 'Security: lens security ran') });
    commitMsg(spawned.repo, 'security review');
    expect(await security(spawned.repo)).toEqual([]);
  } finally {
    cleanup(spawned.repo);
  }

  // a round whose package matched nothing needs the trace line
  const plain = claimed({ code: { 'src/plain.ts': 'export const a = 1;\n' }, review: (h) => record(h) });
  try {
    const refused = await security(plain.repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain('records no Security: line');
    expect(refused[0].reason).toContain('Security: no pattern matched');
    expect(refused[0].reason).not.toContain('spawn');
    writeFiles(plain.repo, { [REVIEW]: record(plain.head, 'Security: no pattern matched') });
    commitMsg(plain.repo, 'security trace');
    expect(await security(plain.repo)).toEqual([]);
  } finally {
    cleanup(plain.repo);
  }
}, 180_000);

it('risk:security gate done refuses an unreviewed security trigger in lane S and keeps the older answer for a ticket claimed at 0.6.0, on real git (ST-LN-36 36-ac-2)', async () => {
  const s = claimed({ lane: 'S', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const refused = await security(s.repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain('src/run.ts:3: spawn');
    // two runs on the same commit print the same bytes
    const first = await run(['gate', 'done', 'T-1', '--json'], s.repo);
    const second = await run(['gate', 'done', 'T-1', '--json'], s.repo);
    expect(second.out).toBe(first.out);
    expect(first.out).toContain(RULE);
  } finally {
    cleanup(s.repo);
  }

  const old = claimed({ claim: '0.6.0', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    expect(await security(old.repo)).toEqual([]);
  } finally {
    cleanup(old.repo);
  }
}, 180_000);

it('risk:security gate done asks the re-review round after a final review whose fix matched a pattern, and never the final review, on real git (ST-LN-36 36-ac-2)', async () => {
  const final = '## Round 2 head %1 (final review)\n\nMust 1 [patch]: the runner takes a shell — src/run.ts:3 — open\n\n';
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': pinned('0.7.0'),
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'src/run.ts': RUN_BASE,
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitMsg(repo, 'claim: T-1', undefined, true);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), 'src/run.ts': RUN_NEW });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { 'src/fix.ts': "spawnSync('git', ['status']);\n" });
    const c2 = commitMsg(repo, 'fix');
    const text = (third: string): string =>
      `Round record: 2\n\n## Round 1 head ${c1}\n\nNo findings\nSecurity: lens security ran\n\n${final.replace('%1', c1)}## Round 3 head ${c2}\n\nNo findings\n${third}\n`;
    writeFiles(repo, { [REVIEW]: text('Security: no pattern matched') });
    commitMsg(repo, 'rounds');
    const refused = await security(repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain('round 3 of cycle 1');
    expect(refused[0].reason).toContain('src/fix.ts');
    expect(refused.some((f) => f.reason.includes('round 2'))).toBe(false);
    writeFiles(repo, { [REVIEW]: text('Security: lens security ran') });
    commitMsg(repo, 'security review');
    expect(await security(repo)).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 180_000);

// Phase 08.8 D-03: with the review stage off, the security review is still asked for and the ticket's ledger records it as `Security: lens security ran at <sha>`. The claim pins the cut-off
// release (0.16.0, SECURITY_OFF_FROM after Task 2) so the ticket is judged; the CLI here runs as 0.7.0, so the working-tree pin is 0.7.0.
const LEDGER = 'accord/tickets/T-1/ledger.md';
const REVIEW_OFF = 'strictness:\n  stages:\n    M:\n      review: "off"\n';

it('risk:security with review off gate done asks for the security review the ledger records (D-03)', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned('0.16.0') + REVIEW_OFF, 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/run.ts': RUN_BASE });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitMsg(repo, 'claim: T-1', undefined, true);
    writeFiles(repo, { 'accord/config.yml': pinned('0.7.0') + REVIEW_OFF, 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), 'src/run.ts': RUN_NEW });
    const code = commitMsg(repo, 'code');
    writeFiles(repo, { [LEDGER]: `- task 1 done ${code}\n- task 2 done ${code}\n` });
    const built = commitMsg(repo, 'tasks done');

    const refused = await security(repo);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ level: 'error', file: LEDGER });
    expect(refused[0].reason).toContain('src/run.ts:3: spawn');
    expect(refused[0].reason).toContain('accord review-package T-1 --security');
    expect(refused[0].reason).toContain('Security: lens security ran at <sha>');

    // the ledger records the review at the commit that was reviewed, and the refusal is gone
    writeFiles(repo, { [LEDGER]: `- task 1 done ${code}\n- task 2 done ${code}\n\n## Security\n\nSecurity: lens security ran at ${built}\n` });
    commitMsg(repo, 'security review');
    expect(await security(repo)).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 180_000);

const packageRead = (a: string[]): boolean => a.includes('-U10') || a.some((x) => x.includes('...'));

it('risk:complex-branching gate done starts no security-fact git read for a ticket claimed before 0.7.0 and reads them when the rule applies, a failed claim read included (ST-LN-36 36-ac-2)', async () => {
  const old = claimed({ claim: '0.6.0', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const before = await counted(['gate', 'done', 'T-1', '--json'], old.repo);
    expect(before.argv.filter(packageRead)).toEqual([]);
    expect((JSON.parse(before.out).findings as Found[]).filter((f) => f.rule === RULE)).toEqual([]);

    // in process: the loader returns the snapshot itself and starts no git process for a claim before the cut-off
    const s: RepoSnapshot = withClaimPins(old.repo, loadSnapshot(loadFromFs(old.repo)), 'T-1');
    const none = countedSync(() => withSecurityFacts(old.repo, s, 'T-1', () => []));
    expect(none.value).toBe(s);
    expect(none.value.securityFacts).toBeUndefined();
    expect(none.argv).toEqual([]);

    // a failed claim read is false in claimPinBefore, so the facts are read and the rule applies
    const failedClaim: RepoSnapshot = { ...s, claimPins: { 'T-1': { error: 'git failed' } } };
    const read = countedSync(() => withSecurityFacts(old.repo, failedClaim, 'T-1', () => []));
    expect(read.value.securityFacts?.['T-1']).toBeDefined();
    expect(read.argv.filter(packageRead).length).toBeGreaterThanOrEqual(1);
  } finally {
    cleanup(old.repo);
  }

  const fresh = claimed({ code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const run1 = await counted(['gate', 'done', 'T-1', '--json'], fresh.repo);
    expect(run1.argv.filter(packageRead).length).toBeGreaterThanOrEqual(1);
    expect((JSON.parse(run1.out).findings as Found[]).filter((f) => f.rule === RULE)).toHaveLength(1);
  } finally {
    cleanup(fresh.repo);
  }
}, 180_000);

it('ac-1 gate done scans a hand-edited accord panel copy on real git (BUG-LN-25)', async () => {
  const REGISTER = '.claude/accord-panel/plugin/hooks/register.js';
  const added = "spawnSync('git', ['status']);";
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned('0.7.0'), 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/plain.ts': 'export const a = 0;\n' });
    const synced = await run(['skills', 'sync'], repo);
    expect(synced.code).toBe(0);
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitMsg(repo, 'claim: T-1', undefined, true);
    const copy = readFileSync(join(repo, REGISTER), 'utf8');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), [REGISTER]: `${copy.replace(/\n$/, '')}\n${added}\n` });
    const head = commitMsg(repo, 'code');
    const line = readFileSync(join(repo, REGISTER), 'utf8').split('\n').indexOf(added) + 1;
    writeFiles(repo, { [REVIEW]: record(head) });
    commitMsg(repo, 'round 1');
    const refused = await security(repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain(`${REGISTER}:${line}: spawn`);
  } finally {
    cleanup(repo);
  }
}, 180_000);

const TEAM_SECURITY = [
  '# Security review',
  '',
  '## Patterns',
  '',
  '- panel-spec: line /accord@[0-9]/ — the package spec the panel runs',
  '',
  '## Checklist',
  '',
  '## Removed',
  '',
].join('\n');
const NONE = '(none: no pattern matched)';
const section = (text: string, title: string, next: string): string => text.slice(text.indexOf(`## ${title}\n\n`) + title.length + 5, text.indexOf(`\n\n## ${next}`));

it('ac-3 copies freshly written by skills sync raise no trigger on real git (BUG-LN-25)', async () => {
  const REGISTER = '.claude/accord-panel/plugin/hooks/register.js';
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned('0.7.0'), 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/product/security.md': TEAM_SECURITY, 'src/plain.ts': 'export const a = 0;\n' });
    expect((await run(['skills', 'sync'], repo)).code).toBe(0);
    // the base holds the panel as the previous release wrote it
    const older = pluginTargets({ runtimes: ['claude'] }, { name: pkg.name, version: '0.6.0' });
    writeFiles(repo, Object.fromEntries(older.map((f) => [f.path, f.text])));
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitMsg(repo, 'claim: T-1', undefined, true);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) });
    commitMsg(repo, 'plan');
    expect((await run(['skills', 'sync'], repo)).code).toBe(0);
    const head = commitMsg(repo, 'sync');
    writeFiles(repo, { [REVIEW]: record(head, 'Security: no pattern matched') });
    commitMsg(repo, 'round 1');
    // the round changed nothing but copies sync wrote, so settings.json is untouched and agent-config cannot fire
    const changed = gitRun(repo, 'diff', '--name-only', base, head).split('\n').filter((l) => l !== '');
    expect(changed).toContain(REGISTER);
    expect(changed.filter((p) => !/^(\.claude\/(skills|agents|accord-panel)\/|\.agents\/skills\/|accord\/tickets\/T-1\/)/.test(p))).toEqual([]);

    expect(((JSON.parse((await run(['gate', 'done', 'T-1', '--json'], repo)).out).findings as Found[]).filter((f) => f.rule === RULE))).toEqual([]);

    const s: RepoSnapshot = withClaimPins(repo, loadSnapshot(loadFromFs(repo)), 'T-1');
    const config = s.config;
    if (config === undefined) throw new Error('the fixture has no config');
    expect(withSecurityFacts(repo, s, 'T-1', () => renderedFiles(config)).securityFacts?.['T-1']).toEqual({ rounds: [{ head, triggers: [] }] });
    // the fixture is not vacuous: with nothing exempt the rewritten copy matches the team pattern
    const open = withSecurityFacts(repo, s, 'T-1', () => []).securityFacts?.['T-1'];
    const shown = open !== undefined && 'rounds' in open ? open.rounds[0].triggers.join('\n') : JSON.stringify(open);
    expect(shown).toContain(`${REGISTER}:`);
    expect(shown).toContain('panel-spec');

    // the two packages a reviewer reads agree with the gate (D-08)
    const byRound = (await run(['review-package', 'T-1', '--security', '--round', '1'], repo)).out;
    expect(section(byRound, 'Security triggers', 'Matched hunks')).toBe(NONE);
    const byDiff = (await run(['diff-package', base, head, '--security'], repo)).out;
    expect(section(byDiff, 'Security triggers', 'Matched hunks')).toBe(NONE);
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:security only a copy whose head text equals the render is exempt and a failed copy read fails closed (BUG-LN-25)', async () => {
  const text = (n: number): string => `// copy ${n}\nexport const v = ${n};\n`;
  const rendered: SkillFile[] = [1, 2, 3].map((n) => ({ path: `.claude/x/c${n}.js`, text: text(n) }));
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'core.autocrlf', 'false'); // the CRLF blob stays CRLF on every host
    writeFiles(repo, { ...Object.fromEntries(rendered.map((f) => [f.path, f.text])), 'src/a.js': 'export const a = 0;\n' });
    commitMsg(repo, 'base');
    writeFiles(repo, { '.claude/x/c1.js': text(1).replaceAll('\n', '\r\n'), '.claude/x/c2.js': text(2) + '// by hand\n', 'src/a.js': 'export const a = 1;\n' });
    gitRun(repo, 'rm', '-q', '.claude/x/c3.js');
    const head = commitMsg(repo, 'change');
    const changed = ['.claude/x/c1.js', '.claude/x/c2.js', '.claude/x/c3.js', 'src/a.js'];
    expect(exemptCopies(repo, head, changed, () => rendered)).toEqual(['.claude/x/c1.js']);

    // no changed path under .claude/ or .agents/: no getter call, no git process
    let calls = 0;
    const none = countedSync(() => exemptCopies(repo, head, ['src/a.js', 'README.md'], () => ((calls += 1), rendered)));
    expect(none.value).toEqual([]);
    expect(calls).toBe(0);
    expect(none.argv).toEqual([]);

    // a read that fails (the folder is no repository) is said in all three sections, never an empty exempt list
    writeFiles(repo, { 'accord/config.yml': pinned('0.7.0') });
    const s = loadSnapshot(loadFromFs(repo));
    const elsewhere = mkdtempSync(join(tmpdir(), 'accord-cli-nogit-'));
    try {
      const sec = securitySections(s, '', ['.claude/accord-panel/plugin/hooks/register.js'], true, { root: elsewhere, head: 'HEAD' });
      for (const part of [sec.triggers, sec.checklist, sec.hunks]) expect(part.startsWith('(cannot tell:')).toBe(true);
    } finally {
      cleanup(elsewhere);
    }
  } finally {
    cleanup(repo);
  }

  // a getter that throws is an error fact, so the gate refuses
  const spawned = claimed({ code: { '.claude/x.txt': 'one\n' }, review: (h) => record(h) });
  try {
    const s: RepoSnapshot = withClaimPins(spawned.repo, loadSnapshot(loadFromFs(spawned.repo)), 'T-1');
    const facts = withSecurityFacts(spawned.repo, s, 'T-1', () => {
      throw new Error('cannot render the copies');
    }).securityFacts?.['T-1'];
    expect(facts).toEqual({ error: 'cannot render the copies' });
  } finally {
    cleanup(spawned.repo);
  }
}, 180_000);

// 8-ac-5 (D-10) and 8-ac-3 (D-07): a team pattern the guard refuses, or that does not compile, is not in force; `accord gate done` says so instead of passing silently.
const SECURITY_FILE = 'accord/product/security.md';
const teamFile = (pattern: string): string => `# Security review\n\n## Patterns\n\n- team: line ${pattern} — a team pattern\n`;

it('risk:security accord gate done refuses a ticket while the security file holds a backtracking or uncompilable pattern (8-ac-5)', async () => {
  for (const [pattern, why] of [['/(a+)+$/', 'very slow'], ['/(/', 'does not compile']]) {
    // the read refuses the pattern first, so a guard regression fails here before any slow scan can run
    expect(parseSecurityFile(teamFile(pattern)).problems.map((p) => p.line), pattern).toEqual([5]);
    const spawned = claimed({ base: { [SECURITY_FILE]: teamFile(pattern) }, code: { 'src/plain.ts': 'export const a = 1;\n' }, review: (h) => record(h, 'Security: no pattern matched') });
    try {
      const refused = await run(['gate', 'done', 'T-1', '--json'], spawned.repo);
      expect(refused.code, pattern).toBe(1);
      const found = (JSON.parse(refused.out).findings as Found[]).filter((f) => f.rule === RULE);
      expect(found, pattern).toHaveLength(1);
      expect(found[0], pattern).toMatchObject({ level: 'error', file: REVIEW });
      expect(found[0].reason, pattern).toContain(`${SECURITY_FILE}:5: `);
      expect(found[0].reason, pattern).toContain(why);
      expect(found[0].reason, pattern).toContain('accord lint');
      // the fix: a line that reads takes the finding away
      writeFiles(spawned.repo, { [SECURITY_FILE]: teamFile(String.raw`/foo/`) });
      commitMsg(spawned.repo, 'fix the pattern');
      expect(await security(spawned.repo), pattern).toEqual([]);
    } finally {
      cleanup(spawned.repo);
    }
  }
}, 180_000);

// 8-ac-3 (D-09): a hostile line of 40 `a` then `!` and a line of 100,000 characters end a gate done promptly. The two team patterns below back-track on such a line, so the read
// refuses both and the gate names them; the line over 1000 characters is cut and says so.
const SLOW_FILE = ['# Security review', '', '## Patterns', '', '- slow: line /(a+)+$/ — x', '- overlap: line /(a|a)*$/ — y', ''].join('\n');
const HOSTILE = `${'a'.repeat(40)}!\n${'a'.repeat(100_000)}!\n`;

it('risk:resource accord gate done ends promptly on 40 a then ! and on a 100,000-character line (8-ac-3)', async () => {
  // the read refuses both patterns first, so a guard regression fails here before any slow scan can run
  expect(parseSecurityFile(SLOW_FILE).problems.map((p) => p.line)).toEqual([5, 6]);
  const spawned = claimed({ base: { [SECURITY_FILE]: SLOW_FILE }, code: { 'src/hostile.ts': HOSTILE }, review: (h) => record(h, 'Security: no pattern matched') });
  try {
    const started = performance.now();
    const refused = await run(['gate', 'done', 'T-1', '--json'], spawned.repo);
    expect(performance.now() - started).toBeLessThan(120_000);
    expect(refused.code).toBe(1);
    const reasons = (JSON.parse(refused.out).findings as Found[]).filter((f) => f.rule === RULE).map((f) => f.reason);
    expect(reasons.some((r) => r.includes(`${SECURITY_FILE}:5: `) && r.includes('"slow"'))).toBe(true);
    expect(reasons.some((r) => r.includes(`${SECURITY_FILE}:6: `) && r.includes('"overlap"'))).toBe(true);
  } finally {
    cleanup(spawned.repo);
  }
}, 180_000);
