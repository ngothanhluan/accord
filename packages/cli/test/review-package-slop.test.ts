// Phase 8.1 G4a (D-14, D-15, D-20): `accord review-package` prints `## Slop`, the hits of the ticket's cumulative diff, one `slop:<kind> <path>:<line>` each.
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

function identity(repo: string): void {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
}

/** The `## Slop` section of a package, heading included. */
const slopSection = (out: string): string => {
  const at = out.indexOf('## Slop');
  // Phase 8.5 D-03 (08.5-06): the ruleset's heading, `# accord rules`, follows `## Slop` with one `#`, so the section ends at the next heading of either depth.
  const rest = out.slice(at + 1).search(/\n#{1,2} /);
  const next = rest < 0 ? -1 : rest + at + 1;
  return at < 0 ? '' : out.slice(at, next < 0 ? undefined : next).trimEnd();
};
const slopLines = (out: string): string[] => slopSection(out).split('\n').filter((l) => l.startsWith('- slop:'));

/** A lane M ticket T-1 on its own branch, the plan's baseline the commit before the plan; `code` is committed on top of the plan. */
function ticketRepo(base: Record<string, string>, code: Record<string, string>): string {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), ...base });
    const baseSha = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseSha) });
    commitMsg(repo, 'plan');
    writeFiles(repo, code);
    commitMsg(repo, 'code');
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

it('risk:complex-branching review-package lists a slop hit with its file and line (8.1-ac-12)', async () => {
  const repo = ticketRepo({ 'src/a.ts': 'export const a = 1;\n' }, { 'src/a.ts': 'export const a = 1;\nexport function f() {\n  try { x(); } catch {}\n}\n' });
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    const section = slopSection(out.out);
    expect(section).toMatch(/^## Slop\n\n- slop:empty-catch src\/a\.ts:3 — \S/);
    expect(out.out.indexOf('## Slop')).toBeGreaterThan(out.out.indexOf('## Security triggers'));
    expect(out.out.indexOf('## Slop')).toBeLessThan(out.out.indexOf('## Stat'));
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching review-package prints none when no pattern matched (8.1-ac-12)', async () => {
  const repo = ticketRepo({ 'src/a.ts': 'export const a = 1;\n' }, { 'src/a.ts': 'export const a = 2;\n' });
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(slopSection(out.out)).toBe('## Slop\n\n(none: no pattern matched)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

const PACKAGE_BASE = '{\n  "name": "x",\n  "dependencies": {\n    "kept": "^1.0.0"\n  }\n}\n';
const PACKAGE_HEAD = '{\n  "name": "x",\n  "dependencies": {\n    "kept": "^1.0.0",\n    "left-pad": "^1.3.0"\n  }\n}\n';

it('risk:complex-branching review-package lists one slop hit per kind in ts cs py and css files and a new package.json dependency (8.1-ac-12)', async () => {
  const repo = ticketRepo(
    { 'src/a.ts': 'export const a = 1;\n', 'src/A.cs': 'class A {\n', 'app/a.py': 'def f():\n', 'web/a.css': '.a {\n', 'package.json': PACKAGE_BASE },
    {
      'src/a.ts': 'export const a = 1;\nexport function f() {\n  try { g(); } catch {}\n}\n',
      'src/A.cs': 'class A {\n  void F() {\n    try { G(); } catch { }\n  }\n}\n',
      'app/a.py': 'def f():\n    try:\n        g()\n    except: pass\n',
      'web/a.css': '.a {\n  margin: 0;\n  color: red !important;\n}\n',
      'package.json': PACKAGE_HEAD,
    },
  );
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    const lines = slopLines(out.out);
    expect(lines.map((l) => l.split(' — ')[0])).toEqual([
      '- slop:empty-catch-py app/a.py:4',
      '- slop:new-dependency package.json:5',
      '- slop:empty-catch-cs src/A.cs:3',
      '- slop:empty-catch src/a.ts:3',
      '- slop:important-css web/a.css:3',
    ]);
    expect(lines.find((l) => l.includes('new-dependency'))).toContain('left-pad');
  } finally {
    cleanup(repo);
  }
}, 120_000);

const TEAM_FILE = '# Slop patterns\n\n## Patterns\n\n- panic-go: line /\\bpanic\\(/ for .go — panic in Go\n\n## Removed\n';

it('risk:complex-branching a team slop pattern scoped for .go is matched on a Go file only (8.1-ac-12)', async () => {
  const repo = ticketRepo(
    { 'accord/product/slop.md': TEAM_FILE, 'cmd/x.go': 'package main\n', 'src/b.ts': 'export const b = 1;\n' },
    { 'cmd/x.go': 'package main\nfunc main() { panic("x") }\n', 'src/b.ts': 'export const b = 1;\npanic("x");\n' },
  );
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(slopLines(out.out).map((l) => l.split(' — ')[0])).toEqual(['- slop:panic-go cmd/x.go:2']);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching a Removed line switches new-dependency off and a line of the team file that does not read is named (D-15)', async () => {
  const team = '# Slop patterns\n\n## Patterns\n\n- slow: line /(a+)+$/ — slow\n\n## Removed\n\n- Removed: new-dependency — the lockfile review covers it\n';
  const repo = ticketRepo({ 'accord/product/slop.md': team, 'package.json': PACKAGE_BASE }, { 'package.json': PACKAGE_HEAD });
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(slopSection(out.out)).toBe('## Slop\n\n(none: no pattern matched)\n(accord/product/slop.md: 1 line not read; run accord lint)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

/** `n` lines of plain code, each line unlike the next. */
const lines = (n: number, tag = 'n'): string => Array.from({ length: n }, (_, i) => `export const ${tag}${i} = ${i};`).join('\n') + '\n';

const GROWTH_BASE = {
  'src/big.ts': lines(495),
  'src/a.ts': 'export const a = 1;\n',
  'package-lock.json': lines(600, 'lock'),
};
const GROWTH_HEAD = (): Record<string, string> => ({
  'src/big.ts': lines(520),
  'src/lonely.ts': 'export const only = 1;\n',
  'src/used.ts': 'export const used = 1;\n',
  'src/a.ts': "import { used } from './used.js';\nexport const a = used;\n",
  'package-lock.json': lines(700, 'lock'),
  'web/yarn.lock': lines(150, 'y'),
  // a name with glob characters (a name led by a colon, such as `:(glob)x.ts`, is no file name on Windows), searched literally: src/a.ts names it, so it is no orphan
  'src/[ab].ts': 'export const odd = 1;\n',
});

it('risk:regression review-package names a grown file and an orphan file (D-14)', async () => {
  const head = GROWTH_HEAD();
  head['src/a.ts'] += '// see src/[ab].ts\n';
  const repo = ticketRepo(GROWTH_BASE, head);
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    expect(slopLines(out.out).map((l) => l.split(' — ')[0])).toEqual(['- slop:file-growth src/big.ts:520', '- slop:orphan-file src/lonely.ts:1']);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching slop.max_file_lines moves the bound and a Removed line switches file-growth and orphan-file off (D-14)', async () => {
  const withBound = (config: string): Record<string, string> => ({ 'accord/config.yml': config });
  const repo = ticketRepo({ ...withBound(CONFIG + 'slop:\n  max_file_lines: "200"\n'), 'src/mid.ts': lines(190) }, { 'src/mid.ts': lines(210), 'src/lonely.ts': 'export const only = 1;\n' });
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(slopLines(out.out).map((l) => l.split(' — ')[0])).toEqual(['- slop:orphan-file src/lonely.ts:1', '- slop:file-growth src/mid.ts:210']);
    // the same ticket with both kinds removed by the team file
    writeFiles(repo, { 'accord/product/slop.md': '# Slop patterns\n\n## Patterns\n\n## Removed\n\n- Removed: file-growth — the reviewer reads the stat\n- Removed: orphan-file — we keep scripts nobody imports\n' });
    commitMsg(repo, 'team slop file');
    const none = await run(['review-package', 'T-1'], repo);
    expect(slopSection(none.out)).toBe('## Slop\n\n(none: no pattern matched)');
  } finally {
    cleanup(repo);
  }
}, 120_000);
