import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// FMT-01, Phase 1 success criterion 5: the folder convention is documented.
// These are grep assertions over the two public documents; a regression to the
// old layout or vocabulary (per-epic folder, QA-owned tick key, roster roles that
// no longer exist) turns this red before a reader is misled.

const repoRoot = new URL('../../../', import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, repoRoot), 'utf8').replace(/\r\n/g, '\n');

const readme = read('README.md');
const design = read('docs/design.md');

// Text from the first line starting with `from` up to (not including) the first
// later line starting with `to`. Empty when either heading is missing.
function section(text: string, from: string, to: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(from));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith(to));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

const section2 = section(design, '## 2.', '## 3.');
const section4 = section(design, '## 4.', '## 5.');
const sections2to5 = section(design, '## 2.', '## 6.');

// Built by concatenation so this file never contains the retired names verbatim.
const legacyFolder = new RegExp('features' + '/');
const legacyTickKey = 'qa' + '.ticks';

describe('documentation of the folder convention (FMT-01)', () => {
  it('slices of design.md are non-empty (heading rename guard)', () => {
    expect(section2.length).toBeGreaterThan(200);
    expect(section4.length).toBeGreaterThan(200);
    expect(sections2to5.length).toBeGreaterThan(section2.length + section4.length);
  });

  it('README documents the folder convention', () => {
    for (const phrase of [
      'accord/',
      'product/',
      'tickets/<id>.md',
      'tickets/<id>/verification.md',
      'assets/<id>/',
      'parent:',
      'tracker: { shortcut: "1234" }',
    ]) {
      expect(readme, phrase).toContain(phrase);
    }
    expect(readme).not.toMatch(legacyFolder);
  });

  it('design.md §2 documents the fixed root and the ticket types', () => {
    for (const phrase of [
      'always `accord/`',
      'It is not configurable',
      'type: epic | story | bug',
      'tickets/<id>/verification.md',
      'parent:',
      'verified',
    ]) {
      expect(section2, phrase).toContain(phrase);
    }
    expect(section2).not.toMatch(legacyFolder);
    expect(section2).not.toContain('overridable');
  });

  it('documentation names the developer tick key and the fresh-context review', () => {
    expect(readme).toContain('verified');
    expect(design).toContain('review.md');
    expect(design).toContain('fresh agent context');
  });

  it('no retired vocabulary in README or design §2–§5', () => {
    expect(readme).not.toContain(legacyTickKey);
    expect(sections2to5).not.toContain(legacyTickKey);
    expect(section4).not.toMatch(/^- \*\*Lead\*\*/m);
  });
});
