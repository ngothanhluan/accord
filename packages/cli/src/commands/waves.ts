// ST-LN-92 92-ac-1, D-01, D-05: `accord waves <id>` prints the parallel cap, then the plan's tasks left to build grouped into waves whose tasks
// may run at once. It reads the plan, the ledger, config.yml and `git worktree list` (the live task worktrees, ST-LN-92 D-03), and runs no team command
// (build.regenerate included).
import { buildWaves, parallelOf, planFile, sequentialReason, stageOff, workOf } from '@accord-dev/accord-core';
import type { PlanTask } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
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
  const reason = sequentialReason(tasks);
  if (reason !== undefined) out.push('Order: one task at a time — ' + reason);
  const grouped = buildWaves(tasks, done);
  if (grouped.length === 0) out.push('No task left to build');
  grouped.forEach((w, k) => out.push(`Wave ${k + 1}: ${w.join(', ')}`));
  // ST-LN-92 D-03, Pitfall 13: a task left to build whose worktree is still there (a wave stopped half-way), so the build skill finds its folder again;
  // review round 1 finding 5: a recorded task whose worktree is still there (a compaction between task-done and clean) too, marked for the clean
  // round 2 findings 2 and 9: a plan task's folder off its task branch (another branch, a detached HEAD, one git cannot read) is named for the owner, never dropped
  const live = taskWorktrees(ctx.root, id);
  const left = new Set(grouped.flat());
  const planned = new Set(tasks.map((t) => t.n));
  for (const [n, { path, state }] of [...live].sort((a, b) => a[0] - b[0])) {
    if (state !== undefined && planned.has(n)) out.push(`Task ${n} worktree: ${path} (${state}): not on its task branch — owner`);
    else if (state !== undefined) continue;
    else if (left.has(n)) out.push(`Task ${n} worktree: ${path}`);
    else if (done.has(n)) out.push(`Task ${n} worktree: ${path} (recorded: clean it)`);
  }
  ctx.stdout.write(out.join('\n') + '\n');
  return 0;
}
