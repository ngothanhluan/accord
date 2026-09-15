// INTG-01 `github-issues` adapter, end to end and in isolation. Two things are under test and the
// second one matters more: that every degradation path (no token, no network, 404, rate limit,
// malformed body) leaves `status` printing its table at exit 0 with one line on stderr (D-100), and
// that nothing a tracker says can reach a gate verdict (D-99, ROADMAP criterion 5).
//
// No case touches the network. `fetchImpl` is injected directly for the unit cases and the global
// `fetch` is stubbed for the runCli cases; a test that depends on api.github.com is a test that fails
// on an aeroplane and on a locked-down CI runner. `gh` is intercepted the same way — by default it
// throws ENOENT, so the author's real `gh auth token` is never spawned by a test run.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const enoent = (): never => {
  const err = new Error('spawn gh ENOENT') as Error & { code?: string };
  err.code = 'ENOENT';
  throw err;
};

// Hoisted so the vi.mock factory below can reach it; swapped per case.
const gh = vi.hoisted(() => ({ impl: (() => '') as (args: string[]) => string }));

// Only `gh` is intercepted. `git` must stay real: every sandbox in this file is loaded through
// `git ls-files`, so a blanket module mock would break the loader rather than the adapter.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: (file: string, args: string[], opts: unknown) =>
      file === 'gh'
        ? gh.impl(args)
        : (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(file, args, opts),
  };
});

const { fetchIssues } = await import('../src/tracker/github-issues.js');

interface Call {
  url: string;
  auth: string | undefined;
}

/** A fetch that never reaches the network and records what it was asked for. */
function fakeFetch(
  handler: (url: string) => unknown,
  calls: Call[] = [],
): { impl: typeof fetch; calls: Call[] } {
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), auth: headers.get('authorization') ?? undefined });
    const body = handler(String(input));
    if (body instanceof Error) throw body;
    return body;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const issueBody = (title: string, state = 'open', labels: string[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({ title, state, labels: labels.map((name) => ({ name })) }),
});
const httpError = (status: number) => ({ ok: false, status, json: async () => ({}) });
/** Everything after the last slash of an issue URL. */
const numberOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

beforeEach(() => {
  gh.impl = enoent;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchIssues — token lookup (D-102)', () => {
  it('issues no request and returns nothing for an empty list', async () => {
    const { impl, calls } = fakeFetch(() => {
      throw new Error('must not fetch');
    });
    const result = await fetchIssues('acme/app', [], {}, impl);
    expect(calls).toEqual([]);
    expect(result.issues).toEqual({});
    expect(result.warning).toBeUndefined();
  });

  it('sends GITHUB_TOKEN as a bearer header and never spawns gh', async () => {
    gh.impl = () => {
      throw new Error('gh must not be spawned when GITHUB_TOKEN is set');
    };
    const { impl, calls } = fakeFetch(() => issueBody('Log in'));
    const result = await fetchIssues('acme/app', ['7'], { GITHUB_TOKEN: 'ght_secret' }, impl);
    expect(calls[0].auth).toBe('Bearer ght_secret');
    expect(result.warning).toBeUndefined();
  });

  it('falls back to `gh auth token` when GITHUB_TOKEN is unset', async () => {
    const seen: string[][] = [];
    gh.impl = (args) => {
      seen.push(args);
      return 'gho_from_gh\n';
    };
    const { impl, calls } = fakeFetch(() => issueBody('Log in'));
    const result = await fetchIssues('acme/app', ['7'], {}, impl);
    expect(seen).toEqual([['auth', 'token']]);
    expect(calls[0].auth).toBe('Bearer gho_from_gh');
    expect(result.warning).toBeUndefined();
  });

  it('treats an empty GITHUB_TOKEN as unset', async () => {
    gh.impl = () => 'gho_from_gh';
    const { calls } = fakeFetch(() => issueBody('Log in'));
    const { impl } = fakeFetch(() => issueBody('Log in'), calls);
    await fetchIssues('acme/app', ['7'], { GITHUB_TOKEN: '' }, impl);
    expect(calls.at(-1)?.auth).toBe('Bearer gho_from_gh');
  });

  it('requests unauthenticated and warns when gh is absent from PATH (ENOENT is not an error)', async () => {
    const { impl, calls } = fakeFetch(() => issueBody('Log in'));
    const result = await fetchIssues('acme/app', ['7'], {}, impl);
    expect(calls[0].auth).toBeUndefined();
    expect(result.warning).toBeDefined();
    // The request still happened and still produced facts.
    expect(result.issues['7'].title).toBe('Log in');
  });
});

describe('fetchIssues — degradation (D-100, D-101)', () => {
  it('issues exactly one GET per number and no list request', async () => {
    const { impl, calls } = fakeFetch((url) => issueBody('Issue ' + numberOf(url)));
    await fetchIssues('acme/app', ['7', '9'], { GITHUB_TOKEN: 't' }, impl);
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.github.com/repos/acme/app/issues/7',
      'https://api.github.com/repos/acme/app/issues/9',
    ]);
  });

  it('omits one number on a non-ok status, names it in the warning, and keeps the others', async () => {
    const { impl } = fakeFetch((url) => (numberOf(url) === '9' ? httpError(404) : issueBody('Log in')));
    const result = await fetchIssues('acme/app', ['7', '9'], { GITHUB_TOKEN: 't' }, impl);
    expect(Object.keys(result.issues)).toEqual(['7']);
    expect(result.warning).toContain('9');
    expect(result.warning).toContain('404');
  });

  it('omits one number when the request rejects and keeps the others', async () => {
    const { impl } = fakeFetch((url) =>
      numberOf(url) === '9' ? new Error('getaddrinfo ENOTFOUND api.github.com') : issueBody('Log in'),
    );
    const result = await fetchIssues('acme/app', ['7', '9'], { GITHUB_TOKEN: 't' }, impl);
    expect(Object.keys(result.issues)).toEqual(['7']);
    expect(result.warning).toContain('9');
  });

  it('omits one number when the body is not shaped like an issue', async () => {
    const { impl } = fakeFetch((url) =>
      numberOf(url) === '9'
        ? { ok: true, status: 200, json: async () => ({ message: 'API rate limit exceeded' }) }
        : issueBody('Log in'),
    );
    const result = await fetchIssues('acme/app', ['7', '9'], { GITHUB_TOKEN: 't' }, impl);
    expect(Object.keys(result.issues)).toEqual(['7']);
    expect(result.warning).toContain('9');
  });

  it('never rejects when every request fails', async () => {
    const { impl } = fakeFetch(() => new Error('offline'));
    const result = await fetchIssues('acme/app', ['7', '9'], { GITHUB_TOKEN: 't' }, impl);
    expect(result.issues).toEqual({});
    expect(result.warning).toBeDefined();
  });

  // A hang is the one failure that does not degrade on its own: without a bound, `accord status`
  // waits forever instead of printing its table and exiting 0. The abort is what converts it into
  // an ordinary D-100 warning. Asserting the live signal rather than waiting out the real timeout
  // keeps this case as fast as the rest of the file.
  it('bounds every request with a timeout signal, so a hung connection degrades instead of hanging', async () => {
    const seen: unknown[] = [];
    const impl = (async (_url: string, init?: RequestInit) => {
      seen.push(init?.signal);
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    }) as unknown as typeof fetch;
    const result = await fetchIssues('acme/app', ['7'], { GITHUB_TOKEN: 't' }, impl);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    // Live, not an already-fired signal: the bound applies to this request, it did not expire before it.
    expect((seen[0] as AbortSignal).aborted).toBe(false);
    expect(result.issues).toEqual({});
    expect(result.warning).toContain('7');
  });

  it('reduces a hostile title to one line of ASCII (T-05-19)', async () => {
    const hostile = 'Đăng\nnhập\r' + String.fromCharCode(27) + '[31m   bad';
    const { impl } = fakeFetch(() => issueBody(hostile, 'open', ['ui\nx']));
    const result = await fetchIssues('acme/app', ['7'], { GITHUB_TOKEN: 't' }, impl);
    const facts = result.issues['7'];
    for (const value of [facts.title, facts.state, ...facts.labels]) {
      expect(value).not.toMatch(/[\r\n]/);
      expect(value.split('').every((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e)).toBe(true);
    }
    expect(facts.title).toContain('bad');
  });

  it('puts no part of the token in the warning (T-05-17)', async () => {
    gh.impl = () => 'gho_should_never_appear';
    const { impl } = fakeFetch(() => httpError(401));
    const result = await fetchIssues('acme/app', ['7'], { GITHUB_TOKEN: 'ght_should_never_appear' }, impl);
    expect(result.warning).toBeDefined();
    expect(result.warning).not.toContain('ght_should_never_appear');
    expect(result.warning).not.toContain('should_never_appear');
  });
});

// ---------------------------------------------------------------------------
// The wiring: `status` through runCli against a real sandbox.
// ---------------------------------------------------------------------------

const TICKETS = 'accord/tickets';

/** A schema-valid ticket carrying whatever frontmatter the case is about. */
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

/** Point the sandbox's config.yml at the github-issues adapter. */
function configureAdapter(repo: string, repoSlug = 'acme/app'): void {
  const file = join(repo, 'accord', 'config.yml');
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace('tracker:\n  adapter: none', `tracker:\n  adapter: github-issues\n  repo: ${repoSlug}`),
  );
}

/** A sandbox with the adapter configured and two linked tickets, #7 and #9. */
function linkedRepo(): string {
  const repo = makeRepo('valid-build');
  configureAdapter(repo);
  addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  github-issues: "7"');
  addTicket(repo, 'ISS-9', 'status: open\ntracker:\n  github-issues: "9"');
  return repo;
}

const cellOf = (out: string, id: string): string => out.split('\n').find((l) => l.startsWith(id)) ?? '';

describe('accord status with the adapter configured (INTG-01)', () => {
  it('renders title, state, and labels for each linked row', async () => {
    const repo = linkedRepo();
    try {
      const { impl, calls } = fakeFetch((url) =>
        issueBody('Log in', numberOf(url) === '7' ? 'open' : 'closed', ['ui', 'auth']),
      );
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, { GITHUB_TOKEN: 'ght_t' });
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls.map((c) => numberOf(c.url)).sort()).toEqual(['7', '9']);
      expect(cellOf(out, 'ISS-7')).toContain('#7 open Log in ui,auth');
      expect(cellOf(out, 'ISS-9')).toContain('#9 closed Log in ui,auth');
    } finally {
      cleanup(repo);
    }
  });

  it('leaves a failed row empty, writes one line to stderr, and still exits 0 (D-100)', async () => {
    const repo = linkedRepo();
    try {
      const { impl } = fakeFetch((url) => (numberOf(url) === '9' ? httpError(404) : issueBody('Log in')));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo);
      expect(code).toBe(0);
      expect(err.trim().split('\n')).toHaveLength(1);
      expect(err).toContain('9');
      expect(cellOf(out, 'ISS-7')).toContain('#7');
      // The whole table still printed, and the damaged row kept every other column.
      expect(cellOf(out, 'ISS-9')).toContain('ISS-9');
      expect(cellOf(out, 'ISS-9')).not.toContain('#9');
      expect(out).toContain('EPIC-1');
    } finally {
      cleanup(repo);
    }
  });

  it('spends no request on an archived row, because the D-93 filter runs first', async () => {
    const repo = linkedRepo();
    try {
      addTicket(repo, 'ISS-5', 'status: archived\ntracker:\n  github-issues: "5"');
      const { impl, calls } = fakeFetch(() => issueBody('Log in'));
      vi.stubGlobal('fetch', impl);
      await run(['status'], repo);
      expect(calls.map((c) => numberOf(c.url))).not.toContain('5');
    } finally {
      cleanup(repo);
    }
  });

  it('issues nothing at all when the adapter is none', async () => {
    const repo = makeRepo('valid-build');
    try {
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  github-issues: "7"');
      const { impl, calls } = fakeFetch(() => {
        throw new Error('adapter none must not fetch');
      });
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo);
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls).toEqual([]);
      // The row's own tracker map is what renders; nothing was looked up.
      expect(cellOf(out, 'ISS-7')).toContain('github-issues:7');
    } finally {
      cleanup(repo);
    }
  });

  it('leaves --json untouched by enrichment and spends no request (D-98)', async () => {
    const repo = linkedRepo();
    try {
      const { impl, calls } = fakeFetch(() => issueBody('Log in'));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status', '--json'], repo);
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls).toEqual([]);
      const rows = JSON.parse(out) as { id: string; tracker?: Record<string, string> }[];
      expect(rows.find((r) => r.id === 'ISS-7')?.tracker).toEqual({ 'github-issues': '7' });
      // Not one issue fact reached the machine contract.
      expect(out).not.toContain('Log in');
      expect(out).not.toContain('state');
    } finally {
      cleanup(repo);
    }
  });

  it('renders identically whether the responses resolve in order or in reverse (D-101)', async () => {
    const repo = linkedRepo();
    try {
      const body = (url: string) => issueBody('Issue ' + numberOf(url), 'open', ['ui']);
      const inOrder = fakeFetch(body);
      vi.stubGlobal('fetch', inOrder.impl);
      const first = await run(['status'], repo);

      // #9 resolves before #7 this time, and both after a delay.
      const reversed = (async (input: RequestInfo | URL) => {
        const url = String(input);
        await new Promise((r) => setTimeout(r, numberOf(url) === '9' ? 1 : 15));
        return body(url);
      }) as unknown as typeof fetch;
      vi.stubGlobal('fetch', reversed);
      const second = await run(['status'], repo);

      expect(second.out).toBe(first.out);
      expect(second.err).toBe(first.err);
    } finally {
      cleanup(repo);
    }
  });

  it('writes no part of the token to either stream (T-05-17)', async () => {
    const repo = linkedRepo();
    try {
      const { impl } = fakeFetch((url) => (numberOf(url) === '9' ? httpError(403) : issueBody('Log in')));
      vi.stubGlobal('fetch', impl);
      const { out, err } = await run(['status'], repo, { GITHUB_TOKEN: 'ght_never_printed' });
      expect(out + err).not.toContain('ght_never_printed');
      expect(out + err).not.toContain('never_printed');
    } finally {
      cleanup(repo);
    }
  });
});

// ---------------------------------------------------------------------------
// The independence guard. This is the test that goes red the instant a future phase lets tracker
// data reach a verdict, which is why it is written now (D-99, ROADMAP criterion 5).
// ---------------------------------------------------------------------------

describe('the gates are blind to the tracker (D-99)', () => {
  it('returns deeply equal results with a token and with the environment scrubbed', async () => {
    const repo = makeRepo('gate-ready');
    try {
      configureAdapter(repo);
      const file = join(repo, ...TICKETS.split('/'), 'CLEAN.md');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace('id: CLEAN', 'id: CLEAN\ntracker:\n  github-issues: "7"'),
      );
      const { impl, calls } = fakeFetch(() => issueBody('Log in'));
      vi.stubGlobal('fetch', impl);

      // A passing `gate ready` writes ac_hash into the ticket (D-96), which moves every line number
      // below it. One warm-up run settles that write so the two compared runs read the same bytes —
      // otherwise this case would measure accord's own write, not the tracker's influence.
      await run(['gate', 'ready', 'CLEAN', '--json'], repo, {});

      for (const which of ['ready', 'done'] as const) {
        const withToken = await run(['gate', which, 'CLEAN', '--json'], repo, {
          GITHUB_TOKEN: 'ght_invariance',
          GH_TOKEN: 'ght_invariance',
        });
        const scrubbed = await run(['gate', which, 'CLEAN', '--json'], repo, {});
        expect(JSON.parse(withToken.out)).toEqual(JSON.parse(scrubbed.out));
        expect(withToken.code).toBe(scrubbed.code);
        expect(withToken.out + withToken.err).not.toContain('ght_invariance');
      }
      // Stronger than equality: a gate never reached the network at all.
      expect(calls).toEqual([]);
    } finally {
      cleanup(repo);
    }
  });

  it('lints identically with and without the adapter configured', async () => {
    const plain = makeRepo('valid-build');
    const linked = makeRepo('valid-build');
    try {
      configureAdapter(linked);
      const { impl, calls } = fakeFetch(() => issueBody('Log in'));
      vi.stubGlobal('fetch', impl);
      const a = await run(['lint', '--json'], plain, {});
      const b = await run(['lint', '--json'], linked, { GITHUB_TOKEN: 'ght_invariance' });
      expect(JSON.parse(b.out)).toEqual(JSON.parse(a.out));
      expect(b.code).toBe(a.code);
      expect(calls).toEqual([]);
    } finally {
      cleanup(plain);
      cleanup(linked);
    }
  });
});
