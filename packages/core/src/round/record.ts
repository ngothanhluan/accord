// ST-LN-17: review.md and plan-review.md read as round records. Pure string work, no git.
import { normaliseText } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';
import type { Line, RecordedRound, RoundCycle, RoundFinding, RoundRecord, Severity } from '../model/snapshot.js';

export const ROUND_RECORD_LINE = 'Round record: 1';
export const ROUND_RECORD_LINE_2 = 'Round record: 2';

const ROUND = /^round(?:\s+([0-9]+)\b.*)?$/;
const RETURN = /^return from verify(?:\s+(\S+))?$/i;
const CLOSED = /^closed\b/;
// ST-LN-57: a version 2 heading as headingKey writes it: the head, then at most one mark.
const HEADING_2 = /^round [0-9]+ head ([0-9a-f]{7,40})(?: \((added code round 1|final review)\))?$/;
const SHA = /^[0-9a-f]{7,40}$/i;
// ST-LN-57: the version 2 finding line, read from the end (see parseFindingV2).
const FINDING_2 = /^(Must|Should|Nice) ([1-9][0-9]*)(?: \[(?:patch|plan-gap|intent-gap)\])?: (\S.*)$/i;
const LOCATION = /^(?:`([^`]+)`|([^\s`](?:.*?[^\s`])?))(?::[1-9][0-9]*(?:-[1-9][0-9]*)?)?$/;
const STATE = /^(open|deferred|fixed in [0-9a-f]{7,40})$/;
const VERDICT = /^verdict:\s*(\S+)(.*)$/;
const QUOTED = /^\s+".*\S.*"\s*$/;
const HEAD_NOISE = /^(?:[-*+>]\s+|\d+[.)]\s*|[*_~`]+|[([]\s*)/;
const SEVERITY = new Map<string, Severity>([['must', 'Must'], ['should', 'Should'], ['nice', 'Nice']]);
// What follows a severity word when the writer could not decide: another separator, or a second severity.
const DOUBTFUL = /^\s*(?:[/|?]|(?:or|and)\s+(?:must|should|nice)\b)/i;

const dequote = (v: string): string => (v.length >= 2 && v.startsWith('`') && v.endsWith('`') ? v.slice(1, -1) : v);

/** Split a line on ' — ' outside double quotes and backticks; a quote with no closing twin is plain text. */
function splitDashes(line: string): string[] {
  const parts: string[] = [];
  let from = 0;
  for (let i = 0; i < line.length; ) {
    const c = line[i];
    if ((c === '"' || c === '`') && line.indexOf(c, i + 1) !== -1) {
      i = line.indexOf(c, i + 1) + 1;
    } else if (line.startsWith(' — ', i)) {
      parts.push(line.slice(from, i));
      i += 3;
      from = i;
    } else {
      i++;
    }
  }
  parts.push(line.slice(from));
  return parts;
}

type Mark = Pick<RoundFinding, 'carried' | 'risk' | 'test' | 'command' | 'restsOn'>;

/** One trailing segment as a mark, or undefined when it is none. */
function readMark(seg: string): Mark | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^carried from ([1-9][0-9]*)\.([1-9][0-9]*)$/.exec(seg))) return { carried: { round: Number(m[1]), n: Number(m[2]) } };
  if ((m = /^risk: (data-loss|security)$/.exec(seg))) return { risk: m[1] as 'data-loss' | 'security' };
  if ((m = /^test: (\S.*)$/.exec(seg))) return { test: dequote(m[1]) };
  if ((m = /^command: (\S.*)$/.exec(seg))) return { command: dequote(m[1]) };
  if ((m = /^rests on: (ac-[1-9][0-9]*)$/.exec(seg))) return { restsOn: { kind: 'ac', ref: m[1] } };
  if ((m = /^rests on: (D-[0-9]{2,})$/.exec(seg))) return { restsOn: { kind: 'decision', ref: m[1] } };
  if ((m = /^rests on: (Veto|Intent|Understood|Done when) "(.*\S.*)"$/.exec(seg))) {
    return { restsOn: { kind: m[1] as 'Veto' | 'Intent' | 'Understood' | 'Done when', ref: m[2] } };
  }
  return undefined;
}

/** A version 2 finding line: `<Severity> <n>[ [class]]: <finding> — <location> — <state>[ — <mark>]…`, read from the end. */
function parseFindingV2(line: string): Omit<RoundFinding, 'line' | 'text'> | undefined {
  const head = FINDING_2.exec(line);
  if (head === null) return undefined;
  const segs = splitDashes(head[3]);
  const marks: Mark = {};
  while (segs.length > 2) {
    const mark = readMark(segs[segs.length - 1].trim());
    if (mark === undefined) break;
    const [kind] = Object.keys(mark) as (keyof Mark)[];
    if (marks[kind] !== undefined) return undefined; // each kind at most once
    Object.assign(marks, mark);
    segs.pop();
  }
  if (segs.length < 3) return undefined;
  const state = STATE.exec(segs[segs.length - 1].trim());
  const where = segs[segs.length - 2].trim();
  if (state === null) return undefined;
  const loc = where === 'none' ? null : LOCATION.exec(where);
  if (where !== 'none' && loc === null) return undefined;
  const file = loc === null ? undefined : (loc[1] ?? loc[2]);
  if (segs.slice(0, -2).join('').trim() === '') return undefined;
  return {
    severity: SEVERITY.get(head[1].toLowerCase())!,
    n: Number(head[2]),
    ...(file !== undefined ? { file } : {}),
    state: state[1].startsWith('fixed') ? 'fixed' : (state[1] as 'open' | 'deferred'),
    ...marks,
  };
}

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
  let version2 = false;
  for (let n = 1; n < firstHeading; n++) {
    const t = textOf(n)?.trim();
    if (t === ROUND_RECORD_LINE) versioned = true;
    else if (kind === 'review' && t === ROUND_RECORD_LINE_2) versioned = version2 = true;
  }

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
      if (version2) {
        const h = HEADING_2.exec(key);
        if (h === null) {
          bad(section.line, `line ${section.line}: ${shown} is not ## Round <n> head <sha>, optionally followed by (added code round 1) or (final review)`);
        } else {
          round.head = h[1];
          if (h[2] === 'added code round 1') round.added = true;
          else if (h[2] === 'final review') round.final = true;
        }
      }
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
        if (target === undefined) {
          bad(l.line, `line ${l.line}: a finding outside a ## Round section`);
        } else if (!version2) {
          target.findings.push({ severity: r.severity, line: l.line, text: t.trim() } satisfies RoundFinding);
        } else {
          const shown = t.trim().replace(/^[-*+] /, '');
          const f = parseFindingV2(shown);
          if (f === undefined) {
            bad(l.line, `line ${l.line}: a finding of a version 2 record reads <Severity> <n>[ [class]]: <finding> — <path>[:<line>] or none — open, fixed in <sha> or deferred, then its marks: "${shown}"`);
          } else if (target.findings.some((x) => x.n === f.n)) {
            bad(l.line, `line ${l.line}: finding number ${f.n} is used twice in round ${positions.get(target)}: "${shown}"`);
          } else {
            target.findings.push({ ...f, line: l.line, text: t.trim() });
          }
        }
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
      for (const f of round.findings) {
        const c = f.carried;
        if (c === undefined) continue;
        const earlier = c.round < position ? cycle.rounds[c.round - 1] : undefined;
        if (earlier === undefined || !earlier.findings.some((x) => x.n === c.n)) {
          bad(f.line, `line ${f.line}: "carried from ${c.round}.${c.n}" names no finding ${c.n} of an earlier round of this cycle: "${f.text}"`);
        }
      }
      const verdict = kind === 'review' ? cycle.verdicts.find((v) => v.line < round.line) : undefined;
      if (verdict) {
        bad(round.line, `line ${round.line}: a round follows the verdict at line ${verdict.line} with no ## Return from verify between them`);
      }
    }
  }

  unreadable.sort((a, b) => a.line - b.line);
  return { file, kind, versioned, ...(version2 ? { version: 2 as const } : {}), cycles, unreadable };
}
