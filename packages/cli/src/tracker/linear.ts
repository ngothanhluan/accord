// ST-LN-97 D-13 the `linear` adapter. Read-only: one POST per distinct issue key to the fixed GraphQL
// endpoint, the personal API key from LINEAR_API_KEY sent as the raw Authorization header (Linear takes
// no `Bearer` for a personal key), at most CONCURRENCY in flight, REQUEST_TIMEOUT_MS each. Every failure
// is one warning line and an empty cell, never an exception, a verdict or an exit code (D-99, D-100).
// The key is held in a local and travels only in that header: it is in no URL, no query text, and no
// string this file returns, because every message is scrubbed of it (T-05-17).
import { CONCURRENCY, REQUEST_TIMEOUT_MS, ascii, mapLimit, scrub, warningLine } from './common.js';
import type { IssueFacts, TrackerAdapter, TrackerResult } from './index.js';

const ENDPOINT = 'https://api.linear.app/graphql';

// `issue(id:)` takes a team key and number ("ENG-123") as well as a uuid (linear.app/developers/graphql).
// The field names `state { name }` and `labels { nodes { name } }` are checked live in plan 03.1-32.
const QUERY =
  'query Issue($id: String!) { issue(id: $id) { identifier title state { name } labels { nodes { name } } } }';

/** Only title, state name and label names are read; an unknown field cannot travel any further. */
function factsOf(issue: unknown): IssueFacts | undefined {
  if (typeof issue !== 'object' || issue === null) return undefined;
  const raw = issue as { title?: unknown; state?: unknown; labels?: unknown };
  const state = typeof raw.state === 'object' && raw.state !== null ? (raw.state as { name?: unknown }).name : undefined;
  if (typeof raw.title !== 'string' || typeof state !== 'string') return undefined;
  const nodes = typeof raw.labels === 'object' && raw.labels !== null ? (raw.labels as { nodes?: unknown }).nodes : undefined;
  const labels = Array.isArray(nodes)
    ? nodes
        .map((n) => ascii(typeof n === 'object' && n !== null ? (n as { name?: unknown }).name : n))
        .filter((l) => l !== '')
    : [];
  return { title: ascii(raw.title), state: ascii(state), labels };
}

/**
 * Turn issue keys into sanitised facts. Never rejects. A missing key makes no request at all. A GraphQL
 * `errors` array, a null `issue`, an HTTP error, a rejection, a timeout or a body that is not JSON each
 * omit that one key and add to the single warning the caller prints to stderr.
 *
 * `fetchImpl` is the one seam: it lets the tests drive every failure path without a network, and
 * defaults to the global `fetch` Node 22 provides, so the adapter adds no dependency.
 */
export async function fetchLinear(
  keys: readonly string[],
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<TrackerResult> {
  const distinct = [...new Set(keys)];
  if (distinct.length === 0) return { issues: {} };

  const token = env.LINEAR_API_KEY;
  if (typeof token !== 'string' || token === '') {
    return { issues: {}, warning: 'tracker linear: LINEAR_API_KEY is not set' };
  }

  const settled = await mapLimit(distinct, CONCURRENCY, async (key): Promise<[string, IssueFacts | string]> => {
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: token },
        body: JSON.stringify({ query: QUERY, variables: { id: key } }),
        // A redirect would carry the key to another host.
        redirect: 'error',
        // Without this a hung connection hangs `accord status`; the abort rejects and lands in the catch
        // below as an ordinary failure.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) return [key, 'HTTP ' + res.status];
      const body = (await res.json()) as { data?: { issue?: unknown }; errors?: unknown };
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        const first = body.errors[0] as { message?: unknown } | undefined;
        return [key, scrub(first?.message, token) || 'GraphQL error'];
      }
      const facts = factsOf(body.data?.issue);
      return [key, facts ?? 'no such issue'];
    } catch (err) {
      return [key, scrub(err instanceof Error ? err.message : String(err), token) || 'request failed'];
    }
  });

  const issues: Record<string, IssueFacts> = {};
  const failures: string[] = [];
  for (const [key, result] of settled) {
    if (typeof result === 'string') failures.push(key + ' ' + result);
    else issues[key] = result;
  }
  const warning = warningLine('linear', failures);
  return { issues, ...(warning === undefined ? {} : { warning }) };
}

export const linearAdapter: TrackerAdapter = {
  name: 'linear',
  fetch: (keys, env, io) => fetchLinear(keys, env, io.fetchImpl),
};
