// ST-LN-62 Task 1: the host half of the scope check, on a real git repository.
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentHash, loadConfig, skillTargets } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { CONFIG, junit, LANE_S_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';
import { hooksPlanFor, SETTINGS } from '../src/commands/skills.js';
import { gitBranchFact, unquoteGitPath } from '../src/load/fs.js';
import { cleanup, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

/** A sandbox repository whose user and line-ending settings are written straight into its config: no git process. */
function repoWith(files: Record<string, string>): string {
  const repo = makeEmptyRepo();
  appendFileSync(join(repo, '.git', 'config'), '[user]\n\temail = an@example.com\n\tname = an\n[commit]\n\tgpgsign = false\n[core]\n\tautocrlf = false\n');
  writeFiles(repo, files);
  return repo;
}

type Blob = string | { mode: '100755' | '120000'; text: string } | null;
interface Made {
  name: string;
  ref: string;
  /** The name of an earlier commit of the same stream, or the sha of a commit already in the repository; none for a root. */
  from?: string;
  message: string;
  files: Record<string, Blob>;
  /** Further branches that start at this commit. */
  also?: string[];
}

let clock = 1_700_000_000;

/**
 * The history of a test, written by one `git fast-import` (exact bytes, a fixed author) and not by an `add`, a `commit` and a
 * `rev-parse` per commit: the commands under test are what the test is about, not the processes that build its history.
 * Returns each commit's sha by name.
 */
function importCommits(repo: string, commits: Made[]): Record<string, string> {
  const real = realpathSync.native(repo);
  if (!real.startsWith(realpathSync.native(tmpdir())) || real === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run git outside a temporary sandbox: ' + repo);
  }
  const folder = mkdtempSync(join(tmpdir(), 'accord-marks-'));
  try {
    const marks = join(folder, 'marks.txt');
    const chunks: Buffer[] = [];
    const line = (text: string) => chunks.push(Buffer.from(text + '\n'));
    const data = (text: string) => {
      const bytes = Buffer.from(text);
      line(`data ${bytes.length}`);
      chunks.push(bytes, Buffer.from('\n'));
    };
    const markOf = new Map<string, number>();
    commits.forEach((c, i) => {
      const who = `an <an@example.com> ${clock++} +0000`;
      markOf.set(c.name, i + 1);
      line(`commit ${c.ref}`);
      line(`mark :${i + 1}`);
      line(`author ${who}`);
      line(`committer ${who}`);
      data(c.message + '\n');
      if (c.from !== undefined) line(`from ${markOf.has(c.from) ? ':' + markOf.get(c.from) : c.from}`);
      for (const [path, blob] of Object.entries(c.files)) {
        if (blob === null) line(`D ${path}`);
        else {
          line(`M ${typeof blob === 'string' ? '100644' : blob.mode} inline ${path}`);
          data(typeof blob === 'string' ? blob : blob.text);
        }
      }
      line('');
      for (const ref of c.also ?? []) {
        line(`reset ${ref}`);
        line(`from :${i + 1}`);
        line('');
      }
    });
    execFileSync('git', ['fast-import', '--quiet', `--export-marks=${marks}`], {
      cwd: repo,
      input: Buffer.concat(chunks),
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    const byMark = new Map<number, string>();
    for (const l of readFileSync(marks, 'utf8').split('\n')) {
      const m = /^:(\d+) ([0-9a-f]{40,64})$/.exec(l);
      if (m !== null) byMark.set(Number(m[1]), m[2]);
    }
    return Object.fromEntries(commits.map((c, i) => [c.name, byMark.get(i + 1) as string]));
  } finally {
    cleanup(folder);
  }
}

/** Points HEAD at a branch without a checkout, for a working tree that already holds the branch's files. */
const checkedOut = (repo: string, ref: string): void => writeFileSync(join(repo, '.git', 'HEAD'), `ref: ${ref}\n`);

const errs = (out: string, rule: string): string[] =>
  (JSON.parse(out).findings as { rule: string; reason: string }[]).filter((f) => f.rule === rule).map((f) => f.reason);

it('risk:complex-branching gate done reads the branch diff from the merge base ignoring whitespace and pins the scope at the first commit that records ac_hash', async () => {
  const base = {
    'accord/config.yml': CONFIG,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
    'src/a.ts': 'a\n',
    'src/b.ts': 'b\n',
    'src/ws.ts': 'x = 1;\n',
    '.claude/settings.json': '{"x":1}\n',
    [REPORT]: junit({ 'a#b': 'passed' }),
  };
  const repo = repoWith(base);
  try {
    const root = importCommits(repo, [{ name: 'base', ref: 'refs/heads/main', message: 'base', files: base, also: ['refs/heads/t/S-1'] }]).base;
    checkedOut(repo, 'refs/heads/t/S-1');
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);

    // Widening the scope at HEAD changes nothing: the scope is the one recorded when ac_hash first appeared.
    const ticket = join(repo, 'accord', 'tickets', 'S-1.md');
    const ready = readFileSync(ticket, 'utf8');
    const widened = ready.replace('## Scope\nsrc/a.ts\n', '## Scope\nsrc/a.ts\nsrc/b.ts\n');

    const cfg = loadConfig('accord/config.yml', CONFIG).config;
    if (cfg === undefined) throw new Error('config');
    const targets = skillTargets(cfg);
    const text = (path: string) => (targets.find((t) => t.path === path) as { text: string }).text;
    const settings = hooksPlanFor('{"x":1}\n', cfg)?.text as string;
    const generated = {
      '.claude/skills/accord/SKILL.md': text('.claude/skills/accord/SKILL.md'),
      '.claude/skills/accord/ids.md': text('.claude/skills/accord/ids.md') + 'x\n',
      '.claude/settings.json': settings,
      'accord/config.yml': CONFIG + 'generated:\n  - gen/\n',
      'gen/out.txt': 'g\n',
    };
    const change = { 'src/a.ts': 'a2\n', 'src/ws.ts': 'x   =   1;   \r\n\r\n\r\n' };
    const widen = { 'accord/tickets/S-1.md': widened, 'src/b.ts': 'b2\n' };
    writeFiles(repo, { ...change, ...widen, ...generated });
    const T = 'refs/heads/t/S-1';
    const made = importCommits(repo, [
      { name: 'ready', ref: T, from: root, message: 'ready: S-1', files: { 'accord/tickets/S-1.md': ready } },
      { name: 'main', ref: 'refs/heads/main', from: root, message: 'main moves', files: { 'src/main.ts': 'm\n' } },
      { name: 'change', ref: T, from: 'ready', message: 'change', files: change },
      { name: 'widen', ref: T, from: 'change', message: 'widen', files: widen },
      { name: 'generated', ref: T, from: 'widen', message: 'generated and synced', files: generated },
    ]);
    const R = made.ready;

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
    const edited = JSON.stringify({ ...JSON.parse(settings), y: 2 }, null, 2) + '\n';
    writeFiles(repo, { '.claude/settings.json': edited });
    importCommits(repo, [{ name: 'hand', ref: T, from: made.generated, message: 'hand edit', files: { '.claude/settings.json': edited } }]);
    const e = errs((await run(['gate', 'done', 'S-1', '--json'], repo)).out, 'gate.out-of-scope');
    expect(e).toHaveLength(5);
    expect(e.filter((r) => r.startsWith('.claude/settings.json '))).toHaveLength(1);

    // Lane work committed on the default branch diffs empty. The index is brought up to the branch first, as `add -A` did.
    gitRun(repo, 'reset', '-q');
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
  const base = {
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
  };
  const repo = repoWith(base);
  try {
    const T = 'refs/heads/t/T-1';
    const work = {
      'bin/blob.dat': 'a\0c\n',
      'src/plus.ts': 'p\n++ x.' + 'option(' + "'--y')\n",
      'accord/tickets/T-1.md': base['accord/tickets/T-1.md'] + '\n<!-- worked -->\n',
      'src/cli.ts': 'const p = 1;\n' + OPT + CMD,
      'src/é.ts': OPT,
      'src/a b.ts': OPT,
      'pkg/package.json': PKG_HEAD,
      'schemas/thing.json': '{}\n',
      'docs/how.md': 'x\n' + OPT,
    };
    writeFiles(repo, work);
    rmSync(join(repo, 'src', 'gone.ts'));
    const made = importCommits(repo, [
      { name: 'base', ref: 'refs/heads/main', message: 'base', files: base, also: [T] },
      { name: 'work', ref: T, from: 'base', message: 'work', files: { ...work, 'src/gone.ts': null } },
      // A mode-only change and a regular file turned into a symlink (mode 120000, the same bytes `update-index --cacheinfo` takes).
      { name: 'mode', ref: T, from: 'work', message: 'mode and type', files: { 'src/run.sh': { mode: '100755', text: 'echo\n' }, 'src/lnk.ts': { mode: '120000', text: 'target\n' } } },
    ]);
    checkedOut(repo, T);

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

    const review = '## Round 1\n\nNot an interface: `src/a b.ts` — test harness only\n\nverdict: converged\n';
    writeFiles(repo, { 'accord/tickets/T-1/review.md': review });
    importCommits(repo, [{ name: 'reason', ref: T, from: made.mode, message: 'reason', files: { 'accord/tickets/T-1/review.md': review } }]);
    const after = errs((await run(['gate', 'done', 'T-1', '--json'], repo)).out, 'gate.interface-sign').join('\n');
    expect(after).not.toContain('src/a b.ts');
    expect(after).toContain('src/cli.ts');

    expect(unquoteGitPath('"a\\tb\\"c\\303\\251.ts"')).toBe('a\tb"cé.ts');
    expect(unquoteGitPath('plain/é.ts')).toBe('plain/é.ts');
  } finally {
    cleanup(repo);
  }
}, 120_000);

/** An old accord-architect render, intact: the marker holds the hash of the text around it. */
function rendered(): string {
  const head = '---\nname: "accord-architect"\ntools: "Read, Grep, Glob"\nmodel: "opus"\neffort: "high"\n---\n';
  const body = '\nYou propose how a ticket could be built, lightest first.\n';
  return head + '<!-- generated by accord skills sync - do not edit - ' + contentHash(head + body) + ' -->\n' + body;
}

it('risk:data-loss a deleted retired agent file is exempt from the scope gates only when its merge-base copy shows no edit', () => {
  for (const [text, exempt] of [[rendered(), true], [rendered() + 'a hand edit\n', false]] as const) {
    const base = {
      'accord/config.yml': CONFIG,
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
      'src/a.ts': 'a\n',
      '.claude/agents/accord-architect.md': text,
    };
    const repo = repoWith(base);
    try {
      const T = 'refs/heads/t/S-1';
      importCommits(repo, [
        { name: 'base', ref: 'refs/heads/main', message: 'base', files: base, also: [T] },
        { name: 'gone', ref: T, from: 'base', message: 'gone', files: { 'src/a.ts': 'a2\n', '.claude/agents/accord-architect.md': null } },
      ]);
      checkedOut(repo, T);
      const f = gitBranchFact(repo, 'S-1', { rendered: [], scope: false });
      if ('error' in f) throw new Error(f.error);
      expect(f.changes.find((c) => c.path === '.claude/agents/accord-architect.md')?.kind).toBe('deleted');
      expect(f.synced.includes('.claude/agents/accord-architect.md')).toBe(exempt);
    } finally {
      cleanup(repo);
    }
  }
}, 120_000);
