// Phase 8.1 D-04, D-05: the commit-message rule a team sets in `commits.message`: the `conventional` preset or its own regex. Pure: no I/O.
// One function, `commitRuleProblem`, judges every message: `accord commit check`, `accord commit message`, task-done and gate done (D-05: one code path).
import type { AccordConfig } from '../model/snapshot.js';
import { backtrackProblem } from '../security/backtrack.js';

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

/**
 * Why `message` breaks `rule`, or undefined when it passes. Merge commits and commits already on the default branch are exempt by the caller (they are never offered here);
 * a subject that starts `Revert "` is git's own revert subject and passes, so the executor's `git revert` of its own fix never blocks task-done.
 */
export function commitRuleProblem(rule: CommitRule, message: string): string | undefined {
  const subject = firstLine(message);
  if (subject.startsWith('Revert "')) return undefined;
  return rule.regex.test(subject) ? undefined : `"${subject}" does not match ${rule.text}`;
}

/** One line naming the rule, for the brief and the anchor. */
export function commitRuleLine(rule: CommitRule): string {
  return `the first line of every commit message matches ${rule.text}`;
}
