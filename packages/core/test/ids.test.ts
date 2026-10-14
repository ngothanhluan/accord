import { expect, it } from 'vitest';
import { initialsHolder, peopleOf } from '../src/index.js';

it('risk:complex-branching the default branch decides who holds initials before any other ref', () => {
  const def = 'refs/remotes/origin/main';
  const other = 'refs/remotes/origin/t/x';
  expect(initialsHolder('AN', 'an@example.com', { [def]: { 'An@Example.com': 'AN' }, [other]: { 'bo@example.com': 'AN' } }, def)).toBeUndefined();
  expect(initialsHolder('AN', 'an@example.com', { [def]: { 'old@example.com': 'AN' }, [other]: { 'an@example.com': 'AN' } }, def)).toBe('old@example.com');
  expect(initialsHolder('AN', 'an@example.com', { [def]: { 'cy@example.com': 'CY' }, [other]: { 'bo@example.com': 'AN' } }, def)).toBe('bo@example.com');
  expect(initialsHolder('AN', 'an@example.com', { [other]: { 'bo@example.com': 'AN' } }, undefined)).toBe('bo@example.com');
  expect(initialsHolder('AN', 'an@example.com', { [other]: { 'an@example.com': 'AN' } }, undefined)).toBeUndefined();
  expect(initialsHolder('AN', 'an@example.com', {}, undefined)).toBeUndefined();
});

it('risk:parsing peopleOf reads only people and never throws', () => {
  expect(peopleOf('people: [\n  bad')).toBeUndefined();
  expect(peopleOf('profile: build\nunknown_key: 1\npeople: { "an@example.com": AN }\n')).toEqual({ 'an@example.com': 'AN' });
  expect(peopleOf('people: [AN]')).toBeUndefined();
  expect(peopleOf('people: { "an@example.com": true }')).toBeUndefined();
  expect(peopleOf('')).toBeUndefined();
});
