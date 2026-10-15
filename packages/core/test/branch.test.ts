import { expect, it } from 'vitest';
import { branchTemplateOf } from '../src/status/branch.js';

it('risk:parsing branchTemplateOf reads only branch and never throws', () => {
  expect(branchTemplateOf('')).toBeUndefined();
  expect(branchTemplateOf('branch: [\n')).toBeUndefined();
  expect(branchTemplateOf('branch: [a]\n')).toBeUndefined();
  expect(branchTemplateOf('profile: build\n')).toBeUndefined();
  expect(branchTemplateOf('branch: "feature/{id}"\nunknown: 1\n')).toBe('feature/{id}');
});
