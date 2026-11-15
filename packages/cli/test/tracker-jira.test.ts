// ST-LN-97 the Jira adapter for Cloud and Server/Data Center (D-13). Read-only: one GET per distinct
// issue key. Nothing here touches the network: `fetchImpl` is injected, or the global `fetch` is
// stubbed, so a test that needs a real Jira is a test that fails on an aeroplane. Every URL a case
// uses is https and every token is a made-up string asserted absent from everything the adapter
// returns; there is no http exception anywhere, tests included (T-03.1-38).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapterFor } from '../src/tracker/index.js';
import { fetchJira } from '../src/tracker/jira.js';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const BASE = 'https://example.atlassian.net';
const SECRET1 = 'SECRET1';
const SECRET2 = 'SECRET2';
const CLOUD = { JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: SECRET1 };
const PAT = { JIRA_PAT: SECRET2 };
const BASIC = 'Basic ' + Buffer.from('a@b.c:' + SECRET1).toString('base64');

interface Call {
  url: string;
  init: RequestInit;
}

/** A fetch that never reaches the network and records every request it was asked for. */
function fakeFetch(
  handler: (url: string, call: Call) => unknown | Promise<unknown>,
  calls: Call[] = [],
): { impl: typeof fetch; calls: Call[] } {
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const out = await handler(call.url, call);
    if (out instanceof Error) throw out;
    return out;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const issueBody = (title = 'Fix the export bug', state = 'In Progress', labels: string[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({ fields: { summary: title, status: { name: state }, labels } }),
});
const jsonBody = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
const httpError = (status: number) => ({ ok: false, status, json: async () => ({}) });
const keyOf = (url: string): string => decodeURIComponent(url.split('/issue/')[1].split('?')[0]);
const headersOf = (call: Call): Headers => new Headers(call.init.headers);
const noFetch = () =>
  fakeFetch(() => {
    throw new Error('must not fetch');
  });

describe('fetchJira request and authentication (ST-LN-97 t3-ac-2)', () => {
  it('risk:security Cloud: JIRA_EMAIL with JIRA_API_TOKEN sends Basic over /rest/api/3 with the fixed fields and redirect error (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    const result = await fetchJira(BASE, ['ENG-1'], CLOUD, impl);
    expect(result.warning).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(BASE + '/rest/api/3/issue/ENG-1?fields=summary,status,labels');
    expect(headersOf(calls[0]).get('authorization')).toBe(BASIC);
    expect(calls[0].init.method ?? 'GET').toBe('GET');
    expect(calls[0].init.redirect).toBe('error');
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect((calls[0].init.signal as AbortSignal).aborted).toBe(false);
    expect(calls[0].url).not.toContain(SECRET1);
    expect(JSON.stringify(result)).not.toContain(SECRET1);
  });

  it('risk:security Server/Data Center: JIRA_PAT alone sends Bearer over /rest/api/2 (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    const result = await fetchJira(BASE, ['ENG-1'], PAT, impl);
    expect(result.warning).toBeUndefined();
    expect(calls[0].url).toBe(BASE + '/rest/api/2/issue/ENG-1?fields=summary,status,labels');
    expect(headersOf(calls[0]).get('authorization')).toBe('Bearer ' + SECRET2);
    expect(calls[0].init.redirect).toBe('error');
    expect(calls[0].url).not.toContain(SECRET2);
  });

  it('risk:security both sets present use Cloud and the warning says JIRA_PAT was ignored (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    const result = await fetchJira(BASE, ['ENG-1'], { ...CLOUD, ...PAT }, impl);
    expect(calls[0].url).toContain('/rest/api/3/');
    expect(headersOf(calls[0]).get('authorization')).toBe(BASIC);
    expect(result.warning).toMatch(/^tracker jira: .*JIRA_PAT ignored/);
    expect(result.warning).not.toContain('\n');
    expect(JSON.stringify(result)).not.toContain(SECRET1);
    expect(JSON.stringify(result)).not.toContain(SECRET2);
    expect(Object.keys(result.issues)).toEqual(['ENG-1']);
  });

  it('risk:security only JIRA_EMAIL makes no request and the warning names JIRA_API_TOKEN (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = noFetch();
    const result = await fetchJira(BASE, ['ENG-1'], { JIRA_EMAIL: 'a@b.c' }, impl);
    expect(calls).toEqual([]);
    expect(result.issues).toEqual({});
    expect(result.warning).toMatch(/^tracker jira: /);
    expect(result.warning).toContain('JIRA_API_TOKEN');
    expect(result.warning).not.toContain('\n');
  });

  it('risk:security only JIRA_API_TOKEN makes no request and the warning names JIRA_EMAIL, and a PAT does not rescue a half pair (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = noFetch();
    for (const env of [{ JIRA_API_TOKEN: SECRET1 }, { JIRA_API_TOKEN: SECRET1, ...PAT }]) {
      const result = await fetchJira(BASE, ['ENG-1'], env, impl);
      expect(result.issues).toEqual({});
      expect(result.warning).toMatch(/^tracker jira: .*JIRA_EMAIL/);
      expect(JSON.stringify(result)).not.toContain(SECRET1);
      expect(JSON.stringify(result)).not.toContain(SECRET2);
    }
    expect(calls).toEqual([]);
  });

  it('risk:security no variable (or empty ones) makes no request and warns once naming the variables (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = noFetch();
    for (const env of [{}, { JIRA_EMAIL: '', JIRA_API_TOKEN: '', JIRA_PAT: '' }]) {
      const result = await fetchJira(BASE, ['ENG-1', 'ENG-2'], env, impl);
      expect(result.issues).toEqual({});
      expect(result.warning).toBe('tracker jira: no Jira token (JIRA_EMAIL+JIRA_API_TOKEN or JIRA_PAT)');
    }
    expect(calls).toEqual([]);
  });

  it('risk:security an empty key list issues nothing and says nothing (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = noFetch();
    expect(await fetchJira(BASE, [], {}, impl)).toEqual({ issues: {} });
    expect(await fetchJira(BASE, [], CLOUD, impl)).toEqual({ issues: {} });
    expect(calls).toEqual([]);
  });

  it('risk:security never calls the legacy JQL search, whatever the keys (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    await fetchJira(BASE, ['ENG-1', 'ENG-2'], CLOUD, impl);
    await fetchJira(BASE, ['ENG-1', 'ENG-2'], PAT, impl);
    expect(calls).toHaveLength(4);
    for (const c of calls) expect(c.url).not.toContain('/search');
  });

  it('risk:security a key with a slash or a question mark is URL-encoded into the one path segment (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    await fetchJira(BASE, ['A/B?x=1'], CLOUD, impl);
    expect(calls[0].url).toBe(BASE + '/rest/api/3/issue/A%2FB%3Fx%3D1?fields=summary,status,labels');
  });

  it('risk:security a trailing slash on the base URL and a context path are handled (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    await fetchJira('https://jira.example.com/jira/', ['ENG-1'], PAT, impl);
    await fetchJira('https://jira.example.com/', ['ENG-1'], PAT, impl);
    expect(calls[0].url).toBe('https://jira.example.com/jira/rest/api/2/issue/ENG-1?fields=summary,status,labels');
    expect(calls[1].url).toBe('https://jira.example.com/rest/api/2/issue/ENG-1?fields=summary,status,labels');
  });
});

describe('fetchJira refuses any URL that is not https (ST-LN-97 t3-ac-2)', () => {
  const refused = [
    'http://localhost:8080',
    'http://example.com',
    'http://example.com/jira',
    'HTTP://example.com',
    'ftp://example.com',
    'example.com',
    'https:///nohost',
    'https://exa mple.com',
    '',
    'https://example.com?x=1',
    'https://example.com#frag',
  ];
  for (const url of refused) {
    it(`risk:security "${url}" warns "tracker.url must be an https URL" and calls fetch zero times, with every token set (ST-LN-97 t3-ac-2)`, async () => {
      const { impl, calls } = noFetch();
      for (const env of [CLOUD, PAT, { ...CLOUD, ...PAT }]) {
        const result = await fetchJira(url, ['ENG-1'], env, impl);
        expect(result.issues).toEqual({});
        expect(result.warning).toBe('tracker jira: tracker.url must be an https URL');
      }
      expect(calls).toEqual([]);
    });
  }
});

describe('fetchJira facts (ST-LN-97 t3-ac-1)', () => {
  it('risk:complex-branching reads fields.summary, fields.status.name and fields.labels through ascii (ST-LN-97 t3-ac-1)', async () => {
    const { impl } = fakeFetch(() => issueBody('Fix the export bug', 'In Progress', ['bug', 'ui']));
    const result = await fetchJira(BASE, ['ENG-1'], CLOUD, impl);
    expect(result.warning).toBeUndefined();
    expect(result.issues).toEqual({ 'ENG-1': { title: 'Fix the export bug', state: 'In Progress', labels: ['bug', 'ui'] } });
  });

  it('risk:complex-branching a missing labels array is an empty list (ST-LN-97 t3-ac-1)', async () => {
    const { impl } = fakeFetch(() => jsonBody({ fields: { summary: 'S', status: { name: 'Done' } } }));
    const result = await fetchJira(BASE, ['ENG-1'], CLOUD, impl);
    expect(result.issues['ENG-1']).toEqual({ title: 'S', state: 'Done', labels: [] });
  });

  it('risk:complex-branching makes one request for a key two rows share and keeps first-seen order (ST-LN-97 t3-ac-1)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody());
    const result = await fetchJira(BASE, ['ENG-9', 'ENG-7', 'ENG-9', 'ENG-7'], CLOUD, impl);
    expect(calls.map((c) => keyOf(c.url))).toEqual(['ENG-9', 'ENG-7']);
    expect(Object.keys(result.issues)).toEqual(['ENG-9', 'ENG-7']);
  });

  it('risk:security reduces a hostile summary, status and label to one line of printable ASCII (ST-LN-97 t3-ac-2)', async () => {
    const hostile = 'Ete\nnumero\r' + String.fromCharCode(27) + '[31m   bad';
    const { impl } = fakeFetch(() => issueBody(hostile, 'Done✓', ['ui\nx', '\u0007']));
    const facts = (await fetchJira(BASE, ['ENG-1'], CLOUD, impl)).issues['ENG-1'];
    for (const value of [facts.title, facts.state, ...facts.labels]) {
      expect(value).not.toMatch(/[\r\n]/);
      expect(value.split('').every((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e)).toBe(true);
    }
    expect(facts.title).toContain('bad');
    expect(facts.labels).not.toContain('');
  });

  it('risk:complex-branching never has more than 8 requests in flight for 20 keys (ST-LN-97 t3-ac-2)', async () => {
    let inFlight = 0;
    let peak = 0;
    const { impl, calls } = fakeFetch(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return issueBody();
    });
    const keys = Array.from({ length: 20 }, (_, i) => 'ENG-' + (i + 1));
    const result = await fetchJira(BASE, keys, CLOUD, impl);
    expect(calls).toHaveLength(20);
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
    expect(Object.keys(result.issues)).toEqual(keys);
  });
});

describe('fetchJira failures are one warning and leak nothing (ST-LN-97 t3-ac-2)', () => {
  const failures: [string, () => unknown][] = [
    ['HTTP 401', () => httpError(401)],
    ['HTTP 403', () => httpError(403)],
    ['HTTP 404', () => httpError(404)],
    ['HTTP 410', () => httpError(410)],
    ['a timeout', () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })],
    ['a body that is not JSON', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } })],
    ['a body that is not an issue', () => jsonBody({ errorMessages: ['Issue does not exist'] })],
    ['a null body', () => jsonBody(null)],
    ['a rejection that quotes a secret', () => new Error('socket hang up ' + SECRET1 + ' ' + SECRET2 + ' ' + BASIC + ' Bearer ' + SECRET2)],
    ['a non-JSON body that quotes a secret', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token ' + SECRET1 + ' ' + BASIC); } })],
  ];

  for (const env of [CLOUD, PAT, { ...CLOUD, ...PAT }]) {
    for (const [label, handler] of failures) {
      it(`risk:security ${label} omits that key, names it in one "tracker jira:" line and shows no secret (${Object.keys(env).join('+')}) (ST-LN-97 t3-ac-2)`, async () => {
        const { impl } = fakeFetch((url) => (keyOf(url) === 'ENG-9' ? handler() : issueBody()));
        const result = await fetchJira(BASE, ['ENG-7', 'ENG-9'], env, impl);
        expect(Object.keys(result.issues)).toEqual(['ENG-7']);
        expect(result.warning).toMatch(/^tracker jira: /);
        expect(result.warning).toContain('ENG-9');
        expect(result.warning).not.toContain('\n');
        const all = JSON.stringify(result);
        for (const secret of [SECRET1, SECRET2, BASIC, Buffer.from('a@b.c:' + SECRET1).toString('base64')]) {
          expect(all).not.toContain(secret);
        }
      });
    }
  }

  it('risk:security never rejects when every request fails (ST-LN-97 t3-ac-2)', async () => {
    const { impl } = fakeFetch(() => new Error('offline'));
    const result = await fetchJira(BASE, ['ENG-7', 'ENG-9'], PAT, impl);
    expect(result.issues).toEqual({});
    expect(result.warning).toContain('ENG-7');
    expect(result.warning).toContain('ENG-9');
  });
});

describe('the tracker interface for jira (ST-LN-97 t3-ac-1)', () => {
  it('risk:complex-branching adapterFor returns the jira adapter only for jira with a url (ST-LN-97 t3-ac-1)', () => {
    expect(adapterFor({ adapter: 'jira', url: BASE })?.name).toBe('jira');
    expect(adapterFor({ adapter: 'jira' })).toBeUndefined();
  });

  it('risk:security the jira adapter reads the environment and the injected fetch through the interface, and still refuses http (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody('Fix', 'Todo', ['ui']));
    const result = await adapterFor({ adapter: 'jira', url: BASE })?.fetch(['ENG-7'], PAT, { fetchImpl: impl, root: '.' });
    expect(calls).toHaveLength(1);
    expect(result?.issues['ENG-7']).toEqual({ title: 'Fix', state: 'Todo', labels: ['ui'] });

    const none = noFetch();
    const refused = await adapterFor({ adapter: 'jira', url: 'http://example.com' })?.fetch(['ENG-7'], PAT, {
      fetchImpl: none.impl,
      root: '.',
    });
    expect(none.calls).toEqual([]);
    expect(refused?.warning).toBe('tracker jira: tracker.url must be an https URL');
  });
});

describe('accord status with tracker.adapter: jira (ST-LN-97 t3-ac-1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const TICKETS = 'accord/tickets';

  function addTicket(repo: string, id: string, extra: string): void {
    writeFileSync(
      join(repo, ...TICKETS.split('/'), id + '.md'),
      `---
id: ${id}
title: ${id} fixture
type: story
${extra}
---

## Intent
Added by the tracker test sandbox.

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
`,
    );
  }

  function configureJira(repo: string, url: string): void {
    const file = join(repo, 'accord', 'config.yml');
    const text = readFileSync(file, 'utf8').replace(
      'tracker:\n  adapter: none',
      'tracker:\n  adapter: jira\n  url: ' + url,
    );
    writeFileSync(file, text);
  }

  const cellOf = (out: string, id: string): string => out.split('\n').find((l) => l.startsWith(id)) ?? '';

  it('risk:complex-branching shows the key, state, title and labels in the ticket row and exits 0 (ST-LN-97 t3-ac-1)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureJira(repo, BASE);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  jira: "ENG-7"');
      const { impl, calls } = fakeFetch(() => issueBody('Fix export', 'In Progress', ['ui']));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, CLOUD);
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls.map((c) => c.url)).toEqual([BASE + '/rest/api/3/issue/ENG-7?fields=summary,status,labels']);
      expect(cellOf(out, 'ISS-7')).toContain('ENG-7 In Progress Fix export ui');
      expect(out).toContain('EPIC-1');
      expect(out + err).not.toContain(SECRET1);
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security a Server/Data Center status run sends Bearer and a missing token warns once with no request (ST-LN-97 t3-ac-2)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureJira(repo, 'https://jira.example.com/jira');
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  jira: "ENG-7"');
      const { impl, calls } = fakeFetch(() => issueBody('Fix export', 'Todo'));
      vi.stubGlobal('fetch', impl);
      const ok = await run(['status'], repo, PAT);
      expect(ok.code).toBe(0);
      expect(ok.err).toBe('');
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain('/jira/rest/api/2/issue/ENG-7');
      expect(headersOf(calls[0]).get('authorization')).toBe('Bearer ' + SECRET2);
      expect(cellOf(ok.out, 'ISS-7')).toContain('ENG-7 Todo Fix export');

      calls.length = 0;
      const none = await run(['status'], repo, {});
      expect(none.code).toBe(0);
      expect(calls).toEqual([]);
      expect(none.err).toBe('tracker jira: no Jira token (JIRA_EMAIL+JIRA_API_TOKEN or JIRA_PAT)\n');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security an HTTP error leaves that row empty, writes one stderr line without a secret and exits 0 (ST-LN-97 t3-ac-2)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureJira(repo, BASE);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  jira: "ENG-7"');
      addTicket(repo, 'ISS-9', 'status: open\ntracker:\n  jira: "ENG-9"');
      const { impl } = fakeFetch((url) => (keyOf(url) === 'ENG-9' ? httpError(404) : issueBody('Fix export', 'Todo')));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, CLOUD);
      expect(code).toBe(0);
      expect(err.trim().split('\n')).toHaveLength(1);
      expect(err).toMatch(/^tracker jira: /);
      expect(err).toContain('ENG-9');
      expect(cellOf(out, 'ISS-7')).toContain('ENG-7 Todo Fix export');
      expect(cellOf(out, 'ISS-9')).not.toContain('ENG-9');
      expect(out + err).not.toContain(SECRET1);
    } finally {
      cleanup(repo);
    }
  });
});
