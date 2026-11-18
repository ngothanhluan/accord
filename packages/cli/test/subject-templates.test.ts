// ST-LN-50 D-06 (t2-ac-3, the claim half) on real git: a claim subject that comes from `commits.subjects.claim` is written by `worktree open` and
// `new ticket --worktree`, read back by the claim fact and the claimant check, and a claim under the old subject keeps its fact through
// `commits.legacy_subjects.claim`. Sandboxes with a bare remote, as worktree-open.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { loadConfig } from '@accord-dev/accord-core';
import type { AccordConfig } from '@accord-dev/accord-core';
import { gitClaimFacts } from '../src/load/claim-facts.js';
import type { StatusRow } from '@accord-dev/accord-core';
import { approve, P, type Files } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run } from './helpers/repo.js';
import { copy, type Clone, ME, PIN, teammate, useSandboxes } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ tickets: ['ST-1', 'ST-2', 'ST-9', 'ST-10', 'ST-11'] }, { tickets: [] }]);

const TEMPLATED = 'chore(accord): claim {id}';
const WITH_LEGACY = `commits:\n  subjects:\n    claim: "${TEMPLATED}"\n  legacy_subjects:\n    claim:\n      - "claim: {id}"\n`;
const NO_LEGACY = `commits:\n  subjects:\n    claim: "${TEMPLATED}"\n`;

/** Write `text` as main's config.yml, commit it and push it, so a claim cut from origin/main and the checkout both carry it; returns the parsed config. */
function commitConfig(c: Clone, text: string): AccordConfig {
  writeFileSync(`${c.root}/accord/config.yml`, text);
  commitMsg(c.root, 'config: commit subjects');
  c.git('push', '-q', 'origin', 'main');
  return loadConfig('accord/config.yml', text).config!;
}

const subject = (c: Clone, ref: string): string => c.git('log', '-1', '--format=%s', ref).trim();

it('risk:complex-branching a templated claim is written and read, and the old claim still counts (ST-LN-50 t2-ac-3)', async () => {
  const c = copy({ tickets: ['ST-1', 'ST-2', 'ST-9', 'ST-10', 'ST-11'] });
  // ST-2 is claimed before the team changes the template: the default subject.
  expect((await run(['worktree', 'open', 'ST-2'], c.root)).code).toBe(0);
  expect(subject(c, 't/ST-2')).toBe('claim: ST-2');

  const config = commitConfig(c, readFileSync(`${c.root}/accord/config.yml`, 'utf8') + WITH_LEGACY);
  const opened = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(opened.err).toBe('');
  expect(opened.code).toBe(0);
  expect(subject(c, 't/ST-9')).toBe('chore(accord): claim ST-9'); // written from the template
  expect(c.git('log', '--format=%s', 'origin/main..t/ST-9').trim()).toBe('chore(accord): claim ST-9');

  // The claim fact is read from the templated subject.
  const fresh = gitClaimFacts(c.sibling('ST-9'), 'ST-9', config);
  expect(fresh).toMatchObject({ sha: c.git('rev-parse', 't/ST-9').trim(), pin: PIN });
  expect(gitClaimFacts(c.sibling('ST-9'), 'ST-9')).toBeUndefined(); // with no template in hand only today's subject is looked for

  // ST-2, claimed under the old subject, keeps its claim fact (pin and clock) because the old template is listed.
  const old = gitClaimFacts(c.sibling('ST-2'), 'ST-2', config);
  expect(old).toMatchObject({ sha: c.git('rev-parse', 't/ST-2').trim(), pin: PIN });
  expect(old).toEqual(gitClaimFacts(c.sibling('ST-2'), 'ST-2')); // the same fact as before the change
  const unlisted = loadConfig('accord/config.yml', readFileSync(`${c.root}/accord/config.yml`, 'utf8').replace(WITH_LEGACY, NO_LEGACY)).config!;
  expect(gitClaimFacts(c.sibling('ST-2'), 'ST-2', unlisted)).toBeUndefined(); // it is the legacy list that keeps it

  // Exact match: a `claim: ST-10` commit is never the claim of ST-1, under either template.
  c.git('switch', '-q', '-c', 't/ST-1');
  c.git('commit', '-q', '--allow-empty', '-m', 'claim: ST-10');
  c.git('commit', '-q', '--allow-empty', '-m', 'chore(accord): claim ST-10');
  expect(gitClaimFacts(c.root, 'ST-1', config)).toBeUndefined();
  expect(gitClaimFacts(c.root, 'ST-10', config)).toMatchObject({ sha: c.git('rev-parse', 'HEAD').trim() });
  c.git('commit', '-q', '--allow-empty', '-m', 'chore(accord): claim ST-1');
  expect(gitClaimFacts(c.root, 'ST-1', config)).toMatchObject({ sha: c.git('rev-parse', 'HEAD').trim() });
});

it('risk:complex-branching the claimant is read from a templated or a legacy claim subject (ST-LN-50 t2-ac-3)', async () => {
  const c = copy({ tickets: ['ST-1', 'ST-2', 'ST-9', 'ST-10', 'ST-11'] });
  commitConfig(c, readFileSync(`${c.root}/accord/config.yml`, 'utf8') + WITH_LEGACY);
  const o = teammate(c);
  for (const [id, text] of [['ST-9', 'chore(accord): claim ST-9'], ['ST-10', 'claim: ST-10']] as const) {
    gitRun(o, 'switch', '-q', '-c', 't/' + id, 'main');
    gitRun(o, 'commit', '-q', '--allow-empty', '-m', text);
    gitRun(o, ...ME, 'commit', '-q', '--allow-empty', '-m', 'work'); // the branch tip is mine, so only the claim subject names the claimant
    gitRun(o, 'push', '-q', 'origin', 't/' + id);
  }
  c.git('fetch', '-q', 'origin');
  for (const id of ['ST-9', 'ST-10']) {
    const r = await run(['worktree', 'open', id], c.root);
    expect(r.code, id).toBe(2);
    expect(r.err.startsWith(`claimed: ${id} by y@example.invalid`), id).toBe(true);
  }
});

it('risk:complex-branching new ticket --worktree commits the templated claim subject (ST-LN-50 t2-ac-3)', async () => {
  const c = copy({ tickets: [] });
  commitConfig(c, readFileSync(`${c.root}/accord/config.yml`, 'utf8') + NO_LEGACY);
  const made = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree', '--no-dup-check'], c.root);
  expect(made.err).toBe('');
  expect(made.code).toBe(0);
  expect(subject(c, 't/ST-9')).toBe('chore(accord): claim ST-9');
});

// ST-LN-50 D-06 (t2-ac-3, the plan-ready half): `accord config` keeps the replaced template readable, `accord status` reads the plan-ready
// commit under both, `accord subject` prints the current subject and `accord drop` writes it.
const approveIn = (repo: string, id: string): void => {
  const files: Files = { [P(id)]: readFileSync(`${repo}/${P(id)}`, 'utf8') };
  approve(files, id);
  writeFileSync(`${repo}/${P(id)}`, files[P(id)]);
};
const stageIn = async (repo: string): Promise<string | undefined> => (JSON.parse((await run(['status', '--json'], repo)).out) as StatusRow[]).find((r) => r.id === 'T-1')?.stage;
const legacyOf = async (repo: string, name: string): Promise<unknown> => JSON.parse((await run(['config', 'get', `commits.legacy_subjects.${name}`, '--json'], repo)).out).value;

it('risk:complex-branching accord config keeps the old template and accord subject prints the current one (ST-LN-50 t2-ac-3)', async () => {
  const repo = makeLaneRepo();
  try {
    approveIn(repo, 'T-1');
    commitAll(repo, 'plan: T-1 ready'); // committed under the default subject, before any template is set
    expect(await stageIn(repo)).toBe('build');

    // Setting a template appends the replaced one, here the default because none was set, and the plan keeps its fact.
    const set = await run(['config', 'set', 'commits.subjects.plan_ready', 'chore(accord): plan {id} ready'], repo);
    expect(set.err).toBe('');
    expect(set.code).toBe(0);
    expect(set.out.split('\n')).toEqual(['changed: commits.subjects.plan_ready unset -> "chore(accord): plan {id} ready"', 'commits.legacy_subjects.plan_ready +"plan: {id} ready"', '']);
    expect(await legacyOf(repo, 'plan_ready')).toEqual(['plan: {id} ready']);
    expect((await run(['config', 'check'], repo)).code).toBe(0);
    expect(await stageIn(repo)).toBe('build'); // still past plan under the old subject
    expect((await run(['subject', 'plan_ready', 'T-1'], repo)).out).toBe('chore(accord): plan T-1 ready\n');

    // A second change appends the first template, not the default again; an unchanged value appends nothing.
    const again = await run(['config', 'set', 'commits.subjects.plan_ready', 'plan({id}): ready'], repo);
    expect(again.out.split('\n')).toEqual(['changed: commits.subjects.plan_ready "chore(accord): plan {id} ready" -> "plan({id}): ready"', 'commits.legacy_subjects.plan_ready +"chore(accord): plan {id} ready"', '']);
    expect((await run(['config', 'set', 'commits.subjects.plan_ready', 'plan({id}): ready'], repo).then((r) => r.out))).toBe('unchanged: commits.subjects.plan_ready\n');
    expect(await legacyOf(repo, 'plan_ready')).toEqual(['plan: {id} ready', 'chore(accord): plan {id} ready']);
    expect(await stageIn(repo)).toBe('build');

    // Setting it back to a template that is already listed appends only the one it replaces.
    const back = await run(['config', 'set', 'commits.subjects.plan_ready', 'plan: {id} ready'], repo);
    expect(back.out.split('\n').slice(1)).toEqual(['commits.legacy_subjects.plan_ready +"plan({id}): ready"', '']);
    expect(await legacyOf(repo, 'plan_ready')).toEqual(['plan: {id} ready', 'chore(accord): plan {id} ready', 'plan({id}): ready']);

    // A whole map appends once per name it changes, in the fixed order, and a name it leaves alone appends nothing.
    const whole = await run(['config', 'set', 'commits.subjects', '{scout: "scout({id})", claim: "chore(accord): claim {id}", plan_ready: "plan: {id} ready"}', '--json'], repo);
    expect(JSON.parse(whole.out).consequences).toEqual([
      { key: 'commits.legacy_subjects.claim', added: ['claim: {id}'] },
      { key: 'commits.legacy_subjects.scout', added: ['scout: {id} report'] },
    ]);
    expect((await run(['config', 'check'], repo)).code).toBe(0);

    // Unsetting returns the name to its default and keeps the template it removes.
    const unset = await run(['config', 'unset', 'commits.subjects.scout'], repo);
    expect(unset.out.split('\n').slice(1)).toEqual(['commits.legacy_subjects.scout +"scout({id})"', '']);
    expect(await legacyOf(repo, 'scout')).toEqual(['scout: {id} report', 'scout({id})']);

    // accord subject: the tail follows the rendered head; an unknown name and a bad id exit 2.
    expect((await run(['subject', 'claim', 'T-1'], repo)).out).toBe('chore(accord): claim T-1\n');
    expect((await run(['subject', 'plan_round', 'T-1', 'round', '2,', '1', 'Must,', '0', 'Should'], repo)).out).toBe('plan: T-1 round 2, 1 Must, 0 Should\n');
    const unknown = await run(['subject', 'nosuch', 'T-1'], repo);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toContain('plan_ready');
    expect((await run(['subject', 'claim', 'T 1'], repo)).code).toBe(2);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching accord drop commits the drop template subject (ST-LN-50 t2-ac-3)', async () => {
  const c = copy({ tickets: ['ST-1', 'ST-2', 'ST-9', 'ST-10', 'ST-11'] });
  commitConfig(c, readFileSync(`${c.root}/accord/config.yml`, 'utf8') + 'commits:\n  subjects:\n    drop: "chore(accord): drop {id}"\n');
  const r = await run(['drop', 'ST-1', '--reason', 'x'], c.root);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(r.out).toBe('branch: drop/ST-1\nbase: main\ntitle: chore(accord): drop ST-1\n');
  expect(gitRun(c.remote, 'cat-file', 'commit', gitRun(c.remote, 'rev-parse', 'refs/heads/drop/ST-1').trim())).toContain('\n\nchore(accord): drop ST-1\n');
});
