// ST-LN-31 task 2: the lane S stage, status row and anchor read the ready record, the review record and the commits after it.
import { expect, it } from 'vitest';
import { loadSnapshot } from '../src/load/snapshot.js';
import { laneSHash } from '../src/gate/hash.js';
import { nextRows, statusRows } from '../src/status/rows.js';
import { isDone } from '../src/status/stage.js';
import { anchorText } from '../src/status/anchor.js';
import { lintSnapshot } from '../src/lint/index.js';
import { agentTargets, skillTargets } from '../src/index.js';
import { gateDone, gateReady } from '../src/gate/index.js';
import { CONFIG, LANE_BODY, LANE_S_BODY, PLAN, REPORT, junit, laneTicket } from '../../../test/helpers/lane.js';

const S = (body = LANE_S_BODY, fm: string[] = []) => laneTicket('S-1', { lane: 'S', body, frontmatter: fm });
const snap = (files: Record<string, string>, extra = {}) => loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [], ...extra });
const row = (s: ReturnType<typeof snap>) => statusRows(s).find((r) => r.id === 'S-1');
const H = laneSHash(snap({ 'accord/tickets/S-1.md': S() }).tickets['S-1']);
const R = 'accord/tickets/S-1/review.md';
const ready = { 'accord/tickets/S-1.md': S(LANE_S_BODY, ['ac_hash: "' + H + '"']) };
const conv = { ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: converged\n' };
const commit = (files: string[]) => ({ afterVerify: { 'S-1': [{ sha: 'a'.repeat(40), parents: ['b'.repeat(40)], files }] } });

it('risk:complex-branching the lane S stage and anchor follow the ready record the review record and the commits after it', () => {
  expect(row(snap({ 'accord/tickets/S-1.md': S() }))).toMatchObject({
    lane: 'S',
    stage: 'intent',
    ready: 'none',
    next: 'write ## Understood and ## Done when, then pass accord gate ready (lane-s.md)',
  });
  const r = row(snap(ready));
  expect(r).toMatchObject({ stage: 'build', ready: 'ok', tasksDone: 0, tasksTotal: 0 });
  expect(r?.next).toBeUndefined();
  expect(nextRows(statusRows(snap(ready))).map((x) => x.id)).toContain('S-1');

  expect(row(snap({ ...ready, [R]: '## Round 1\n\nMust 1: x — src/a.ts:1\n' }))).toMatchObject({
    stage: 'review',
    next: 'the next review round, numbered after the last ## Round in review.md (lane-s.md)',
  });
  const d = row(snap(conv));
  expect(d?.stage).toBe('done');
  expect(d?.next).toBeUndefined();
  expect(isDone(snap(conv), 'S-1')).toBe(true);
  expect(row(snap({ ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: accepted-by-owner "ship it"\n' }))?.stage).toBe('done');
  expect(row(snap({ ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: converged\nx\n' }))?.stage).toBe('review');
  expect(row(snap({ ...ready, [R]: '## Round 1\n\nMust 1: x\n\nverdict: open\n' }))?.stage).toBe('review');
  expect(row(snap(conv, commit(['src/a.ts'])))?.stage).toBe('review');
  expect(row(snap(conv, commit(['accord/tickets/S-1/ledger.md'])))?.stage).toBe('done');

  const edited = { ...conv, 'accord/tickets/S-1.md': S(LANE_S_BODY.replace('csv', 'tsv'), ['ac_hash: "' + H + '"']) };
  expect(row(snap(edited))).toMatchObject({ stage: 'intent', ready: 'stale' });

  const a = anchorText(snap(ready), 'S-1')!.split('\n');
  const want = ['Lane: S', 'Stage: build, next: the change and the tests.affected command (lane-s.md)', '## Understood', 'The export button writes a csv file.', '## Done when', 'Pressing export saves report.csv.', '## Rulings'];
  let at = -1;
  for (const w of want) {
    const i = a.indexOf(w, at + 1);
    expect(i, w).toBeGreaterThan(at);
    at = i;
  }
  expect(a).not.toContain('## Intent');
  expect(a).not.toContain('## Corrections');

  const withCorr = { 'accord/tickets/S-1.md': S(LANE_S_BODY + '\n## Corrections\n- "no, the tsv one"\n', ['ac_hash: "' + H + '"']) };
  const b = anchorText(snap(withCorr), 'S-1')!.split('\n');
  const i = b.indexOf('Pressing export saves report.csv.');
  expect(b.slice(i + 1).filter((l) => l !== '').slice(0, 3)).toEqual(['## Corrections', '- "no, the tsv one"', '## Rulings']);

  expect(anchorText(snap({ 'accord/tickets/T-1.md': laneTicket('T-1') }), 'T-1')!.split('\n').some((l) => l.startsWith('Lane:'))).toBe(false);
});

const rules = (s: ReturnType<typeof snap>) => lintSnapshot(s).findings.map((f) => [f.rule, f.file, f.level]);

it('risk:complex-branching a lane M ticket holding a review left from lane S and no plan is a lint error', () => {
  const rv = 'accord/tickets/T-1/review.md';
  const base = { 'accord/tickets/T-1.md': laneTicket('T-1'), [rv]: 'verdict: converged\n' };
  expect(rules(snap(base))).toContainEqual(['lint.review-without-plan', rv, 'error']);
  const withPlan = { ...base, 'accord/tickets/T-1/plan.md': PLAN };
  expect(rules(snap(withPlan)).some((r) => r[0] === 'lint.review-without-plan')).toBe(false);
  const other = {
    'accord/tickets/S-1.md': S(),
    'accord/tickets/S-1/review.md': 'verdict: converged\n',
    'accord/tickets/L-1.md': laneTicket('L-1', { lane: 'L' }),
    'accord/tickets/L-1/plan.md': PLAN,
    'accord/tickets/L-1/review.md': 'verdict: converged\n',
  };
  expect(rules(snap(other)).some((r) => r[0] === 'lint.review-without-plan')).toBe(false);
});

it('risk:security a lane S ticket holding an approval scenarios or a plan fails lint and both gates', () => {
  const A = 'approved_hash: "fnv1a64:0123456789abcdef"';
  const find = (s: ReturnType<typeof snap>) => lintSnapshot(s).findings.find((f) => f.rule === 'lint.lane-s-lane-m-records');
  const s1 = snap({ 'accord/tickets/S-1.md': S(LANE_S_BODY, [A]) });
  expect(rules(s1)).toContainEqual(['lint.lane-s-lane-m-records', 'accord/tickets/S-1.md', 'error']);
  expect(find(s1)?.reason).toContain('approved_hash');
  for (const g of [gateReady(s1, 'S-1'), gateDone(s1, 'S-1')]) {
    expect(g.verdict).toBe('fail');
    expect(g.findings.some((f) => f.rule === 'lint.lane-s-lane-m-records')).toBe(true);
  }
  expect(find(snap({ 'accord/tickets/S-1.md': S(LANE_S_BODY + '\n' + LANE_BODY) }))?.reason).toContain('@ac-n scenarios');
  expect(find(snap({ 'accord/tickets/S-1.md': S(), 'accord/tickets/S-1/plan.md': PLAN }))?.reason).toContain('plan.md');
  expect(find(snap({ 'accord/tickets/S-1.md': S() }))).toBeUndefined();
  expect(find(snap({ 'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: [A] }) }))).toBeUndefined();
});

it('risk:complex-branching a lane S ticket alone does not turn on the test policy', () => {
  const files = { 'accord/tickets/S-1.md': S(), [REPORT]: junit({ 'a#untraced': 'passed' }) };
  const n = (s: ReturnType<typeof snap>) => lintSnapshot(s).findings.filter((f) => f.rule === 'lint.test-untraced').length;
  expect(n(snap(files))).toBe(0);
  expect(n(snap({ ...files, 'accord/tickets/T-1.md': laneTicket('T-1') }))).toBe(1);
});

it('ac-5 a queued lane M ticket drops to lane S only at intent on the owners yes', () => {
  const cfg = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] } as never;
  const targets = skillTargets(cfg);
  const flat = (p: string) => (targets.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
  const intent = flat('.claude/skills/accord-intent/SKILL.md');
  const rule = intent.slice(intent.indexOf('**Lane S.**'));
  expect(rule.length).toBeGreaterThan(0);
  expect(intent.indexOf('**Lane S.**')).toBeGreaterThan(intent.indexOf('## Rules'));
  for (const x of ['fits lane S', '`accord status --json`', '`depends_on`', '`git status --porcelain --untracked-files=all`', 'propose dropping it to lane S', "only on the owner's yes", '`## Moving to lane S` in `./ids.md`', 'From step 9 on, a lane never drops'])
    expect(rule, x).toContain(x);
  const ids = flat('.claude/skills/accord-intent/ids.md');
  expect(ids.length).toBeGreaterThan(0);
  expect(ids).toBe(flat('.claude/skills/accord/ids.md'));
  const move = ids.slice(ids.indexOf('## Moving to lane S'));
  for (const x of ['`git status --porcelain --untracked-files=all`', 'do not drop', 'commit only those records', '`git add -A`', '`accord drop <id> --reason "moved to lane S"`', 'step 1 of', '(lane S, moved from <id>)', 'Title: <its title> Keys: <its depends_on, tracker, priority, ui and design lines', '`accord new ticket --lane S --worktree`', 'a new id'])
    expect(move, x).toContain(x);
  expect(move).not.toContain('commit every change');
  const accord = flat('.claude/skills/accord/SKILL.md');
  expect(accord).toContain('lane S without asking again');
  expect(accord).toContain('--lane S --worktree');
  const plan = flat('.claude/skills/accord-plan/SKILL.md');
  expect(plan).toContain('Run `git rev-parse HEAD` (lifted from lane S: the fork point in its ledger Ruling)');
  expect(plan).toContain('`baseline: <that commit>`');
  const planner = (agentTargets(cfg).find((f) => f.path === '.claude/agents/accord-planner.md')?.text ?? '').replace(/\s+/g, ' ');
  expect(planner).toContain('or, for a ticket lifted from lane S, the fork point its ledger Ruling names');

  const T = (fm: string[], reason: string) => laneTicket('M-1', { frontmatter: ['status: dropped', ...fm], body: LANE_BODY + '\n## Dropped\n' + reason + '\n' });
  const A = 'approved_hash: "fnv1a64:0123456789abcdef"';
  const lint = (t: string) => lintSnapshot(snap({ 'accord/tickets/M-1.md': t })).findings;
  expect(lint(T([A], 'moved to lane S'))).toContainEqual(expect.objectContaining({ rule: 'lint.dropped-approved', file: 'accord/tickets/M-1.md', level: 'error' }));
  expect(lint(T([], 'moved to lane S')).map((f) => f.rule)).not.toContain('lint.dropped-approved');
  expect(lint(T([A], 'no longer needed')).map((f) => f.rule)).not.toContain('lint.dropped-approved');
});
