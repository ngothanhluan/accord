// ST-LN-50 D-06 (t2-ac-3): commit subjects are templates with one `{id}`; accord renders the current one and matches the current and the legacy ones exactly.
import { expect, it } from 'vitest';
import { DEFAULT_SUBJECTS, matchesSubject, renderSubject, SUBJECT_NAMES, subjectsFor, validate } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

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
