// Serves ST-LN-44's criteria and the rule 3 check of its table; deleted with ../st-ln-44.test.ts and
// ../fixtures/st-ln-44/ once the ticket is done. Erasable TypeScript only and Node built-ins only, so
// `node --experimental-strip-types` runs it as a script and vitest imports it.
//
//   node --experimental-strip-types packages/core/test/helpers/st-ln-44.ts <junit> [--out <file>] [--verify]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const ROOT = new URL('../../../../', import.meta.url);
export const TABLE = new URL('accord/tickets/ST-LN-44/table.md', ROOT);

export interface Case {
  file: string;
  title: string;
  time: number;
  status: 'passed' | 'failed' | 'skipped';
}

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');

/** Every `<testcase>` of a junit text. */
export function cases(xml: string): Case[] {
  const out: Case[] = [];
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(m[1])?.[1] ?? '';
    const inner = m[2] ?? '';
    out.push({
      file: unescapeXml(attr('classname')),
      title: unescapeXml(attr('name')),
      time: Number(attr('time')),
      status: /<failure|<error/.test(inner) ? 'failed' : /<skipped/.test(inner) ? 'skipped' : 'passed',
    });
  }
  return out;
}

/** The id accord builds from a report: classname, `#`, the name with every whitespace run turned into `-`. */
export const idOf = (file: string, title: string) => `${file}#${title.replace(/\s+/g, '-')}`;

export interface Dest {
  file: string;
  title: string;
  ceiling?: number;
}
export interface Row {
  n: number;
  file: string;
  title: string;
  tag: string;
  action: string;
  how: string;
  destinations: Dest[];
  note: string;
  ceiling?: number;
}

/** Every table row of table.md: `| n | file | title | tag | action | how | destinations | expected | note |`. */
export function rows(table: string): Row[] {
  const out: Row[] = [];
  for (const line of table.split('\n')) {
    if (!/^\| \d+ \| /.test(line)) continue;
    const text = line.trimEnd();
    const parts = text.slice(2, text.endsWith(' |') ? -2 : undefined).split(' | ');
    const n = Number(parts[0]);
    const note = parts.slice(8).join(' | ');
    const destinations: Dest[] =
      parts[6] === '-'
        ? []
        : parts[6].split('<br>').map((entry) => {
            const p = entry.split(' :: ');
            if (p.length === 2) return { file: p[0], title: p[1] };
            const kept = p.length === 3 ? /^kept (\d+) s$/.exec(p[2]) : null;
            if (kept) return { file: p[0], title: p[1], ceiling: Number(kept[1]) };
            throw new Error(`table row ${n}: bad destination "${entry}"`);
          });
    const c = /Ceiling (\d+) s/.exec(note);
    out.push({
      n,
      file: `packages/${parts[1]}`,
      title: parts[2],
      tag: parts[3],
      action: parts[4],
      how: parts[5],
      destinations,
      note,
      ...(c ? { ceiling: Number(c[1]) } : {}),
    });
  }
  return out;
}

const ACTIONS = ['faster', 'moved', 'merged', 'removed', 'kept', 'unchanged'];

/** What is wrong with the rows of a table: one message per problem. */
export function tableProblems(rs: Row[]): string[] {
  const problems: string[] = [];
  for (let n = 1; n <= 118; n++) {
    const count = rs.filter((r) => r.n === n).length;
    if (count !== 1) problems.push(`row ${n} is present ${count} times`);
  }
  const extra = rs.filter((r) => r.n > 118).map((r) => r.n).sort((a, b) => a - b);
  extra.forEach((n, i) => {
    if (n !== 119 + i) problems.push(`row ${n} breaks the numbering from 119: expected ${119 + i}`);
  });
  for (const r of rs) {
    if (r.n < 1) problems.push(`row ${r.n} is numbered below 1`);
    if (!ACTIONS.includes(r.action)) problems.push(`row ${r.n} has the unknown action "${r.action}"`);
    if (r.action === 'kept' && r.ceiling === undefined) problems.push(`row ${r.n} is kept without a ceiling`);
    if ((r.action === 'moved' || r.action === 'merged') && r.destinations.length === 0)
      problems.push(`row ${r.n} is ${r.action} without a destination`);
    if (r.n > 118) {
      if (r.action !== 'kept') problems.push(`row ${r.n} is above 118 and not kept`);
      if (r.destinations.length > 0) problems.push(`row ${r.n} is above 118 and has destinations`);
    }
  }
  return problems;
}

export interface Entry {
  n?: number;
  file: string;
  title: string;
  action: string;
  time: number;
  ceiling?: number;
  stop: boolean;
}

/** Rule 3 of table.md over one run: the matched tests over 5 s and the outside ones over 10 s, slowest first. */
export function rule3(rs: Row[], cs: Case[]): Entry[] {
  const key = (file: string, title: string) => `${file}\0${title}`;
  const dests = new Map<string, { row: Row; dest: Dest }>();
  const own = new Map<string, Row>();
  for (const r of rs) {
    if (r.action === 'moved' || r.action === 'merged')
      for (const dest of r.destinations) if (!dests.has(key(dest.file, dest.title))) dests.set(key(dest.file, dest.title), { row: r, dest });
    if (!own.has(key(r.file, r.title))) own.set(key(r.file, r.title), r);
  }
  const out: Entry[] = [];
  for (const c of cs) {
    const k = key(c.file, c.title);
    const d = dests.get(k);
    const r = own.get(k);
    let e: Entry;
    if (d) {
      const ceiling = d.dest.ceiling;
      e = { n: d.row.n, file: c.file, title: c.title, action: ceiling === undefined ? 'destination' : 'kept destination', time: c.time, ...(ceiling === undefined ? {} : { ceiling }), stop: c.time > (ceiling ?? 10) };
    } else if (r) {
      const ceiling = r.action === 'kept' ? (r.ceiling ?? 10) : undefined;
      e = { n: r.n, file: c.file, title: c.title, action: r.action, time: c.time, ...(ceiling === undefined ? {} : { ceiling }), stop: c.time > (ceiling ?? 10) };
    } else {
      if (c.time <= 10) continue;
      out.push({ file: c.file, title: c.title, action: 'outside', time: c.time, stop: true });
      continue;
    }
    if (c.time > 5) out.push(e);
  }
  return out.sort((a, b) => b.time - a.time);
}

export function listText(es: Entry[]): string {
  if (es.length === 0) return 'No entry.\n';
  return es
    .map(
      (e) =>
        `- #${e.n ?? '-'} ${e.file} > ${e.title}: ${e.time.toFixed(1)} s, ${e.action}${e.ceiling === undefined ? '' : `, ceiling ${e.ceiling} s`}${e.stop ? ', STOP' : ''}\n`,
    )
    .join('');
}

// --- Source reading: a bracket counter that skips quotes, template literals, comments and regex literals.

/** The index after the string, template or comment that starts at `i`, or `i` itself when none starts there. */
function skipLiteral(src: string, i: number): number {
  const c = src[i];
  if (c === "'" || c === '"') {
    let j = i + 1;
    while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (c === '`') {
    let j = i + 1;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') j += 2;
      else if (src[j] === '$' && src[j + 1] === '{') j = skipBraces(src, j + 2);
      else j++;
    }
    return j + 1;
  }
  if (c === '/' && src[i + 1] === '/') {
    const nl = src.indexOf('\n', i);
    return nl < 0 ? src.length : nl;
  }
  if (c === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end < 0 ? src.length : end + 2;
  }
  if (c === '/') {
    // A regex literal: a `/` after an operator or an opening bracket. shortcut: no keyword like `return` before it, upgrade if a test needs one.
    let p = i - 1;
    while (p >= 0 && /\s/.test(src[p])) p--;
    if (p < 0 || '(,=:[!&|?{};'.includes(src[p])) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') j += 2;
        else if (src[j] === '/' && !inClass) return j + 1;
        else {
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          j++;
        }
      }
    }
  }
  return i;
}

/** The index after the `}` that closes a `${` whose body starts at `i`. */
function skipBraces(src: string, i: number): number {
  let depth = 1;
  let j = i;
  while (j < src.length && depth > 0) {
    const k = skipLiteral(src, j);
    if (k > j) j = k;
    else {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
  }
  return j;
}

const OPEN = '([{';
const CLOSE = ')]}';

/** The end (exclusive) of the statement starting at `start`: its `;` at depth 0, or the end of the line when the counter is back to zero. */
function statementEnd(src: string, start: number): number {
  let depth = 0;
  let j = start;
  while (j < src.length) {
    const k = skipLiteral(src, j);
    if (k > j) {
      j = k;
      continue;
    }
    const c = src[j];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) {
      if (depth === 0) return j;
      depth--;
    } else if (c === ';' && depth === 0) return j + 1;
    else if (c === '\n' && depth === 0) {
      const before = src.slice(start, j).trimEnd();
      const after = /^\s*(.?.?)/.exec(src.slice(j))![1];
      const chained = after[0] === '.' && after !== '..';
      const open = before.endsWith('=>') || before.endsWith('=');
      if (!chained && !open && before.length > 0) return j;
    }
    j++;
  }
  return src.length;
}

/** The end (exclusive) of a `function name(...) { ... }` that starts at `start`. */
function functionEnd(src: string, start: number): number {
  let depth = 0;
  let seen = false;
  let j = start;
  while (j < src.length) {
    const k = skipLiteral(src, j);
    if (k > j) {
      j = k;
      continue;
    }
    const c = src[j];
    if (OPEN.includes(c)) {
      depth++;
      if (c === '{') seen = true;
    } else if (CLOSE.includes(c)) {
      depth--;
      if (depth === 0 && seen && c === '}') return j + 1;
    }
    j++;
  }
  return src.length;
}

interface Decl {
  name: string;
  start: number;
  end: number;
}

/** Every `function name(` and `const name = (async )?(params) =>` or `const name = (async )?param =>` of a source. */
function declarations(src: string): Decl[] {
  const out: Decl[] = [];
  const fn = /(?<![\w$.])(?:async\s+)?function\s+([\w$]+)\s*\(/g;
  const arrow = /(?<![\w$.])const\s+([\w$]+)\s*(?::[^=\n]+)?=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=\n]+?)?=>/g;
  for (const m of src.matchAll(fn)) out.push({ name: m[1], start: m.index, end: functionEnd(src, m.index) });
  for (const m of src.matchAll(arrow)) out.push({ name: m[1], start: m.index, end: statementEnd(src, m.index) });
  return out.sort((a, b) => a.start - b.start);
}

/** The names of the declared functions whose declaration text holds `expect(`. */
export function helpersOf(source: string): string[] {
  const names: string[] = [];
  for (const d of declarations(source))
    if (source.slice(d.start, d.end).includes('expect(') && !names.includes(d.name)) names.push(d.name);
  return names;
}

/** The assertions of a text as a multiset: `expect(...)` statements and calls of the local assertion helpers. */
export function asserts(text: string, helpers: string[]): string[] {
  // Remove the helper declarations first, so a definition is never counted as a call.
  let src = text;
  let upto = -1;
  // Declarations are sorted by start; one inside an earlier removed one goes with it.
  const gone = declarations(src).filter((d) => helpers.includes(d.name) && d.start >= upto && ((upto = d.end), true));
  for (const d of gone.reverse()) src = src.slice(0, d.start) + ' ' + src.slice(d.end);
  const starts = ['expect(', ...helpers.map((h) => `${h}(`)];
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const k = skipLiteral(src, i);
    if (k > i) {
      i = k;
      continue;
    }
    if (!/[\w$.]/.test(src[i - 1] ?? ' ') && starts.some((s) => src.startsWith(s, i))) {
      const end = statementEnd(src, i);
      out.push(src.slice(i, end).replace(/\s+/g, ' ').trim());
      i = Math.max(end, i + 1);
      continue;
    }
    i++;
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text of the test whose last ` > ` segment of `title` is the quoted title of an `it(` call. */
export function body(source: string, title: string): string | undefined {
  const segment = title.split(' > ').pop()!;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const hit = ["'", '"', '`'].some((q) => {
      const quoted = segment.replace(/\\/g, '\\\\').replaceAll(q, `\\${q}`);
      return new RegExp(`\\bit(?:\\.\\w+)*(?:\\([^)]*\\))?\\(\\s*${q}${escapeRe(quoted)}${q}`).test(lines[i]);
    });
    if (!hit) continue;
    if (lines[i].trimEnd().endsWith(';')) return lines[i];
    const indent = /^\s*/.exec(lines[i])![0];
    for (let j = i + 1; j < lines.length; j++)
      if (lines[j].startsWith(`${indent}})`) || lines[j].startsWith(`${indent}}, `)) return lines.slice(i, j + 1).join('\n');
    return lines.slice(i).join('\n');
  }
  return undefined;
}

// --- Script entry.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const junit = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
  const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
  const fail = (message: string): never => {
    process.stderr.write(`${message}\n`);
    process.exit(2);
  };
  if (!junit) fail('usage: st-ln-44.ts <junit> [--out <file>] [--verify]');
  let xml = '';
  let table = '';
  try {
    xml = readFileSync(junit!, 'utf8');
    table = readFileSync(TABLE, 'utf8');
  } catch (e) {
    fail(`cannot read ${(e as { path?: string }).path ?? 'a file'}: ${(e as Error).message}`);
  }
  const rs = rows(table);
  const problems = tableProblems(rs);
  if (problems.length > 0) fail(`table.md: ${problems.join('; ')}`);
  const all = rule3(rs, cases(xml));
  const shown = args.includes('--verify') ? all.filter((e) => e.stop) : all;
  const text = listText(shown);
  if (outFile) writeFileSync(outFile, text, 'utf8');
  else process.stdout.write(text);
  process.exit(all.some((e) => e.stop) ? 1 : 0);
}
