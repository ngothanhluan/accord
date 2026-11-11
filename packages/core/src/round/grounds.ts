// ST-LN-57: from round 3 a Should rests on a ticket line or a failing case (ac-4, D-07, D-11), and a file a fix changed
// is the location of a finding or is named by a Ruling (ac-5, D-14). ST-LN-91 D-11 lowers that rule to round 2 and widens it
// to Must and Should from GROUNDS_V2_FROM; it stays ONE rule, which gate.finding-grounds and accord round both call.
// Pure: the host supplies the round facts it read from git. No code runs at load but constants.
import { ownRecordsOnly } from '../gate/done.js';
import { addedResearch } from '../gate/research.js';
import { factOf, isExempt } from '../gate/scope.js';
import { laneTicket, workOf } from '../gate/work.js';
import type { GateDraft, GateRule } from '../gate/rules.js';
import { LIST_MARKER, headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, RoundFinding, Ticket } from '../model/snapshot.js';
import { evidenceCount } from './evidence.js';
import type { RoundKind } from './next.js';
import { GROUNDS_V2_FROM, pinBefore } from './pin.js';
import { factsOf, fixCommits, placedRounds, skipped } from './scope.js';
import type { Placed } from './scope.js';

/** The count from which a Should needs grounds under a pin below GROUNDS_V2_FROM (ST-LN-57). */
const FROM_ROUND = 3;
/** The count from which a Must or Should needs grounds from GROUNDS_V2_FROM (ST-LN-91 D-11). */
const FROM_ROUND_V2 = 2;

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

/**
 * ST-LN-91 D-11: the grounds rule asks round 2 and Must as well as Should for the record of this kind. For review.md the host's round facts
 * carry the pin at the first round (and at its merge base); a version 1 record, no pin or a pin below GROUNDS_V2_FROM keeps the ST-LN-57 rule.
 */
export function groundsV2(snapshot: RepoSnapshot, id: string, kind: RoundKind): boolean {
  if (kind !== 'review') return false;
  const facts = factsOf(snapshot, id);
  if (facts === undefined || 'error' in facts || facts.pin === undefined) return false;
  return !pinBefore(GROUNDS_V2_FROM, facts.pin, facts.basePin);
}

/** True when `f`, a finding of the round `at`, is a new Must or Should from round 2 (from round 3, Should only, under the older rule) that asks grounds (version 2 record with facts, not skipped). */
export function needsGrounds(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean {
  const rec = workOf(snapshot, id)?.rounds;
  const facts = factsOf(snapshot, id);
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || facts === undefined || 'error' in facts) return false;
  const v2 = groundsV2(snapshot, id, 'review');
  const asked = v2 ? f.severity === 'Must' || f.severity === 'Should' : f.severity === 'Should';
  if (skipped(snapshot, id) || at.round.final || !asked || f.carried !== undefined || f.risk !== undefined) return false;
  return evidenceCount(placedRounds(rec), facts.ranges, at, f.file, id) >= (v2 ? FROM_ROUND_V2 : FROM_ROUND);
}

/** The one grounds rule, as problems in record line order: each new finding that rests on no ticket line, test or command (and carries no risk tag). */
export function groundsProblems(snapshot: RepoSnapshot, id: string, kind: RoundKind): { line: number; reason: string }[] {
  if (kind !== 'review') return [];
  const ticket = laneTicket(snapshot, id);
  const rec = workOf(snapshot, id)?.rounds;
  if (ticket === undefined || rec === undefined) return [];
  const v2 = groundsV2(snapshot, id, kind);
  const out: { line: number; reason: string }[] = [];
  for (const at of placedRounds(rec)) {
    for (const f of at.round.findings) {
      if (!needsGrounds(snapshot, id, at, f)) continue;
      if (f.test !== undefined || f.command !== undefined || restsOnHolds(ticket, f)) continue;
      const lines = ticket.frontmatter?.lane === 'S' ? 'Understood "<quote>" or Done when "<quote>"' : 'ac-<n>, D-<nn>, Veto "<quote>" or Intent "<quote>"';
      const where = `round ${at.p} of cycle ${at.cycle}, finding ${f.n}`;
      const ask = `a ticket line it rests on (rests on: ${lines}, a line the ticket holds, a quote of at least three words)`;
      out.push({
        line: f.line,
        reason: v2
          ? `${where}: from round 2 a Must or Should needs ${ask}, or test: or command:, or risk: data-loss or risk: security; ` +
            'otherwise it does not block: write it deferred with its failing case under ## Deferred in the ledger'
          : `${where}: from round 3 a Should needs ${ask} or test: or command:; otherwise it is a Nice`,
      });
    }
  }
  return out;
}

/** ac-4: each new Should from round 3 (each new Must or Should from round 2 under GROUNDS_V2_FROM) that rests on no ticket line, test or command. */
export const findingGrounds: GateRule['check'] = (snapshot, id) => {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return [];
  return groundsProblems(snapshot, id, 'review').map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
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
  const wording = new Set((workOf(snapshot, id)?.ledger?.wordingOnly ?? []).map((w) => w.path));
  const own = addedResearch(snapshot, id);
  const out: GateDraft[] = [];
  for (const at of placedRounds(rec)) {
    const located = new Set(at.round.findings.flatMap((f) => (f.file === undefined ? [] : [f.file])));
    const fix = fixCommits(id, facts.ranges[at.j - 1] ?? []);
    const paths = [...new Set(fix.flatMap((c) => c.files))].filter(
      (p) => !ownRecordsOnly(id, [p]) && (readable === undefined || !isExempt(id, readable, p, own)),
    );
    for (const path of paths) {
      if (located.has(path) || wording.has(path) || rulings.some((r) => mentionsPath(r, path))) continue;
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
