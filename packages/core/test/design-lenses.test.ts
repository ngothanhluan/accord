// Phase 11 G2 (D-04, D-05, D-06; 11-ac-5, 11-ac-6, 11-ac-7): the design record states how a team adds a lens and what the CLI and the review stage do with it; the release notes name the file
// format, the rules, the record line and the cut-off; the README rows name the new form. The helpers follow design-agents-ext.test.ts (copied, not imported).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const design = read('../../../docs/design.md');
const releases = read('../../../docs/releases.md');
const readme = read('../../../README.md');
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
/** The `## Unreleased` section of releases.md, up to the next `## ` heading; empty when there is none. */
const unreleased = (): string => {
  const start = releases.indexOf('\n## Unreleased');
  if (start < 0) return '';
  const end = releases.indexOf('\n## ', start + 1);
  return releases.slice(start, end < 0 ? undefined : end);
};
/** The table row of the README that opens with the given command text; empty when there is none. */
const row = (command: string): string => readme.split('\n').find((l) => l.startsWith(`| \`${command}`)) ?? '';

it('risk:regression the design record and release notes describe team lenses (D-04, D-05, D-06)', () => {
  const lenses = flat(paragraph('Lenses'));
  expect(lenses, 'docs/design.md has no **Lenses.** paragraph').not.toBe('');
  expect(
    lacks(lenses, [
      '`accord/lenses/<name>.md`',
      '`paths:`',
      'the security file',
      '`on_finding:`',
      '`ask` (the default)',
      '`warn`',
      '`block`',
      'the CLI decides',
      'exactly the printed list',
      'round 1',
      'final review',
      "a slice's own diff",
      '`<name>:<path>`',
      "the default branch's copy",
      '`Lens: <name> ran`',
      '` — lens: <name>`',
      '`gate.lens-unreviewed`',
      '`lint.lens-file`',
      '0.23.0',
      '`risk: security`',
      'blocks under every setting',
      "inside today's round cap",
      'accord review-package <id> --lens <name> --round <k>',
    ]),
  ).toEqual([]);
  expect(lenses.match(/Parity exception/g) ?? []).toHaveLength(1);
  const sentence = flat(lenses.slice(lenses.indexOf('Parity exception')));
  expect(sentence).toContain('`claude` runtime only');
  expect(sentence).toContain('applies the checklist itself');

  const notes = flat(unreleased());
  expect(notes, 'docs/releases.md has no ## Unreleased section').not.toBe('');
  expect(
    lacks(notes, [
      '`accord/lenses/<name>.md`',
      '`## Team lenses`',
      '`Lens: <name> ran`',
      '` — lens: <name>`',
      '`accord review-package <id> --lens <name> --round <k>`',
      '`gate.lens-unreviewed`',
      '`lint.lens-file`',
      '`warn:`',
      'claimed before 0.23.0',
    ]),
  ).toEqual([]);

  const pkg = flat(row('accord review-package'));
  expect(lacks(pkg, ['--lens <name> --round <k>', '`## Team lenses`'])).toEqual([]);
  const round = flat(row('accord round'));
  expect(lacks(round, ['`warn:`', '`ask:`'])).toEqual([]);
});
