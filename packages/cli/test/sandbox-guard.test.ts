import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { copyClone, makeClone } from './helpers/worktree.js';

// The facts a copy must share with a clone built the same way; the root and the head sha vary per clone.
function facts(c: { root: string; remote: string; git(...a: string[]): string }) {
  const remote = (...a: string[]) => c.git('--git-dir=' + c.remote, ...a);
  return {
    refs: c.git('for-each-ref', '--format=%(refname)'),
    remoteRefs: remote('for-each-ref', '--format=%(refname)'),
    tree: c.git('ls-tree', '-r', 'HEAD'),
    log: c.git('log', '--format=%s'),
    email: c.git('config', 'user.email'),
    name: c.git('config', 'user.name'),
    gpgsign: c.git('config', 'commit.gpgsign'),
    status: c.git('status', '--porcelain'),
    worktrees: c.git('worktree', 'list', '--porcelain').split(c.root).join('<root>').replace(/^HEAD [0-9a-f]+$/m, 'HEAD <sha>'),
  };
}

it('risk:data-loss a template copy pushes to its own origin and matches a clone built the same way', () => {
  const tpl = makeClone({ tickets: ['ST-9', 'ST-10'] });
  const other = tpl.otherClone();
  const built = makeClone({ tickets: ['ST-9', 'ST-10'] });
  const c = copyClone(tpl, [other]);
  try {
    for (const dir of [c.root, c.others[0]!]) {
      const git = (...a: string[]) => c.git('-C', dir, ...a).trim();
      expect(git('remote', 'get-url', 'origin')).toBe(c.remote);
      expect(git('remote', 'get-url', '--push', 'origin')).toBe(c.remote);
      expect(git('remote', 'get-url', 'origin')).not.toBe(tpl.remote);
      expect(git('remote', 'get-url', '--push', 'origin')).not.toBe(tpl.remote);
    }
    expect(c.root).not.toBe(tpl.root);
    expect(c.remote).not.toBe(tpl.remote);
    expect(c.others[0]).not.toBe(other);
    expect(c.root).toBe(c.git('rev-parse', '--show-toplevel').trim());
    expect(c.root).not.toContain('\\');
    expect(facts(c)).toEqual(facts(built));
    c.git('push', '-q', 'origin', 'HEAD:refs/heads/probe');
    expect(c.git('--git-dir=' + c.remote, 'for-each-ref', 'refs/heads/probe')).toContain('refs/heads/probe');
    expect(tpl.git('--git-dir=' + tpl.remote, 'for-each-ref', 'refs/heads/probe')).toBe('');
  } finally {
    c.cleanupAll();
    built.cleanupAll();
    tpl.cleanupAll();
  }
}, 120_000);

it('risk:data-loss copyClone refuses a template that holds a linked worktree', () => {
  const tpl = makeClone({ tickets: ['ST-9'] });
  try {
    tpl.git('worktree', 'add', '-q', '-b', 't/ST-9', tpl.sibling('ST-9'), 'origin/main');
    expect(() => copyClone(tpl)).toThrow('linked worktree');
  } finally {
    tpl.cleanupAll();
  }
});

it('risk:data-loss run refuses the checkout and a folder outside the temp folder and accepts a folder that exists only under it', async () => {
  const checkout = fileURLToPath(new URL('../../../', import.meta.url));
  const refusal = 'refusing to run accord outside a temporary sandbox';
  await expect(run(['--version'], checkout)).rejects.toThrow(refusal);
  // An existing folder that is not the process cwd: a guard comparing only with process.cwd() accepts it.
  await expect(run(['--version'], join(checkout, 'packages'))).rejects.toThrow(refusal);
  await expect(run(['--version'], join(checkout, 'no-such-folder', 'sub'))).rejects.toThrow(refusal);
  await expect(run(['--version'], '')).rejects.toThrow(refusal);
  const tmp = mkdtempSync(join(tmpdir(), 'accord-guard-'));
  try {
    const ok = await run(['--version'], join(tmp, 'sub', 'deeper'));
    expect(ok.code).toBe(0);
  } finally {
    cleanup(tmp);
  }
});

it('risk:regression an other clone of a template copy is one clone with the fixture identity and its own origin', () => {
  const c = copyClone(makeClone());
  try {
    const o = c.otherClone();
    for (const k of ['user.email', 'user.name', 'commit.gpgsign']) {
      expect(gitRun(o, 'config', k).trim()).toBe(c.git('config', k).trim());
    }
    expect(gitRun(o, 'remote', 'get-url', 'origin').trim()).toBe(c.remote);
    expect(gitRun(o, 'rev-parse', 'main').trim()).toBe(c.git('--git-dir=' + c.remote, 'rev-parse', 'main').trim());
    // One spawn: `clone -c` writes the identity right after init, so it precedes the remote in the config file; later `git config` calls would append it after.
    const list = gitRun(o, 'config', '--local', '--list');
    expect(list.indexOf('user.email=fixture@example.invalid')).toBeGreaterThanOrEqual(0);
    expect(list.indexOf('user.email=')).toBeLessThan(list.indexOf('remote.origin.url='));
  } finally {
    c.cleanupAll();
  }
}, 60_000);
