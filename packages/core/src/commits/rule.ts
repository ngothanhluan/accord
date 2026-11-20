// Phase 8.1 D-04, D-05: the commit-message rule a team sets in `commits.message`: the `conventional` preset or its own regex. Pure: no I/O.
// One function, `commitRuleProblem`, judges every message: `accord commit check`, `accord commit message`, task-done and gate done (D-05: one code path).
import type { AccordConfig } from '../model/snapshot.js';
import { backtrackProblem } from '../security/backtrack.js';
import { SCAN_LINE_LIMIT } from '../security/match.js';

/**
 * Conventional Commits 1.0.0 shape of a first line, rules 1, 4, 14 and 15: a type, an optional parenthesised scope, an optional `!`, a colon and a space, then a description.
 * The type set is open on purpose (rule 14 allows types beyond feat and fix), so accord's own bookkeeping subjects (`claim: <id>`, `plan: <id> ready`, ...) pass the preset.
 * Case-insensitive (rule 15). Run through `backtrackProblem`: no finding.
 */
export const CONVENTIONAL_PATTERN = String.raw`^[a-z][a-z0-9-]*(?:\([^()\r\n]+\))?!?: \S.*$`;
export const CONVENTIONAL_EXAMPLE = 'feat(cart): add coupon field';

/** A rule in force: the regex, how a message names it, and one first line that passes it. */
export interface CommitRule {
  regex: RegExp;
  /** `commits.message.preset conventional` or `commits.message.pattern /<source>/`, as a problem and the brief name the rule */
  text: string;
  example: string;
}

/** The rule `commits.message` sets, `{ problem }` when it cannot be put in force (the pattern does not compile or the backtracking guard refuses it), undefined when it is not set. */
export type CommitRuleOf = CommitRule | { problem: string } | undefined;

export function commitRuleOf(config: Pick<AccordConfig, 'commits'> | undefined): CommitRuleOf {
  const m = config?.commits?.message;
  if (m === undefined) return undefined;
  if (m.preset === 'conventional') return { regex: new RegExp(CONVENTIONAL_PATTERN, 'i'), text: 'commits.message.preset conventional', example: m.example ?? CONVENTIONAL_EXAMPLE };
  if (m.pattern === undefined) return undefined;
  const text = `commits.message.pattern /${m.pattern}/`;
  let regex: RegExp;
  try {
    regex = new RegExp(m.pattern);
  } catch (e) {
    return { problem: `${text} does not compile: ${e instanceof Error ? e.message : String(e)}` };
  }
  const slow = backtrackProblem(m.pattern, '');
  if (slow !== undefined) return { problem: `${text} can be very slow on some lines: ${slow}` };
  return { regex, text, example: m.example ?? '' };
}

/** The first line of a message: a byte order mark dropped, CRLF read as LF. The body is free. */
const firstLine = (message: string): string => message.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')[0] ?? '';

/** A commit subject on its way to a terminal: every control, invisible format and separator character written as `<U+XXXX>`, so a subject cannot hide or reorder what the reader sees (T-08.1-04). */
const visible = (text: string): string => text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (ch) => '<U+' + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0') + '>');

/**
 * Why `message` breaks `rule`, or undefined when it passes. Merge commits and commits already on the default branch are exempt by the caller (they are never offered here);
 * a subject that starts `Revert "` is git's own revert subject and passes, so the executor's `git revert` of its own fix never blocks task-done.
 */
export function commitRuleProblem(rule: CommitRule, message: string): string | undefined {
  const subject = firstLine(message);
  if (subject.startsWith('Revert "')) return undefined;
  // CR-01 (T-08.1-03): the backtracking guard accepts shapes that are polynomial, which is safe only on a bounded line (the scans cut a line at SCAN_LINE_LIMIT).
  // A subject over the same bound is never matched; it fails the rule, so a hostile first line cannot hang a gate, and the message prints its length, not its text.
  if (subject.length > SCAN_LINE_LIMIT) {
    return `the first line is ${subject.length} characters, over the ${SCAN_LINE_LIMIT} accord checks against ${rule.text} - fix: shorten the first line and move detail into the message body`;
  }
  return rule.regex.test(subject) ? undefined : `"${visible(subject)}" does not match ${rule.text}`;
}

/**
 * The one reason task-done prints and `gate.commit-message` reports for a commit that breaks the rule (D-07: every refusal names its fix). A commit accord wrote from a
 * `commits.subjects` template is fixed at the template first, and `accord lint` names the key and one that passes; a code commit is reworded.
 */
export function commitRuleRefusal(sha: string, problem: string): string {
  return (
    `commit ${sha.slice(0, 8)} ${problem} - fix: reword it so its first line passes (check the message first with accord commit check <file>); ` +
    'for a subject accord wrote from a commits.subjects template, set that template first (accord lint names the key and one that passes), then reword the commit to what accord subject <name> <id> prints'
  );
}

/** The reason when `commits.message` cannot be put in force (D-04: a broken rule never passes silently): it names `accord lint`, which reports the pattern. */
export const commitRuleNotInForce = (problem: string): string => `${problem} - fix: run accord lint, which names the pattern to change; until it is in force no commit is judged, so the gate fails closed`;

/** One line naming the rule, for the brief and the anchor. */
export function commitRuleLine(rule: CommitRule): string {
  return `the first line of every commit message matches ${rule.text}`;
}
