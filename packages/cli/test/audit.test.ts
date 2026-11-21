// Phase 8.1 G3a (D-08, D-09, D-01): `accord audit` prints facts and gaps from files only, spends no model call and exits 0 whatever it finds.
import { afterEach, expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

/** A committed repository holding `files` beside a config.yml (`config`, default the lane fixture's) and an empty scaffolded conventions file. */
function committed(files: Record<string, string>, config = CONFIG): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': config, 'accord/product/conventions.md': '# Conventions\n\n<!-- One rule per line. -->\n', ...files });
  commitAll(repo);
  return repo;
}

const audit = async (repo: string): Promise<{ lines: string[]; out: string; code: number }> => {
  const r = await run(['audit'], repo);
  return { lines: r.out.split('\n').filter((l) => l !== ''), out: r.out + r.err, code: r.code };
};
const has = (lines: string[], prefix: string): boolean => lines.some((l) => l.startsWith(prefix));
// These repositories hold no rendered skill files and no workflow, so group 2 (accord's own setup, packages/cli/test/audit-health.test.ts) lists gaps of its own; this file judges group 1.
const GROUP_1 = ['conventions-empty', 'conventions-thin', 'no-linter', 'no-formatter', 'typecheck-loose', 'no-pr-template', 'commit-rule-unset', 'subject-breaks-rule'];
const gapIds = (lines: string[]): string[] => lines.filter((l) => l.startsWith('gap: ')).map((l) => l.split(': ')[1]).filter((id) => GROUP_1.includes(id));

it('risk:complex-branching accord audit lists an empty conventions file as a gap and exits 0 (8.1-ac-8)', async () => {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  const init = await run(['init'], repo);
  expect(init.code, init.out + init.err).toBe(0);

  const r = await run(['audit'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  const lines = r.out.split('\n').filter((l) => l !== '');
  expect(lines.some((l) => l.startsWith('gap: conventions-empty:') && l.includes('/accord-audit')), r.out).toBe(true);
  expect(lines.some((l) => l.startsWith('fact: conventions:')), r.out).toBe(true);
  expect(lines.at(-1)).toMatch(/^gaps: \d+$/);
});

it('risk:complex-branching accord audit lists empty conventions no linter and no PR template with the facts it found (8.1-ac-8)', async () => {
  const repo = committed({ 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': 'export const b = 2;\n', 'package.json': '{ "devDependencies": { "vitest": "^5.0.0" } }\n' });
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  expect(gapIds(r.lines)).toEqual(['conventions-empty', 'no-linter', 'no-formatter', 'no-pr-template', 'commit-rule-unset']);
  expect(r.lines).toContain('fact: languages: ts 2');
  expect(r.lines).toContain('fact: layout: src 2');
  expect(r.lines).toContain('fact: tests: vitest');
  expect(r.lines).toContain('fact: pr-template: none');
  expect(r.lines).toContain('fact: linter: none');
  expect(r.lines).toContain('fact: commit-rule: not set');
  expect(r.lines.at(-1)).toMatch(/^gaps: \d+$/);
  expect(r.out).not.toContain('\\');
});

it('risk:parsing accord audit reads an eslint config rules and a strict tsconfig (D-08)', async () => {
  const strict = committed({
    'eslint.config.js': "export default [{ rules: { 'no-console': 'error', 'eqeqeq': ['warn'], 'no-var': 0, 'prefer-const': 2 } }];\n",
    'tsconfig.json': '{ "compilerOptions": { "strict": true } }\n',
    '.github/pull_request_template.md': '## Summary\n',
  });
  const a = await audit(strict);
  expect(a.lines).toContain('fact: linter: eslint (eslint.config.js)');
  const rules = a.lines.find((l) => l.startsWith('fact: linter-rules:')) ?? '';
  expect(rules).toContain('no-console');
  expect(rules).toContain('eqeqeq');
  expect(rules).toContain('prefer-const');
  expect(rules).not.toContain('no-var');
  expect(a.lines.find((l) => l.startsWith('fact: typecheck:')), a.out).toContain('strict');
  expect(gapIds(a.lines)).not.toContain('no-linter');
  expect(gapIds(a.lines)).not.toContain('typecheck-loose');
  expect(a.lines).toContain('fact: pr-template: .github/pull_request_template.md');
  expect(gapIds(a.lines)).not.toContain('no-pr-template');

  const loose = await audit(committed({ 'tsconfig.json': '{ "compilerOptions": { "target": "es2022" } }\n' }));
  const gap = loose.lines.find((l) => l.startsWith('gap: typecheck-loose:')) ?? '';
  expect(gap).toContain('tsconfig.json');
});

it('risk:parsing accord audit finds a formatter or names its absence (D-08)', async () => {
  const none = await audit(committed({ 'src/a.ts': 'export const a = 1;\n' }));
  expect(none.lines.find((l) => l.startsWith('gap: no-formatter:'))).toContain('/accord queue <idea>');

  const rc = await audit(committed({ '.prettierrc': '{}\n' }));
  expect(rc.lines.find((l) => l.startsWith('fact: formatter:'))).toMatch(/prettier.*\.prettierrc/);
  expect(gapIds(rc.lines)).not.toContain('no-formatter');

  const pkg = await audit(committed({ 'package.json': '{ "prettier": { "semi": false } }\n' }));
  expect(pkg.lines.find((l) => l.startsWith('fact: formatter:'))).toMatch(/prettier.*package\.json/);
  expect(gapIds(pkg.lines)).not.toContain('no-formatter');

  const editor = await audit(committed({ '.editorconfig': 'root = true\n' }));
  expect(editor.lines.find((l) => l.startsWith('fact: formatter:'))).toContain('.editorconfig');
  expect(gapIds(editor.lines)).not.toContain('no-formatter');
});

it('risk:complex-branching accord audit names a bookkeeping subject the commit rule breaks (D-08)', async () => {
  const pattern = CONFIG + "commits:\n  message:\n    pattern: '^[A-Z]+-\\d+ '\n    example: 'ABC-12 fix cart'\n";
  const r = await audit(committed({}, pattern));
  expect(r.code, r.out).toBe(0);
  const breaking = r.lines.filter((l) => l.startsWith('gap: subject-breaks-rule:'));
  expect(breaking.some((l) => l.includes('commits.subjects.claim')), r.out).toBe(true);
  // the subjects accord commits off ticket branches are not judged
  expect(breaking.some((l) => l.includes('commits.subjects.queue') || l.includes('commits.subjects.drop') || l.includes('commits.subjects.conventions'))).toBe(false);
  expect(gapIds(r.lines)).not.toContain('commit-rule-unset');
  expect(r.lines.find((l) => l.startsWith('fact: commit-rule:'))).toContain('commits.message.pattern');
});

it('risk:complex-branching accord audit raises no PR-template gap when pr.command builds the PR body (D-01)', async () => {
  const withScript = await audit(committed({}, CONFIG + 'pr:\n  command: ./pr.sh\n'));
  expect(gapIds(withScript.lines)).not.toContain('no-pr-template');
  expect(withScript.lines).toContain('fact: pr-template: none; pr.command builds the title and body');

  const without = await audit(committed({}));
  expect(has(without.lines, 'gap: no-pr-template:')).toBe(true);

  const both = await audit(committed({ '.github/pull_request_template.md': '## Summary\n' }, CONFIG + 'pr:\n  command: ./pr.sh\n'));
  expect(both.lines).toContain('fact: pr-template: .github/pull_request_template.md');
  expect(gapIds(both.lines)).not.toContain('no-pr-template');
});

it('risk:complex-branching accord audit never throws when config.yml fails the schema and lists no PR-template gap then (D-01)', async () => {
  const bad = await audit(committed({}, CONFIG + 'pr:\n  command: 5\n  nonsense: true\n'));
  expect(bad.code, bad.out).toBe(0);
  expect(gapIds(bad.lines)).not.toContain('no-pr-template');
  expect(bad.lines.find((l) => l.startsWith('fact: pr-template:'))).toContain("pr.command not checked (config.yml does not pass this CLI's schema)");
  expect(bad.lines.find((l) => l.startsWith('fact: commit-rule:'))).toContain('not checked');
});
