// Owner decision (2026-11-15), repository scripts trust: `tracker.command` is repository content that `accord status` runs with the user's whole environment on any
// checkout, a pull request branch included. It is not run until the person allows it once with `accord trust`, a record kept inside .git (never committed, shared by
// every worktree) and bound to the command text and to the files the command can reach; a branch that changes only the script file, with the command text
// unchanged, is not run again until the person allows it again. Built-in adapters are unaffected. The sandboxes are removed with no retry loop; the marker the
// script writes lives in a folder of its own, outside the repository.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commitAll, gitRun, makeRepo, run } from './helpers/repo.js';

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

    const allowed = await run(['trust'], b.repo, b.env);
    expect(allowed.code).toBe(0);
    expect(allowed.out).toMatch(/^allowed: tracker\.command "node scripts\/tracker\.mjs"/m);
    const after = await run(['status'], b.repo, b.env);
    expect(after.err).toBe('');
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security a branch that changes only the script file, the command text unchanged, is not run until it is allowed again', async () => {
    const b = sandbox();
    expect((await run(['trust'], b.repo, b.env)).code).toBe(0);
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

    expect((await run(['trust'], b.repo, b.env)).code).toBe(0);
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran C']);
    // and main's script is then the one that has changed
    gitRun(b.repo, 'checkout', '-q', '--', 'scripts/tracker.mjs');
    gitRun(b.repo, 'switch', '-q', 'main');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual(['ran C']);
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
    await run(['trust'], b.repo, b.env);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('scripts/lib.mjs', 'export const x = 2;\n');
    await run(['status'], b.repo, b.env);
    expect(b.ran()).toEqual([]);
  });

  it('risk:regression a change to a ticket or to a file the command does not reach does not ask again', async () => {
    const b = sandbox();
    await run(['trust'], b.repo, b.env);
    gitRun(b.repo, 'switch', '-q', '-c', 'pr');
    b.commit('README.md', 'edited\n');
    b.commit('accord/tickets/ISS-7.md', ticket('ISS-7').replace('fixture', 'edited'));
    const r = await run(['status'], b.repo, b.env);
    expect(r.err).toBe('');
    expect(b.ran()).toEqual(['ran A']);
  });

  it('risk:security the allow lives inside .git, is never committed, and is shared by every worktree of the repository', async () => {
    const b = sandbox();
    expect((await run(['trust'], b.repo, b.env)).code).toBe(0);
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
    await run(['trust'], b.repo, b.env);
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
    await run(['trust'], b.repo, b.env);
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
    await run(['trust'], b.repo, b.env);
    const r = await run(['status'], b.repo, b.env);
    expect(r.err).toBe('');
    expect(b.ran()).toEqual(['ran B']);
  });
});
