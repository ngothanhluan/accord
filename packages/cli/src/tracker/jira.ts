// ST-LN-97 D-13 the `jira` adapter for Jira Cloud and for Server / Data Center. Read-only: one GET per
// distinct issue key, `<url>/rest/api/{3|2}/issue/<key>?fields=summary,status,labels`, at most
// CONCURRENCY in flight, REQUEST_TIMEOUT_MS each, `redirect: 'error'`. The legacy JQL search
// (`/rest/api/3/search`) is never called: Cloud answers it with 410 (RESEARCH Pitfall 9), and one GET per
// key is all a status row needs.
//
// Which variables are set decides the flavour, and nothing else does:
//   JIRA_EMAIL + JIRA_API_TOKEN  Jira Cloud: `Authorization: Basic base64(email:token)`, API v3
//   JIRA_PAT                     Server / Data Center: `Authorization: Bearer <pat>`, API v2 (Jira 8.14+)
// Both sets present use Cloud and say so in the one warning line. Half a Cloud pair is a setup mistake and
// warns, whether or not JIRA_PAT is set, because guessing which flavour was meant would send a credential
// to a host it was not issued for.
//
// A token leaves the machine only in that header, and only over https (T-03.1-38): `tracker.url` must be
// https at the schema and again here on every path, with no localhost or test exception. Every failure is
// one warning line and an empty cell, never an exception, a verdict or an exit code (D-99, D-100), and
// every message is scrubbed of each secret and of the encoded header (T-05-17).
import { CONCURRENCY, REQUEST_TIMEOUT_MS, ascii, mapLimit, warningLine } from './common.js';
import type { IssueFacts, TrackerAdapter, TrackerResult } from './index.js';

/** The same shape as the schema's `tracker.url`: https, a host, an optional path, no query or fragment. */
const HTTPS_URL = /^https:\/\/[^\s/?#@]+(\/[^\s?#]*)?$/;

interface Auth {
  header: string;
  api: '3' | '2';
  /** Everything that must never appear in a message: the raw secrets and the header value itself. */
  secrets: string[];
  note?: string;
}

const set = (value: string | undefined): value is string => typeof value === 'string' && value !== '';

/** The authentication the environment selects, or the warning that says why there is none. */
function authOf(env: NodeJS.ProcessEnv): Auth | { warning: string } {
  const email = env.JIRA_EMAIL;
  const token = env.JIRA_API_TOKEN;
  const pat = env.JIRA_PAT;
  if (set(email) && set(token)) {
    const header = 'Basic ' + Buffer.from(email + ':' + token).toString('base64');
    const secrets = [token, header, header.slice('Basic '.length)];
    if (set(pat)) secrets.push(pat);
    return {
      header,
      api: '3',
      secrets,
      ...(set(pat) ? { note: 'JIRA_PAT ignored (JIRA_EMAIL and JIRA_API_TOKEN are set)' } : {}),
    };
  }
  if (set(email)) return { warning: warningLine('jira', [], ['JIRA_API_TOKEN is not set (JIRA_EMAIL is)']) as string };
  if (set(token)) return { warning: warningLine('jira', [], ['JIRA_EMAIL is not set (JIRA_API_TOKEN is)']) as string };
  if (set(pat)) return { header: 'Bearer ' + pat, api: '2', secrets: [pat, 'Bearer ' + pat] };
  return { warning: warningLine('jira', [], ['no Jira token (JIRA_EMAIL+JIRA_API_TOKEN or JIRA_PAT)']) as string };
}

/** Only summary, status name and label names are read; an unknown field cannot travel any further. */
function factsOf(body: unknown): IssueFacts | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const fields = (body as { fields?: unknown }).fields;
  if (typeof fields !== 'object' || fields === null) return undefined;
  const raw = fields as { summary?: unknown; status?: unknown; labels?: unknown };
  const state = typeof raw.status === 'object' && raw.status !== null ? (raw.status as { name?: unknown }).name : undefined;
  if (typeof raw.summary !== 'string' || typeof state !== 'string') return undefined;
  const labels = Array.isArray(raw.labels) ? raw.labels.map((l) => ascii(l)).filter((l) => l !== '') : [];
  return { title: ascii(raw.summary), state: ascii(state), labels };
}

const scrubAll = (value: unknown, secrets: readonly string[]): string =>
  ascii(secrets.reduce((text, secret) => text.split(secret).join('***'), String(value ?? '')));

/**
 * Turn issue keys into sanitised facts. Never rejects. No request is made for an empty key list, for a
 * `baseUrl` that is not https, or for an environment with no usable token; each of the last two is one
 * warning. A 401, 403, 404, 410, a rejection, a timeout or a body that is not an issue omits that one
 * key and adds to the single warning line.
 *
 * `fetchImpl` is the one seam: it lets the tests drive every path without a network, and defaults to the
 * global `fetch` Node 22 provides, so the adapter adds no dependency.
 */
export async function fetchJira(
  baseUrl: string,
  keys: readonly string[],
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<TrackerResult> {
  const distinct = [...new Set(keys)];
  if (distinct.length === 0) return { issues: {} };

  const base = typeof baseUrl === 'string' ? baseUrl.replace(/\/+$/, '') : '';
  if (!HTTPS_URL.test(base)) {
    return { issues: {}, warning: 'tracker jira: tracker.url must be an https URL' };
  }

  const auth = authOf(env);
  if ('warning' in auth) return { issues: {}, warning: auth.warning };

  const settled = await mapLimit(distinct, CONCURRENCY, async (key): Promise<[string, IssueFacts | string]> => {
    try {
      const res = await fetchImpl(
        base + '/rest/api/' + auth.api + '/issue/' + encodeURIComponent(key) + '?fields=summary,status,labels',
        {
          method: 'GET',
          headers: { accept: 'application/json', authorization: auth.header },
          // A redirect would carry the token to another host.
          redirect: 'error',
          // Without this a hung connection hangs `accord status`; the abort rejects and lands in the catch.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!res.ok) return [key, 'HTTP ' + res.status];
      const facts = factsOf(await res.json());
      return [key, facts ?? 'no such issue'];
    } catch (err) {
      return [key, scrubAll(err instanceof Error ? err.message : String(err), auth.secrets) || 'request failed'];
    }
  });

  const issues: Record<string, IssueFacts> = {};
  const failures: string[] = [];
  for (const [key, result] of settled) {
    if (typeof result === 'string') failures.push(key + ' ' + result);
    else issues[key] = result;
  }
  const warning = warningLine('jira', failures, auth.note === undefined ? [] : [auth.note]);
  return { issues, ...(warning === undefined ? {} : { warning }) };
}

/** The adapter for the `tracker.url` the config names. */
export function jiraAdapter(url: string): TrackerAdapter {
  return {
    name: 'jira',
    fetch: (keys, env, io) => fetchJira(url, keys, env, io.fetchImpl),
  };
}
