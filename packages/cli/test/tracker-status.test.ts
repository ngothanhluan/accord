// ST-LN-97 `accord status` through the one tracker interface, with Linear configured (D-12, D-13).
// No case touches the network: the global `fetch` is stubbed, so a request is a recorded call, and a
// test that depends on api.linear.app is a test that fails on a locked-down CI runner. The prohibition
// under test is the independence one: tracker output reaches the display path and nothing else, so a
// gate or lint result never changes with the adapter or the key (D-01, D-12, D-99).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const KEY = 'lin_api_never_printed';
const TICKETS = 'accord/tickets';

interface Call {
  url: string;
  auth: string | undefined;
  id: string;
}

/** A fetch that never reaches the network and records what it was asked for. */
function fakeFetch(handler: (id: string) => unknown, calls: Call[] = []): { impl: typeof fetch; calls: Call[] } {
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const id = (JSON.parse(String(init?.body ?? '{}')) as { variables?: { id?: string } }).variables?.id ?? '';
    calls.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') ?? undefined, id });
    const out = handler(id);
    if (out instanceof Error) throw out;
    return out;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const issueBody = (id: string, title: string, state: string, labels: string[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: { issue: { identifier: id, title, state: { name: state }, labels: { nodes: labels.map((name) => ({ name })) } } },
  }),
});
const httpError = (status: number) => ({ ok: false, status, json: async () => ({}) });

afterEach(() => {
  vi.unstubAllGlobals();
});

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

/** Point the sandbox's config.yml at the linear adapter, optionally in tracker id mode. */
function configureLinear(repo: string, idsMode?: 'tracker'): void {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8').replace('tracker:\n  adapter: none', 'tracker:\n  adapter: linear');
  writeFileSync(file, idsMode === undefined ? text : text.replace(/\s*$/, '\n') + 'ids:\n  mode: tracker\n');
}

const cellOf = (out: string, id: string): string => out.split('\n').find((l) => l.startsWith(id)) ?? '';

describe('accord status with tracker.adapter: linear (ST-LN-97 t3-ac-1)', () => {
  it('risk:complex-branching shows the key, state, title and labels in the ticket row and exits 0 (ST-LN-97 t3-ac-1)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  linear: "ENG-7"');
      const { impl, calls } = fakeFetch((id) => issueBody(id, 'Fix export', 'In Progress', ['ui']));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, { LINEAR_API_KEY: KEY });
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls.map((c) => c.id)).toEqual(['ENG-7']);
      expect(calls[0].url).toBe('https://api.linear.app/graphql');
      expect(calls[0].auth).toBe(KEY);
      expect(cellOf(out, 'ISS-7')).toContain('ENG-7 In Progress Fix export ui');
      // The rest of the table still printed.
      expect(out).toContain('EPIC-1');
      expect(out + err).not.toContain(KEY);
    } finally {
      cleanup(repo);
    }
  });

  it('risk:complex-branching under ids.mode tracker the ticket id is the issue key and needs no tracker map (ST-LN-97 t3-ac-1)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo, 'tracker');
      addTicket(repo, 'ENG-9', 'status: open');
      const { impl, calls } = fakeFetch((id) => issueBody(id, 'Add login', 'Todo'));
      vi.stubGlobal('fetch', impl);
      const { code, out } = await run(['status'], repo, { LINEAR_API_KEY: KEY });
      expect(code).toBe(0);
      expect(calls.map((c) => c.id)).toContain('ENG-9');
      expect(cellOf(out, 'ENG-9')).toContain('ENG-9 Todo Add login');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:complex-branching asks the tracker once for a key two tickets share and shows both cells (ST-LN-97 t3-ac-1)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  linear: "ENG-7"');
      addTicket(repo, 'ISS-8', 'status: open\ntracker:\n  linear: "ENG-7"');
      const { impl, calls } = fakeFetch((id) => issueBody(id, 'Fix export', 'Todo'));
      vi.stubGlobal('fetch', impl);
      const { out } = await run(['status'], repo, { LINEAR_API_KEY: KEY });
      expect(calls.map((c) => c.id)).toEqual(['ENG-7']);
      expect(cellOf(out, 'ISS-7')).toContain('ENG-7 Todo Fix export');
      expect(cellOf(out, 'ISS-8')).toContain('ENG-7 Todo Fix export');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:complex-branching accord status --json makes no request and carries no tracker fact (ST-LN-97 t3-ac-1)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  linear: "ENG-7"');
      const { impl, calls } = fakeFetch((id) => issueBody(id, 'Fix export', 'Todo'));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status', '--json'], repo, { LINEAR_API_KEY: KEY });
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls).toEqual([]);
      const rows = JSON.parse(out) as { id: string; tracker?: Record<string, string> }[];
      expect(rows.find((r) => r.id === 'ISS-7')?.tracker).toEqual({ linear: 'ENG-7' });
      expect(out).not.toContain('Fix export');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:complex-branching spends no request when no ticket links a key (ST-LN-97 t3-ac-1)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      const { impl, calls } = fakeFetch(() => {
        throw new Error('no key is linked, so no request');
      });
      vi.stubGlobal('fetch', impl);
      const { code, err } = await run(['status'], repo, { LINEAR_API_KEY: KEY });
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(calls).toEqual([]);
    } finally {
      cleanup(repo);
    }
  });
});

describe('a Linear failure never changes the result (ST-LN-97 t3-ac-2)', () => {
  it('risk:security an HTTP error leaves that row empty, writes one stderr line and exits 0 (ST-LN-97 t3-ac-2)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  linear: "ENG-7"');
      addTicket(repo, 'ISS-9', 'status: open\ntracker:\n  linear: "ENG-9"');
      const { impl } = fakeFetch((id) => (id === 'ENG-9' ? httpError(401) : issueBody(id, 'Fix export', 'Todo')));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, { LINEAR_API_KEY: KEY });
      expect(code).toBe(0);
      expect(err.trim().split('\n')).toHaveLength(1);
      expect(err).toMatch(/^tracker linear: /);
      expect(err).toContain('ENG-9');
      expect(cellOf(out, 'ISS-7')).toContain('ENG-7 Todo Fix export');
      expect(cellOf(out, 'ISS-9')).not.toContain('ENG-9');
      expect(out + err).not.toContain(KEY);
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security a missing LINEAR_API_KEY makes no request, warns once, leaves cells empty and exits 0 (ST-LN-97 t3-ac-2)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  linear: "ENG-7"');
      const { impl, calls } = fakeFetch(() => {
        throw new Error('no key, no request');
      });
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, {});
      expect(code).toBe(0);
      expect(calls).toEqual([]);
      expect(err).toBe('tracker linear: LINEAR_API_KEY is not set\n');
      expect(cellOf(out, 'ISS-7')).not.toContain('ENG-7');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security a network failure is one warning and the table still prints (ST-LN-97 t3-ac-2)', async () => {
    const repo = makeRepo('valid-build');
    try {
      configureLinear(repo);
      addTicket(repo, 'ISS-7', 'status: open\ntracker:\n  linear: "ENG-7"');
      const { impl } = fakeFetch(() => new Error('getaddrinfo ENOTFOUND api.linear.app'));
      vi.stubGlobal('fetch', impl);
      const { code, out, err } = await run(['status'], repo, { LINEAR_API_KEY: KEY });
      expect(code).toBe(0);
      expect(err.trim().split('\n')).toHaveLength(1);
      expect(out).toContain('ISS-7');
      expect(out).toContain('EPIC-1');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:security gate and lint results are the same with the adapter and the key as without, and no request is made (ST-LN-97 t3-ac-2)', async () => {
    const plain = makeRepo('gate-ready');
    const linked = makeRepo('gate-ready');
    try {
      configureLinear(linked);
      // Both sandboxes carry the same link, so finding line numbers match; only `linked` configures the adapter.
      for (const repo of [plain, linked]) {
        const file = join(repo, ...TICKETS.split('/'), 'CLEAN.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace('id: CLEAN', 'id: CLEAN\ntracker:\n  linear: "ENG-7"'));
      }
      const { impl, calls } = fakeFetch(() => {
        throw new Error('a gate or lint must never reach the tracker');
      });
      vi.stubGlobal('fetch', impl);
      // A passing `gate ready` writes ac_hash into the ticket (D-96); settle that write before comparing.
      await run(['gate', 'ready', 'CLEAN', '--json'], plain, {});
      await run(['gate', 'ready', 'CLEAN', '--json'], linked, {});
      for (const args of [['gate', 'ready', 'CLEAN', '--json'], ['gate', 'done', 'CLEAN', '--json'], ['lint', '--json']]) {
        const a = await run(args, plain, {});
        const b = await run(args, linked, { LINEAR_API_KEY: KEY });
        expect(b.code).toBe(a.code);
        expect(b.out).toBe(a.out);
        expect(b.out + b.err).not.toContain(KEY);
      }
      expect(calls).toEqual([]);
    } finally {
      cleanup(plain);
      cleanup(linked);
    }
  });
});
