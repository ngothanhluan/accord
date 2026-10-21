// ST-LN-26 @ac-3: the CLI reads the commits after verify from git for the ticket on its branch and for claimed tickets.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { PLAN } from '../../../test/helpers/lane.js';
import { loadFromFs } from '../src/load/fs.js';
import { commitAllAt, gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone } from './helpers/worktree.js';

const TICKET = 'accord/tickets/ST-9.md';

function commit(dir: string, msg: string): string {
  gitRun(dir, 'add', '-A');
  gitRun(dir, 'commit', '-q', '-m', msg);
  return gitRun(dir, 'rev-parse', 'HEAD').trim();
}

function setKey(dir: string, key: string, value: string | string[]): void {
  const file = join(dir, ...TICKET.split('/'));
  writeFileSync(file, setFrontmatterKey(readFileSync(file, 'utf8'), key, value));
}

const VERIFICATION = (sha: string) =>
  ['---', 'ticket: "ST-9"', `commit: "${sha}"`, 'reviewed_on: "2026-10-12"', '---', '', '## @ac-1 x', '', 'Result: pass', '', 'Evidence: x', ''].join('\n');

it('risk:complex-branching the commits after verify come from the ticket tip without the default branch in graph order', () => {
  const c = makeClone();
  try {
    c.git('switch', '-c', 't/ST-9');
    writeFiles(c.root, { 'src/a.ts': 'a\n' });
    const C = commit(c.root, 'work');
    setKey(c.root, 'verified_commit', C);
    const T = commit(c.root, 'tick');
    const fact = () => loadFromFs(c.root).afterVerify?.['ST-9'];
    expect(fact()).toEqual([{ sha: T, parents: [C], files: ['accord/tickets/ST-9.md'] }]);

    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commitAllAt(c.root, new Date('2001-01-01T00:00:00Z'), 'fix');
    const F = c.git('rev-parse', 'HEAD').trim();
    expect(fact()?.map((x) => x.sha)).toEqual([T, F]);
    expect(fact()?.at(-1)?.files).toEqual(['src/fix.ts']);

    const o = c.otherClone();
    writeFiles(o, { 'src/main.ts': 'm\n' });
    const Mn = commit(o, 'main work');
    gitRun(o, 'push', '-q', 'origin', 'main');
    c.git('fetch', '-q', 'origin');
    c.git('merge', '-q', '--no-edit', 'origin/main');
    const M = c.git('rev-parse', 'HEAD').trim();
    expect(fact()?.map((x) => x.sha)).toEqual([T, F, M]);
    expect(fact()?.at(-1)).toEqual({ sha: M, parents: [F, Mn], files: [] });

    c.git('switch', '-c', 'side', C);
    writeFiles(c.root, { 'src/side.ts': 's\n' });
    const S = commit(c.root, 'side');
    c.git('switch', 't/ST-9');
    c.git('merge', '-q', '--no-edit', 'side');
    const M2 = c.git('rev-parse', 'HEAD').trim();
    const shas = fact()?.map((x) => x.sha) ?? [];
    expect(new Set(shas)).toEqual(new Set([T, F, M, S, M2]));
    expect(shas.indexOf(S)).toBeLessThan(shas.indexOf(M2));

    c.git('push', '-q', 'origin', 't/ST-9:main');
    c.git('fetch', '-q', 'origin');
    expect(loadFromFs(c.root).afterVerify).toBeUndefined();
  } finally {
    c.cleanupAll();
  }

  const d = makeClone();
  try {
    d.git('switch', '-c', 't/ST-9');
    setKey(d.root, 'verified_commit', 'deadbee' + '0'.repeat(33));
    commit(d.root, 'tick');
    expect(loadFromFs(d.root).afterVerify?.['ST-9']).toBeUndefined();
  } finally {
    d.cleanupAll();
  }

  const e = makeClone();
  try {
    e.git('remote', 'remove', 'origin');
    e.git('switch', '-c', 't/ST-9');
    writeFiles(e.root, { 'src/a.ts': 'a\n' });
    const C = commit(e.root, 'work');
    setKey(e.root, 'verified_commit', C);
    const T = commit(e.root, 'tick');
    e.git('switch', 'main');
    writeFiles(e.root, { 'src/m.ts': 'm\n' });
    const Mn = commit(e.root, 'main work');
    e.git('switch', 't/ST-9');
    e.git('merge', '-q', '--no-edit', 'main');
    const M = e.git('rev-parse', 'HEAD').trim();
    const fact = () => loadFromFs(e.root).afterVerify?.['ST-9'];
    expect(fact()?.map((x) => x.sha)).toEqual([T, M]);
    expect(fact()?.at(-1)?.files).toEqual([]);
    e.git('branch', '-m', 'main', 'trunk');
    expect(fact()?.map((x) => x.sha)).toContain(Mn);
    expect(fact()?.find((x) => x.sha === M)).not.toHaveProperty('files');
  } finally {
    e.cleanupAll();
  }

  const f = makeClone();
  try {
    f.git('switch', '-c', 't/ST-9');
    writeFiles(f.root, { 'src/a.ts': 'a\n' });
    const C = commit(f.root, 'work');
    writeFiles(f.root, { 'accord/tickets/ST-9/verification.md': VERIFICATION(C) });
    writeFiles(f.root, { 'src/fix.ts': 'f\n' });
    gitRun(f.root, 'add', 'src/fix.ts');
    gitRun(f.root, 'commit', '-q', '-m', 'fix');
    const F = gitRun(f.root, 'rev-parse', 'HEAD').trim();
    expect(loadFromFs(f.root).afterVerify?.['ST-9']).toEqual([{ sha: F, parents: [C], files: ['src/fix.ts'] }]);
  } finally {
    f.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching status in the main checkout takes a claimed ticket back from done when its branch holds a fix after verify', async () => {
  const c = makeClone();
  try {
    c.git('switch', '-c', 't/ST-9');
    expect((await run(['approve', 'ST-9'], c.root)).code).toBe(0);
    expect((await run(['gate', 'ready', 'ST-9'], c.root)).code).toBe(0);
    writeFiles(c.root, {
      'accord/tickets/ST-9/plan.md': PLAN,
      'accord/tickets/ST-9/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
      'accord/tickets/ST-9/review.md': '## Round 1\nverdict: converged\n',
      'src/a.ts': 'a\n',
    });
    const C = commit(c.root, 'work');
    const hash = /^ac_hash: "(.+)"$/m.exec(readFileSync(join(c.root, ...TICKET.split('/')), 'utf8'))?.[1] as string;
    setKey(c.root, 'verified', ['ac-1', 'ac-2']);
    setKey(c.root, 'verified_hash', hash);
    setKey(c.root, 'verified_commit', C);
    const T = commit(c.root, 'tick');
    c.git('push', '-q', '-u', 'origin', 't/ST-9');
    const row = async () => {
      const rows = JSON.parse((await run(['status', '--json'], c.root)).out) as { id: string; stage: string }[];
      return rows.find((r) => r.id === 'ST-9')?.stage;
    };
    c.git('switch', 'main');
    expect(await row()).toBe('done');

    c.git('switch', 't/ST-9');
    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    c.git('switch', 'main');
    expect(await row()).toBe('review');

    c.git('switch', 't/ST-9');
    c.git('push', '-q');
    const anchor = await run(['anchor'], c.root);
    expect(anchor.out).toContain('Stage: review');
    expect(anchor.out).toContain(`Review base: ${T}`);
    c.git('switch', 'main');
    expect(await row()).toBe('review');

    c.git('merge', '-q', '--ff-only', T);
    const named = await run(['anchor', 'ST-9'], c.root);
    expect(named.code).toBe(0);
    expect(named.out).toContain('Stage: review');
    expect(named.out).toContain(`Review base: ${T}`);
    c.git('reset', '-q', '--hard', 'origin/main');

    c.git('switch', 't/ST-9');
    writeFiles(c.root, { 'accord/tickets/ST-9/review.md': '## Round 1\nverdict: converged\n\n## Round 2\n\nNo findings\n\nverdict: converged\n' });
    commit(c.root, 'review');
    c.git('push', '-q');
    c.git('switch', 'main');
    expect(await row()).toBe('verify');
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching review-package leaves out what a merge from the default branch brought in', async () => {
  const c = makeClone();
  try {
    const B0 = c.git('rev-parse', 'HEAD').trim();
    c.git('switch', '-c', 't/ST-9');
    writeFiles(c.root, { 'src/a.ts': 'a\n' });
    commit(c.root, 'fix one');
    const before = await run(['review-package', 'ST-9', '--base', B0], c.root);
    expect(before.code).toBe(0);
    expect(before.out.startsWith(`# Review package: ST-9 (${B0}...HEAD)`)).toBe(true);

    const o = c.otherClone();
    writeFiles(o, { 'src/main.ts': 'm\n' });
    commit(o, 'main work');
    gitRun(o, 'push', '-q', 'origin', 'main');
    c.git('fetch', '-q', 'origin');
    c.git('merge', '-q', '--no-edit', 'origin/main');
    writeFiles(c.root, { 'src/b.ts': 'b\n' });
    commit(c.root, 'fix two');
    const after = await run(['review-package', 'ST-9', '--base', B0], c.root);
    expect(after.code).toBe(0);
    expect(after.out).toContain('without origin/main');
    expect(after.out).toContain('fix one');
    expect(after.out).toContain('fix two');
    expect(after.out).not.toContain('main work');
    const diff = after.out.slice(after.out.indexOf('## Diff'));
    expect(diff).toContain('src/a.ts');
    expect(diff).toContain('src/b.ts');
    expect(diff).not.toContain('src/main.ts');
    const stat = after.out.slice(after.out.indexOf('## Stat'), after.out.indexOf('## Undeclared files'));
    expect(stat).not.toContain('src/main.ts');
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:regression of a real bug: a fix made at verify, before any verification.md, gets a review round', async () => {
  const c = makeClone();
  try {
    c.git('switch', '-c', 't/ST-9');
    expect((await run(['approve', 'ST-9'], c.root)).code).toBe(0);
    expect((await run(['gate', 'ready', 'ST-9'], c.root)).code).toBe(0);
    writeFiles(c.root, {
      'accord/tickets/ST-9/plan.md': PLAN,
      'accord/tickets/ST-9/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
      'accord/tickets/ST-9/review.md': '## Round 1\nverdict: converged\n',
      'src/a.ts': 'a\n',
    });
    const R = commit(c.root, 'work and review');
    const quiet = await run(['anchor'], c.root);
    expect(quiet.out).toContain('Stage: verify');
    expect(quiet.out).not.toContain('Review base:');

    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    const fixed = await run(['anchor'], c.root);
    expect(fixed.out).toContain('Stage: review');
    expect(fixed.out).toContain(`Review base: ${R}`);
  } finally {
    c.cleanupAll();
  }
}, 120_000);
