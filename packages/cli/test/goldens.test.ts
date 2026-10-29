// ST-LN-63 Task 2: what every command printed at the baseline, and the git processes it started.
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { goldenPath, readGolden, RUNS, runSample } from './helpers/runs.js';
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

const win = process.platform === 'win32';

/** The folders that hold the user's name or a run-specific path; none of them may reach a golden file. */
function leaks(text: string): string[] {
  const dirs = [homedir(), tmpdir(), realpathSync.native(tmpdir())];
  const forms = dirs.flatMap((d) => [d, d.replaceAll('\\', '/')]);
  const hay = win ? text.toLowerCase() : text;
  return forms.filter((f) => hay.includes(win ? f.toLowerCase() : f));
}

// Six times the 97 s a run of the 41 keys took on the owner's Windows machine (about 1,000 git processes), rounded up.
const LIMIT = 600_000;

it('ac-2 every command prints what it printed before the change', async () => {
  const got = await runSample();
  for (const key of RUNS) expect(got[key]?.argv.length, `${key} started no git process`).toBeGreaterThan(0);

  const goldens = goldenPath('goldens.json');
  const counts = goldenPath('git-counts.before.json');
  if (process.env.ACCORD_RECORD_ST_LN_63 === '1') {
    if (existsSync(goldens) || existsSync(counts)) throw new Error('a golden file is present: it is recorded once and never rewritten');
    const printed = JSON.stringify(
      Object.fromEntries(RUNS.map((k) => [k, { code: got[k].code, out: got[k].out, err: got[k].err, ...(got[k].refs === undefined ? {} : { refs: got[k].refs }) }])),
      null,
      2,
    ) + '\n';
    const argvs = JSON.stringify(Object.fromEntries(RUNS.map((k) => [k, got[k].argv])), null, 2) + '\n';
    for (const [name, text] of [['goldens.json', printed], ['git-counts.before.json', argvs]]) {
      const found = leaks(text);
      if (found.length > 0) throw new Error(`${name} holds a folder of this machine: ${found.join(', ')}`);
    }
    mkdirSync(dirname(goldens), { recursive: true });
    writeFileSync(goldens, printed);
    writeFileSync(counts, argvs);
  }

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
