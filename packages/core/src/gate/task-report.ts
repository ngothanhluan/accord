// ST-LN-59 D-07: the executor's report file, read as lines. `accord brief` prints REPORT_CONTRACT under its `Report file:` line, and `accord task-done` joins
// reportReasons(text) to its refusal reasons, so the brief and the check name one set of keys. The check proves the lines are there, not that they are true;
// the reviewer and the verifier stay the check on that (CONTEXT Ruling). Pure: the file read and HEAD's author time are the host's.

/** The lines `accord brief` prints under `Report file:` (D-07, D-18): the keys `reportReasons` reads, so an executor of every runtime meets them before task-done does. */
export const REPORT_CONTRACT = [
  'Write this file as your last step, after your last commit. It holds these two lines:',
  'red reason: <the behaviour the failing test showed missing, not an error in the test>',
  'self-review: missing: <...>; extra: <...>; misread: <...>',
  'A part with nothing to say is none. accord task-done refuses the task without both lines.',
  '',
].join('\n');

const PARTS = ['missing:', 'extra:', 'misread:'] as const;
// One linear pass over a line; the lookbehind keeps `dismissing:` from reading as `missing:`.
const PART_KEY = /(?<![A-Za-z])(missing|extra|misread):/g;

/** The first line that starts, after leading spaces, with `key`; its text after the key, or undefined when no line does. trim() also drops a BOM and the CR of CRLF. */
function lineValue(text: string, key: string): string | undefined {
  for (const raw of text.split('\n')) {
    const line = raw.trimStart();
    if (line.startsWith(key)) return line.slice(key.length).trim();
  }
  return undefined;
}

/** `value` without the characters of `drop` at either end: a loop, so a long run of them costs one pass (a backtracking expression would cost a pass per start). */
function stripEdges(value: string, drop: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && drop.includes(value[start])) start++;
  while (end > start && drop.includes(value[end - 1])) end--;
  return value.slice(start, end);
}

/** The value as compared: no edge spaces or full stops, lower case. */
const plain = (value: string): string => stripEdges(value, ' \t.').toLowerCase();

/** The template's own placeholder (`<...>`), `TBD`, `-` and an empty text name nothing. */
function placeholder(value: string): boolean {
  const v = plain(value);
  return v === '' || v === '-' || v === 'tbd' || (v.startsWith('<') && v.endsWith('>'));
}

/** `none` and `n/a` also say nothing about the behaviour a red test showed missing. */
function emptyReason(value: string): boolean {
  const v = plain(value);
  return placeholder(value) || v === 'none' || v === 'n/a';
}

/** The text after each of `missing:`, `extra:` and `misread:` in a self-review value, up to the next key; a key that is absent is not in the map. */
function partsOf(value: string): Map<string, string> {
  const found = [...value.matchAll(PART_KEY)];
  const parts = new Map<string, string>();
  found.forEach((m, i) => {
    const key = m[1] + ':';
    if (parts.has(key)) return; // the first of a repeated key counts
    const end = i + 1 < found.length ? found[i + 1].index : value.length;
    parts.set(key, stripEdges(value.slice(m.index + m[0].length, end), ' \t;'));
  });
  return parts;
}

/**
 * The reasons an executor report does not hold what task-done needs: a `red reason:` line naming the behaviour the failing test showed missing, and a `self-review:`
 * line with `missing:`, `extra:` and `misread:` each followed by text (`none` is text). Empty when both are there. The first line of each key is read.
 */
export function reportReasons(text: string): string[] {
  const out: string[] = [];
  const red = lineValue(text, 'red reason:');
  if (red === undefined || emptyReason(red)) {
    out.push('the executor report has no "red reason:" line naming the behaviour the red test showed missing');
  }
  const self = lineValue(text, 'self-review:');
  if (self === undefined) {
    out.push('the executor report has no "self-review:" line');
  } else {
    const parts = partsOf(self);
    for (const key of PARTS) {
      const part = parts.get(key);
      if (part === undefined) out.push(`the executor report's "self-review:" line lacks "${key}"`);
      else if (placeholder(part)) out.push(`the executor report's "self-review:" line has no text after "${key}"`);
    }
  }
  return out;
}
