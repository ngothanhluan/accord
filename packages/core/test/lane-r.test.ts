// ST-LN-94 94-ac-1, D-10, D-13: a lane R ticket holds a question, a timebox and a token budget, and gate ready passes it with no
// approval, Approach, discuss record or scenario. The config pins DISCUSS_FROM, so the discuss rules would apply to a lane M ticket here.
import { expect, it } from 'vitest';
import { DISCUSS_FROM, gateDone, gatePlan, gateReady, lintSnapshot, laneRHash, loadSnapshot, readTimebox, readTokenBudget, setFrontmatterKey } from '../src/index.js';
import { DONE_R_RULES, DONE_RULES } from '../src/gate/rules.js';
import type { BranchChange, BranchFact, GateResult } from '../src/index.js';
import { CONFIG, PLAN, REPORT, junit, laneTicket } from '../../../test/helpers/lane.js';

const QUOTE = '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "four hours and 800k is enough"';
const body = (o: { question?: string; timebox?: string; budget?: string; decisions?: string } = {}) =>
  [
    ...(o.question === undefined ? ['## Question', 'Does the critic need a second round?', ''] : o.question === '-' ? [] : ['## Question', o.question, '']),
    ...(o.timebox === undefined ? ['## Timebox', '4 hours', ''] : o.timebox === '-' ? [] : ['## Timebox', o.timebox, '']),
    ...(o.budget === undefined ? ['## Token budget', '800k weighted tokens', ''] : o.budget === '-' ? [] : ['## Token budget', o.budget, '']),
    '## Decisions',
    ...(o.decisions === undefined ? [QUOTE] : o.decisions === '' ? [] : [o.decisions]),
    '',
  ].join('\n');
const config = CONFIG.replace('accord: "0.4.0"', `accord: "${DISCUSS_FROM}"`);
const snap = (b: string) => {
  const files = { 'accord/config.yml': config, 'accord/tickets/R-1.md': laneTicket('R-1', { lane: 'R', body: b }) };
  return loadSnapshot({ files, tree: Object.keys(files).sort() });
};
const ready = (b: string) => gateReady(snap(b), 'R-1');
const ruled = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);

it('risk:complex-branching a lane R ticket with a question, a timebox and a token budget passes gate ready (ST-LN-94 94-ac-1)', () => {
  const s = snap(body());
  expect(s.tickets['R-1'].frontmatter?.lane).toBe('R');
  const r = gateReady(s, 'R-1');
  expect(r.findings).toEqual([]);
  expect(r.verdict).toBe('pass');
  expect(r.acHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  expect(r.acHash).toBe(laneRHash(s.tickets['R-1']));
  // The hash reads the three sections: a changed question moves it, a changed Decision does not.
  expect(laneRHash(snap(body({ question: 'Does the planner need a second round?' })).tickets['R-1'])).not.toBe(r.acHash);
  expect(laneRHash(snap(body({ decisions: QUOTE + '\n- D-02 Read the 2026 record — "yes"' })).tickets['R-1'])).toBe(r.acHash);
});

it('risk:complex-branching a lane R ticket missing its question, timebox or budget fails gate ready and names it (ST-LN-94 94-ac-1)', () => {
  const cases: [string, Parameters<typeof body>[0]][] = [
    ['Question', { question: '-' }],
    ['Question', { question: '<!-- the question -->' }],
    ['Timebox', { timebox: '-' }],
    ['Timebox', { timebox: '' }],
    ['Token budget', { budget: '-' }],
    ['Token budget', { budget: '<!-- n weighted tokens -->' }],
  ];
  for (const [name, o] of cases) {
    const r = ready(body(o));
    const f = ruled(r, 'gate.research-field-missing');
    expect(f, name + ' ' + JSON.stringify(o)).toHaveLength(1);
    expect(f[0].reason).toContain(`"## ${name}"`);
    expect(f[0].file).toBe('accord/tickets/R-1.md');
    expect(f[0].level).toBe('error');
    expect(r.verdict).toBe('fail');
  }
  const t = ruled(ready(body({ timebox: 'about a day' })), 'gate.research-field-missing');
  expect(t).toHaveLength(1);
  expect(t[0].reason).toContain('"## Timebox"');
  expect(t[0].reason).toContain('<n> minutes or <n> hours');
  const b = ruled(ready(body({ budget: 'lots' })), 'gate.research-field-missing');
  expect(b).toHaveLength(1);
  expect(b[0].reason).toContain('"## Token budget"');
  expect(b[0].reason).toContain('<n> weighted tokens');
  for (const o of [{ timebox: '90 minutes' }, { timebox: '1 hours' }, { budget: '250000 weighted tokens' }, { budget: '2M weighted tokens' }]) {
    expect(ruled(ready(body(o)), 'gate.research-field-missing'), JSON.stringify(o)).toEqual([]);
  }
  expect([readTimebox('90 minutes'), readTimebox('1 hours'), readTimebox('4 hours'), readTimebox('about a day')]).toEqual([90, 60, 240, undefined]);
  expect([readTokenBudget('250000 weighted tokens'), readTokenBudget('2M weighted tokens'), readTokenBudget('800k weighted tokens'), readTokenBudget('lots')]).toEqual([
    250000, 2000000, 800000, undefined,
  ]);
  expect([readTimebox('0 hours'), readTokenBudget('0 weighted tokens'), readTimebox('4 hours later')]).toEqual([undefined, undefined, undefined]);
});

const unanswered = (b: string) => ruled(ready(b), 'gate.research-budget-unanswered');

it('risk:complex-branching gate ready passes a lane R ticket only with the owner\'s quoted timebox and budget (ST-LN-94 D-13)', () => {
  expect(ready(body()).verdict).toBe('pass');
  const none = unanswered(body({ decisions: '' }));
  expect(none).toHaveLength(2);
  const [tb, bud] = [none.find((f) => f.reason.includes('"## Timebox"')), none.find((f) => f.reason.includes('"## Token budget"'))];
  expect(tb?.reason).toContain('4 hours');
  expect(tb?.reason).toContain('the owner sets the timebox');
  expect(bud?.reason).toContain('800k weighted tokens');
  expect(bud?.reason).toContain('the owner sets the token budget');
  expect(tb?.line).toBe(snap(body()).tickets['R-1'].sections.find((s) => s.heading.trim() === 'Timebox')?.line);
  expect(tb?.level).toBe('error');
  expect(ready(body({ decisions: '' })).verdict).toBe('fail');

  const one = unanswered(body({ decisions: '- D-01 Timebox 4 hours — "four hours"' }));
  expect(one).toHaveLength(1);
  expect(one[0].reason).toContain('"## Token budget"');
  expect(unanswered(body({ decisions: '- D-01 Timebox 4 hours — "four hours"\n- D-02 Token budget 800k weighted tokens — "800k"' }))).toEqual([]);
  for (const d of [
    '- D-01 Timebox 4 hours, token budget 800k weighted tokens',
    '- D-01 Timebox 4 hours, token budget 800k weighted tokens — ""',
    '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "  "',
    '- D-01 Timebox 4 hours, token budget 800k weighted tokens — four hours',
    '<!-- - D-01 Timebox 4 hours, token budget 800k weighted tokens — "ok" -->',
    'D-01 Timebox 4 hours, token budget 800k weighted tokens — "ok" said nobody',
    '```\n- D-01 Timebox 4 hours, token budget 800k weighted tokens — "ok"\n```',
    '- D-01 Timebox 14 hours, token budget 1800k weighted tokens — "ok"',
  ]) {
    expect(unanswered(body({ decisions: d })), d).toHaveLength(2);
  }
  expect(unanswered(body({ decisions: '- D-01 Timebox 4 HOURS,  token budget 800k   Weighted tokens — "ok"' }))).toEqual([]);
  // An unreadable value is gate.research-field-missing's finding alone.
  expect(unanswered(body({ timebox: 'about a day', decisions: '' })).map((f) => f.reason.includes('"## Token budget"'))).toEqual([true]);
});

it('risk:complex-branching an extended budget needs the owner\'s quoted extension (ST-LN-94 D-13)', () => {
  const f = unanswered(body({ timebox: '6 hours' }));
  expect(f).toHaveLength(1);
  expect(f[0].reason).toContain('"## Timebox"');
  expect(f[0].reason).toContain('6 hours');
  expect(ready(body({ timebox: '6 hours', decisions: QUOTE + '\n- D-02 Timebox extended to 6 hours — "take two more hours"' })).verdict).toBe('pass');
});

it('risk:dos a long hostile Decisions line is read in bounded time (ST-LN-94 D-13)', () => {
  const hostile = '- D-01 Timebox 4 hours' + ' — "'.repeat(50_000) + ' — ';
  expect(hostile.length).toBeGreaterThanOrEqual(200_000);
  const t0 = performance.now();
  const r = ready(body({ decisions: hostile }));
  expect(performance.now() - t0).toBeLessThan(2_000);
  expect(ruled(r, 'gate.research-budget-unanswered')).toHaveLength(2);
});

// ST-LN-94 D-10, research Pitfall 8: gate plan runs PLAN_R_RULES for lane R, so no lane M plan rule reaches it, whatever records it holds.
it('risk:regression gate plan refuses a lane R ticket as having no plan (ST-LN-94 94-ac-1)', () => {
  const only = (r: GateResult) => {
    expect(r.findings.map((f) => f.rule)).toEqual(['gate.lane-r-plan']);
    expect(r.findings[0].reason).toContain('lane R has no plan');
    expect(r.findings[0].reason).toContain('accord/research/');
    expect(r.findings[0].file).toBe('accord/tickets/R-1.md');
    expect(r.verdict).toBe('fail');
    expect(r.planHash).toBeUndefined();
  };
  only(gatePlan(snap(body()), 'R-1'));
  const files = {
    'accord/config.yml': config,
    'accord/tickets/R-1.md': laneTicket('R-1', { lane: 'R', body: body() }),
    'accord/tickets/R-1/plan.md': PLAN.split('\n').filter((l) => !l.startsWith('covers:')).join('\n'),
    'accord/tickets/R-1/plan-review.md': 'Round record: 1\n\n## Round 1 (whole)\n\n1. Should — task 1 drops a header — open — rests on: ac-1\n',
  };
  const stray = loadSnapshot({ files, tree: Object.keys(files).sort() });
  expect(stray.tickets['R-1'].frontmatter?.lane).toBe('R');
  only(gatePlan(stray, 'R-1'));
});

// ST-LN-94 D-10, research Pitfall 8: lint gives a lane R ticket its own headings and none of lane M's rules.
const lintOf = (files: Record<string, string>) => lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': config, ...files }, tree: ['accord/config.yml', ...Object.keys(files)].sort() })).findings;
const rTicket = (b = body()) => laneTicket('R-1', { lane: 'R', body: b });

it('risk:regression lint asks a lane R ticket for its own headings only (ST-LN-94 94-ac-1)', () => {
  const heads = (b: string) => lintOf({ 'accord/tickets/R-1.md': rTicket(b) }).filter((f) => f.rule === 'lint.heading-missing').map((f) => f.reason);
  expect(heads(body())).toEqual([]);
  expect(heads(body({ timebox: '-' }))).toEqual(['missing "## Timebox"']);
  const none = heads(['## Decisions', QUOTE, ''].join('\n'));
  expect(none.sort()).toEqual(['missing "## Question"', 'missing "## Timebox"', 'missing "## Token budget"']);
  for (const m of ['Approach', 'Acceptance criteria', 'Open questions', 'Intent', 'Vetoes']) expect(none).not.toContain(`missing "## ${m}"`);
});

it('risk:regression a lane R ticket needs no scenario and does not turn on the tests policy (ST-LN-94 94-ac-1)', () => {
  const files = { 'accord/tickets/R-1.md': rTicket(), [REPORT]: junit({ 'a#untraced': 'passed' }) };
  const rules = (f: Record<string, string>) => lintOf(f).map((x) => x.rule);
  expect(rules(files)).not.toContain('lint.no-scenarios');
  expect(rules(files)).not.toContain('lint.test-untraced');
  // The report case is untraced: a lane M ticket turns the policy on, so the R ticket is what stays silent.
  expect(rules({ ...files, 'accord/tickets/T-1.md': laneTicket('T-1') })).toContain('lint.test-untraced');
});

it('risk:regression accord lint reports nothing on a valid lane R ticket (ST-LN-94 94-ac-1)', () => {
  const mine = (f: Record<string, string>) => lintOf(f).filter((x) => x.file === 'accord/tickets/R-1.md' || x.file.startsWith('accord/tickets/R-1/'));
  expect(mine({ 'accord/tickets/R-1.md': rTicket() })).toEqual([]);
  expect(mine({ 'accord/tickets/R-1.md': rTicket(), 'accord/tickets/R-1/review.md': 'Round record: 1\n\n## Round 1 (whole)\n\nNo findings\n' })).toEqual([]);
});

// ST-LN-94 94-ac-2, 94-ac-3, D-10, D-11: gate done on a lane R ticket runs DONE_R_RULES. It is done when a record its research: lists is in the
// checkout with a Spent line, and its branch changes nothing under packages/; it is asked for no plan, review, verification or ticks.
const RECORD = 'accord/research/2026-11-20-critic-rounds.md';
const SPENT = 'Spent: 2h 10m of 4 hours; 312000 of 800000 weighted tokens';
const record = (...lines: string[]) => ['# Critic rounds', '', 'Date: 2026-11-20', 'Repository at `1c5704ee`', '', 'The critic needs one round.', '', ...lines, ''].join('\n');
const OWN: BranchChange[] = [
  { path: 'accord/tickets/R-1.md', kind: 'modified', lines: 2 },
  { path: RECORD, kind: 'added', lines: 9 },
];
type DoneOpts = { body?: string; hashed?: string; research?: string[]; record?: string | null; extra?: Record<string, string>; fact?: BranchFact; hash?: false };
/** An R ticket whose ac_hash gate ready recorded over `hashed` (default: its own body), with its record and branch fact. */
const doneSnap = (o: DoneOpts = {}) => {
  const b = o.body ?? body();
  const listed = o.research ?? [RECORD];
  let ticket = laneTicket('R-1', { lane: 'R', body: b, frontmatter: listed.length === 0 ? [] : ['research: [' + listed.map((p) => JSON.stringify(p)).join(', ') + ']'] });
  if (o.hash !== false) ticket = setFrontmatterKey(ticket, 'ac_hash', laneRHash(snap(o.hashed ?? b).tickets['R-1']));
  const files: Record<string, string> = {
    'accord/config.yml': config,
    'accord/tickets/R-1.md': ticket,
    ...(o.record === null ? {} : { [RECORD]: o.record ?? record(SPENT) }),
    ...(o.extra ?? {}),
  };
  return loadSnapshot({ files, tree: Object.keys(files).sort(), branchFacts: { 'R-1': o.fact ?? { base: 'b'.repeat(40), changes: OWN, synced: [] } } });
};
const done = (o: DoneOpts = {}) => gateDone(doneSnap(o), 'R-1');
const rIds = () => DONE_R_RULES.map((r) => r.id);

it('risk:complex-branching a lane R ticket is done when its listed research record is present, with no plan, review or verification asked (ST-LN-94 94-ac-2)', () => {
  const ok = done();
  expect(ok.findings).toEqual([]);
  expect(ok.verdict).toBe('pass');
  const laneM = DONE_RULES.map((r) => r.id).filter((x) => !rIds().includes(x));
  for (const x of ['gate.verification-missing', 'gate.task-incomplete', 'gate.review-missing', 'gate.tick-unbound', 'gate.suite-not-passed']) expect(laneM).toContain(x);

  const missing = done({ record: null });
  const m = ruled(missing, 'gate.research-record-missing');
  expect(m).toHaveLength(1);
  expect(m[0]).toMatchObject({ file: 'accord/tickets/R-1.md', pointer: '/research', level: 'error' });
  expect(m[0].reason).toContain('accord/research/');
  expect(missing.verdict).toBe('fail');
  expect(ruled(done({ research: [] }), 'gate.research-record-missing')).toHaveLength(1);
  // T-03-33: only an entry that names a record under accord/research/ counts.
  expect(ruled(done({ research: ['accord/research/../tickets/R-1.md'] }), 'gate.research-record-missing')).toHaveLength(1);

  for (const r of [
    record(),
    record('Spent: 1h of 4 hours; not measured of 800000 weighted tokens'),
    record('<!-- ' + SPENT + ' -->'),
    record('Spent: 2h 10m of 4 hours'),
    record('Spent: 2h 10m of 4 hours; lots of 800000 weighted tokens'),
  ]) {
    const f = ruled(done({ record: r }), 'gate.research-spent-missing');
    expect(f, r).toHaveLength(1);
    expect(f[0].file).toBe(RECORD);
    expect(f[0].reason).toContain('Spent: <h>h <m>m of <timebox>; <tokens or not measured> of <budget>');
  }
  expect(done({ record: record('Spent: 1h 0m of 4 hours; not measured of 800000 weighted tokens') }).verdict).toBe('pass');

  // The Ready record still holds at Done: no ac_hash, or a question changed since gate ready, fails; so does D-13's quoted Decision.
  expect(ruled(done({ hash: false }), 'gate.ready-missing')).toHaveLength(1);
  expect(ruled(done({ body: body({ question: 'Does the planner need a second round?' }), hashed: body() }), 'gate.sections-changed')).toHaveLength(1);
  expect(ruled(done({ body: body({ decisions: '' }) }), 'gate.research-budget-unanswered')).toHaveLength(2);
});

const STRAY = {
  'accord/tickets/R-1/plan.md': PLAN,
  'accord/tickets/R-1/review.md': 'Round record: 1\n\n## Round 1 (whole)\n\n1. Should — the record drops a source — open — rests on: ac-1\n',
  'accord/tickets/R-1/ledger.md': '## Tasks\n- task 1 done abc1234\n',
  'accord/tickets/R-1/verification.md': '---\nticket: R-1\ncommit: 1234567\nreviewed_on: 2026-11-20\n---\n\n## @ac-1 The record\n\nResult: fail\n',
};

it('risk:regression gate done on a lane R ticket runs none of the lane M Done rules (ST-LN-94 94-ac-2)', () => {
  const ok = done({ extra: STRAY });
  expect(ok.findings.filter((f) => f.level === 'error')).toEqual([]);
  expect(ok.verdict).toBe('pass');
  const failing: DoneOpts[] = [
    { record: null },
    { record: record() },
    { hash: false },
    { body: body({ decisions: '' }) },
    { body: body({ timebox: '-' }) },
    { fact: { base: 'b'.repeat(40), changes: [...OWN, { path: 'packages/core/src/x.ts', kind: 'added', lines: 3 }], synced: [] } },
    { fact: { error: 'git diff failed' } },
    { fact: { base: 'b'.repeat(40), changes: [], synced: [] } },
  ];
  for (const o of failing) {
    const r = done({ ...o, extra: STRAY });
    expect(r.verdict, JSON.stringify(o)).toBe('fail');
    const gated = r.findings.filter((f) => f.rule.startsWith('gate.')).map((f) => f.rule);
    expect(gated.length, JSON.stringify(o)).toBeGreaterThan(0);
    for (const x of gated) expect(rIds(), x).toContain(x);
  }
  // The table itself: no plan, review, verification, suite, tick, scope or interface row.
  for (const x of rIds()) expect(x).toMatch(/^gate\.(ticket-unknown|research-[a-z-]+|ready-missing|sections-changed|branch-unknown|commit-trailer)$/);
});

it('risk:security a change under packages/ on a lane R branch fails gate done and names the file (ST-LN-94 94-ac-3)', () => {
  const fact = (...extra: BranchChange[]): BranchFact => ({ base: 'b'.repeat(40), changes: [...OWN, ...extra], synced: [] });
  const shipped = ruled(
    done({ fact: fact({ path: 'packages/core/src/x.ts', kind: 'added', lines: 3 }, { path: 'packages/cli/README.md', kind: 'modified', lines: 1 }) }),
    'gate.research-shipped',
  );
  expect(shipped.map((f) => f.file).sort()).toEqual(['packages/cli/README.md', 'packages/core/src/x.ts']);
  for (const f of shipped) {
    expect(f.reason).toContain(f.file + ' is under packages/');
    expect(f.level).toBe('error');
  }
  expect(ruled(done({ fact: fact({ path: 'packages/core/src/old.ts', kind: 'deleted', lines: 4 }) }), 'gate.research-shipped')).toHaveLength(1);
  const script = done({ fact: fact({ path: 'scripts/count-rounds.mjs', kind: 'added', lines: 20 }, { path: 'packagesx/a.ts', kind: 'added', lines: 1 }) });
  expect(ruled(script, 'gate.research-shipped')).toEqual([]);
  expect(script.verdict).toBe('pass');
  const unread = done({ fact: { error: 'git merge-base failed reading the branch diff: no merge base' } });
  expect(ruled(unread, 'gate.branch-unknown')).toHaveLength(1);
  expect(unread.verdict).toBe('fail');
});
