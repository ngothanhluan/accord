// ST-LN-50 D-06 (t2-ac-3): commit subjects are templates with one `{id}`; accord renders the current one and matches the current and the legacy ones exactly.
import { expect, it } from 'vitest';
import { DEFAULT_SUBJECTS, lintSnapshot, loadSnapshot, matchesSubject, renderSubject, statusRows, SUBJECT_NAMES, subjectsFor, validate } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';
import { approved } from './helpers/approve.js';

const BASE = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude'],
} as const;
const cfg = (commits: NonNullable<AccordConfig['commits']>): AccordConfig => ({ ...BASE, commits }) as unknown as AccordConfig;
const at = (commits: object) => validate('config', { ...BASE, commits }).map((f) => `${f.rule}@${f.pointer}`);

it('risk:complex-branching subject templates render and match exactly (ST-LN-50 t2-ac-3)', () => {
  // With no config every name renders today's text.
  const today = {
    claim: 'claim: ST-1',
    plan_ready: 'plan: ST-1 ready',
    plan_round: 'plan: ST-1',
    approach_round: 'approach: ST-1',
    intent: 'intent: ST-1',
    ticket_understood: 'ticket: ST-1 understood',
    ticket_question: 'ticket: ST-1 question',
    scout: 'scout: ST-1 report',
    drop: 'drop: ST-1',
    rebind: 'verify: ST-1 rebound after rebase',
    ruleset_backfill: 'ruleset: ST-1 from its claim commit',
  };
  expect([...SUBJECT_NAMES]).toEqual(Object.keys(today));
  for (const name of SUBJECT_NAMES) {
    expect(renderSubject(undefined, name, 'ST-1'), name).toBe(today[name]);
    expect(renderSubject({ ...BASE } as unknown as AccordConfig, name, 'ST-1'), name).toBe(today[name]);
    expect(DEFAULT_SUBJECTS[name].replace('{id}', 'ST-1'), name).toBe(today[name]);
    expect(subjectsFor(undefined, name, 'ST-1'), name).toEqual([today[name]]);
  }

  // A template renders its subject; the current one comes first, then each legacy one, unique.
  const c = cfg({ subjects: { claim: 'chore(accord): claim {id}' }, legacy_subjects: { claim: ['claim: {id}', 'chore(accord): claim {id}', 'accord claim {id}', 'claim: {id}'] } });
  expect(renderSubject(c, 'claim', 'ST-1')).toBe('chore(accord): claim ST-1');
  expect(subjectsFor(c, 'claim', 'ST-1')).toEqual(['chore(accord): claim ST-1', 'claim: ST-1', 'accord claim ST-1']);
  // A name with no template of its own keeps its default and reads only its own legacy list.
  expect(subjectsFor(c, 'plan_ready', 'ST-1')).toEqual(['plan: ST-1 ready']);

  // An id with a `$` pattern in it is placed as written.
  expect(renderSubject(cfg({ subjects: { claim: 'claim {id}!' } }), 'claim', "A-$&1")).toBe('claim A-$&1!');

  // Exact comparison: `claim: ST-1` is never a claim of ST-10, under any template.
  expect(matchesSubject(c, 'claim', 'ST-1', 'claim: ST-10')).toBe(false);
  expect(matchesSubject(c, 'claim', 'ST-1', 'claim: ST-1')).toBe(true);
  expect(matchesSubject(c, 'claim', 'ST-1', 'chore(accord): claim ST-10')).toBe(false);
  expect(matchesSubject(c, 'claim', 'ST-1', 'chore(accord): claim ST-1')).toBe(true);
  expect(matchesSubject(c, 'claim', 'ST-1', 'chore(accord): claim ST-1 ')).toBe(false);
  expect(matchesSubject(c, 'claim', 'ST-1', 'Claim: ST-1')).toBe(false);
  expect(matchesSubject(c, 'claim', 'ST-10', 'claim: ST-1')).toBe(false);

  // A free tail follows the rendered template after one space, so every default renders today's text.
  expect(renderSubject(undefined, 'plan_round', 'ST-1', 'round 2, 1 Must, 0 Should')).toBe('plan: ST-1 round 2, 1 Must, 0 Should');
  expect(renderSubject(cfg({ subjects: { plan_round: 'plan({id})' } }), 'plan_round', 'ST-1', 'round 2')).toBe('plan(ST-1) round 2');
  expect(renderSubject(undefined, 'plan_round', 'ST-1', '')).toBe('plan: ST-1');
});

it('risk:parsing commits.subjects templates hold {id} once and no other brace, line break or leading dash (ST-LN-50 t2-ac-3)', () => {
  expect(at({ subjects: { claim: 'chore(accord): claim {id}' } })).toEqual([]);
  expect(at({ subjects: { claim: 'claim: {id}', plan_ready: 'plan: {id} ready' }, legacy_subjects: { claim: ['claim: {id}', 'accord claim {id}'] } })).toEqual([]);
  for (const bad of ['claim', '{id}', '{id} {id}', '-x {id}', 'a {b} {id}', 'a\n{id}', 'a {id}\n', 'a\r{id}', ' a {id}', 'a {id} ', 'a } {id}', '']) {
    expect(at({ subjects: { claim: bad } }), JSON.stringify(bad)).not.toEqual([]);
    expect(at({ legacy_subjects: { claim: [bad] } }), JSON.stringify(bad)).not.toEqual([]);
  }
  // Only the eleven names are keys; a legacy list holds distinct entries.
  expect(at({ subjects: { unknown: 'x {id}' } })).not.toEqual([]);
  expect(at({ legacy_subjects: { unknown: ['x {id}'] } })).not.toEqual([]);
  expect(at({ legacy_subjects: { claim: ['claim: {id}', 'claim: {id}'] } })).toContain('schema.uniqueItems@/commits/legacy_subjects/claim');
  for (const name of SUBJECT_NAMES) expect(at({ subjects: { [name]: DEFAULT_SUBJECTS[name] }, legacy_subjects: { [name]: [DEFAULT_SUBJECTS[name]] } }), name).toEqual([]);
});

// ST-LN-50 D-06 (t2-ac-3, the plan-ready half): planReady reads the current and the legacy plan_ready subjects, each compared exactly.
const T1 = 'accord/tickets/T-1.md';
const withCommits = (commits: string): string => CONFIG + commits;
const stageOf = (config: string, subject: string | undefined): string | undefined => {
  const files = { ...approved({ 'accord/config.yml': config, [T1]: laneTicket('T-1') }, 'T-1'), 'accord/tickets/T-1/plan.md': PLAN };
  const planFacts: Record<string, { subject?: string; clean: boolean }> = subject === undefined ? {} : { 'T-1': { subject, clean: true } };
  return statusRows(loadSnapshot({ files, tree: [], planFacts })).find((r) => r.id === 'T-1')?.stage;
};

it('risk:complex-branching plan ready is read under the current and old templates (ST-LN-50 t2-ac-3)', () => {
  const changed = withCommits('commits:\n  subjects:\n    plan_ready: "chore(accord): plan {id} ready"\n');
  const listed = withCommits('commits:\n  subjects:\n    plan_ready: "chore(accord): plan {id} ready"\n  legacy_subjects:\n    plan_ready:\n      - "plan: {id} ready"\n');
  // today's subject with no template
  expect(stageOf(CONFIG, 'plan: T-1 ready')).toBe('build');
  // the current template is past plan
  expect(stageOf(changed, 'chore(accord): plan T-1 ready')).toBe('build');
  expect(stageOf(listed, 'chore(accord): plan T-1 ready')).toBe('build');
  // a plan committed under the old subject stays past plan while the old template is listed, and goes back to plan when it is not
  expect(stageOf(listed, 'plan: T-1 ready')).toBe('build');
  expect(stageOf(changed, 'plan: T-1 ready')).toBe('plan');
  // exact: a neighbouring id, a trailing space and a round subject never make T-1 ready
  for (const subject of ['plan: T-10 ready', 'chore(accord): plan T-10 ready', 'plan: T-1 ready ', 'chore(accord): plan T-1 ready ', 'plan: T-1 round 1, 1 Must, 0 Should']) {
    expect(stageOf(listed, subject), subject).toBe('plan');
  }
  expect(stageOf(listed, undefined)).toBe('plan');
});

it('risk:complex-branching lint.subject-duplicate refuses two templates that render one subject where one is read back (ST-LN-50 t2-ac-3)', () => {
  const found = (commits: string): { pointer?: string; reason: string }[] =>
    lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': withCommits(commits) }, tree: [] })).findings.filter((f) => f.rule === 'lint.subject-duplicate');
  // distinct templates, and the defaults, pass
  expect(found('')).toEqual([]);
  expect(found('commits:\n  subjects:\n    claim: "chore(accord): claim {id}"\n    drop: "chore(accord): drop {id}"\n')).toEqual([]);
  // a claim and a drop that render alike fail, naming both names
  const two = found('commits:\n  subjects:\n    claim: "x {id}"\n    drop: "x {id}"\n');
  expect(two).toHaveLength(1);
  expect(two[0].reason).toContain('commits.subjects.claim');
  expect(two[0].reason).toContain('commits.subjects.drop');
  expect(two[0].reason).toContain('"x <id>"');
  expect(two[0].reason).toContain('a claim commit');
  expect(two[0].pointer).toBe('/commits/subjects/claim');
  // a plan_ready equal to the default plan_round fails (the default plan_round is a current template too)
  expect(found('commits:\n  subjects:\n    plan_ready: "plan: {id}"\n')).toHaveLength(1);
  // a legacy claim equal to the current scout template fails; a legacy of a write-only name is never read, so it passes
  const legacy = found('commits:\n  legacy_subjects:\n    claim:\n      - "scout: {id} report"\n');
  expect(legacy).toHaveLength(1);
  expect(legacy[0].reason).toContain('commits.legacy_subjects.claim');
  expect(legacy[0].reason).toContain('commits.subjects.scout');
  expect(found('commits:\n  legacy_subjects:\n    scout:\n      - "claim: {id}"\n')).toEqual([]);
  // a legacy claim equal to a legacy plan_ready fails (both are read back); two write-only names that agree are harmless
  expect(found('commits:\n  legacy_subjects:\n    claim:\n      - "same {id}"\n    plan_ready:\n      - "same {id}"\n')).toHaveLength(1);
  expect(found('commits:\n  subjects:\n    scout: "same {id}"\n    intent: "same {id}"\n')).toEqual([]);
  // a template that equals its own legacy entry is not a collision
  expect(found('commits:\n  subjects:\n    claim: "claim: {id}"\n  legacy_subjects:\n    claim:\n      - "claim: {id}"\n')).toEqual([]);
});
