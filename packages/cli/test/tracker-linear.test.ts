// ST-LN-97 the Linear adapter and the one tracker interface it sits behind (D-12, D-13). The adapter
// is read-only: one POST per distinct issue key to a fixed https host, the personal API key sent as the
// raw Authorization header, and every failure turned into one warning line (t3-ac-2). Nothing here
// touches the network: `fetchImpl` is injected, so a test that needs api.linear.app is a test that
// fails on an aeroplane. The key is a made-up string and is asserted absent from every string the
// adapter returns.
import { describe, expect, it } from 'vitest';
import { adapterFor, issueKeyOf } from '../src/tracker/index.js';
import { fetchLinear } from '../src/tracker/linear.js';

const KEY = 'lin_api_SECRET';
const ENV = { LINEAR_API_KEY: KEY };

interface Call {
  url: string;
  init: RequestInit;
  body: { query: string; variables: { id: string } };
}

/** A fetch that never reaches the network and records every request it was asked for. */
function fakeFetch(
  handler: (key: string, call: Call) => unknown | Promise<unknown>,
  calls: Call[] = [],
): { impl: typeof fetch; calls: Call[] } {
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Call['body'];
    const call: Call = { url: String(input), init: init ?? {}, body };
    calls.push(call);
    const out = await handler(body.variables?.id, call);
    if (out instanceof Error) throw out;
    return out;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const issueBody = (key: string, title = 'Fix the export bug', state = 'In Progress', labels: string[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: { issue: { identifier: key, title, state: { name: state }, labels: { nodes: labels.map((name) => ({ name })) } } },
  }),
});
const jsonBody = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
const httpError = (status: number) => ({ ok: false, status, json: async () => ({}) });

const headersOf = (call: Call): Headers => new Headers(call.init.headers);

describe('fetchLinear request (ST-LN-97 t3-ac-2)', () => {
  it('risk:security sends the raw key as the Authorization header to the fixed endpoint, never as Bearer (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch((key) => issueBody(key));
    await fetchLinear(['ENG-7'], ENV, impl);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.url).toBe('https://api.linear.app/graphql');
    expect(call.init.method).toBe('POST');
    expect(headersOf(call).get('authorization')).toBe(KEY);
    expect(headersOf(call).get('authorization')?.toLowerCase()).not.toContain('bearer');
    expect(headersOf(call).get('content-type')).toBe('application/json');
    // A redirect would carry the key to another host (RESEARCH A4).
    expect(call.init.redirect).toBe('error');
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
    // The key goes to the query as a variable, never spliced into the query text, and the token is in no URL or body.
    expect(call.body.variables).toEqual({ id: 'ENG-7' });
    expect(call.body.query).toContain('issue(id: $id)');
    expect(call.url).not.toContain(KEY);
    expect(JSON.stringify(call.body)).not.toContain(KEY);
  });

  it('risk:security bounds every request with a live timeout signal, so a hung connection degrades instead of hanging (ST-LN-97 t3-ac-2)', async () => {
    const seen: unknown[] = [];
    const impl = (async (_url: string, init?: RequestInit) => {
      seen.push(init?.signal);
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    }) as unknown as typeof fetch;
    const result = await fetchLinear(['ENG-7'], ENV, impl);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    expect((seen[0] as AbortSignal).aborted).toBe(false);
    expect(result.issues).toEqual({});
    expect(result.warning).toMatch(/^tracker linear: /);
    expect(result.warning).toContain('ENG-7');
  });

  it('risk:security makes no request and warns once when LINEAR_API_KEY is not set (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => {
      throw new Error('must not fetch without a key');
    });
    for (const env of [{}, { LINEAR_API_KEY: '' }]) {
      const result = await fetchLinear(['ENG-7', 'ENG-8'], env, impl);
      expect(result.issues).toEqual({});
      expect(result.warning).toBe('tracker linear: LINEAR_API_KEY is not set');
    }
    expect(calls).toEqual([]);
  });

  it('risk:security issues nothing and says nothing for an empty key list, key or no key (ST-LN-97 t3-ac-2)', async () => {
    const { impl, calls } = fakeFetch(() => {
      throw new Error('must not fetch');
    });
    expect(await fetchLinear([], {}, impl)).toEqual({ issues: {} });
    expect(await fetchLinear([], ENV, impl)).toEqual({ issues: {} });
    expect(calls).toEqual([]);
  });
});

describe('fetchLinear facts (ST-LN-97 t3-ac-1)', () => {
  it('risk:complex-branching reads title, state name and label names from data.issue (ST-LN-97 t3-ac-1)', async () => {
    const { impl } = fakeFetch((key) => issueBody(key, 'Fix the export bug', 'In Progress', ['bug', 'ui']));
    const result = await fetchLinear(['ENG-7'], ENV, impl);
    expect(result.warning).toBeUndefined();
    expect(result.issues).toEqual({ 'ENG-7': { title: 'Fix the export bug', state: 'In Progress', labels: ['bug', 'ui'] } });
  });

  it('risk:complex-branching makes one request for a key two rows share and keeps first-seen order (ST-LN-97 t3-ac-1)', async () => {
    const { impl, calls } = fakeFetch((key) => issueBody(key));
    const result = await fetchLinear(['ENG-9', 'ENG-7', 'ENG-9', 'ENG-7'], ENV, impl);
    expect(calls.map((c) => c.body.variables.id)).toEqual(['ENG-9', 'ENG-7']);
    expect(Object.keys(result.issues)).toEqual(['ENG-9', 'ENG-7']);
  });

  it('risk:security reduces a hostile title, state and label to one line of printable ASCII (ST-LN-97 t3-ac-2)', async () => {
    const hostile = 'Ete\nnumero\r' + String.fromCharCode(27) + '[31m   bad';
    const { impl } = fakeFetch((key) => issueBody(key, hostile, 'Done✓', ['ui\nx']));
    const facts = (await fetchLinear(['ENG-7'], ENV, impl)).issues['ENG-7'];
    for (const value of [facts.title, facts.state, ...facts.labels]) {
      expect(value).not.toMatch(/[\r\n]/);
      expect(value.split('').every((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e)).toBe(true);
    }
    expect(facts.title).toContain('bad');
  });

  it('risk:complex-branching never has more than 8 requests in flight for 20 keys (ST-LN-97 t3-ac-2)', async () => {
    let inFlight = 0;
    let peak = 0;
    const { impl, calls } = fakeFetch(async (key) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return issueBody(key);
    });
    const keys = Array.from({ length: 20 }, (_, i) => 'ENG-' + (i + 1));
    const result = await fetchLinear(keys, ENV, impl);
    expect(calls).toHaveLength(20);
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
    expect(Object.keys(result.issues)).toEqual(keys);
  });
});

describe('fetchLinear failures are one warning (ST-LN-97 t3-ac-2)', () => {
  const failures: [string, (key: string) => unknown][] = [
    ['a GraphQL errors array', () => jsonBody({ errors: [{ message: 'Entity not found: Issue' }] })],
    ['a null issue', () => jsonBody({ data: { issue: null } })],
    ['HTTP 401', () => httpError(401)],
    ['a rejection', () => new Error('getaddrinfo ENOTFOUND api.linear.app')],
    ['a timeout', () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })],
    ['a rejection that quotes the key', () => new Error('socket hang up for ' + KEY)],
    ['a body that is not JSON', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } })],
    ['an errors array that quotes the key', () => jsonBody({ errors: [{ message: 'bad credentials ' + KEY }] })],
  ];

  for (const [label, handler] of failures) {
    it(`risk:security ${label} omits that key, names it in one line starting "tracker linear:" and never shows the key (ST-LN-97 t3-ac-2)`, async () => {
      const { impl } = fakeFetch((key) => (key === 'ENG-9' ? handler(key) : issueBody(key)));
      const result = await fetchLinear(['ENG-7', 'ENG-9'], ENV, impl);
      expect(Object.keys(result.issues)).toEqual(['ENG-7']);
      expect(result.warning).toMatch(/^tracker linear: /);
      expect(result.warning).toContain('ENG-9');
      expect(result.warning).not.toContain('\n');
      expect(result.warning).not.toContain(KEY);
      expect(result.warning).not.toContain('SECRET');
      expect(JSON.stringify(result)).not.toContain(KEY);
    });
  }

  it('risk:security never rejects when every request fails (ST-LN-97 t3-ac-2)', async () => {
    const { impl } = fakeFetch(() => new Error('offline'));
    const result = await fetchLinear(['ENG-7', 'ENG-9'], ENV, impl);
    expect(result.issues).toEqual({});
    expect(result.warning).toContain('ENG-7');
    expect(result.warning).toContain('ENG-9');
  });
});

describe('the tracker interface (ST-LN-97 t3-ac-1)', () => {
  it('risk:complex-branching adapterFor names the linear adapter and returns nothing for none (ST-LN-97 t3-ac-1)', () => {
    expect(adapterFor({ adapter: 'none' })).toBeUndefined();
    expect(adapterFor({ adapter: 'linear' })?.name).toBe('linear');
  });

  it('risk:complex-branching the linear adapter reads LINEAR_API_KEY through the interface and passes the injected fetch (ST-LN-97 t3-ac-1)', async () => {
    const { impl, calls } = fakeFetch((key) => issueBody(key, 'Fix', 'Todo', ['ui']));
    const adapter = adapterFor({ adapter: 'linear' });
    const result = await adapter?.fetch(['ENG-7'], ENV, { fetchImpl: impl, root: '.' });
    expect(calls).toHaveLength(1);
    expect(result?.issues['ENG-7']).toEqual({ title: 'Fix', state: 'Todo', labels: ['ui'] });
  });

  it('risk:complex-branching the issue key is the ticket id under ids.mode tracker and the adapter value otherwise (ST-LN-97 t3-ac-1)', () => {
    const row = { id: 'ENG-9', tracker: { linear: 'ENG-7' } };
    expect(issueKeyOf(row, 'linear', { ids: { mode: 'tracker' } })).toBe('ENG-9');
    expect(issueKeyOf(row, 'linear', {})).toBe('ENG-7');
    expect(issueKeyOf(row, 'linear', { ids: { mode: 'pattern' } })).toBe('ENG-7');
    expect(issueKeyOf({ id: 'ST-1' }, 'linear', {})).toBeUndefined();
    expect(issueKeyOf({ id: 'ST-1', tracker: { 'github-issues': '4' } }, 'linear', {})).toBeUndefined();
  });
});
