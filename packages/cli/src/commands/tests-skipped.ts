// `accord tests skipped`: every case the test report records as skipped, with the operating system the run was
// on, so the owner's report can name what verify did not check. It writes no file.
import { normaliseKey } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { staleReport } from './task-done.js';

export function testsSkipped(ctx: CommandContext): number {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined) throw new UsageError('no tests.report in accord/config.yml; the baseline is read from the report');
  if (ctx.snapshot.tests === undefined) {
    throw new UsageError(`tests.report "${normaliseKey(report)}" was not found; run the tests first`);
  }
  if (ctx.snapshot.git?.commit !== undefined) {
    const stale = staleReport(ctx);
    if (stale !== undefined) throw new UsageError(stale);
  }
  const ids = Object.keys(ctx.snapshot.tests).filter((id) => ctx.snapshot.tests?.[id] === 'skipped').sort();
  ctx.stdout.write(`skipped on ${process.platform}: ${ids.length}\n` + ids.map((i) => i + '\n').join(''));
  return 0;
}
