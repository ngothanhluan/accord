// Spec §8 `accord brief <id> <n>`: the whole brief an executor receives — the ticket verbatim, the plan's preamble, task n of the plan, the task's one test command, then the conventions.
// Never chat history, never a summary. Phase 8.5: a ticket claimed at or after PRODUCT_TEXT_FROM gets the shared layout (the ruleset first, the conventions under `## Conventions`, only lines
// accord writes after them), an older one keeps today's brief (D-21, D-22); `--fix <findings file>` builds the brief of a fix executor in the shared layout for any ticket (D-02, D-31).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { briefText, checkProductText, claimPinBefore, commentProblems, commitRuleLine, commitRuleOf, CONVENTIONS_FILE, findingsBlock, FIX_REPORT_CONTRACT, normaliseText, notReadLine, planFile, PRODUCT_TEXT_FROM, REPORT_CONTRACT, stageOff, TASK_REPORT_FROM, TEST_ONLY_LINE, withheldLine, workOf } from '@accord-dev/accord-core';
import type { PlanTask, RepoSnapshot } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import { UsageError } from '../load/fs.js';
import { cliRuleset, readFindings, readProductText } from '../load/product.js';
import { assertAgentFile, fixReportPath, prepareFixReport, prepareReport, reportPath, writeAgentFile } from '../load/report.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { refuseLaneR, requireLaneTicket, taskNumber } from './lane-args.js';
import { briefWorkRoot, fixWorkRoot } from './task-tree.js';
import { ID } from './worktree.js';

const ONLY = 'This is the only test command the executor runs for this task.';
const FULL_WHY = 'tests.full is printed because accord/config.yml has no tests.affected.';
const NO_COMMAND = 'No test command is configured: accord/config.yml has no tests.affected and no tests.full.';
const NO_PATHS = 'No test command is configured for this task: its files: and verify: lines name no path for {files}.';

// A path with a shell metacharacter is single-quoted, an inner quote written '\''.
const quote = (p: string): string => (/^[A-Za-z0-9._/@+=:-]+$/.test(p) ? p : "'" + p.replace(/'/g, "'\\''") + "'");

/** The paths a task's test command runs: its `files:` and the part of each `verify:` id before `#` that names a file. */
function taskPaths(ctx: CommandContext, t: PlanTask): string[] {
  const paths = [...new Set(t.files)];
  for (const v of t.verify) {
    const i = v.indexOf('#');
    const prefix = i < 0 ? v : v.slice(0, i);
    if ((ctx.snapshot.tree.includes(prefix) || t.files.includes(prefix)) && !paths.includes(prefix)) paths.push(prefix);
  }
  return paths;
}

// ST-LN-64: the one test command the executor runs, from config.yml. The CLI prints it and runs nothing.
function testBlock(ctx: CommandContext, t: PlanTask): string {
  const tests = ctx.snapshot.config?.tests;
  if (tests?.affected !== undefined) {
    const paths = taskPaths(ctx, t);
    if (tests.affected.includes('{files}') && paths.length === 0) return NO_PATHS + '\n';
    // split/join, never String.replace, so a `$` in a path is not read as a replacement pattern.
    return 'Test command: ' + tests.affected.split('{files}').join(paths.map(quote).join(' ')) + '\n' + ONLY + '\n';
  }
  if (tests?.full !== undefined) return 'Test command: ' + tests.full + '\n' + ONLY + '\n' + FULL_WHY + '\n';
  return NO_COMMAND + '\n';
}

const NO_FILES = 'No file list applies: the plan stage is off, so no task names files; {files} is left out of the command.';

/** The plan-off form of testBlock: the whole ticket is the task, so tests.affected runs with no file list. */
function ticketTestBlock(ctx: CommandContext): string {
  const tests = ctx.snapshot.config?.tests;
  if (tests?.affected !== undefined) {
    const note = tests.affected.includes('{files}') ? NO_FILES + '\n' : '';
    return 'Test command: ' + tests.affected.split('{files}').join('').trim() + '\n' + ONLY + '\n' + note;
  }
  if (tests?.full !== undefined) return 'Test command: ' + tests.full + '\n' + ONLY + '\n' + FULL_WHY + '\n';
  return NO_COMMAND + '\n';
}

/**
 * ST-LN-92 D-03, D-18: the rule printed right under `Work dir:`. The brief is the only text a build dispatch passes, and only Claude Code installs accord-executor, so the
 * executor of codex, cursor or copilot learns where to work from this line (RESEARCH Pitfall 10).
 */
export const WORK_DIR_RULE = 'Work only in this folder: run every command and make every commit there, give every path as an absolute path under it, and never merge, rebase or push.';

/**
 * ST-LN-59 D-07, D-16: the `Report file:` line and the report contract under it, and the one write that goes with them (the folder, its `.gitignore`, this task's old report removed).
 * Empty, with nothing written, for a ticket claimed before TASK_REPORT_FROM, so its brief is today's byte for byte; a failed claim read is false in claimPinBefore, so it gets the lines
 * (fail closed). `claimed` is the snapshot with the claim read, the same read task-done's check makes.
 * ST-LN-92 D-03, D-16: above them, `Work dir:` and WORK_DIR_RULE when `workRoot` is defined (a ticket not claimed before 0.6.0, `briefWorkRoot`, which refuses a
 * checkout on neither the ticket branch nor the task's own); the report then lies under that folder, the task worktree while one exists, so the executor writes only where
 * it works (the report-place Ruling).
 */
function reportBlock(ctx: CommandContext, claimed: RepoSnapshot, id: string, n: number, workRoot: string | undefined): string {
  const dir = workRoot === undefined ? '' : 'Work dir: ' + workRoot + '\n' + WORK_DIR_RULE + '\n';
  if (claimPinBefore(claimed, id, TASK_REPORT_FROM)) return dir;
  const root = workRoot ?? ctx.root;
  prepareReport(root, id, n);
  return dir + 'Report file: ' + reportPath(root, id, n) + '\n' + REPORT_CONTRACT + '\n';
}

const BOM = '\uFEFF';

/**
 * R-1, D-08: the conventions text of a ticket claimed before PRODUCT_TEXT_FROM, still appended raw after a bare `---` (ST-LN-8 D-04: from disk, so a BOM or CRLF reaches the brief as
 * written), but through the same reader and line check as every other delivery: a file that is a link is the not-read line and no byte of its target, and a line `checkProductText`
 * withholds has its content, up to its own line end, replaced by its placeholder. A file with no refused line (a comment of ordinary words is not one) is returned byte for byte.
 */
function conventionsTail(ctx: CommandContext): string {
  const read = readProductText(ctx.root, { from: 'working' });
  if (read.kind === 'absent') return '';
  if (read.kind === 'not-regular') return '\n---\n\n' + notReadLine(CONVENTIONS_FILE) + '\n';
  // trim() strips whitespace and the byte order mark alike: a file with nothing else is no file, as before, so a stray mark in it is not a refused line
  if (read.text.trim() === '') return '';
  // a line that holds a comment is judged as written too: the tail prints raw lines, so the words inside a comment reach the model (review CR-02)
  const refused = new Set([...checkProductText(read.text).problems, ...commentProblems(read.text)].map((p) => p.line));
  let conv = read.text;
  if (refused.size > 0) {
    const bom = read.text.startsWith(BOM) ? BOM : '';
    // the capture group keeps each line end as written; the numbering is checkProductText's (one BOM dropped, CRLF, a lone CR and LF end a line)
    const parts = read.text.slice(bom.length).split(/(\r\n|\r|\n)/);
    for (let i = 0, n = 1; i < parts.length; i += 2, n++) if (refused.has(n)) parts[i] = withheldLine(CONVENTIONS_FILE, n);
    conv = bom + parts.join('');
  }
  return '\n---\n\n' + conv;
}

/**
 * Phase 8.1 D-05: the commit rule the team set in `commits.message`, as a `---` separated block of at most five lines: the rule, one first line that passes it, the exemptions, the check
 * to run before each commit, and (with a `command`) how to build the message. Empty when `commits.message` is unset, so the brief is then today's byte for byte; a pattern that is not in
 * force is named with `accord lint`. The model reads the rule when it writes the message, as it reads the title rule of Phase 7 D-08b.
 */
function commitRuleLines(ctx: CommandContext, id: string): string[] {
  const rule = commitRuleOf(ctx.snapshot.config);
  if (rule === undefined) return [];
  if ('problem' in rule) return [`Commit rule: commits.message is not in force (${shown(rule.problem)}); run accord lint.`];
  return [
    `Commit rule: ${commitRuleLine(rule)}.`,
    ...(rule.example === '' ? [] : [`Example that passes: ${shown(rule.example)}`]),
    'Merge commits and Revert "..." subjects are exempt.',
    'Check each message with accord commit check <file> before you commit it; accord task-done refuses a commit that breaks the rule.',
    ...(ctx.snapshot.config?.commits?.message?.command === undefined ? [] : [`Build each message with accord commit message ${id} and commit with git commit -F <the message-file it prints> --cleanup=verbatim.`]),
  ];
}

/** The legacy tail: the lines of `commitRuleLines` as a `---` separated block, empty when `commits.message` is unset. */
function commitRuleTail(ctx: CommandContext, id: string): string {
  const lines = commitRuleLines(ctx, id);
  return lines.length === 0 ? '' : '\n---\n\n' + lines.join('\n') + '\n';
}

/** The non-blank lines of a block of CLI-written text: every line the legacy brief joins with `\n` ends, so the shared layout prints the same words. */
const linesOf = (block: string): string[] => block.split('\n').filter((l) => l !== '');

/**
 * The task brief of a ticket claimed at or after PRODUCT_TEXT_FROM (D-21): the ruleset, the ticket, the section (the plan's preamble and the task, or the plan-off line), the conventions of
 * the working branch (D-06), then only lines accord writes: Work dir, the report file and its contract, the test command, the commit rule. The legacy layout is `legacyBrief`.
 */
function sharedBrief(ctx: CommandContext, ticket: string, section: string, cli: readonly string[]): string {
  return briefText({ role: 'executor', ruleset: cliRuleset(), ticket, section, conventions: readProductText(ctx.root, { from: 'working' }), cli });
}

// ST-LN-50 D-08 Ruling: with the plan stage off the whole ticket is task 1, briefed from the ticket itself; no plan.md is read, whatever it holds.
function briefTicket(ctx: CommandContext, claimed: RepoSnapshot, id: string, n: number, file: string, lane: string | undefined): string {
  if (n !== 1) {
    throw new UsageError(`the plan stage is off for lane ${lane} (strictness.stages.${lane}.plan): the whole ticket is task 1, there is no task ${n}`);
  }
  const text = normaliseText(readFileSync(join(ctx.root, file), 'utf8'));
  const line = `The plan stage is off for lane ${lane}: build the whole ticket as task 1; every scenario that is not @ui needs one test that proves it.`;
  const report = reportBlock(ctx, claimed, id, n, briefWorkRoot(ctx.root, claimed, id, n));
  const legacy = claimPinBefore(claimed, id, PRODUCT_TEXT_FROM);
  return legacy ? legacyPlanOffBrief(ctx, id, text, line, report) : sharedBrief(ctx, text, line, [...linesOf(report), ...linesOf(ticketTestBlock(ctx)), ...commitRuleLines(ctx, id)]);
}

/** D-22: today's plan-off brief, byte for byte for a safe conventions file: the ticket, the plan-off line, the lines accord writes, the commit rule, the raw conventions (R-1). */
function legacyPlanOffBrief(ctx: CommandContext, id: string, ticket: string, line: string, report: string): string {
  return ticket.replace(/\n*$/, '\n') + '\n---\n\n' + line + '\n\n---\n\n' + report + ticketTestBlock(ctx) + commitRuleTail(ctx, id) + conventionsTail(ctx);
}

/** D-22: today's task brief, byte for byte for a safe conventions file: the ticket, the preamble and the task, the lines accord writes, the commit rule, the raw conventions (R-1). */
function legacyBrief(ctx: CommandContext, id: string, ticket: string, rules: string, section: string, report: string, t: PlanTask): string {
  return ticket.replace(/\n*$/, '\n') + '\n---\n\n' + rules + section.replace(/\n*$/, '\n') + '\n---\n\n' + report + testBlock(ctx, t) + commitRuleTail(ctx, id) + conventionsTail(ctx);
}

/** What `accord brief` may be given besides the ticket and a task: the findings file of a fix, where to write the brief, and the test-only ending of a fix brief. */
export interface BriefOptions {
  fix?: string;
  out?: string;
  testOnly?: boolean;
}

/** D-23: the brief goes to stdout, or with `--out` into `.accord-reports/<id>/<file>` (UTF-8, no byte order mark, LF), and stdout then holds only the `file:` line. */
function emit(ctx: CommandContext, id: string, text: string, out: string | undefined): number {
  ctx.stdout.write(out === undefined ? text : 'file: ' + writeAgentFile(ctx.root, id, out, text) + '\n');
  return 0;
}

const NEED_TASK = 'give a task number, or --fix <findings file>';
const FIX_ONLY = 'This is the only test command the executor runs for these findings.';
const FIX_NO_COMMAND = 'No test command is configured for this fix: run only the test files you write or change.';
const FIX_NO_PATHS = 'No test command is configured for this fix: its findings name no tracked path for {files}; run only the test files you write or change.';
const MAX_FINDING_PATHS = 200;

/** The tracked files the findings name, as `path` or `path:line` (and `path:line:column`), in the order they first appear, at most 200; a withheld line names none. */
function findingPaths(findings: string, tree: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const line of checkProductText(findings).lines) {
    if (line.withheld) continue;
    for (const word of line.text.split(/\s+/)) {
      const token = word.replace(/^[(["'`<{]+/, '').replace(/[)\]"'`>},;.]+$/, '');
      const path = /^(.+?)(?::[0-9]+(?::[0-9]+)?)?$/.exec(token)?.[1];
      if (path !== undefined && tree.has(path) && !out.includes(path)) out.push(path);
      if (out.length >= MAX_FINDING_PATHS) return out;
    }
  }
  return out;
}

/** The test lines of a fix brief: `tests.affected` filled with the tracked paths the task and the findings name; `tests.full` is never printed (executor rule). */
function fixTestLines(ctx: CommandContext, paths: readonly string[]): string[] {
  const affected = ctx.snapshot.config?.tests?.affected;
  if (affected === undefined) return [FIX_NO_COMMAND];
  if (affected.includes('{files}') && paths.length === 0) return [FIX_NO_PATHS];
  return ['Test command: ' + affected.split('{files}').join(paths.map(quote).join(' ')), FIX_ONLY];
}

/**
 * Phase 8.5 D-02, D-13, D-21, R-11: `accord brief <id> [task] --fix <findings file>`, the brief of the executor that fixes review, debug or comment findings: the ruleset, the ticket, the
 * findings after the line check, the conventions of the working branch, then only lines accord writes. It has one layout for any claim pin (D-31): no CLI-built fix brief existed before.
 * With no task the work dir is the ticket's own checkout and the fix report is the next `fix-<k>.md`; with a task its worktree and the task's files join the test command. Nothing is
 * written before the findings are read and the task is found.
 */
function briefFix(ctx: CommandContext, id: string, n: number | undefined, ticketFile: string, lane: string | undefined, findingsArg: string, cwd: string, testOnly: boolean): string {
  const claimed = withClaimPins(ctx.root, ctx.snapshot, id);
  const findings = readFindings(resolve(cwd, findingsArg));
  let dir: string;
  let paths: string[] = [];
  if (n === undefined) dir = fixWorkRoot(ctx.root, claimed, id);
  else {
    if (stageOff(ctx.snapshot, id, 'plan')) {
      if (n !== 1) throw new UsageError(`the plan stage is off for lane ${lane} (strictness.stages.${lane}.plan): the whole ticket is task 1, there is no task ${n}`);
    } else {
      const plan = workOf(ctx.snapshot, id)?.plan;
      if (plan === undefined) throw new UsageError('no plan at ' + planFile(id));
      const t = plan.tasks.find((x) => x.n === n);
      if (t === undefined) throw new UsageError(`${planFile(id)} has no "## Task ${n}"`);
      paths = taskPaths(ctx, t);
    }
    dir = (briefWorkRoot(ctx.root, claimed, id, n) ?? ctx.root).replace(/\\/g, '/');
  }
  const named = findingPaths(findings, new Set(ctx.snapshot.tree)).filter((p) => !paths.includes(p));
  const k = prepareFixReport(dir, id);
  const cli = [
    'Work dir: ' + dir,
    WORK_DIR_RULE,
    'Report file: ' + fixReportPath(dir, id, k),
    ...FIX_REPORT_CONTRACT.split('\n').filter((l) => l !== ''),
    ...fixTestLines(ctx, [...paths, ...named]),
    ...commitRuleLines(ctx, id),
    // R-7: the last line accord writes, so executor.md's last-line rule holds and no skill appends a line to a brief by hand
    ...(testOnly ? [TEST_ONLY_LINE] : []),
  ];
  const ticket = normaliseText(readFileSync(join(ctx.root, ticketFile), 'utf8'));
  return briefText({ role: 'fix-executor', ruleset: cliRuleset(), ticket, section: findingsBlock(findings), conventions: readProductText(ctx.root, { from: 'working' }), cli });
}

export function brief(ctx: CommandContext, id: string, task: string | undefined, options: BriefOptions, cwd: string): number {
  if (task === undefined && options.fix === undefined) throw new UsageError(NEED_TASK);
  if (options.testOnly === true && options.fix === undefined) throw new UsageError('--test-only works only with --fix');
  const n = task === undefined ? undefined : taskNumber(task);
  const ticket = requireLaneTicket(ctx, id);
  // T-04-12: the id names the report path; a ticket file `accord/tickets/...md` loads under the key `..`. Checked after the lookup, so an unknown id
  // keeps its `no ticket` refusal.
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  refuseLaneR(ticket, id, 'plan tasks');
  // D-23: the name is checked before anything is written, so a refused one leaves no report folder behind
  if (options.out !== undefined) assertAgentFile(id, options.out);
  if (options.fix !== undefined) {
    if (ticket.frontmatter?.lane === 'S') throw new UsageError('lane S has no executor: the session fixes the findings itself');
    return emit(ctx, id, briefFix(ctx, id, n, ticket.file, ticket.frontmatter?.lane, options.fix, cwd, options.testOnly === true), options.out);
  }
  if (n === undefined) throw new UsageError(NEED_TASK);
  const claimed = withClaimPins(ctx.root, ctx.snapshot, id);
  if (stageOff(ctx.snapshot, id, 'plan')) return emit(ctx, id, briefTicket(ctx, claimed, id, n, ticket.file, ticket.frontmatter?.lane), options.out);
  const plan = workOf(ctx.snapshot, id)?.plan;
  if (plan === undefined) throw new UsageError('no plan at ' + planFile(id));
  const t = plan.tasks.find((x) => x.n === n);
  if (t === undefined) throw new UsageError(`${planFile(id)} has no "## Task ${n}"`);
  const text = normaliseText(readFileSync(join(ctx.root, ticket.file), 'utf8'));
  const section = [`## Task ${t.n}: ${t.title}`, ...t.lines.map((l) => l.text)].join('\n');
  // Blank edge lines go, so a plan with no preamble gives the brief it always did.
  const pre = plan.preamble.split('\n');
  while (pre.length > 0 && pre[0].trim() === '') pre.shift();
  while (pre.length > 0 && pre[pre.length - 1].trim() === '') pre.pop();
  const rules = pre.length > 0 ? pre.join('\n') + '\n\n' : '';
  const report = reportBlock(ctx, claimed, id, n, briefWorkRoot(ctx.root, claimed, id, n));
  const legacy = claimPinBefore(claimed, id, PRODUCT_TEXT_FROM);
  const body = legacy ? legacyBrief(ctx, id, text, rules, section, report, t) : sharedBrief(ctx, text, rules + section, [...linesOf(report), ...linesOf(testBlock(ctx, t)), ...commitRuleLines(ctx, id)]);
  return emit(ctx, id, body, options.out);
}
