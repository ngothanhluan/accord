// ST-LN-36 (05-04): `accord review-package` prints `## Security triggers`, in lane M and lane S, from the default patterns.
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const RUN_BASE = 'export const one = 1;\nexport const two = 2;\nexport const three = 3;\n';
const RUN_NEW = "export const one = 1;\nexport const two = 2;\nspawnSync('git', ['status']);\nexport const three = 3;\n";

function identity(repo: string): void {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
}

const section = (out: string): string => {
  const at = out.indexOf('## Security triggers');
  const next = out.indexOf('\n## ', at + 1);
  return at < 0 ? '' : out.slice(at, next < 0 ? undefined : next).trimEnd();
};

it('ac-1 review-package prints the security triggers of a change in lane M and lane S (ST-LN-36 36-ac-1)', async () => {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      'src/run.ts': RUN_BASE,
      'docs/notes.md': 'notes\n',
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');

    // lane M: the plan records the baseline
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), 'src/run.ts': RUN_NEW });
    commitMsg(repo, 'plan and spawn');
    const m = await run(['review-package', 'T-1'], repo);
    expect(m.err).toBe('');
    expect(m.code).toBe(0);
    expect(section(m.out)).toBe('## Security triggers\n\nsrc/run.ts:3: spawn (process spawn)');
    expect(m.out.indexOf('## Security triggers')).toBeLessThan(m.out.indexOf('## Stat'));

    // lane S: the base is the default branch
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'src/run.ts': RUN_NEW });
    commitMsg(repo, 'spawn');
    const s = await run(['review-package', 'S-1'], repo);
    expect(s.err).toBe('');
    expect(s.code).toBe(0);
    expect(section(s.out)).toBe('## Security triggers\n\nsrc/run.ts:3: spawn (process spawn)');
    expect(s.out.indexOf('## Security triggers')).toBeLessThan(s.out.indexOf('## Stat'));

    // a Markdown-only change matches nothing
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-2');
    writeFiles(repo, { 'accord/tickets/S-2.md': laneTicket('S-2', { lane: 'S', body: LANE_S_BODY }), 'docs/notes.md': 'notes\ntoken and spawnSync words\n' });
    commitMsg(repo, 'docs');
    const d = await run(['review-package', 'S-2'], repo);
    expect(d.err).toBe('');
    expect(section(d.out)).toBe('## Security triggers\n\n(none: no pattern matched)');
  } finally {
    cleanup(repo);
  }
}, 120_000);
