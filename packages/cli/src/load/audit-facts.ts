// Phase 8.1 G3a (D-08, D-09 step 1): what `accord audit` can tell about a repository from its own files, with no model and no network: the languages and folders git tracks,
// the linter and the rules it turns on, the formatter, how strict type checking is, and the test frameworks. Host loader, read-only and bounded, like detect.ts: it works on the
// paths `git ls-files` lists (the caller gives them), reads at most 200 of the config files among them and at most 1 MiB of each through detect.ts's bounded reader (a link or any
// non-file is skipped), and executes nothing: a config file is text to read, never code to run (T-08.1-15). Every name that reaches the terminal goes through `printable` (T-08.1-14).
import { printable, readBounded } from './detect.js';

/** At most this many config files are read, shallowest first (T-08.1-13). */
const MAX_READS = 200;
/** At most this many rule names are kept (Ruling "facts are machine facts only"). */
const MAX_RULES = 200;
const TOP_LANGUAGES = 8;
const TOP_FOLDERS = 12;

/** A tool and the tracked file that shows it. */
export interface Found {
  tool: string;
  file: string;
}

/** How strict one place's type checking is: `strict` is the verdict, `what` the words the fact prints. */
export interface Typecheck {
  file: string;
  strict: boolean;
  what: string;
}

export interface MachineFacts {
  /** `ts 2, js 1`, the extensions of the tracked files, most files first; `none` when there is no source file */
  languages: string;
  /** `src 2, packages 40`, the top-level tracked folders with their file counts; `none` when there is none */
  layout: string;
  linters: Found[];
  /** the rule names the linter configs turn on, sorted, at most MAX_RULES */
  rules: string[];
  formatters: Found[];
  typechecks: Typecheck[];
  tests: string[];
}

/** The folders accord and the coding tools write themselves, which say nothing about the team's own code. */
const OWN = new Set(['accord', '.claude', '.agents', '.cursor', '.git', 'node_modules']);
/** Extensions that are data, documents or media, not a language the team writes. */
const NOT_LANGUAGE = new Set(['md', 'markdown', 'txt', 'json', 'jsonc', 'json5', 'yml', 'yaml', 'toml', 'lock', 'ini', 'cfg', 'csv', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'pdf', 'snap', 'map', 'xml', 'props', 'sln']);

const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const byCountThenName = (a: [string, number], b: [string, number]): number => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const top = (counts: Map<string, number>, n: number): string => {
  const rows = [...counts].sort(byCountThenName).slice(0, n);
  return rows.length === 0 ? 'none' : rows.map(([name, count]) => `${printable(name)} ${count}`).join(', ');
};

/** The extensions and the folders of the tracked paths, counted. */
function languagesAndLayout(tracked: readonly string[]): { languages: string; layout: string } {
  const exts = new Map<string, number>();
  const folders = new Map<string, number>();
  for (const path of tracked) {
    const parts = path.split('/');
    if (OWN.has(parts[0])) continue;
    if (parts.length > 1) folders.set(parts[0], (folders.get(parts[0]) ?? 0) + 1);
    const base = parts[parts.length - 1];
    const dot = base.lastIndexOf('.');
    if (dot <= 0) continue;
    const ext = base.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9+#_-]{1,10}$/.test(ext) && !NOT_LANGUAGE.has(ext)) exts.set(ext, (exts.get(ext) ?? 0) + 1);
  }
  return { languages: top(exts, TOP_LANGUAGES), layout: top(folders, TOP_FOLDERS) };
}

const ESLINT = /^(?:eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.(?:js|cjs|json|yaml|yml))?)$/;
const PRETTIER = /^(?:\.prettierrc(?:\.(?:json|yaml|yml|json5|js|cjs|mjs|toml))?|prettier\.config\.[cm]?[jt]s)$/;
const STYLELINT = /^(?:\.stylelintrc(?:\.(?:json|yaml|yml|js|cjs|mjs))?|stylelint\.config\.[cm]?js)$/;
const GOLANGCI = /^\.golangci\.(?:ya?ml|toml|json)$/;
const TSCONFIG = /^tsconfig(?:\..+)?\.json$/;
const PROPS = /^Directory\.Build\.props$/;
const CSPROJ = /\.csproj$/;
const OTHER = new Set(['biome.json', 'biome.jsonc', 'ruff.toml', '.ruff.toml', 'pyproject.toml', '.flake8', 'setup.cfg', 'tox.ini', '.pylintrc', 'pylintrc', '.editorconfig', 'package.json', 'rustfmt.toml', '.rustfmt.toml', 'mypy.ini', 'pytest.ini', 'conftest.py']);

/** True for a file name that can show a tool, a type-check setting or a test framework. */
const interesting = (base: string): boolean => OTHER.has(base) || ESLINT.test(base) || PRETTIER.test(base) || STYLELINT.test(base) || GOLANGCI.test(base) || TSCONFIG.test(base) || PROPS.test(base) || CSPROJ.test(base);

/** Quoted rule names set to error, warn, 2 or 1, alone or first in an array, in a config's text. */
const RULE = /["']([@A-Za-z0-9][@A-Za-z0-9/._-]*)["']\s*:\s*(?:["'](?:error|warn)["']|[12]\b|\[\s*(?:["'](?:error|warn)["']|[12]\b))/g;
const DOTNET_RULE = /dotnet_diagnostic\.([A-Za-z0-9]+)\.severity\s*=\s*(?:warning|error)\b/g;
const SELECT_OPEN = /(?:extend-)?select\s*=\s*\[/g;

/**
 * The text between `select = [` (or `extend-select = [`) and the next `]`, for each list in order (U-2). One pass: the search for a closing bracket starts where the previous list ended and stops at
 * the first list with none, so repeated `select=[` in a hostile file costs time linear in its size, not the square of it (a `[^\]]*` group tried from every start took 20 s on 640 KB).
 */
function selectLists(text: string): string[] {
  const lists: string[] = [];
  let from = 0;
  for (;;) {
    SELECT_OPEN.lastIndex = from;
    const open = SELECT_OPEN.exec(text);
    if (open === null) break;
    const start = open.index + open[0].length;
    const close = text.indexOf(']', start);
    if (close < 0) break;
    lists.push(text.slice(start, close));
    from = close + 1;
  }
  return lists;
}

function namesIn(text: string, pattern: RegExp, group = 1): string[] {
  return [...text.matchAll(pattern)].map((m) => m[group]);
}

/** Everything the tracked config files show. `tracked` is the posix paths git lists; `root` is where they are read. */
export function machineFacts(root: string, tracked: readonly string[]): MachineFacts {
  const { languages, layout } = languagesAndLayout(tracked);
  const candidates = tracked
    .filter((p) => interesting(baseOf(p)))
    .sort((a, b) => a.split('/').length - b.split('/').length || (a < b ? -1 : a > b ? 1 : 0));
  const cache = new Map<string, string>();
  let reads = 0;
  const read = (rel: string): string => {
    const hit = cache.get(rel);
    if (hit !== undefined) return hit;
    const text = reads < MAX_READS ? readBounded(root, rel) ?? '' : '';
    reads += 1;
    cache.set(rel, text);
    return text;
  };

  const linters: Found[] = [];
  const formatters: Found[] = [];
  const typechecks: Typecheck[] = [];
  const tests = new Set<string>();
  const rules = new Set<string>();
  const addTo = (list: Found[], tool: string, file: string): void => {
    if (!list.some((f) => f.tool === tool)) list.push({ tool, file });
  };
  const linter = (tool: string, file: string): void => addTo(linters, tool, file);
  const formatter = (tool: string, file: string): void => addTo(formatters, tool, file);
  const keep = (names: string[]): void => {
    for (const name of names) if (rules.size < MAX_RULES) rules.add(name);
  };
  let propsNullable = false;
  const csprojs: { file: string; text: string }[] = [];

  for (const rel of candidates) {
    const base = baseOf(rel);
    const text = read(rel);
    if (ESLINT.test(base)) {
      linter('eslint', rel);
      keep(namesIn(text, RULE));
    } else if (PRETTIER.test(base)) formatter('prettier', rel);
    else if (STYLELINT.test(base)) linter('stylelint', rel);
    else if (GOLANGCI.test(base)) linter('golangci-lint', rel);
    else if (TSCONFIG.test(base)) {
      const explicit = /"strict"\s*:\s*(true|false)/.exec(text);
      if (explicit !== null) typechecks.push({ file: rel, strict: explicit[1] === 'true', what: explicit[1] === 'true' ? 'strict' : 'not strict' });
      else if (/"extends"\s*:/.test(text)) typechecks.push({ file: rel, strict: true, what: 'extends another config' });
      else typechecks.push({ file: rel, strict: false, what: 'not strict' });
    } else if (PROPS.test(base)) {
      if (/<Nullable>\s*enable\s*<\/Nullable>/i.test(text)) propsNullable = true;
      if (/EnableNETAnalyzers|AnalysisMode|AnalysisLevel/.test(text)) linter('dotnet analyzers', rel);
    } else if (CSPROJ.test(base)) {
      csprojs.push({ file: rel, text });
      if (/EnableNETAnalyzers|AnalysisMode|AnalysisLevel/.test(text)) linter('dotnet analyzers', rel);
      if (/xunit/i.test(text)) tests.add('xunit');
      if (/NUnit/i.test(text)) tests.add('nunit');
      if (/MSTest/i.test(text)) tests.add('mstest');
    } else if (base === 'biome.json' || base === 'biome.jsonc') {
      linter('biome', rel);
      formatter('biome', rel);
      keep(namesIn(text, RULE));
    } else if (base === 'ruff.toml' || base === '.ruff.toml') {
      linter('ruff', rel);
      if (/^\[(?:format|lint\.format)\]/m.test(text)) formatter('ruff format', rel);
      for (const list of selectLists(text)) keep(namesIn(list, /["']([A-Za-z0-9]+)["']/g));
    } else if (base === 'pyproject.toml') {
      if (text.includes('[tool.ruff')) {
        linter('ruff', rel);
        if (text.includes('[tool.ruff.format')) formatter('ruff format', rel);
        for (const list of selectLists(text)) keep(namesIn(list, /["']([A-Za-z0-9]+)["']/g));
      }
      if (text.includes('[tool.pylint')) linter('pylint', rel);
      if (text.includes('[tool.black')) formatter('black', rel);
      if (text.includes('[tool.mypy')) typechecks.push({ file: rel, strict: /^\s*strict\s*=\s*true\b/im.test(text), what: /^\s*strict\s*=\s*true\b/im.test(text) ? 'mypy strict' : 'mypy not strict' });
      if (text.includes('[tool.pytest')) tests.add('pytest');
    } else if (base === '.flake8') linter('flake8', rel);
    else if (base === 'setup.cfg' || base === 'tox.ini') {
      if (text.includes('[flake8]')) linter('flake8', rel);
      if (base === 'setup.cfg' && text.includes('[mypy]')) typechecks.push({ file: rel, strict: /^\s*strict\s*=\s*(?:true|True)\b/m.test(text), what: /^\s*strict\s*=\s*(?:true|True)\b/m.test(text) ? 'mypy strict' : 'mypy not strict' });
    } else if (base === 'mypy.ini') typechecks.push({ file: rel, strict: /^\s*strict\s*=\s*(?:true|True)\b/m.test(text), what: /^\s*strict\s*=\s*(?:true|True)\b/m.test(text) ? 'mypy strict' : 'mypy not strict' });
    else if (base === '.pylintrc' || base === 'pylintrc') linter('pylint', rel);
    else if (base === '.editorconfig') {
      formatter('editorconfig', rel);
      if (text.includes('dotnet_diagnostic.') || text.includes('dotnet_analyzer_diagnostic')) {
        linter('dotnet analyzers', rel);
        keep(namesIn(text, DOTNET_RULE));
      }
    } else if (base === 'rustfmt.toml' || base === '.rustfmt.toml') formatter('rustfmt', rel);
    else if (base === 'pytest.ini' || base === 'conftest.py') tests.add('pytest');
    else if (base === 'package.json') {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
        const pkg = json as Record<string, unknown>;
        if (Object.hasOwn(pkg, 'eslintConfig')) {
          linter('eslint', rel);
          keep(namesIn(JSON.stringify(pkg.eslintConfig), RULE));
        }
        if (Object.hasOwn(pkg, 'prettier')) formatter('prettier', rel);
        const deps = ['dependencies', 'devDependencies'].flatMap((k) => (typeof pkg[k] === 'object' && pkg[k] !== null ? Object.keys(pkg[k] as object) : []));
        for (const name of ['vitest', 'jest', 'mocha']) if (deps.includes(name)) tests.add(name);
        const scripts = typeof pkg.scripts === 'object' && pkg.scripts !== null ? (pkg.scripts as Record<string, unknown>) : {};
        if (typeof scripts.test === 'string' && /node(?:\s+--test|:test)/.test(scripts.test)) tests.add('node:test');
      }
    }
  }

  for (const { file, text } of csprojs) {
    const own = /<Nullable>\s*(\w+)\s*<\/Nullable>/i.exec(text);
    if (own !== null) typechecks.push({ file, strict: own[1].toLowerCase() === 'enable', what: `Nullable ${own[1]}` });
    else typechecks.push({ file, strict: propsNullable, what: propsNullable ? 'Nullable enable (Directory.Build.props)' : 'Nullable not set' });
  }

  return { languages, layout, linters, rules: [...rules].sort(), formatters, typechecks, tests: [...tests].sort() };
}
