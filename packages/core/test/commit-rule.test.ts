// Phase 8.1 G1 (D-04, D-05): the commit-message rule, judged by one pure function for every caller.
import { expect, it } from 'vitest';
import { commitRuleOf, commitRuleProblem } from '../src/index.js';
import type { AccordConfig, CommitRule } from '../src/index.js';

const withMessage = (message: NonNullable<AccordConfig['commits']>['message']): AccordConfig => ({ commits: { message } }) as AccordConfig;

const inForce = (config: AccordConfig): CommitRule => {
  const rule = commitRuleOf(config);
  if (rule === undefined || 'problem' in rule) throw new Error('expected a rule in force, got ' + JSON.stringify(rule));
  return rule;
};

it('risk:parsing the conventional preset passes feat(cart): add coupon field and fails added coupon (8.1-ac-4)', () => {
  const rule = inForce(withMessage({ preset: 'conventional' }));
  for (const ok of ['feat(cart): add coupon field', 'fix!: drop x', 'chore(accord): queue T-1', 'claim: T-1', 'FEAT(Cart): shouty is fine', 'feat: ok\n\nthe body is free text']) {
    expect(commitRuleProblem(rule, ok), ok).toBeUndefined();
  }
  const bad = commitRuleProblem(rule, 'added coupon');
  expect(bad).toContain('commits.message.preset conventional');
  expect(bad).toContain('"added coupon"');
  // only the first line is judged: a conforming second line does not rescue a breaking first one
  expect(commitRuleProblem(rule, 'added coupon\nfeat: x')).toContain('commits.message.preset conventional');
  // a byte order mark and CRLF are dropped first
  expect(commitRuleProblem(rule, '\uFEFFfeat: with a bom\r\n\r\nbody')).toBeUndefined();
  expect(commitRuleProblem(rule, 'feat: crlf\r\nbody')).toBeUndefined();
  // git's own revert subject passes
  expect(commitRuleProblem(rule, 'Revert "added coupon"\n\nThis reverts commit abc.')).toBeUndefined();
});

it('risk:parsing a team pattern judges the first line and names the pattern (8.1-ac-4)', () => {
  const rule = inForce(withMessage({ pattern: '^[A-Z]+-\\d+ ', example: 'ABC-12 fix cart' }));
  expect(rule.example).toBe('ABC-12 fix cart');
  expect(commitRuleProblem(rule, 'ABC-12 fix cart')).toBeUndefined();
  expect(commitRuleProblem(rule, 'fix cart')).toContain('commits.message.pattern /^[A-Z]+-\\d+ /');
  expect(inForce(withMessage({ preset: 'conventional' })).example).toBe('feat(cart): add coupon field');
  expect(commitRuleOf({} as AccordConfig)).toBeUndefined();
  expect(commitRuleOf(undefined)).toBeUndefined();
});

it('risk:security a commit pattern the guard refuses is not in force (D-04)', () => {
  const slow = commitRuleOf(withMessage({ pattern: '(a+)+$', example: 'aaa' }));
  expect(slow !== undefined && 'problem' in slow ? slow.problem : '').toContain('more than one way');
  const broken = commitRuleOf(withMessage({ pattern: '(', example: 'x' }));
  expect(broken !== undefined && 'problem' in broken ? broken.problem : '').toContain('does not compile');
});
