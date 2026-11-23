// Phase 8.1 G1 (D-04, D-05): the commit-message rule, judged by one pure function for every caller.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { COMMIT_MESSAGE_FROM, commitRuleOf, commitRuleProblem, gateDone, lintSnapshot, loadSnapshot, OFF_TICKET_BRANCH, SUBJECT_NAMES } from '../src/index.js';
import type { AccordConfig, CommitRule, RepoSnapshot } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

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

// --- gate done and lint (D-06, D-07) ---

const PRESET = CONFIG + 'commits:\n  message:\n    preset: conventional\n';
const PATTERN = CONFIG + "commits:\n  message:\n    pattern: '^[A-Z]+-\\d+ '\n    example: 'ABC-1 add x'\n";
const SHA = '0123456789abcdef0123456789abcdef01234567';

const snapshotOf = (config: string, pin?: string): RepoSnapshot => {
  const files = { 'accord/config.yml': config, 'accord/tickets/T-1.md': laneTicket('T-1') };
  const snap = loadSnapshot({ files, tree: Object.keys(files) });
  return pin === undefined ? snap : { ...snap, claimPins: { 'T-1': { pin } } };
};
const gateRows = (snap: RepoSnapshot) => gateDone(snap, 'T-1').findings.filter((f) => f.rule === 'gate.commit-message');
const lintRows = (config: string) => lintSnapshot(snapshotOf(config)).findings.filter((f) => f.rule === 'lint.commit-rule');

it('risk:complex-branching the commit rule fails closed when commits were not loaded or the pattern is not in force (D-07)', () => {
  const miss = gateRows(snapshotOf(PRESET, COMMIT_MESSAGE_FROM));
  expect(miss).toHaveLength(1);
  expect(miss[0].reason).toContain('loaded no commits');
  expect(miss[0].reason).toContain('accord gate done');
  expect(miss[0].file).toBe('accord/config.yml');
  const slow = gateRows(snapshotOf(CONFIG + "commits:\n  message:\n    pattern: '(a+)+$'\n    example: aaa\n", COMMIT_MESSAGE_FROM));
  expect(slow).toHaveLength(1);
  expect(slow[0].reason).toContain('accord lint');
  // the cut-off: a ticket claimed before it, and a repository with no rule, are judged by neither
  expect(gateRows(snapshotOf(PRESET, '0.8.0'))).toEqual([]);
  expect(gateRows(snapshotOf(CONFIG, COMMIT_MESSAGE_FROM))).toEqual([]);
  // commits loaded: a breaking one is named with its fix, a merge commit and a Revert subject pass
  const loaded = (commits: NonNullable<RepoSnapshot['commits']>) => gateRows({ ...snapshotOf(PRESET, COMMIT_MESSAGE_FROM), commits });
  expect(loaded([])).toEqual([]);
  const bad = loaded([{ sha: SHA, message: 'added coupon\n' }]);
  expect(bad).toHaveLength(1);
  expect(bad[0].reason).toContain(SHA.slice(0, 8));
  expect(bad[0].reason).toContain(' - fix: ');
  expect(loaded([{ sha: SHA, message: 'Merge branch side\n', merge: true }])).toEqual([]);
  expect(loaded([{ sha: SHA, message: 'Revert "added coupon"\n' }])).toEqual([]);
});

it('risk:parsing lint names a bookkeeping subject the commit rule breaks (8.1-ac-5)', () => {
  const rows = lintRows(PATTERN);
  const claim = rows.find((f) => f.pointer === '/commits/subjects/claim');
  expect(claim?.reason).toContain('commits.subjects.claim');
  expect(claim?.reason).toContain('accord config set commits.subjects.claim');
  expect(claim?.level).toBe('error');
  // the preset is shaped so every default subject passes it
  expect(lintRows(PRESET)).toEqual([]);
  expect(lintRows(CONFIG)).toEqual([]);
  // an example that breaks its own pattern is reported where it is written
  const own = lintRows(CONFIG + "commits:\n  message:\n    pattern: '^[A-Z]+-\\d+ '\n    example: 'fix cart'\n");
  expect(own.map((f) => f.pointer)).toContain('/commits/message/example');
  // a pattern that is not in force is reported once, at the pattern
  expect(lintRows(CONFIG + "commits:\n  message:\n    pattern: '(a+)+$'\n    example: aaa\n").map((f) => f.pointer)).toEqual(['/commits/message/pattern']);
});

it('risk:complex-branching lint judges only the subjects committed on ticket branches (D-06)', () => {
  const pointers = lintRows(PATTERN)
    .map((f) => f.pointer ?? '')
    .filter((p) => p.startsWith('/commits/subjects/'))
    .map((p) => p.slice('/commits/subjects/'.length));
  const judged = SUBJECT_NAMES.filter((n) => !OFF_TICKET_BRANCH.includes(n));
  expect([...pointers].sort()).toEqual([...judged].sort());
  expect(pointers).toContain('people');
  for (const off of OFF_TICKET_BRANCH) expect(pointers, off).not.toContain(off);
});

// --- the worktree skill (D-06, plan check W2): read at the session check that starts every New request, in every lane and every tool ---

it('risk:regression the worktree skill tells every ticket-branch commit to pass the commit rule (D-06)', () => {
  const source = readFileSync(fileURLToPath(new URL('../skills/accord/worktree.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  const people = source.indexOf('accord subject people <email>');
  const check = source.indexOf('## Session check');
  expect(people, 'the people commit takes its subject from accord subject people').toBeGreaterThan(-1);
  expect(source).not.toContain('commit -m "people: <email>"');
  expect(check, 'the commit-rule paragraph comes before the session check').toBeGreaterThan(people);
  const between = source.slice(people, check);
  for (const phrase of ['commits.message', 'accord commit check', 'git commit -F']) expect(between, phrase).toContain(phrase);
});

// --- CR-01 / T-08.1-03: the subject is cut at the scan limit, so a guard-accepted quadratic pattern cannot hang a gate ---

const HOSTILE = '('.repeat(80000);
const QUADRATIC = { pattern: String.raw`\(.*\): .+`, example: '(x): y' };

it('risk:security a first line over the scan limit fails the rule at once and names the fix, never hangs (CR-01)', () => {
  const rule = inForce(withMessage(QUADRATIC));
  const started = Date.now();
  const problem = commitRuleProblem(rule, HOSTILE + '\n\nbody');
  expect(Date.now() - started).toBeLessThan(500);
  expect(problem).toContain('80000 characters');
  expect(problem).toContain('shorten the first line');
  // the preset is bounded the same way
  expect(commitRuleProblem(inForce(withMessage({ preset: 'conventional' })), 'feat: ' + 'x'.repeat(2000))).toContain('shorten the first line');
  // a subject at the limit is still judged by the pattern
  expect(commitRuleProblem(rule, '(' + 'x'.repeat(900) + '): ok')).toBeUndefined();
});

it('risk:security gate.commit-message reports an over-long subject without hanging (CR-01)', () => {
  const config = CONFIG + 'commits:\n  message:\n    pattern: ' + JSON.stringify(QUADRATIC.pattern) + "\n    example: '(x): y'\n";
  const snap = { ...snapshotOf(config, COMMIT_MESSAGE_FROM), commits: [{ sha: SHA, message: HOSTILE + '\n' }] };
  const started = Date.now();
  const rows = gateRows(snap);
  expect(Date.now() - started).toBeLessThan(500);
  expect(rows).toHaveLength(1);
  expect(rows[0].reason).toContain('shorten the first line');
});

// --- T-08.1-04: a subject template reaches the terminal through accord lint only with control and bidi characters written out ---

it('risk:security lint writes the rendered subject without a control or bidi character (T-08.1-04)', () => {
  const claim = JSON.stringify('claim \u001b[31m\u202Ehidden {id}');
  const config = PATTERN + '  subjects:\n    claim: ' + claim + '\n';
  const row = lintRows(config).find((f) => f.pointer === '/commits/subjects/claim');
  expect(row, 'the claim subject breaks the rule').toBeDefined();
  // eslint-disable-next-line no-control-regex
  expect(row?.reason).not.toMatch(/[\u0000-\u001f\u007f\u202a-\u202e]/);
  expect(row?.reason).toContain('<U+001B>');
  expect(row?.reason).toContain('<U+202E>');
});

// Phase 08.8 D-16 (IN-01): the revert exemption is git's own shape `Revert "<text>"` and nothing that only starts like it.
it('risk:security only git\'s own revert subject is exempt from the commit rule (D-16)', () => {
  const rule = inForce(withMessage({ pattern: '^[a-z]+: ', example: 'feat: x' }));
  expect(commitRuleProblem(rule, 'Revert "feat: x"\n\nThis reverts commit abc.')).toBeUndefined();
  for (const bad of ['Revert "wip', 'Revert "x" and more', 'Revert "']) expect(commitRuleProblem(rule, bad), bad).toContain('does not match');
});
