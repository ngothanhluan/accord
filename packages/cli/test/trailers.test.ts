import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const FORBID = CONFIG + 'commits:\n  trailers: forbid\n';
const LEDGER = 'accord/tickets/T-1/ledger.md';

function commitMessage(repo: string, message: string): string {
  writeFileSync(join(repo, '.git', 'ACCORD_MSG'), message);
  gitRun(repo, 'add', '-A');
  gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '--allow-empty', '--cleanup=verbatim', '-F', join(repo, '.git', 'ACCORD_MSG'));
  return gitRun(repo, 'rev-parse', 'HEAD').trim();
}
const fresh = (repo: string) => {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(repo, 'reports', 'junit.xml'), later, later);
};

it('ac-3 task-done refuses a task whose commit carries a forbidden line when the repository forbids trailers', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': FORBID });
  const repo2 = makeLaneRepo();
  try {
    commitAll(repo);
    fresh(repo);
    const a = await run(['task-done', 'T-1', '1'], repo);
    expect(a.code).toBe(2);
    expect(a.err).toContain('git fetch origin');
    expect(existsSync(join(repo, LEDGER))).toBe(false);

    const base = gitRun(repo, 'rev-parse', 'HEAD').trim();
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
    const bad = commitMessage(repo, 'feat: parser\n\nAdds the parser.\nCo-Authored-By: Bot <bot@example.com>\n');
    fresh(repo);
    const b = await run(['task-done', 'T-1', '1'], repo);
    expect(b.code).toBe(1);
    expect(b.out.startsWith('task 1 of T-1 is not done:\n')).toBe(true);
    expect(b.out).toContain(bad.slice(0, 12));
    expect(b.out).toContain('Co-Authored-By: Bot <bot@example.com>');
    expect(existsSync(join(repo, LEDGER))).toBe(false);

    for (const [body, line] of [
      ['Adds the parser.\nSigned-off-by: A <a@example.com>', 'Signed-off-by: A <a@example.com>'],
      ['Adds the parser.\n  reviewed-BY: B <b@example.com>', 'reviewed-BY: B <b@example.com>'],
      ['Adds the parser.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)', '🤖 Generated with [Claude Code](https://claude.com/claude-code)'],
      ['Adds the parser.\ngenerated WITH a tool', 'generated WITH a tool'],
    ]) {
      gitRun(repo, 'reset', '-q', '--hard', base);
      const c = commitMessage(repo, 'feat: parser\n\n' + body + '\n');
      fresh(repo);
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toContain(c.slice(0, 12));
      expect(r.out).toContain(line);
      expect(existsSync(join(repo, LEDGER))).toBe(false);
    }

    gitRun(repo, 'reset', '-q', '--hard', base);
    const bb = commitMessage(repo, 'feat: one\n\nCo-Authored-By: Bot <bot@example.com>\n');
    fresh(repo);
    const d1 = await run(['task-done', 'T-1', '2'], repo);
    expect(d1.code).toBe(1);
    expect(d1.out).toContain(bb.slice(0, 12));
    writeFiles(repo, { [LEDGER]: '# Ledger\n\n## Tasks\n- task 1 done ' + bb.slice(0, 12) + '\n' });
    commitMessage(repo, 'ledger: T-1 task 1\n');
    commitMessage(repo, 'feat: two\n\nQuotes cells.\n');
    fresh(repo);
    const d2 = await run(['task-done', 'T-1', '2'], repo);
    expect(d2.code).toBe(0);
    expect(d2.out.startsWith('recorded task 2 done at')).toBe(true);

    gitRun(repo, 'reset', '-q', '--hard', base);
    writeFiles(repo, { 'accord/config.yml': CONFIG + 'commits:\n  trailers: allow\n' });
    const OFFENDER = 'feat: parser\n\nCo-Authored-By: Bot <bot@example.com>\n';
    commitMessage(repo, OFFENDER);
    fresh(repo);
    const e = await run(['task-done', 'T-1', '1'], repo);
    expect(e.code).toBe(0);
    expect(readFileSync(join(repo, LEDGER), 'utf8')).toContain('- task 1 done ');

    commitAll(repo2);
    commitMessage(repo2, OFFENDER);
    fresh(repo2);
    expect((await run(['task-done', 'T-1', '1'], repo2)).code).toBe(0);
  } finally {
    cleanup(repo);
    cleanup(repo2);
  }
}, 120_000);
