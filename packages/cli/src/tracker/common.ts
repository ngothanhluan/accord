// ST-LN-97 what every tracker adapter shares: the printable-ASCII filter, the request bounds, the
// bounded-parallel map and the one-line warning. Read-only and load-bearing for nothing: a failure
// here is a warning on stderr, never a verdict or an exit code (D-99, D-100).

/** `status` is a screen someone waits on, so a slow tracker is a failed tracker. */
export const REQUEST_TIMEOUT_MS = 5000;

/** D-101: at most this many requests in flight at once, so a long ticket list cannot flood a tracker. */
export const CONCURRENCY = 8;

/**
 * Untrusted text on its way to a terminal (T-05-19). Anything outside printable ASCII — a C0 control,
 * an escape, a carriage return, a multi-byte character — becomes a space, runs collapse, and the
 * result is trimmed. One issue title is therefore always one line that no `padEnd` can mis-measure.
 */
export function ascii(value: unknown): string {
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
 * Text from a tracker or from a failed request, safe to print: printable ASCII, and the secret itself
 * (when a server or a socket error echoes it back) replaced, so no message can carry a token (T-05-17).
 */
export function scrub(value: unknown, secret: string): string {
  const text = String(value ?? '');
  return ascii(secret === '' ? text : text.split(secret).join('***'));
}

/**
 * `fn` over `items` with at most `limit` running at once; the results keep the order of `items`, so
 * which response completed first changes nothing a caller can see (D-101). `fn` must not reject.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * The one warning line, or none: `tracker <label>: <failed keys with reasons>; <notes>`. Failures keep
 * the order of the keys asked for, so the line does not depend on which response completed first.
 */
export function warningLine(label: string, failures: readonly string[], notes: readonly string[] = []): string | undefined {
  const parts: string[] = [];
  if (failures.length > 0) parts.push(failures.join(', '));
  parts.push(...notes);
  return parts.length === 0 ? undefined : 'tracker ' + label + ': ' + parts.join('; ');
}
