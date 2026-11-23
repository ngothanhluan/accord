// Phase 8.1 G4b (D-17, 8.1-ac-13): `accord gate done` refuses a slop hit of the ticket's cumulative diff that is neither fixed (gone from the diff) nor justified by a
// `slop:<kind> <path>:<line> — <reason>` line in the last `## Round` of review.md. The host supplies the hits (slopFacts); the rule judges them against the record.
import { expect, it } from 'vitest';
import { agentTargets, gateDone, LOCKED, OVERRIDABLE, SLOP_FILE, SLOP_FROM, SLOP_OK, skillTargets, slopSpec, STAGE_OF, workOf } from '../src/index.js';
import type { AccordConfig, RepoSnapshot, SlopHit } from '../src/index.js';
import { claimedUnder, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';
import { stagePath } from './helpers/stage-files.js';

const RULE = 'gate.slop-unresolved';
const HIT: SlopHit = { kind: 'empty-catch', path: 'src/a.ts', line: 3, label: 'an empty catch block' };
const LINE = 'slop:empty-catch src/a.ts:3 — the error is logged by the caller';

/** A lane M review snapshot with `cycles`, claimed under `pin`; `fact` is what the host read from git (absent: no facts). */
function build(cycles: RoundSpec[][], fact?: { hits: SlopHit[]; unread: number } | { error: string }, pin: string = SLOP_FROM): RepoSnapshot {
  const count = cycles.flat().length;
  const snap = claimedUnder(scopeSnapshot({ review: v2Review(cycles), facts: facts(Array.from({ length: count }, () => [])) }), pin);
  return (fact === undefined ? snap : { ...snap, slopFacts: { 'T-1': fact } }) as RepoSnapshot;
}
const found = (snap: RepoSnapshot) => gateDone(snap, 'T-1').findings.filter((f) => f.rule === RULE);
const lastRound = (...lines: string[]): RoundSpec[][] => [[{ lines: [] }, { lines }]];

it('risk:parsing the justification is read from the last review round only and must name kind path and line exactly (D-17)', () => {
  const read = (...lines: string[]) => workOf(scopeSnapshot({ review: v2Review(lastRound(...lines)) }), 'T-1')?.review?.slopJustified;
  const want = [{ kind: 'empty-catch', path: 'src/a.ts', line: 3, reason: 'reason' }];
  // with a list marker or without one: the loop strips the marker, and SLOP_OK takes one itself
  expect(read('slop:empty-catch src/a.ts:3 — reason')).toEqual(want);
  expect(read('- slop:empty-catch src/a.ts:3 — reason')).toEqual(want);
  expect(read('1. slop:empty-catch src/a.ts:3 — reason')).toEqual(want);
  expect(read('* slop:empty-catch src/a.ts:3 — reason', '+ slop:empty-catch src/a.ts:3 — reason')).toHaveLength(2);
  expect(SLOP_OK.exec('- slop:empty-catch src/a.ts:3 — reason')?.slice(1)).toEqual(['empty-catch', 'src/a.ts', '3', 'reason']);
  expect(SLOP_OK.exec('slop:empty-catch src/a.ts:3 — reason')?.[3]).toBe('3');
  // a path holding a colon and spaces is everything up to the last ":<line> — "
  expect(SLOP_OK.exec('slop:new-dependency my dir/a:b.ts:12 — reason')?.slice(1)).toEqual(['new-dependency', 'my dir/a:b.ts', '12', 'reason']);
  // no reason, no line number, a line number of zero and a path-less line are not read
  expect(read('slop:empty-catch src/a.ts:3')).toBeUndefined();
  expect(read('slop:empty-catch src/a.ts:3 — ')).toBeUndefined();
  expect(read('slop:empty-catch src/a.ts — reason')).toBeUndefined();
  expect(read('slop:empty-catch src/a.ts:0 — reason')).toBeUndefined();
  expect(read('Slop: empty-catch src/a.ts:3 — reason')).toBeUndefined();
  // an earlier round is not read: only the last `## Round` counts
  const early = workOf(scopeSnapshot({ review: v2Review([[{ lines: [LINE] }, { lines: [] }]]) }), 'T-1')?.review?.slopJustified;
  expect(early).toBeUndefined();
});

it('risk:complex-branching the slop gate refuses an unresolved hit with the exact line to write and passes once the last round names it (8.1-ac-13)', () => {
  const hits = { hits: [HIT], unread: 0 };
  const refused = found(build(lastRound(), hits));
  expect(refused).toHaveLength(1);
  expect(refused[0]).toMatchObject({ level: 'error', file: 'accord/tickets/T-1/review.md' });
  expect(refused[0].reason).toContain('slop:empty-catch src/a.ts:3 is neither fixed nor justified');
  expect(refused[0].reason).toContain('"slop:empty-catch src/a.ts:3 — <reason>"');
  expect(refused[0].reason).toContain('last ## Round of review.md');
  // each form of the line resolves the hit
  for (const marker of ['', '- ', '1. ']) expect(found(build(lastRound(marker + LINE), hits)), marker).toEqual([]);
  // a line of another number, another kind or another path does not
  for (const wrong of ['slop:empty-catch src/a.ts:4 — r', 'slop:any-type src/a.ts:3 — r', 'slop:empty-catch src/b.ts:3 — r']) {
    expect(found(build(lastRound(wrong), hits)), wrong).toHaveLength(1);
  }
  // the line in an earlier round does not
  expect(found(build([[{ lines: [LINE] }, { lines: [] }]], hits))).toHaveLength(1);
  // one finding per unresolved hit, in the hits' order; a hit that is gone needs no line (the host lists only what the diff still holds)
  const two = { hits: [HIT, { kind: 'any-type', path: 'src/b.ts', line: 9, label: 'any' }], unread: 0 };
  expect(found(build(lastRound(LINE), two)).map((f) => f.reason)).toEqual([expect.stringContaining('slop:any-type src/b.ts:9')]);
  expect(found(build(lastRound(), { hits: [], unread: 0 }))).toEqual([]);
});

it('risk:regression the slop gate reads no fact for a ticket the host did not load and leaves with the review stage (D-17)', () => {
  // no fact for the ticket (claimed before SLOP_FROM, no record, no git): nothing to judge
  expect(found(build(lastRound(), undefined))).toEqual([]);
  // the rule leaves with the review stage and is not on the locked floor; Phase 08.8 D-03: gate.security-unreviewed no longer leaves with it, it is on the floor
  expect(STAGE_OF[RULE]).toBe('review');
  expect(LOCKED).toContain('gate.security-unreviewed');
  expect(STAGE_OF).not.toHaveProperty('gate.security-unreviewed');
  expect(LOCKED).not.toContain(RULE);
  expect(OVERRIDABLE).not.toContain(RULE);
});

const SLOW = '## Patterns\n\n- slow: line /(a+)+$/ — slow\n';
const withSlopFile = (snap: RepoSnapshot, text: string): RepoSnapshot => ({ ...snap, files: { ...snap.files, [SLOP_FILE]: text } });

it('risk:security the slop gate fails closed on a refused team pattern and on unreadable facts (8.1-ac-14)', () => {
  // a team pattern the guard refuses is not in force: the line is a finding naming the file, the line and accord lint, even with no hit and no fact
  const refused = withSlopFile(build(lastRound(), { hits: [], unread: 1 }), SLOW);
  expect(slopSpec(refused).problems.filter((p) => p.pattern === true)).toHaveLength(1);
  const f = found(refused);
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ level: 'error', file: SLOP_FILE, line: 3 });
  expect(f[0].reason).toContain('accord/product/slop.md:3');
  expect(f[0].reason).toContain('not in force');
  expect(f[0].reason).toContain('accord lint');
  expect(found(withSlopFile(build(lastRound(), undefined), SLOW))).toHaveLength(1);
  // prose that is no list line is lint's business, not the gate's
  expect(found(withSlopFile(build(lastRound(), { hits: [], unread: 1 }), '## Patterns\n\njust words\n'))).toEqual([]);
  // a ticket the rule does not apply to (claimed before SLOP_FROM) is not refused for the file
  expect(found(withSlopFile(build(lastRound(), undefined, '0.8.0'), SLOW))).toEqual([]);
  // facts that could not be read are one finding quoting the error, and it names the way on
  const unreadable = found(build(lastRound(), { error: "git failed reading the ticket's diff: bad revision" }));
  expect(unreadable).toHaveLength(1);
  expect(unreadable[0]).toMatchObject({ level: 'error', file: 'accord/tickets/T-1/review.md' });
  expect(unreadable[0].reason).toContain("git failed reading the ticket's diff: bad revision");
  expect(unreadable[0].reason).toContain('accord gate done');
  // the same error under an old ticket judges nothing
  expect(found(build(lastRound(), { error: 'x' }, '0.8.0'))).toEqual([]);
});

const config: AccordConfig = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] };
const flat = (text: string): string => text.replace(/\s+/g, ' ');

it('risk:regression the reviewer reports or justifies each slop line and checks the three structure kinds (D-14)', () => {
  for (const name of ['accord-reviewer', 'accord-final-reviewer']) {
    const text = flat(agentTargets(config).find((f) => f.path === `.claude/agents/${name}.md`)?.text ?? '');
    expect(text.length, name).toBeGreaterThan(0);
    // each `## Slop` line is a numbered finding whose fix removes the hit, or, when the code is right, a justification line outside any numbered finding
    for (const p of ['## Slop', '`slop:<kind> <path>:<line> — <reason>`', 'outside any numbered finding']) expect(text, name + ': ' + p).toContain(p);
    // three checks under Lens quality that no CLI pattern can make: a duplicate helper (search first), a function too long, an export nothing imports
    const quality = text.slice(text.indexOf('Lens `quality`:'), text.indexOf('Lens `security`:'));
    expect(quality, name).toContain('a new helper that duplicates a function the repository already has (search the repository first');
    expect(quality, name).toContain('a function too long to read at once');
    expect(quality, name).toContain('an export nothing imports');
  }
  // the review record copies the line verbatim into the round, and only the last round is read
  const record = flat(skillTargets(config).find((f) => f.path === stagePath('review', 'record'))?.text ?? '');
  expect(record).toContain('`slop:<kind> <path>:<line> — <reason>`');
  expect(record).toContain('copied verbatim');
});
