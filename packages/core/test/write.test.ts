// D-43/D-44/D-45 write primitive and the FMT-08 output invariants. Goldens are full Markdown text.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot, setFrontmatterKey, templates } from '../src/index.js';
import type { SnapshotInput } from '../src/index.js';
import { readFixture, variants } from './helpers/fixture.js';

const TICKET = 'accord/tickets/LOGIN-1.md';
const BOM = String.fromCharCode(0xfeff);

/** The YAML lines between the two `---` lines. */
const frontmatterLines = (text: string): string[] => text.split('\n---\n')[0].split('\n').slice(1);
const commentLines = (text: string): string[] => frontmatterLines(text).filter((l) => l.startsWith('#')).sort();
const fromIntent = (text: string): string => text.slice(text.indexOf('## Intent'));
/** Lines of `after` that differ from the same-numbered line of `before`; both must have the same count. */
function changedLines(before: string, after: string): string[] {
  const a = before.split('\n');
  const b = after.split('\n');
  expect(b).toHaveLength(a.length);
  return b.filter((line, i) => line !== a[i]);
}

let input: SnapshotInput;
let login: string;
beforeAll(() => {
  input = readFixture('valid-build');
  login = input.files[TICKET];
});

describe('setFrontmatterKey (D-43, D-44, D-45)', () => {
  it('verified: block list of double-quoted tags; every other line survives byte-for-byte', async () => {
    const out = setFrontmatterKey(login, 'verified', ['ac-1', 'ac-2']);
    await expect(out).toMatchFileSnapshot('./__golden__/LOGIN-1.verified.md');
    const lines = frontmatterLines(out);
    expect(lines).toContain('id: LOGIN-1                       # equals the file name');
    expect(lines).toContain('# ids in the tracker are strings even when they look numeric');
    expect(lines).toContain('title: Đăng nhập bằng email');
    expect(lines.slice(-3)).toEqual(['verified:', '  - "ac-1"', '  - "ac-2"']);
    expect(fromIntent(out)).toBe(fromIntent(login));
  });

  it('ac_hash: a new key goes immediately before verified, which stays last', async () => {
    const out = setFrontmatterKey(login, 'ac_hash', 'deadbeef');
    await expect(out).toMatchFileSnapshot('./__golden__/LOGIN-1.ac_hash.md');
    const lines = frontmatterLines(out);
    const at = lines.indexOf('ac_hash: "deadbeef"');
    expect(at).toBeGreaterThan(0);
    expect(lines[at + 1]).toBe('verified:');
    expect(lines.filter((l) => !l.startsWith('#')).at(-1)).toMatch(/^ {2}- /);
    expect(fromIntent(out)).toBe(fromIntent(login));
  });

  it('verified: [] is appended to the build template and every comment line survives', async () => {
    const tpl = templates['ticket-build.md'];
    const out = setFrontmatterKey(tpl, 'verified', []);
    await expect(out).toMatchFileSnapshot('./__golden__/ticket-build.verified-empty.md');
    const lines = frontmatterLines(out);
    // The template has no `verified` key, so the new key becomes the last line of the block. The template's
    // trailing guidance comment (`# verified: []` and its neighbours) stays where the BA left it, above the key.
    expect(lines.at(-1)).toBe('verified: []');
    expect(lines.filter((l) => /^[a-z_]+:/.test(l)).at(-1)).toBe('verified: []');
    expect(commentLines(out)).toEqual(commentLines(tpl));
    expect(fromIntent(out)).toBe(fromIntent(tpl));
  });

  it('a boolean is written plain and the line count is unchanged', () => {
    const out = setFrontmatterKey(login, 'ui', false);
    expect(changedLines(login, out)).toEqual(['ui: false']);
  });

  it('a string with YAML syntax is escaped inside the double quotes (T-02-17)', () => {
    const out = setFrontmatterKey(login, 'ac_hash', 'x: y\nz # c');
    expect(frontmatterLines(out)).toContain('ac_hash: "x: y\\nz # c"');
    expect(loadSnapshot({ ...input, files: { ...input.files, [TICKET]: out } }).errors).toEqual([]);
  });

  it('throws on a missing block, invalid YAML, and a non-map document', () => {
    for (const text of ['## Intent\nno block\n', '---\na: [\n---\n', '---\n- a\n- b\n---\n', '---\n\n---\n']) {
      expect(() => setFrontmatterKey(text, 'verified', [])).toThrow(/^setFrontmatterKey: /);
    }
  });
});

describe('round trip, encoding, and idempotence (CORE-02, FMT-08, D-38)', () => {
  const tick = (text: string) => setFrontmatterKey(text, 'verified', ['ac-1', 'ac-2']);

  it('loadSnapshot over the written text differs from the original only in the changed key', () => {
    const before = loadSnapshot(input);
    const after = loadSnapshot({ ...input, files: { ...input.files, [TICKET]: tick(login) } });
    expect(after.errors).toEqual([]);
    expect(after.tickets['LOGIN-1'].frontmatter).toEqual({
      ...before.tickets['LOGIN-1'].frontmatter,
      verified: ['ac-1', 'ac-2'],
    });
    // One more list item shifts the untouched body down by one line.
    expect(after.tickets['LOGIN-1'].scenarios).toEqual(
      before.tickets['LOGIN-1'].scenarios.map((s) => ({ ...s, line: s.line + 1 })),
    );
  });

  it('BOM+CRLF input yields the same LF, BOM-free text as LF input', () => {
    const bomCrlf = variants(input).bomCrlf.files[TICKET];
    expect(bomCrlf.startsWith(BOM)).toBe(true);
    const out = tick(bomCrlf);
    expect(out).toBe(tick(login));
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).not.toContain('\r');
  });

  it('a U+FEFF that is not the first character is content and stays in place (FMT-08 adjacency edge)', () => {
    const marked = login.replace('## Intent\n', '## Intent\n' + BOM);
    const out = tick(marked);
    expect(out.indexOf(BOM)).toBe(out.indexOf('## Intent\n') + '## Intent\n'.length);
    expect(fromIntent(out)).toBe(fromIntent(marked));
  });

  it('writing the same value twice is idempotent', () => {
    const once = tick(login);
    expect(tick(once)).toBe(once);
  });

  it('rewriting the current value changes only the quoting of that line', () => {
    const out = setFrontmatterKey(login, 'verified', ['ac-1']);
    expect(changedLines(login, out)).toEqual(['  - "ac-1"']);
  });
});
