// D-72 test report scanner: every <testcase> becomes an id and a status, with no XML dependency.
// Id shape (A2): norm(classname) + '#' + norm(name), or norm(name) alone when classname is absent or empty,
// where norm trims and turns each whitespace run into '-'. Duplicates keep the worst status (A7).
// The caller (load/snapshot.ts) has already normalised BOM and line endings (D-38).
export type TestStatus = 'passed' | 'failed' | 'skipped';

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e],
  );
const attr = (attrs: string, name: string) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? unescapeXml(m[1] ?? m[2]) : undefined;
};
const norm = (s: string) => s.trim().replace(/\s+/g, '-');
const RANK: Record<TestStatus, number> = { failed: 2, skipped: 1, passed: 0 };

/**
 * One forward pass: the case regex is bounded by `>`, the body ends at the next `</testcase>` found by
 * indexOf, and the cursor jumps past it, so a megabyte report costs O(n). CDATA and comment bodies are
 * blanked first so a tag inside test output never counts as a case (T-03-11).
 */
export function scanJUnit(text: string): Record<string, TestStatus> {
  const xml = text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const out: Record<string, TestStatus> = {};
  const re = /<testcase\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const name = attr(m[1], 'name') ?? '';
    const cls = attr(m[1], 'classname');
    let status: TestStatus = 'passed';
    if (m[2] !== '/') {
      const end = xml.indexOf('</testcase>', re.lastIndex);
      const body = xml.slice(re.lastIndex, end < 0 ? undefined : end);
      if (/<(failure|error)\b/.test(body)) status = 'failed';
      else if (/<skipped\b/.test(body)) status = 'skipped';
      if (end >= 0) re.lastIndex = end;
    }
    const id = cls === undefined || cls === '' ? norm(name) : `${norm(cls)}#${norm(name)}`;
    if (!Object.hasOwn(out, id) || RANK[status] > RANK[out[id]]) out[id] = status;
  }
  return out;
}
