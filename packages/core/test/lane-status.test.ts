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
const LANE_KEYS = ['lane', 'stage', 'tasksDone', 'tasksTotal', 'dependsOn', 'blockedBy', 'claimedBy', 'branch', 'title', 'next'];

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

  it('a dropped ticket is never next', () => {
    const files = readied(approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1'));
    const dropped = { ...files, [T1]: setFrontmatterKey(files[T1], 'status', 'dropped') };
    // Everything else about it would admit it, so only the dropped filter excludes it.
    expect(rows(dropped)[0]).toMatchObject({ status: 'dropped', ready: 'ok', stage: 'plan' });
    expect(nextRows(rows(dropped))).toEqual([]);
    expect(nextRows(rows(files)).map((r) => r.id)).toEqual(['T-1']);
  });

  it('a dropped ticket is never done, so it still blocks its dependants', () => {
    const base = approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1');
    const reviewed: Record<string, string> = {
      ...base,
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
      'accord/tickets/T-1/review.md': 'verdict: converged\n',
    };
    const hash = acHash(loadSnapshot({ files: reviewed, tree: [] }).tickets['T-1'].scenarios) as string;
    const ticked = setFrontmatterKey(setFrontmatterKey(reviewed[T1], 'verified', ['ac-1', 'ac-2']), 'verified_hash', hash);
    const T2 = { 'accord/tickets/T-2.md': laneTicket('T-2', { frontmatter: ['depends_on: ["T-1"]'] }) };
    const done = { ...reviewed, [T1]: ticked, ...T2 };
    expect(rows(done).find((r) => r.id === 'T-1')?.stage).toBe('done');
    expect(rows(done).find((r) => r.id === 'T-2')?.blockedBy).toEqual([]);
    const dropped = { ...done, [T1]: setFrontmatterKey(ticked, 'status', 'dropped') };
    expect(rows(dropped).find((r) => r.id === 'T-1')?.stage).toBe('done');
    expect(rows(dropped).find((r) => r.id === 'T-2')?.blockedBy).toEqual(['T-1']);
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

const NOW = 2_000_000_000;
const DAY = 86400;
// Build-stage lane tickets (approved, plan, one task done), each idle its given whole days plus an hour.
const idle = (config: string, ages: Record<string, number>) => {
  const files: Record<string, string> = { 'accord/config.yml': config };
  for (const id of Object.keys(ages)) {
    Object.assign(files, approved({ ...files, [`accord/tickets/${id}.md`]: laneTicket(id) }, id));
    files[`accord/tickets/${id}/plan.md`] = PLAN;
    files[`accord/tickets/${id}/ledger.md`] = '## Tasks\n- task 1 done abc1234\n';
  }
  const lastActivity = Object.fromEntries(Object.entries(ages).map(([id, d]) => [id, NOW - d * DAY - 3600]));
  return statusRows(loadSnapshot({ files, tree: [], lastActivity }), NOW);
};
const byId = (r: ReturnType<typeof idle>, id: string) => r.find((x) => x.id === id);

it('ac-3 the window comes from stale_days', () => {
  const r = idle(CONFIG + 'stale_days: "30"\n', { 'T-1': 18, 'T-2': 31 });
  expect(byId(r, 'T-1')?.stage).toBe('build');
  expect(byId(r, 'T-1')?.idleDays).toBeUndefined();
  expect(byId(r, 'T-2')?.idleDays).toBe(31);
});

it('ac-5 the default window is 14 days and idle means older than it', () => {
  const r = idle(CONFIG, { 'T-1': 14, 'T-2': 15 });
  expect(byId(r, 'T-1')?.idleDays).toBeUndefined();
  expect(byId(r, 'T-2')?.idleDays).toBe(15);
});

it('ac-4 finished and closed tickets are never idle', () => {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  const add = (id: string, opts: Parameters<typeof laneTicket>[1] = {}) => {
    Object.assign(files, approved({ ...files, [`accord/tickets/${id}.md`]: laneTicket(id, opts) }, id));
    files[`accord/tickets/${id}/plan.md`] = PLAN;
    files[`accord/tickets/${id}/ledger.md`] = '## Tasks\n- task 1 done abc1234\n';
  };
  add('T-DONE');
  files['accord/tickets/T-DONE/ledger.md'] = '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/T-DONE/review.md'] = 'verdict: converged\n';
  const hash = acHash(loadSnapshot({ files, tree: [] }).tickets['T-DONE'].scenarios) as string;
  const t = 'accord/tickets/T-DONE.md';
  files[t] = setFrontmatterKey(setFrontmatterKey(files[t], 'verified', ['ac-1', 'ac-2']), 'verified_hash', hash);
  add('T-DROP', { frontmatter: ['status: dropped'] });
  add('T-ARCH', { frontmatter: ['status: archived'] });
  files['accord/tickets/T-FREE.md'] = laneTicket('T-FREE', { lane: '' }); // D-05: no lane, never idle
  const ids = ['T-DONE', 'T-DROP', 'T-ARCH', 'T-FREE'];
  const lastActivity = Object.fromEntries(ids.map((id) => [id, NOW - 100 * DAY]));
  const r = statusRows(loadSnapshot({ files, tree: [], lastActivity }), NOW);
  expect(r.map((x) => x.id).sort()).toEqual([...ids].sort());
  expect(byId(r, 'T-DONE')?.stage).toBe('done');
  expect(r.filter((x) => x.idleDays !== undefined)).toEqual([]);
});

it('risk:complex-branching a lane row carries its claim branch or the name a new claim would use', () => {
  const files = { 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1'), 'accord/tickets/L-1.md': laneTicket('L-1', { lane: '' }) };
  const of = (extra: Record<string, unknown>) => {
    const all = statusRows(loadSnapshot({ files, tree: [], ...extra }));
    return [all.find((r) => r.id === 'T-1'), all.find((r) => r.id === 'L-1')];
  };
  const [t, l] = of({});
  expect(t?.branch).toBe('t/T-1');
  expect(l).not.toHaveProperty('branch');
  expect(of({ claimTemplate: 'feature/{id}' })[0]?.branch).toBe('feature/T-1');
  expect(of({ claimTemplate: 'feature/{id}', claims: { 'T-1': 'an@example.test' }, claimBranches: { 'T-1': 't/T-1' } })[0]?.branch).toBe('t/T-1');
});

it('risk:complex-branching the ready commit decides only plan versus build', () => {
  const ap = { ...approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1'), 'accord/tickets/T-1/plan.md': PLAN };
  const stage = (planFacts?: Record<string, { subject?: string; clean: boolean }>, files = ap) =>
    statusRows(loadSnapshot({ files, tree: [], ...(planFacts === undefined ? {} : { planFacts }) }))[0];
  expect(stage()).toMatchObject({ stage: 'build', tasksDone: 0, tasksTotal: 2 });
  expect(stage({}).stage).toBe('plan');
  expect(stage({ 'T-1': { subject: 'plan: T-1 round 1, 1 Must, 0 Should', clean: true } }).stage).toBe('plan');
  expect(stage({ 'T-1': { subject: 'plan: T-1 ready', clean: false } }).stage).toBe('plan');
  expect(stage({ 'T-1': { subject: 'plan: T-1 ready ', clean: true } }).stage).toBe('plan');
  expect(stage({ 'T-1': { subject: 'plan: T-1 ready', clean: true } })).toMatchObject({ stage: 'build', tasksDone: 0, tasksTotal: 2 });
  const one = { ...ap, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' };
  const both = { ...ap, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n' };
  expect(stage({}, both).stage).toBe('review');
  const row = stage({}, one);
  expect(row).toMatchObject({ stage: 'plan', tasksDone: 1 });
  expect(nextRows([{ ...row, ready: 'ok' }])).toEqual([]);
  expect(nextRows([{ ...stage({}), ready: 'ok' }])).toHaveLength(1);
});

it('risk:parsing an intent of comments or a template scenario only criteria block reads as unwritten', () => {
  const INTERVIEW = 'the intent interview (accord-intent)';
  const APPROVE = 'the owner approves the ticket (accord approve)';
  const TPL = ['```gherkin', 'Feature: T-1', '', '  @ac-1', '  Scenario: <observable outcome>', '    Given ...', '    When ...', '    Then ...'];
  const OTHER = ['', '  @ac-2', '  Scenario: another', '    Given a', '    When b', '    Then c'];
  const withBody = (body: string) => rows({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1', { body }) })[0];
  const body = (intent: string[] | undefined, gherkin: string[]) =>
    [...(intent === undefined ? [] : ['## Intent', ...intent, '']), '## Acceptance criteria', ...gherkin, '```', ''].join('\n');
  expect(withBody(body(['<!-- why, for whom -->', ''], [...TPL, ...OTHER])).next).toBe(INTERVIEW);
  expect(withBody(body(undefined, [...TPL, ...OTHER])).next).toBe(INTERVIEW);
  expect(withBody(body(['Real intent.'], ['```gherkin', 'Feature: T-1'])).next).toBe(INTERVIEW);
  expect(withBody(body(['Real intent.'], TPL)).next).toBe(INTERVIEW);
  expect(withBody(body(['Real intent.'], [...TPL, ...OTHER])).next).toBe(APPROVE);
  expect(rows({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') })[0].next).toBe(APPROVE);
  const ap = approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1');
  expect(rows(ap)[0]).not.toHaveProperty('next');
});
