// INTG-01 `github-issues` adapter. Read-only and load-bearing for nothing: it issues GET requests,
// writes to no repository and to no file, and every failure degrades to a warning rather than an
// exception, so a tracker outage cannot change a verdict or an exit code (D-99, D-100). Token lookup
// is GITHUB_TOKEN then `gh auth token`, and neither is required (D-102); one GET per referenced issue,
// in parallel, with no list endpoint and no pagination (D-101).
import { execFileSync } from 'node:child_process';

export interface IssueFacts {
  title: string;
  state: string;
  labels: string[];
}

/**
 * Untrusted text on its way to a terminal (T-05-19). Anything outside printable ASCII — a C0 control,
 * an escape, a carriage return, a multi-byte character — becomes a space, runs collapse, and the
 * result is trimmed. One issue title is therefore always one line that no `padEnd` can mis-measure.
 */
function ascii(value: unknown): string {
  return [...String(value ?? '')]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp >= 0x20 && cp <= 0x7e ? ch : ' ';
    })
    .join('')
    .replace(/ +/g, ' ')
    .trim();
}

/**
 * D-102: the environment variable first — it costs no spawn and is how CI supplies a token — then
 * `gh`, spawned by name with a literal argument array and no shell (PITFALLS section 12). Every
 * failure of that spawn, ENOENT included, means "no token": it is never rethrown and never an error.
 */
function findToken(env: NodeJS.ProcessEnv): string | undefined {
  const fromEnv = env.GITHUB_TOKEN;
  if (typeof fromEnv === 'string' && fromEnv !== '') return fromEnv;
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out === '' ? undefined : out;
  } catch {
    return undefined;
  }
}

/** Only title, state, and label names are read; an unknown field cannot travel any further. */
function factsOf(body: unknown): IssueFacts | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const raw = body as { title?: unknown; state?: unknown; labels?: unknown };
  if (typeof raw.title !== 'string' || typeof raw.state !== 'string') return undefined;
  const labels = Array.isArray(raw.labels)
    ? raw.labels
        .map((l) => ascii(typeof l === 'object' && l !== null ? (l as { name?: unknown }).name : l))
        .filter((l) => l !== '')
    : [];
  return { title: ascii(raw.title), state: ascii(raw.state), labels };
}

/** `status` is a screen someone waits on, so a slow tracker is a failed tracker. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Turn issue numbers into sanitised facts. Never rejects: a 404, an exhausted rate limit, a dead
 * network, or a body that is not an issue omits that one number and contributes to the single warning
 * the caller prints to stderr (D-100). The token is held in a local and travels only in an
 * Authorization header — it is interpolated into no message and no returned value (T-05-17).
 *
 * `fetchImpl` is the one seam in this file: it lets the tests drive every failure path without a
 * network, and defaults to the global `fetch` Node 22 provides — this adapter adds no dependency.
 */
export async function fetchIssues(
  repo: string,
  numbers: readonly string[],
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ issues: Record<string, IssueFacts>; warning?: string }> {
  if (numbers.length === 0) return { issues: {} };

  const token = findToken(env);
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    ...(token === undefined ? {} : { authorization: 'Bearer ' + token }),
  };

  const settled = await Promise.all(
    numbers.map(async (n): Promise<[string, IssueFacts | string]> => {
      try {
        const res = await fetchImpl('https://api.github.com/repos/' + repo + '/issues/' + n, {
          headers,
          // Without this a hung connection hangs `accord status` outright, which is the one
          // failure mode this adapter exists to rule out — the contract is that every tracker
          // failure degrades to a stderr line and an exit 0, and a hang degrades to nothing.
          // The abort rejects, so it lands in the catch below as an ordinary failure string.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) return [n, 'HTTP ' + res.status];
        const facts = factsOf(await res.json());
        return [n, facts ?? 'unexpected response body'];
      } catch (err) {
        // The request carries the token in a header, never in the URL, so no rejection message can
        // contain it; sanitised anyway, because this string reaches a terminal.
        return [n, ascii(err instanceof Error ? err.message : String(err)) || 'request failed'];
      }
    }),
  );

  const issues: Record<string, IssueFacts> = {};
  const failures: string[] = [];
  for (const [n, result] of settled) {
    if (typeof result === 'string') failures.push('#' + n + ' ' + result);
    else issues[n] = result;
  }

  // One line, or none. Order follows `numbers`, so the warning does not depend on which response
  // completed first (D-101).
  const parts: string[] = [];
  if (failures.length > 0) parts.push(failures.join(', '));
  if (token === undefined) parts.push('no GitHub token found (GITHUB_TOKEN unset, gh unavailable)');
  return { issues, ...(parts.length === 0 ? {} : { warning: 'tracker ' + repo + ': ' + parts.join('; ') }) };
}
