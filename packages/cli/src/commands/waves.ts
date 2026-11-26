// ST-LN-92 92-ac-1, D-01, D-05: `accord waves <id>` prints the parallel cap, then the plan's tasks left to build grouped into waves whose tasks
// may run at once. It reads the plan, the ledger, config.yml and `git worktree list` (the live task worktrees, ST-LN-92 D-03), and runs no team command
// (build.regenerate included).
import { buildWaves, parallelOf, planFile, sequentialReason, stageOff, workOf } from '@accord-dev/accord-core';
import type { PlanTask } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { currentSlice } from './anchor.js';
import { refuseLaneR, requireLaneTicket } from './lane-args.js';
import { taskWorktrees } from './task-tree.js';

// ST-LN-50 D-08 Ruling, as in accord brief: with the plan stage off the whole ticket is task 1.
const TICKET_TASK: PlanTask = { n: 1, title: '', line: 0, covers: [], files: [], newFiles: [], models: [], verify: [], maps: [], after: { line: 0, tasks: [], unread: [] }, lines: [] };

export function waves(ctx: CommandContext, id: string): number {
  const ticket = requireLaneTicket(ctx, id);
  refuseLaneR(ticket, id, 'plan tasks');
  const work = workOf(ctx.snapshot, id);
  let tasks: PlanTask[];
  if (stageOff(ctx.snapshot, id, 'plan')) tasks = [TICKET_TASK];
  else {
    const plan = work?.plan;
    if (plan === undefined) throw new UsageError('no plan at ' + planFile(id));
    tasks = plan.tasks;
  }
  const done = new Set(Object.keys(work?.ledger?.done ?? {}).map(Number));
  const out = ['Parallel: ' + String(parallelOf(ctx.snapshot.config))];
  // Phase 15 D-07: on a slice of a sliced ticket only that slice's tasks are grouped, so the build stage builds slice n before slice n+1 opens; `planned` below keeps every task of the plan
  const planned = new Set(tasks.map((t) => t.n));
  const slice = stageOff(ctx.snapshot, id, 'plan') ? undefined : currentSlice(ctx, id);
  const building = slice?.tasks === undefined ? tasks : tasks.filter((t) => slice.tasks?.includes(t.n));
  const reason = sequentialReason(building);
  if (reason !== undefined) out.push('Order: one task at a time — ' + reason);
  const grouped = buildWaves(building, done);
  if (grouped.length === 0) out.push(slice?.tasks === undefined ? 'No task left to build' : `Slice ${slice.n} of ${slice.of} is built`);
  grouped.forEach((w, k) => out.push(`Wave ${k + 1}: ${w.join(', ')}`));
  // ST-LN-92 D-03, Pitfall 13: a task left to build whose worktree is still there (a wave stopped half-way), so the build skill finds its folder again;
  // review round 1 finding 5: a recorded task whose worktree is still there (a compaction between task-done and clean) too, marked for the clean
  // round 2 findings 2 and 9: a plan task's folder off its task branch (another branch, a detached HEAD, one git cannot read) is named for the owner, never dropped
  const live = taskWorktrees(ctx.root, id);
  const left = new Set(grouped.flat());
  for (const [n, { path, state }] of [...live].sort((a, b) => a[0] - b[0])) {
    // round 3 finding 9: a task folder whose number is no task of the plan is named for the owner too, never dropped
    if (!planned.has(n)) out.push(`Task ${n} worktree: ${path}${state === undefined ? '' : ` (${state})`} (not in the plan) — owner`);
    else if (state !== undefined) out.push(`Task ${n} worktree: ${path} (${state}): not on its task branch — owner`);
    else if (left.has(n)) out.push(`Task ${n} worktree: ${path}`);
    else if (done.has(n)) out.push(`Task ${n} worktree: ${path} (recorded: clean it)`);
  }
  ctx.stdout.write(out.join('\n') + '\n');
  return 0;
}
