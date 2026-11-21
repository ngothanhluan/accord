// ST-LN-81: `accord scout check <file>` judges a scout report against the files git tracks.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseScoutReport, renderSkill } from '@accord-dev/accord-core';
import type { SkillKey } from '@accord-dev/accord-core';
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

    const named = await run(['scout', 'check', 'report.md', '--ticket', 'T-1'], repo);
    expect(named.out).toContain('accord/research/other.md:1');
    expect(named.out).not.toContain('accord/tickets/T-1.md:');
    expect(named.out).not.toContain('accord/tickets/T-1/plan.md:');
    expect(named.out).not.toContain('accord/tickets/T-1/scout.md:');
    expect(named.out).not.toContain('2026-01-01-r.md:');
    expect(named.out).toContain('scout check failed: 1 failure');

    const unknown = await run(['scout', 'check', 'report.md', '--ticket', 'NOPE-9'], repo);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toContain('NOPE-9');

    // the option wins over the ticket a saved report's own path names
    const other = await run(['scout', 'check', 'accord/tickets/T-1/scout.md', '--ticket', 'NOPE-9'], repo);
    expect(other.code).toBe(2);
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

it('risk:parsing accord scout check passes a Files list that writes a path with a trailing colon (8-ac-8)', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'packages/x/a.ts': 'export const a = 1;\n',
      'packages/x/b.ts': 'export const b = 2;\n',
    });
    commitMsg(repo, 'fixture');
    writeFileSync(join(repo, 'report.md'), '## Files\n- packages/x/a.ts: defines x\n- `packages/x/b.ts`: wires x\n');

    const out = await run(['scout', 'check', 'report.md'], repo);
    expect(out.out).not.toContain('which git does not track');
    expect(out.out).toContain('expected files: 2 (packages/x/a.ts, packages/x/b.ts)');
    expect(out.out.endsWith('scout check passed\n')).toBe(true);
    expect(out.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:parsing accord scout check reads a citation written with backslashes (8-ac-8)', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'packages/x/a.ts': 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n',
    });
    commitMsg(repo, 'fixture');
    writeFileSync(join(repo, 'report.md'), '## Files\n- packages\\x\\a.ts\n\n## Facts\n- the rule sits at packages\\x\\a.ts:3\n- also `packages\\x\\a.ts:2`\n');
    const passing = await run(['scout', 'check', 'report.md'], repo);
    expect(passing.out).not.toContain('does not resolve');
    expect(passing.out.endsWith('scout check passed\n')).toBe(true);
    expect(passing.code).toBe(0);

    // read, not ignored: a line past the end still fails, and the printed path holds no backslash
    writeFileSync(join(repo, 'report.md'), '## Files\n- packages/x/a.ts\n\n## Facts\n- the rule sits at packages\\x\\a.ts:99\n');
    const failing = await run(['scout', 'check', 'report.md'], repo);
    expect(failing.code).toBe(1);
    expect(failing.out).toContain('citation packages/x/a.ts:99 does not resolve: packages/x/a.ts has 3 lines');
    expect(failing.out).not.toContain('\\');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching a shortened path with one tracked match is expanded and one with none or several still fails (8-ac-8)', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'packages/x/a.ts': 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n',
      'packages/y/a.ts': 'export const a = 1;\n',
    });
    commitMsg(repo, 'fixture');

    writeFileSync(join(repo, 'report.md'), '## Files\n- x/a.ts: the writer\n\n## Facts\n- the rule sits at x/a.ts:3\n');
    const one = await run(['scout', 'check', 'report.md'], repo);
    expect(one.out).toContain('expanded x/a.ts to packages/x/a.ts\n');
    expect(one.out.match(/expanded /g)?.length).toBe(1);
    expect(one.out).toContain('expected files: 1 (packages/x/a.ts)');
    expect(one.out.endsWith('scout check passed\n')).toBe(true);
    expect(one.code).toBe(0);

    // a citation past the end of the expanded file still fails, naming the full path
    writeFileSync(join(repo, 'report.md'), '## Files\n- packages/x/a.ts\n\n## Facts\n- the rule sits at x/a.ts:99\n');
    const past = await run(['scout', 'check', 'report.md'], repo);
    expect(past.code).toBe(1);
    expect(past.out).toContain('citation x/a.ts:99 does not resolve: packages/x/a.ts has 3 lines');

    // several matches: no guess
    writeFileSync(join(repo, 'report.md'), '## Files\n- a.ts\n');
    const several = await run(['scout', 'check', 'report.md'], repo);
    expect(several.code).toBe(1);
    expect(several.out).toContain('fail: ## Files lists a.ts, which git does not track');
    expect(several.out).not.toContain('expanded');

    // no match
    writeFileSync(join(repo, 'report.md'), '## Files\n- q/none.ts\n\n## Facts\n- see q/none.ts:2\n');
    const none = await run(['scout', 'check', 'report.md'], repo);
    expect(none.code).toBe(1);
    expect(none.out).toContain('fail: ## Files lists q/none.ts, which git does not track');
    expect(none.out).toContain('citation q/none.ts:2 does not resolve: git does not track q/none.ts');
    expect(none.out).not.toContain('expanded');

    // New files is never expanded
    writeFileSync(join(repo, 'report.md'), '## Files\n- packages/x/a.ts\n\n## New files\n- x/a.ts\n');
    const fresh = await run(['scout', 'check', 'report.md'], repo);
    expect(fresh.out).not.toContain('expanded');
    expect(fresh.out).toContain('expected files: 2 (packages/x/a.ts, x/a.ts)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching absence claims do not search .claude/ or .agents/ (8-ac-8)', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'src/a.ts': 'export const a = 1;\n',
      '.claude/skills/x/SKILL.md': 'call widgetThing here\n',
      '.agents/skills/x/SKILL.md': 'call widgetThing here\n',
    });
    commitMsg(repo, 'fixture');
    const head = '## Files\n- src/a.ts\n\n## Absent\n| Claim | Pattern | Folders | Allowed hits |\n|---|---|---|---|\n';

    writeFileSync(join(repo, 'report.md'), head + '| no widgetThing anywhere | `widgetThing` | . | |\n');
    const skipped = await run(['scout', 'check', 'report.md'], repo);
    expect(skipped.out).not.toContain('matches its pattern');
    expect(skipped.out.endsWith('scout check passed\n')).toBe(true);
    expect(skipped.code).toBe(0);

    writeFileSync(join(repo, 'report.md'), head + '| no widgetThing in the skills | `widgetThing` | `.claude/` | |\n');
    const only = await run(['scout', 'check', 'report.md'], repo);
    expect(only.code).toBe(1);
    expect(only.out).toContain('its folders cover no tracked file');

    // product code is still searched
    writeFiles(repo, { 'src/b.ts': 'widgetThing();\n' });
    commitMsg(repo, 'second');
    writeFileSync(join(repo, 'report.md'), head + '| no widgetThing anywhere | `widgetThing` | . | |\n');
    const found = await run(['scout', 'check', 'report.md'], repo);
    expect(found.code).toBe(1);
    expect(found.out).toContain('src/b.ts:1 matches its pattern outside its allowed hits');
    expect(found.out).not.toContain('.claude/');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.4 UAT gap 1: the reply form `/accord-onboard`'s scan.md tells a settings scout to write must pass the real command, and the command stays strict for every other scout.
it('risk:parsing the example reply scan.md shows a settings scout passes accord scout check on a repository (D-07)', async () => {
  const repo = makeEmptyRepo();
  try {
    const example = /```markdown\n([\s\S]*?)\n```/.exec(renderSkill('onboard/scan.md' as SkillKey))?.[1];
    expect(example, 'scan.md shows no example reply in a markdown fence').toBeDefined();
    const cited = parseScoutReport(example ?? '').citations;
    expect(cited.length).toBeGreaterThan(0);
    const longest = new Map<string, number>();
    for (const c of cited) longest.set(c.path, Math.max(longest.get(c.path) ?? 0, ...c.numbers));
    const files: Record<string, string> = { 'accord/config.yml': CONFIG };
    for (const [path, n] of longest) files[path] = 'line\n'.repeat(n);
    writeFiles(repo, files);
    commitMsg(repo, 'fixture');
    writeFileSync(join(repo, 'report.md'), example ?? '');

    const passing = await run(['scout', 'check', 'report.md'], repo);
    expect(passing.out).not.toContain('fail:');
    expect(passing.out.endsWith('scout check passed\n')).toBe(true);
    expect(passing.code).toBe(0);

    // the same reply with an Absent row that is no regular expression still fails
    writeFileSync(join(repo, 'report.md'), (example ?? '') + '\n\n## Absent\n| Claim | Pattern | Folders | Allowed hits |\n|---|---|---|---|\n| no caller | `run(` | . | |\n');
    const failing = await run(['scout', 'check', 'report.md'], repo);
    expect(failing.code).toBe(1);
    expect(failing.out).toContain('its pattern is not a valid JavaScript regular expression');
  } finally {
    cleanup(repo);
  }
}, 120_000);
