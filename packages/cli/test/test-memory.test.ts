import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import setup, { GB, type VitestRun } from '../../../test/lock.js';
import { workers } from '../../../vitest.config.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'accord-memory-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// A stand-in for the root project: one project without its own count (as packages/core and packages/cli are) and one
// with it (as --maxWorkers or VITEST_MAX_WORKERS makes every project).
const run = (cap: number): VitestRun => ({ vitest: { config: { maxWorkers: cap }, projects: [{ config: {} }, { config: { maxWorkers: cap } }] } });
const counts = (r: VitestRun) => [r.vitest.config.maxWorkers, ...r.vitest.projects.map((p) => p.config.maxWorkers)];
// The criteria's figures: each fork needs 1 GB, 4 GB kept free; win32 so a Mac host runs the Windows and Linux path.
const figures = (lines: string[]) => ({ lock: join(dir, 'run.lock'), perFork: GB, reserve: 4 * GB, poll: 0, platform: 'win32' as const, log: (l: string) => lines.push(l) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

it('risk:regression a real vitest run starts one fork when the free memory allows one', async () => {
  const fixture = join(import.meta.dirname, 'fixtures', 'fork-cap');
  const vitest = join(import.meta.dirname, '..', '..', '..', 'node_modules', 'vitest', 'vitest.mjs');
  const log = join(dir, 'pool-ids');
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST'))),
    ACCORD_FORK_CAP_LOCK: join(dir, 'run.lock'),
    ACCORD_FORK_CAP_LOG: log,
    ACCORD_FORK_CAP_CACHE: join(dir, 'vite-cache'),
  };
  const result = await new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [vitest, 'run', '--config', 'fork-cap.config.ts'], { cwd: fixture, env });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));
    child.on('close', (code) => resolve({ code, out }));
  });
  expect(result.code, result.out).toBe(0);
  expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(['1', '1', '1']);
}, 120_000);

it('ac-1 the fork count follows the free memory capped by half the CPUs', async () => {
  for (const [free, expected] of [[10, 6], [30, 8]] as const) {
    const lines: string[] = [];
    const r = run(workers({}, 16));
    const release = await setup(r, { ...figures(lines), free: () => free * GB });
    expect(counts(r)).toEqual([expected, expected, expected]);
    expect(lines).toEqual([]);
    release();
  }
});

it('ac-2 an explicit ACCORD_TEST_WORKERS is a cap the free memory can lower', async () => {
  for (const [cap, free, expected] of [['20', 10, 6], ['3', 30, 3]] as const) {
    const lines: string[] = [];
    const r = run(workers({ ACCORD_TEST_WORKERS: cap }, 4));
    const release = await setup(r, { ...figures(lines), free: () => free * GB });
    expect(counts(r)).toEqual([expected, expected, expected]);
    expect(lines).toEqual([]);
    release();
  }
});

it('ac-3 a run waits with one line until one fork fits and has no time limit', async () => {
  let free = 4.5 * GB;
  let reads = 0;
  const lines: string[] = [];
  const r = run(workers({}, 16));
  const pending = setup(r, { ...figures(lines), free: () => { reads++; return free; } });
  let settled = false;
  void pending.then(() => { settled = true; });
  while (reads < 20) await sleep(5);
  expect(settled).toBe(false);
  expect(counts(r)).toEqual([8, undefined, 8]);
  expect(lines).toEqual(['accord: waiting for free memory (4.5 GB free, 5 GB needed: 4 GB kept free for the rest of the machine plus 1 GB for one fork)']);
  free = 7 * GB;
  const release = await pending;
  expect(counts(r)).toEqual([3, 3, 3]);
  expect(lines).toHaveLength(1);
  release();
});

it('ac-4 the fork count is read once the lock is held', async () => {
  writeFileSync(join(dir, 'run.lock'), JSON.stringify({ pid: process.pid, cwd: 'another run' }));
  let free = 2 * GB;
  const lines: string[] = [];
  const r = run(workers({}, 16));
  const pending = setup(r, { ...figures(lines), free: () => free });
  while (!lines.some((l) => l.includes('waiting for another test run'))) await sleep(5);
  free = 10 * GB;
  rmSync(join(dir, 'run.lock'));
  const release = await pending;
  expect(counts(r)).toEqual([6, 6, 6]);
  expect(lines).toHaveLength(1);
  expect(lines[0]).not.toContain('waiting for free memory');
  expect(JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).cwd).toBe(process.cwd());
  release();
  expect(() => readFileSync(join(dir, 'run.lock'), 'utf8')).toThrow();
});

it('risk:complex-branching on macOS the run takes the lock and neither waits for memory nor lowers the count', async () => {
  let reads = 0;
  const lines: string[] = [];
  const r = run(workers({}, 16));
  const release = await setup(r, { ...figures(lines), platform: 'darwin', free: () => { reads++; return 10 * GB; } });
  expect(counts(r)).toEqual([8, undefined, 8]);
  expect(reads).toBe(0);
  expect(lines).toEqual([]);
  expect(JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).cwd).toBe(process.cwd());
  release();
  expect(() => readFileSync(join(dir, 'run.lock'), 'utf8')).toThrow();
});
