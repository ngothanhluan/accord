// CLI-04/CLI-05: `accord lint` end to end, driven in-process through runCli with injected streams and
// an explicit cwd. The exit contract under test is STACK Decision 1: 0 clean, 1 an error finding,
// 2 a usage or environment problem.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const ESC = String.fromCharCode(27);

describe('accord lint', () => {
  let clean: string;
  let broken: string;

  beforeAll(() => {
    clean = makeRepo('valid-build');
    broken = makeRepo('frontmatter-errors');
  });
  afterAll(() => {
    cleanup(clean);
    cleanup(broken);
  });

  it('exits 0 and writes the renderText body for a repository with no error finding', async () => {
    const { code, out, err } = await run(['lint'], clean);
    expect(code).toBe(0);
    expect(out).toMatch(/^\d+ errors, \d+ warnings$/m);
    expect(out).toContain('accord/tickets/LOGIN-1.md');
    expect(err).toBe('');
  });

  it('exits 1 when the lint result carries an error finding (D-56)', async () => {
    const { code, out } = await run(['lint'], broken);
    expect(code).toBe(1);
    expect(out).toContain('error load.frontmatter-missing');
  });

  it('--json writes the LintResult verbatim, with no wrapper key (D-98)', async () => {
    const { code, out } = await run(['lint', '--json'], clean);
    expect(code).toBe(0);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['errors', 'findings', 'warnings']);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('is byte-identical from a subdirectory of the repository (D-103)', async () => {
    const atRoot = await run(['lint'], clean);
    const atSub = await run(['lint'], join(clean, 'src'));
    expect(atSub.out).toBe(atRoot.out);
    expect(atSub.code).toBe(atRoot.code);
  });

  it('exits 2 outside a git repository', async () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'accord-nogit-'));
    try {
      const { code, out, err } = await run(['lint'], notARepo);
      expect(code).toBe(2);
      expect(out).toBe('');
      expect(err).toContain('not a git repository');
    } finally {
      rmSync(notARepo, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it('exits 2 in a git repository with no accord/ folder, with the loader message', async () => {
    const bare = makeRepo('valid-build');
    rmSync(join(bare, 'accord'), { recursive: true, force: true, maxRetries: 5 });
    try {
      const { code, err } = await run(['lint'], bare);
      expect(code).toBe(2);
      expect(err).toContain('no accord/ folder in ');
    } finally {
      cleanup(bare);
    }
  });

  it('writes no ANSI escape sequence when stdout is not a TTY (T-05-03)', async () => {
    const { out } = await run(['lint'], clean);
    expect(out).not.toContain(ESC);
  });
});

describe('accord argument handling', () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo('valid-build');
  });
  afterAll(() => {
    cleanup(repo);
  });

  it('--version prints the running version alone and exits 0 (D-95)', async () => {
    const { code, out } = await run(['--version'], repo);
    expect(code).toBe(0);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('--help exits 0 and names the lint command', async () => {
    const { code, out } = await run(['--help'], repo);
    expect(code).toBe(0);
    expect(out).toContain('lint');
  });

  it('exits 2 on an unknown command (STACK Decision 1 puts bad args at 2)', async () => {
    const { code, err } = await run(['nope'], repo);
    expect(code).toBe(2);
    expect(err).toContain('nope');
  });
});
