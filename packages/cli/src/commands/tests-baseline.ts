// Spec §9 `accord tests baseline`: lists the untraced cases that exist when a project adopts the test
// policy, once. It refuses when the file exists — the baseline only shrinks, so it can never become a
// way past gate.test-untraced.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { untracedTests } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

const REL = 'accord/tests-baseline.txt';
const HEADER =
  '# Test cases that existed before the test policy applied. One report case id per line.\n' +
  '# This file only shrinks: a case removed from the suite or traced to a criterion comes off; nothing is added.\n';

export function testsBaseline(ctx: CommandContext): number {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined) throw new UsageError('no tests.report in accord/config.yml; the baseline is read from the report');
  if (ctx.snapshot.tests === undefined) throw new UsageError(`tests.report "${report}" was not found; run the tests first`);
  const file = join(ctx.root, 'accord', 'tests-baseline.txt');
  const all = untracedTests(ctx.snapshot);
  const ids = all.filter((i) => i !== ''); // an empty id would be a blank line, which parseBaseline skips
  if (ids.length < all.length) ctx.stderr.write(`skipped ${all.length - ids.length} case(s) with an empty name\n`);
  try {
    // 'wx' makes the existence check and the write one step, so a racing run cannot overwrite the file.
    writeFileSync(file, HEADER + ids.map((i) => i + '\n').join(''), { flag: 'wx' });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new UsageError(REL + ' already exists - the baseline only shrinks; remove lines by hand');
    throw new UsageError(`cannot write ${REL}: ${(e as NodeJS.ErrnoException).code ?? 'write failed'}`);
  }
  ctx.stdout.write(`wrote ${ids.length} case id${ids.length === 1 ? '' : 's'} to ${REL}\n`);
  return 0;
}
