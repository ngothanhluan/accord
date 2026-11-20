// ST-LN-36 36-ac-2 (D-05 (3), (5), D-10, the cut-off Ruling and the orchestrator Ruling of 2026-11-17): a version 2 review round records `Security: no pattern matched` or
// `Security: lens security ran`; from SECURITY_TRIGGER_FROM `accord gate done` refuses a round whose package had security triggers and no `Security: lens security ran` line,
// and a round (a final review excepted) that records no `Security:` line at all.
import { expect, it } from 'vitest';
import { SECURITY_TRIGGER_FROM, gateDone, nextRound, parseRounds } from '../src/index.js';
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
function build(o: { lane?: 'M' | 'S'; cycles: RoundSpec[][]; triggers?: string[][]; pin?: string; security?: SecurityFacts; claim?: Record<string, unknown>; ledger?: string }): RepoSnapshot {
  const count = o.cycles.flat().length;
  const snap = scopeSnapshot({ ...(o.lane === undefined ? {} : { lane: o.lane }), review: v2Review(o.cycles), ...(o.ledger === undefined ? {} : { ledger: o.ledger }), facts: facts(Array.from({ length: count }, () => [])) });
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

it('risk:security a round with security triggers and no security review is refused from 0.7.0 (ST-LN-36 36-ac-2)', () => {
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

const lineRound = (lines: string[], mark?: 'added' | 'final'): RoundSpec => ({ lines: ['No findings', ...lines], ...(mark === undefined ? {} : { mark }) });

it('risk:security the security record rule holds in lane S, across cycles and for every round kind (ST-LN-36 36-ac-2)', () => {
  // lane S: the same finding through DONE_S_RULES, and the same no-line finding
  const laneS = (lines: string[], triggers: string[]) => reasons(build({ lane: 'S', cycles: [[lineRound(lines)]], triggers: [triggers] }));
  const refusedS = laneS([], [TRIGGER]);
  expect(refusedS).toHaveLength(1);
  expect(refusedS[0]).toContain('src/run.ts:3: spawn');
  expect(laneS([ran], [TRIGGER])).toEqual([]);
  const missingS = laneS([], []);
  expect(missingS).toHaveLength(1);
  expect(missingS[0]).toContain('no Security: line');
  expect(laneS([none], [])).toEqual([]);

  // a second cycle's round 1 is asked like any round
  const second = reasons(build({ cycles: [[lineRound([ran])], [lineRound([])]], triggers: [[], [TRIGGER]] }));
  expect(second).toHaveLength(1);
  expect(second[0]).toContain('round 1 of cycle 2');
  expect(second[0]).toContain('--round 2');

  // a (final review) round is never asked, for its triggers or for the missing line (D-10)
  expect(reasons(build({ cycles: [[lineRound([ran]), lineRound([], 'final')]], triggers: [[TRIGGER], [TRIGGER]] }))).toEqual([]);
  expect(reasons(build({ cycles: [[lineRound([ran]), lineRound([], 'final')]], triggers: [[TRIGGER], []] }))).toEqual([]);

  // the re-review round after a final review reads the final review's fix: asked, refused without the lens line, passing with it (D-10)
  const rereview = (line: string[]) =>
    reasons(build({ cycles: [[lineRound([ran]), lineRound([], 'final'), lineRound(line)]], triggers: [[TRIGGER], [], ['src/fix.ts:1: spawn (process spawn)']] }));
  const asked = rereview([none]);
  expect(asked).toHaveLength(1);
  expect(asked[0]).toContain('round 3 of cycle 1');
  expect(asked[0]).toContain('src/fix.ts:1: spawn');
  expect(rereview([ran])).toEqual([]);

  // an (added code round 1) round is asked like any round
  const added = reasons(build({ cycles: [[lineRound([ran]), lineRound([], 'added')]], triggers: [[TRIGGER], [TRIGGER]] }));
  expect(added).toHaveLength(1);
  expect(added[0]).toContain('round 2 of cycle 1');

  // a round 2 whose fix matched nothing needs no security review, only the trace line
  expect(reasons(build({ cycles: [[lineRound([ran]), lineRound([none])]], triggers: [[TRIGGER], []] }))).toEqual([]);
  const traceless = reasons(build({ cycles: [[lineRound([ran]), lineRound([])]], triggers: [[TRIGGER], []] }));
  expect(traceless).toHaveLength(1);
  expect(traceless[0]).toContain('round 2 of cycle 1');
  expect(traceless[0]).toContain('no Security: line');

  // a round with no trigger whose only Security: line is unread gives the unread-line problem alone, at that line
  const unreadOnly = found(build({ cycles: [[lineRound(['Security: done'])]], triggers: [[]] }));
  expect(unreadOnly).toHaveLength(1);
  expect(unreadOnly[0].line).toBe(6);
  expect(unreadOnly[0].reason).toContain('"Security: done" is not read');
  // with triggers it gives two: the trigger one at the heading, the unread-line one at that line
  const unreadTriggered = found(build({ cycles: [[lineRound(['Security: done'])]], triggers: [[TRIGGER]] }));
  expect(unreadTriggered.map((f) => f.line)).toEqual([3, 6]);
  expect(unreadTriggered[0].reason).toContain('src/run.ts:3: spawn');
  expect(unreadTriggered[1].reason).toContain('is not read');
});

it('risk:security the security record rule keeps the older answer before 0.7.0 and fails closed (ST-LN-36 36-ac-2)', () => {
  const plain = [[lineRound([])]];
  // a ticket claimed under 0.6.0 answers as before, for a triggered round and for a round with no Security: line alike
  expect(reasons(build({ cycles: plain, triggers: [[TRIGGER]], pin: '0.6.0' }))).toEqual([]);
  expect(reasons(build({ cycles: plain, triggers: [[]], pin: '0.6.0' }))).toEqual([]);
  expect(reasons(build({ cycles: plain, triggers: [[TRIGGER]], claim: { pin: '0.7.0', ruleset: '0.6.0' } }))).toEqual([]);
  // a failed claim read applies the rule
  expect(reasons(build({ cycles: plain, triggers: [[TRIGGER]], claim: { error: 'fatal: bad object deadbeef' } }))).toHaveLength(1);
  expect(reasons(build({ cycles: plain, triggers: [[]], claim: { error: 'fatal: bad object deadbeef' } }))).toHaveLength(1);

  // a failed host read is one finding naming git's error; a fact of another round count is one finding
  const failed = reasons(build({ cycles: plain, security: { error: 'git failed reading the package of review round 1: bad revision' } }));
  expect(failed).toHaveLength(1);
  expect(failed[0]).toContain('bad revision');
  const miscount = reasons(build({ cycles: [[lineRound([ran]), lineRound([ran])]], security: { rounds: [{ head: H(1), triggers: [] }] } }));
  expect(miscount).toHaveLength(1);
  expect(miscount[0]).toContain('1 rounds');

  // a skipped ticket (HEAD on the default branch, or the ticket done there) gets no security fact and no finding, a round with no Security: line included
  const skipRecord = v2Review(plain);
  const skippedSnap = claimedUnder(scopeSnapshot({ review: skipRecord, facts: facts([[]], { skip: 'on-default' }) }), SECURITY_TRIGGER_FROM);
  expect(gateDone(skippedSnap, 'T-1').findings.filter((f) => f.rule === RULE)).toEqual([]);
  const doneThere = claimedUnder(scopeSnapshot({ review: v2Review(plain, '\nverdict: converged\n'), facts: facts([[]]), doneOnDefault: true }), SECURITY_TRIGGER_FROM);
  expect(gateDone(doneThere, 'T-1').findings.filter((f) => f.rule === RULE)).toEqual([]);
  // the same skipped snapshot with a fact listing a trigger set by hand still gives none: securityOn reads `skipped`, not the fact
  const handSet = { ...skippedSnap, securityFacts: { 'T-1': { rounds: [{ head: H(1), triggers: [TRIGGER] }] } } } as RepoSnapshot;
  expect(gateDone(handSet, 'T-1').findings.filter((f) => f.rule === RULE)).toEqual([]);

  // a version 1 record gives none, its rounds holding no Security: line
  const v1 = scopeSnapshot({ review: 'Round record: 1\n\n## Round 1\n\nNo findings\n\nverdict: converged\n', facts: facts([[]]) });
  const v1Snap = { ...claimedUnder(v1, SECURITY_TRIGGER_FROM), securityFacts: { 'T-1': { rounds: [{ head: H(1), triggers: [TRIGGER] }] } } } as RepoSnapshot;
  expect(gateDone(v1Snap, 'T-1').findings.filter((f) => f.rule === RULE)).toEqual([]);
});

// post-phase review WR-03: the (final review) exemption (D-10) holds only for a final review that follows a round which was not one, in its stretch.
it('risk:security a (final review) round is exempt only when a non-final round comes before it in its stretch (WR-03)', () => {
  // a ticket whose only round is marked final: asked for its triggers and for the Security: line like any round
  const lone = reasons(build({ cycles: [[lineRound([], 'final')]], triggers: [[TRIGGER]] }));
  expect(lone).toHaveLength(1);
  expect(lone[0]).toContain('round 1 of cycle 1');
  expect(lone[0]).toContain('src/run.ts:3: spawn');
  const loneBare = reasons(build({ cycles: [[lineRound([], 'final')]], triggers: [[]] }));
  expect(loneBare).toHaveLength(1);
  expect(loneBare[0]).toContain('no Security: line');
  expect(reasons(build({ cycles: [[lineRound([ran], 'final')]], triggers: [[TRIGGER]] }))).toEqual([]);

  // a final review that comes first, with a round after it, is the same
  const first = reasons(build({ cycles: [[lineRound([], 'final'), lineRound([none])]], triggers: [[TRIGGER], []] }));
  expect(first).toHaveLength(1);
  expect(first[0]).toContain('round 1 of cycle 1');

  // a final review after a non-final round of its own stretch stays exempt
  expect(reasons(build({ cycles: [[lineRound([ran]), lineRound([], 'final')]], triggers: [[TRIGGER], [TRIGGER]] }))).toEqual([]);

  // an owner allowance after round 2 starts a new stretch at round 3: a final review at round 3 has no round before it in its stretch, one at round 4 has
  const ledger = '- Ruling: the owner allows 2 more review rounds after round 2 of cycle 1 — "go on" — cost if wrong: 2 rounds\n';
  const rounds = (marked: 3 | 4) => [lineRound([ran]), lineRound([ran]), ...(marked === 3 ? [lineRound([], 'final'), lineRound([ran])] : [lineRound([ran]), lineRound([], 'final')])];
  const cut = reasons(build({ cycles: [rounds(3)], triggers: [[TRIGGER], [TRIGGER], [TRIGGER], []], ledger }));
  expect(cut).toHaveLength(1);
  expect(cut[0]).toContain('round 3 of cycle 1');
  expect(reasons(build({ cycles: [rounds(4)], triggers: [[TRIGGER], [TRIGGER], [TRIGGER], [TRIGGER]], ledger }))).toEqual([]);

  // a record claimed before 0.7.0 is unchanged
  expect(reasons(build({ cycles: [[lineRound([], 'final')]], triggers: [[TRIGGER]], pin: '0.6.0' }))).toEqual([]);
});

// 8-ac-5 (D-10): a team pattern line that is not in force (it does not compile or is refused as backtracking) is a gate finding, not a silent pass, for a ticket under the security rule.
const SECURITY_FILE = 'accord/product/security.md';
const withSecurityFile = (snap: RepoSnapshot, ...lines: string[]): RepoSnapshot => ({
  ...snap,
  files: { ...snap.files, [SECURITY_FILE]: ['# Security review', '', '## Patterns', '', ...lines, ''].join('\n') },
});

it('risk:security a team pattern that is not in force is a gate finding of gate done and accord round (8-ac-5)', () => {
  const clean = build({ cycles: [[lineRound([none])]], triggers: [[]] });
  // with no such line the findings are as before, a good team line included
  expect(reasons(clean)).toEqual([]);
  expect(reasons(withSecurityFile(clean, '- infra: path infra/ — infrastructure', '- word: line /\\bfoo\\b/ — a safe pattern'))).toEqual([]);
  expect(nextRound(withSecurityFile(clean, '- infra: path infra/ — infrastructure'), 'T-1', 'review').reasons.join('\n')).not.toContain('security.md');

  for (const [pattern, why] of [['/(/', 'does not compile'], ['/(a+)+$/', 'very slow']]) {
    const snap = withSecurityFile(clean, `- team: line ${pattern} — a team pattern`);
    const hits = found(snap);
    expect(hits, pattern).toHaveLength(1);
    expect(hits[0].reason, pattern).toMatch(/^accord\/product\/security\.md:5: /);
    expect(hits[0].reason, pattern).toContain(why);
    expect(hits[0].reason, pattern).toMatch(/fix the line, then run accord lint$/);
    expect(hits[0], pattern).toMatchObject({ file: REVIEW, level: 'error' });
    // accord round reads the same rule and refuses, naming the same line
    const answer = nextRound(snap, 'T-1', 'review');
    expect(answer.kind, pattern).toBe('refused');
    expect(answer.reasons.join('\n'), pattern).toContain('accord/product/security.md:5: ');
    // the pattern problem comes before the trigger facts: it holds with no fact at all
    const noFact = { ...snap, securityFacts: undefined } as RepoSnapshot;
    expect(found(noFact), pattern).toHaveLength(1);
    // a ticket the security rule does not apply to (claimed before 0.7.0) answers as before
    const old = withSecurityFile(build({ cycles: [[lineRound([none])]], triggers: [[]], pin: '0.6.0' }), `- team: line ${pattern} — a team pattern`);
    expect(reasons(old), pattern).toEqual([]);
  }

  // another problem of the file (a checklist line) stays a lint matter and is not a gate finding
  const checklist = { ...clean, files: { ...clean.files, [SECURITY_FILE]: '## Checklist\n\n- a check with no id\n' } } as RepoSnapshot;
  expect(reasons(checklist)).toEqual([]);
});
