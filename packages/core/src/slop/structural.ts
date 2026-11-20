// Phase 8.1 D-14: the slop kinds a regex over one added line cannot see. Pure: text in, facts out; the host reads the files from git.
// `new-dependency` compares the names a package manifest holds at HEAD with the names it held at the base; `file-growth` and `orphan-file` judge line counts and the files that name a new file.
import type { AccordConfig } from '../model/snapshot.js';
import { isTestFile } from '../security/match.js';
import { cmp, sortHits } from './match.js';
import type { SlopHit } from './match.js';

/** A dependency name and the line of the manifest that names it. */
export interface NewDependency {
  name: string;
  line: number;
}

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const REQUIREMENTS = /^requirements[\w.-]*\.txt$/i;

/**
 * True for the package manifests the new-dependency kind reads: package.json and composer.json, `*.csproj`, Directory.Packages.props and packages.config, requirements*.txt, pyproject.toml,
 * go.mod, Cargo.toml and Gemfile. A lockfile is not a manifest.
 */
export function isManifest(path: string): boolean {
  const n = baseName(path);
  return (
    n === 'package.json' ||
    n === 'composer.json' ||
    /\.csproj$/i.test(n) ||
    n === 'Directory.Packages.props' ||
    n === 'packages.config' ||
    REQUIREMENTS.test(n) ||
    n === 'pyproject.toml' ||
    n === 'go.mod' ||
    n === 'Cargo.toml' ||
    n === 'Gemfile'
  );
}

// ---- package.json and composer.json: the keys of the dependency objects, with their lines ----

const JSON_TABLES: ReadonlySet<string> = new Set(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'require', 'require-dev']);

type Token = { t: '{' | '}' | '[' | ']' | ':' | ',' } | { t: 's'; v: string; line: number };

/** The tokens of a JSON text that matter here (structure and strings), or undefined when a string does not end. */
function jsonTokens(text: string): Token[] | undefined {
  const out: Token[] = [];
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') line++;
    else if ('{}[]:,'.includes(c)) out.push({ t: c as '{' });
    else if (c === '"') {
      const start = line;
      let v = '';
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') {
          v += text[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (text[i] === '\n') line++;
        v += text[i++];
      }
      if (i >= text.length) return undefined;
      out.push({ t: 's', v, line: start });
    }
  }
  return out;
}

function jsonDeps(text: string): NewDependency[] {
  const tokens = jsonTokens(text);
  if (tokens === undefined) return [];
  const found: NewDependency[] = [];
  const stack: { type: '{' | '['; key?: string }[] = [];
  let pending: string | undefined;
  for (const [i, tok] of tokens.entries()) {
    if (tok.t === '{' || tok.t === '[') {
      stack.push({ type: tok.t, key: pending });
      pending = undefined;
    } else if (tok.t === '}' || tok.t === ']') {
      if (stack.length === 0) return [];
      stack.pop();
    } else if (tok.t === 's' && tokens[i + 1]?.t === ':') {
      pending = tok.v;
      // a key of a dependency object that sits directly in the root object
      if (stack.length === 2 && stack[0].type === '{' && stack[1].type === '{' && JSON_TABLES.has(stack[1].key ?? '')) found.push({ name: tok.v, line: tok.line });
    } else if (tok.t === ',') pending = undefined;
  }
  return stack.length === 0 ? found : [];
}

// ---- line formats ----

const quoted = (text: string): string[] => [...text.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]);

/** The project name of a PEP 508 requirement string (`Rich[extra]>=1; python_version>"3"` is `rich`); undefined when it holds none. */
function requirementName(text: string): string | undefined {
  const m = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(text);
  return m === null ? undefined : m[1].toLowerCase().replace(/[._]+/g, '-');
}

function requirementsDeps(text: string): NewDependency[] {
  const out: NewDependency[] = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const t = raw.trim();
    if (t === '' || t.startsWith('#') || t.startsWith('-') || /^[A-Za-z+]+:\/\//.test(t)) continue;
    const name = requirementName(t);
    if (name !== undefined) out.push({ name, line: i + 1 });
  }
  return out;
}

function xmlDeps(text: string): NewDependency[] {
  const out: NewDependency[] = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const m = /<(?:PackageReference|PackageVersion)\b[^>]*?\bInclude\s*=\s*"([^"]+)"/i.exec(raw) ?? /<package\b[^>]*?\bid\s*=\s*"([^"]+)"/i.exec(raw);
    if (m !== null) out.push({ name: m[1], line: i + 1 });
  }
  return out;
}

function pyprojectDeps(text: string): NewDependency[] {
  const out: NewDependency[] = [];
  let table = '';
  let inArray = false;
  const fromArray = (s: string, line: number) => {
    if (s.includes('include-group')) return;
    for (const q of quoted(s)) {
      const name = requirementName(q);
      if (name !== undefined) out.push({ name, line });
    }
  };
  for (const [i, raw] of text.split('\n').entries()) {
    const line = i + 1;
    if (inArray) {
      const end = raw.indexOf(']');
      fromArray(end < 0 ? raw : raw.slice(0, end), line);
      if (end >= 0) inArray = false;
      continue;
    }
    const header = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(raw);
    if (header !== null) {
      table = header[1].trim();
      continue;
    }
    const arrays = table === 'project' ? /^\s*dependencies\s*=\s*\[(.*)$/.exec(raw) : table === 'project.optional-dependencies' || table === 'dependency-groups' ? /^\s*[\w."'-]+\s*=\s*\[(.*)$/.exec(raw) : null;
    if (arrays !== null) {
      const end = arrays[1].indexOf(']');
      fromArray(end < 0 ? arrays[1] : arrays[1].slice(0, end), line);
      inArray = end < 0;
      continue;
    }
    if (/^tool\.poetry(?:\.group\.[^.]+)?\.(?:dev-)?dependencies$/.test(table)) {
      const m = /^\s*([A-Za-z0-9][\w.-]*)\s*=/.exec(raw);
      if (m !== null && m[1] !== 'python') out.push({ name: m[1].toLowerCase(), line });
    }
  }
  return out;
}

const CARGO_TABLE = /^(?:target\.[^\]]+\.)?(?:workspace\.)?(?:dev-|build-)?dependencies$/;
const CARGO_DOTTED = /^(?:target\.[^\]]+\.)?(?:workspace\.)?(?:dev-|build-)?dependencies\.([\w-]+)$/;

function cargoDeps(text: string): NewDependency[] {
  const out: NewDependency[] = [];
  let names = false;
  for (const [i, raw] of text.split('\n').entries()) {
    const header = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(raw);
    if (header !== null) {
      const h = header[1].trim();
      const dotted = CARGO_DOTTED.exec(h);
      names = CARGO_TABLE.test(h);
      if (dotted !== null) out.push({ name: dotted[1], line: i + 1 });
      continue;
    }
    if (!names) continue;
    const m = /^\s*([A-Za-z0-9_-]+)(?:\.[\w-]+)?\s*=/.exec(raw);
    if (m !== null) out.push({ name: m[1], line: i + 1 });
  }
  return out;
}

function goModDeps(text: string): NewDependency[] {
  const out: NewDependency[] = [];
  let block = false;
  for (const [i, raw] of text.split('\n').entries()) {
    const t = raw.trim();
    if (t.startsWith('//')) continue;
    if (block) {
      if (t.startsWith(')')) block = false;
      else {
        const m = /^(\S+)\s+\S+/.exec(t);
        if (m !== null) out.push({ name: m[1], line: i + 1 });
      }
      continue;
    }
    if (/^require\s*\(\s*(?:\/\/.*)?$/.test(t)) {
      block = true;
      continue;
    }
    const one = /^require\s+([^\s(]+)\s+\S+/.exec(t);
    if (one !== null) out.push({ name: one[1], line: i + 1 });
  }
  return out;
}

function gemfileDeps(text: string): NewDependency[] {
  const out: NewDependency[] = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const m = /^\s*gem\s+['"]([^'"]+)['"]/.exec(raw);
    if (m !== null) out.push({ name: m[1], line: i + 1 });
  }
  return out;
}

/** Every dependency name `text` of the manifest at `path` holds, with its line, in line order. */
function entries(path: string, text: string): NewDependency[] {
  const n = baseName(path);
  if (n === 'package.json' || n === 'composer.json') return jsonDeps(text);
  if (/\.csproj$/i.test(n) || n === 'Directory.Packages.props' || n === 'packages.config') return xmlDeps(text);
  if (REQUIREMENTS.test(n)) return requirementsDeps(text);
  if (n === 'pyproject.toml') return pyprojectDeps(text);
  if (n === 'Cargo.toml') return cargoDeps(text);
  if (n === 'go.mod') return goModDeps(text.replace(/\r/g, ''));
  return n === 'Gemfile' ? gemfileDeps(text) : [];
}

/**
 * The names the manifest at `path` holds in `headText` and did not hold in `baseText`, each at its HEAD line (D-14). A version bump of a name the base held is not a hit, and neither is a name
 * moved between two dependency tables. A missing base text (`undefined`: the file is new) makes every name new; a missing head text (the file is deleted), a file that is no manifest, and a
 * manifest that does not read give none.
 */
export function newDependencies(path: string, baseText: string | undefined, headText: string | undefined): NewDependency[] {
  if (headText === undefined || !isManifest(path)) return [];
  const held = new Set((baseText === undefined ? [] : entries(path, baseText)).map((d) => d.name.toLowerCase()));
  const seen = new Set<string>();
  return entries(path, headText).filter((d) => {
    const key = d.name.toLowerCase();
    if (held.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- file growth ----

/** The default of `slop.max_file_lines`: measured on accord's own source, where 500 sits just under the 95th percentile (538 lines). */
export const DEFAULT_MAX_FILE_LINES = 500;

/** The line bound of a config: `slop.max_file_lines` when it is a digit string of one to six digits that does not start with zero, else the default. */
export function maxFileLines(config: AccordConfig | undefined): number {
  const v = config?.slop?.max_file_lines;
  return typeof v === 'string' && /^[1-9][0-9]{0,5}$/.test(v) ? Number(v) : DEFAULT_MAX_FILE_LINES;
}

/**
 * D-14: a text file that goes from at most `bound` lines to over it, or that is already over and grows by at least a tenth of the bound, is a `file-growth` hit at its last line at HEAD. A file that is
 * merely touched, that shrinks, or that stays under the bound is never flagged. A new file has `baseLines` 0. The caller leaves out the files the slop scan skips (slopSkipped); test files count (D-20).
 */
export function growthHits(files: readonly { path: string; baseLines: number; headLines: number }[], bound: number): SlopHit[] {
  const tenth = Math.ceil(bound / 10);
  const hits: SlopHit[] = [];
  for (const f of files) {
    const crossed = f.baseLines <= bound && f.headLines > bound;
    const grew = f.baseLines > bound && f.headLines - f.baseLines >= tenth;
    if (crossed || grew) hits.push({ kind: 'file-growth', path: f.path, line: f.headLines, label: `grew from ${f.baseLines} to ${f.headLines} lines, past slop.max_file_lines (${bound})` });
  }
  return sortHits(hits);
}

// ---- orphan files ----

const CONFIG_OR_DATA = new Set(['json', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'lock', 'xml']);
const IMAGE_FONT_ARCHIVE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'svg', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'zip', 'gz', 'tgz', 'tar', 'bz2', 'xz', '7z', 'pdf']);
const NOT_CODE_FOLDERS = ['accord/', '.github/', '.claude/', '.agents/'];
const MARKDOWN = /\.(md|mdx|markdown)$/i;

/** True when a new file is one a person finds by its place or name, not by another file naming it: an entry point, a test, a dotfile, a config or data file, an image or Markdown. */
function isEntryPoint(path: string): boolean {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  const ext = dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
  return (
    isTestFile(path) ||
    name.startsWith('.') ||
    parts.slice(0, -1).includes('bin') ||
    NOT_CODE_FOLDERS.some((f) => path.startsWith(f)) ||
    CONFIG_OR_DATA.has(ext) ||
    IMAGE_FONT_ARCHIVE.has(ext) ||
    MARKDOWN.test(path)
  );
}

/** The new files worth a search for a file that names them: `files` without the entry points, sorted and deduplicated. */
export function orphanCandidates(files: readonly string[]): string[] {
  return [...new Set(files.filter((p) => !isEntryPoint(p)))].sort((a, b) => cmp(a, b));
}

/**
 * What another file must hold to name `path`: the whole repository path, and the file stem (`lonely` for `src/lonely.ts`), which is how an import, a require or a manifest names it. A stem under three
 * characters would be found in almost every file, so the whole file name (`x.ts`) stands for it.
 */
export function orphanTerms(path: string): string[] {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return [...new Set([path, stem.length < 3 ? name : stem])];
}

/** D-14: each candidate of `files` that is not in `named` (the new files some other tracked file names) is an `orphan-file` hit at line 1. */
export function orphanHits(files: readonly string[], named: ReadonlySet<string>): SlopHit[] {
  return sortHits(orphanCandidates(files).filter((p) => !named.has(p)).map((p) => ({ kind: 'orphan-file', path: p, line: 1, label: 'no other tracked file names it' })));
}
