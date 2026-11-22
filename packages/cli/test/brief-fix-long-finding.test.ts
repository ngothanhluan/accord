// Review 08.5 WR-01: a finding longer than 300 characters reaches the fix brief and its tracked path joins the test command.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, REPORT } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, makeLaneRepo, run } from './helpers/repo.js';

const AFFECTED = CONFIG.replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  affected: "npx vitest run {files}"\n`);
const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) cleanup(folders.pop() as string);
});

it('risk:data-loss a long finding line reaches the fix brief and names its file in the test command (review WR-01)', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': AFFECTED, 'src/a.ts': 'export const a = 1;\n' });
  folders.push(repo);
  claimedUnder(repo, '0.12.2');
  const dir = mkdtempSync(join(tmpdir(), 'accord-findings-'));
  folders.push(dir);
  const long = 'Must src/a.ts:10 the export drops the header row when the report is empty, and the same happens for a report with one row, and for a report with a quoted comma in the first cell, which the escape misses; the failing case is an empty report exported twice in one run, and the second export is short by one line';
  expect(long.length).toBeGreaterThan(300);
  const file = join(dir, 'findings.md');
  writeFileSync(file, long + '\n');
  const r = await run(['brief', 'T-1', '--fix', file], repo);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain('\n' + long + '\n');
  expect(r.out).not.toContain('withheld line 1 of the findings file');
  expect(r.out).toContain('Test command: npx vitest run src/a.ts\n');
}, 120_000);
