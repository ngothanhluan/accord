// ST-LN-36 D-05: which changed files and lines of a package's diff match the security patterns. Pure: it reads the `-U10` diff text and the
// changed-file list the host already produced, never git. A path it cannot place in the diff text is a trigger of its own (fail closed).
import { matches } from '../gate/scope.js';
import type { SecurityPattern, SecuritySpec } from './spec.js';

/** One file's section of a diff text: its paths, its added and removed lines with their numbers on their own side, and whether git called it binary. */
export interface DiffFile {
  /** the new path, or the old path of a deletion; undefined when the text names none this reader can read. */
  path?: string;
  /** the old path of a rename. */
  oldPath?: string;
  binary: boolean;
  added: { line: number; text: string }[];
  removed: { line: number; text: string }[];
}

export interface Trigger {
  path: string;
  line?: number;
  removed?: boolean;
  pattern: string;
  label: string;
  /** the path is in the changed list but the diff text does not show it. */
  cannot?: boolean;
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
// A path git ends with a tab when it holds a space; `/dev/null` names no path.
const headerPath = (rest: string, prefix: 'a/' | 'b/'): string | undefined => {
  const t = rest.replace(/\t$/, '');
  return t.startsWith(prefix) ? t.slice(2) : undefined;
};

/** `diff --git a/<p> b/<p>`: the path when both halves are equal (a rename or a quoted name is read from its own lines instead). */
function pathOfGitHeader(rest: string): string | undefined {
  if (!rest.startsWith('a/')) return undefined;
  const total = rest.length - 5; // 'a/' + p + ' b/' + p
  if (total <= 0 || total % 2 !== 0) return undefined;
  const p = rest.slice(2, 2 + total / 2);
  return rest === `a/${p} b/${p}` ? p : undefined;
}

/**
 * Split a diff text on its `diff --git` lines. Header lines are read only outside a hunk; inside one the hunk's own counts decide where it ends,
 * so a removed `-- x` line (`--- x` in the text) or a context line that looks like a header is never read as one.
 */
export function diffFiles(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | undefined;
  let oldLeft = 0;
  let newLeft = 0;
  let oldNo = 0;
  let newNo = 0;
  let renameTo: string | undefined;
  let deleted = false;
  const finish = () => {
    if (cur === undefined) return;
    if (renameTo !== undefined) cur.path = renameTo;
    if (deleted && cur.path === undefined && cur.oldPath !== undefined) cur.path = cur.oldPath;
  };
  for (const raw of diffText.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (cur !== undefined && (oldLeft > 0 || newLeft > 0)) {
      const c = text[0];
      if (c === '+') {
        newLeft--;
        cur.added.push({ line: newNo++, text: text.slice(1) });
        continue;
      }
      if (c === '-') {
        oldLeft--;
        cur.removed.push({ line: oldNo++, text: text.slice(1) });
        continue;
      }
      if (c === ' ' || text === '') {
        oldLeft--;
        newLeft--;
        oldNo++;
        newNo++;
        continue;
      }
      if (c === '\\') continue;
      oldLeft = 0;
      newLeft = 0;
    }
    if (text.startsWith('diff --git ')) {
      finish();
      renameTo = undefined;
      deleted = false;
      cur = { path: pathOfGitHeader(text.slice(11)), binary: false, added: [], removed: [] };
      files.push(cur);
      continue;
    }
    if (cur === undefined) continue;
    const h = HUNK.exec(text);
    if (h !== null) {
      oldNo = Number(h[1]);
      oldLeft = h[2] === undefined ? 1 : Number(h[2]);
      newNo = Number(h[3]);
      newLeft = h[4] === undefined ? 1 : Number(h[4]);
      // a zero-length side starts one line later than its number says
      if (oldLeft === 0) oldNo++;
      if (newLeft === 0) newNo++;
      continue;
    }
    if (text.startsWith('+++ ')) {
      if (text === '+++ /dev/null') deleted = true;
      else {
        const p = headerPath(text.slice(4), 'b/');
        if (p !== undefined) cur.path = p;
      }
    } else if (text.startsWith('--- ')) {
      if (text !== '--- /dev/null') {
        const p = headerPath(text.slice(4), 'a/');
        if (p !== undefined) {
          cur.oldPath = p;
          if (cur.path === undefined) cur.path = p;
        }
      }
    } else if (text.startsWith('rename from ')) {
      cur.oldPath = text.slice(12).replace(/\t$/, '');
    } else if (text.startsWith('rename to ')) {
      renameTo = text.slice(10).replace(/\t$/, '');
    } else if (text.startsWith('Binary files ') || text === 'GIT binary patch') {
      cur.binary = true;
      if (cur.path === undefined && text.startsWith('Binary files ') && text.endsWith(' differ')) {
        const mid = text.slice(13, -7);
        if (mid.startsWith('/dev/null and b/')) cur.path = mid.slice(16);
        else if (mid.endsWith(' and /dev/null') && mid.startsWith('a/')) cur.path = mid.slice(2, -14);
      }
    }
  }
  finish();
  return files;
}

const MAX_LINE = 2000;
const MARKDOWN = /\.(md|mdx|markdown)$/i;
const TEST_FOLDER = new Set(['test', 'tests', '__tests__']);
const OWN_COPIES = ['.claude/skills/', '.agents/skills/', '.claude/agents/', '.claude/accord-panel/'];

/** lane.md's definition: under a folder named `test`, `tests` or `__tests__`, or a name holding `.test.` or `.spec.`. */
const isTestFile = (path: string): boolean => {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  return parts.slice(0, -1).some((d) => TEST_FOLDER.has(d)) || name.includes('.test.') || name.includes('.spec.');
};

const pathMatches = (entry: string, path: string): boolean => {
  if (entry.endsWith('/') || entry.includes('/')) return matches(entry, path);
  return path === entry || path.endsWith('/' + entry);
};

/** Code point order, so the same input sorts the same on every runtime. */
function cmp(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i].codePointAt(0) as number) - (y[i].codePointAt(0) as number);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
}

/**
 * The triggers of a package: path patterns over every changed path (both sides of a rename); content patterns over the added and removed lines of
 * files that are not binary, not Markdown, not test files and not generated copies; one `cannot` trigger for each changed path the diff text does not
 * show. Deduplicated and sorted by path, then line, then pattern id.
 */
export function securityTriggers(spec: SecuritySpec, diffText: string, changed: readonly string[], options: { generated: readonly string[] }): Trigger[] {
  const files = diffFiles(diffText);
  const shown = new Set<string>();
  for (const f of files) {
    if (f.path !== undefined) shown.add(f.path);
    if (f.oldPath !== undefined) shown.add(f.oldPath);
  }
  const out = new Map<string, Trigger>();
  const add = (t: Trigger) => {
    const key = [t.path, t.line ?? '', t.removed === true ? 'r' : 'a', t.pattern, t.cannot === true ? 'c' : ''].join('\0');
    if (!out.has(key)) out.set(key, t);
  };
  const pathPatterns = spec.patterns.filter((p): p is SecurityPattern & { entries: string[] } => p.kind === 'path' && p.entries !== undefined);
  for (const path of new Set([...changed, ...shown])) {
    for (const p of pathPatterns) if (p.entries.some((e) => pathMatches(e, path))) add({ path, pattern: p.id, label: p.label });
  }
  const lineRes: { p: SecurityPattern; re: RegExp }[] = [];
  for (const p of spec.patterns) {
    if (p.kind !== 'line' || p.source === undefined) continue;
    try {
      lineRes.push({ p, re: new RegExp(p.source, p.flags ?? '') });
    } catch {
      // parseSecurityFile reported it as a problem; a pattern that does not compile matches nothing
    }
  }
  const skipped = (path: string): boolean =>
    MARKDOWN.test(path) || isTestFile(path) || OWN_COPIES.some((e) => path.startsWith(e)) || options.generated.some((e) => matches(e, path));
  for (const f of files) {
    if (f.binary || f.path === undefined || skipped(f.path)) continue;
    const scanLines = (lines: DiffFile['added'], removed: boolean) => {
      for (const l of lines) {
        const head = l.text.length > MAX_LINE ? l.text.slice(0, MAX_LINE) : l.text;
        for (const { p, re } of lineRes) if (re.test(head)) add({ path: f.path as string, line: l.line, ...(removed ? { removed: true } : {}), pattern: p.id, label: p.label });
      }
    };
    scanLines(f.added, false);
    scanLines(f.removed, true);
  }
  for (const path of changed) if (!shown.has(path)) add({ path, pattern: '', label: '', cannot: true });
  return [...out.values()].sort(
    (a, b) => cmp(a.path, b.path) || (a.line ?? 0) - (b.line ?? 0) || cmp(a.pattern, b.pattern) || Number(a.removed === true) - Number(b.removed === true),
  );
}

/** The line form of a trigger, as `accord review-package` prints it. */
export function triggerText(t: Trigger): string {
  if (t.cannot === true) return `(cannot tell: ${t.path} is not in the diff text)`;
  if (t.line === undefined) return `${t.path}: ${t.pattern} (${t.label})`;
  return `${t.path}:${t.line}${t.removed === true ? ' (removed)' : ''}: ${t.pattern} (${t.label})`;
}
