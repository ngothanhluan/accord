// ST-LN-92 92-ac-1: `accord waves <id>` prints the parallel cap and the plan's tasks left to build, grouped into waves, end to end on real git.
// The cap (build.parallel, D-05) never changes how the tasks are grouped.
import { describe, expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const HEAD = ['---', 'baseline: abc1234', '---', '', '# Plan', ''];
const task = (n: number, files: string, after: string): string =>
  [`## Task ${n}: Step ${n}`, 'covers: @ac-1', `files: ${files}`, `verify: t#case-${n} (@ac-1)`, `after: ${after}`, ''].join('\n');
const PLAN = [
  ...HEAD,
  task(1, 'src/a.ts', 'none'),
  task(2, 'src/b.ts', '1'),
  task(3, 'src/c.ts', '1'),
  task(4, 'src/d.ts', '2, 3'),
  task(5, 'src/a.ts', 'none'),
].join('\n');
const LEDGER = '## Tasks\n' + [1, 2, 3, 4, 5].map((n) => `- task ${n} done abc1234\n`).join('');

describe('accord waves', () => {
  it('ac-1 accord waves prints the waves and the cap (ST-LN-92 92-ac-1)', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-1/plan.md': PLAN });
    try {
      const r = await run(['waves', 'T-1'], repo);
      expect(r.err).toBe('');
      expect(r.code).toBe(0);
      expect(r.out).toBe('Parallel: 3\nWave 1: 1\nWave 2: 2, 3, 5\nWave 3: 4\n');

      // the cap at 1 runs one executor at a time; the waves stay the same
      expect(CONFIG).not.toMatch(/^build:/m);
      writeFiles(repo, { 'accord/config.yml': CONFIG + 'build:\n  parallel: "1"\n' });
      const one = await run(['waves', 'T-1'], repo);
      expect(one.code).toBe(0);
      expect(one.out).toBe('Parallel: 1\nWave 1: 1\nWave 2: 2, 3, 5\nWave 3: 4\n');

      // every task recorded in the ledger
      writeFiles(repo, { 'accord/tickets/T-1/ledger.md': LEDGER });
      const none = await run(['waves', 'T-1'], repo);
      expect(none.code).toBe(0);
      expect(none.out).toBe('Parallel: 1\nNo task left to build\n');
    } finally {
      cleanup(repo);
    }
  });
});
