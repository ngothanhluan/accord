// Spec §8 `accord brief <id> <n>`: the whole brief an executor receives — the ticket verbatim, the plan's
// preamble, task n of the plan, the task's one test command, then the conventions. Never chat history,
// never a summary.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claimPinBefore, commitRuleLine, commitRuleOf, normaliseText, planFile, REPORT_CONTRACT, stageOff, TASK_REPORT_FROM, workOf } from '@accord-dev/accord-core';
import type { PlanTask, RepoSnapshot } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import { UsageError } from '../load/fs.js';
import { prepareReport, reportPath } from '../load/report.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { refuseLaneR, requireLaneTicket, taskNumber } from './lane-args.js';
import { briefWorkRoot } from './task-tree.js';
import { ID } from './worktree.js';

const ONLY = 'This is the only test command the executor runs for this task.';
const FULL_WHY = 'tests.full is printed because accord/config.yml has no tests.affected.';
const NO_COMMAND = 'No test command is configured: accord/config.yml has no tests.affected and no tests.full.';
const NO_PATHS = 'No test command is configured for this task: its files: and verify: lines name no path for {files}.';

// A path with a shell metacharacter is single-quoted, an inner quote written '\''.
const quote = (p: string): string => (/^[A-Za-z0-9._/@+=:-]+$/.test(p) ? p : "'" + p.replace(/'/g, "'\\''") + "'");

// ST-LN-64: the one test command the executor runs, from config.yml. The CLI prints it and runs nothing.
function testBlock(ctx: CommandContext, t: PlanTask): string {
  const tests = ctx.snapshot.config?.tests;
  if (tests?.affected !== undefined) {
    const paths = [...new Set(t.files)];
    for (const v of t.verify) {
      const i = v.indexOf('#');
      const prefix = i < 0 ? v : v.slice(0, i);
      if ((ctx.snapshot.tree.includes(prefix) || t.files.includes(prefix)) && !paths.includes(prefix)) paths.push(prefix);
    }
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

// From disk, not the snapshot copy, so a BOM or CRLF reaches the brief as written (ST-LN-8 D-04).
function conventionsTail(ctx: CommandContext): string {
  const convPath = join(ctx.root, 'accord', 'product', 'conventions.md');
  const conv = existsSync(convPath) ? readFileSync(convPath, 'utf8') : '';
  // trim() strips whitespace and the byte order mark alike.
  return conv.trim() === '' ? '' : '\n---\n\n' + conv;
}

/**
 * Phase 8.1 D-05: the commit rule the team set in `commits.message`, as a `---` separated block of at most five lines: the rule, one first line that passes it, the exemptions, the check
 * to run before each commit, and (with a `command`) how to build the message. Empty when `commits.message` is unset, so the brief is then today's byte for byte; a pattern that is not in
 * force is named with `accord lint`. The model reads the rule when it writes the message, as it reads the title rule of Phase 7 D-08b.
 */
function commitRuleTail(ctx: CommandContext, id: string): string {
  const rule = commitRuleOf(ctx.snapshot.config);
  if (rule === undefined) return '';
  if ('problem' in rule) return `\n---\n\nCommit rule: commits.message is not in force (${shown(rule.problem)}); run accord lint.\n`;
  const lines = [
    `Commit rule: ${commitRuleLine(rule)}.`,
    ...(rule.example === '' ? [] : [`Example that passes: ${shown(rule.example)}`]),
    'Merge commits and Revert "..." subjects are exempt.',
    'Check each message with accord commit check <file> before you commit it; accord task-done refuses a commit that breaks the rule.',
    ...(ctx.snapshot.config?.commits?.message?.command === undefined ? [] : [`Build each message with accord commit message ${id} and commit with git commit -F <the message-file it prints> --cleanup=verbatim.`]),
  ];
  return '\n---\n\n' + lines.join('\n') + '\n';
}

// ST-LN-50 D-08 Ruling: with the plan stage off the whole ticket is task 1, briefed from the ticket itself; no plan.md is read, whatever it holds.
function briefTicket(ctx: CommandContext, claimed: RepoSnapshot, id: string, n: number, file: string, lane: string | undefined): number {
  if (n !== 1) {
    throw new UsageError(`the plan stage is off for lane ${lane} (strictness.stages.${lane}.plan): the whole ticket is task 1, there is no task ${n}`);
  }
  const text = normaliseText(readFileSync(join(ctx.root, file), 'utf8'));
  const line = `The plan stage is off for lane ${lane}: build the whole ticket as task 1; every scenario that is not @ui needs one test that proves it.`;
  ctx.stdout.write(text.replace(/\n*$/, '\n') + '\n---\n\n' + line + '\n\n---\n\n' + reportBlock(ctx, claimed, id, n, briefWorkRoot(ctx.root, claimed, id, n)) + ticketTestBlock(ctx) + commitRuleTail(ctx, id) + conventionsTail(ctx));
  return 0;
}

export function brief(ctx: CommandContext, id: string, task: string): number {
  const n = taskNumber(task);
  const ticket = requireLaneTicket(ctx, id);
  // T-04-12: the id names the report path; a ticket file `accord/tickets/...md` loads under the key `..`. Checked after the lookup, so an unknown id
  // keeps its `no ticket` refusal.
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  refuseLaneR(ticket, id, 'plan tasks');
  const claimed = withClaimPins(ctx.root, ctx.snapshot, id);
  if (stageOff(ctx.snapshot, id, 'plan')) return briefTicket(ctx, claimed, id, n, ticket.file, ticket.frontmatter?.lane);
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
  ctx.stdout.write(text.replace(/\n*$/, '\n') + '\n---\n\n' + rules + section.replace(/\n*$/, '\n') + '\n---\n\n' + reportBlock(ctx, claimed, id, n, briefWorkRoot(ctx.root, claimed, id, n)) + testBlock(ctx, t) + commitRuleTail(ctx, id) + conventionsTail(ctx));
  return 0;
}
