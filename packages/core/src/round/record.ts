// ST-LN-17: review.md and plan-review.md read as round records. Pure string work, no git.
import { normaliseText } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';
import type { Line, RecordedRound, RoundCycle, RoundFinding, RoundRecord, Severity } from '../model/snapshot.js';

export const ROUND_RECORD_LINE = 'Round record: 1';

const ROUND = /^round(?:\s+([0-9]+)\b.*)?$/;
const RETURN = /^return from verify(?:\s+(\S+))?$/i;
const CLOSED = /^closed\b/;
const SHA = /^[0-9a-f]{7,40}$/i;
const VERDICT = /^verdict:\s*(\S+)(.*)$/;
const QUOTED = /^\s+".*\S.*"\s*$/;
const HEAD_NOISE = /^(?:[-*+>]\s+|\d+[.)]\s*|[*_~`]+|[([]\s*)/;
const SEVERITY = new Map<string, Severity>([['must', 'Must'], ['should', 'Should'], ['nice', 'Nice']]);
// What follows a severity word when the writer could not decide: another separator, or a second severity.
const DOUBTFUL = /^\s*(?:[/|?]|(?:or|and)\s+(?:must|should|nice)\b)/i;

/** The preamble Ruling on an open cycle: the cycle holds a round and none of its verdicts has a line after its last round's heading line. */
export function cycleOpen(cycle: RoundCycle): boolean {
  const last = cycle.rounds[cycle.rounds.length - 1];
  return last !== undefined && !cycle.verdicts.some((v) => v.line > last.line);
}

type Read =
  | { kind: 'prose' }
  | { kind: 'verdict'; value: string; quoted: boolean }
  | { kind: 'none' }
  | { kind: 'finding'; severity: Severity }
  | { kind: 'unreadable'; reason: string };

function readLine(text: string): Read {
  const trimmed = text.trim();
  const v = VERDICT.exec(trimmed);
  if (v) return { kind: 'verdict', value: v[1], quoted: v[1] === 'accepted-by-owner' && QUOTED.test(v[2]) };
  let head = trimmed;
  for (let m = HEAD_NOISE.exec(head); m; m = HEAD_NOISE.exec(head)) head = head.slice(m[0].length);
  if (/^no findings\b/i.test(head)) return { kind: 'none' };
  const word = /^[A-Za-z]+/.exec(head)?.[0];
  const severity = word === undefined ? undefined : SEVERITY.get(word.toLowerCase());
  if (severity === undefined) return { kind: 'prose' };
  const rest = head.slice(word!.length).replace(/^[*_~`)\]]+/, '');
  if (rest === '' || DOUBTFUL.test(rest)) {
    return { kind: 'unreadable', reason: `a finding whose severity accord cannot read: "${trimmed}"` };
  }
  return { kind: 'finding', severity };
}

/** Read one review.md or plan-review.md into cycles of rounds; a line accord cannot read is reported, never skipped. */
export function parseRounds(file: string, text: string, kind: 'review' | 'plan'): RoundRecord {
  const normal = normaliseText(text);
  const { sections, fences } = scan(normal, 0);
  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
  const all: Line[] = normal.split('\n').map((t, i) => ({ line: i + 1, text: t }));
  // Fenced lines are dropped, then comments are cut from what is left; both across the whole file.
  const visible = new Map(stripHtmlComments(all.filter((l) => !inFence(l.line))).map((l) => [l.line, l.text]));
  const textOf = (n: number) => visible.get(n);

  const firstHeading = sections[0]?.line ?? all.length + 1;
  let versioned = false;
  for (let n = 1; n < firstHeading; n++) if (textOf(n)?.trim() === ROUND_RECORD_LINE) versioned = true;

  const unreadable: { line: number; reason: string }[] = [];
  const bad = (line: number, reason: string) => unreadable.push({ line, reason });
  const cycles: RoundCycle[] = [{ line: 1, rounds: [], verdicts: [] }];
  const positions = new Map<RecordedRound, number>();
  const allowed = kind === 'review' ? '(## Round <n>, ## Return from verify <sha>)' : '(## Round <n>, ## Closed)';

  for (const section of sections) {
    let cycle = cycles[cycles.length - 1];
    const key = headingKey(section.heading);
    const shown = `"## ${section.heading}"`;
    let round: RecordedRound | undefined;
    let next: RoundCycle | undefined;
    const m = ROUND.exec(key);
    if (m && m[1] !== undefined) {
      round = { line: section.line, findings: [], noFindings: false };
      cycle.rounds.push(round);
      positions.set(round, cycle.rounds.length);
    } else if (m) {
      bad(section.line, `line ${section.line}: ${shown} names no round number`);
    } else if (kind === 'review' && RETURN.test(key)) {
      const sha = RETURN.exec(section.heading.trim().replace(/\s+/g, ' '))?.[1];
      const ok = sha !== undefined && SHA.test(sha);
      if (!ok) bad(section.line, `line ${section.line}: "## Return from verify" names no commit sha`);
      cycle = { line: section.line, ...(ok ? { marker: sha } : {}), rounds: [], verdicts: [] };
      cycles.push(cycle);
    } else if (kind === 'plan' && CLOSED.test(key)) {
      cycle.closed = section.line;
      next = { line: section.line + 1, rounds: [], verdicts: [] };
    } else {
      bad(section.line, `line ${section.line}: ${shown} is not a heading a round record holds ${allowed}`);
    }

    // Lines of an unknown heading are still read, against the cycle's last round when there is one.
    const target = round ?? cycle.rounds[cycle.rounds.length - 1];
    for (const l of section.lines) {
      const t = textOf(l.line);
      if (t === undefined) continue;
      const r = readLine(t);
      if (r.kind === 'verdict') {
        cycle.verdicts.push({ value: r.value, quoted: r.quoted, line: l.line });
      } else if (r.kind === 'none' && target !== undefined) {
        target.noFindings = true;
      } else if (r.kind === 'unreadable') {
        bad(l.line, `line ${l.line}: ${r.reason}`);
      } else if (r.kind === 'finding') {
        if (target === undefined) bad(l.line, `line ${l.line}: a finding outside a ## Round section`);
        else target.findings.push({ severity: r.severity, line: l.line, text: t.trim() } satisfies RoundFinding);
      }
    }
    if (next !== undefined) cycles.push(next);
  }

  for (const cycle of cycles) {
    for (const round of cycle.rounds) {
      const position = positions.get(round)!;
      const where = `round ${position} at line ${round.line}`;
      const lists = round.findings.length > 0;
      if (!lists && !round.noFindings) bad(round.line, `${where} holds no finding and no "No findings" line`);
      if (lists && round.noFindings) bad(round.line, `${where} says No findings and lists findings`);
      const verdict = kind === 'review' ? cycle.verdicts.find((v) => v.line < round.line) : undefined;
      if (verdict) {
        bad(round.line, `line ${round.line}: a round follows the verdict at line ${verdict.line} with no ## Return from verify between them`);
      }
    }
  }

  unreadable.sort((a, b) => a.line - b.line);
  return { file, kind, versioned, cycles, unreadable };
}
