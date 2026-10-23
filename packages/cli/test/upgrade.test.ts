// ST-LN-25 `accord upgrade`: the pushed branch moves every pin, and the checkout it ran in is left alone.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { hookEntries, initFiles, mergeHooks } from '@accord-dev/accord-core';
import pkg from '../package.json' with { type: 'json' };
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

const clones: Clone[] = [];
afterEach(() => {
  for (const c of clones.splice(0)) c.cleanupAll();
});

const v = pkg.version;
const name = pkg.name;

it('ac-3 upgrade pushes a branch from the latest origin main whose one commit moves every pin and the checkout is unchanged', async () => {
  const c = makeClone();
  clones.push(c);
  const o = c.otherClone();
  const old = { name, version: '0.0.9' };
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  writeFiles(o, {
    'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.0.9"'),
    '.github/workflows/accord.yml': initFiles(old).find((f) => f.path === '.github/workflows/accord.yml')!.text,
    '.claude/settings.json': JSON.stringify(mergeHooks({}, hookEntries(old)), null, 2) + '\n',
  });
  commitMsg(o, 'pin 0.0.9');
  writeFiles(o, { 'next.txt': 'next\n' });
  const base = commitMsg(o, 'next');
  gitRun(o, 'push', '-q', 'origin', 'main');

  writeFileSync(join(c.root, 'scratch.txt'), 'scratch\n');
  const head = c.git('rev-parse', 'HEAD');
  const branch = c.git('branch', '--show-current');
  const status = c.git('status', '--porcelain');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe(`branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`);
  expect(c.git('rev-parse', 'HEAD')).toBe(head);
  expect(c.git('branch', '--show-current')).toBe(branch);
  expect(c.git('status', '--porcelain')).toBe(status);
  expect(readFileSync(join(c.root, 'scratch.txt'), 'utf8')).toBe('scratch\n');
  expect(c.git('diff', '--cached')).toBe('');
  expect(existsSync(join(c.root, '.claude'))).toBe(false);

  const U = gitRun(c.remote, 'rev-parse', `upgrade/${v}`).trim();
  expect(gitRun(c.remote, 'rev-parse', U + '^').trim()).toBe(base);
  expect(gitRun(c.remote, 'rev-list', '--count', `${base}..upgrade/${v}`).trim()).toBe('1');

  const p = c.otherClone();
  gitRun(p, 'switch', '-q', `upgrade/${v}`);
  expect(readFileSync(join(p, 'accord/config.yml'), 'utf8')).toContain(`accord: "${v}"`);
  const wf = readFileSync(join(p, '.github/workflows/accord.yml'), 'utf8');
  expect(wf).toContain(`${name}@${v} `);
  expect(wf).not.toContain('@0.0.9');
  const settings = JSON.parse(readFileSync(join(p, '.claude/settings.json'), 'utf8')) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
  const commands = Object.values(settings.hooks).flatMap((es) => es.flatMap((e) => e.hooks.map((h) => h.command)));
  expect(commands.length).toBeGreaterThan(0);
  for (const cmd of commands) expect(cmd).toMatch(new RegExp(`^npx --yes ${name}@${v.replace(/\./g, '\\.')} hook [a-z-]+$`));

  const s = await run(['skills', 'sync'], p);
  expect(s.code, s.err).toBe(0);
  expect(gitRun(p, 'status', '--porcelain')).toBe('');
});

it('risk:data-loss upgrade refuses and pushes nothing when the branch exists the pin is not older the settings are not an object or lint fails', async () => {
  const c = makeClone();
  clones.push(c);
  const o = c.otherClone();
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  const pin = (x: string) => {
    writeFiles(o, { 'accord/config.yml': cfg.replace(/^accord: .*$/m, `accord: "${x}"`) });
    commitMsg(o, 'pin ' + x);
    gitRun(o, 'push', '-q', 'origin', 'main');
  };
  const head = c.git('rev-parse', 'HEAD');
  const refused = async (text: string) => {
    const r = await run(['upgrade'], c.root);
    expect(r.code, r.err).toBe(2);
    expect(r.err).toContain(text);
    expect(c.git('rev-parse', 'HEAD')).toBe(head);
    return r;
  };
  const noBranch = () => expect(gitRun(c.remote, 'for-each-ref', 'refs/heads/upgrade')).toBe('');

  await refused(`which is not older than ${v}`);
  noBranch();
  pin('9.9.9');
  await refused(`which is not older than ${v}`);
  noBranch();

  pin('0.0.9');
  gitRun(o, 'push', '-q', 'origin', `HEAD:refs/heads/upgrade/${v}`);
  const before = gitRun(c.remote, 'rev-parse', `upgrade/${v}`);
  await refused('already exists on origin');
  expect(gitRun(c.remote, 'rev-parse', `upgrade/${v}`)).toBe(before);
  gitRun(o, 'push', '-q', 'origin', '--delete', `upgrade/${v}`);

  writeFiles(o, { '.claude/settings.json': '[]\n' });
  commitMsg(o, 'bad settings');
  gitRun(o, 'push', '-q', 'origin', 'main');
  await refused('is not a JSON object');
  noBranch();
  gitRun(o, 'rm', '-q', '.claude/settings.json');
  commitMsg(o, 'no settings');

  writeFiles(o, { 'accord/tickets/ST-9.md': '---\nid: "ST-9"\ntype: nonsense\n---\n' });
  commitMsg(o, 'bad ticket');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await refused('would fail lint');
  expect(r.err).toContain('accord/tickets/ST-9.md');
  noBranch();
});
