// Phase 8.1 G3a (D-11, D-09): what "no convention line" means, the one place every caller reads it.
import { expect, it } from 'vitest';
import { auditLines, CONVENTIONS_THIN, conventionLines, conventionsEmpty, templates } from '../src/index.js';

it('risk:parsing conventions are empty with only headings comments blank and Rejected lines (D-11)', () => {
  // the file `accord init` scaffolds: a heading and one HTML comment
  expect(conventionLines(templates['conventions.md'])).toEqual([]);
  expect(conventionsEmpty(templates['conventions.md'])).toBe(true);

  // CRLF, a byte order mark, a multi-line comment, a Rejected line with and without a marker, blank lines and a nested heading
  const quiet = '﻿# Conventions\r\n\r\n<!-- a multi-line\r\ncomment about the file\r\n-->\r\n## Naming\r\n- Rejected: tabs — reason\r\nRejected: semicolons — reason\r\n   \r\n';
  expect(conventionLines(quiet)).toEqual([]);
  expect(conventionsEmpty(quiet)).toBe(true);

  // one line is a convention, with or without a list marker; a trailing comment on the same line does not hide it
  expect(conventionLines('# Conventions\n- Use named exports\n')).toEqual(['Use named exports']);
  expect(conventionLines('# Conventions\nUse named exports <!-- why -->\n')).toEqual(['Use named exports']);
  expect(conventionsEmpty('# Conventions\n- Use named exports\n')).toBe(false);
});

it('risk:parsing conventions below the thin line are thin and five lines are not (D-11)', () => {
  expect(CONVENTIONS_THIN).toBe(5);
  const lines = (n: number): string => '# Conventions\n' + Array.from({ length: n }, (_, i) => `- rule ${i}\n`).join('');
  expect(conventionLines(lines(4))).toHaveLength(4);
  expect(conventionLines(lines(5))).toHaveLength(5);
});

it('risk:regression the audit prints facts then gaps then the count last (8.1-ac-8)', () => {
  const text = auditLines([{ name: 'conventions', value: 'no file' }], [{ id: 'conventions-empty', text: 'no convention line', fix: '/accord-audit drafts them' }]);
  expect(text.split('\n').filter((l) => l !== '')).toEqual([
    'fact: conventions: no file',
    'gap: conventions-empty: no convention line - fix: /accord-audit drafts them',
    'gaps: 1',
  ]);
  expect(auditLines([], []).trim()).toBe('gaps: 0');
});
