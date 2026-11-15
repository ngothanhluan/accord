// ST-LN-50 D-06 (t2-ac-3, the claim half) on real git: a claim subject that comes from `commits.subjects.claim` is written by `worktree open` and
// `new ticket --worktree`, read back by the claim fact and the claimant check, and a claim under the old subject keeps its fact through
// `commits.legacy_subjects.claim`. Sandboxes with a bare remote, as worktree-open.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { loadConfig } from '@accord-dev/accord-core';
import type { AccordConfig } from '@accord-dev/accord-core';
import { gitClaimFacts } from '../src/load/claim-facts.js';
import { commitMsg, gitRun, run } from './helpers/repo.js';
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
  const made = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root);
  expect(made.err).toBe('');
  expect(made.code).toBe(0);
  expect(subject(c, 't/ST-9')).toBe('chore(accord): claim ST-9');
});
