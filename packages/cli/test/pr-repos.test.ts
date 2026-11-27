// Phase 08.9.3 D-08, D-03: the pull request body of a slice of a plan that names another repository states the deploy order, and the pull request of a slice built in the other repository links the ticket on this
// repository's claim branch and reads no template of either repository (it needs nothing of accord there). `accord pr` never calls `gh` (Phase 8.1 D-03): its lines are what the skill hands to `gh pr create --repo`.
// Real git in two sibling clones (helpers/repos.ts); nothing here reaches a network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import { deployOrderBlock, REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

interface Opts {
  cwd?: string;
  shell?: unknown;
  env?: Record<string, string | undefined>;
}
/** What the fake `gh` answers (`accord pr` never calls it; `accord pr ready` does): a string is stdout, an Error is a failed call. Set per case. */
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

const CLAIM = 't/ST-9';
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;

/** One slice of the plan: its number and the repository it is built in (absent: this repository). */
interface Part {
  n: number;
  repo?: string;
}
const TOOLS_THEN_HERE: Part[] = [{ n: 1, repo: 'tools' }, { n: 2 }];

/** ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, planned with `parts` (task n is slice n's), the plan committed; the tools clone's path is stored. */
async function planned(r: Repos, parts: Part[], store = true): Promise<void> {
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
  if (store) expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
}

const bodyOf = (r: Repos): string => readFileSync(join(r.svc, '.git', 'accord-pr-ST-9.md'), 'utf8');
const MARK = 'SVC-TEMPLATE-MARK-3f9a';
const TEMPLATE = `## Description\n${MARK}\n\n## Acceptance criteria\n`;

it('risk:regression deployOrderBlock numbers the slices in order and names the repository of each, and is empty for a plan of one repository (D-08)', () => {
  expect(deployOrderBlock([{ n: 2 }, { n: 1, repo: 'tools' }])).toBe('Deploy order:\n1. tools (slice 1)\n2. this repository (slice 2)\n\n');
  expect(deployOrderBlock([{ n: 1 }, { n: 2, repo: 'tools' }, { n: 3 }], { tools: 'the tool server' })).toBe('Deploy order:\n1. this repository (slice 1)\n2. the tool server (slice 2)\n3. this repository (slice 3)\n\n');
  expect(deployOrderBlock([{ n: 1 }, { n: 2 }])).toBe('');
  expect(deployOrderBlock([])).toBe('');
});

it('risk:regression accord pr ST-9 --slice 2 opens with the slice block, then the deploy order, then the body it wrote before (D-08)', async () => {
  const r = reposCopy();
  writeFiles(r.svc, { '.github/pull_request_template.md': TEMPLATE });
  commitAll(r.svc);
  await planned(r, TOOLS_THEN_HERE);
  const res = await run(['pr', 'ST-9', '--slice', '2'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('title: ST-9: Export (slice 2 of 2)\n');
  expect(res.out).toContain('template: .github/pull_request_template.md\n');
  expect(res.out).not.toContain('repository:');
  const body = bodyOf(r);
  const order = 'Deploy order:\n1. tools (slice 1)\n2. this repository (slice 2)\n\n';
  expect(body.startsWith('Slice 2 of 2\n')).toBe(true);
  const at = body.indexOf(order);
  expect(at).toBeGreaterThan(body.indexOf('Size:'));
  // the filled template follows the order block, as it followed the slice block before
  expect(body.indexOf(MARK)).toBeGreaterThan(at + order.length);
  expect(body).toContain('## Description');
}, 120_000);

it('risk:regression accord pr ST-9 --slice 1 for a tools slice prints the repository, head and base for gh pr create, links the ticket and reads no template (D-03)', async () => {
  const r = reposCopy();
  writeFiles(r.svc, { '.github/pull_request_template.md': TEMPLATE });
  commitAll(r.svc);
  await planned(r, TOOLS_THEN_HERE);
  const res = await run(['pr', 'ST-9', '--slice', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const file = /^body-file: (.+)$/m.exec(res.out)?.[1] ?? '';
  expect(file).not.toBe('');
  expect(res.out.split('\n').filter((l) => l !== '')).toEqual([
    expect.stringMatching(/^title: ST-9: .* \(slice 1 of 2\)$/),
    `body-file: ${file}`,
    'template: none (another repository)',
    'repository: acme/tools',
    'head: slice/ST-9/1',
    'base: main',
  ]);
  const body = bodyOf(r);
  expect(body.startsWith('Slice 1 of 2\n')).toBe(true);
  expect(body).toContain('Deploy order:\n1. tools (slice 1)\n2. this repository (slice 2)\n');
  expect(body).toContain(`Ticket: https://github.com/acme/svc/blob/${CLAIM}/accord/tickets/ST-9.md\n`);
  expect(body).not.toContain(MARK);
  expect(body).not.toContain('## Description');
}, 120_000);

it('risk:regression the base of a later slice in tools is the previous slice of tools, and the first one there is its default branch (D-08)', async () => {
  const r = reposCopy();
  await planned(r, [{ n: 1, repo: 'tools' }, { n: 2 }, { n: 3, repo: 'tools' }]);
  const first = await run(['pr', 'ST-9', '--slice', '1'], r.svc);
  expect(first.out).toContain('\nbase: main\n');
  const third = await run(['pr', 'ST-9', '--slice', '3'], r.svc);
  expect(third.code, third.out + third.err).toBe(0);
  expect(third.out).toContain('\nhead: slice/ST-9/3\nbase: slice/ST-9/1\n');
  expect(bodyOf(r)).toContain('Deploy order:\n1. tools (slice 1)\n2. this repository (slice 2)\n3. tools (slice 3)\n');
}, 120_000);

it('risk:security a Ticket link is built only from a github.com origin; any other origin is plain text without its credentials (T-08.9.3-33)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  r.git(r.svc, 'config', 'remote.origin.url', 'https://deploy:S3CRET-t0ken@gitlab.example.org/acme/svc.git');
  const res = await run(['pr', 'ST-9', '--slice', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const body = bodyOf(r);
  expect(body).toContain(`Ticket: accord/tickets/ST-9.md on branch ${CLAIM} of gitlab.example.org/acme/svc\n`);
  expect(body).not.toContain('https://');
  expect(body + res.out).not.toContain('S3CRET');
}, 120_000);

it('risk:regression a slice in tools whose clone is not stored here is refused with the fix, and writes no body (D-03)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE, false);
  const res = await run(['pr', 'ST-9', '--slice', '1'], r.svc);
  expect(res.code).toBe(2);
  expect(res.err + res.out).toMatch(/default branch of tools/);
  expect(res.err + res.out).toMatch(/accord repos set tools/);
}, 120_000);

// ---- accord pr ready holds the deploy order (D-08, Ruling R19) ----

const TOOLS = 'acme/tools';
interface FakePr {
  number: number;
  repo: string; // the GH_REPO the pull request lives in; '' for this repository
  head: string;
  state: string;
  draft: boolean;
}
/** A fake `gh` for pull requests of two repositories, told apart by the `GH_REPO` of each call: `pr list` by head branch and `pr ready`, which clears the draft flag. Any other call is a failure, so a write verb shows. */
function remote(prs: FakePr[]): void {
  gh.answer = (args, opts) => {
    const repo = opts.env?.GH_REPO ?? '';
    if (args[0] === 'pr' && args[1] === 'list') {
      const head = args[args.indexOf('--head') + 1];
      return JSON.stringify(prs.filter((p) => p.repo === repo && p.head === head).map((p) => ({ number: p.number, state: p.state, isDraft: p.draft, baseRefName: 'main', headRefName: p.head, url: `https://github.com/x/y/pull/${p.number}` })));
    }
    if (args[0] === 'pr' && args[1] === 'ready') {
      const p = prs.find((x) => x.repo === repo && String(x.number) === args[2]);
      if (p === undefined) return new Error('no such pull request');
      p.draft = false;
      return '';
    }
    return new Error('unexpected gh call: ' + args.join(' '));
  };
}
const readyCalls = (): { args: string[]; opts: Opts }[] => gh.calls.filter((c) => c.args[0] === 'pr' && c.args[1] === 'ready');

it('risk:complex-branching accord pr ready ST-9 --slice 2 is held while the tools pull request is not merged, and calls gh pr ready for this repository once it is (D-08, Ruling R19)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  const prs: FakePr[] = [
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', state: 'OPEN', draft: false },
    { number: 57, repo: '', head: CLAIM, state: 'OPEN', draft: true },
  ];
  remote(prs);
  const held = await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  expect(held.code, held.out + held.err).toBe(1);
  expect(held.out).toBe('held: slice 2 waits for tools slice 1 (#41)\n');
  expect(readyCalls()).toEqual([]);
  expect(prs[1].draft).toBe(true);

  prs[0].state = 'MERGED';
  const freed = await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  expect(freed.code, freed.out + freed.err).toBe(0);
  expect(freed.out).toBe('ready: #57\n');
  expect(readyCalls()).toHaveLength(1);
  expect(readyCalls()[0].args).toEqual(['pr', 'ready', '57']);
  expect(readyCalls()[0].opts.env?.GH_REPO).toBeUndefined();
  expect(readyCalls()[0].opts.shell).toBeUndefined();
}, 120_000);

it('risk:complex-branching accord pr ready ST-9 --slice 1 marks the tools pull request ready with GH_REPO, and says already for one that is (D-08, Ruling R19)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  remote([{ number: 41, repo: TOOLS, head: 'slice/ST-9/1', state: 'OPEN', draft: true }]);
  const first = await run(['pr', 'ready', 'ST-9', '--slice', '1'], r.svc);
  expect(first.code, first.out + first.err).toBe(0);
  expect(first.out).toBe('ready: #41\n');
  expect(readyCalls()).toHaveLength(1);
  expect(readyCalls()[0].args).toEqual(['pr', 'ready', '41']);
  expect(readyCalls()[0].opts.env?.GH_REPO).toBe(TOOLS);
  const again = await run(['pr', 'ready', 'ST-9', '--slice', '1'], r.svc);
  expect(again.code, again.out + again.err).toBe(0);
  expect(again.out).toBe('ready: #41 (already)\n');
  expect(readyCalls()).toHaveLength(1);
}, 120_000);

it('risk:complex-branching [1 here, 2 tools]: slice 2 waits for this repository slice 1, and an earlier slice with no pull request holds as well (D-08)', async () => {
  const r = reposCopy();
  await planned(r, [{ n: 1 }, { n: 2, repo: 'tools' }]);
  const prs: FakePr[] = [
    { number: 57, repo: '', head: CLAIM, state: 'OPEN', draft: false },
    { number: 41, repo: TOOLS, head: 'slice/ST-9/2', state: 'OPEN', draft: true },
  ];
  remote(prs);
  const held = await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  expect(held.code, held.out + held.err).toBe(1);
  expect(held.out).toBe('held: slice 2 waits for this repository slice 1 (#57)\n');
  expect(readyCalls()).toEqual([]);
  prs.shift();
  const none = await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  expect(none.code).toBe(1);
  expect(none.out).toBe('held: slice 2 waits for this repository slice 1 (no pull request yet)\n');
}, 120_000);

it('risk:complex-branching a slice of the same repository as the one before it is not held by it: only earlier slices of another repository hold (D-08)', async () => {
  const r = reposCopy();
  await planned(r, [{ n: 1, repo: 'tools' }, { n: 2 }, { n: 3 }]);
  remote([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', state: 'MERGED', draft: false },
    { number: 57, repo: '', head: CLAIM, state: 'OPEN', draft: true },
    { number: 70, repo: '', head: 'slice/ST-9/3', state: 'OPEN', draft: true },
  ]);
  const res = await run(['pr', 'ready', 'ST-9', '--slice', '3'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toBe('ready: #70\n');
  expect(readyCalls().map((c) => c.args.join(' '))).toEqual(['pr ready 70']);
}, 120_000);

it('risk:regression pr ready names a slice the plan lacks, a slice with no pull request and a pull request that is merged or closed, as exit 2 with nothing marked (D-08)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  const prs: FakePr[] = [{ number: 41, repo: TOOLS, head: 'slice/ST-9/1', state: 'MERGED', draft: false }];
  remote(prs);
  const lacks = await run(['pr', 'ready', 'ST-9', '--slice', '9'], r.svc);
  expect(lacks.code).toBe(2);
  expect(lacks.err + lacks.out).toContain('--slice 9 is not one of the plan');
  const noPr = await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  expect(noPr.code).toBe(2);
  expect(noPr.err + noPr.out).toContain('ST-9 slice 2 has no pull request for t/ST-9');
  const merged = await run(['pr', 'ready', 'ST-9', '--slice', '1'], r.svc);
  expect(merged.code).toBe(2);
  expect(merged.err + merged.out).toContain('pull request #41 of slice/ST-9/1 is merged');
  prs[0].state = 'CLOSED';
  const closed = await run(['pr', 'ready', 'ST-9', '--slice', '1'], r.svc);
  expect(closed.code).toBe(2);
  expect(closed.err + closed.out).toContain('is closed');
  expect(readyCalls()).toEqual([]);
}, 120_000);

it('risk:security accord pr ready makes only read calls and the one ready write: never a merge, a close or a comment, and a gh that cannot answer is exit 2 (D-21, T-08.9.3-32)', async () => {
  const r = reposCopy();
  await planned(r, TOOLS_THEN_HERE);
  remote([
    { number: 41, repo: TOOLS, head: 'slice/ST-9/1', state: 'MERGED', draft: false },
    { number: 57, repo: '', head: CLAIM, state: 'OPEN', draft: true },
  ]);
  await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  for (const { args } of gh.calls) {
    expect(args[0]).toBe('pr');
    expect(['list', 'ready']).toContain(args[1]);
    expect(args.some((a) => ['merge', 'close', 'comment', 'edit', 'review'].includes(a))).toBe(false);
  }
  gh.answer = () => Object.assign(new Error('Command failed: gh pr list'), { stderr: 'To get started with GitHub CLI, please run:  gh auth login\nsecond line\n' });
  const off = await run(['pr', 'ready', 'ST-9', '--slice', '2'], r.svc);
  expect(off.code).toBe(2);
  expect(off.out).toBe('pr-ready: unavailable: To get started with GitHub CLI, please run:  gh auth login\n');
}, 120_000);
