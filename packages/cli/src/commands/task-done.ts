// Spec §8 `accord task-done <id> <n>`: writes the ledger line only when the report shows every verify case
// of task n passed and the report is newer than HEAD. The CLI never runs a test command; the orchestrator
// runs the tests, and this reads the evidence the Done gate reads.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { claimPinBefore, forbiddenLines, normaliseKey, recordTaskDone, reportReasons, stageOff, TASK_REPORT_FROM, taskVerdict, ticketTaskVerdict, trailerReason, workOf, writeTestTags } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import { gitBranchCommits, UsageError } from '../load/fs.js';
import { readReport, reportPath, reportRel } from '../load/report.js';
import type { CommandContext } from '../run.js';
import { refuseLaneR, requireLaneTicket, taskNumber } from './lane-args.js';
import { workRootOf } from './task-tree.js';

/** `git show -s --format=%ct` output as seconds; anything but digits would make every report look fresh. */
export function commitSeconds(out: string): number {
  const text = out.trim();
  if (!/^\d+$/.test(text)) throw new UsageError('git printed no commit time for HEAD; cannot tell whether the report is fresh');
  return Number(text);
}

/** HEAD's committer time (`ct`, the test report's freshness) and author time (`at`, the executor report's), in whole seconds. */
export interface HeadTimes { ct: number; at: number }

/** HeadTimes from one `git show -s`. */
function headTimes(root: string): HeadTimes {
  const out = execFileSync('git', ['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-s', '--format=%ct %at', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const [ct, at] = out.trim().split(' ');
  return { ct: commitSeconds(ct ?? ''), at: commitSeconds(at ?? '') };
}

/** headTimes(root) read on the first call only, so task-done asks git once however many of its checks need HEAD's times. */
const headTimesOnce = (root: string): (() => HeadTimes) => {
  let times: HeadTimes | undefined;
  return () => (times ??= headTimes(root));
};

/**
 * shortcut: compares whole seconds (git's %ct), so a report written in the same second as the commit, but
 * before it, counts as fresh; upgrade to a content check if that ever lets a stale report through.
 */
export function staleReport(ctx: CommandContext, times: () => HeadTimes = headTimesOnce(ctx.root)): string | undefined {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined || ctx.snapshot.tests === undefined) return undefined; // taskVerdict reports this
  // D-51: the raw config value may carry a backslash; the loader read the file under the slashed key.
  const rel = normaliseKey(report);
  const committed = times().ct * 1000;
  const written = Math.floor(statSync(join(ctx.root, ...rel.split('/'))).mtimeMs / 1000) * 1000;
  return written < committed ? `${rel} was written before the last commit; run the tests again` : undefined;
}

/**
 * ST-LN-59 D-07, D-16: the reasons the executor's report file does not let task `n` be recorded: missing, written before HEAD's author time (author time, because the rebase of a
 * wave's integration moves committer time and not this), or without its red-reason and self-review lines. None for a ticket claimed before TASK_REPORT_FROM; the same claim read
 * decides `accord brief`'s ask, and a failed read gives the check (fail closed). The CLI checks that the lines are there, not that they are true, and never reads `config.runtimes` (D-18).
 */
function reportProblems(ctx: CommandContext, id: string, n: number, sha: string, times: () => HeadTimes): string[] {
  const claimed = withClaimPins(ctx.root, ctx.snapshot, id);
  if (claimPinBefore(claimed, id, TASK_REPORT_FROM)) return [];
  // ST-LN-92 D-03: the report lies where `accord brief` put it, under the task's worktree while it exists (it is cleaned only after task-done), named there by its absolute path.
  const root = workRootOf(ctx.root, claimed, id, n) ?? ctx.root;
  const rel = root === ctx.root.replace(/\\/g, '/') ? reportRel(id, n) : reportPath(root, id, n);
  const report = readReport(root, id, n);
  if (report === undefined) return [`the executor report ${rel} is missing: the executor writes it as its last step`];
  if (Math.floor(report.mtimeMs / 1000) < times().at) {
    return [`the executor report ${rel} was written before HEAD's commit ${sha}: the executor writes it after its last commit`];
  }
  return reportReasons(report.text);
}

// T-03.1-28: an anchored pattern, so a pair is exactly `ac-<n>=<test id>` and the id is one tag with no whitespace.
const PAIR = /^ac-([1-9][0-9]*)=(\S+)$/;

/** `--test ac-<n>=<test id>` pairs as plan-style maps (`ac` as `@ac-n`); a malformed pair is a UsageError. */
function parsePairs(pairs: string[]): { ac: string; test: string }[] {
  return pairs.map((p) => {
    const m = PAIR.exec(p);
    if (m === null) throw new UsageError(`not a test pair: ${p}; write --test ac-<n>=<test id>`);
    return { ac: '@ac-' + m[1], test: m[2] };
  });
}

export function taskDone(ctx: CommandContext, id: string, task: string, pairs: string[] = []): number {
  const n = taskNumber(task);
  const laneTicket = requireLaneTicket(ctx, id);
  refuseLaneR(laneTicket, id, 'plan tasks');
  // ST-LN-50 D-08 Ruling: with the plan stage off the whole ticket is task 1 and its tests are named by --test; with it on, --test has no meaning.
  const planOff = stageOff(ctx.snapshot, id, 'plan');
  const lane = laneTicket.frontmatter?.lane;
  if (!planOff && pairs.length > 0) {
    throw new UsageError(`--test is for a ticket built without a plan: the plan stage is on for lane ${lane}; name the verify cases in plan.md, or turn it off with strictness.stages.${lane}.plan`);
  }
  if (planOff && n !== 1) {
    throw new UsageError(`the plan stage is off for lane ${lane} (strictness.stages.${lane}.plan): the whole ticket is task 1, there is no task ${n}`);
  }
  const testMaps = planOff ? parsePairs(pairs) : [];
  const commit = ctx.snapshot.git?.commit;
  if (commit === undefined) throw new UsageError('the repository has no commit; commit the task before recording it');
  // T-05-07: `id` is a key the loader found on disk, so it is a file stem and never a traversal.
  const rel = 'accord/tickets/' + id + '/ledger.md';
  const file = join(ctx.root, 'accord', 'tickets', id, 'ledger.md');
  const sha = commit.slice(0, 12);
  const next = recordTaskDone(existsSync(file) ? readFileSync(file, 'utf8') : undefined, n, sha);
  const verdict = planOff ? ticketTaskVerdict(ctx.snapshot, id, testMaps) : taskVerdict(ctx.snapshot, id, n);
  const ticket = ctx.snapshot.tickets[id];
  const ticketFile = join(ctx.root, ...ticket.file.split('/'));
  const maps = planOff ? testMaps : (workOf(ctx.snapshot, id)?.plan?.tasks.find((t) => t.n === n)?.maps ?? []);
  // A recorded task is re-checked only for tags: the committed ledger makes HEAD newer than the report.
  const times = headTimesOnce(ctx.root);
  const stale = next !== undefined && verdict.verdict === 'pass' ? staleReport(ctx, times) : undefined;
  const reasons = [...verdict.reasons, ...(stale === undefined ? [] : [stale]), ...(next === undefined ? [] : reportProblems(ctx, id, n, sha, times))];
  if (next !== undefined && ctx.snapshot.config?.commits?.trailers === 'forbid') {
    const done = workOf(ctx.snapshot, id)?.ledger?.done ?? {};
    const below = Object.keys(done).map(Number).filter((k) => k < n);
    const since = below.length === 0 ? undefined : done[String(Math.max(...below))];
    for (const c of gitBranchCommits(ctx.root, since)) for (const l of forbiddenLines(c.message)) reasons.push(trailerReason(c.sha, l));
  }
  const refuse = (lines: string[]): number => {
    ctx.stdout.write(`task ${n} of ${id} is not done:\n` + lines.map((r) => '  ' + r + '\n').join(''));
    return 1;
  };
  if (next !== undefined && reasons.length > 0) return refuse(reasons);
  if (next !== undefined || verdict.verdict === 'pass') {
    const tagged = writeTestTags(readFileSync(ticketFile, 'utf8'), ticket.scenarios, maps);
    if (tagged.conflicts.length > 0) {
      return refuse(tagged.conflicts.map((c) => `${c.ac} already carries @test:${c.existing}; ${planOff ? '--test names' : 'the plan maps it to'} ${c.test}`));
    }
    if (tagged.written.length > 0) writeFileSync(ticketFile, tagged.text);
    for (const w of tagged.written) ctx.stdout.write(`wrote @test:${w.test} on ${w.ac} in ${ticket.file}\n`);
  }
  if (next === undefined) {
    // D-05: a recorded task whose mapped test is not passing must not look done while a tag is still unwritten.
    const left = verdict.verdict === 'pass' ? [] : writeTestTags(readFileSync(ticketFile, 'utf8'), ticket.scenarios, maps).written;
    if (left.length > 0) return refuse([...verdict.reasons, ...left.map((w) => `${w.ac} is left without @test:${w.test}`)]);
    ctx.stdout.write(`task ${n} of ${id} is already recorded in ${rel}\n`);
    return 0;
  }
  mkdirSync(join(ctx.root, 'accord', 'tickets', id), { recursive: true });
  writeFileSync(file, next);
  ctx.stdout.write(`recorded task ${n} done at ${sha} in ${rel}\n`);
  return 0;
}
