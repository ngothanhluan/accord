// Phase 2 goldens: one per fixture folder under test/fixtures/ that has an accord/ directory.
// Each fixture's describe is named `fixture <name>` so a plan can regenerate only its own golden
// with `npm test -- --project core snapshot -u -t "fixture <name>"`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { RepoSnapshot, SnapshotInput } from '../src/index.js';
import { readFixture, stableJson, variants } from './helpers/fixture.js';
import type { Variants } from './helpers/fixture.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(fixturesDir, d.name, 'accord')))
  .map((d) => d.name)
  .sort();

for (const name of fixtures) {
  describe('fixture ' + name, () => {
    let v: Variants;
    // Read inside the hook, never at collection time, so a `-t` filter never touches sibling fixtures.
    beforeAll(() => {
      v = variants(readFixture(name));
    });

    it('CRLF, BOM+CRLF, mixed endings, and backslash keys load identically to LF (D-29, D-38)', () => {
      const lf = stableJson(loadSnapshot(v.lf));
      expect(stableJson(loadSnapshot(v.crlf))).toBe(lf);
      expect(stableJson(loadSnapshot(v.bomCrlf))).toBe(lf);
      expect(stableJson(loadSnapshot(v.mixed))).toBe(lf);
      expect(stableJson(loadSnapshot(v.backslash))).toBe(lf);
    });

    it('emits no backslash in any path (STACK Decision 7)', () => {
      // A backslash is escaped as two characters in JSON, so the two-character sequence is the invariant.
      expect(JSON.stringify(loadSnapshot(v.backslash))).not.toContain('\\\\');
    });

    it('does not mutate its input and is deterministic (FMT-08)', () => {
      const before = structuredClone(v.lf);
      const first = stableJson(loadSnapshot(v.lf));
      const second = stableJson(loadSnapshot(v.lf));
      expect(v.lf).toEqual(before);
      expect(second).toBe(first);
    });

    it('matches the golden', async () => {
      await expect(stableJson(loadSnapshot(v.lf))).toMatchFileSnapshot('./__golden__/' + name + '.snapshot.json');
    });
  });
}

describe('fixture valid-build: pinned values', () => {
  let input: SnapshotInput;
  let snap: RepoSnapshot;
  beforeAll(() => {
    input = readFixture('valid-build');
    snap = loadSnapshot(input);
  });

  it('loads without errors and stores the sorted tree (D-30, D-31)', () => {
    expect(snap.errors).toEqual([]);
    expect(snap.tree).toEqual([
      'README.md',
      'accord/config.yml',
      'accord/product/glossary.md',
      'accord/tickets/EPIC-1.md',
      'accord/tickets/LOGIN-1.md',
      'accord/tickets/LOGIN-1/verification.md',
      'src/login.ts',
      'src/styles/tokens.css',
    ]);
    expect(snap.config?.design.tokens).toBe('src/styles/tokens.css');
    expect(Object.keys(snap.tickets)).toEqual(['EPIC-1', 'LOGIN-1']);
    expect(Object.keys(snap.verifications)).toEqual(['LOGIN-1']);
  });

  it('numerics and dates stay strings (CORE-02)', () => {
    const fm = snap.tickets['LOGIN-1'].frontmatter;
    expect(fm?.tracker).toEqual({ shortcut: '1234', jira: '1e3' });
    expect(fm?.verified).toEqual(['ac-1']);
    expect(fm?.ui).toBe(true);
    expect(fm?.parent).toBe('EPIC-1');
    expect(snap.verifications['LOGIN-1'].frontmatter).toEqual({
      ticket: 'LOGIN-1',
      commit: '1234567',
      reviewed_on: '2026-09-01',
    });
  });

  it('ui defaults to false and an epic has no scenarios (D-21, FMT-04 empty edge)', () => {
    expect(snap.tickets['EPIC-1'].frontmatter?.ui).toBe(false);
    expect(snap.tickets['EPIC-1'].scenarios).toEqual([]);
  });

  it('scenarios carry Markdown lines, tags, and Background steps (CORE-03, FMT-04, D-46, D-47)', () => {
    const [first, second] = snap.tickets['LOGIN-1'].scenarios;
    expect(snap.tickets['LOGIN-1'].scenarios).toHaveLength(2);
    expect(first).toEqual({
      name: 'Đăng nhập thành công',
      keyword: 'Scenario',
      line: 37,
      tags: ['@ac-1'],
      acTag: 'ac-1',
      steps: ['Given một người dùng đã đăng ký', 'When họ gửi email và mật khẩu hợp lệ', 'Then họ thấy bảng điều khiển'],
    });
    expect(second).toMatchObject({ line: 42, acTag: 'ac-2', keyword: 'Scenario' });
    expect(second.steps[0]).toBe('Given một người dùng đã đăng ký');
  });

  it('EARS lines keep their line and lose the list marker (FMT-05, D-41)', () => {
    expect(snap.tickets['LOGIN-1'].requirements).toEqual([
      { line: 25, text: 'WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển' },
      { line: 26, text: 'IF mật khẩu sai THEN the system SHALL hiển thị thông báo lỗi' },
    ]);
    expect(snap.tickets['EPIC-1'].requirements).toEqual([
      { line: 12, text: 'WHEN người dùng có tài khoản the system SHALL cho phép đăng nhập' },
    ]);
  });

  it('sections are the five D-07 headings with their lines (D-39)', () => {
    expect(snap.tickets['LOGIN-1'].sections.map((s) => [s.heading, s.line])).toEqual([
      ['Intent', 19],
      ['Requirements', 23],
      ['Acceptance criteria', 28],
      ['Open questions', 47],
      ['Plan', 50],
    ]);
  });

  it('verification blocks are keyed by tag with Result and Evidence (D-42)', () => {
    const [a, b] = snap.verifications['LOGIN-1'].blocks;
    expect(a).toEqual({
      acTag: 'ac-1',
      name: 'Đăng nhập thành công',
      line: 9,
      result: 'pass',
      evidence: 'npm test -- login.spec.ts\ntest/login.spec.ts covers the happy path',
    });
    expect(b).toEqual({ acTag: 'ac-2', name: 'Mật khẩu sai', line: 17, result: 'fail', evidence: '' });
  });
});
