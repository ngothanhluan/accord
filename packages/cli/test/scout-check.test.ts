// ST-LN-81: `accord scout check <file>` judges a scout report against the files git tracks.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CONFIG, LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';
import { blobBatches, gitTreeAt, hasLocalChanges, lastCommitOf, readBlobs } from '../src/load/fs.js';
import { cleanup, commitMsg, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const REPORT_HEAD = '## Files\n- `packages/core/src/load/config.ts`\n\n## Absent\n| Claim | Pattern | Folders | Allowed hits |\n|---|---|---|---|\n';
const row = (allowed: string) => REPORT_HEAD + '| no other caller of loadConfig | `loadConfig\\(` | `packages/` | ' + allowed + ' |\n';

it('ac-1 a logged absence claim that its own search contradicts fails the check', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'packages/core/src/load/config.ts': 'export function loadConfig(text: string) {\n  return text;\n}\n',
      'packages/cli/src/commands/init.ts': "import { loadConfig } from './x.js';\nexport const c = loadConfig('a');\n",
    });
    commitMsg(repo, 'fixture');
    writeFiles(repo, { 'packages/cli/src/scratch.ts': 'loadConfig(1);\n' });
    writeFileSync(join(repo, 'report.md'), row('`packages/core/src/load/config.ts`'));

    const failing = await run(['scout', 'check', 'report.md'], repo);
    expect(failing.code).toBe(1);
    expect(failing.out).toContain('no other caller of loadConfig');
    expect(failing.out).toContain('packages/cli/src/commands/init.ts:2');
    expect(failing.out).not.toContain('scratch.ts');
    expect(failing.out).not.toContain('\\');

    writeFileSync(join(repo, 'report.md'), row('`packages/core/src/load/config.ts, packages/cli/src/commands/init.ts`'));
    const passing = await run(['scout', 'check', 'report.md'], repo);
    expect(passing.code).toBe(0);
    expect(passing.out.endsWith('scout check passed\n')).toBe(true);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('ac-2 a citation that does not resolve fails the check', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'packages/core/src/gate/scope.ts': 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n',
    });
    commitMsg(repo, 'fixture');
    writeFiles(repo, { 'packages/core/src/missing.ts': '1\n2\n3\n4\n5\n' });
    writeFileSync(
      join(repo, 'report.md'),
      [
        '## Files',
        '- `packages/core/src/gate/scope.ts`',
        '',
        '## Facts',
        '- the rule sits at packages/core/src/gate/scope.ts:9999',
        '- the helper sits at packages/core/src/missing.ts:3',
        '- the first line is packages/core/src/gate/scope.ts:1',
        '',
      ].join('\n'),
    );

    const failing = await run(['scout', 'check', 'report.md'], repo);
    expect(failing.code).toBe(1);
    expect(failing.out).toContain('citation packages/core/src/gate/scope.ts:9999 does not resolve: packages/core/src/gate/scope.ts has 3 lines');
    expect(failing.out).toContain('citation packages/core/src/missing.ts:3 does not resolve: git does not track packages/core/src/missing.ts');
    expect(failing.out).toContain('scout check failed: 2 failures');
    expect(failing.out).not.toContain('scope.ts:1 does not resolve');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching a saved report is not contradicted by its own ticket files or the research records its ticket lists', async () => {
  const repo = makeEmptyRepo();
  try {
    const report = [
      '## Files',
      '- `src/load/config.ts`',
      '',
      '## Absent',
      '| Claim | Pattern | Folders | Allowed hits |',
      '|---|---|---|---|',
      '| no other caller of loadConfig | `loadConfig[(]` | . | `src/load/config.ts` |',
      '',
      '## Facts',
      '- loadConfig(5) is defined at src/load/config.ts:1',
      '',
    ].join('\n');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'src/load/config.ts': 'export function loadConfig() {}\n',
      'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ['research: ["accord/research/2026-01-01-r.md"]'], body: LANE_BODY + 'loadConfig(1)\n' }),
      'accord/tickets/T-1/plan.md': 'loadConfig(2)\n',
      'accord/research/2026-01-01-r.md': 'loadConfig(3)\n',
      'accord/research/other.md': 'loadConfig(4)\n',
      'accord/tickets/T-1/scout.md': report,
    });
    commitMsg(repo, 'fixture');

    const saved = await run(['scout', 'check', 'accord/tickets/T-1/scout.md'], repo);
    expect(saved.code).toBe(1);
    expect(saved.out).toContain('accord/research/other.md:1');
    expect(saved.out).toContain('scout check failed: 1 failure');
    expect(saved.out).not.toContain('accord/tickets/T-1.md:');
    expect(saved.out).not.toContain('accord/tickets/T-1/plan.md:');
    expect(saved.out).not.toContain('accord/tickets/T-1/scout.md:');
    expect(saved.out).not.toContain('2026-01-01-r.md:');

    writeFileSync(join(repo, 'report.md'), report);
    const outside = await run(['scout', 'check', 'report.md'], repo);
    expect(outside.code).toBe(1);
    expect(outside.out).toContain('accord/tickets/T-1.md:');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('ac-3 the check computes the lane lift conditions from the report file list', async () => {
  const repo = makeEmptyRepo();
  try {
    const line = 'export const v = 1;\n';
    const paths = [
      'packages/core/src/load/a.ts',
      'packages/core/src/load/b.ts',
      'packages/core/src/load/c.ts',
      'packages/cli/src/commands/x.ts',
      'packages/cli/src/commands/y.ts',
      'packages/cli/src/commands/deep/z.ts',
      'packages/cli/test/scout.test.ts',
      'packages/core/src/generated/skills.ts',
    ];
    writeFiles(repo, {
      'accord/config.yml': CONFIG + 'sensitive:\n  interface:\n    - packages/cli/src/commands/x.ts\ngenerated:\n  - packages/core/src/generated/\n',
      ...Object.fromEntries(paths.map((p) => [p, line])),
    });
    commitMsg(repo, 'fixture');
    writeFileSync(join(repo, 'report.md'), '## Files\n' + paths.map((p) => '- `' + p + '`\n').join(''));

    const out = await run(['scout', 'check', 'report.md'], repo);
    expect(out.code).toBe(0);
    expect(out.out).toContain(
      [
        'expected files: 6 (packages/cli/src/commands/deep/z.ts, packages/cli/src/commands/x.ts, packages/cli/src/commands/y.ts, packages/core/src/load/a.ts, packages/core/src/load/b.ts, packages/core/src/load/c.ts)',
        'code areas: 2 (packages/cli/src/commands, packages/core/src/load)',
        'sensitive: packages/cli/src/commands/x.ts is under packages/cli/src/commands/x.ts (interface), accord/config.yml:15',
        'lifts to lane M: more than 5 expected files; a listed sensitive area',
        'scout check passed',
        '',
      ].join('\n'),
    );
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching blob reads at a commit split into bounded batches and keep their order', () => {
  expect(blobBatches([10, 30, 5, 5], 16)).toEqual([[0], [1], [2, 3]]);
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'a.txt': 'a'.repeat(10), 'b.txt': 'b'.repeat(30), 'c.txt': 'c'.repeat(5), 'd.txt': 'd'.repeat(5) });
    const commit = commitMsg(repo, 'fixture');
    const blobs = gitTreeAt(repo, commit);
    expect(blobs.map((b) => [b.path, b.size])).toEqual([
      ['a.txt', 10],
      ['b.txt', 30],
      ['c.txt', 5],
      ['d.txt', 5],
    ]);
    expect(readBlobs(repo, blobs, 'test', 16)).toEqual(['a'.repeat(10), 'b'.repeat(30), 'c'.repeat(5), 'd'.repeat(5)]);
    expect(lastCommitOf(repo, 'a.txt')).toBe(commit);
    expect(hasLocalChanges(repo, 'a.txt')).toBe(false);
    writeFiles(repo, { 'a.txt': 'changed' });
    expect(hasLocalChanges(repo, 'a.txt')).toBe(true);
  } finally {
    cleanup(repo);
  }
}, 120_000);
