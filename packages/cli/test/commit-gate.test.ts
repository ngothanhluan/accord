// Phase 8.1 G1 (D-06, D-07): task-done and gate done refuse a ticket-branch commit that breaks commits.message, each refusal naming its fix; lint and
// `accord subject people` cover the bookkeeping subjects. Real git in tmp sandboxes; nothing here reaches the real origin.
import { existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { COMMIT_MESSAGE_FROM } from '@accord-dev/accord-core';
import { CONFIG, writeReport } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, commitAll, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';

const PRESET = CONFIG + 'commits:\n  message:\n    preset: conventional\n';
const PATTERN = CONFIG + "commits:\n  message:\n    pattern: '^[A-Z]+-\\d+ '\n    example: 'ABC-1 add x'\n";
const LEDGER = 'accord/tickets/T-1/ledger.md';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

const fresh = (repo: string): void => {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(repo, 'reports', 'junit.xml'), later, later);
  for (const n of [1, 2]) writeReport(repo, 'T-1', n); // the executor report task-done asks for from 0.6.0
};

/** A lane ticket whose default ref holds the fixture commit, claimed under `pin`: the claim commit is the first commit of the branch. */
function claimed(config: string, pin: string): string {
  const repo = makeLaneRepo({ 'accord/config.yml': config });
  repos.push(repo);
  const base = commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  claimedUnder(repo, pin);
  return repo;
}

const rows = (out: string): { rule: string; level: string; reason: string }[] =>
  (JSON.parse(out) as { findings: { rule: string; level: string; reason: string }[] }).findings.filter((f) => f.rule === 'gate.commit-message');

it('risk:complex-branching task-done refuses a task whose commit breaks the commit rule and names it (8.1-ac-6)', async () => {
  const repo = claimed(PATTERN, COMMIT_MESSAGE_FROM);
  const bad = commitMsg(repo, 'added coupon', undefined, true);
  fresh(repo);
  const r = await run(['task-done', 'T-1', '1'], repo);
  expect(r.code, r.out + r.err).toBe(1);
  expect(r.out.startsWith('task 1 of T-1 is not done:\n')).toBe(true);
  expect(r.out).toContain(bad.slice(0, 8));
  expect(r.out).toContain('added coupon');
  expect(existsSync(join(repo, LEDGER))).toBe(false);
}, 120_000);

it('risk:complex-branching gate done refuses a branch commit that breaks the rule and passes merge default-branch and Revert commits (8.1-ac-6)', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': PRESET });
  repos.push(repo);
  // the fixture commit breaks the preset, but it is on the default ref: exempt
  const base = commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  // a side branch holding a breaking commit, merged by a merge commit whose own subject breaks the preset: exempt
  gitRun(repo, 'switch', '-q', '-c', 'side', base);
  commitMsg(repo, 'added on the side', undefined, true);
  gitRun(repo, 'switch', '-q', '-');
  mergeMsg(repo, 'side', 'merge side');
  claimedUnder(repo, COMMIT_MESSAGE_FROM); // the claim commit passes the preset
  commitMsg(repo, 'Revert "feat(cart): add coupon field"', undefined, true);
  const clean = await run(['gate', 'done', 'T-1', '--json'], repo);
  expect(rows(clean.out), clean.out + clean.err).toEqual([]);

  const bad = commitMsg(repo, 'added coupon', undefined, true);
  const found = rows((await run(['gate', 'done', 'T-1', '--json'], repo)).out);
  expect(found).toHaveLength(1);
  expect(found[0].level).toBe('error');
  expect(found[0].reason).toContain(bad.slice(0, 8));
  expect(found[0].reason).toContain('commits.message.preset conventional');
}, 120_000);

it('risk:regression a ticket claimed before the commit-rule cut-off is refused by neither task-done nor gate done (8.1-ac-6)', async () => {
  const repo = claimed(PATTERN, '0.8.0');
  commitMsg(repo, 'added coupon', undefined, true);
  fresh(repo);
  const gate = await run(['gate', 'done', 'T-1', '--json'], repo);
  expect(rows(gate.out), gate.out + gate.err).toEqual([]);
  // the task is recorded at HEAD, which is the breaking commit, so its sha is printed; its subject and the rule are not
  const task = await run(['task-done', 'T-1', '1'], repo);
  expect(task.code, task.out + task.err).toBe(0);
  expect(task.out + task.err).not.toContain('added coupon');
  expect(task.out + task.err).not.toContain('commits.message.pattern');
}, 120_000);

it('risk:complex-branching every commit-rule refusal names its fix for a code commit and for a subject accord wrote (D-07)', async () => {
  const repo = claimed(PATTERN, COMMIT_MESSAGE_FROM);
  commitMsg(repo, 'added coupon', undefined, true);
  fresh(repo);
  const task = await run(['task-done', 'T-1', '1'], repo);
  expect(task.code, task.out + task.err).toBe(1);
  // the claim commit (accord's own subject) and the code commit: one line each
  const lines = task.out.split('\n').map((l) => l.trim()).filter((l) => l.includes(' - fix: '));
  expect(lines).toHaveLength(2);
  for (const line of lines) {
    for (const part of [' - fix: ', 'reword', 'accord commit check', 'commits.subjects', 'accord lint', 'accord subject']) expect(line, part).toContain(part);
  }
  // gate done reports the same text, one finding per commit
  const gate = rows((await run(['gate', 'done', 'T-1', '--json'], repo)).out).map((f) => f.reason);
  expect([...gate].sort()).toEqual([...lines].sort());
}, 120_000);

it('risk:parsing the people subject comes from commits.subjects.people and lint names it (D-06)', async () => {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': PATTERN });
  const plain = await run(['subject', 'people', 'dev@example.com'], repo);
  expect([plain.code, plain.out.trim()], plain.out + plain.err).toEqual([0, 'people: dev@example.com']);
  const lint = await run(['lint'], repo);
  expect(lint.out).toContain('commits.subjects.people');
  expect(lint.out).toContain('commits.subjects.claim');
  expect(lint.out).not.toContain('commits.subjects.drop');
  expect(lint.out).not.toContain('commits.subjects.queue');

  writeFiles(repo, { 'accord/config.yml': PATTERN + "  subjects:\n    people: 'ABC-0 people {id}'\n" });
  const set = await run(['subject', 'people', 'dev@example.com'], repo);
  expect([set.code, set.out.trim()], set.out + set.err).toEqual([0, 'ABC-0 people dev@example.com']);
  writeFiles(repo, { 'msg.txt': set.out });
  const check = await run(['commit', 'check', join(repo, 'msg.txt')], repo);
  expect(check.code, check.out + check.err).toBe(0);

  const notEmail = await run(['subject', 'people', 'T-1'], repo);
  expect(notEmail.code).toBe(2);
  expect(notEmail.err).toContain('email');
  const other = await run(['subject', 'claim', 'dev@example.com'], repo);
  expect(other.code).toBe(2);
}, 120_000);
