// ST-LN-57: from round 3 a Should rests on a ticket line or a failing case (ac-4, D-07, D-11), and a file a fix changed
// is the location of a finding or is named by a Ruling (ac-5, D-14). Pure: the host supplies the round facts it read from
// git. No code runs at load but constants.
import { ownRecordsOnly } from '../gate/done.js';
import { factOf, isExempt } from '../gate/scope.js';
import { laneTicket, workOf } from '../gate/work.js';
import type { GateDraft, GateRule } from '../gate/rules.js';
import { LIST_MARKER, headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, RoundFinding, Ticket } from '../model/snapshot.js';
import { evidenceCount } from './evidence.js';
import { factsOf, fixCommits, placedRounds, skipped } from './scope.js';
import type { Placed } from './scope.js';

/** The count from which a Should needs grounds. */
const FROM_ROUND = 3;

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** The text of a ticket section, comments stripped and whitespace collapsed; '' when the ticket has no such section. */
function sectionText(ticket: Ticket, key: string): string {
  const s = ticket.sections.find((x) => headingKey(x.heading) === key);
  return s === undefined ? '' : collapse(stripHtmlComments(s.lines).map((l) => l.text).join(' '));
}

/** A quote of at least three whitespace-separated words found in the text. */
const quoted = (text: string, quote: string): boolean => {
  const q = collapse(quote);
  return q.split(' ').length >= 3 && text.includes(q);
};

/** The Ruling on `rests on`: the line a Should names exists in the ticket (lane S: only a quote of Understood or Done when). */
export function restsOnHolds(ticket: Ticket, f: RoundFinding): boolean {
  const r = f.restsOn;
  if (r === undefined) return false;
  const laneS = ticket.frontmatter?.lane === 'S';
  if (laneS) {
    if (r.kind === 'Understood') return quoted(sectionText(ticket, 'understood'), r.ref);
    if (r.kind === 'Done when') return quoted(sectionText(ticket, 'done when'), r.ref);
    return false;
  }
  if (r.kind === 'ac') return ticket.scenarios.some((s) => s.acTag === r.ref);
  if (r.kind === 'decision') {
    const section = ticket.sections.find((x) => headingKey(x.heading) === 'decisions');
    return (
      section !== undefined &&
      stripHtmlComments(section.lines).some((l) => {
        const t = l.text.replace(LIST_MARKER, '').trimStart();
        return t === r.ref || t.startsWith(r.ref + ' ');
      })
    );
  }
  if (r.kind === 'Veto') return quoted(sectionText(ticket, 'vetoes'), r.ref);
  if (r.kind === 'Intent') return quoted(sectionText(ticket, 'intent'), r.ref);
  return false;
}

/** True when `f`, a finding of the round `at`, is a new Should from round 3 that asks grounds (version 2 record with facts, not skipped). */
export function needsGrounds(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean {
  const rec = workOf(snapshot, id)?.rounds;
  const facts = factsOf(snapshot, id);
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || facts === undefined || 'error' in facts) return false;
  if (skipped(snapshot, id) || at.round.final || f.severity !== 'Should' || f.carried !== undefined || f.risk !== undefined) return false;
  return evidenceCount(placedRounds(rec), facts.ranges, at, f.file, id) >= FROM_ROUND;
}

/** ac-4: each new Should from round 3 that rests on no ticket line, test or command. */
export const findingGrounds: GateRule['check'] = (snapshot, id) => {
  const ticket = laneTicket(snapshot, id);
  const rec = workOf(snapshot, id)?.rounds;
  if (ticket === undefined || rec === undefined) return [];
  const out: GateDraft[] = [];
  for (const at of placedRounds(rec)) {
    for (const f of at.round.findings) {
      if (!needsGrounds(snapshot, id, at, f)) continue;
      if (f.test !== undefined || f.command !== undefined || restsOnHolds(ticket, f)) continue;
      const lines = ticket.frontmatter?.lane === 'S' ? 'Understood "<quote>" or Done when "<quote>"' : 'ac-<n>, D-<nn>, Veto "<quote>" or Intent "<quote>"';
      out.push({
        file: rec.file,
        line: f.line,
        reason:
          `round ${at.p} of cycle ${at.cycle}, finding ${f.n}: from round 3 a Should needs a ticket line it rests on (rests on: ${lines}, ` +
          'a line the ticket holds, a quote of at least three words) or test: or command:; otherwise it is a Nice',
      });
    }
  }
  return out;
};

const PATH_BEFORE = /[A-Za-z0-9_./-]/;
const PATH_AFTER = /[A-Za-z0-9_/-]/;
const WORD = /[A-Za-z0-9_]/;

/** The Ruling on whole tokens: `path` stands in `text` as a token, and `text` holds ` — ` followed by text. */
export function mentionsPath(text: string, path: string): boolean {
  if (!/ — \S/.test(text)) return false;
  for (let at = text.indexOf(path); at >= 0; at = text.indexOf(path, at + 1)) {
    const before = text[at - 1];
    const after = text[at + path.length];
    const nextAfter = text[at + path.length + 1];
    if (before !== undefined && PATH_BEFORE.test(before)) continue;
    if (after !== undefined && (PATH_AFTER.test(after) || (after === '.' && nextAfter !== undefined && WORD.test(nextAfter)))) continue;
    return true;
  }
  return false;
}

/** ac-5: each path a round's fix changed that is the location of no finding of that round and that no Ruling names. */
export const fixFileUnexplained: GateRule['check'] = (snapshot, id) => {
  const rec = workOf(snapshot, id)?.rounds;
  const facts = factsOf(snapshot, id);
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || facts === undefined || 'error' in facts) return [];
  if (skipped(snapshot, id)) return [];
  const branch = factOf(snapshot, id);
  const readable = branch !== undefined && !('error' in branch) ? branch : undefined;
  const rulings = workOf(snapshot, id)?.ledger?.rulings ?? [];
  const out: GateDraft[] = [];
  for (const at of placedRounds(rec)) {
    const located = new Set(at.round.findings.flatMap((f) => (f.file === undefined ? [] : [f.file])));
    const fix = fixCommits(id, facts.ranges[at.j - 1] ?? []);
    const paths = [...new Set(fix.flatMap((c) => c.files))].filter(
      (p) => !ownRecordsOnly(id, [p]) && (readable === undefined || !isExempt(id, readable, p)),
    );
    for (const path of paths) {
      if (located.has(path) || rulings.some((r) => mentionsPath(r, path))) continue;
      const shas = fix.filter((c) => c.files.includes(path)).map((c) => c.sha.slice(0, 12));
      out.push({
        file: rec.file,
        line: at.round.line,
        reason:
          `${path} changed by the fix of round ${at.p} of cycle ${at.cycle} (${shas.join(', ')}) is the location of no finding of that round; ` +
          `add a Ruling under ## Rulings in the ledger naming ${path} with its reason`,
      });
    }
  }
  return out;
};
