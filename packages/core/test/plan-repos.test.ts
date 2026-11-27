// Phase 08.9.3 D-05, D-09: plan.md names a task's path in another repository (`<name>:<path>`), a slice's repository (`repo:`) and each other repository's
// baseline (`baseline_<name>`); `gate plan` reads them in core and is silent about them for a ticket claimed before the release.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, REPOS_FROM, splitRepoPath } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, REPORT, sized } from '../../../test/helpers/lane.js';

const TOOLS_SHA = 'a'.repeat(40);
const REPOS = ['repos:', '  tools:', '    remote: https://github.com/acme/tools.git', '    tests: dotnet test', ''].join('\n');

/** The two-slice plan of D-08: slice 1 is built in tools, the last slice is in this repository. */
const plan = (task1 = 'files: tools:src/Tools.cs, tools:src/New.cs (new, like tools:src/Other.cs)'): string =>
  [
    '---',
    'baseline: abc1234',
    `baseline_tools: ${TOOLS_SHA}`,
    '---',
    '',
    '# Plan',
    '',
    '## Task 1: Tools writer',
    'covers: @ac-1, D-01',
    task1,
    'verify: export#writes-csv (@ac-1)',
    'after: none',
    'Add the csv mode to the tools writer.',
    '',
    '## Task 2: Service',
    'covers: @ac-2',
    'files: src/svc.ts',
    'verify: export#escapes-commas (@ac-2)',
    'after: 1',
    'Quote cells that contain a comma.',
    '',
    '## Slice 1: Tools',
    'repo: tools',
    'tasks: 1',
    'covers: @ac-1',
    '',
    '## Slice 2: Service',
    'tasks: 2',
    'covers: @ac-2',
    '',
  ].join('\n');

const check = ({ text = plan(), config = CONFIG + REPOS, claim = { pin: REPOS_FROM } }: { text?: string; config?: string; claim?: { pin: string } | null } = {}): GateResult => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', { body: sized(8) }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'accord/tickets/T-1/plan.md': text,
    },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return gatePlan(claim === null ? snapshot : { ...snapshot, claimPins: { 'T-1': claim } }, 'T-1');
};
const repoRules = (r: GateResult) => r.findings.filter((f) => /^gate\.(repo-|task-repo-mixed|slice-repo-mixed)/.test(f.rule));

describe('a plan names the repository of a task and of a slice', () => {
  it('risk:parsing a task names tools paths, a new tools file and its model; the slice names tools; the baseline is read (D-05, D-09)', () => {
    const { plan: p, findings } = parsePlan('plan.md', plan());
    expect(findings).toEqual([]);
    const one = p.tasks[0];
    expect(one.files).toEqual([]);
    expect(one.newFiles).toEqual([]);
    expect(one.models).toEqual([]);
    expect(one.repoFiles).toEqual([
      { repo: 'tools', path: 'src/Tools.cs' },
      { repo: 'tools', path: 'src/New.cs' },
    ]);
    expect(one.repoNewFiles).toEqual([{ repo: 'tools', path: 'src/New.cs' }]);
    expect(one.repoModels).toEqual([{ repo: 'tools', path: 'src/New.cs', like: 'tools:src/Other.cs' }]);
    expect(one.repo).toBe('tools');
    expect(p.tasks[1].files).toEqual(['src/svc.ts']);
    expect(p.slices![0].repo).toBe('tools');
    expect(p.slices![1].repo).toBeUndefined();
    expect(p.baseline).toBe('abc1234');
    expect(p.repoBaselines).toEqual({ tools: TOOLS_SHA });
  });

  it('risk:regression a task that names no other repository parses to exactly today\'s object (D-05)', () => {
    const { plan: p } = parsePlan('plan.md', plan('files: src/a.ts, src/b.ts (new, like src/a.ts)'));
    for (const t of p.tasks) for (const k of ['repo', 'repoFiles', 'repoNewFiles', 'repoModels']) expect(k in t, k).toBe(false);
    expect(p.tasks[0].files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(p.tasks[0].models).toEqual([{ path: 'src/b.ts', like: 'src/a.ts' }]);
    expect('repo' in p.slices![1]).toBe(false);
    const bare = parsePlan('plan.md', '---\nbaseline: abc1234\n---\n## Task 1: A\nfiles: src/a.ts\n').plan;
    expect('repoBaselines' in bare).toBe(false);
  });

  it('risk:parsing a second token on the repo: line of a slice is unread (D-09)', () => {
    const s = parsePlan('plan.md', '## Slice 1: A\nrepo: tools extra\ntasks: 1\ncovers: @ac-1\n').plan.slices![0];
    expect(s.repo).toBe('tools');
    expect(s.unread).toEqual(['extra']);
  });

  it('risk:parsing splitRepoPath reads <name>:<path> and nothing else (D-05)', () => {
    expect(splitRepoPath('tools:src/Tools.cs')).toEqual({ repo: 'tools', path: 'src/Tools.cs' });
    expect(splitRepoPath('src/Tools.cs')).toEqual({ path: 'src/Tools.cs' });
  });
});

describe('gate plan reads the repository of a task', () => {
  it('risk:complex-branching a two-slice plan with a tools slice first and this repository last has no repository finding (D-05, D-08, D-09)', () => {
    const r = check();
    expect(repoRules(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('risk:complex-branching a repository the config does not declare is one gate.repo-unknown finding naming it (D-05)', () => {
    const r = check({ text: plan('files: docs:README.md') });
    const f = r.findings.filter((x) => x.rule === 'gate.repo-unknown');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('docs');
    expect(f[0].reason).toContain('docs:README.md');
    expect(f[0].reason).toContain('repos:');
  });

  it('risk:regression a ticket claimed before the release gets no gate.repo-unknown finding (T-08.9.3-09)', () => {
    const r = check({ text: plan('files: docs:README.md'), claim: { pin: '0.21.1' } });
    expect(r.findings.filter((x) => x.rule === 'gate.repo-unknown')).toEqual([]);
  });
});
