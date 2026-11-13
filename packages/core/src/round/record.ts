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

// ST-LN-91 rounds 5 and 6 (owner decisions 2026-11-13): a risk is read structurally and never searched for in prose. A plan or approach line is read as segments split on ' — ' only (a hyphen,
// two hyphens or an en dash is part of the text of a state, a reason, a test or a command). The finding's mark slot is a segment after the finding's text, or, in the critic's block, a line
// under the finding that is indented deeper than it and whose key is `rests on`. A segment or line is a RISK SLOT when its key is `risk`, `risks` or `rests on` (markup, a bullet and a
// separator allowed around it) and its value is a security or data-loss kind written some way: right (`risk: security`, any letter case) or wrong (`risks: security`, `data_loss`, backticks,
// quotes, another hyphen, a comma, a semicolon, a full stop). A risk slot is read when readMark parses it; one that does not parse is a record problem. A value that is no such kind
// (`risk: none`, `risk: low`, `risk: a partial file is left on a crash`, `rests on: ac1`) is prose, as is every word anywhere else.
const MARKUP = '[\\s`\'"*_()[\\]]*';
const DASHES = '\\u2010-\\u2015\\u2212-';
const SLOT_HEAD = new RegExp(`^${MARKUP}(?:rests on\\s*[:;=]?\\s*${MARKUP})?risks?[\\s,:;=_${DASHES}]*${MARKUP}`, 'i');
const KIND_WORDS = new RegExp(`^([a-z]+)(?:[\\s_${DASHES}]*([a-z]+))?`, 'i');

/** True when `a` is `b` or differs from it by one letter: a substitution, an insertion, a deletion or two letters swapped. */
function oneOff(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const [x, y] = [a.slice(i), b.slice(i)];
  if (x.length === y.length) return x.slice(1) === y.slice(1) || (x.length >= 2 && x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2));
  return (x.length > y.length ? x.slice(1) === y : y.slice(1) === x);
}

/** A value that starts with a security or data-loss kind, written right or off by one letter (`security`, `secrity`, `data-loss`, `data_loss`, `dataloss`, `data lost`); `none`, `low` and a sentence are no kind. */
function kindLike(value: string): boolean {
  const m = KIND_WORDS.exec(value.toLowerCase());
  if (m === null) return false;
  // ST-LN-91 round 7 CR-01: the distance is measured over the whole kind string, the `data` part included, so `date-loss`, `dta-loss` and `data-los` are one edit off `data-loss` as `secrity` is off `security`.
  return oneOff(m[1], 'security') || oneOff(m[1], 'dataloss') || (m[2] !== undefined && oneOff(m[1] + m[2], 'dataloss'));
}

/** A segment or block line that sits in a risk slot, whether or not its value parses. */
function inMarkSlot(seg: string): boolean {
  const head = SLOT_HEAD.exec(seg);
  return head !== null && kindLike(seg.slice(head[0].length));
}
/** A trailing segment that has a mark key and a value that is no kind: no mark and no state, so the state is read from the segment before it (`fixed — risk: none`). */
const NEUTRAL_MARK = new RegExp(`^${MARKUP}(?:risks?|rests on)\\s*[:;=]`, 'i');
const isNeutral = (seg: string): boolean => NEUTRAL_MARK.test(seg) && !inMarkSlot(seg);
/** A block line is a mark slot only when its key is `rests on`, as agents/critic.md prints it; every other line under a finding is a note, which is prose. */
const BLOCK_KEY = new RegExp(`^${MARKUP}rests on\\b`, 'i');

/** A segment that is nothing but a severity word: the finding's text is then the next segment (` — `), else it is inside this one (`Must: <text>`, `Must - <text>`, `Must – <text>`). */
const SEVERITY_ONLY = /^[^A-Za-z]*(?:must|should|nice)\b[^A-Za-z0-9]*$/i;

const indentOf = (text: string): number => text.length - text.trimStart().length;

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
  // ST-LN-91 CR-01: the critic's template has the session copy `rests on: risk: security`; the letter case is the writer's.
  if ((m = /^(?:rests on:\s*)?risk:\s*(data-loss|security)$/i.exec(seg))) return { risk: m[1].toLowerCase() as 'data-loss' | 'security' };
  // The critic's block prints each alternative after `rests on:`, so `rests on: test: <id>` and `rests on: command: <command>` read as the bare marks do.
  if ((m = /^(?:rests on:\s*)?test: (\S.*)$/.exec(seg))) return { test: dequote(m[1]) };
  if ((m = /^(?:rests on:\s*)?command: (\S.*)$/.exec(seg))) return { command: dequote(m[1]) };
  if ((m = /^rests on: (ac-[1-9][0-9]*)$/.exec(seg))) return { restsOn: { kind: 'ac', ref: m[1] } };
  if ((m = /^rests on: (D-[0-9]{2,})$/.exec(seg))) return { restsOn: { kind: 'decision', ref: m[1] } };
  if ((m = /^rests on: (Veto|Correction|Intent|Understood|Done when) "(.*\S.*)"$/.exec(seg))) {
    return { restsOn: { kind: m[1] as 'Veto' | 'Correction' | 'Intent' | 'Understood' | 'Done when', ref: m[2] } };
  }
  return undefined;
}

/**
 * ST-LN-91 D-11: a version 1 plan or approach finding line `<n>. <Severity> — <finding> — <state>[ — <mark>]…`, read strictly (round 4): the separator is ' — ' only. The number, the state
 * (open and unverified read as open; `fixed`, `withdrawn[: <reason>]`, `repeated as <r>.<n>` and `owner: "..."` are closed states, each the whole segment), a `repeats <r>.<n>:` carry and the
 * trailing marks are read only when the line has them; a line that splits no further gives nothing, so it reads as before. `markUnread` holds the segments after the finding's text that sit in a mark slot and do not parse.
 */
function readFindingV1(text: string): Partial<Omit<RoundFinding, 'severity' | 'line' | 'text'>> & { markUnread?: string[] } {
  let t = text.trim().replace(/^[-*+] /, '');
  const out: Partial<Omit<RoundFinding, 'severity' | 'line' | 'text'>> & { markUnread?: string[] } = {};
  const num = /^([1-9][0-9]*)[.)]\s+/.exec(t);
  if (num !== null) {
    out.n = Number(num[1]);
    t = t.slice(num[0].length);
  }
  const segs = splitDashes(t);
  // ST-LN-91 round 6 CR-01: the segments before `head` are the severity word and the finding's text; the state and the marks come after them. The text is `segs[1]` after `Must — `
  // and the tail of `segs[0]` after `Must: `, `Must - ` or `Must – ` (the severity is no segment of its own there), so the position comes from the line, not from a fixed index.
  const head = SEVERITY_ONLY.test(segs[0]) ? 2 : 1;
  const marks: Mark = {};
  while (segs.length > head) {
    const last = segs[segs.length - 1].trim();
    const mark = readMark(last);
    if (mark === undefined) {
      if (!isNeutral(last)) break;
      segs.pop(); // ST-LN-91 round 6 WR-01: `risk: none`, `risk: <words>` or `rests on: <no ground>` after the state is neither a mark nor the state
      continue;
    }
    const [kind] = Object.keys(mark) as (keyof Mark)[];
    if (marks[kind] !== undefined) break; // a second mark of one kind is text of the finding
    Object.assign(marks, mark);
    segs.pop();
  }
  // A risk mark written before the state (`<finding> — risk: security — open`) is read too; its segment is taken out.
  for (let k = segs.length - 2; k >= head && marks.risk === undefined; k--) {
    const mark = readMark(segs[k].trim());
    if (mark?.risk !== undefined) {
      marks.risk = mark.risk;
      segs.splice(k, 1);
    }
  }
  if (segs.length > head) {
    const state = segs[segs.length - 1].trim();
    // An `unverified: <reason>` whose reason holds ' — ' is cut into segments; none of them is a state that closes the finding.
    if (segs.slice(head, -1).some((x) => /^unverified\b/.test(x.trim()))) out.state = 'open';
    else if (/^deferred\b/.test(state)) out.state = 'deferred';
    else if (/^(?:open|unverified)\b/.test(state)) out.state = 'open';
    else if (state === 'fixed') out.state = 'fixed';
    // critique.md: the states that close a finding with no fix: the critic's `withdrawn:`, a later round's `repeats`, the owner's drop.
    else if (/^withdrawn(?::.*)?$/.test(state)) out.state = 'withdrawn';
    else if (/^repeated as\b/.test(state)) {
      out.state = 'repeated';
      const to = /^repeated as ([1-9][0-9]*)\.([1-9][0-9]*)\s*$/.exec(state);
      if (to !== null) out.repeatedAs = { round: Number(to[1]), n: Number(to[2]) };
    }
    // The owner's drop needs the owner's words: a bare `owner:` closes nothing and reads as open.
    else if (/^owner:\s*".*\S.*"\s*$/.test(state)) out.state = 'owner';
  }
  // A mark slot whose value does not parse: a segment after the finding's text that starts with a mark key and is no mark read. Words anywhere else are prose.
  const unread = segs.slice(head).map((x) => x.trim()).filter((x) => inMarkSlot(x) && readMark(x) === undefined);
  if (unread.length > 0) out.markUnread = unread;
  const repeats = /^repeats ([1-9][0-9]*)\.([1-9][0-9]*):/.exec(t.replace(/^[^A-Za-z]*(?:must|should|nice)\b[^A-Za-z0-9]*/i, ''));
  if (marks.carried === undefined && repeats !== null) marks.carried = { round: Number(repeats[1]), n: Number(repeats[2]) };
  return { ...out, ...marks };
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
export function parseRounds(file: string, text: string, kind: 'review' | 'plan' | 'approach'): RoundRecord {
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
    } else if (kind !== 'review' && CLOSED.test(key)) {
      cycle.closed = section.line;
      next = { line: section.line + 1, rounds: [], verdicts: [] };
    } else {
      bad(section.line, `line ${section.line}: ${shown} is not a heading a round record holds ${allowed}`);
    }

    // Lines of an unknown heading are still read, against the cycle's last round when there is one.
    const target = round ?? cycle.rounds[cycle.rounds.length - 1];
    // ST-LN-91 rounds 5 and 6: the critic's block is the lines under a finding line that are indented deeper than it. Only a block line whose key is `rests on` is a mark slot: it is read as a
    // segment is (a risk, a ground, a test or a command), and one that is a risk slot and does not parse is kept on its round, where the record problems report it. Every other line, a
    // note that starts `Risk:` included, is prose, read as nothing. A line that is no deeper than the finding and comes with no blank line after it (a lazy continuation of the finding in
    // Markdown) is prose too, unless it is a risk slot: then it is a record problem, never silently ignored (WR-02), because the rendered record shows it on the finding.
    const strict = kind !== 'review' && !version2;
    let block: { f: RoundFinding; indent: number } | undefined;
    let lazy = false;
    const unread = (line: number, text: string) => {
      if (target !== undefined) (target.markUnread ??= []).push({ line, text: text.length > 160 ? text.slice(0, 157) + '...' : text });
    };
    for (const l of section.lines) {
      const t = textOf(l.line);
      if (t === undefined) continue;
      const r = readLine(t);
      if (r.kind !== 'prose' || t.trim() === '') lazy = false;
      if (strict && r.kind === 'prose' && t.trim() !== '') {
        const seg = t.trim().replace(/^[-*+]\s+/, '');
        if (block !== undefined && indentOf(t) > block.indent) {
          if (BLOCK_KEY.test(seg) && (readMark(seg) !== undefined || inMarkSlot(seg))) {
            const mark = readMark(seg);
            const key = mark === undefined ? undefined : (Object.keys(mark) as (keyof Mark)[])[0];
            // A mark that is no mark read (a risk slot written wrongly) is a record problem; so is a second risk that differs from the one the finding has. Any other second mark is read and never a
            // problem (round 7 CR-02): a second, different ground is kept beside the first, and the first test or command stays the one the finding has.
            if (mark === undefined || key === undefined) unread(l.line, t.trim());
            else if (block.f[key] === undefined) Object.assign(block.f, mark);
            else if (JSON.stringify(block.f[key]) !== JSON.stringify(mark[key])) {
              if (key === 'risk') unread(l.line, t.trim());
              else if (key === 'restsOn' && mark.restsOn !== undefined) (block.f.restsOnAlso ??= []).push(mark.restsOn);
            }
          }
        } else {
          if (lazy && inMarkSlot(seg)) unread(l.line, t.trim());
          block = undefined;
        }
        continue;
      }
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
          const { markUnread, ...read } = kind === 'review' ? {} as ReturnType<typeof readFindingV1> : readFindingV1(t);
          const finding: RoundFinding = { severity: r.severity, line: l.line, text: t.trim(), ...read };
          target.findings.push(finding);
          if (strict) {
            block = { f: finding, indent: indentOf(t) };
            lazy = true;
          }
          for (const x of markUnread ?? []) unread(l.line, x);
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
        if (c === undefined || !version2) continue; // a version 1 carry is read for the grounds rule, never checked
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
