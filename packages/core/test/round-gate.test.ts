// ST-LN-17 Task 4: gate done and gate plan refuse a stop the owner has not lifted, a round run past the cap
// or past a stop, and an unreadable record.
import { expect, it } from 'vitest';
import { gateDone, gatePlan, loadSnapshot, nextRound, roundText } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { CONFIG, LANE_S_BODY, P, building, done, laneTicket } from '../../../test/helpers/lane.js';

type Files = Record<string, string>;
const HEAD = 'Round record: 1\n\n';
const RULINGS = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const MUST = 'Must 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234';
const SHOULD = 'Should 1 [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235';
const NICE = 'Nice 1 [patch]: rename w — src/export.ts:1 — deferred';
const NONE = 'No findings';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
const allow = (n: number, after: number, cycle = 1, kind = 'review') =>
  `- Ruling: the owner allows ${n} more ${kind} rounds after round ${after} of cycle ${cycle} — "one more" — cost if wrong: ${n} rounds\n`;
const rule = (r: GateResult, id: string) => r.findings.filter((f) => f.rule === id);
const load = (files: Files, extra: Record<string, unknown> = {}) => loadSnapshot({ files, tree: Object.keys(files), ...extra });

function review(id: string, text: string, o: { ledger?: string; returnFacts?: Record<string, Record<string, boolean>> } = {}) {
  const files: Files = { 'accord/config.yml': CONFIG };
  if (id.startsWith('S-')) files[P(id)] = laneTicket(id, { lane: 'S', body: LANE_S_BODY });
  else done(files, id);
  files['accord/tickets/' + id + '/ledger.md'] = RULINGS + (o.ledger ?? '');
  files['accord/tickets/' + id + '/review.md'] = text;
  return load(files, o.returnFacts === undefined ? {} : { returnFacts: o.returnFacts });
}

function planRepo(text: string, ledger = '') {
  const files: Files = { 'accord/config.yml': CONFIG };
  building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = RULINGS + ledger;
  files['accord/tickets/T-1/plan-review.md'] = text;
  return load(files);
}

it('ac-3 a review that stops converging stops for the owner and gate done fails until acceptance or convergence', () => {
  const three = HEAD + round(1, MUST) + round(2, MUST) + round(3, SHOULD);
  for (const tail of ['', 'verdict: converged\n']) {
    const s = review('T-1', three + tail);
    const a = nextRound(s, 'T-1', 'review');
    expect(a.kind).toBe('stop');
    const text = roundText(a);
    expect(text.startsWith('stop: report to owner\n')).toBe(true);
    expect(text).toContain(SHOULD);
    expect(text).toContain('Approach:\nExtend the existing report writer with a csv mode.');
  }
  const converged = gateDone(review('T-1', three + 'verdict: converged\n'), 'T-1');
  expect(converged.verdict).toBe('fail');
  expect(rule(converged, 'gate.review-rounds').map((f) => f.reason).join('\n')).toContain('round 3 of cycle 1');

  const accepted = three + 'verdict: accepted-by-owner "ship it with the comma issue open"\n';
  expect(rule(gateDone(review('T-1', accepted), 'T-1'), 'gate.review-rounds')).toEqual([]);

  const four = HEAD + round(1, MUST) + round(2, MUST) + round(3, SHOULD) + round(4, NONE) + 'verdict: converged\n';
  expect(rule(gateDone(review('T-1', four, { ledger: allow(1, 3) }), 'T-1'), 'gate.review-rounds')).toEqual([]);
  const unallowed = rule(gateDone(review('T-1', four), 'T-1'), 'gate.review-rounds');
  expect(unallowed.map((f) => f.reason).join('\n')).toContain('round 4 of cycle 1');

  const s1 = nextRound(review('S-1', three + 'verdict: converged\n'), 'S-1', 'review');
  expect(s1.kind).toBe('stop');
  expect(rule(gateDone(review('S-1', three + 'verdict: converged\n'), 'S-1'), 'gate.review-rounds')).not.toEqual([]);
  expect(rule(gateDone(review('S-1', accepted), 'S-1'), 'gate.review-rounds')).toEqual([]);

  const second = HEAD + round(1, MUST) + round(2, NONE) + 'verdict: converged\n\n## Return from verify abc1234def\n\n' + round(1, NONE);
  const facts = { returnFacts: { 'T-1': { abc1234def: true } } };
  const open = rule(gateDone(review('T-1', second, facts), 'T-1'), 'gate.review-rounds');
  expect(open.map((f) => f.reason).join('\n')).toContain('cycle 2');
  expect(open.map((f) => f.reason).join('\n')).toContain('no verdict: line');
  expect(rule(gateDone(review('T-1', second + 'verdict: converged\n', facts), 'T-1'), 'gate.review-rounds')).toEqual([]);
});

it('ac-4 the plan critique loop has the same cap and stop and gate plan fails until acceptance or a no findings round', () => {
  const rounds =
    HEAD + '## Round 1 (whole)\n\n1. Must — x — fixed\n\n## Round 2 (diff)\n\n1. Should — y — fixed\n\n## Round 3 (diff)\n\n1. Should — z — open\n\n';
  const stop = nextRound(planRepo(rounds), 'T-1', 'plan');
  expect(stop.kind).toBe('stop');
  const text = roundText(stop);
  expect(text.startsWith('stop: report to owner\n')).toBe(true);
  for (const part of ['1. Should — z — open', 'Approach:\n', 'more plan critique rounds after round 3 of cycle 1']) expect(text).toContain(part);
  expect(text).not.toContain('Fix executor model');
  const failed = gatePlan(planRepo(rounds), 'T-1');
  expect(rule(failed, 'gate.plan-rounds')).not.toEqual([]);
  expect(failed.verdict).toBe('fail');

  const accepted = rounds + 'verdict: accepted-by-owner "the plan is good enough"\n';
  expect(rule(gatePlan(planRepo(accepted), 'T-1'), 'gate.plan-rounds')).toEqual([]);
  const ended = nextRound(planRepo(accepted), 'T-1', 'plan');
  expect(ended.kind).toBe('refused');
  expect(ended.reasons.join('\n')).toContain('the loop has ended');
  expect(ended.reasons.join('\n')).not.toContain('append a ## Closed line');
  expect(rule(gatePlan(planRepo(accepted + '\n## Closed\n'), 'T-1'), 'gate.plan-rounds')).toEqual([]);

  const closed = rule(gatePlan(planRepo(rounds + '## Closed\n'), 'T-1'), 'gate.plan-rounds');
  expect(closed.map((f) => f.reason).join('\n')).toContain('## Closed while the stop');

  const four = rounds + '## Round 4 (diff)\n\nNo findings\n';
  expect(rule(gatePlan(planRepo(four, allow(1, 3, 1, 'plan critique')), 'T-1'), 'gate.plan-rounds')).toEqual([]);

  const nice = (n: number) => `## Round ${n} (diff)\n\n1. Nice — n — deferred\n\n`;
  const five = HEAD + [1, 2, 3, 4, 5].map(nice).join('');
  const capped = nextRound(planRepo(five), 'T-1', 'plan');
  expect(capped.kind).toBe('stop');
  expect(capped.reasons.join('\n')).toContain('the cap of 5 rounds');
  expect(rule(gatePlan(planRepo(five), 'T-1'), 'gate.plan-rounds')).not.toEqual([]);

  const again = five + 'verdict: accepted-by-owner "enough"\n\n## Closed\n\n## Round 1 (whole)\n\nNo findings\n';
  expect(nextRound(planRepo(again), 'T-1', 'plan')).toMatchObject({ kind: 'next', cycle: 2, round: 2 });
  expect(rule(gatePlan(planRepo(again), 'T-1'), 'gate.plan-rounds')).toEqual([]);
});

it('risk:complex-branching gate done fails a cycle past its cap and reads an unversioned record by the old rules only when done on the default branch', () => {
  const body = [1, 2, 3, 4, 5, 6].map((n) => round(n, NICE)).join('');
  const six = HEAD + body + 'verdict: converged\n';
  const past = rule(gateDone(review('T-1', six), 'T-1'), 'gate.review-rounds');
  expect(past.map((f) => f.reason).join('\n')).toContain('round 6 of cycle 1');
  expect(past.map((f) => f.reason).join('\n')).toContain('past the cap of 5 rounds');
  expect(rule(gateDone(review('T-1', six, { ledger: allow(1, 5) }), 'T-1'), 'gate.review-rounds')).toEqual([]);

  const bare = body + 'verdict: converged\n';
  const base = review('T-1', bare);
  expect(rule(gateDone(base, 'T-1'), 'gate.review-rounds')).toEqual([]);
  const buildFiles: Files = { 'accord/config.yml': CONFIG };
  building(buildFiles, 'T-1');
  const doneFiles: Files = { 'accord/config.yml': CONFIG };
  done(doneFiles, 'T-1');
  const onBuild = { ...base, defaultRef: { ref: 'refs/heads/main', snapshot: load(buildFiles) } };
  const versionLine = rule(gateDone(onBuild, 'T-1'), 'gate.review-rounds');
  expect(versionLine.map((f) => f.reason).join('\n')).toContain('Round record: 1');
  const onDone = { ...base, defaultRef: { ref: 'refs/heads/main', snapshot: load(doneFiles) } };
  expect(rule(gateDone(onDone, 'T-1'), 'gate.review-rounds')).toEqual([]);

  const plan = [1, 2, 3, 4, 5].map((n) => `## Round ${n} (diff)\n\n1. Nice — n — deferred\n\n`).join('');
  const planBase = planRepo(plan);
  const planOn = { ...planBase, defaultRef: { ref: 'refs/heads/main', snapshot: load(buildFiles) } };
  const planFindings = rule(gatePlan(planOn, 'T-1'), 'gate.plan-rounds');
  expect(planFindings.map((f) => f.reason).join('\n')).toContain('Round record: 1');
});
