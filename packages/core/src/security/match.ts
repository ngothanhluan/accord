// ST-LN-36 D-05: which changed files and lines of a package's diff match the security patterns. Pure: it reads the `-U10` diff text and the
// changed-file list the host already produced, never git. A path it cannot place in the diff text is a trigger of its own (fail closed).
import { matches } from '../gate/scope.js';
import { overlapRepeats } from './backtrack.js';
import { DEFAULT_SECURITY } from './spec.js';
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
  /** the lines from `diff --git` up to the first hunk, as the text has them. */
  header: string[];
  /** each hunk of the file: its raw lines (the `@@` line first) and its own added and removed lines. */
  hunks: DiffHunk[];
}

/** One hunk of a file's diff text. */
export interface DiffHunk {
  lines: string[];
  added: { line: number; text: string }[];
  removed: { line: number; text: string }[];
}

export interface Trigger {
  path: string;
  line?: number;
  removed?: boolean;
  pattern: string;
  label: string;
  /** the diff text does not show the path (no `line`), or a changed line is longer than SCAN_LINE_LIMIT and was scanned only up to it (with `line`). */
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
  let hunk: DiffHunk | undefined;
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
        const l = { line: newNo++, text: text.slice(1) };
        cur.added.push(l);
        hunk?.added.push(l);
        hunk?.lines.push(text);
        continue;
      }
      if (c === '-') {
        oldLeft--;
        const l = { line: oldNo++, text: text.slice(1) };
        cur.removed.push(l);
        hunk?.removed.push(l);
        hunk?.lines.push(text);
        continue;
      }
      if (c === ' ' || text === '') {
        oldLeft--;
        newLeft--;
        oldNo++;
        newNo++;
        hunk?.lines.push(text);
        continue;
      }
      if (c === '\\') {
        hunk?.lines.push(text);
        continue;
      }
      oldLeft = 0;
      newLeft = 0;
    }
    if (text.startsWith('diff --git ')) {
      finish();
      renameTo = undefined;
      deleted = false;
      cur = { path: pathOfGitHeader(text.slice(11)), binary: false, added: [], removed: [], header: [text], hunks: [] };
      hunk = undefined;
      files.push(cur);
      continue;
    }
    if (cur === undefined) continue;
    // a "no newline" marker after the last counted line still belongs to its hunk
    if (hunk !== undefined && text.startsWith('\\')) {
      hunk.lines.push(text);
      continue;
    }
    const h = HUNK.exec(text);
    if (h !== null) {
      hunk = { lines: [text], added: [], removed: [] };
      cur.hunks.push(hunk);
      oldNo = Number(h[1]);
      oldLeft = h[2] === undefined ? 1 : Number(h[2]);
      newNo = Number(h[3]);
      newLeft = h[4] === undefined ? 1 : Number(h[4]);
      // a zero-length side starts one line later than its number says
      if (oldLeft === 0) oldNo++;
      if (newLeft === 0) newNo++;
      continue;
    }
    if (hunk === undefined && text !== '') cur.header.push(text);
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

/**
 * The one scan bound (D-09): a changed line is matched on its first SCAN_LINE_LIMIT characters only. The bound caps the time an allowed pattern may take per changed line, which is at most
 * two overlapping repeats in a row and 16 routes for one text; exponential shapes, longer runs and more routes are refused at read by backtrack.ts. The total still grows with the number of
 * changed lines, each one costing at most the sum of the patterns' cost on SCAN_LINE_LIMIT characters (08-08b states the figures). Phase 08.8 D-12 caps the total for the patterns whose cost grows
 * with the square of a line's length: see SCAN_OVERLAP_BUDGET.
 */
export const SCAN_LINE_LIMIT = 1000;
/**
 * Phase 08.8 D-12: the total cost one review package may spend on one pattern the guard accepts with two overlapping repeats (overlapRepeats >= 2, for example `.*a.*b`). The cost of such a pattern
 * on a line grows with the square of the line's length, so the budget counts the squared lengths of the lines (after the SCAN_LINE_LIMIT cut) the pattern has read. Measured on a Windows host, Node 24:
 * 175 to 310 ms for one 1000-character line of `a` (1 000 000 squared characters; about 0.26 s in a whole scan), so 12 000 000 lets a pattern read 13 such lines, about 3.4 s, and a package of 200
 * hostile lines against two such team patterns takes about 5 s (16 000 000 took 9 to 11 s; unbudgeted it is about 100 s). Past the budget the pattern is not run on the lines left and the scan reports it once, fail closed
 * (budgetLabel). A pattern with fewer than two overlapping repeats, and a shipped default (see overlapMeter), is never budgeted.
 */
export const SCAN_OVERLAP_BUDGET = 12_000_000;
/** The label of the one report a pattern gets when its budget is spent: the id says which pattern did not read the rest of the package (fail closed, like LONG_LINE). */
export const budgetLabel = (id: string): string => `scan budget of pattern ${id} spent, its remaining lines were not scanned`;

/**
 * The cost meter of one scan call (D-12). `allow(i, length)` is true when pattern `i` may be run on a text of `length` characters and charges the square of the length; it is false once the
 * pattern has read more than `budget` squared characters, which is the first line left unread. A pattern with fewer than two overlapping repeats costs nothing. So does a pattern that is a
 * shipped default (`shipped`: its source and flags equal a default's, which is then that default): the defaults are measured (08-08b) and the guard's chain count rates five of them 2 although
 * each runs in under a millisecond on a hostile 1000-character line, so budgeting them would stop a default on an ordinary large diff.
 */
export function overlapMeter(res: readonly RegExp[], budget: number, shipped: readonly { source?: string; flags?: string }[]): (i: number, length: number) => boolean {
  // a compiled RegExp spells its source its own way (`/` becomes `\/`), so a default is compared as compiled
  const known = new Set<string>();
  for (const d of shipped) {
    try {
      const re = new RegExp(d.source ?? '', d.flags ?? '');
      known.add(`${re.flags}/${re.source}`);
    } catch {
      // a default that does not compile matches nothing
    }
  }
  const heavy = res.map((re) => !known.has(`${re.flags}/${re.source}`) && overlapRepeats(re.source, re.flags) >= 2);
  const spent = res.map(() => 0);
  return (i, length) => {
    if (!heavy[i]) return true;
    if (spent[i] > budget) return false;
    spent[i] += length * length;
    return true;
  };
}
/** The label of the trigger a cut line gets: a line over the bound is never scanned whole and says so (fail closed). */
const LONG_LINE = `line longer than ${SCAN_LINE_LIMIT} characters, not fully scanned`;
const UNREADABLE = 'too large to read as text, so its lines were not scanned';
const tooLong = (text: string): boolean => text.length > SCAN_LINE_LIMIT;
/** The label of the trigger a file git calls binary gets when it is not a known binary type (D-20): a NUL byte on a changed line makes git call a code file binary, and its lines were then never scanned. */
const BINARY_LABEL = 'binary file, its lines were not scanned';
/** Image, font and archive types git rightly calls binary; any other binary file with no text twin is a `cannot` trigger (fail closed). */
export const KNOWN_BINARY = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'zip', 'gz', 'tgz', 'tar', 'bz2', 'xz', '7z', 'pdf']);
/** The extension of a path: the text after the last `.` of its name, lower-cased; empty when the name holds none. */
const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};
const MARKDOWN = /\.(md|mdx|markdown)$/i;
const TEST_FOLDER = new Set(['test', 'tests', '__tests__']);

/** lane.md's definition: under a folder named `test`, `tests` or `__tests__`, or a name holding `.test.` or `.spec.`. */
export const isTestFile = (path: string): boolean => {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  return parts.slice(0, -1).some((d) => TEST_FOLDER.has(d)) || name.includes('.test.') || name.includes('.spec.');
};

/** A path entry of a security pattern compares ignoring letter case: Windows and default macOS open `.MCP.json` as `.mcp.json`. The trigger still names the path as the diff spells it. */
export const pathEntryMatches = (entry: string, path: string): boolean => {
  const e = entry.toLowerCase();
  const p = path.toLowerCase();
  if (e.endsWith('/') || e.includes('/')) return matches(e, p);
  return p === e || p.endsWith('/' + e);
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

/** The line patterns of a spec as regular expressions; a pattern that does not compile (parseSecurityFile reported it as a problem) matches nothing. */
function compileLines(spec: SecuritySpec): { p: SecurityPattern; re: RegExp }[] {
  const out: { p: SecurityPattern; re: RegExp }[] = [];
  for (const p of spec.patterns) {
    if (p.kind !== 'line' || p.source === undefined) continue;
    try {
      out.push({ p, re: new RegExp(p.source, p.flags ?? '') });
    } catch {
      // not compiled: matches nothing
    }
  }
  return out;
}

/** The folders an agent loads and runs code from (D-22): a skill's scripts, a sub-agent's files and the panel. Compared ignoring letter case, as path entries are. */
const AGENT_FOLDERS = ['.claude/skills/', '.agents/skills/', '.claude/agents/', '.claude/accord-panel/'];
const underAgentFolder = (path: string): boolean => {
  const p = path.toLowerCase();
  return AGENT_FOLDERS.some((f) => p.startsWith(f));
};

/**
 * Phase 8.1 D-20: the part of the content skip every content scan shares: a path in `exempt` (exactly an unmodified copy `accord skills sync` writes, decided by the caller), a path the
 * repository's `generated:` lists, and a Markdown file. The slop scan skips exactly these (and the package-manager files slop/match.ts lists) and judges test files; the security scan adds its test clause below.
 */
export const copyGeneratedOrMarkdown = (path: string, generated: readonly string[], exempt: readonly string[]): boolean =>
  exempt.includes(path) || generated.some((e) => matches(e, path)) || MARKDOWN.test(path);

/**
 * Content patterns are not run over Markdown outside the agent folders, test files outside them, the repository's generated paths or a path in `exempt` (exactly an
 * unmodified copy `accord skills sync` writes, decided by the caller). No folder is skipped as a whole: a file accord does not write, or a copy changed by hand, is scanned.
 * D-22: a test-named file under an agent-loaded folder (AGENT_FOLDERS) is not skipped as a test, because an agent session can run it.
 * Phase 08.8 D-11: Markdown under those folders is scanned too, because a skill or agent file is the instruction an agent follows; an exempt copy or a generated path is skipped first.
 */
const contentSkipped = (path: string, generated: readonly string[], exempt: readonly string[]): boolean =>
  exempt.includes(path) ||
  generated.some((e) => matches(e, path)) ||
  ((MARKDOWN.test(path) || isTestFile(path)) && !underAgentFolder(path));

/**
 * The triggers of a package: path patterns over every changed path (both sides of a rename); content patterns over the added and removed lines of
 * files that are not binary, not Markdown or test files outside the agent folders, not generated and not an exact `exempt` path (nothing is exempt when absent); one `cannot` trigger for each changed path the diff text does not
 * show. Deduplicated and sorted by path, then line, then pattern id.
 */
export function securityTriggers(spec: SecuritySpec, diffText: string, changed: readonly string[], options: ScanOptions): Trigger[] {
  return scanPackage(spec, diffFiles(diffText), changed, options).triggers;
}

type ScanOptions = { generated: readonly string[]; unreadable?: readonly string[]; exempt?: readonly string[]; overlapBudget?: number };

/** The key of one changed line of a file: its path, its side and its number on that side. */
const lineKey = (path: string, removed: boolean, line: number): string => `${path}\0${removed ? 'r' : 'a'}\0${line}`;

/**
 * The one scan of a package: its triggers (securityTriggers) and, Phase 08.8 review WR-05, the key (lineKey) of every changed line a pattern whose budget was spent did not read, the first one
 * (which the triggers name once) and every later one, so matchedHunks prints exactly what this scan left unread, charged in this scan's own order.
 */
function scanPackage(spec: SecuritySpec, files: DiffFile[], changed: readonly string[], options: ScanOptions): { triggers: Trigger[]; unread: Set<string> } {
  const unreadLines = new Set<string>();
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
    for (const p of pathPatterns) if (p.entries.some((e) => pathEntryMatches(e, path))) add({ path, pattern: p.id, label: p.label });
  }
  const lineRes = compileLines(spec);
  const allow = overlapMeter(lineRes.map(({ re }) => re), options.overlapBudget ?? SCAN_OVERLAP_BUDGET, DEFAULT_SECURITY.patterns);
  const budgetReported = new Set<number>();
  const skipped = (path: string): boolean => contentSkipped(path, options.generated, options.exempt ?? []);
  const unreadable = new Set(options.unreadable ?? []);
  for (const f of files) {
    // D-20: a binary file with no text section of the same path, that is not a known image, font or archive, could hide a changed code line behind a NUL byte: it is a trigger of its own.
    // A path the host could not read at all keeps its own, more exact label (below).
    if (f.binary && f.path !== undefined && !skipped(f.path) && !unreadable.has(f.path) && !KNOWN_BINARY.has(extensionOf(f.path)) && !files.some((g) => !g.binary && g.path === f.path)) {
      add({ path: f.path, pattern: '', label: BINARY_LABEL, cannot: true });
    }
    if (f.binary || f.path === undefined || skipped(f.path)) continue;
    const scanLines = (lines: DiffFile['added'], removed: boolean) => {
      for (const l of lines) {
        const head = tooLong(l.text) ? l.text.slice(0, SCAN_LINE_LIMIT) : l.text;
        if (tooLong(l.text)) add({ path: f.path as string, line: l.line, ...(removed ? { removed: true } : {}), pattern: '', label: LONG_LINE, cannot: true });
        lineRes.forEach(({ p, re }, i) => {
          if (!allow(i, head.length)) {
            unreadLines.add(lineKey(f.path as string, removed, l.line));
            // D-12: the pattern's budget is spent: this is the first line it left unread, reported once per call
            if (!budgetReported.has(i)) {
              budgetReported.add(i);
              add({ path: f.path as string, line: l.line, ...(removed ? { removed: true } : {}), pattern: p.id, label: budgetLabel(p.id), cannot: true });
            }
          } else if (re.test(head)) add({ path: f.path as string, line: l.line, ...(removed ? { removed: true } : {}), pattern: p.id, label: p.label });
        });
      }
    };
    scanLines(f.added, false);
    scanLines(f.removed, true);
  }
  for (const path of changed) if (!shown.has(path)) add({ path, pattern: '', label: '', cannot: true });
  // a path the host could not read as text (its --text diff was over the buffer) keeps its "Binary files differ" line and is a trigger of its own
  for (const path of options.unreadable ?? []) add({ path, pattern: '', label: UNREADABLE, cannot: true });
  const triggers = [...out.values()].sort(
    (a, b) => cmp(a.path, b.path) || (a.line ?? 0) - (b.line ?? 0) || cmp(a.pattern, b.pattern) || Number(a.removed === true) - Number(b.removed === true),
  );
  return { triggers, unread: unreadLines };
}

/** The line form of a trigger, as `accord review-package` prints it. */
export function triggerText(t: Trigger): string {
  if (t.cannot === true && t.line !== undefined) return `${t.path}:${t.line}${t.removed === true ? ' (removed)' : ''}: (cannot tell: ${t.label})`;
  if (t.cannot === true && t.label !== '') return `(cannot tell: ${t.path}: ${t.label})`;
  if (t.cannot === true) return `(cannot tell: ${t.path} is not in the diff text)`;
  if (t.line === undefined) return `${t.path}: ${t.pattern} (${t.label})`;
  return `${t.path}:${t.line}${t.removed === true ? ' (removed)' : ''}: ${t.pattern} (${t.label})`;
}

/**
 * The security package's hunks (D-05 (4)): for each file with a trigger, in path order, one block of text. A file with a content match prints its header lines and every
 * hunk that holds a match, whole (the package's `-U10` context), never another hunk. A file with a path match prints every hunk up to `cap` lines (300) and then
 * `(truncated: <n> more lines in <path>)`; a hunk that holds a content match is printed whole even past the cap, so a cut never hides a match. A path the diff text does not
 * show is one block, `(cannot tell: …)`. Phase 08.8 review WR-05: the hunks held are read off the one trigger scan (scanPackage), never a second meter: a hunk holds a line the triggers name
 * (a match, a cut long line, the first line a spent pattern left unread) or any later line a spent pattern did not read, so every "cannot tell" line is printed and nothing unread is hidden.
 */
export function matchedHunks(spec: SecuritySpec, diffText: string, changed: readonly string[], options: ScanOptions & { cap?: number }): string[] {
  const cap = options.cap ?? 300;
  const files = diffFiles(diffText);
  const { triggers, unread } = scanPackage(spec, files, changed, { generated: options.generated, unreadable: options.unreadable, exempt: options.exempt, overlapBudget: options.overlapBudget });
  const pathHit = new Set(triggers.filter((t) => t.cannot !== true && t.line === undefined).map((t) => t.path));
  const held = new Set(unread);
  for (const t of triggers) if (t.line !== undefined) held.add(lineKey(t.path, t.removed === true, t.line));
  const holds = (path: string) => (h: DiffHunk): boolean =>
    h.added.some((l) => held.has(lineKey(path, false, l.line))) || h.removed.some((l) => held.has(lineKey(path, true, l.line)));
  const blocks: { key: string; text: string }[] = [];
  for (const f of files) {
    // a file git reports as binary whose text section follows (package-diff.ts adds it) is printed once, from the text section
    if (f.binary && f.path !== undefined && files.some((g) => !g.binary && g.path === f.path)) continue;
    const name = f.path ?? f.oldPath;
    const byPath = (f.path !== undefined && pathHit.has(f.path)) || (f.oldPath !== undefined && pathHit.has(f.oldPath));
    const content = f.binary || f.path === undefined || contentSkipped(f.path, options.generated, options.exempt ?? []) ? new Set<DiffHunk>() : new Set(f.hunks.filter(holds(f.path)));
    if (!byPath && content.size === 0) continue;
    const lines = [...f.header];
    let budget = cap;
    let left = 0;
    for (const h of f.hunks) {
      if (content.has(h)) {
        lines.push(...h.lines);
        budget = Math.max(0, budget - h.lines.length);
      } else if (byPath) {
        const take = Math.min(budget, h.lines.length);
        lines.push(...h.lines.slice(0, take));
        budget -= take;
        left += h.lines.length - take;
      }
    }
    if (left > 0) lines.push(`(truncated: ${left} more lines in ${name})`);
    blocks.push({ key: name ?? '', text: lines.join('\n') });
  }
  for (const t of triggers) if (t.cannot === true && t.line === undefined) blocks.push({ key: t.path, text: triggerText(t) });
  return blocks.sort((a, b) => cmp(a.key, b.key)).map((b) => b.text);
}
