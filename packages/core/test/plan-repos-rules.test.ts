// Phase 08.9.3 D-05, D-06, D-08, D-09, D-14: the plan rules of a ticket that is built in more than one repository, and the claim-pin cut-off that keeps them silent for a ticket claimed before the release.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, OVERRIDABLE, REPOS_FROM, STAGE_OF } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, pinned, REPORT, sized } from '../../../test/helpers/lane.js';

const SHA = 'a'.repeat(40);
const REMOTE = 'https://github.com/acme/tools.git';
const REPOS = ['repos:', '  tools:', `    remote: ${REMOTE}`, '    tests: dotnet test', ''].join('\n');
const REPOS_NO_TESTS = ['repos:', '  tools:', `    remote: ${REMOTE}`, ''].join('\n');

const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n === 1 ? 1 : 2}\nfiles: ${files}\nverify: export#writes-csv (@ac-1)\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n === 1 ? 1 : 2}\n`;
/** A plan: frontmatter lines (default: tools' baseline), then tasks, then slices. */
const planOf = (tasks: string[], slices: string[] = [], fm: string[] = [`baseline_tools: ${SHA}`]): string =>
  ['---', 'baseline: abc1234', ...fm, '---', '', '# Plan', '', ...tasks, ...slices].join('\n');

interface Opts {
  config?: string;
  claim?: { pin: string } | { error: string } | null; // null: no claim fact
}
const check = (text: string, { config = CONFIG + REPOS, claim = { pin: REPOS_FROM } }: Opts = {}): GateResult => {
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
const rule = (r: GateResult, id: string) => r.findings.filter((f) => f.rule === id);
const REPO_RULE = /^gate\.(repo-|task-repo-mixed|slice-repo-mixed)/;
const repoRules = (r: GateResult) => r.findings.filter((f) => REPO_RULE.test(f.rule));

// One plan per rule, each built to trip exactly the rule it names.
const MIXED_MAIN_AND_TOOLS = planOf([task(1, 'src/a.ts, tools:src/b.cs'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')]);
const MIXED_TWO_OTHERS = planOf([task(1, 'tools:x, docs:y'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')]);
const MIXED_MODEL = planOf([task(1, 'src/main.ts (new, like tools:src/Old.cs)'), task(2, 'src/svc.ts')], [slice(1, '1'), slice(2, '2')]);
const SLICE_TOOLS_HOLDS_MAIN = planOf([task(1, 'src/a.ts'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')]);
const SLICE_MAIN_HOLDS_TOOLS = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts')], [slice(1, '1'), slice(2, '2')]);
const NO_SLICES = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts')]);
const LAST_SLICE_TOOLS = planOf([task(1, 'src/a.ts'), task(2, 'tools:src/b.cs')], [slice(1, '1'), slice(2, '2', 'tools')]);
const NO_BASELINE = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')], []);
const BAD_BASELINE = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')], ['baseline_tools: main']);
const SOUND = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')]);

describe('a task is built in one repository (Decision 3)', () => {
  it('risk:complex-branching gate.task-repo-mixed names a task that holds a path of this repository and one of tools (D-09)', () => {
    const f = rule(check(MIXED_MAIN_AND_TOOLS), 'gate.task-repo-mixed');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('task 1');
    expect(f[0].reason).toContain('this repository');
    expect(f[0].reason).toContain('tools');
    expect(f[0].reason).toContain('one repository');
    expect(f[0].reason).toContain('split');
  });

  it('risk:complex-branching gate.task-repo-mixed names a task of two other repositories, and one whose new file is modelled on a file of another repository', () => {
    const two = rule(check(MIXED_TWO_OTHERS), 'gate.task-repo-mixed');
    expect(two).toHaveLength(1);
    expect(two[0].reason).toContain('docs');
    expect(two[0].reason).toContain('tools');
    const model = rule(check(MIXED_MODEL), 'gate.task-repo-mixed');
    expect(model).toHaveLength(1);
    expect(model[0].reason).toContain('task 1');
    expect(model[0].reason).toContain('tools');
  });

  it('risk:complex-branching a task built wholly in tools, with its model in tools, is no mixed task', () => {
    const r = check(planOf([task(1, 'tools:src/a.cs, tools:src/b.cs (new, like tools:src/a.cs)'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')]));
    expect(rule(r, 'gate.task-repo-mixed')).toEqual([]);
  });
});

describe('a slice is built in one repository (D-09)', () => {
  it('risk:complex-branching gate.slice-repo-mixed names a repo: tools slice that holds a task of this repository', () => {
    const f = rule(check(SLICE_TOOLS_HOLDS_MAIN), 'gate.slice-repo-mixed');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('slice 1');
    expect(f[0].reason).toContain('task 1');
    expect(f[0].reason).toContain('tools');
    expect(f[0].reason).toContain('this repository');
  });

  it('risk:complex-branching gate.slice-repo-mixed names a slice with no repo: that holds a task of tools', () => {
    const f = rule(check(SLICE_MAIN_HOLDS_TOOLS), 'gate.slice-repo-mixed');
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain('slice 1');
    expect(f[0].reason).toContain('task 1');
    expect(f[0].reason).toContain('tools');
  });
});

describe('the slices are the deploy order, this repository last (D-08, D-14)', () => {
  it('risk:complex-branching gate.repo-slices asks a plan with a tools task and no slice for slices', () => {
    const f = rule(check(NO_SLICES), 'gate.repo-slices');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('task 1');
    expect(f[0].reason).toContain('D-08');
    expect(f[0].reason).toContain('D-09');
  });

  it('risk:complex-branching gate.repo-slices refuses a plan whose last slice names repo: (D-03, D-14)', () => {
    const f = rule(check(LAST_SLICE_TOOLS), 'gate.repo-slices');
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain('slice 2');
    expect(f[0].reason).toContain('D-03');
    expect(f[0].reason).toContain('D-14');
  });
});

describe('the repositories a plan names are set up (D-05, D-06)', () => {
  it('risk:complex-branching gate.repo-tests-missing names repos.tools.tests when a tools task has no suite to run', () => {
    const f = rule(check(SOUND, { config: CONFIG + REPOS_NO_TESTS }), 'gate.repo-tests-missing');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('repos.tools.tests');
    expect(rule(check(SOUND), 'gate.repo-tests-missing')).toEqual([]);
  });

  it('risk:complex-branching gate.repo-baseline-missing names the command that takes the baseline, for no key and for a key that is no sha', () => {
    for (const text of [NO_BASELINE, BAD_BASELINE]) {
      const f = rule(check(text), 'gate.repo-baseline-missing');
      expect(f).toHaveLength(1);
      expect(f[0].level).toBe('error');
      expect(f[0].reason).toContain('accord repos baseline tools --id T-1');
    }
    expect(rule(check(SOUND), 'gate.repo-baseline-missing')).toEqual([]);
  });
});

describe('a token that only looks like <name>:<path> is a plain path (Pitfall 3, T-08.9.3-08)', () => {
  const TOKENS = ['c:foo', 'C:/dir/x', 'tools:../x', 'tools:/abs', 'tools:a\\b'];

  it('risk:parsing a one-letter prefix, an uppercase drive, a parent segment, an absolute path and a backslash are never split', () => {
    const { plan } = parsePlan('plan.md', planOf([task(1, TOKENS.join(' '))]));
    expect(plan.tasks[0].files).toEqual(TOKENS);
    for (const k of ['repo', 'repoFiles', 'repoNewFiles', 'repoModels']) expect(k in plan.tasks[0], k).toBe(false);
  });

  it('risk:security gate plan reports each of them as a plain path that does not exist at the baseline, and names no repository', () => {
    const files: Record<string, string> = approved(
      {
        'accord/config.yml': CONFIG + REPOS,
        'accord/tickets/T-1.md': laneTicket('T-1', { body: sized(8) }),
        [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
        'accord/tickets/T-1/plan.md': planOf([task(1, TOKENS.join(' ')), task(2, 'src/svc.ts')], [slice(1, '1'), slice(2, '2')]),
      },
      'T-1',
    );
    const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
    const r = gatePlan({ ...snapshot, claimPins: { 'T-1': { pin: REPOS_FROM } }, baselineFiles: { abc1234: ['src/svc.ts'] } }, 'T-1');
    const unknown = rule(r, 'gate.task-file-unknown').map((f) => f.reason);
    for (const t of TOKENS) expect(unknown.some((reason) => reason.includes(`names ${t},`)), t).toBe(true);
    expect(repoRules(r)).toEqual([]);
  });
});

describe('a ticket claimed before the release is judged as before (T-08.9.3-09)', () => {
  const CASES: [string, string, string, Opts?][] = [
    ['gate.task-repo-mixed', 'task', MIXED_MAIN_AND_TOOLS],
    ['gate.slice-repo-mixed', 'slice', SLICE_TOOLS_HOLDS_MAIN],
    ['gate.repo-slices', 'no slice', NO_SLICES],
    ['gate.repo-slices', 'last slice', LAST_SLICE_TOOLS],
    ['gate.repo-tests-missing', 'tests', SOUND, { config: CONFIG + REPOS_NO_TESTS }],
    ['gate.repo-baseline-missing', 'baseline', NO_BASELINE],
    ['gate.repo-unknown', 'unknown', MIXED_TWO_OTHERS],
  ];

  it.each(CASES)('risk:regression %s (%s) gives no finding for a ticket claimed at 0.21.1', (id, _what, text, opts) => {
    expect(rule(check(text, { ...opts, claim: { pin: '0.21.1' } }), id)).toEqual([]);
    expect(rule(check(text, opts), id).length, 'the same plan at the release does').toBeGreaterThan(0);
  });

  it('risk:regression with no claim fact the working-tree pin decides, and a failed read of the claim applies the rules (fail closed)', () => {
    expect(rule(check(MIXED_MAIN_AND_TOOLS, { config: pinned('0.21.1') + REPOS, claim: null }), 'gate.task-repo-mixed')).toEqual([]);
    expect(rule(check(MIXED_MAIN_AND_TOOLS, { config: pinned(REPOS_FROM) + REPOS, claim: null }), 'gate.task-repo-mixed')).toHaveLength(1);
    expect(rule(check(MIXED_MAIN_AND_TOOLS, { claim: { error: 'git log failed' } }), 'gate.task-repo-mixed')).toHaveLength(1);
  });
});

describe('the classification', () => {
  const IDS = ['gate.repo-unknown', 'gate.repo-tests-missing', 'gate.repo-baseline-missing', 'gate.task-repo-mixed', 'gate.slice-repo-mixed', 'gate.repo-slices'];

  it('risk:security none of the new rules is overridable, and each belongs to the plan stage', () => {
    for (const id of IDS) {
      expect(OVERRIDABLE, id).not.toContain(id);
      expect(STAGE_OF[id], id).toBe('plan');
    }
  });
});
