// CLI-05 `accord status` end to end, in-process through runCli with injected streams and an explicit
// cwd (STACK Decision 7). Three contracts are under test: the exact table text (a text golden is the
// only way to pin a table), the character-set invariants that make that table safe on a legacy Windows
// console — ASCII only, no escape, one row per line (PITFALLS section 12, T-05-11) — and the D-93
// archived filter with its never-silent hidden count.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StatusRow } from '@accord-dev/accord-core';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const ESC = String.fromCharCode(27);

/** Reports the offending character and its index; a bare regex failure message says nothing. */
function firstNonAscii(text: string): string | undefined {
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp > 127) return `index ${i}: U+${cp.toString(16).padStart(4, '0')} ${JSON.stringify(text[i])}`;
  }
  return undefined;
}

/** A schema-valid ticket body; `extra` carries the frontmatter keys the case is actually about. */
function ticket(id: string, extra: string): string {
  return `---
id: ${id}
title: ${id} fixture
type: story
${extra}
---

## Intent
Added by the status test sandbox.

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
}

function addTicket(repo: string, id: string, extra: string): void {
  writeFileSync(join(repo, 'accord', 'tickets', id + '.md'), ticket(id, extra));
}

describe('accord status', () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo('valid-build');
  });
  afterAll(() => {
    cleanup(repo);
  });

  it('exits 0 and writes the table, matching the golden byte for byte', async () => {
    const { code, out, err } = await run(['status'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
    await expect(out).toMatchFileSnapshot('./__golden__/valid-build.status.txt');
  });

  it('writes only ASCII, with no escape and no backslash (PITFALLS section 12, T-05-03)', async () => {
    const { out } = await run(['status'], repo);
    expect(firstNonAscii(out)).toBeUndefined();
    expect(out).not.toContain(ESC);
    expect(out).not.toContain('\\');
  });

  it('puts every row on exactly one line', async () => {
    const { out } = await run(['status', '--json'], repo);
    const rows = JSON.parse(out) as StatusRow[];
    const text = (await run(['status'], repo)).out;
    // header, separator, one line per row, summary — and nothing else.
    expect(text.split('\n').length - 1).toBe(rows.length + 3);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('--json writes the StatusRow array verbatim, with no wrapper key (D-98)', async () => {
    const { code, out, err } = await run(['status', '--json'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
    const rows = JSON.parse(out) as StatusRow[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(['EPIC-1', 'LOGIN-1']);
  });

  it('renders the rows in the order core returned them, never re-sorting (D-92)', async () => {
    const { out: json } = await run(['status', '--json'], repo);
    const { out: text } = await run(['status'], repo);
    const ids = (JSON.parse(json) as StatusRow[]).map((r) => r.id);
    const rendered = text
      .split('\n')
      .slice(2)
      .filter((l) => l.trim() !== '' && !l.startsWith('-') && /^\S/.test(l))
      .map((l) => l.split(' ')[0])
      .filter((id) => ids.includes(id));
    expect(rendered).toEqual(ids);
  });
});

describe('accord status archived filter (D-93)', () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo('valid-build');
    addTicket(repo, 'OLD-1', 'status: archived\nparent: EPIC-1');
  });
  afterAll(() => {
    cleanup(repo);
  });

  it('hides the archived ticket, shows it under --all, and names the hidden count', async () => {
    const plain = await run(['status'], repo);
    const all = await run(['status', '--all'], repo);
    const rows = (out: string) => out.split('\n').length - 1;
    expect(rows(all.out)).toBe(rows(plain.out) + 1);
    expect(plain.out).toContain('1 archived ticket hidden');
    expect(plain.out).not.toContain('OLD-1');
    expect(all.out).toContain('OLD-1');
  });

  it('--json keeps stdout a bare array and puts the hidden count on stderr (D-93, D-98)', async () => {
    const { code, out, err } = await run(['status', '--json'], repo);
    expect(code).toBe(0);
    const rows = JSON.parse(out) as StatusRow[];
    expect(rows.map((r) => r.id)).toEqual(['EPIC-1', 'LOGIN-1']);
    expect(err.trim().split('\n')).toHaveLength(1);
    expect(err).toContain('1 archived ticket hidden');
  });

  it('--json --all leaves stderr empty and includes the archived ticket', async () => {
    const { out, err } = await run(['status', '--json', '--all'], repo);
    expect(err).toBe('');
    expect((JSON.parse(out) as StatusRow[]).map((r) => r.id)).toContain('OLD-1');
  });
});

describe('accord status long values (T-05-12)', () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo('valid-build');
    addTicket(repo, 'LONG-1', 'status: open\nparent: EPIC-1\ntracker:\n  shortcut: ' + 'x'.repeat(60));
  });
  afterAll(() => {
    cleanup(repo);
  });

  it('truncates the over-long cell visibly and keeps the row one line of the usual length', async () => {
    const { out } = await run(['status'], repo);
    const lines = out.split('\n').filter((l) => l !== '');
    const long = lines.find((l) => l.startsWith('LONG-1'));
    expect(long).toBeDefined();
    expect(long?.trimEnd().endsWith('...')).toBe(true);
    // Every table line (all but the trailing summary) is the same width, so nothing wrapped.
    const widths = new Set(lines.slice(0, -1).map((l) => l.length));
    expect([...widths]).toHaveLength(1);
    expect(firstNonAscii(out)).toBeUndefined();
  });
});

// The ASCII invariant above runs against an all-ASCII fixture, so it holds whatever the sanitiser
// does. These cases carry the characters the rule exists to stop — a box-drawing glyph, an em dash,
// Vietnamese diacritics, an astral emoji — through the two columns a ticket author controls without
// the tracker adapter in the path: the id, which is the file stem, and a frontmatter tracker value.
describe('accord status non-ASCII input (STACK Decision 5, T-05-11)', () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo('valid-build');
    addTicket(repo, 'UNI-1', 'status: open\nparent: EPIC-1\ntracker:\n  shortcut: "Đăng—█💩"');
    addTicket(repo, 'Đ█-1', 'status: open\nparent: EPIC-1');
  });
  afterAll(() => {
    cleanup(repo);
  });

  it('renders no character above code point 127, whatever the ticket carries', async () => {
    const { code, out } = await run(['status'], repo);
    expect(code).toBe(0);
    expect(firstNonAscii(out)).toBeUndefined();
    expect(out).not.toContain('█'); // the box drawing the decision forbids, by name
    expect(out).toContain('UNI-1'); // and the row is still rendered, not dropped
  });
});

describe('accord status with no tickets', () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo('valid-build');
    rmSync(join(repo, 'accord', 'tickets'), { recursive: true, force: true, maxRetries: 5 });
    mkdirSync(join(repo, 'accord', 'tickets'));
  });
  afterAll(() => {
    cleanup(repo);
  });

  it('writes one explanatory line instead of an empty table, and exits 0', async () => {
    const { code, out } = await run(['status'], repo);
    expect(code).toBe(0);
    expect(out.split('\n').filter((l) => l !== '')).toHaveLength(1);
    expect(out).toContain('no tickets');
  });

  it('--json writes an empty array (D-98)', async () => {
    const { code, out, err } = await run(['status', '--json'], repo);
    expect(code).toBe(0);
    expect(out.trim()).toBe('[]');
    expect(err).toBe('');
  });
});
