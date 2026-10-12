// Spec §5-§6: where each lane ticket stands, what blocks it, and who holds it.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, nextRows, setFrontmatterKey, statusRows } from '../src/index.js';
import { acHash } from '../src/gate/hash.js';
import { approved } from './helpers/approve.js';
import { CONFIG, LANE_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const rows = (files: Record<string, string>, claims?: Record<string, string>) =>
  statusRows(loadSnapshot({ files, tree: [], ...(claims === undefined ? {} : { claims }) }));
const T1 = 'accord/tickets/T-1.md';
// Records ac_hash the way a passing `gate ready` does.
const readied = (files: Record<string, string>): Record<string, string> => {
  const hash = acHash(loadSnapshot({ files, tree: [] }).tickets['T-1'].scenarios) as string;
  return { ...files, [T1]: setFrontmatterKey(files[T1], 'ac_hash', hash) };
};
const LANE_KEYS = ['lane', 'stage', 'tasksDone', 'tasksTotal', 'dependsOn', 'blockedBy', 'claimedBy'];

describe('stage (spec §6)', () => {
  it('walks intent, plan, build, review, verify, done', () => {
    const base = { 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') };
    expect(rows(base)[0]).toMatchObject({ lane: 'M', stage: 'intent', tasksDone: 0, tasksTotal: 0 });
    const ap = approved(base, 'T-1');
    expect(rows(ap)[0].stage).toBe('plan');
    const building = { ...ap, 'accord/tickets/T-1/plan.md': PLAN, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' };
    expect(rows(building)[0]).toMatchObject({ stage: 'build', tasksDone: 1, tasksTotal: 2 });
    const built = { ...building, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n' };
    expect(rows(built)[0].stage).toBe('review');
    const reviewed: Record<string, string> = { ...built, 'accord/tickets/T-1/review.md': 'verdict: converged\n' };
    expect(rows(reviewed)[0].stage).toBe('verify');
    const hash = acHash(loadSnapshot({ files: reviewed, tree: [] }).tickets['T-1'].scenarios) as string;
    const ticked = setFrontmatterKey(setFrontmatterKey(reviewed[T1], 'verified', ['ac-1', 'ac-2']), 'verified_hash', hash);
    expect(rows({ ...reviewed, [T1]: ticked })[0].stage).toBe('done');
  });

  it('an edit after approval drops the stage back to intent', () => {
    const ap = approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1');
    expect(rows({ ...ap, [T1]: ap[T1].replace('csv mode', 'tsv mode') })[0].stage).toBe('intent');
  });
});

describe('dependencies and claims (spec §5)', () => {
  const dep = (id: string, deps: string[]) =>
    laneTicket(id, { frontmatter: [`depends_on: [${deps.map((d) => `"${d}"`).join(', ')}]`] });

  it('blockedBy lists dependencies not at done; unknown ids block', () => {
    const files = { 'accord/config.yml': CONFIG, 'accord/tickets/A.md': dep('A', ['B', 'NOPE']), 'accord/tickets/B.md': dep('B', []) };
    expect(rows(files).find((r) => r.id === 'A')).toMatchObject({ dependsOn: ['B', 'NOPE'], blockedBy: ['B', 'NOPE'] });
  });

  it('claimedBy comes from the host claims', () => {
    const files = { 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') };
    expect(rows(files, { 'T-1': 'an@example.test' })[0].claimedBy).toBe('an@example.test');
  });

  it('a ticket without lane gets none of the lane fields, even when claimed', () => {
    const r = rows({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1', { lane: '' }) }, { 'T-1': 'an@example.test' })[0];
    for (const key of LANE_KEYS) expect(r).not.toHaveProperty(key);
  });

  it('nextRows keeps passed-Ready, not-started, unblocked, unclaimed tickets', () => {
    const files = readied(approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1'));
    expect(nextRows(rows(files)).map((r) => r.id)).toEqual(['T-1']);
    expect(nextRows(rows(files, { 'T-1': 'an@example.test' }))).toEqual([]);
    expect(nextRows(rows({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }))).toEqual([]);
    // Planned with no task recorded yet still counts as not started; one recorded task does not.
    const planned = { ...files, 'accord/tickets/T-1/plan.md': PLAN };
    expect(nextRows(rows(planned)).map((r) => r.id)).toEqual(['T-1']);
    const started = { ...planned, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' };
    expect(nextRows(rows(started))).toEqual([]);
  });

  it('nextRows drops an approved ticket that has not passed Ready', () => {
    // An unchecked open question fails Ready, and Ready never wrote ac_hash.
    const body = LANE_BODY.replace('- [x] Delimiter? Comma.', '- [ ] Delimiter?');
    const files = approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1', { body }) }, 'T-1');
    expect(rows(files)[0]).toMatchObject({ stage: 'plan', ready: 'none' });
    expect(nextRows(rows(files))).toEqual([]);
  });

  it('nextRows drops a ticket whose dependency is not done', () => {
    const files = readied(approved({ 'accord/config.yml': CONFIG, [T1]: dep('T-1', ['B']), 'accord/tickets/B.md': dep('B', []) }, 'T-1'));
    expect(nextRows(rows(files)).map((r) => r.id)).toEqual([]);
  });
});
