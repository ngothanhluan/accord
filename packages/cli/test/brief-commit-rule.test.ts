// Phase 8.1 G1 (D-05, D-06): the executor brief and `accord anchor` print the commit rule with a passing example before an agent commits; with no commits.message both are
// byte for byte what they were. Real files in tmp sandboxes; nothing here reaches the real origin.
import { afterEach, expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const PRESET = CONFIG + 'commits:\n  message:\n    preset: conventional\n';
const PATTERN = CONFIG + "commits:\n  message:\n    pattern: '^[A-Z]+-\\d+ '\n    example: 'ABC-12 fix cart'\n";
const SCRIPT = PATTERN + '    command: node scripts/message.mjs\n';
const SLOW = CONFIG + "commits:\n  message:\n    pattern: '(a+)+$'\n    example: aaa\n";

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

function sandbox(): string {
  const repo = makeLaneRepo();
  repos.push(repo);
  claimedUnder(repo, '0.5.1'); // a ticket claimed before 0.6.0 gets no report lines, so the brief holds only the part under test
  return repo;
}

it('risk:regression the executor brief names the commit rule and a passing example (8.1-ac-4)', async () => {
  const repo = sandbox();
  const plain = await run(['brief', 'T-1', '2'], repo);
  expect(plain.code, plain.err).toBe(0);

  writeFiles(repo, { 'accord/config.yml': PRESET });
  const preset = await run(['brief', 'T-1', '2'], repo);
  expect(preset.code, preset.err).toBe(0);
  expect(preset.out.startsWith(plain.out), 'the tail is appended, nothing before it changes').toBe(true);
  const tail = preset.out.slice(plain.out.length);
  for (const part of ['commits.message.preset conventional', 'feat(cart): add coupon field', 'accord commit check']) expect(tail, part).toContain(part);
  expect(tail).not.toContain('accord commit message');

  writeFiles(repo, { 'accord/config.yml': PATTERN });
  const pattern = await run(['brief', 'T-1', '2'], repo);
  const patternTail = pattern.out.slice(plain.out.length);
  for (const part of ['commits.message.pattern /^[A-Z]+-\\d+ /', 'ABC-12 fix cart', 'accord commit check']) expect(patternTail, part).toContain(part);

  writeFiles(repo, { 'accord/config.yml': SCRIPT });
  const script = await run(['brief', 'T-1', '2'], repo);
  expect(script.out.slice(plain.out.length)).toContain('accord commit message T-1');

  // no rule: byte for byte today's brief
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  expect((await run(['brief', 'T-1', '2'], repo)).out).toBe(plain.out);
}, 120_000);

it('risk:regression accord anchor prints the commit rule before every stage commits in every tool (D-06)', async () => {
  const repo = makeLaneRepo();
  repos.push(repo);
  const plain = await run(['anchor', 'T-1'], repo);
  expect(plain.code, plain.err).toBe(0);
  expect(plain.out).not.toContain('Commit rule:');

  writeFiles(repo, { 'accord/config.yml': PRESET });
  const preset = await run(['anchor', 'T-1'], repo);
  const lines = preset.out.split('\n');
  const rule = lines.filter((l) => l.startsWith('Commit rule:'));
  expect(rule).toHaveLength(1);
  for (const part of ['commits.message.preset conventional', 'feat(cart): add coupon field', 'accord commit check']) expect(rule[0], part).toContain(part);
  // in the header: after the Stage line, before the first section
  const at = lines.indexOf(rule[0]);
  expect(at).toBeGreaterThan(lines.findIndex((l) => l.startsWith('Stage:')));
  expect(at).toBeLessThan(lines.findIndex((l) => l.startsWith('## ')));
  // the same text is the base of today's: removing the line gives it back
  expect(lines.filter((l) => !l.startsWith('Commit rule:')).join('\n')).toBe(plain.out);

  // a pattern that is not in force is named, with where to look
  writeFiles(repo, { 'accord/config.yml': SLOW });
  const slow = (await run(['anchor', 'T-1'], repo)).out.split('\n').filter((l) => l.startsWith('Commit rule:'));
  expect(slow).toHaveLength(1);
  expect(slow[0]).toContain('accord lint');

  // no rule: byte for byte today's anchor
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  expect((await run(['anchor', 'T-1'], repo)).out).toBe(plain.out);
}, 120_000);
