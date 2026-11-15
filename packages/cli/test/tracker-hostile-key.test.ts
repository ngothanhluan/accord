// WR-05: the issue key comes from a ticket's frontmatter, which a pull request controls, and a failed request puts it into the one
// warning line `status` writes to the terminal. An escape or carriage return in a key must reach neither the line nor a terminal;
// `ascii` (T-05-19) is what already guards every other tracker text. No case touches a network: `fetchImpl` is injected.
import { describe, expect, it } from 'vitest';
import { fetchIssues } from '../src/tracker/github-issues.js';
import { fetchJira } from '../src/tracker/jira.js';
import { fetchLinear } from '../src/tracker/linear.js';

const HOSTILE = '\u001b[2J\u001b[31mX\r\u0007';
const PRINTABLE = /^[\x20-\x7e]*$/;

const notFound = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;

describe('a ticket-controlled issue key never reaches the warning as a control character (WR-05)', () => {
  it('risk:security jira', async () => {
    const { warning } = await fetchJira('https://example.atlassian.net', [HOSTILE], { JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 'SECRET1' }, notFound);
    expect(warning).toMatch(/^tracker jira: .*HTTP 404/);
    expect(warning).toMatch(PRINTABLE);
  });

  it('risk:security linear', async () => {
    const { warning } = await fetchLinear([HOSTILE], { LINEAR_API_KEY: 'SECRET1' }, notFound);
    expect(warning).toMatch(/^tracker linear: .*HTTP 404/);
    expect(warning).toMatch(PRINTABLE);
  });

  it('risk:security github-issues', async () => {
    const { warning } = await fetchIssues('acme/widgets', [HOSTILE], { GITHUB_TOKEN: 'SECRET1' }, notFound);
    expect(warning).toMatch(/^tracker acme\/widgets: .*HTTP 404/);
    expect(warning).toMatch(PRINTABLE);
  });
});
