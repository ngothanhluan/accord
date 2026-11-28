// Phase 10 D-14, 10-ac-21, 10-ac-11: the planner may answer a critic finding `does not hold: <path>:<line>` at approach and plan. From DOES_NOT_HOLD_FROM the finding is closed when that place
// exists in the working tree (the host's `places` fact), refused when it does not, and a ticket claimed earlier reads the segment as an open finding, as it did at b4477211.
import { expect, it } from 'vitest';
import { DOES_NOT_HOLD_FROM, loadSnapshot, nextRound, parseRounds, recordProblems, roundText } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

type Kind = 'plan' | 'approach';
const FILE: Record<Kind, string> = { plan: 'plan-review.md', approach: 'approach-review.md' };
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]): string => `## Round ${n} (${n === 1 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`;
/** A finding line of round 1: a plan finding rests on a ticket line from round 1 (D-19), an approach finding needs no ground in round 1. */
const finding = (kind: Kind, state: string, ...marks: string[]): string =>
  `1. Should — ${kind === 'plan' ? 'task 1 drops a header' : 'the impact list misses a caller'} — ${state}${(kind === 'plan' ? ['rests on: ac-1', ...marks] : marks).map((m) => ' — ' + m).join('')}`;

interface Opts {
  claim?: ClaimPin;
  places?: Record<string, boolean>;
}
function repo(kind: Kind, record: string, { claim = { pin: DOES_NOT_HOLD_FROM }, places }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1');
  files[`accord/tickets/T-1/${FILE[kind]}`] = record;
  const snapshot: RepoSnapshot = { ...loadSnapshot({ files, tree: Object.keys(files) }), claimPins: { 'T-1': claim } };
  return places === undefined ? snapshot : { ...snapshot, places: { 'T-1': places } };
}
const one = (kind: Kind, state: string, ...marks: string[]): string => HEAD + round(1, finding(kind, state, ...marks));

it('risk:regression the does-not-hold cut-off is 0.24.0 (10-ac-21, D-14)', () => {
  expect(DOES_NOT_HOLD_FROM).toBe('0.24.0');
});

it('risk:parsing a does-not-hold state takes a place, in backticks when the path holds a space, as a notHeld finding (10-ac-21, D-14)', () => {
  const rec = parseRounds('plan-review.md', HEAD + round(1, '1. Should — a — does not hold: src/a.ts:12', '2. Should — b — does not hold: `my dir/a.ts`:4'), 'plan');
  const [plain, spaced] = rec.cycles[0].rounds[0].findings;
  expect(plain).toMatchObject({ n: 1, state: 'notHeld', notHeld: { file: 'src/a.ts', line: 12 } });
  expect(spaced).toMatchObject({ n: 2, state: 'notHeld', notHeld: { file: 'my dir/a.ts', line: 4 } });
  expect(rec.unreadable).toEqual([]);
});

it('risk:parsing a does-not-hold state with no place, no line or a placeholder is read as a notHeld finding with no place (10-ac-21, D-14)', () => {
  for (const state of ['does not hold:', 'does not hold: src/a.ts', 'does not hold: <path>:<line>', 'does not hold: none']) {
    const [f] = parseRounds('approach-review.md', one('approach', state), 'approach').cycles[0].rounds[0].findings;
    expect(f.state, state).toBe('notHeld');
    expect(f.notHeld, state).toBeUndefined();
  }
});

it('risk:regression a plan or approach finding answered does not hold with a place that exists is closed (10-ac-21, D-14)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const answer = nextRound(repo(kind, one(kind, 'does not hold: src/a.ts:12'), { places: { 'src/a.ts:12': true } }), 'T-1', kind);
    expect(answer.kind, kind).toBe('refused');
    expect(answer.findings, kind).toEqual([]);
    expect(roundText(answer), kind).toContain('Findings still open: none');
    expect(roundText(answer), kind).not.toContain('does not hold');
  }
});

it('risk:regression a does-not-hold finding with no place fact stays open: the finding is listed (10-ac-21, D-14)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const answer = nextRound(repo(kind, one(kind, 'does not hold: src/a.ts:12')), 'T-1', kind);
    expect(answer.kind, kind).toBe('refused');
    expect(roundText(answer), kind).toContain('Findings still open:\nRound 1:\n1. Should');
  }
});

it('risk:security a does-not-hold place that does not exist is refused naming the finding and the place (10-ac-21, D-14, T-10-07)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const snapshot = repo(kind, one(kind, 'does not hold: ../outside.ts:1'), { places: { '../outside.ts:1': false } });
    const answer = nextRound(snapshot, 'T-1', kind);
    expect(answer.kind, kind).toBe('refused');
    const text = roundText(answer);
    expect(text, kind).toContain('1.1');
    expect(text, kind).toContain('../outside.ts:1');
    expect(text, kind).toContain('does not exist');
    expect(recordProblems(snapshot, 'T-1', kind), kind).toHaveLength(1);
  }
});

it('risk:parsing a does-not-hold answer with no readable place is refused with its line (10-ac-21, D-14)', () => {
  for (const state of ['does not hold:', 'does not hold: src/a.ts', 'does not hold: <path>:<line>']) {
    const problems = recordProblems(repo('approach', one('approach', state)), 'T-1', 'approach');
    expect(problems, state).toHaveLength(1);
    expect(problems[0].line, state).toBe(5);
    expect(problems[0].reason, state).toContain('does not hold');
    expect(problems[0].reason, state).toContain('<path>:<line>');
  }
});

it('risk:regression a ticket claimed under 0.23.1 reads a does-not-hold segment as an open finding and asks nothing of it (10-ac-11)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    for (const state of ['does not hold: src/a.ts:12', 'does not hold:']) {
      const snapshot = repo(kind, one(kind, state), { claim: { pin: '0.23.1' }, places: { 'src/a.ts:12': true } });
      expect(recordProblems(snapshot, 'T-1', kind), `${kind} ${state}`).toEqual([]);
      const answer = nextRound(snapshot, 'T-1', kind);
      expect(roundText(answer), `${kind} ${state}`).not.toContain('Findings still open: none');
    }
  }
});
