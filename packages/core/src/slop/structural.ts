// Phase 8.1 D-14: the slop kinds a regex over one added line cannot see. Pure: text in, facts out; the host reads the files from git.
// `new-dependency` compares the names a package manifest holds at HEAD with the names it held at the base. (File growth and orphan files join this module in the next change of this group.)

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
