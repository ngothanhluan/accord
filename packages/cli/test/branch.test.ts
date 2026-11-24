import { expect, it } from 'vitest';
import { ticketOfBranch } from '../src/load/fs.js';

it('risk:parsing ticketOfBranch matches a whole branch name against each template', () => {
  const none = () => false;
  const both = ['t/{id}', 'feature/{id}'];
  expect(ticketOfBranch('feature/ST-1', both, none)).toBe('ST-1');
  expect(ticketOfBranch('t/ST-1', both, none)).toBe('ST-1');
  for (const n of ['feature/ST-1/x', 'feature/', 'xfeature/ST-1', 'main']) expect(ticketOfBranch(n, both, none)).toBeUndefined();
  expect(ticketOfBranch('t/x-ST-1', ['t/{id}', 't/x-{id}'], none)).toBe('x-ST-1');
  const overlap = ['t/{id}', 'a-{id}', 'a-b-{id}'];
  expect(ticketOfBranch('a-b-ST-1', overlap, (id) => id === 'ST-1')).toBe('ST-1');
  expect(ticketOfBranch('a-b-ST-1', overlap, none)).toBe('b-ST-1');
  expect(ticketOfBranch('main', ['main'], none)).toBeUndefined();
  expect(ticketOfBranch('a-b', ['{id}-{id}'], none)).toBeUndefined();
});

// Issue #341 D-07a, D-11: the templates arrive expanded by the listed words, and the config chooses among a hyphenated name's ids.
import { branchTypesOf, expandBranchTypes } from '@accord-dev/accord-core';

it('risk:parsing ticketOfBranch reads a {type}/{id}-{slug} name under listed words only and chooses the id by the repository shape', () => {
  const none = () => false;
  const expanded = expandBranchTypes(['t/{id}', '{type}/{id}-{slug}'], branchTypesOf(undefined));
  const people = { people: { 'a@x.test': 'LN' } };
  expect(ticketOfBranch('fix/ST-AB-5-add-retries', expanded, none, people)).toBe('ST-AB-5');
  expect(ticketOfBranch('fix/ST-AB-5-add-retries', expanded, (id) => id === 'ST-AB', people)).toBe('ST-AB');
  expect(ticketOfBranch('fix/ST-AB-5-add-retries', expanded, none)).toBe('ST');
  const tracker = { ids: { mode: 'tracker' as const, projects: ['CSA'] } };
  expect(ticketOfBranch('fix/CSA-185-404-page', expanded, none, tracker)).toBe('CSA-185');
  expect(ticketOfBranch('wip/ST-1-x', expanded, none)).toBeUndefined();
  expect(ticketOfBranch('t/ST-1', expanded, none)).toBe('ST-1');
  // the D-11 consequence the owner accepted: a word that left branch_types is no claim
  expect(ticketOfBranch('fix/ST-9-export', expandBranchTypes(['t/{id}', '{type}/{id}-{slug}'], ['feat']), none)).toBeUndefined();
});
