// ST-LN-92 92-ac-1: `accord waves <id>` prints the parallel cap and the plan's tasks left to build, grouped into waves, end to end on real git.
// The cap (build.parallel, D-05) never changes how the tasks are grouped. The CLI here runs as the cut-off release (0.6.0) while the package is still
// 0.5.1, so gate plan's after: cycle rule (PLAN_WAVES_FROM) is read at the version that ships it; CONFIG pins the running version, so 0.6.0 too.
import { describe, expect, it, vi } from 'vitest';
import { PLAN_WAVES_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, pinned } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

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

interface Found { rule: string; level: string; reason?: string; file?: string; line?: number }
/** `accord gate plan T-1 --json`: its exit code and its gate.task-after-cycle findings. */
const cycleGate = async (repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.task-after-cycle') };
};
/** Tasks 2 and 3 name each other in their after: lines; `fixed` gives task 3 `after: 1` instead. */
const cyclePlan = (fixed = false): string =>
  [...HEAD, task(1, 'src/export.ts', 'none'), task(2, 'src/export.ts', '3'), task(3, 'src/export.ts', fixed ? '1' : '2')].join('\n');
const cycleRuntimes = (config: string, runtimes: string): string => config.replace(/^runtimes: .*$/m, `runtimes: ${runtimes}`);

describe('gate plan and the after: cycle', () => {
  it('ac-1 gate plan refuses an after: cycle on real git (ST-LN-92 92-ac-1)', async () => {
    for (const runtimes of ['[claude]', '[codex, cursor, copilot]']) {
      // D-18: the rule is a CLI check, so a repository with no accord agent installed (runtimes without claude) gets it too
      const head = cycleRuntimes(CONFIG, runtimes);
      expect(head, runtimes).toContain(`runtimes: ${runtimes}\n`);
      const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/config.yml': head });
      try {
        await run(['approve', 'T-1'], repo);
        writeFiles(repo, { 'accord/config.yml': cycleRuntimes(pinned(PLAN_WAVES_FROM), runtimes) });
        commitMsg(repo, 'claim: T-1');
        writeFiles(repo, { 'accord/config.yml': head, 'notes.txt': 'work after the claim\n' });
        const baseline = commitAll(repo);
        writeFiles(repo, { 'accord/tickets/T-1/plan.md': cyclePlan().replace('abc1234', baseline) });
        commitAll(repo);

        const got = await cycleGate(repo);
        expect(got.code, runtimes).toBe(1);
        expect(got.found.map((f) => [f.file, f.level, f.reason]), runtimes).toEqual([
          ['accord/tickets/T-1/plan.md', 'error', 'tasks 2, 3 name each other in their after: lines, a cycle no wave order can meet'],
        ]);

        // accord waves reads the same cycle: one task at a time, in number order, with its reason; the Order: line describes the plan, so it stays
        // when no task is left (04-13 Ruling)
        const seq = await run(['waves', 'T-1'], repo);
        expect(seq.code, runtimes).toBe(0);
        expect(seq.out, runtimes).toBe('Parallel: 3\nOrder: one task at a time — tasks 2, 3 form a cycle\nWave 1: 1\nWave 2: 2\nWave 3: 3\n');
        writeFiles(repo, { 'accord/tickets/T-1/ledger.md': LEDGER });
        expect((await run(['waves', 'T-1'], repo)).out, runtimes).toBe('Parallel: 3\nOrder: one task at a time — tasks 2, 3 form a cycle\nNo task left to build\n');
        writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n' });

        // the cycle removed: no finding
        writeFiles(repo, { 'accord/tickets/T-1/plan.md': cyclePlan(true).replace('abc1234', baseline) });
        commitAll(repo);
        expect((await cycleGate(repo)).found, runtimes).toEqual([]);
      } finally {
        cleanup(repo);
      }
    }
  });
});
