// WR-03: `accord status` is a read command people run on any checkout, a pull request branch included, so a `tracker.command` that
// only the checked-out branch holds must not run: the script gets the user's whole environment. The command runs only when
// the default branch's accord/config.yml names the same one. The sandboxes are removed with no retry loop; the script's marker file
// lives in a folder of its own, outside the repository.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commitAll, gitRun, makeRepo, run } from './helpers/repo.js';

const posix = (p: string): string => p.replaceAll('\\', '/');
const ENV: NodeJS.ProcessEnv = { ...process.env };

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

/** A command that records that it ran in `marker` and answers with no issues; `.mjs` run through `node`, never `./x.sh` (cmd.exe). */
function command(folder: string, name: string, marker: string): string {
  const path = posix(join(folder, name + '.mjs'));
  writeFileSync(
    path,
    `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(marker)}, 'ran\\n');
process.stdout.write(JSON.stringify({ version: 1, issues: {} }));
`,
  );
  return `node "${path}"`;
}

const setCommand = (repo: string, cmd: string | undefined): void => {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8').replace(
    /tracker:\n {2}adapter: [\w-]+(\n {2}command: .+)?/,
    'tracker:\n  adapter: script' + (cmd === undefined ? '' : '\n  command: ' + JSON.stringify(cmd)),
  );
  writeFileSync(file, text);
};

/** A repository whose default branch names `reviewed`, with the checkout on a `pr` branch. */
function sandbox(reviewed: string | undefined): { repo: string; folder: string; marker: string } {
  const folder = mkdtempSync(join(tmpdir(), 'accord-script-trust-'));
  dirs.push(folder);
  const repo = makeRepo('valid-build');
  dirs.push(repo);
  writeFileSync(join(repo, 'accord', 'tickets', 'ISS-7.md'), ticket('ISS-7'));
  setCommand(repo, reviewed);
  commitAll(repo, 'default branch');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 'pr');
  return { repo, folder, marker: posix(join(folder, 'marker.txt')) };
}

describe('accord status runs a tracker command only when the default branch names it (WR-03)', () => {
  it('risk:security a command the branch changed does not run, committed or not, and the status warns once', async () => {
    const { repo, folder, marker } = sandbox('placeholder');
    setCommand(repo, command(folder, 'evil', marker));
    for (const committed of [false, true]) {
      if (committed) commitAll(repo, 'point the script elsewhere');
      const { code, err } = await run(['status'], repo, ENV);
      expect(code, String(committed)).toBe(0);
      expect(existsSync(marker), String(committed)).toBe(false);
      expect(err, String(committed)).toMatch(/^tracker script: .*tracker\.command/);
      expect(err.trim().split('\n'), String(committed)).toHaveLength(1);
    }
  });

  it('risk:security a command added on a branch whose default branch has none does not run', async () => {
    const { repo, folder, marker } = sandbox(undefined);
    setCommand(repo, command(folder, 'evil', marker));
    const { code, err } = await run(['status'], repo, ENV);
    expect(code).toBe(0);
    expect(existsSync(marker)).toBe(false);
    expect(err).toMatch(/^tracker script: /);
  });

  it('risk:regression the command the default branch names runs', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'accord-script-trust-'));
    dirs.push(folder);
    const marker = posix(join(folder, 'marker.txt'));
    const good = command(folder, 'good', marker);
    const { repo } = sandbox(good);
    const { code, err } = await run(['status'], repo, ENV);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(readFileSync(marker, 'utf8')).toBe('ran\n');
  });
});
