// ST-LN-17 Task 2: nextRound, fixModel and roundText read the round records and decide the next round.
import { expect, it } from 'vitest';
import { fixModel, loadSnapshot, nextRound, roundText } from '../src/index.js';
import { CONFIG, LANE_S_BODY, P, building, laneTicket } from '../../../test/helpers/lane.js';

const CFG = CONFIG + 'models:\n  executor:\n    model: sonnet\nescalation:\n  fix_round_tier_up: 4\n';
const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
const MUST = 'Must 1 [patch]: a header is dropped — src/export.ts:3 — fixed in abc1235';
const SHOULD = 'Should 1 [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235';
const NICE = 'Nice 1: a name could be shorter — src/export.ts:1 — deferred';
const NONE = 'No findings';
const allow = (n: number, after: number, cycle = 1, kind = 'review') =>
  `- Ruling: the owner allows ${n} more ${kind} rounds after round ${after} of cycle ${cycle} — "go on" — cost if wrong: ${n} more rounds\n`;

type Opts = { config?: string; ledger?: string; lane?: string; id?: string; plan?: string; returnFacts?: Record<string, Record<string, boolean>> };
function repo(review: string | undefined, o: Opts = {}) {
  const id = o.id ?? 'T-1';
  const files: Record<string, string> = { 'accord/config.yml': o.config ?? CFG };
  if (id.startsWith('S-')) files[P(id)] = laneTicket(id, { lane: 'S', body: LANE_S_BODY });
  else building(files, id, o.lane === undefined ? undefined : { lane: o.lane });
  files['accord/tickets/' + id + '/ledger.md'] = o.ledger ?? LEDGER;
  if (review !== undefined) files['accord/tickets/' + id + '/review.md'] = review;
  if (o.plan !== undefined) files['accord/tickets/' + id + '/plan-review.md'] = o.plan;
  return loadSnapshot({ files, tree: Object.keys(files), ...(o.returnFacts === undefined ? {} : { returnFacts: o.returnFacts }) });
}

it('ac-1 the round record gives the round the cap and the fix executor model and the tier stays raised after verify', () => {
  const three = HEAD + round(1, MUST) + round(2, SHOULD, NICE) + round(3, NICE);
  const a = nextRound(repo(three), 'T-1', 'review');
  expect(a).toMatchObject({ kind: 'next', round: 4, cap: 5, cycle: 1, model: 'opus' });
  expect(roundText(a)).toBe('Round: 4 of 5\nCycle: 1\nFix executor model: opus\n');

  const back = three + round(4, NICE) + 'verdict: converged\n\n## Return from verify abc1234def\n';
  const b = nextRound(repo(back, { returnFacts: { 'T-1': { abc1234def: true } } }), 'T-1', 'review');
  expect(b).toMatchObject({ kind: 'next', round: 1, cap: 5, cycle: 2, model: 'opus' });
});

it('ac-2 an unreadable record or a round past the cap gets no next round until an owner allowance lets exactly that many run', () => {
  for (const id of ['T-1', 'S-1']) {
    const o = { id };
    const bad = nextRound(repo(HEAD + round(1, 'Should/Must 1: x — y — open', NICE), o), id, 'review');
    expect(bad.kind, id).toBe('refused');
    expect(bad.model, id).toBeUndefined();
    expect(bad.reasons.join('\n'), id).toContain('severity');
    expect(roundText(bad).startsWith('refused: '), id).toBe(true);

    const five = HEAD + round(1, MUST) + round(2, MUST) + round(3, NICE) + round(4, NICE) + round(5, NICE);
    const capped = nextRound(repo(five, o), id, 'review');
    expect(capped.kind, id).not.toBe('next');
    expect(capped.model, id).toBeUndefined();
    expect(capped.reasons.join('\n'), id).toContain('the cap of 5 rounds');
    expect(roundText(capped).startsWith('stop: report to owner\n'), id).toBe(true);

    const ledger = LEDGER + allow(2, 5);
    expect(nextRound(repo(five, { ...o, ledger }), id, 'review')).toMatchObject({ kind: 'next', round: 6, cap: 7 });
    const six = five + round(6, NICE);
    expect(nextRound(repo(six, { ...o, ledger }), id, 'review')).toMatchObject({ kind: 'next', round: 7 });
    const seven = six + round(7, NICE);
    const over = nextRound(repo(seven, { ...o, ledger }), id, 'review');
    expect(over.kind, id).not.toBe('next');
    expect(over.model, id).toBeUndefined();
    expect(over.reasons.join('\n'), id).toContain('the cap of 7 rounds');
  }
});

it('risk:complex-branching a stop from round 3 holds until a no findings round after an allowance and a marker after an unaccepted stop is unreadable', () => {
  const three = HEAD + round(1, MUST) + round(2, MUST) + round(3, SHOULD);
  const stop = nextRound(repo(three), 'T-1', 'review');
  expect(stop).toMatchObject({ kind: 'stop', model: 'sonnet', modelFor: 3 });
  expect(stop.reasons.join('\n')).toContain('round 3 of cycle 1');
  expect(stop.findings).toEqual([{ round: 3, lines: [SHOULD] }]);
  expect(stop.approach?.join('\n')).toContain('Extend the existing report writer with a csv mode.');
  const text = roundText(stop);
  expect(text.startsWith('stop: report to owner\n')).toBe(true);
  for (const part of [
    'Approach:\n',
    SHOULD,
    'verdict: accepted-by-owner "<the owner\'s sentence>"',
    'Ruling: the owner allows <n> more review rounds after round 3 of cycle 1 — "<the owner\'s sentence>" — <cost if wrong>',
    'To change course: write that Ruling',
    "Fix executor model for round 3's findings, if the owner allows more rounds: sonnet",
  ]) {
    expect(text, part).toContain(part);
  }

  const one = LEDGER + allow(1, 3);
  expect(nextRound(repo(three, { ledger: one }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 4, model: 'opus' });
  const again = nextRound(repo(three + round(4, SHOULD), { ledger: one }), 'T-1', 'review');
  expect(again.kind).toBe('stop');
  expect(again.reasons.join('\n')).toContain('round 4 of cycle 1');
  expect(nextRound(repo(three + round(4, NONE), { ledger: one }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 5 });

  const course = LEDGER + allow(5, 3);
  const mustFour = nextRound(repo(three + round(4, MUST), { ledger: course }), 'T-1', 'review');
  expect(mustFour.kind).toBe('stop');
  expect(mustFour.reasons.join('\n')).toContain('round 4 of cycle 1');
  expect(roundText(mustFour)).toContain('more review rounds after round 4 of cycle 1');
  expect(nextRound(repo(three + round(4, MUST), { ledger: course + allow(2, 4) }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 5 });
  expect(nextRound(repo(three + round(4, NICE), { ledger: course }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 5 });

  for (const tail of ['', 'verdict: converged\n']) {
    const skipped = nextRound(repo(three + round(4, NONE) + tail), 'T-1', 'review');
    expect(skipped.kind).toBe('stop');
    expect(skipped.model).toBeUndefined();
    expect(skipped.reasons.join('\n')).toContain('round 4 of cycle 1 ran without an owner Ruling allowing it: after the stop at round 3');
    expect(skipped.findings?.[0]).toMatchObject({ round: 3 });
    expect(roundText(skipped)).toContain('more review rounds after round 3 of cycle 1');
  }
  expect(nextRound(repo(three + round(4, NONE), { ledger: one }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 5 });

  expect(nextRound(repo(HEAD + round(1, MUST) + round(2, MUST) + round(3, NONE)), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 4 });

  const marker = three + 'verdict: converged\n\n## Return from verify abc1234def\n\n' + round(1, NICE);
  const facts = { returnFacts: { 'T-1': { abc1234def: true } } };
  const unaccepted = nextRound(repo(marker, facts), 'T-1', 'review');
  expect(unaccepted.kind).toBe('refused');
  expect(unaccepted.reasons.join('\n')).toContain('did not accept');
  const accepted = marker.replace('verdict: converged', 'verdict: accepted-by-owner "go on"');
  expect(nextRound(repo(accepted, facts), 'T-1', 'review')).toMatchObject({ kind: 'next', cycle: 2, round: 2 });
  const unconfirmed = nextRound(repo(accepted), 'T-1', 'review');
  expect(unconfirmed.kind).toBe('refused');
  expect(unconfirmed.reasons.join('\n')).toContain('cannot confirm');

  const bare = nextRound(repo(three.replace(HEAD, '')), 'T-1', 'review');
  expect(bare.kind).toBe('refused');
  expect(bare.reasons.join('\n')).toContain('Round record: 1');

  const ended = nextRound(repo(HEAD + round(1, MUST) + round(2, MUST) + 'verdict: converged\n'), 'T-1', 'review');
  expect(ended.kind).toBe('refused');
  expect(ended.reasons.join('\n')).toContain('verdict: converged');

  const laneS = nextRound(repo(three, { id: 'S-1' }), 'S-1', 'review');
  expect(laneS.kind).toBe('stop');
  expect(laneS.approach).toBeUndefined();
  expect(laneS.model).toBeUndefined();
  expect(roundText(laneS)).toContain('lift to lane M');
  expect(roundText(laneS)).not.toContain('Approach:');

  const planStop = nextRound(repo(undefined, { plan: three }), 'T-1', 'plan');
  expect(planStop.kind).toBe('stop');
  expect(planStop.model).toBeUndefined();
  expect(roundText(planStop)).toContain('plan critique rounds after round 3 of cycle 1');
  const accept = three + 'verdict: accepted-by-owner "go on"\n';
  const ended2 = nextRound(repo(undefined, { plan: accept }), 'T-1', 'plan');
  expect(ended2.kind).toBe('refused');
  expect(ended2.reasons.join('\n')).toContain('the loop has ended');
  expect(nextRound(repo(undefined, { id: 'S-1', plan: three }), 'S-1', 'plan').kind).toBe('refused');
});

it('risk:calculation the fix executor model tiers up by family and refuses a model it cannot tier', () => {
  const three = HEAD + round(1, NICE) + round(2, NICE) + round(3, NICE);
  const cfg = (model: string | undefined, tier = '4') =>
    CONFIG + (model === undefined ? '' : `models:\n  executor:\n    model: ${model}\n`) + `escalation:\n  fix_round_tier_up: ${tier}\n`;
  const at = (model: string | undefined, r: number, tier = '4') => fixModel(repo(three, { config: cfg(model, tier) }), 'T-1', r);
  expect(at('haiku', 4)).toEqual({ model: 'sonnet' });
  expect(at('opus', 4)).toEqual({ model: 'opus' });
  expect(at('claude-sonnet-4-5', 4)).toEqual({ model: 'opus' });
  expect(at('claude-sonnet-4-5', 3)).toEqual({ model: 'sonnet' });
  expect(at('inherit', 3)).toEqual({ model: 'inherit' });
  expect(at('inherit', 4)).toMatchObject({ refused: expect.stringContaining('models.executor.model') });
  expect(at(undefined, 4)).toEqual({ model: 'opus' });
  expect(at('sonnet', 2, '2')).toEqual({ model: 'opus' });

  const back = HEAD + round(1, NICE) + round(2, NICE) + round(3, NICE) + round(4, NICE) + 'verdict: converged\n\n## Return from verify abc1234def\n\n' + round(1, NICE);
  expect(fixModel(repo(back, { returnFacts: { 'T-1': { abc1234def: true } } }), 'T-1')).toEqual({ model: 'opus' });

  const loose = HEAD + round(1, NICE) + round(2, NICE) + round(3, NICE) + round(4, 'Should/Must 1: x');
  expect(fixModel(repo(loose), 'T-1')).toEqual({ model: 'opus' });

  expect(fixModel(repo(three, { id: 'S-1' }), 'S-1', 4)).toBeUndefined();
  expect(fixModel(repo(undefined), 'T-1')).toBeUndefined();
  for (const [id, lane] of [['L-1', 'L'], ['P-1', 'P']]) {
    expect(fixModel(repo(three, { id, lane }), id, 4), id).toEqual({ model: 'opus' });
  }
});
