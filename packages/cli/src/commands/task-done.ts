// Spec §8 `accord task-done <id> <n>`: writes the ledger line only when the report shows every verify case
// of task n passed and the report is newer than HEAD. The CLI never runs a test command; the orchestrator
// runs the tests, and this reads the evidence the Done gate reads.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordTaskDone, taskVerdict } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket, taskNumber } from './lane-args.js';

/**
 * shortcut: compares whole seconds (git's %ct), so a report written in the same second as the commit, but
 * before it, counts as fresh; upgrade to a content check if that ever lets a stale report through.
 */
function staleReport(ctx: CommandContext): string | undefined {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined || ctx.snapshot.tests === undefined) return undefined; // taskVerdict reports this
  // D-51: the raw config value may carry a backslash; the loader read the file under the slashed key.
  const rel = report.replace(/\\/g, '/').replace(/^\.\//, '');
  const committed =
    Number(
      execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], {
        cwd: ctx.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    ) * 1000;
  const written = Math.floor(statSync(join(ctx.root, ...rel.split('/'))).mtimeMs / 1000) * 1000;
  return written < committed ? `${rel} was written before the last commit; run the tests again` : undefined;
}

export function taskDone(ctx: CommandContext, id: string, task: string): number {
  const n = taskNumber(task);
  requireLaneTicket(ctx, id);
  const commit = ctx.snapshot.git?.commit;
  if (commit === undefined) throw new UsageError('the repository has no commit; commit the task before recording it');
  const verdict = taskVerdict(ctx.snapshot, id, n);
  const stale = verdict.verdict === 'pass' ? staleReport(ctx) : undefined;
  const reasons = [...verdict.reasons, ...(stale === undefined ? [] : [stale])];
  if (reasons.length > 0) {
    ctx.stdout.write(`task ${n} of ${id} is not done:\n` + reasons.map((r) => '  ' + r + '\n').join(''));
    return 1;
  }
  // T-05-07: `id` is a key the loader found on disk, so it is a file stem and never a traversal.
  const rel = 'accord/tickets/' + id + '/ledger.md';
  const file = join(ctx.root, 'accord', 'tickets', id, 'ledger.md');
  const sha = commit.slice(0, 12);
  const next = recordTaskDone(existsSync(file) ? readFileSync(file, 'utf8') : undefined, n, sha);
  if (next === undefined) {
    ctx.stdout.write(`task ${n} of ${id} is already recorded in ${rel}\n`);
    return 0;
  }
  mkdirSync(join(ctx.root, 'accord', 'tickets', id), { recursive: true });
  writeFileSync(file, next);
  ctx.stdout.write(`recorded task ${n} done at ${sha} in ${rel}\n`);
  return 0;
}
