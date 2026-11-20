// Phase 8.1 G3a (D-11, 8.1-ac-10): one line names /accord-audit when conventions.md exists and holds no convention line; it never refuses and never runs the audit.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const NOTICE = 'conventions: accord/product/conventions.md has no convention line; /accord-audit drafts them from the code (optional)';

/** A repository `accord init` made, with an identity so the dashboard can name its viewer; `lines` replaces the scaffolded conventions file when given. */
async function made(lines?: string): Promise<string> {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
  gitRun(repo, 'config', 'user.name', 'fixture');
  expect((await run(['init'], repo)).code).toBe(0);
  // the viewer is registered, so accord assigns the ticket id (ST-FX-1)
  const config = join(repo, 'accord', 'config.yml');
  writeFileSync(config, readFileSync(config, 'utf8').replace('people: {}', 'people:\n  fixture@example.invalid: FX'));
  if (lines !== undefined) writeFiles(repo, { 'accord/product/conventions.md': lines });
  commitAll(repo);
  return repo;
}

const count = (text: string): number => text.split('\n').filter((l) => l === NOTICE).length;

it('risk:regression new ticket and the dashboard name /accord-audit when conventions are empty and still create the ticket (8.1-ac-10)', async () => {
  const empty = await made();
  const filled = await made('# Conventions\n\n- Use named exports — enforced by: prose\n');

  const a = await run(['new', 'ticket', '--type', 'story', '--title', 'Export orders'], empty);
  expect(a.code, a.out + a.err).toBe(0);
  expect(existsSync(join(empty, 'accord', 'tickets', 'ST-FX-1.md'))).toBe(true);
  expect(count(a.err)).toBe(1);
  expect(a.out).not.toContain('/accord-audit');

  const b = await run(['new', 'ticket', '--type', 'story', '--title', 'Export orders'], filled);
  expect(b.code, b.out + b.err).toBe(0);
  expect(count(b.err)).toBe(0);
  // stdout is the same with and without the notice
  expect(a.out).toBe(b.out);

  const d = await run(['dashboard'], empty);
  expect(d.code, d.out + d.err).toBe(0);
  expect(count(d.out)).toBe(1);
  const sections = d.out.indexOf(NOTICE);
  expect(sections).toBeGreaterThanOrEqual(0);

  const json = await run(['dashboard', '--json'], empty);
  expect(json.code, json.out + json.err).toBe(0);
  expect(json.out).not.toContain('/accord-audit');
  expect(() => JSON.parse(json.out)).not.toThrow();

  const f = await run(['dashboard'], filled);
  expect(f.out).not.toContain('/accord-audit');
});

it('risk:regression neither new ticket nor the dashboard prints the notice when conventions.md is absent (8.1-ac-10)', async () => {
  const repo = await made();
  gitRun(repo, 'rm', '-q', '-f', 'accord/product/conventions.md');
  expect(existsSync(join(repo, 'accord', 'product', 'conventions.md'))).toBe(false);
  const t = await run(['new', 'ticket', '--type', 'story', '--title', 'Export orders'], repo);
  expect(t.code, t.out + t.err).toBe(0);
  expect(t.err).not.toContain('/accord-audit');
  const d = await run(['dashboard'], repo);
  expect(d.out).not.toContain('/accord-audit');
});
