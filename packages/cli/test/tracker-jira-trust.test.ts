// WR-02: a branch's own `tracker.url` must not decide where the Jira credential goes. `accord status` sends it only to the
// host the default branch's accord/config.yml names; a different value on the checked-out branch is one warning and no request.
// No case touches the network: the global `fetch` is stubbed. The sandboxes are removed with no retry loop.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitAll, gitRun, makeRepo, run } from './helpers/repo.js';

const GOOD = 'https://good.atlassian.net';
const EVIL = 'https://attacker.example';
const CLOUD = { JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 'SECRET1' };

const ticket = (id: string): string => `---
id: ${id}
title: ${id} fixture
type: story
status: open
tracker:
  jira: "ENG-7"
---

## Intent
Added by the tracker trust sandbox.

## Requirements
- WHEN a case needs this ticket the system SHALL render one row

## Acceptance criteria
\`\`\`gherkin
Feature: ${id}

  @ac-1
  Scenario: One row
    When status runs
    Then the row appears
\`\`\`

## Open questions
- [x] None.

## Plan
- [x] Done
`;

const setUrl = (repo: string, url: string | undefined): void => {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8').replace(/tracker:\n {2}adapter: \w[\w-]*(\n {2}url: \S+)?/, 'tracker:\n  adapter: jira' + (url === undefined ? '' : '\n  url: ' + url));
  writeFileSync(file, text);
};

/** A repository whose default branch names GOOD, with the checkout on a `pr` branch that `change` then edits. */
function sandbox(defaultUrl: string | undefined = GOOD): string {
  const repo = makeRepo('valid-build');
  writeFileSync(join(repo, 'accord', 'tickets', 'ISS-7.md'), ticket('ISS-7'));
  setUrl(repo, defaultUrl);
  commitAll(repo, 'default branch');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 'pr');
  setUrl(repo, GOOD); // the branch starts as the default branch names it when the default has a url; a case edits it
  return repo;
}

const repos: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

function stub(): { urls: string[]; auth: (string | null)[] } {
  const urls: string[] = [];
  const auth: (string | null)[] = [];
  vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    auth.push(new Headers(init?.headers).get('authorization'));
    return { ok: true, status: 200, json: async () => ({ fields: { summary: 'Fix export', status: { name: 'Todo' }, labels: [] } }) };
  }) as unknown as typeof fetch);
  return { urls, auth };
}

describe('accord status sends the Jira credential only where the default branch says (WR-02)', () => {
  it('risk:security a branch that changed tracker.url sends nothing and warns once, committed or not', async () => {
    const repo = sandbox();
    repos.push(repo);
    const seen = stub();
    setUrl(repo, EVIL);
    for (const committed of [false, true]) {
      if (committed) commitAll(repo, 'point jira elsewhere');
      seen.urls.length = 0;
      const { code, out, err } = await run(['status'], repo, CLOUD);
      expect(code, String(committed)).toBe(0);
      expect(seen.urls, String(committed)).toEqual([]);
      expect(err, String(committed)).toMatch(/^tracker jira: .*tracker\.url/);
      expect(err.trim().split('\n'), String(committed)).toHaveLength(1);
      expect(out + err).not.toContain('SECRET1');
    }
  });

  it('risk:security a branch that adds a url the default branch does not have sends nothing', async () => {
    const repo = sandbox();
    repos.push(repo);
    const seen = stub();
    setUrl(repo, undefined);
    gitRun(repo, 'checkout', '-q', 'main', '--', 'accord/config.yml');
    gitRun(repo, 'show', 'main:accord/config.yml');
    const text = readFileSync(join(repo, 'accord', 'config.yml'), 'utf8').replace(/\n {2}url: \S+/, '\n  url: ' + EVIL);
    writeFileSync(join(repo, 'accord', 'config.yml'), text);
    const { err } = await run(['status'], repo, CLOUD);
    expect(seen.urls).toEqual([]);
    expect(err).toMatch(/^tracker jira: /);
  });

  it('risk:regression the url the default branch names is called with the credential, a trailing slash included', async () => {
    const repo = sandbox();
    repos.push(repo);
    const seen = stub();
    const same = await run(['status'], repo, CLOUD);
    expect(same.err).toBe('');
    expect(seen.urls.length).toBeGreaterThan(0);
    for (const u of seen.urls) expect(u.startsWith(GOOD + '/rest/api/3/issue/')).toBe(true);
    seen.urls.length = 0;
    setUrl(repo, GOOD + '/');
    const slash = await run(['status'], repo, CLOUD);
    expect(slash.err).toBe('');
    expect(seen.urls.length).toBeGreaterThan(0);
  });
});
