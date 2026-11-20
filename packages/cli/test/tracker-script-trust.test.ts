// Owner decision (2026-11-15), repository scripts trust: `tracker.command` is repository content that `accord status` runs with the user's whole environment on any
// checkout, a pull request branch included. It is not run until the person allows it once with `accord trust`, a record kept inside .git (never committed, shared by
// every worktree) and bound to the command text and to the files the command can reach; a branch that changes only the script file, with the command text
// unchanged, is not run again until the person allows it again. Built-in adapters are unaffected. The sandboxes are removed with no retry loop; the marker the
// script writes lives in a folder of its own, outside the repository.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cover, inspect, reach, revokeScripts, scriptDigest } from '../src/load/script-trust.js';
import { commitAll, gitRun, makeRepo, run, trustAllow } from './helpers/repo.js';

/** Round 5 WR-04: when `code` is set, creating the trust record lock fails with it; past 20 000 tries it fails with ESPUN, so a loop that never gives up ends the test. */
const lockFail = vi.hoisted(() => ({ code: undefined as string | undefined, calls: 0 }));
vi.mock('node:fs', async (orig) => {
  const fs = await orig<typeof import('node:fs')>();
  const openSync = (...a: Parameters<typeof fs.openSync>): number => {
    if (lockFail.code === undefined || !String(a[0]).endsWith('.lock')) return fs.openSync(...a);
    lockFail.calls += 1;
    const code = lockFail.calls > 20_000 ? 'ESPUN' : lockFail.code;
    throw Object.assign(new Error(`${code}: operation not permitted, open '${String(a[0])}'`), { code });
  };
  return { ...fs, openSync, default: { ...fs, openSync } };
});

const posix = (p: string): string => p.replaceAll('\\', '/');

const ticket = (id: string): string => `---
id: ${id}
title: ${id} fixture
type: story
status: open
tracker:
  script: "ENG-1"
---

## Intent
Added by the tracker script trust sandbox.

## Requirements
- WHEN a case needs this ticket the system SHALL render one row

## Acceptance criteria
\`\`\`gherkin
Feature: ${id}

  @ac-1
  Scenario: One row
    When status runs
    Then the row appears
\`\`\`

## Open questions
- [x] None.

## Plan
- [x] Done
`;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

/** A script that records which content ran, by the text it appends to the marker named in its environment, and answers with no issues. */
const body = (tag: string): string => `import { appendFileSync } from 'node:fs';
appendFileSync(process.env.TRUST_MARKER, '${tag}\\n');
process.stdout.write(JSON.stringify({ version: 1, issues: {} }));
`;

const setCommand = (repo: string, cmd: string | undefined): void => {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8').replace(
    /tracker:\n {2}adapter: [\w-]+(\n {2}command: .+)?/,
    'tracker:\n  adapter: script' + (cmd === undefined ? '' : '\n  command: ' + JSON.stringify(cmd)),
  );
  writeFileSync(file, text);
};

interface Box {
  repo: string;
  env: NodeJS.ProcessEnv;
  marker: string;
  ran(): string[];
  /** Rewrite one file of the repository and commit it. */
  commit(path: string, text: string): void;
}

/** A repository on `main` whose script is the committed file `scripts/tracker.mjs` and whose command is `node scripts/tracker.mjs`; HEAD is on `main` unless `branch` is given. */
function sandbox(command: string | undefined = 'node scripts/tracker.mjs'): Box {
  const folder = mkdtempSync(join(tmpdir(), 'accord-script-trust-'));
  dirs.push(folder);
  const repo = makeRepo('valid-build');
  dirs.push(repo);
  writeFileSync(join(repo, 'accord', 'tickets', 'ISS-7.md'), ticket('ISS-7'));
  mkdirSync(join(repo, 'scripts'));
  writeFileSync(join(repo, 'scripts', 'tracker.mjs'), body('ran A'));
  writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const x = 1;\n');
  writeFileSync(join(repo, 'README.md'), 'readme\n');
  setCommand(repo, command);
  commitAll(repo, 'default branch');
  gitRun(repo, 'branch', '-M', 'main');
  const marker = posix(join(folder, 'marker.txt'));
  return {
    repo,
    env: { ...process.env, TRUST_MARKER: marker },
    marker,
    ran: () => (existsSync(marker) ? readFileSync(marker, 'utf8').split('\n').filter((l) => l !== '') : []),
    commit: (path, text) => {
      mkdirSync(resolve(join(repo, ...path.split('/')), '..'), { recursive: true });
      writeFileSync(join(repo, ...path.split('/')), text);
      commitAll(repo, 'change ' + path);
    },
  };
}

describe('accord status runs a repository tracker command only when accord trust allowed it', () => {
  it('risk:security the command is not run until it is allowed, the status says how, and accord trust allows it', async () => {
    const b = sandbox();
    const before = await run(['status'], b.repo, b.env);
    expect(before.code).toBe(0);
    expect(b.ran()).toEqual([]);
    expect(before.err).toMatch(/^tracker script: .*node scripts\/tracker\.mjs.*accord trust/);
    expect(before.err.trim().split('\n')).toHaveLength(1);

    const allowed = await trustAllow(b.repo, ['tracker.command'], b.env);
    expect(allowed.code).toBe(0);
    expect(allowed.out).toMatch(/^allowed: tracker\.command "node scripts\/tracker\.mjs"/m);
    const after = await run(['status'], b.repo, b.env);
    expect(after.err).toBe('');
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security a branch that changes only the script file, the command text unchanged, is not run until it is allowed again', async () => {
    const b = sandbox();
    expect((await trustAllow(b.repo, ['tracker.command'], b.env)).code).toBe(0);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/tracker.mjs', body('ran B'));
    const refused = await run(['status'], b.repo, b.env);
    expect(refused.code).toBe(0);
    expect(b.ran()).toEqual([]);
    expect(refused.err).toMatch(/^tracker script: .*node scripts\/tracker\.mjs.*changed.*accord trust/);
    expect(refused.err.trim().split('\n')).toHaveLength(1);
    // an uncommitted edit of the script is the same: it is what would run
    writeFileSync(join(b.repo, 'scripts', 'tracker.mjs'), body('ran C'));
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual([]);

    expect((await trustAllow(b.repo, ['tracker.command'], b.env)).code).toBe(0);
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran C']);
    // the branch's committed script B was never allowed, and still is not
    gitRun(b.repo, 'checkout', '-q', '--', 'scripts/tracker.mjs');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran C']);
    // main's script A was allowed first, and that allow is kept beside the newer one (round 3 WR-03: allows are kept per binding, not one slot per script)
    gitRun(b.repo, 'switch', '-q', 'main');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran C', 'ran A']);
  });

  // the pull request case itself: the default branch names this very command, so a pin on the command text passes, and only the script file differs
  it('risk:security a pull request branch that edits only the script the default branch names is not run by a reviewer who never allowed anything', async () => {
    const b = sandbox();
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/tracker.mjs', body('ran B'));
    const r = await run(['status'], b.repo, b.env);
    expect(r.code).toBe(0);
    expect(b.ran()).toEqual([]);
    expect(r.err).toMatch(/^tracker script: .*node scripts\/tracker\.mjs.*accord trust/);
  });

  it('risk:security a file next to the script the command names counts as well (the script imports its neighbours)', async () => {
    const b = sandbox();
    await trustAllow(b.repo, ['tracker.command'], b.env);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/lib.mjs', 'export const x = 2;\n');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual([]);
  });

  it('risk:regression a change to a ticket or to a file the command does not reach does not ask again', async () => {
    const b = sandbox();
    await trustAllow(b.repo, ['tracker.command'], b.env);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('README.md', 'edited\n');
    b.commit('accord/tickets/ISS-7.md', ticket('ISS-7').replace('fixture', 'edited'));
    const r = await run(['status'], b.repo, b.env);
    expect(r.err).toBe('');
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security the allow lives inside .git, is never committed, and is shared by every worktree of the repository', async () => {
    const b = sandbox();
    expect((await trustAllow(b.repo, ['tracker.command'], b.env)).code).toBe(0);
    expect(gitRun(b.repo, 'status', '--porcelain').trim()).toBe('');
    const common = resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim());
    expect(readFileSync(join(common, 'accord-trust.json'), 'utf8')).toContain('node scripts/tracker.mjs');
    const wt = join(mkdtempSync(join(tmpdir(), 'accord-script-trust-wt-')), 'sibling');
    dirs.push(resolve(wt, '..'));
    gitRun(b.repo, 'worktree', 'add', '-q', '-b', 'other', wt);
    const r = await run(['status'], wt, b.env);
    expect(r.err).toBe('');
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security a command that names no file of the repository is bound to the manifests an interpreter or task runner reads from the root', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'accord-script-outside-'));
    dirs.push(outside);
    const script = posix(join(outside, 'tracker.mjs'));
    writeFileSync(script, body('ran A'));
    const b = sandbox(`node "${script}"`);
    b.commit('package.json', '{ "name": "x", "scripts": {} }\n');
    await trustAllow(b.repo, ['tracker.command'], b.env);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('README.md', 'edited\n');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran A']);
    b.commit('package.json', '{ "name": "x", "scripts": { "pretest": "evil" } }\n');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security trust --revoke withdraws the allow, and says so when there is none', async () => {
    const b = sandbox();
    await trustAllow(b.repo, ['tracker.command'], b.env);
    const revoked = await run(['trust', '--revoke'], b.repo, b.env);
    expect(revoked.code).toBe(0);
    expect(revoked.out).toMatch(/^revoked: tracker\.command/m);
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual([]);
    const none = await run(['trust', '--revoke'], b.repo, b.env);
    expect(none.code).toBe(0);
    expect(none.out).toMatch(/nothing was allowed/);
  });

  it('risk:regression accord trust with no repository script says there is nothing to allow and writes nothing', async () => {
    const b = sandbox();
    setCommand(b.repo, undefined);
    writeFileSync(join(b.repo, 'accord', 'config.yml'), readFileSync(join(b.repo, 'accord', 'config.yml'), 'utf8').replace('adapter: script', 'adapter: none'));
    const r = await run(['trust'], b.repo, b.env);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/nothing to allow/);
    const common = resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim());
    expect(existsSync(join(common, 'accord-trust.json'))).toBe(false);
  });

  it('risk:regression the default branch no longer decides: a command only this branch holds runs once the person allowed it', async () => {
    const b = sandbox();
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/tracker.mjs', body('ran B'));
    await trustAllow(b.repo, ['tracker.command'], b.env);
    const r = await run(['status'], b.repo, b.env);
    expect(r.err).toBe('');
    expect(b.ran()).toEqual(['ran B']);
  });
});

// ---- round 3 review CR-01, owner answer (direnv-like): the allow binds what the command runs, not only the words it names ----

/** The same script as `body`, in CommonJS, for a file Node loads with require (an extensionless `node scripts/tracker` finds `scripts/tracker.js`). */
const cjs = (tag: string): string => `const { appendFileSync } = require('node:fs');
appendFileSync(process.env.TRUST_MARKER, '${tag}\\n');
process.stdout.write(JSON.stringify({ version: 1, issues: {} }));
`;

/** The person's `accord trust` for the tracker script. */
const allowTracker = async (b: Box): Promise<{ code: number; out: string; err: string }> => trustAllow(b.repo, ['tracker.command'], b.env);

/** Allow on main and check that it ran there, then commit `path` = `text` on a branch `pr` and run status there; returns its stderr. */
async function editedOnBranch(b: Box, path: string, text: string): Promise<string> {
  expect((await allowTracker(b)).code).toBe(0);
  await run(['status'], b.repo, b.env);
  expect(b.ran()).toEqual(['ran A']);
  gitRun(b.repo, 'switch', '-q', '-c', 'pr');
  b.commit(path, text);
  const r = await run(['status'], b.repo, b.env);
  expect(r.code).toBe(0);
  return r.err;
}

describe('the allow covers the files the command runs through npm run, Node resolution and the script directory (round 3 CR-01)', () => {
  it('risk:security npm run <name> binds the package.json script and the files it names, so a branch that edits only that script is not run', async () => {
    const b = sandbox('npm run --silent tracker');
    b.commit('package.json', JSON.stringify({ name: 'x', private: true, scripts: { tracker: 'node scripts/tracker.mjs' } }) + '\n');
    const err = await editedOnBranch(b, 'scripts/tracker.mjs', body('ran B'));
    expect(b.ran()).toEqual(['ran A']);
    expect(err).toMatch(/^tracker script: .*npm run --silent tracker.*changed.*accord trust/);
  });

  it('risk:security an extensionless node scripts/x resolves like Node (scripts/x.js), so a branch that edits scripts/x.js is not run', async () => {
    const b = sandbox('node scripts/tracker');
    b.commit('scripts/tracker.js', cjs('ran A'));
    const err = await editedOnBranch(b, 'scripts/tracker.js', cjs('ran B'));
    expect(b.ran()).toEqual(['ran A']);
    expect(err).toMatch(/changed/);
  });

  it('risk:security node . runs the main of package.json, so a branch that edits that file is not run', async () => {
    const b = sandbox('node .');
    b.commit('scripts/tracker.cjs', cjs('ran A'));
    b.commit('package.json', JSON.stringify({ name: 'x', private: true, main: 'scripts/tracker.cjs' }) + '\n');
    await editedOnBranch(b, 'scripts/tracker.cjs', cjs('ran B'));
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security a script at the repository root binds its whole directory recursively, so a branch that edits a file it imports from a subfolder is not run', async () => {
    const b = sandbox('node tracker.mjs');
    b.commit('lib/impl.mjs', `import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.TRUST_MARKER, 'ran A\\n');\n`);
    b.commit('tracker.mjs', `import './lib/impl.mjs';\nprocess.stdout.write(JSON.stringify({ version: 1, issues: {} }));\n`);
    await editedOnBranch(b, 'lib/impl.mjs', `import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.TRUST_MARKER, 'ran B\\n');\n`);
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security a script directory is bound recursively, so a branch that edits a file in a subfolder of it is not run', async () => {
    const b = sandbox();
    b.commit('scripts/deep/helper.mjs', 'export const y = 1;\n');
    await editedOnBranch(b, 'scripts/deep/helper.mjs', 'export const y = 2;\n');
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security accord trust and the refusal both name exactly what the allow covers', async () => {
    const b = sandbox();
    const refused = await run(['status'], b.repo, b.env);
    expect(refused.err).toMatch(/covers:? scripts\/ \(2 files\)/);
    const allowed = await allowTracker(b);
    expect(allowed.out).toMatch(/covers:? scripts\/ \(2 files\)/);
  });
});

describe('the command text is printed with its control characters escaped (round 3 WR-01)', () => {
  it('risk:security a command that hides its start behind ESC, C1 or bidi controls shows them escaped in the status refusal and in accord trust', async () => {
    const E = String.fromCharCode(27);
    const hidden = `node -e "1" # ${E}[2K${E}[1G\u009b2K\u202enode scripts/tracker.mjs`;
    const b = sandbox();
    // YAML takes a C1 or bidi control only as an escape, so the value is written with \u escapes for every non-ASCII character
    const file = join(b.repo, 'accord', 'config.yml');
    const escaped = JSON.stringify(hidden).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    writeFileSync(file, readFileSync(file, 'utf8').replace(/command: .*/, 'command: ' + escaped));
    const refused = await run(['status'], b.repo, b.env);
    expect(refused.code).toBe(0);
    expect(refused.err).toMatch(/^tracker script: /);
    for (const c of [E, '\u009b', '\u202e']) expect(refused.err).not.toContain(c);
    expect(refused.err).toContain('<U+001B>[2K<U+001B>[1G<U+009B>2K<U+202E>node scripts/tracker.mjs');
    const allowed = await allowTracker(b);
    for (const c of [E, '\u009b', '\u202e']) expect(allowed.out).not.toContain(c);
    expect(allowed.out).toContain('<U+001B>[2K');
  });
});

/** Declare `git.sync` as well, committed on the current branch: a script in scripts/ that only records its tag. */
function withSync(b: Box): void {
  const file = join(b.repo, 'accord', 'config.yml');
  writeFileSync(file, readFileSync(file, 'utf8') + 'git:\n  sync: "node scripts/sync.mjs"\n');
  b.commit('scripts/sync.mjs', "import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.TRUST_MARKER, 'sync A\\n');\n");
}

describe('accord trust shows each script before it allows it, and allows only the scripts named (round 3 WR-02)', () => {
  it('risk:security accord trust with no script named shows each declared script and what it covers, and allows nothing', async () => {
    const b = sandbox();
    withSync(b);
    const shown = await run(['trust'], b.repo, b.env);
    expect(shown.code).toBe(0);
    expect(shown.out).toMatch(/^tracker\.command "node scripts\/tracker\.mjs"/m);
    expect(shown.out).toMatch(/^git\.sync "node scripts\/sync\.mjs"/m);
    expect(shown.out).toMatch(/covers: scripts\/ \(3 files\)/);
    expect(shown.out).toMatch(/accord trust tracker\.command@[0-9a-f]{16} git\.sync@[0-9a-f]{16}/);
    expect(shown.out).not.toMatch(/^allowed:/m);
    const r = await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual([]);
    expect(r.err).toMatch(/^tracker script: /);
  });

  it('risk:security accord trust git.sync allows git.sync only, so a changed tracker script the person was not shown stays refused', async () => {
    const b = sandbox();
    withSync(b);
    expect((await trustAllow(b.repo, ['tracker.command', 'git.sync'], b.env)).code).toBe(0);
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran A']);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/sync.mjs', "import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.TRUST_MARKER, 'sync B\\n');\n");
    b.commit('scripts/tracker.mjs', body('ran B'));
    const synced = await trustAllow(b.repo, ['git.sync'], b.env);
    expect(synced.code).toBe(0);
    expect(synced.out).toMatch(/^allowed: git\.sync "node scripts\/sync\.mjs"/m);
    expect(synced.out).not.toMatch(/tracker\.command/);
    expect(synced.out).toMatch(/changed since it was allowed: scripts\/sync\.mjs, scripts\/tracker\.mjs/);
    const r = await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran A']);
    expect(r.err).toMatch(/^tracker script: .*changed: scripts\/sync\.mjs, scripts\/tracker\.mjs/);
  });

  it('risk:security the preview and the refusal name the files that changed since the script was allowed', async () => {
    const b = sandbox();
    expect((await trustAllow(b.repo, ['tracker.command'], b.env)).code).toBe(0);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/lib.mjs', 'export const x = 2;\n');
    const shown = await run(['trust'], b.repo, b.env);
    expect(shown.out).toMatch(/^tracker\.command "node scripts\/tracker\.mjs" - changed since it was allowed \(digest [0-9a-f]{16}\)$/m);
    expect(shown.out).toMatch(/changed since it was allowed: scripts\/lib\.mjs$/m);
    const r = await run(['status'], b.repo, b.env);
    expect(r.err).toMatch(/\(changed: scripts\/lib\.mjs\)/);
  });

  it('risk:regression accord trust refuses a script name it does not know, or one accord/config.yml does not declare, with exit 2 and writes nothing', async () => {
    const b = sandbox();
    const unknown = await run(['trust', 'setup'], b.repo, b.env);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toMatch(/tracker\.command, git\.sync, build\.regenerate or commits\.message\.command/);
    const undeclared = await run(['trust', 'git.sync'], b.repo, b.env);
    expect(undeclared.code).toBe(2);
    expect(undeclared.err).toMatch(/declares no git\.sync/);
    const common = resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim());
    expect(existsSync(join(common, 'accord-trust.json'))).toBe(false);
  });
});

/** A pattern for `"<a path ending in dir's own folder name>"`, which the refusal prints however the system spells the folders above it. */
const quotedDir = (dir: string): string => `"[^"]*${(dir.replaceAll('\\', '/').split('/').pop() ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;

describe('parallel worktrees keep their own allows, and the refusal says where to run accord trust (round 3 WR-03)', () => {
  it('risk:security an allow made in a second worktree with other script content does not cancel the allow of the first', async () => {
    const b = sandbox();
    expect((await trustAllow(b.repo, ['tracker.command'], b.env)).code).toBe(0);
    const wt = join(mkdtempSync(join(tmpdir(), 'accord-script-trust-wt-')), 'sibling');
    dirs.push(resolve(wt, '..'));
    gitRun(b.repo, 'worktree', 'add', '-q', '-b', 'other', wt);
    writeFileSync(join(wt, 'scripts', 'lib.mjs'), 'export const x = 2;\n');
    commitAll(wt, 'other edits a file the script reaches');
    expect((await trustAllow(wt, ['tracker.command'], b.env)).code).toBe(0);
    const there = await run(['status'], wt, b.env);
    expect(there.err).toBe('');
    const here = await run(['status'], b.repo, b.env);
    expect(here.err).toBe('');
    expect(b.ran()).toEqual(['ran A', 'ran A']);
  });

  it('risk:security the refusal names the checkout to run accord trust in', async () => {
    const b = sandbox();
    const r = await run(['status'], b.repo, b.env);
    expect(r.err).toMatch(new RegExp(`run accord trust in ${quotedDir(b.repo)} to see it, then accord trust tracker\\.command@<the digest it shows> there to allow it`));
  });
});

describe('reach: the tracked files a command can run (round 3 CR-01)', () => {
  const tracked = ['README.md', 'accord/config.yml', 'accord/tickets/ST-1.md', 'lib/impl.mjs', 'package.json', 'scripts/deep/helper.mjs', 'scripts/sync.cmd', 'scripts/tracker.mjs', 'tools/run.py', 'tracker.mjs'];
  const dir = (pkg?: object): string => {
    const d = mkdtempSync(join(tmpdir(), 'accord-reach-'));
    dirs.push(d);
    if (pkg !== undefined) writeFileSync(join(d, 'package.json'), JSON.stringify(pkg));
    return d;
  };

  it('risk:security a path that differs from the tracked one only in case is matched, so a differently-cased path cannot escape the digest on Windows', () => {
    expect(reach(dir(), 'node Scripts/Tracker.MJS', tracked)).toEqual(['scripts/deep/helper.mjs', 'scripts/sync.cmd', 'scripts/tracker.mjs']);
  });

  it('risk:security an extensionless word resolves to the tracked file with a script extension (PATHEXT .cmd, .py and the Node extensions)', () => {
    expect(reach(dir(), 'cmd /c scripts\\sync', tracked)).toContain('scripts/sync.cmd');
    expect(reach(dir(), 'python tools/run', tracked)).toEqual(['tools/run.py']);
  });

  it('risk:security pnpm run, yarn run, a bare yarn <name> and npm run-script resolve to the package.json script, its pre script, and the files they name', () => {
    const d = dir({ scripts: { tracker: 'python tools/run.py', pretracker: 'node lib/impl.mjs' } });
    for (const cmd of ['pnpm run tracker', 'yarn run tracker', 'npm run-script tracker']) {
      expect(reach(d, cmd, tracked).filter((f) => f !== 'package.json'), cmd).toEqual(['lib/impl.mjs', 'tools/run.py']);
      expect(reach(d, cmd, tracked), cmd).toContain('package.json');
    }
    // a bare name is also tried as a path, so here it binds the root tracker.mjs (and with it ./) as well: over-binding asks more, never less
    expect(reach(d, 'yarn tracker', tracked)).toEqual(expect.arrayContaining(['lib/impl.mjs', 'package.json', 'tools/run.py']));
  });

  it('risk:security a script at the repository root reaches every tracked file outside accord/', () => {
    expect(reach(dir(), 'node tracker.mjs', tracked)).toEqual(tracked.filter((f) => !f.startsWith('accord/')));
  });
});

// ---- round 4 review: real bugs inside the promised cover (owner answer, round 4) ----

describe('the cover matches every path component without regard to case (round 4 WR-01)', () => {
  it('risk:security an index entry whose directory differs from the named file only in case (Scripts/lib.mjs beside scripts/tracker.mjs) is in the cover', () => {
    const d = mkdtempSync(join(tmpdir(), 'accord-reach-'));
    dirs.push(d);
    const tracked = ['ACCORD/config.yml', 'README.md', 'Scripts/lib.mjs', 'scripts/tracker.mjs'];
    expect(reach(d, 'node scripts/tracker.mjs', tracked)).toEqual(['Scripts/lib.mjs', 'scripts/tracker.mjs']);
    // a root script binds every tracked file outside accord/, whatever the case of that folder's name
    expect(reach(d, 'node tracker.mjs', [...tracked, 'tracker.mjs'])).toEqual(['README.md', 'Scripts/lib.mjs', 'scripts/tracker.mjs', 'tracker.mjs']);
  });

  it('risk:security accord trust lists and counts the mixed-case index entry Scripts/lib.mjs in the cover of scripts/tracker.mjs', async () => {
    const b = sandbox();
    // the index holds Scripts/lib.mjs as a second entry; on a case-insensitive system both entries check out into the one folder
    const blob = gitRun(b.repo, 'rev-parse', 'HEAD:scripts/lib.mjs').trim();
    gitRun(b.repo, 'update-index', '--add', '--cacheinfo', `100644,${blob},Scripts/lib.mjs`);
    gitRun(b.repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'mixed case entry');
    gitRun(b.repo, 'reset', '-q', '--hard');
    const shown = await run(['trust'], b.repo, b.env);
    expect(shown.out).toMatch(/files: .*Scripts\/lib\.mjs/);
    expect(shown.out).toMatch(/covers: scripts\/ \(3 files\)/);
  });
});

describe('a covered entry that is not a regular file still moves the digest when it changes (round 4 WR-02)', () => {
  const commitIndex = (repo: string, message: string): void =>
    void gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', message);

  it('risk:security a submodule (gitlink) inside a covered directory bumped to another commit changes the digest', () => {
    const b = sandbox();
    const first = gitRun(b.repo, 'rev-parse', 'HEAD').trim();
    b.commit('README.md', 'second\n');
    const second = gitRun(b.repo, 'rev-parse', 'HEAD').trim();
    // an uninitialised submodule: the gitlink in the index, an empty folder in the working tree
    mkdirSync(join(b.repo, 'scripts', 'sub'));
    gitRun(b.repo, 'update-index', '--add', '--cacheinfo', `160000,${first},scripts/sub`);
    commitIndex(b.repo, 'add the submodule');
    const was = scriptDigest(b.repo, 'node scripts/tracker.mjs');
    expect(was.files).toContain('scripts/sub');
    gitRun(b.repo, 'update-index', '--cacheinfo', `160000,${second},scripts/sub`);
    commitIndex(b.repo, 'bump the submodule');
    expect(scriptDigest(b.repo, 'node scripts/tracker.mjs').digest).not.toBe(was.digest);
  });

  it.skipIf(process.platform === 'win32')('risk:security a directory symlink inside a covered directory retargeted elsewhere changes the digest', () => {
    const b = sandbox();
    b.commit('shared/x.mjs', 'export const x = 1;\n');
    b.commit('evil/x.mjs', 'export const x = 2;\n');
    symlinkSync('../shared', join(b.repo, 'scripts', 'lib'));
    commitAll(b.repo, 'link');
    const was = scriptDigest(b.repo, 'node scripts/tracker.mjs').digest;
    rmSync(join(b.repo, 'scripts', 'lib'));
    symlinkSync('../evil', join(b.repo, 'scripts', 'lib'));
    expect(scriptDigest(b.repo, 'node scripts/tracker.mjs').digest).not.toBe(was);
    commitAll(b.repo, 'retarget');
    expect(scriptDigest(b.repo, 'node scripts/tracker.mjs').digest).not.toBe(was);
  });
});

describe('a check hashes only what it needs, and an argument word does not widen the cover to the whole tree (round 4 WR-06)', () => {
  it('risk:regression the refusal reads the allows first: with no allow of the command it computes the cover and no digest', async () => {
    const b = sandbox();
    expect(inspect(b.repo, 'tracker.command', 'node scripts/tracker.mjs', 'if-allowed')).toMatchObject({ state: 'never', digest: undefined, units: ['scripts/'] });
    expect(inspect(b.repo, 'tracker.command', 'node scripts/tracker.mjs', 'always').digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('risk:regression an argument word that matches a root file only once an extension is added (main -> main.py) does not bind every tracked file', () => {
    const d = mkdtempSync(join(tmpdir(), 'accord-reach-'));
    dirs.push(d);
    const tracked = ['README.md', 'build.sh', 'main.py', 'origin.js', 'scripts/tracker.mjs', 'src/app.ts', 'tracker.mjs'];
    expect(reach(d, 'node scripts/tracker.mjs --since main', tracked)).toEqual(['scripts/tracker.mjs']);
    expect(reach(d, 'git pull --rebase origin main && node scripts/tracker.mjs build', tracked)).toEqual(['scripts/tracker.mjs']);
    // the script itself, named without its extension in script position, still binds the whole tree outside accord/
    expect(reach(d, 'node tracker', tracked)).toEqual(tracked);
    expect(reach(d, 'env A=1 node --no-warnings tracker', tracked)).toEqual(tracked);
    expect(reach(d, 'build', tracked)).toEqual(tracked);
  });
});

/** The built CLI, spawned where a test needs a second process running beside it. */
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

describe('the trust record is written under a lock, merged into what is on disk, and read without crashing on a bad entry (round 4 IN-01)', () => {
  it('risk:regression an allow waits while another writer holds the record lock, then merges into the record as that writer left it', async () => {
    const b = sandbox();
    const record = join(resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim()), 'accord-trust.json');
    writeFileSync(record + '.lock', String(process.pid));
    const digest = shownDigest((await run(['trust'], b.repo, b.env)).out, 'tracker.command') ?? '';
    const child = spawn(process.execPath, [cli, 'trust', 'tracker.command@' + digest], { cwd: b.repo, env: b.env, stdio: 'ignore' });
    const exited = new Promise<number>((done) => child.on('exit', (code) => done(code ?? -1)));
    await new Promise((done) => setTimeout(done, 2000));
    expect(existsSync(record)).toBe(false);
    // the other writer, holding the lock, recorded an allow of git.sync
    const other = { kind: 'git.sync', command: 'node scripts/sync.mjs', digest: 'sha256:' + '0'.repeat(64), allowedAt: '2026-11-16T00:00:00.000Z' };
    writeFileSync(record, JSON.stringify({ version: 2, allows: [other] }));
    rmSync(record + '.lock');
    expect(await exited).toBe(0);
    const kinds = (JSON.parse(readFileSync(record, 'utf8')) as { allows: Array<{ kind: string }> }).allows.map((a) => a.kind);
    expect(kinds.sort()).toEqual(['git.sync', 'tracker.command']);
  }, 60_000);

  it('risk:regression an allow whose files is not a map of strings is ignored with a warning, and status does not crash', async () => {
    const b = sandbox();
    expect((await trustAllow(b.repo, ['tracker.command'], b.env)).code).toBe(0);
    const record = join(resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim()), 'accord-trust.json');
    const text = JSON.parse(readFileSync(record, 'utf8')) as { allows: Array<Record<string, unknown>> };
    text.allows[0].files = null;
    writeFileSync(record, JSON.stringify(text));
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/lib.mjs', 'export const x = 2;\n');
    const r = await run(['status'], b.repo, b.env);
    expect(r.code).toBe(0);
    expect(b.ran()).toEqual([]);
    expect(r.err).toMatch(/accord-trust\.json.*1 entry .*ignored/);
    expect(r.err).toMatch(/^tracker script: .*has not been allowed/m);
  });
});

/** The short digest `accord trust` shows on the head line of `kind`. */
const shownDigest = (out: string, kind: string): string | undefined => new RegExp(`^${kind.replace('.', '\\.')} ".*\\(digest ([0-9a-f]{16})\\)$`, 'm').exec(out)?.[1];

describe('accord trust allows only the content the person was shown (round 4 WR-04)', () => {
  it('risk:security accord trust shows a digest per script, and <script>@<digest> refuses with nothing written when the files changed since it was shown', async () => {
    const b = sandbox();
    const shown = await run(['trust'], b.repo, b.env);
    const digest = shownDigest(shown.out, 'tracker.command');
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
    expect(shown.out).toMatch(new RegExp(`accord trust tracker\\.command@${digest ?? ''}`));
    // between show and allow, something else (an agent in the worktree, a pull) changes a covered file
    writeFileSync(join(b.repo, 'scripts', 'lib.mjs'), 'export const x = 3;\n');
    const stale = await run(['trust', `tracker.command@${digest ?? ''}`], b.repo, b.env);
    expect(stale.code).toBe(2);
    expect(stale.err).toMatch(/changed since accord trust showed it.*nothing was allowed/);
    const common = resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim());
    expect(existsSync(join(common, 'accord-trust.json'))).toBe(false);
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual([]);
    // shown again, then allowed with the digest shown: it runs
    const again = shownDigest((await run(['trust'], b.repo, b.env)).out, 'tracker.command');
    expect(again).not.toBe(digest);
    const allowed = await run(['trust', `tracker.command@${again ?? ''}`], b.repo, b.env);
    expect(allowed.code).toBe(0);
    expect(allowed.out).toMatch(new RegExp(`^allowed: tracker\\.command "node scripts/tracker\\.mjs" \\(digest ${again ?? ''}\\)$`, 'm'));
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security accord trust <script> with no digest allows nothing and says to copy the digest accord trust shows', async () => {
    const b = sandbox();
    const r = await run(['trust', 'tracker.command'], b.repo, b.env);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/accord trust tracker\.command@<digest>/);
    const common = resolve(b.repo, gitRun(b.repo, 'rev-parse', '--git-common-dir').trim());
    expect(existsSync(join(common, 'accord-trust.json'))).toBe(false);
  });
});

describe('accord trust and the refusal say plainly what is not checked (round 4 CR-01, WR-03, IN-02: documented gaps, owner answer round 4)', () => {
  const GAPS = ['node --run', 'npm -w/--workspace', 'bash -c', 'node -e', 'python -m', 'npm install lifecycle scripts', '.npmrc node-options', 'files outside the listed directories', 'make or just targets', 'paths built from environment variables', 'programs on PATH', 'node_modules'];

  it('risk:security accord trust, shown and allowing, states that only the listed files are checked, names the forms that are not, and says whoever allows must review the PR', async () => {
    const b = sandbox();
    for (const out of [(await run(['trust'], b.repo, b.env)).out, (await trustAllow(b.repo, ['tracker.command'], b.env)).out]) {
      expect(out).toMatch(/accord checks only the files listed above; anything else the command loads is not checked/);
      for (const gap of GAPS) expect(out).toContain(gap);
      expect(out).toMatch(/whoever allows a script must review the pull request that changed it/);
    }
  });

  it('risk:security a command that uses a form accord does not follow says so in accord trust and in the refusal, instead of listing package.json as if complete', async () => {
    const b = sandbox('node --run tracker');
    b.commit('package.json', JSON.stringify({ name: 'x', private: true, scripts: { tracker: 'node scripts/tracker.mjs' } }) + '\n');
    const shown = await run(['trust'], b.repo, b.env);
    expect(shown.out).toMatch(/^ {2}not followed: node --run - the files it runs are not checked$/m);
    const refused = await run(['status'], b.repo, b.env);
    expect(refused.err).toMatch(/an allow covers package\.json only, and no other file the command loads is checked \(not followed here: node --run\)/);
    for (const [cmd, label] of [
      ['npm run tracker -w trk', 'npm -w/--workspace'],
      ['bash -c "node scripts/tracker.mjs"', 'bash -c'],
      ['node -e "require(\'./scripts/tracker.cjs\')"', 'node -e'],
      ['python -m tools.tracker', 'python -m'],
      ['npm install && node scripts/tracker.mjs', 'npm install lifecycle scripts'],
      ['npx trk', 'npx'],
      ['make tracker', 'make or just targets'],
      ['node $ACCORD_ROOT/scripts/tracker.mjs', 'paths built from environment variables'],
    ]) {
      expect(cover(b.repo, cmd).unfollowed, cmd).toContain(label);
    }
    expect(cover(b.repo, 'node scripts/tracker.mjs').unfollowed).toEqual([]);
  });
});

describe('round 5: a Node option value is not the script, and the record lock gives up (round 5 WR-01, WR-04)', () => {
  it('risk:regression a root script named after a Node option that takes a value (--env-file .env, -r dotenv/config) still binds the whole tree outside accord/', () => {
    const d = mkdtempSync(join(tmpdir(), 'accord-reach-'));
    dirs.push(d);
    const tracked = ['README.md', 'main.py', 'scripts/tracker.mjs', 'tracker.js'];
    expect(reach(d, 'node --env-file .env tracker', tracked)).toEqual(tracked);
    expect(reach(d, 'node -r dotenv/config tracker', tracked)).toEqual(tracked);
    expect(reach(d, 'node --import tsx tracker --since main', tracked)).toEqual(tracked);
    expect(reach(d, 'node scripts/tracker.mjs --since main', tracked)).toEqual(['scripts/tracker.mjs']);
  });

  it('risk:regression a lock that cannot be created (EPERM with no lock file) fails within the lock wait instead of retrying forever', () => {
    const b = sandbox();
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    lockFail.code = 'EPERM';
    try {
      expect(() => revokeScripts(b.repo)).toThrow(/^EPERM: operation not permitted, open .*accord-trust\.json\.lock/);
      expect(lockFail.calls).toBeLessThan(100);
    } finally {
      lockFail.code = undefined;
      lockFail.calls = 0;
      clock.mockRestore();
    }
  });
});
