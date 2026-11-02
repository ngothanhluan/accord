// ST-LN-81: `accord scout check <file>` judges a scout report against the files git tracks.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
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
