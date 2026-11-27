// Phase 08.9.3 D-08, D-03: the pull request body of a slice of a plan that names another repository states the deploy order, and the pull request of a slice built in the other repository links the ticket on this
// repository's claim branch and reads no template of either repository (it needs nothing of accord there). `accord pr` never calls `gh` (Phase 8.1 D-03): its lines are what the skill hands to `gh pr create --repo`.
// Real git in two sibling clones (helpers/repos.ts); nothing here reaches a network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { deployOrderBlock, REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

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
