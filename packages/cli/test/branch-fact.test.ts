// ST-LN-62 Task 1: the host half of the scope check, on a real git repository.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, skillTargets } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { CONFIG, junit, LANE_S_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';
import { hooksPlanFor, SETTINGS } from '../src/commands/skills.js';
import { gitBranchFact, unquoteGitPath } from '../src/load/fs.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

function repoWith(files: Record<string, string>): string {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  gitRun(repo, 'config', 'core.autocrlf', 'false');
  writeFiles(repo, files);
  return repo;
}

const errs = (out: string, rule: string): string[] =>
  (JSON.parse(out).findings as { rule: string; reason: string }[]).filter((f) => f.rule === rule).map((f) => f.reason);

it('risk:complex-branching gate done reads the branch diff from the merge base ignoring whitespace and pins the scope at the first commit that records ac_hash', async () => {
  const repo = repoWith({
    'accord/config.yml': CONFIG,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
    'src/a.ts': 'a\n',
    'src/b.ts': 'b\n',
    'src/ws.ts': 'x = 1;\n',
    '.claude/settings.json': '{"x":1}\n',
    [REPORT]: junit({ 'a#b': 'passed' }),
  });
  try {
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);
    const R = commitMsg(repo, 'ready: S-1');
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/main.ts': 'm\n' });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/S-1');
    writeFiles(repo, { 'src/a.ts': 'a2\n', 'src/ws.ts': 'x   =   1;   \r\n\r\n\r\n' });
    commitMsg(repo, 'change');

    // Widening the scope at HEAD changes nothing: the scope is the one recorded when ac_hash first appeared.
    const ticket = join(repo, 'accord', 'tickets', 'S-1.md');
    writeFiles(repo, {
      'accord/tickets/S-1.md': readFileSync(ticket, 'utf8').replace('## Scope\nsrc/a.ts\n', '## Scope\nsrc/a.ts\nsrc/b.ts\n'),
      'src/b.ts': 'b2\n',
    });
    commitMsg(repo, 'widen');

    const cfg = loadConfig('accord/config.yml', CONFIG).config;
    if (cfg === undefined) throw new Error('config');
    const targets = skillTargets(cfg);
    const text = (path: string) => (targets.find((t) => t.path === path) as { text: string }).text;
    const settings = hooksPlanFor('{"x":1}\n', cfg)?.text as string;
    writeFiles(repo, {
      '.claude/skills/accord/SKILL.md': text('.claude/skills/accord/SKILL.md'),
      '.claude/skills/accord/ids.md': text('.claude/skills/accord/ids.md') + 'x\n',
      '.claude/settings.json': settings,
      'accord/config.yml': CONFIG + 'generated:\n  - gen/\n',
      'gen/out.txt': 'g\n',
    });
    commitMsg(repo, 'generated and synced');

    const d = await run(['gate', 'done', 'S-1', '--json'], repo);
    expect(d.code).toBe(1);
    const out = errs(d.out, 'gate.out-of-scope');
    expect(out).toHaveLength(4);
    ['.claude/skills/accord/ids.md ', 'accord/config.yml ', 'gen/out.txt ', 'src/b.ts '].forEach((start, i) => {
      expect(out[i].startsWith(start)).toBe(true);
      expect(out[i]).toContain(`at commit ${R}`);
    });
    const all = out.join('\n');
    for (const named of ['src/a.ts', 'src/ws.ts', 'src/main.ts', '.claude/skills/accord/SKILL.md', '.claude/settings.json', 'accord/tickets/S-1.md']) {
      expect(all).not.toContain(named);
    }
    expect(errs(d.out, 'gate.branch-unknown')).toEqual([]);

    const f = gitBranchFact(repo, 'S-1', {
      rendered: skillTargets(cfg),
      scope: true,
      settings: { path: SETTINGS, expected: (b) => hooksPlanFor(b, cfg)?.text ?? b },
    });
    if ('error' in f) throw new Error(f.error);
    expect(f.base).toBe(gitRun(repo, 'merge-base', 'main', 'HEAD').trim());
    expect(f.scope).toEqual({ commit: R, paths: ['src/a.ts'] });
    expect(f.changes.find((c) => c.path === 'src/ws.ts')).toEqual({ path: 'src/ws.ts', kind: 'modified', lines: 0 });
    expect(f.changes.some((c) => c.path === 'src/main.ts')).toBe(false);
    expect(f.synced).toEqual(['.claude/settings.json', '.claude/skills/accord/SKILL.md']);
    expect(f.baseConfig).toBe(CONFIG);

    // A hand edit of the settings is no longer what sync writes.
    writeFiles(repo, { '.claude/settings.json': JSON.stringify({ ...JSON.parse(settings), y: 2 }, null, 2) + '\n' });
    commitMsg(repo, 'hand edit');
    const e = errs((await run(['gate', 'done', 'S-1', '--json'], repo)).out, 'gate.out-of-scope');
    expect(e).toHaveLength(5);
    expect(e.filter((r) => r.startsWith('.claude/settings.json '))).toHaveLength(1);

    // Lane work committed on the default branch diffs empty.
    gitRun(repo, 'switch', '-q', 'main');
    const onMain = errs((await run(['gate', 'done', 'S-1', '--json'], repo)).out, 'gate.branch-unknown');
    expect(onMain).toHaveLength(1);
    expect(onMain[0]).toContain('adds no change over the merge base');
    gitRun(repo, 'switch', '-q', 't/S-1');

    // No default branch at all.
    gitRun(repo, 'branch', '-m', 'main', 'trunk');
    const none = await run(['gate', 'done', 'S-1', '--json'], repo);
    expect(none.code).toBe(1);
    const nr = errs(none.out, 'gate.branch-unknown');
    expect(nr).toHaveLength(1);
    expect(nr[0]).toContain('none of origin/HEAD, origin/main, origin/master, main or master resolves');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:parsing gate done reads added call lines and package json maps from the branch diff', async () => {
  const OPT = 'program.' + 'option(' + "'--x')\n";
  const CMD = '  ' + 'program.' + 'command(' + "'y')\n";
  const PKG_BASE = '{"name":"p","bin":{"old":"a.js"}}\n';
  const PKG_HEAD = '{"name":"p","bin":{"old":"a.js","tool":"t.js"}}\n';
  const repo = repoWith({
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'src/cli.ts': 'const p = 1;\n',
    'pkg/package.json': PKG_BASE,
    'docs/how.md': 'x\n',
    'src/gone.ts': 'g1\ng2\ng3\n',
    'bin/blob.dat': 'a\0b\n',
    'src/run.sh': 'echo\n',
    'src/lnk.ts': 'target\n',
    'src/plus.ts': 'p\n',
  });
  try {
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    rmSync(join(repo, 'src', 'gone.ts'));
    writeFiles(repo, {
      'bin/blob.dat': 'a\0c\n',
      'src/plus.ts': 'p\n++ x.' + 'option(' + "'--y')\n",
      'accord/tickets/T-1.md': readFileSync(join(repo, 'accord', 'tickets', 'T-1.md'), 'utf8') + '\n<!-- worked -->\n',
      'src/cli.ts': 'const p = 1;\n' + OPT + CMD,
      'src/é.ts': OPT,
      'src/a b.ts': OPT,
      'pkg/package.json': PKG_HEAD,
      'schemas/thing.json': '{}\n',
      'docs/how.md': 'x\n' + OPT,
    });
    commitMsg(repo, 'work');
    // A mode-only change and a regular file turned into a symlink, staged through the index so they work on Windows;
    // committed without `add -A`, which on POSIX would put the working-tree modes back.
    gitRun(repo, 'update-index', '--chmod=+x', 'src/run.sh');
    gitRun(repo, 'update-index', '--cacheinfo', `120000,${gitRun(repo, 'rev-parse', 'HEAD:src/lnk.ts').trim()},src/lnk.ts`);
    const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
    try {
      writeFileSync(join(folder, 'msg.txt'), 'mode and type\n');
      gitRun(repo, 'commit', '-q', '-F', join(folder, 'msg.txt'), '--cleanup=verbatim');
    } finally {
      cleanup(folder);
    }
    gitRun(repo, 'checkout', '--', 'src/run.sh', 'src/lnk.ts');

    const f = gitBranchFact(repo, 'T-1', { rendered: [], scope: false });
    if ('error' in f) throw new Error(f.error);
    const at = (path: string) => f.changes.find((c) => c.path === path);
    expect(at('src/cli.ts')?.calls).toHaveLength(2);
    expect(at('src/é.ts')?.calls).toHaveLength(1);
    expect(at('src/a b.ts')?.calls).toHaveLength(1);
    expect(at('docs/how.md')?.calls).toHaveLength(1);
    expect(at('pkg/package.json')?.pkg).toEqual({ base: PKG_BASE, head: PKG_HEAD });
    expect(at('schemas/thing.json')?.kind).toBe('added');
    expect(at('accord/tickets/T-1.md')?.calls).toBeUndefined();
    // Each branch of the parse: a net-deleted file (`+++ /dev/null`), a changed binary file (numstat `-`), a mode-only
    // change, a type change, and an added line that starts with `++ ` inside a hunk (patch line `+++ x...`).
    expect(at('src/gone.ts')).toEqual({ path: 'src/gone.ts', kind: 'deleted', lines: 3 });
    expect(at('bin/blob.dat')).toEqual({ path: 'bin/blob.dat', kind: 'modified', lines: 0, binary: true });
    expect(at('src/run.sh')).toEqual({ path: 'src/run.sh', kind: 'mode', lines: 0 });
    expect(at('src/lnk.ts')?.kind).toBe('type');
    expect(at('src/plus.ts')).toEqual({ path: 'src/plus.ts', kind: 'modified', lines: 1, calls: ["++ x.option('--y')"] });

    const d = await run(['gate', 'done', 'T-1', '--json'], repo);
    expect(d.code).toBe(1);
    expect(errs(d.out, 'gate.branch-unknown')).toEqual([]);
    const signs = errs(d.out, 'gate.interface-sign').join('\n');
    for (const named of ['src/cli.ts', 'src/é.ts', 'src/a b.ts', 'pkg/package.json', 'schemas/thing.json']) expect(signs).toContain(named);
    expect(signs).not.toContain('docs/how.md');

    writeFiles(repo, { 'accord/tickets/T-1/review.md': '## Round 1\n\nNot an interface: `src/a b.ts` — test harness only\n\nverdict: converged\n' });
    commitMsg(repo, 'reason');
    const after = errs((await run(['gate', 'done', 'T-1', '--json'], repo)).out, 'gate.interface-sign').join('\n');
    expect(after).not.toContain('src/a b.ts');
    expect(after).toContain('src/cli.ts');

    expect(unquoteGitPath('"a\\tb\\"c\\303\\251.ts"')).toBe('a\tb"cé.ts');
    expect(unquoteGitPath('plain/é.ts')).toBe('plain/é.ts');
  } finally {
    cleanup(repo);
  }
}, 120_000);
