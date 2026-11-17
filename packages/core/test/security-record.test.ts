// ST-LN-36 36-ac-2 (D-05 (3), (5), D-10, the cut-off Ruling and the orchestrator Ruling of 2026-11-17): a version 2 review round records `Security: no pattern matched` or
// `Security: lens security ran`; from SECURITY_TRIGGER_FROM `accord gate done` refuses a round whose package had security triggers and no `Security: lens security ran` line,
// and a round (a final review excepted) that records no `Security:` line at all.
import { expect, it } from 'vitest';
import { SECURITY_TRIGGER_FROM, gateDone, parseRounds } from '../src/index.js';
import type { RepoSnapshot, SecurityFacts } from '../src/index.js';
import { claimedUnder, facts, H, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const RULE = 'gate.security-unreviewed';
const TRIGGER = 'src/run.ts:3: spawn (process spawn)';
const reviewOf = (text: string) => parseRounds(REVIEW, text, 'review');
const ran = 'Security: lens security ran';
const none = 'Security: no pattern matched';

/** A review snapshot claimed under `pin`; `triggers[j - 1]` are round j's triggers (record order, cycles flattened); `security` overrides the whole fact. */
function build(o: { lane?: 'M' | 'S'; cycles: RoundSpec[][]; triggers?: string[][]; pin?: string; security?: SecurityFacts; claim?: Record<string, unknown> }): RepoSnapshot {
  const count = o.cycles.flat().length;
  const snap = scopeSnapshot({ ...(o.lane === undefined ? {} : { lane: o.lane }), review: v2Review(o.cycles), facts: facts(Array.from({ length: count }, () => [])) });
  const withClaim = o.claim === undefined ? claimedUnder(snap, o.pin ?? SECURITY_TRIGGER_FROM) : { ...snap, claimPins: { 'T-1': o.claim } };
  const fact: SecurityFacts = o.security ?? { rounds: Array.from({ length: count }, (_, j) => ({ head: H(j + 1), triggers: o.triggers?.[j] ?? [] })) };
  return { ...withClaim, securityFacts: { 'T-1': fact } } as RepoSnapshot;
}
const reasons = (snap: RepoSnapshot): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === RULE).map((f) => f.reason);
const found = (snap: RepoSnapshot) => gateDone(snap, 'T-1').findings.filter((f) => f.rule === RULE);

it('risk:parsing a round\'s Security line reads one way (ST-LN-36 36-ac-2)', () => {
  const at = (line: string, head = 'Round record: 2') => reviewOf(`${head}\n\n## Round 1 head abc1234\n\nNo findings\n${line}\n`).cycles[0].rounds[0];
  expect(at(none)).toMatchObject({ security: 'none' });
  expect(at(ran)).toMatchObject({ security: 'ran' });
  expect(at('Security: lens security ran on 2 triggers')).toMatchObject({ security: 'ran' });
  expect(at('- ' + ran)).toMatchObject({ security: 'ran' });
  expect(at('* ' + none)).toMatchObject({ security: 'none' });
  expect(at('SECURITY: lens security ran')).toMatchObject({ security: 'ran' });
  // a line that is not one of the two forms is kept as unread, with its line
  for (const bad of ['security: ran', 'Security: done', 'Security:', 'Security: lens security ranged', 'Security: no pattern matched.']) {
    const round = at(bad);
    expect(round.security, bad).toBeUndefined();
    expect(round.securityUnread, bad).toEqual([{ line: 6, text: bad }]);
  }
  // a `ran` line wins over a `none` line of the same round, in either order
  const both = reviewOf(`Round record: 2\n\n## Round 1 head abc1234\n\nNo findings\n${none}\n${ran}\n`).cycles[0].rounds[0];
  expect(both.security).toBe('ran');
  const bothBack = reviewOf(`Round record: 2\n\n## Round 1 head abc1234\n\nNo findings\n${ran}\n${none}\n`).cycles[0].rounds[0];
  expect(bothBack.security).toBe('ran');
  // the line is no record problem, and a round without it holds neither field
  expect(reviewOf(`Round record: 2\n\n## Round 1 head abc1234\n\nNo findings\n${ran}\n`).unreadable).toEqual([]);
  expect(at('prose')).not.toHaveProperty('security');
  // a version 1 record and a plan or approach record read every such line as prose
  expect(at(ran, 'Round record: 1')).not.toHaveProperty('security');
  const v1 = reviewOf(`Round record: 1\n\n## Round 1\n\nNo findings\nSecurity: done\n`).cycles[0].rounds[0];
  expect(v1).not.toHaveProperty('securityUnread');
  for (const kind of ['plan', 'approach'] as const) {
    const r = parseRounds('accord/tickets/T-1/' + kind + '-review.md', `Round record: 1\n\n## Round 1\n\nNo findings\n${ran}\nSecurity: done\n`, kind).cycles[0].rounds[0];
    expect(r, kind).not.toHaveProperty('security');
    expect(r, kind).not.toHaveProperty('securityUnread');
  }
});

it('ac-2 a round with security triggers and no security review is refused from 0.7.0 (ST-LN-36 36-ac-2)', () => {
  expect(SECURITY_TRIGGER_FROM).toBe('0.7.0');
  const plain = [[{ lines: [] }]];
  const triggered = reasons(build({ cycles: plain, triggers: [[TRIGGER]] }));
  expect(triggered).toHaveLength(1);
  expect(triggered[0]).toContain('round 1');
  expect(triggered[0]).toContain('src/run.ts:3: spawn');
  expect(triggered[0]).toContain('Security: lens security ran');
  expect(found(build({ cycles: plain, triggers: [[TRIGGER]] }))[0]).toMatchObject({ file: REVIEW, line: 3, level: 'error' });

  // with the lens line there is nothing; a false "no pattern matched" is refused as before
  expect(reasons(build({ cycles: [[{ lines: ['No findings', ran] }]], triggers: [[TRIGGER]] }))).toEqual([]);
  const falseNone = reasons(build({ cycles: [[{ lines: ['No findings', none] }]], triggers: [[TRIGGER]] }));
  expect(falseNone).toHaveLength(1);
  expect(falseNone[0]).toContain('src/run.ts:3: spawn');

  // a round with no trigger and no Security: line is refused, naming the line to write
  const missing = reasons(build({ cycles: plain, triggers: [[]] }));
  expect(missing).toHaveLength(1);
  expect(missing[0]).toContain('round 1');
  expect(missing[0]).toContain('no Security: line');
  expect(missing[0]).toContain('Security: no pattern matched');
  expect(found(build({ cycles: plain, triggers: [[]] }))[0]).toMatchObject({ file: REVIEW, line: 3 });

  // no trigger with either line passes: the lens line is present and true
  expect(reasons(build({ cycles: [[{ lines: ['No findings', none] }]], triggers: [[]] }))).toEqual([]);
  expect(reasons(build({ cycles: [[{ lines: ['No findings', ran] }]], triggers: [[]] }))).toEqual([]);
});
