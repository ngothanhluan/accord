// Phase 08.9.3 D-01..D-14 and the Claude Code-first parity rule (2026-11-22): the design record says how a ticket spans repositories and declares each Claude Code-only part as a parity exception,
// the release notes list what the phase built and say a ticket claimed before 0.22.0 is judged as before, and the README command table lists the new commands (packages/cli/README.md is generated from it).
// The `flat`, `lacks` and `paragraph` helpers follow design-hooks-parity.test.ts (copied, not imported).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const design = read('docs/design.md');
const releases = read('docs/releases.md');
const readme = read('README.md');
const cliReadme = read('packages/cli/README.md');
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));
/** The paragraph that opens with the bold name, up to the next blank line; empty when there is none. */
const paragraph = (name: string): string => {
  const start = design.indexOf(`**${name}.**`);
  if (start < 0) return '';
  const end = design.indexOf('\n\n', start);
  return design.slice(start, end < 0 ? undefined : end);
};
/** The `## Unreleased` section of the release notes, up to the next `## ` heading; empty when there is none. */
const unreleased = (): string => {
  const start = releases.indexOf('\n## Unreleased\n');
  if (start < 0) return '';
  const end = releases.indexOf('\n## ', start + 1);
  return releases.slice(start, end < 0 ? undefined : end);
};


// D-01 to D-14: one paragraph holds the design; the Agents paragraph and this one each declare their Claude Code-only part.
it('risk:regression the design record states how a ticket spans repositories and declares the Claude Code-only parts as parity exceptions (D-01..D-14)', () => {
  const repositories = flat(paragraph('Repositories'));
  const bad: string[] = [];
  if (repositories === '') bad.push('docs/design.md has no **Repositories.** paragraph');
  for (const phrase of lacks(repositories, [
    '`repos:`',
    'remote URL',
    '<git-common-dir>/accord/repos',
    '`accord repos set <name> <path>`',
    '`git clone`',
    'never clones',
    'Everything accord owns stays in this repository',
    'in the other repository is run by the CLI',
    '`baseline_<name>`',
    '`<name>:<path>`',
    '`repo:`',
    'the claim branch holds the first slice of this repository',
    '`slice/<id>/<n>`',
    'deploy order',
    '`accord worktree slice <id> <n>`',
    '`accord worktree clean`',
    '`## Repository <name>`',
    '`gate done`',
    'no token',
    '`@test:<name>:<id>`',
    '`accord pr ready <id> --slice <n>`',
    '`pr-wait: released slice <k>`',
    'claimed before 0.22.0',
    'Parity exception',
    '/add-dir',
  ]))
    bad.push(`the **Repositories.** paragraph lacks "${phrase}"`);
  const agents = flat(paragraph('Agents'));
  for (const phrase of lacks(agents, ['Parity exception (Phase 08.9.3)', 'planner, executor, reviewer, scout and verifier', 'agent files render for the `claude` runtime only', '`## Repository <name>`']))
    bad.push(`the **Agents.** paragraph lacks "${phrase}"`);
  expect(bad).toEqual([]);
});

// D-01..D-14: the next release's notes tell a team what the phase adds and that tickets in flight keep their rules.
it('risk:regression the release notes open with Unreleased, list what the phase built and say a ticket claimed before 0.22.0 is judged as before (D-01..D-14)', () => {
  expect(releases.match(/^## Unreleased$/gm)).toHaveLength(1);
  expect(releases.indexOf('## Unreleased')).toBeLessThan(releases.indexOf('## 0.21.1'));
  const notes = flat(unreleased());
  expect(
    lacks(notes, [
      '`repos:`',
      '`accord repos set <name> <path>`',
      '`accord repos status [<id>]`',
      '`accord repos baseline <name> --id <id>`',
      '`accord pr ready <id> [--slice <n>]`',
      '`accord worktree push <id> --repo <name>`',
      '`<name>:<path>`',
      '`baseline_<name>`',
      '`repo: <name>`',
      '`## Repository <name>`',
      '`@test:<name>:<id>`',
      '`pr-wait: released slice <k>`',
      '`slice/<id>/<n>`',
      'claimed before 0.22.0',
      'is judged as before',
      '`repos.<name>.tests`',
    ]),
  ).toEqual([]);
  // the wording of a rule names no decision id: a team never read the phase's context file
  expect(notes).not.toMatch(/\bD-\d/);
});

// D-01..D-14: README section 7 lists the new commands, and packages/cli/README.md, which `npm run gen` writes from it, carries the same rows.
it('risk:regression README section 7 lists the repository commands and the cli README follows it (D-01..D-14)', () => {
  const rows = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('| `accord '));
  const row = (text: string, start: string): string => rows(text).find((l) => l.startsWith(start)) ?? '';
  const NEW_ROWS = ['| `accord repos set <name> <path>` |', '| `accord repos status [<id>]` |', '| `accord repos baseline <name> --id <id>` |', '| `accord pr ready <id> [--slice <n>]` |'];
  const bad: string[] = [];
  for (const [name, text] of [
    ['README.md', readme],
    ['packages/cli/README.md', cliReadme],
  ] as const) {
    for (const start of NEW_ROWS) if (row(text, start) === '') bad.push(`${name} has no row ${start}`);
    for (const [start, words] of [
      ['| `accord pr wait <id>` |', ['pr-wait: released slice <k>', 'another repository']],
      ['| `accord worktree clean` |', ['another repository']],
    ] as const) {
      const text2 = row(text, start);
      if (text2 === '') bad.push(`${name} has no row ${start}`);
      for (const w of words) if (!text2.includes(w)) bad.push(`${name} row ${start} lacks "${w}"`);
    }
  }
  expect(bad).toEqual([]);
});
