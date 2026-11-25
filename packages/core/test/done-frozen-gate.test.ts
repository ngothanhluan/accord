// Phase 15 G1 (D-23, D-24, D-25): a done ticket is not edited. The pure half: `gateDone` over hand-built snapshots that carry the host's `baseRecords` fact, no git involved.
import { expect, it } from 'vitest';
import { loadSnapshot, setFrontmatterKey } from '../src/index.js';
import type { BaseRecords, RepoSnapshot } from '../src/index.js';
import { gateDone } from '../src/gate/index.js';
import { CONFIG, done, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const RULE = 'gate.done-ticket-edited';
const RECORDED = 'a'.repeat(40);
const GATED = 'b'.repeat(40);
const BASE = 'c'.repeat(40);

/** A done ticket T-1 whose ticks name a commit other than the gated one: today's Done table fails it on gate.tick-stale-commit. */
function staleTick(): { files: Files; snapshot: RepoSnapshot } {
  const files: Files = { 'accord/config.yml': CONFIG };
  done(files, 'T-1');
  files[P('T-1')] = setFrontmatterKey(files[P('T-1')], 'verified_commit', RECORDED);
  const snapshot = loadSnapshot({ files, tree: [], git: { commit: GATED, authors: {} } });
  return { files, snapshot };
}

const withFact = (snapshot: RepoSnapshot, fact: Partial<BaseRecords>): RepoSnapshot => ({
  ...snapshot,
  baseRecords: { 'T-1': { base: BASE, done: true, records: {}, head: {}, ...fact } },
});

const FOLDER = 'accord/tickets/T-1/';

it('risk:regression a ticket not done at the base runs today\'s Done table: a stale tick still fails', () => {
  const { snapshot } = staleTick();
  const result = gateDone(withFact(snapshot, { done: false }), 'T-1');
  expect(result.findings.map((f) => f.rule)).toContain('gate.tick-stale-commit');
  expect(result.findings.map((f) => f.rule)).not.toContain(RULE);
});

it('risk:regression a done ticket whose records are unchanged passes with no finding, however stale its ticks or evidence are at HEAD (D-24)', () => {
  const { snapshot } = staleTick();
  expect(gateDone(snapshot, 'T-1').findings.map((f) => f.rule)).toContain('gate.tick-stale-commit');
  const same = { [P('T-1')]: 'text\n', [FOLDER + 'plan.md']: 'plan\n', [FOLDER + 'verification.md']: 'cites test/gone.spec.ts\n' };
  const result = gateDone(withFact(snapshot, { records: same, head: { ...same } }), 'T-1');
  expect(result.findings).toEqual([]);
  expect(result.verdict).toBe('pass');
});

it('risk:regression a line-ending difference alone is no edit of a done ticket', () => {
  const { snapshot } = staleTick();
  const result = gateDone(withFact(snapshot, { records: { [P('T-1')]: 'a\nb\n' }, head: { [P('T-1')]: 'a\r\nb\r\n' } }), 'T-1');
  expect(result.findings).toEqual([]);
});

it('risk:regression a changed file of the ticket folder is one finding that names it, and no other Done rule speaks', () => {
  const { snapshot } = staleTick();
  const result = gateDone(
    withFact(snapshot, { records: { [P('T-1')]: 'x\n', [FOLDER + 'plan.md']: 'before\n' }, head: { [P('T-1')]: 'x\n', [FOLDER + 'plan.md']: 'after\n' } }),
    'T-1',
  );
  expect(result.findings.map((f) => f.rule)).toEqual([RULE]);
  expect(result.findings[0].level).toBe('error');
  expect(result.findings[0].file).toBe(P('T-1'));
  expect(result.findings[0].reason).toBe(`T-1 is done on the base branch (${BASE.slice(0, 7)}); a done ticket is not edited - revert the change to ${FOLDER}plan.md`);
  expect(result.verdict).toBe('fail');
});

it('risk:regression a file of the folder deleted at HEAD is an edit, and so is one added at HEAD', () => {
  const { snapshot } = staleTick();
  const deleted = gateDone(withFact(snapshot, { records: { [FOLDER + 'verification.md']: 'v\n' }, head: {} }), 'T-1');
  expect(deleted.findings.map((f) => f.rule)).toEqual([RULE]);
  expect(deleted.findings[0].reason).toContain(FOLDER + 'verification.md');
  const added = gateDone(withFact(snapshot, { records: {}, head: { [FOLDER + 'ledger.md']: 'l\n' } }), 'T-1');
  expect(added.findings.map((f) => f.rule)).toEqual([RULE]);
  expect(added.findings[0].reason).toContain(FOLDER + 'ledger.md');
});

it('risk:regression several changed paths are all named, in code point order', () => {
  const { snapshot } = staleTick();
  const result = gateDone(withFact(snapshot, { records: { [FOLDER + 'b.md']: '1', [FOLDER + 'a.md']: '1' }, head: { [FOLDER + 'b.md']: '2', [FOLDER + 'a.md']: '2' } }), 'T-1');
  expect(result.findings[0].reason).toContain(`${FOLDER}a.md, ${FOLDER}b.md`);
});

it('risk:security a host that supplies no base fact leaves today\'s Done table in force (fail closed)', () => {
  const { snapshot } = staleTick();
  expect(snapshot.baseRecords).toBeUndefined();
  const result = gateDone(snapshot, 'T-1');
  expect(result.findings.map((f) => f.rule)).toContain('gate.tick-stale-commit');
  expect(result.verdict).toBe('fail');
  // a fact for another ticket is no fact for this one
  const other = gateDone({ ...snapshot, baseRecords: { 'T-9': { base: BASE, done: true, records: {}, head: {} } } }, 'T-1');
  expect(other.findings.map((f) => f.rule)).toContain('gate.tick-stale-commit');
});

it('risk:security the fact is read by own key: an inherited name is no fact', () => {
  const { snapshot } = staleTick();
  const result = gateDone({ ...snapshot, baseRecords: {} }, 'toString');
  expect(result.findings.map((f) => f.rule)).not.toContain(RULE);
});
