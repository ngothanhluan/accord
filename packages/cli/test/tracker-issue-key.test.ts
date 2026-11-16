// WR-06: under `ids.mode: tracker` a ticket id is sent to the tracker as the issue key only when it is a tracker key of the configured
// projects and not a legacy id; every other ticket falls back to its own `tracker.<adapter>` link. Changing the id convention never
// renames a ticket (D-05), so `ST-LN-12` or a key-shaped `EP-1` that predates tracker mode must not become a request for an unrelated issue.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueKeyOf } from '../src/tracker/index.js';
import { makeRepo, run } from './helpers/repo.js';

const TRACKER = { ids: { mode: 'tracker' as const } };

describe('issueKeyOf under ids.mode tracker (WR-06)', () => {
  it('risk:regression a tracker key of the configured projects is the issue key', () => {
    expect(issueKeyOf({ id: 'ENG-9' }, 'jira', TRACKER)).toBe('ENG-9');
    expect(issueKeyOf({ id: 'ENG-9' }, 'linear', { ids: { mode: 'tracker', projects: ['ENG', 'OPS'] } })).toBe('ENG-9');
  });

  it('risk:data-loss a legacy id that is not a tracker key is never asked for; its own link is', () => {
    expect(issueKeyOf({ id: 'ST-LN-12' }, 'jira', TRACKER)).toBeUndefined();
    expect(issueKeyOf({ id: 'BUG-AB-3', tracker: { jira: 'ENG-4' } }, 'jira', TRACKER)).toBe('ENG-4');
  });

  it('risk:data-loss a legacy id with the shape of a key does not resolve to an unrelated issue', () => {
    const config = { ids: { mode: 'tracker' as const }, legacy_ids: ['EP-1', 'ST-5'] };
    expect(issueKeyOf({ id: 'EP-1' }, 'jira', config)).toBeUndefined();
    expect(issueKeyOf({ id: 'ST-5', tracker: { linear: 'ENG-2' } }, 'linear', config)).toBe('ENG-2');
  });

  it('risk:data-loss a key of a project the config does not list is not asked for', () => {
    expect(issueKeyOf({ id: 'ENG-9' }, 'jira', { ids: { mode: 'tracker', projects: ['OPS'] } })).toBeUndefined();
  });

  it('risk:regression github-issues asks for the ticket link, never for the id', () => {
    expect(issueKeyOf({ id: 'ENG-123', tracker: { 'github-issues': '17' } }, 'github-issues', TRACKER)).toBe('17');
    expect(issueKeyOf({ id: 'ENG-123' }, 'github-issues', TRACKER)).toBeUndefined();
  });
});

const ticket = (id: string, extra = ''): string => `---
id: ${id}
title: ${id} fixture
type: story
status: open
${extra}---

## Intent
Added by the issue key sandbox.

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

const repos: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

describe('accord status under ids.mode tracker asks the tracker only for real keys (WR-06)', () => {
  it('risk:data-loss a legacy id sends no request, and its own tracker link is asked for instead', async () => {
    const repo = makeRepo('valid-build');
    repos.push(repo);
    const file = join(repo, 'accord', 'config.yml');
    const config = readFileSync(file, 'utf8').replace(
      'tracker:\n  adapter: none',
      'tracker:\n  adapter: jira\n  url: https://good.atlassian.net\nids:\n  mode: tracker\nlegacy_ids: [ST-LN-12, EP-1]',
    );
    writeFileSync(file, config);
    writeFileSync(join(repo, 'accord', 'tickets', 'ST-LN-12.md'), ticket('ST-LN-12'));
    writeFileSync(join(repo, 'accord', 'tickets', 'EP-1.md'), ticket('EP-1', 'tracker:\n  jira: "ENG-4"\n'));
    writeFileSync(join(repo, 'accord', 'tickets', 'ENG-9.md'), ticket('ENG-9'));
    const asked: string[] = [];
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
      asked.push(decodeURIComponent(String(input).split('/issue/')[1].split('?')[0]));
      return { ok: true, status: 200, json: async () => ({ fields: { summary: 'S', status: { name: 'Todo' }, labels: [] } }) };
    }) as unknown as typeof fetch);
    const { code } = await run(['status'], repo, { JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 'SECRET1' });
    expect(code).toBe(0);
    expect(asked).toContain('ENG-9');
    expect(asked).toContain('ENG-4');
    expect(asked).not.toContain('ST-LN-12');
    expect(asked).not.toContain('EP-1');
  });
});
