// ST-LN-92 92-ac-1, D-01, D-05: the build stage's waves. A plan's tasks are grouped from their `after:` and `files:` lines alone: every task an
// `after:` line names sits in an earlier wave, and no two tasks of one wave share a path. Pure: no stage graph, no file system, no code run at load.
import { taskRepos } from '../load/work.js';
import type { AccordConfig, PlanTask } from '../model/snapshot.js';

/** The number of executors that run at once when config.yml has no build.parallel (D-05). */
export const DEFAULT_PARALLEL = 3;

/**
 * Every self reference and every larger strongly connected set of `after:` edges, as the tasks it holds sorted ascending; the cycles sorted by
 * their lowest task. An `after:` target that is no task of the plan is no edge (gate plan's own rule names it).
 */
export function afterCycles(tasks: PlanTask[]): number[][] {
  const known = new Set(tasks.map((t) => t.n));
  const edges = new Map<number, number[]>();
  for (const t of tasks) edges.set(t.n, (t.after?.tasks ?? []).filter((a) => known.has(a)));
  // Tarjan's strongly connected components, iterative so a long chain cannot overflow the stack.
  const index = new Map<number, number>();
  const low = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const out: number[][] = [];
  let next = 0;
  for (const root of [...known].sort((a, b) => a - b)) {
    if (index.has(root)) continue;
    const work: { n: number; i: number }[] = [{ n: root, i: 0 }];
    index.set(root, next);
    low.set(root, next++);
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const top = work[work.length - 1];
      const targets = edges.get(top.n) ?? [];
      if (top.i < targets.length) {
        const m = targets[top.i++];
        if (!index.has(m)) {
          index.set(m, next);
          low.set(m, next++);
          stack.push(m);
          onStack.add(m);
          work.push({ n: m, i: 0 });
        } else if (onStack.has(m)) {
          low.set(top.n, Math.min(low.get(top.n)!, index.get(m)!));
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].n;
        low.set(parent, Math.min(low.get(parent)!, low.get(top.n)!));
      }
      if (low.get(top.n) === index.get(top.n)) {
        const scc: number[] = [];
        let m: number;
        do {
          m = stack.pop()!;
          onStack.delete(m);
          scc.push(m);
        } while (m !== top.n);
        if (scc.length > 1 || (edges.get(top.n) ?? []).includes(top.n)) out.push(scc.sort((a, b) => a - b));
      }
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/**
 * Why the plan builds one task at a time in task-number order, or undefined when its waves can be built: a task with no `after:` line (a plan
 * written before the format), a token on an `after:` line that is not read, or a cycle. Sequential is today's behaviour and never wrong.
 */
export function sequentialReason(tasks: PlanTask[]): string | undefined {
  const sorted = [...tasks].sort((a, b) => a.n - b.n);
  if (sorted.some((t) => t.after === undefined)) return 'a task has no after: line';
  for (const t of sorted) {
    const token = t.after?.unread[0];
    if (token !== undefined) return `task ${t.n} after: holds ${token}, which is not read`;
  }
  const cycle = afterCycles(sorted)[0];
  if (cycle === undefined) return undefined;
  return cycle.length === 1 ? `task ${cycle[0]} after: names itself` : `tasks ${cycle.join(', ')} form a cycle`;
}

/**
 * The task's paths, existing and new, lower-cased: two paths that differ only in letter case collide on Windows and macOS. Phase 08.9.3 Decision 4: plus one token `\0<name>` for each other repository the task is built in, so two tasks of the
 * same other repository never share a wave, whatever their paths (one worktree per repository per ticket, D-10: no task worktree exists there). A path of this repository never holds a NUL, so the token collides with nothing else.
 */
const pathsOf = (t: PlanTask): string[] => [
  ...new Set([...t.files, ...t.newFiles].map((p) => p.toLowerCase())),
  ...taskRepos(t)
    .filter((r) => r !== '')
    .map((r) => '\0' + r),
];

/**
 * The tasks not in `done`, in waves, each wave's tasks ascending. With a sequential reason, one task per wave in number order. Otherwise a
 * topological pass: each task sits at the lowest wave above every not-done task its `after:` line names and above every task already placed
 * that shares one of its paths, so two tasks sharing a path never share a wave and land in the order they are placed. The next task placed is
 * the lowest-numbered one whose `after:` targets are placed and that shares no path with a lower-numbered task still to place (review round 1:
 * tasks sharing a file land in task order); only when an `after:` line puts that lower task after it does it go first. The cap
 * (build.parallel) never changes the grouping; it only batches a wave at dispatch.
 */
export function buildWaves(tasks: PlanTask[], done: ReadonlySet<number>): number[][] {
  const todo = tasks.filter((t) => !done.has(t.n)).sort((a, b) => a.n - b.n);
  if (sequentialReason(tasks) !== undefined) return todo.map((t) => [t.n]);
  const open = new Set(todo.map((t) => t.n));
  const waveOf = new Map<number, number>();
  const last = new Map<string, number>(); // path -> the highest wave a placed task holding it sits in
  const left = [...todo];
  const ready = (t: PlanTask): boolean => (t.after?.tasks ?? []).every((a) => !open.has(a) || waveOf.has(a));
  while (left.length > 0) {
    // with no cycle (sequentialReason) a ready task always exists; among them, one whose path no lower-numbered task left to place shares, if any
    const paths = left.map(pathsOf);
    const free = (i: number): boolean => !left.slice(0, i).some((_, j) => paths[j].some((p) => paths[i].includes(p)));
    let at = left.findIndex((t, i) => ready(t) && free(i));
    if (at < 0) at = left.findIndex(ready);
    if (at < 0) return todo.map((t) => [t.n]);
    const [t] = left.splice(at, 1);
    let w = 0;
    for (const a of t.after?.tasks ?? []) if (open.has(a)) w = Math.max(w, waveOf.get(a)! + 1);
    for (const p of paths[at]) if (last.has(p)) w = Math.max(w, last.get(p)! + 1);
    waveOf.set(t.n, w);
    for (const p of paths[at]) last.set(p, Math.max(w, last.get(p) ?? 0));
  }
  const out: number[][] = [];
  for (const [n, w] of waveOf) (out[w] ??= []).push(n);
  return out.filter((x) => x !== undefined).map((x) => x.sort((a, b) => a - b));
}

/** D-05: how many executors run at once, from build.parallel ('1'..'99', YAML numerics stay strings); absent or unread, DEFAULT_PARALLEL. */
export function parallelOf(config: AccordConfig | undefined): number {
  const v = config?.build?.parallel;
  return v !== undefined && /^[1-9][0-9]?$/.test(v) ? Number(v) : DEFAULT_PARALLEL;
}
