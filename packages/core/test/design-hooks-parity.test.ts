// Phase 08.9.2 D-01 and the Claude Code-first parity rule (2026-11-22): the design record describes the launcher hooks,
// the minimum Claude Code version they need, and declares each Claude Code-only part of the phase as a parity exception.
// The `flat` and `lacks` helpers follow plan-verify-rule.test.ts (copied, not imported).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const design = readFileSync(new URL('../../../docs/design.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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

const PHRASES = [
  '.claude/accord.mjs',
  '${CLAUDE_PROJECT_DIR}',
  '2.1.139',
  '--ignore-scripts',
  'hook_mode',
  'accord-off',
  'accord-panel.json',
];
const PARAGRAPHS = ['Hooks', 'Early answers', 'Quiet mode', 'Personal switch', 'Panel'] as const;

// Phase 08.9.2 D-01: the record keeps the launcher form, the minimum Claude Code version and one parity exception in each Claude Code-only paragraph.
it('risk:regression the design record keeps the launcher form its minimum Claude Code version and each parity exception (D-01)', () => {
  const bad: string[] = [];
  for (const phrase of lacks(flat(design), PHRASES)) bad.push(`docs/design.md lacks "${phrase}"`);
  for (const name of PARAGRAPHS) {
    const text = paragraph(name);
    if (text === '') bad.push(`docs/design.md has no **${name}.** paragraph`);
    else if (!text.includes('Parity exception')) bad.push(`the **${name}.** paragraph holds no "Parity exception"`);
  }
  const total = PARAGRAPHS.reduce((n, name) => n + (paragraph(name).match(/Parity exception/g) ?? []).length, 0);
  if (total < PARAGRAPHS.length) bad.push(`only ${total} parity exceptions in the ${PARAGRAPHS.length} paragraphs`);
  if (flat(design).includes('npx --yes <package>@<version> hook <event>')) bad.push('docs/design.md still shows the npx hook form');
  expect(bad).toEqual([]);
});
