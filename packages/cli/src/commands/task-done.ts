// Spec §8 `accord task-done <id> <n>`: writes the ledger line only when the report shows every verify case
// of task n passed and the report is newer than HEAD. The CLI never runs a test command; the orchestrator
// runs the tests, and this reads the evidence the Done gate reads.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { forbiddenLines, normaliseKey, recordTaskDone, taskVerdict, trailerReason, workOf, writeTestTags } from '@accord-dev/accord-core';
import { gitBranchCommits, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket, taskNumber } from './lane-args.js';

/** `git show -s --format=%ct` output as seconds; anything but digits would make every report look fresh. */
export function commitSeconds(out: string): number {
  const text = out.trim();
  if (!/^\d+$/.test(text)) throw new UsageError('git printed no commit time for HEAD; cannot tell whether the report is fresh');
  return Number(text);
}

/**
 * shortcut: compares whole seconds (git's %ct), so a report written in the same second as the commit, but
 * before it, counts as fresh; upgrade to a content check if that ever lets a stale report through.
 */
export function staleReport(ctx: CommandContext): string | undefined {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined || ctx.snapshot.tests === undefined) return undefined; // taskVerdict reports this
  // D-51: the raw config value may carry a backslash; the loader read the file under the slashed key.
  const rel = normaliseKey(report);
  const committed =
    commitSeconds(
      execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], {
        cwd: ctx.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ) * 1000;
  const written = Math.floor(statSync(join(ctx.root, ...rel.split('/'))).mtimeMs / 1000) * 1000;
  return written < committed ? `${rel} was written before the last commit; run the tests again` : undefined;
}

export function taskDone(ctx: CommandContext, id: string, task: string): number {
  const n = taskNumber(task);
  requireLaneTicket(ctx, id);
  const commit = ctx.snapshot.git?.commit;
  if (commit === undefined) throw new UsageError('the repository has no commit; commit the task before recording it');
  // T-05-07: `id` is a key the loader found on disk, so it is a file stem and never a traversal.
  const rel = 'accord/tickets/' + id + '/ledger.md';
  const file = join(ctx.root, 'accord', 'tickets', id, 'ledger.md');
  const sha = commit.slice(0, 12);
  const next = recordTaskDone(existsSync(file) ? readFileSync(file, 'utf8') : undefined, n, sha);
  const verdict = taskVerdict(ctx.snapshot, id, n);
  const ticket = ctx.snapshot.tickets[id];
  const ticketFile = join(ctx.root, ...ticket.file.split('/'));
  const maps = workOf(ctx.snapshot, id)?.plan?.tasks.find((t) => t.n === n)?.maps ?? [];
  // A recorded task is re-checked only for tags: the committed ledger makes HEAD newer than the report.
  const stale = next !== undefined && verdict.verdict === 'pass' ? staleReport(ctx) : undefined;
  const reasons = [...verdict.reasons, ...(stale === undefined ? [] : [stale])];
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
      return refuse(tagged.conflicts.map((c) => `${c.ac} already carries @test:${c.existing}; the plan maps it to ${c.test}`));
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
