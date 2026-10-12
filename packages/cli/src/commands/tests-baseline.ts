// Spec §9 `accord tests baseline`: lists the untraced cases that exist when a project adopts the test
// policy, once. It refuses when the file exists — the baseline only shrinks, so it can never become a
// way past gate.test-untraced.
import { existsSync, writeFileSync } from 'node:fs';
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
  if (existsSync(file)) throw new UsageError(REL + ' already exists - the baseline only shrinks; remove lines by hand');
  const ids = untracedTests(ctx.snapshot);
  writeFileSync(file, HEADER + ids.map((i) => i + '\n').join(''));
  ctx.stdout.write(`wrote ${ids.length} case id${ids.length === 1 ? '' : 's'} to ${REL}\n`);
  return 0;
}
