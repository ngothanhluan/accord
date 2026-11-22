// Review 08.5 IN-03: a refused --out is found before the brief removes the task's old report, so "nothing was written" is true.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, REPORT } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, makeLaneRepo, run } from './helpers/repo.js';

const AFFECTED = CONFIG.replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  affected: "npx vitest run {files}"\n`);
const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

it('risk:data-loss a refused --out leaves the earlier task report in place (review IN-03)', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': AFFECTED });
  repos.push(repo);
  claimedUnder(repo, '0.12.2');
  const folder = join(repo, '.accord-reports', 'T-1');
  mkdirSync(join(folder, 'brief.md'), { recursive: true });
  writeFileSync(join(folder, 'task-1.md'), 'EARLIER REPORT\n');
  const r = await run(['brief', 'T-1', '1', '--out', 'brief.md'], repo);
  expect(r.code).toBe(2);
  expect(r.err).toContain('nothing was written');
  expect(existsSync(join(folder, 'task-1.md'))).toBe(true);
  expect(readFileSync(join(folder, 'task-1.md'), 'utf8')).toBe('EARLIER REPORT\n');
}, 120_000);
