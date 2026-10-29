// ST-LN-63 Task 1: the sample repositories every counting and golden test of this ticket runs on.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { gitRun, run } from './helpers/repo.js';
import { prepareSamples, SAMPLE_BUILD_LIMIT, samples } from './helpers/samples.js';

beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT);
afterAll(() => {
  const { mixed, side } = samples();
  mixed.cleanup();
  side.cleanup();
});

type Row = { id: string; stage?: string; branch?: string };

async function rows(root: string): Promise<Record<string, Row>> {
  const r = await run(['status', '--json', '--all'], root);
  expect(r.code, r.err).toBe(0);
  return Object.fromEntries((JSON.parse(r.out) as Row[]).map((row) => [row.id, row]));
}

it('risk:complex-branching each sample ticket shows the stage its kind is built for', async () => {
  const { mixed, side } = samples();

  const m = mixed.copy();
  try {
    const stages = Object.fromEntries(Object.entries(await rows(m.root)).map(([id, row]) => [id, row.stage]));
    expect(stages).toEqual({
      'A-1': 'intent',
      'A-2': 'plan',
      'A-3': 'build',
      'A-4': 'build',
      'A-5': 'review',
      'A-6': 'verify',
      'A-7': 'verify',
      'A-8': 'done',
      'A-9': 'done',
      'A-10': 'done',
      'A-11': 'review',
      'A-12': 'intent',
      'A-13': 'verify',
      'S-1': 'done',
    });
    expect(mixed.withMerge).toEqual(['A-6', 'A-13']);
    const merges = gitRun(m.root, 'rev-list', '--merges', 'refs/heads/main..refs/heads/t/A-13').trim().split('\n');
    expect(merges).toHaveLength(1);
    const review = mixed.shaOf('A-13-review');
    // The merge is an ancestor of the review commit, which is the branch's last commit.
    gitRun(m.root, 'merge-base', '--is-ancestor', merges[0], review);
    expect(gitRun(m.root, 'rev-parse', 'refs/heads/t/A-13').trim()).toBe(review);
    expect(mixed.names[review]).toBe('A-13-review');
    // A merge on A-6's branch comes after its review commit.
    const a6 = gitRun(m.root, 'rev-list', '--merges', 'refs/heads/main..refs/heads/t/A-6').trim().split('\n');
    expect(a6).toHaveLength(1);
    gitRun(m.root, 'merge-base', '--is-ancestor', mixed.shaOf('A-6-review'), a6[0]);
    // The straight tickets hold no merge.
    for (const id of ['A-5', 'A-7', 'S-1']) {
      expect(gitRun(m.root, 'rev-list', '--merges', `refs/heads/main..refs/heads/t/${id}`).trim(), id).toBe('');
    }
  } finally {
    m.cleanup();
  }

  const s = side.copy();
  const local = side.copy();
  try {
    expect(side.withMerge).toEqual(['F-3']);
    for (const c of [s, local]) {
      if (c === local) gitRun(c.root, 'remote', 'remove', 'origin');
      const got = await rows(c.root);
      const view = Object.fromEntries(['F-1', 'F-2', 'F-3', 'F-4'].map((id) => [id, [got[id]?.stage, got[id]?.branch]]));
      expect(view).toEqual({
        'F-1': ['verify', 'feature/F-1'],
        'F-2': ['review', 'feature/F-2'],
        'F-3': ['verify', 'feature/F-3'],
        'F-4': ['plan', 'feature/F-4'],
      });
    }
    const pushed = gitRun(s.root, 'rev-parse', 'refs/heads/feature/F-1', 'refs/remotes/origin/feature/F-1').trim().split('\n');
    expect(pushed[0]).not.toBe(pushed[1]);
    expect(gitRun(s.root, 'rev-parse', 'refs/heads/feature/F-1^').trim()).toBe(pushed[1]);
    expect(gitRun(local.root, 'for-each-ref', 'refs/remotes/origin/').trim()).toBe('');
  } finally {
    s.cleanup();
    local.cleanup();
  }
}, 120_000);
