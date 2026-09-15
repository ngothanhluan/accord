// CLI-05 status goldens (D-91, D-92, D-93). Rows cover the whole repository, so the case table is one
// row per fixture. Regenerate one with `npm test -- --project core status -u -t "<case name>"`.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot, statusRows } from '../src/index.js';
import type { SnapshotInput, StatusRow } from '../src/index.js';
import { readFixture, stableJson } from './helpers/fixture.js';

interface Case {
  name: string;
  input: () => SnapshotInput;
}

/**
 * No fixture on disk carries `status: archived`, and adding one would move every Phase 1 to 4 golden
 * that pins `valid-build`. The archived ticket is spread onto the SnapshotInput here instead.
 */
const ARCHIVED_PATH = 'accord/tickets/OLD-1.md';
const ARCHIVED_TICKET = `---
id: OLD-1
title: Đăng nhập bằng mạng xã hội
type: story
status: archived
parent: EPIC-1
ui: false
---

## Intent
Đã bỏ; giữ lại để tra cứu.

## Requirements
- WHEN người dùng chọn đăng nhập mạng xã hội the system SHALL mở nhà cung cấp

## Acceptance criteria
\`\`\`gherkin
Feature: OLD-1

  @ac-1
  Scenario: Đăng nhập bằng Google
    When họ chọn Google
    Then họ thấy bảng điều khiển
\`\`\`

## Open questions
- [x] Có khôi phục không? Không.

## Plan
- [x] Đã gỡ bỏ
`;

function withArchived(): SnapshotInput {
  const base = readFixture('valid-build');
  return {
    files: { ...base.files, [ARCHIVED_PATH]: ARCHIVED_TICKET },
    tree: [...base.tree, ARCHIVED_PATH].sort(),
  };
}

const CASES: Case[] = [
  { name: 'valid-build', input: () => readFixture('valid-build') },
  { name: 'gate-ready', input: () => readFixture('gate-ready') },
  { name: 'gate-done', input: () => readFixture('gate-done') },
  { name: 'frontmatter-errors', input: () => readFixture('frontmatter-errors') },
  { name: 'archived', input: withArchived },
];

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
// Outline order: a parentless row keys on its own id, so a parent sorts with its children.
const order = (a: StatusRow, b: StatusRow) => cmp(a.parent ?? a.id, b.parent ?? b.id) || cmp(a.id, b.id);

for (const row of CASES) {
  describe('status case ' + row.name, () => {
    let rows: StatusRow[];
    // Read inside the hook, never at collection time, so a `-t` filter never touches a sibling fixture.
    beforeAll(() => {
      rows = statusRows(loadSnapshot(row.input()));
    });

    it('matches its golden', async () => {
      await expect(stableJson(rows)).toMatchFileSnapshot('./__golden__/' + row.name + '.status.json');
    });

    it('is sorted by parent then id (D-92) and carries no undefined or null value (D-54)', () => {
      expect([...rows].sort(order)).toEqual(rows);
      expect(JSON.stringify(rows)).not.toContain('null');
      for (const r of rows) for (const v of Object.values(r)) expect(v).not.toBeUndefined();
    });
  });
}

describe('status valid-build: pinned values', () => {
  let rows: StatusRow[];
  beforeAll(() => {
    rows = statusRows(loadSnapshot(readFixture('valid-build')));
  });

  it('places the parentless epic before its child (D-92)', () => {
    expect(rows.map((r) => r.id)).toEqual(['EPIC-1', 'LOGIN-1']);
  });

  it('reports no recorded hash as none, not as a verdict (D-91)', () => {
    const login = rows[1];
    expect(login).toMatchObject({ ready: 'none', ticksBinding: 'none', ticksVerified: 1, ticksTagged: 2 });
    expect(login.tracker).toEqual({ shortcut: '1234', jira: '1e3' });
  });

  it('gives an epic none in both derived columns and no tick counts', () => {
    expect(rows[0]).toMatchObject({ ready: 'none', ticksBinding: 'none', ticksVerified: 0, ticksTagged: 0 });
  });

  it('is pure: two calls agree and the snapshot is untouched', () => {
    const snapshot = loadSnapshot(readFixture('valid-build'));
    const before = structuredClone(snapshot);
    const first = stableJson(statusRows(snapshot));
    expect(stableJson(statusRows(snapshot))).toBe(first);
    expect(snapshot).toEqual(before);
  });
});

describe('status gate-done: the recorded hashes drive the derived columns (D-91, D-76)', () => {
  let byId: Record<string, StatusRow>;
  beforeAll(() => {
    byId = Object.fromEntries(statusRows(loadSnapshot(readFixture('gate-done'))).map((r) => [r.id, r]));
  });

  it('reads ok/bound when the recorded hash equals the computed one', () => {
    expect(byId.PASS).toMatchObject({ ready: 'ok', ticksBinding: 'bound' });
  });

  it('reads stale when the recorded hash differs', () => {
    expect(byId.STALE).toMatchObject({ ready: 'stale', ticksBinding: 'stale' });
  });

  it('reads none for a verified_hash that was never written', () => {
    expect(byId.TICKS).toMatchObject({ ready: 'ok', ticksBinding: 'none', ticksVerified: 2 });
  });
});

describe('status edge cases a golden cannot express', () => {
  it('keeps an archived ticket in the result; filtering is the caller (D-93)', () => {
    const old = statusRows(loadSnapshot(withArchived())).find((r) => r.id === 'OLD-1');
    expect(old?.status).toBe('archived');
  });

  /**
   * No fixture distinguishes the two sort rules: every fixture's only parentless row is `EPIC-1`,
   * which leads under `parent ?? ''` and under `parent ?? id` alike. A second parentless ticket
   * whose id sorts after the epic is what separates them — under `parent ?? ''` it would join the
   * epic in a block above `LOGIN-1`; outline order leaves it after the group it is not part of.
   */
  it('sorts a parentless ticket by its own id, not into a block above every child (D-92)', () => {
    const base = readFixture('valid-build');
    const path = 'accord/tickets/ZZZ-9.md';
    const orphan = ARCHIVED_TICKET.replace('id: OLD-1', 'id: ZZZ-9')
      .replace('Feature: OLD-1', 'Feature: ZZZ-9')
      .replace('status: archived', 'status: draft')
      .replace('parent: EPIC-1\n', '');
    const rows = statusRows(
      loadSnapshot({ files: { ...base.files, [path]: orphan }, tree: [...base.tree, path].sort() }),
    );
    expect(rows.map((r) => r.id)).toEqual(['EPIC-1', 'LOGIN-1', 'ZZZ-9']);
  });

  it('gives a ticket whose frontmatter failed the schema a row with its id, its errors, and no type key', () => {
    const rows = statusRows(loadSnapshot(readFixture('frontmatter-errors')));
    const broken = rows.find((r) => r.id === 'NOFM');
    expect(broken).toBeDefined();
    // Object.hasOwn, not a truthiness test: a legitimately falsy value must not pass this.
    expect(Object.hasOwn(broken as object, 'type')).toBe(false);
    expect(Object.hasOwn(broken as object, 'status')).toBe(false);
    expect(broken?.errors).toBeGreaterThan(0);
  });
});
