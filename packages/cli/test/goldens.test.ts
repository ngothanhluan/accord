// ST-LN-63 Task 2: what every command printed at the baseline, and the git processes it started. The golden files are recorded once and only read here.
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readGolden, RUNS, runSample } from './helpers/runs.js';
import { prepareSamples, SAMPLE_BUILD_LIMIT, samples } from './helpers/samples.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT);
afterAll(() => {
  const { mixed, side } = samples();
  mixed.cleanup();
  side.cleanup();
});

interface Golden {
  code: number;
  out: string;
  err: string;
  refs?: string[];
}

// Six times the 97 s a run of the 41 keys took on the owner's Windows machine (about 1,000 git processes), rounded up.
const LIMIT = 600_000;

it('ac-2 every command prints what it printed before the change', async () => {
  const got = await runSample();
  for (const key of RUNS) expect(got[key]?.argv.length, `${key} started no git process`).toBeGreaterThan(0);

  const golden = readGolden<Record<string, Golden>>('goldens.json');
  const before = readGolden<Record<string, string[][]>>('git-counts.before.json');
  for (const key of RUNS) {
    expect(before[key]?.length, `${key} has no recorded git calls`).toBeGreaterThan(0);
    const want = golden[key];
    expect(want, `${key} has no golden`).toBeDefined();
    expect(got[key].code, `${key} exit code`).toBe(want.code);
    expect(got[key].out, `${key} stdout`).toBe(want.out);
    expect(got[key].err, `${key} stderr`).toBe(want.err);
    expect(got[key].refs, `${key} refs`).toEqual(want.refs);
  }
}, LIMIT);
