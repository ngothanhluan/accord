// Phase 08.9.3 D-08, D-13, T-08.9.3-31: `accord pr wait <id>` follows a ticket's slices across repositories in deploy order. The pull request of a slice in another repository is read with `gh` aimed at that repository
// by `GH_REPO` (the declared remote, Ruling R17); a base is moved only between two slices of the same repository; and when every slice below a held slice merged, the wait ends `released` (Ruling R18) so the
// verify skill writes the held slice's block. `gh` is intercepted as in pr-wait.test.ts (a recorded argv array and options, never a spawn); `git` stays real, in two sibling clones (helpers/repos.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

interface Opts {
  cwd?: string;
  shell?: unknown;
  env?: Record<string, string | undefined>;
}
/** What the fake `gh` answers: a string is stdout, an Error is a failed call. Set per case. */
const gh = vi.hoisted(() => ({
  calls: [] as { args: string[]; opts: Opts }[],
  answer: (() => '') as (args: string[], opts: Opts) => string | Error,
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: (file: string, args: string[], opts: unknown) => {
      if (file !== 'gh') return (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(file, args, opts);
      gh.calls.push({ args, opts: opts as Opts });
      const out = gh.answer(args, opts as Opts);
      if (out instanceof Error) throw out;
      return out;
    },
  };
});

useRepoSandboxes();
beforeEach(() => {
  gh.calls.length = 0;
  gh.answer = () => '';
  delete process.env.GH_REPO;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const CLAIM = 't/ST-9';
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;

/** One slice of the plan: its number and the repository it is built in (absent: this repository). */
interface Part {
  n: number;
  repo?: string;
}
const TOOLS_THEN_HERE: Part[] = [{ n: 1, repo: 'tools' }, { n: 2 }];

/** ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, planned with `parts` (task n is slice n's), the plan committed. */
async function planned(r: Repos, parts: Part[]): Promise<void> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const where = (p: Part): string => (p.repo === undefined ? 'src/svc.ts' : p.n === 1 ? 'tools:src/Tools.cs' : 'tools:src/Other.cs');
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', ...parts.map((p) => task(p.n, where(p))), ...parts.map((p) => slice(p.n, p.repo))].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
}

const AFTER = '2026-11-25T11:00:00Z';
const HEAD = '2026-11-25T10:00:00Z';
const MERGED = { state: 'MERGED', mergedAt: AFTER };

/** One fake pull request: `repo` is the GH_REPO it lives in ('' for this repository), `list` the state `gh pr list` shows, `views` the answers of successive `gh pr view` calls (the last one stays). */
interface Fake {
  number: number;
  repo: string;
  head: string;
  base: string;
  list: string;
  draft?: boolean;
  views: Record<string, unknown>[];
}

/** A fake `gh` for pull requests of two repositories, told apart by the `GH_REPO` of each call; `edit --base` moves the base of the fake. */
function world(prs: Fake[]): { edits: { args: string[]; repo: string }[] } {
  const edits: { args: string[]; repo: string }[] = [];
  gh.answer = (args, opts) => {
    const repo = opts.env?.GH_REPO ?? '';
    if (args[0] === 'api' && args[1] === 'user') return 'me\n';
    if (args[0] === 'api') return '';
    if (args[0] === 'pr' && args[1] === 'list') {
      const head = args[args.indexOf('--head') + 1];
      return JSON.stringify(
        prs
          .filter((p) => p.repo === repo && p.head === head)
          .map((p) => ({ number: p.number, state: p.list, isDraft: p.draft === true, url: `https://github.com/${p.repo || 'acme/svc'}/pull/${p.number}`, baseRefName: p.base, headRefName: p.head })),
      );
    }
    const p = prs.find((x) => x.repo === repo && String(x.number) === args[2]);
    if (args[0] === 'pr' && args[1] === 'view') {
      if (p === undefined) return new Error(`no pull request ${args[2]} in ${repo}`);
      const v = p.views.length > 1 ? (p.views.shift() as Record<string, unknown>) : p.views[0];
      return JSON.stringify({ number: p.number, state: 'OPEN', isDraft: p.draft === true, mergedAt: null, commits: [{ committedDate: HEAD }], baseRefName: p.base, headRefName: p.head, ...v });
    }
    if (args[0] === 'pr' && args[1] === 'edit' && p !== undefined) {
      edits.push({ args, repo });
      p.base = args[args.indexOf('--base') + 1];
      return '';
    }
    return new Error('unexpected gh call: ' + args.join(' '));
  };
  return { edits };
}

/** The wait's sleeps cost no real time: each advances a fake clock. */
function fakeClock(): number[] {
  vi.useFakeTimers({ toFake: ['Date'] });
  const slept: number[] = [];
  vi.spyOn(Atomics, 'wait').mockImplementation((_a, _i, _v, ms) => {
    slept.push(Number(ms));
    vi.setSystemTime(Date.now() + Number(ms));
    return 'timed-out';
  });
  return slept;
}

const lastLine = (out: string): string => out.trimEnd().split('\n').at(-1) ?? '';
const TOOLS = 'acme/tools';

it('risk:complex-branching pr wait watches the tools pull request of slice 1 first, and ends released when it merges while slice 2 here is still a draft (D-08, D-13, Ruling R18)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  fakeClock();
  const { edits } = world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'OPEN', views: [{}, {}, MERGED] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', draft: true, views: [{}] },
  ]);
  const res = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('pr-wait: watching #41 (slice 1 of 2) https://github.com/acme/tools/pull/41, limit 118 minutes\n');
  expect(lastLine(res.out)).toBe('pr-wait: released slice 2: slice 1 (tools) merged #41');
  // the slices are in different repositories: no pull request is edited, and nothing is merged or commented
  expect(edits).toEqual([]);
  expect(gh.calls.some((c) => c.args.includes('edit') || c.args.includes('merge') || c.args.includes('comment') || c.args.includes('close'))).toBe(false);
}, 120_000);

it('risk:security every gh call for the tools pull request is aimed at acme/tools by GH_REPO and every call for this repository carries none (R17, T-08.9.3-28)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  fakeClock();
  world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'OPEN', views: [{}, MERGED] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', draft: true, views: [{}] },
  ]);
  const res = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(gh.calls.filter((c) => /\b41\b|slice\/ST-9\/1/.test(c.args.join(' '))).length).toBeGreaterThan(2);
  for (const { args, opts } of gh.calls) {
    const about = args.join(' ');
    expect(opts.shell).toBeUndefined();
    if (args[0] === 'api' && args[1] === 'user') continue;
    if (/41\b|slice\/ST-9\/1/.test(about)) expect(opts.env?.GH_REPO, about).toBe(TOOLS);
    else expect(opts.env?.GH_REPO, about).toBeUndefined();
  }
  expect(res.code, res.out + res.err).toBe(0);
  const mine = gh.calls.filter((c) => /57\b|t\/ST-9/.test(c.args.join(' ')));
  expect(mine.length).toBeGreaterThan(0);
}, 120_000);

it('risk:complex-branching [1 here, 2 tools, 3 here]: slice 1 merging moves the base of slice 3 here, never the tools pull request, and releases slice 2 (D-08, T-08.9.3-31)', async () => {
  const r = reposCopy();
  await planned(r, [{ n: 1 }, { n: 2, repo: 'tools' }, { n: 3 }]);
  fakeClock();
  const { edits } = world([
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', views: [{}, MERGED] },
    { number: 41, repo: TOOLS, head: 'slice/ST-9/2', base: 'main', list: 'OPEN', draft: true, views: [{}] },
    { number: 70, repo: '', head: 'slice/ST-9/3', base: CLAIM, list: 'OPEN', draft: true, views: [{}] },
  ]);
  const res = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(edits.map((e) => `${e.repo || 'svc'}: ${e.args.join(' ')}`)).toEqual(['svc: pr edit 70 --base main']);
  expect(lastLine(res.out)).toBe('pr-wait: released slice 2: slice 1 (this repository) merged #57');
}, 120_000);

it('risk:complex-branching [1 here, 2 tools, 3 tools]: tools slice 2 merging moves the base of tools slice 3 in acme/tools, and the wait ends merged when it does (D-08)', async () => {
  const r = reposCopy();
  await planned(r, [{ n: 1 }, { n: 2, repo: 'tools' }, { n: 3, repo: 'tools' }]);
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  fakeClock();
  const { edits } = world([
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'MERGED', views: [MERGED] },
    { number: 41, repo: TOOLS, head: 'slice/ST-9/2', base: 'main', list: 'OPEN', views: [{}, MERGED] },
    { number: 42, repo: TOOLS, head: 'slice/ST-9/3', base: 'slice/ST-9/2', list: 'OPEN', draft: true, views: [{}, {}, MERGED] },
  ]);
  const res = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(edits.map((e) => `${e.repo}: ${e.args.join(' ')}`)).toEqual([`${TOOLS}: pr edit 42 --base main`]);
  expect(res.out).toContain('pr-wait: slice 2 merged #41, base of #42 moved to main\n');
  expect(lastLine(res.out)).toBe('pr-wait: merged #42');
}, 120_000);

it('risk:complex-branching the held slice is not released while its pull request is ready, or while the earlier slice is in the same repository (D-08, Ruling R18)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  fakeClock();
  // slice 2 is ready for review (not a draft): the wait follows it to its merge instead of releasing it
  world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'MERGED', views: [MERGED] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', views: [{}, MERGED] },
  ]);
  const res = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).not.toContain('released');
  expect(lastLine(res.out)).toBe('pr-wait: merged #57');
}, 120_000);

it('risk:complex-branching slice 1 merged and slice 2 here with no pull request yet is released as well (D-13, Ruling R18)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  fakeClock();
  world([{ number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'MERGED', views: [MERGED] }]);
  const res = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(lastLine(res.out)).toBe('pr-wait: released slice 2: slice 1 (tools) merged #41');
}, 120_000);

it('risk:regression no pull request for the lowest slice is exit 2 naming its branch, and a remote that is not github.com is unavailable before any pull request is asked for (D-08)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  world([]);
  const none = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(none.code).toBe(2);
  expect(lastLine(none.out)).toBe('pr-wait: no pull request for slice/ST-9/1');

  gh.calls.length = 0;
  const config = readFileSync(join(r.svc, 'accord', 'config.yml'), 'utf8').replace('https://github.com/acme/tools.git', 'https://gitlab.example.org/acme/tools.git');
  writeFiles(r.svc, { 'accord/config.yml': config });
  commitAll(r.svc);
  const off = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(off.code).toBe(2);
  expect(lastLine(off.out)).toBe("pr-wait: unavailable: tools's remote is not a github.com repository");
  expect(gh.calls.every((c) => c.args[0] === 'api' && c.args[1] === 'user')).toBe(true);
}, 120_000);

const ZED = { author: { login: 'zed-collab' }, authorAssociation: 'COLLABORATOR', createdAt: AFTER };

it('risk:security W-1 feedback and a failed check on a pull request of another repository end the wait with counts only: no login and no check name of that repository is printed (T-08.9.3-29)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  fakeClock();
  world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'OPEN', views: [{ comments: [ZED], reviews: [{ ...ZED, submittedAt: AFTER, state: 'COMMENTED' }] }] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', draft: true, views: [{}] },
  ]);
  const feedback = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(feedback.code, feedback.out + feedback.err).toBe(0);
  expect(lastLine(feedback.out)).toBe('pr-wait: feedback #41: 1 comments, 1 reviews, 0 inline (repository tools, logins not printed)');
  expect(feedback.out).not.toContain('zed-collab');

  world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'OPEN', views: [{ statusCheckRollup: [{ name: 'secret-tools-check', conclusion: 'FAILURE' }, { name: 'other-tools-check', conclusion: 'TIMED_OUT' }] }] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', draft: true, views: [{}] },
  ]);
  const failed = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(failed.code, failed.out + failed.err).toBe(0);
  expect(lastLine(failed.out)).toBe('pr-wait: ci-failed #41: 2 checks (repository tools, names not printed)');
  expect(failed.out).not.toContain('tools-check');
}, 120_000);

it('risk:regression the same feedback and failed check on a slice of this repository keep the full line: logins and check names (W-1)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  fakeClock();
  world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'MERGED', views: [MERGED] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', views: [{ comments: [ZED] }] },
  ]);
  const feedback = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(feedback.code, feedback.out + feedback.err).toBe(0);
  expect(lastLine(feedback.out)).toBe('pr-wait: feedback #57: 1 comments, 0 reviews, 0 inline from zed-collab');

  world([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', base: 'main', list: 'MERGED', views: [MERGED] },
    { number: 57, repo: '', head: CLAIM, base: 'main', list: 'OPEN', views: [{ statusCheckRollup: [{ name: 'lint and gate', conclusion: 'FAILURE' }] }] },
  ]);
  const failed = await run(['pr', 'wait', 'ST-9'], r.svc);
  expect(lastLine(failed.out)).toBe('pr-wait: ci-failed #57: lint and gate');
}, 120_000);
