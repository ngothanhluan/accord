// ST-LN-36 (05-04): `accord review-package` prints `## Security triggers`, in lane M and lane S, from the default patterns.
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { fixtureTicket, PACKAGE_FIXTURES, packageFixture } from './helpers/review-package-fixtures.js';
import { loadSnapshot } from '@accord-dev/accord-core';
import { defaultRefOf, loadFromFs } from '../src/load/fs.js';
import { packageDiff, roundOneBase } from '../src/load/package-diff.js';
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

// The text origin/main printed for each fixture before the section existed (recorded once from its build, plan 05-04), shas replaced by <sha>.
const BEFORE = fileURLToPath(new URL('./fixtures/review-package-before/', import.meta.url));
const shas = (text: string): string => text.replace(/\b[0-9a-f]{7,40}\b/g, '<sha>');
const withoutSecurity = (text: string): string => text.replace(/## Security triggers\n\n[^\n]*(?:\n[^\n#][^\n]*)*\n\n(?=## )/, '');

it.each(PACKAGE_FIXTURES)(
  'risk:regression review-package is byte-identical apart from the security section and runs no new git command, %s (ST-LN-36 36-ac-1)',
  async (kind) => {
    const repo = packageFixture(kind);
    try {
      const first = await run(['review-package', fixtureTicket(kind)], repo);
      expect(first.err).toBe('');
      expect(first.code).toBe(0);
      expect(first.out).toContain('## Security triggers');
      expect(shas(withoutSecurity(first.out))).toBe(readFileSync(BEFORE + kind + '.txt', 'utf8'));
      // two runs on the same commit print the same bytes
      expect((await run(['review-package', fixtureTicket(kind)], repo)).out).toBe(first.out);
    } finally {
      cleanup(repo);
    }
  },
  120_000,
);

it.each(PACKAGE_FIXTURES)(
  'risk:regression packageDiff reads the package of HEAD as review-package prints it, %s (ST-LN-36 36-ac-1)',
  async (kind) => {
    const repo = packageFixture(kind);
    try {
      const id = fixtureTicket(kind);
      const printed = (await run(['review-package', id], repo)).out;
      const base = roundOneBase(repo, loadSnapshot(loadFromFs(repo)), id);
      expect(base).toBeDefined();
      const pkg = packageDiff(repo, { base: base as string, head: 'HEAD', def: defaultRefOf(repo), allowPlainLog: false, parts: true });
      expect(pkg.excluded).toBe(kind === 'excluded');
      expect(printed).toContain('## Diff\n\n' + pkg.diff);
      expect(printed).toContain('## Stat\n\n' + pkg.stat);
      expect(printed).toContain('## Commits\n\n' + pkg.commits);
      for (const path of pkg.changed) expect(pkg.diff).toContain(path);
    } finally {
      cleanup(repo);
    }
  },
  120_000,
);

it('risk:regression packageDiff of an earlier head holds only the changes up to it and refuses a head that reads as an option (ST-LN-36 36-ac-1)', () => {
  const repo = packageFixture('lane-m');
  try {
    const base = roundOneBase(repo, loadSnapshot(loadFromFs(repo)), 'T-1') as string;
    const at = (head: string) => packageDiff(repo, { base, head, def: defaultRefOf(repo), allowPlainLog: false });
    expect(at('HEAD').changed).toEqual(['.github/workflows/ci.yml', 'accord/tickets/T-1/plan.md', 'docs/notes.md', 'src/a.ts', 'src/run.ts']);
    const earlier = at('HEAD~1');
    expect(earlier.changed).toEqual(['accord/tickets/T-1/plan.md', 'src/a.ts']);
    expect(earlier.diff).not.toContain('ci.yml');
    expect(() => at('--output=x')).toThrow('not a git ref');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// 05-05: the repository's own accord/product/security.md decides the triggers.
const OWN_FILE = [
  '# Security review',
  '',
  '## Patterns',
  '',
  '- infra: path infra/ — infrastructure',
  '',
  '## Checklist',
  '',
  '## Removed',
  '',
  '- Removed: secret-name — our design tokens are not secrets',
  '',
].join('\n');

it('ac-1 review-package matches with the repository\'s security file (ST-LN-36 36-ac-1)', async () => {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      'accord/product/security.md': OWN_FILE,
      'src/a.ts': 'export const a = 1;\n',
    });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'infra/main.tf': 'resource "x" "y" {}\n', 'src/a.ts': 'export const a = 1;\nexport const token = "x";\n' });
    commitMsg(repo, 'infra and a token');
    const out = await run(['review-package', 'S-1'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    expect(section(out.out)).toBe('## Security triggers\n\ninfra/main.tf: infra (infrastructure)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:parsing review-package says when lines of the security file were not read (ST-LN-36 36-ac-1)', async () => {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      'accord/product/security.md': OWN_FILE.replace('## Checklist', '- this is no pattern\n- glob: path src/*.ts — a glob\n\n## Checklist'),
      'src/run.ts': RUN_BASE,
    });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'src/run.ts': RUN_NEW });
    commitMsg(repo, 'spawn');
    const out = await run(['review-package', 'S-1'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    expect(section(out.out)).toBe(
      '## Security triggers\n\nsrc/run.ts:3: spawn (process spawn)\n(accord/product/security.md: 2 lines not read; run accord lint)',
    );
  } finally {
    cleanup(repo);
  }
}, 120_000);

// ---- the security package (05-07 task 2) ----

const OTHER_BASE = 'export const o = 1;\n';

/** A lane M ticket on its own branch whose plan baseline is the base commit, with `change` as its one code commit. */
function laneM(change: Record<string, string>): { repo: string; base: string } {
  const repo = makeEmptyRepo();
  identity(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/run.ts': RUN_BASE, 'src/other.ts': OTHER_BASE, 'docs/notes.md': 'notes\n' });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), ...change });
  commitMsg(repo, 'code');
  return { repo, base };
}

it('ac-3 review-package --security prints the checklist, the triggers and the matched hunks (ST-LN-36 36-ac-3)', async () => {
  const hit = laneM({ 'src/run.ts': RUN_NEW, 'src/other.ts': 'export const o = 2;\n' });
  try {
    const before = gitRun(hit.repo, 'status', '--porcelain');
    const first = await run(['review-package', 'T-1', '--security'], hit.repo);
    expect(first.err).toBe('');
    expect(first.code).toBe(0);
    expect(first.out).toMatch(/^# Security package: T-1 \(/);
    expect(first.out).toContain('\nHead: ');
    const checklist = first.out.slice(first.out.indexOf('## Checklist'), first.out.indexOf('## Security triggers'));
    for (const id of ['injection', 'path-traversal', 'secrets', 'untrusted-input', 'ci-permissions', 'new-dependencies', 'hook-commands', 'authorisation']) {
      expect(checklist).toContain(`- ${id}: `);
    }
    expect(section(first.out)).toBe('## Security triggers\n\nsrc/run.ts:3: spawn (process spawn)');
    const hunks = first.out.slice(first.out.indexOf('## Matched hunks'));
    expect(hunks).toContain('diff --git a/src/run.ts b/src/run.ts');
    expect(hunks).toContain("+spawnSync('git', ['status']);");
    expect(hunks).not.toContain('src/other.ts');
    for (const heading of ['## Commits', '## Stat', '## Diff', '## Interface signs']) expect(first.out).not.toContain(heading);
    // two runs print the same bytes, and the command writes nothing
    expect((await run(['review-package', 'T-1', '--security'], hit.repo)).out).toBe(first.out);
    expect(gitRun(hit.repo, 'status', '--porcelain')).toBe(before);
  } finally {
    cleanup(hit.repo);
  }

  const none = laneM({ 'src/other.ts': 'export const o = 2;\n' });
  try {
    const out = await run(['review-package', 'T-1', '--security'], none.repo);
    expect(out.code).toBe(0);
    expect(section(out.out)).toBe('## Security triggers\n\n(none: no pattern matched)');
    expect(out.out.slice(out.out.indexOf('## Matched hunks'))).toBe('## Matched hunks\n\n(none: no pattern matched)\n');
  } finally {
    cleanup(none.repo);
  }

  // a new `.option(` is a public CLI surface: the README names it
  const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8');
  expect(readme).toContain('accord review-package');
  expect(readme).toContain('--security');
}, 120_000);

it('ac-3 review-package --security --round prints the package of a recorded round (ST-LN-36 36-ac-3)', async () => {
  const m = laneM({ 'src/run.ts': RUN_NEW });
  try {
    const c1 = gitRun(m.repo, 'rev-parse', 'HEAD').trim();
    writeFiles(m.repo, { 'docs/notes.md': 'notes\nmore\n' });
    const c2 = commitMsg(m.repo, 'fix');
    const rounds = `Round record: 2\n\n## Round 1 head ${c1}\n\nNo findings\nSecurity: lens security ran\n\n## Round 2 head ${c2}\n\nNo findings\nSecurity: no pattern matched\n\n## Round 3 head ${c2} (final review)\n\nNo findings\n`;
    writeFiles(m.repo, { 'accord/tickets/T-1/review.md': rounds });
    commitMsg(m.repo, 'rounds');
    const one = await run(['review-package', 'T-1', '--security', '--round', '1'], m.repo);
    expect(one.err).toBe('');
    expect(one.code).toBe(0);
    expect(one.out).toMatch(/^# Security package: T-1 \(/);
    expect(one.out).toContain("+spawnSync('git', ['status']);");
    expect(section(one.out)).toBe('## Security triggers\n\nsrc/run.ts:3: spawn (process spawn)');
    const two = await run(['review-package', 'T-1', '--security', '--round', '2'], m.repo);
    expect(two.code).toBe(0);
    expect(two.out).not.toContain('spawnSync');
    expect(two.out.slice(two.out.indexOf('## Matched hunks'))).toBe('## Matched hunks\n\n(none: no pattern matched)\n');
    // a usage error: --round alone, a round that is not recorded, not a number, and a final review round (D-10)
    for (const args of [['--round', '1'], ['--security', '--round', '4'], ['--security', '--round', '0'], ['--security', '--round', 'x'], ['--security', '--round', '3']]) {
      const bad = await run(['review-package', 'T-1', ...args], m.repo);
      expect(bad.code, args.join(' ')).toBe(2);
      expect(bad.out, args.join(' ')).toBe('');
      expect(bad.err.length, args.join(' ')).toBeGreaterThan(10);
    }
  } finally {
    cleanup(m.repo);
  }
}, 120_000);
