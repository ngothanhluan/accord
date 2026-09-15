// GATE-04 evidence references, GATE-09 the @ui scenario's note, GATE-10 the verification note.
// One extraction-and-resolution rule used twice (D-82), applied per evidence block with a separate
// non-blocking warning for a stray token (D-83), never accepting an identifier because core holds no
// source text (D-84), and deciding "the note is the scenario pasted back" by string equality and
// substring alone (D-85) — no length threshold, no similarity percentage, no numeric knob anywhere.
// A @ui scenario gets exactly these rules and no stricter variant (D-90).
// Pure string work over the snapshot: no Node built-in, no filesystem, no path join.
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { normaliseKey } from '../load/snapshot.js';
import type { RepoSnapshot, Ticket, Verification } from '../model/snapshot.js';
import type { GateRule } from './rules.js';

// D-74 discretion. One place, so extending it is one edit; a miss is preferred over a false positive,
// and a real path is usually caught by the `/` arm regardless of its extension.
const EXT = new Set(
  `ts tsx js jsx mjs cjs json yml yaml md html css scss sql py go rs java rb php sh xml toml txt vue
   svelte`.split(/\s+/),
);
// Stripped from both ends of a token: writers wrap a path in backticks, quotes, or brackets and end the
// sentence with a comma or a full stop.
const PUNCT = '`\'"“”‘’()[]{}<>,;:.!?';
// An editor-style `path:42` or `path:42:7` names a line inside a file, not a different file.
const POSITION = /:\d+(?::\d+)?$/;
const NOTE_BLOCK = /^###\s+@(ac-[1-9][0-9]*)\b/;
const NOTES = 'verification notes';

/** One whitespace-delimited token reduced to the thing that might be a path: punctuation off both ends,
 * then the position suffix. Returns '' when nothing is left. */
function token(raw: string): string {
  let a = 0;
  let b = raw.length;
  while (a < b && PUNCT.includes(raw[a])) a++;
  while (b > a && PUNCT.includes(raw[b - 1])) b--;
  return raw.slice(a, b).replace(POSITION, '');
}

/** D-82: a token is a reference candidate when it contains `/`, or carries a recognised extension, or
 * is a test id the report already named. `Object.hasOwn`, never `in`: an id called `toString` would
 * otherwise read as a known test through the prototype chain (T-04-17). */
function shaped(t: string, snapshot: RepoSnapshot): boolean {
  if (t.includes('/')) return true;
  const dot = t.lastIndexOf('.');
  if (dot >= 0 && EXT.has(t.slice(dot + 1))) return true;
  return Object.hasOwn(snapshot.tests ?? {}, t);
}

/** Every reference candidate in `text`, de-duplicated in first-appearance order (D-82). */
export function candidates(text: string, snapshot: RepoSnapshot): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const t = token(raw);
    if (t === '' || seen.has(t) || !shaped(t, snapshot)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * D-82: a candidate resolves when it is a test id, an exact tree path, or a **segment-boundary** suffix
 * of one. The `'/' + key` prefix is what stops `s.ts` from matching every `*s.ts` in the tree (T-04-15).
 * Comparison is exact code-point equality: case folding would pass on a case-insensitive filesystem and
 * fail on the CI runner. The tree is repo-relative posix (D-51) and is only ever membership-tested, so a
 * traversal or absolute path simply fails to resolve (T-04-13).
 */
export function resolves(candidate: string, snapshot: RepoSnapshot): boolean {
  if (Object.hasOwn(snapshot.tests ?? {}, candidate)) return true;
  const key = normaliseKey(candidate);
  return snapshot.tree.includes(key) || snapshot.tree.some((p) => p.endsWith('/' + key));
}

/** The candidates that name nothing in the snapshot, de-duplicated in first-appearance order (D-83). */
export function unresolvedRefs(text: string, snapshot: RepoSnapshot): string[] {
  return candidates(text, snapshot).filter((c) => !resolves(c, snapshot));
}

/** Every resolving reference removed whole — its backticks and its trailing comma go with it, because
 * the unit dropped is the token, not a substring inside it (D-85). */
export function stripRefs(text: string, snapshot: RepoSnapshot): string {
  const drop = new Set(candidates(text, snapshot).filter((c) => resolves(c, snapshot)));
  return text
    .split(/\s+/)
    .filter((raw) => raw !== '' && !drop.has(token(raw)))
    .join(' ');
}

/**
 * D-85 normalisation: lower case, punctuation and symbols to a space, whitespace collapsed. Combining
 * marks and precomposed letters are left alone — content in Vietnamese is the expected case, and folding
 * diacritics would make `trả` and `tra` the same word and manufacture a false match.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The `### @ac-n` blocks under `## Verification notes`, keyed by tag. The first block carrying a tag
 * wins, as the loader does for duplicate headings (D-40). An orphan tag is returned: whether it matches
 * a scenario is `lint.note-orphan`'s business, not this function's. */
export function noteBlocks(ticket: Ticket): Record<string, { line: number; text: string }> {
  const out: Record<string, { line: number; text: string }> = {};
  const section = ticket.sections.find((s) => headingKey(s.heading) === NOTES);
  if (section === undefined) return out;
  let open: { tag: string; line: number; lines: string[] } | undefined;
  const close = () => {
    if (open !== undefined && !Object.hasOwn(out, open.tag)) {
      out[open.tag] = { line: open.line, text: open.lines.join('\n').trim() };
    }
  };
  for (const l of stripHtmlComments(section.lines)) {
    const m = NOTE_BLOCK.exec(l.text);
    if (m) {
      close();
      open = { tag: m[1], line: l.line, lines: [] };
    } else {
      open?.lines.push(l.text);
    }
  }
  close();
  return out;
}

// --- The Human layer: does the evidence name anything real, and does the note say anything of its own? ---

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';
const ticketOf = (snapshot: RepoSnapshot, id: string): Ticket | undefined =>
  Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
const verificationOf = (snapshot: RepoSnapshot, id: string): Verification | undefined =>
  Object.hasOwn(snapshot.verifications, id) ? snapshot.verifications[id] : undefined;
/** GATE-10's driver set: the ticked tags, in numeric order, so two failing notes read the same way on
 * every host. At Done the three sets must be equal anyway (GATE-02). */
const ticked = (ticket: Ticket): string[] =>
  [...new Set(ticket.frontmatter?.verified ?? [])].sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
const cites = (text: string, snapshot: RepoSnapshot): boolean =>
  candidates(text, snapshot).some((c) => resolves(c, snapshot));

/**
 * GATE-04 (D-83): the unit is the whole `## @ac-n` block, never a single line — a line of context
 * followed by the citation is the most natural way a human writes evidence. An empty block cites
 * nothing and fails the same way.
 */
export const evidenceUnresolved: GateRule['check'] = (snapshot, id) => {
  const v = verificationOf(snapshot, id);
  if (v === undefined) return [];
  return v.blocks
    .filter((b) => !cites(b.evidence, snapshot))
    .map((b) => ({
      file: v.file,
      line: b.line,
      reason: `evidence block "@${b.acTag}" cites no file, test, or command that exists in the snapshot`,
    }));
};

/** D-83, warning: a writer who cited real evidence and mistyped one character still passes GATE-04. This
 * never changes the verdict and can never stand in for `gate.evidence-unresolved`. */
export const referenceUnknown: GateRule['check'] = (snapshot, id) => {
  const v = verificationOf(snapshot, id);
  if (v === undefined) return [];
  return v.blocks.flatMap((b) =>
    unresolvedRefs(b.evidence, snapshot).map((t) => ({
      file: v.file,
      line: b.line,
      reason: `evidence block "@${b.acTag}" names "${t}", which is not in the snapshot`,
    })),
  );
};

/** GATE-10: a tick with no note is a claim nobody wrote down. */
export const noteMissing: GateRule['check'] = (snapshot, id) => {
  const t = ticketOf(snapshot, id);
  if (t === undefined) return [];
  const blocks = noteBlocks(t);
  const line = t.sections.find((s) => headingKey(s.heading) === NOTES)?.line;
  return ticked(t)
    .filter((tag) => !Object.hasOwn(blocks, tag))
    .map((tag) => ({
      file: ticketFile(id),
      ...(line === undefined ? {} : { line }),
      reason: `verified lists @${tag} but "## Verification notes" has no "### @${tag}" block`,
    }));
};

/** GATE-10 via D-84: "symbol present in the snapshot" is the D-82 rule and nothing else. */
export const noteUnresolved: GateRule['check'] = (snapshot, id) => {
  const t = ticketOf(snapshot, id);
  if (t === undefined) return [];
  const blocks = noteBlocks(t);
  return ticked(t)
    .filter((tag) => Object.hasOwn(blocks, tag) && !cites(blocks[tag].text, snapshot))
    .map((tag) => ({
      file: ticketFile(id),
      line: blocks[tag].line,
      reason: `note "@${tag}" names no file or test that exists in the snapshot; a bare identifier is not enough, because the snapshot holds no source text`,
    }));
};

/**
 * GATE-10 via D-85: remove every resolving reference, normalise what is left, and fail when it is empty
 * or is a substring of the scenario's own text. A note may quote the scenario and then explain — that
 * remainder contains the scenario rather than being contained by it. No threshold is involved, in either
 * direction. A tag no scenario carries is skipped: that is `lint.note-orphan`'s business.
 */
export const notePasted: GateRule['check'] = (snapshot, id) => {
  const t = ticketOf(snapshot, id);
  if (t === undefined) return [];
  const blocks = noteBlocks(t);
  return ticked(t).flatMap((tag) => {
    const block = Object.hasOwn(blocks, tag) ? blocks[tag] : undefined;
    const scenario = t.scenarios.find((s) => s.acTag === tag);
    if (block === undefined || scenario === undefined) return [];
    const remainder = normalise(stripRefs(block.text, snapshot));
    const text = normalise(scenario.name + ' ' + scenario.steps.join(' '));
    if (remainder !== '' && !text.includes(remainder)) return [];
    return [
      {
        file: ticketFile(id),
        line: block.line,
        reason: `note "@${tag}" adds nothing beyond the scenario text and its references`,
      },
    ];
  });
};
