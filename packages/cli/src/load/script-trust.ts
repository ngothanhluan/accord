// Owner decision (2026-11-15), repository scripts trust: a script the repository declares (`tracker.command`, `git.sync`) is branch content, so it does not run
// until the person allowed it once with `accord trust`, the way `direnv allow` or a workspace-trust prompt works. The allow is a local record that is never
// committed: `<git common dir>/accord-trust.json` (`accord-trust-build.json` for build.regenerate, see RECORD_OF), so every worktree of the repository shares it and nothing under accord/ changes. It is bound to the content, not
// only to the command text: the command text plus a digest of the files the command can reach. A branch that changes the script file, with the command text
// identical, no longer matches and asks again. Built-in adapters (none, github-issues, jira, linear) run no repository script and never come here.
//
// What the command "can reach" is decided from its text and the working tree (see `cover`), and the boundary is a stated limit, not a promise (owner answer, round 3:
// direnv-like). It follows `npm run <name>` (and pnpm, yarn, bun) to the package.json script and the files that names, resolves an extensionless path the way Node and
// PATHEXT do, and binds the whole directory of each script it reaches, recursively; a script at the repository root binds every tracked file outside accord/. A file
// the script loads from another directory, a make or just target's own scripts, and a path built from an environment variable are not covered by the digest.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readlinkSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { gitTracked, UsageError } from './fs.js';

/**
 * The repository-declared scripts, named as in accord/config.yml. ST-LN-92 review round 1 finding 7: `build.regenerate` too; the CLI never runs it (D-06 Ruling), but
 * `accord worktree task merge` prints it for the build stage to run only when it is allowed here.
 */
export type ScriptKind = 'tracker.command' | 'git.sync' | 'build.regenerate' | 'commits.message.command';

/** Every kind, in the order accord trust shows them. */
export const SCRIPT_KINDS: readonly ScriptKind[] = ['tracker.command', 'git.sync', 'build.regenerate', 'commits.message.command'];

/** One allow: a binding of a script kind, its command text and the digest of what it covers. */
interface Allow {
  kind: ScriptKind;
  command: string;
  digest: string;
  /** Each covered file's own hash, so the next refusal and preview can name the files that changed; kept on the newest few allows of a kind only. */
  files?: Record<string, string>;
  allowedAt: string;
}

/**
 * Round 3 WR-03: the allows are a list keyed by binding, oldest first, not one slot per kind. Parallel worktrees whose reached files differ (ticket A edits a
 * script, ticket B matches main) each keep their allow, so allowing in one never cancels the other. A version-1 record (one slot per kind, never released) reads
 * as no allow at all.
 */
interface TrustFile {
  version: 2;
  allows: Allow[];
}

/** How many allows a kind keeps (the oldest go first), and how many of the newest keep their per-file hashes. */
const KEEP_PER_KIND = 16;
const KEEP_FILES_PER_KIND = 4;

/** The root-level files an interpreter or a task runner reads from its working directory, bound when the command names no tracked file. */
export const ROOT_MANIFESTS = [
  'package.json',
  'Makefile',
  'makefile',
  'GNUmakefile',
  'justfile',
  'Justfile',
  'Taskfile.yml',
  'Taskfile.yaml',
  'Rakefile',
  'pyproject.toml',
  'Pipfile',
  'composer.json',
  'Gemfile',
  'deno.json',
  'deno.jsonc',
  'bunfig.toml',
  '.npmrc',
  '.nvmrc',
  '.tool-versions',
  'mise.toml',
  'build.gradle',
  'pom.xml',
  'Cargo.toml',
  'go.mod',
] as const;

/**
 * Round 3 WR-01: a command text or a file name on its way to a terminal. Every control character (C0, DEL, C1) and every invisible format character (bidi overrides,
 * zero-width marks) and line or paragraph separator is written as `<U+XXXX>`, so a command cannot hide its start behind ESC[2K or reorder what the person reads before
 * allowing it. Every other character stays as it is. The form has no backslash, because a usage error prints every `\` as `/`.
 */
export function shown(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (ch) => '<U+' + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0') + '>');
}

/**
 * ST-LN-92 review round 2 finding 6: the record file each kind's allows live in. 0.5.1 reads `accord-trust.json` keeping only the entries of the kinds it knows, and
 * rewrites it with those alone on its next allow or revoke (and reads a record of another version as none, then writes version 2 over it), so an allow of a newer kind
 * kept there would be erased by an older accord sharing the clone. `build.regenerate` therefore has a file of its own, which 0.5.1 never opens.
 * Phase 8.1 (Ruling "trust record"): every kind that phase adds (`commits.message.command`, then `pr.command` and `audit.command`) records in `accord-trust-conventions.json`, for the same reason:
 * an accord that does not know the kind rewrites the files it knows, and would erase the allow. Only this table names the file; the kinds gain no behaviour of their own (same runner, refusal, digest and revoke).
 */
const RECORD_OF: Readonly<Record<ScriptKind, string>> = {
  'tracker.command': 'accord-trust.json',
  'git.sync': 'accord-trust.json',
  'build.regenerate': 'accord-trust-build.json',
  'commits.message.command': 'accord-trust-conventions.json',
};

/** Every record file name, in the order of the kinds. */
const RECORDS: readonly string[] = [...new Set(SCRIPT_KINDS.map((k) => RECORD_OF[k]))];

/** The kinds whose allows live in record `name`. */
const kindsIn = (name: string): ScriptKind[] => SCRIPT_KINDS.filter((k) => RECORD_OF[k] === name);

/** A record file (`accord-trust.json` unless named) inside the repository's common git directory, which all worktrees share and git never tracks. */
export function trustFile(root: string, name = 'accord-trust.json'): string {
  let common = commonDirs.get(root);
  if (common === undefined) {
    common = resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim());
    commonDirs.set(root, common);
  }
  return join(common, name);
}

/** The common git directory of each root asked about in this process, so one command asks git once. */
const commonDirs = new Map<string, string>();

/**
 * The words of a command, shell quotes removed and a quoted run kept whole, so `"./my scripts/sync.sh"` is one word; `starts` holds the index of each word that
 * begins a command of its own (the first word, and the first after `;`, `&`, `|`, `(`, `)` or a line break).
 */
function words(command: string): { ws: string[]; starts: Set<number> } {
  const out: string[] = [];
  const starts = new Set<number>([0]);
  let word = '';
  let quote: string | undefined;
  const flush = (): void => {
    if (word !== '') out.push(word);
    word = '';
  };
  for (const ch of command) {
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
      else word += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (/[;&|()\n\r]/.test(ch)) {
      flush();
      starts.add(out.length);
    } else if (/[\s<>]/.test(ch)) flush();
    else word += ch;
  }
  flush();
  return { ws: out, starts };
}

/** The programs that run the word after their options as a script or a program of its own: interpreters, shells and the wrappers that start one. */
const LAUNCHERS = /^(node|nodejs|deno|bun|tsx|ts-node|python[0-9.]*|py|pypy[0-9.]*|bash|sh|zsh|dash|ksh|fish|pwsh|powershell|ruby|perl|php|env|npx|bunx|pnpx|cross-env|time|nice|nohup|exec|command|call|cmd|start)$/i;

/**
 * Round 4 WR-06 (Ruling R10): the indexes of the words in script position, the only ones a bare word (no `/` or `\`) is tried at with an added extension. A word
 * is in script position when it starts a command, or is the first word after one in script position that is not an option (`-x`, `/c`) or an assignment
 * (`A=1`), when that one is the command itself or a launcher (`node`, `bash`, `env`, `npx` ...). So `node tracker` and `env A=1 node tracker` reach `tracker.mjs`,
 * and the `main` of `--since main` or the `origin main` of `git pull origin main` is matched only as it is written.
 */
function scriptPositions(ws: readonly string[], starts: ReadonlySet<number>): Set<number> {
  const at = new Set<number>();
  let expect = false;
  let skip = false;
  ws.forEach((w, i) => {
    if (starts.has(i)) {
      at.add(i);
      expect = true;
      skip = false;
      return;
    }
    if (!expect || skip) {
      skip = false;
      return;
    }
    if (w.startsWith('-') || /^\/[a-z?]$/i.test(w) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
      skip = VALUE_OPTIONS.test(w);
      return;
    }
    at.add(i);
    expect = LAUNCHERS.test((w.split(/[\\/]/).pop() ?? '').replace(/\.(exe|cmd|bat|ps1)$/i, ''));
  });
  return at;
}

/** Round 5 WR-01: the Node options whose value is the next word (`--env-file .env`, `-r dotenv/config`), so that word is not taken for the script. */
const VALUE_OPTIONS = /^(-r|--require|--import|--loader|--experimental-loader|--env-file|--env-file-if-exists|-C|--conditions|--input-type|--title|--disable-warning|--inspect-port|--debug-port|--redirect-warnings|--watch-path|--experimental-config-file|--test-reporter|--test-reporter-destination|--test-name-pattern|--test-skip-pattern)$/;

/** The extensions tried after a word with none, in the order Node's resolver and the Windows PATHEXT try theirs, then the common script interpreters'. */
const EXTENSIONS = ['.js', '.json', '.node', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.cmd', '.bat', '.ps1', '.exe', '.com', '.sh', '.bash', '.py', '.rb', '.pl'];

/** Each package manager and the root files it reads before it runs a package.json script; a name ending in `/` is a directory, bound recursively. */
const RUNNERS: Record<string, readonly string[]> = {
  npm: ['package.json', '.npmrc'],
  pnpm: ['package.json', '.npmrc', 'pnpm-workspace.yaml', '.pnpmfile.cjs'],
  yarn: ['package.json', '.npmrc', '.yarnrc', '.yarnrc.yml', '.pnp.cjs', '.pnp.loader.mjs', '.yarn/releases/', '.yarn/plugins/'],
  bun: ['package.json', 'bunfig.toml'],
};

/** The words after a package manager that run the package.json script named next (`npm run x`, `npm run-script x`); any other word is taken as the script name itself (`yarn x`, `npm test`). */
const RUN_WORDS = new Set(['run', 'run-script', 'rum', 'urn', 'rr']);
const SCRIPT_ALIASES: Record<string, string> = { t: 'test', tst: 'test' };

/** How deep a package.json script that runs another one (`"a": "npm run b"`) is followed. */
const SCRIPT_DEPTH = 8;

/** The unit that stands for every tracked file outside accord/: the directory of a script that sits at the repository root. */
export const ROOT_UNIT = './';

/**
 * What an allow covers. `units` is what a person reads: a tracked file, a directory written with a trailing `/` that stands for every tracked file below it at any
 * depth, or `./` for every tracked file outside accord/ (the ticket records). `files` is what the units hold: the tracked files hashed into the digest, sorted.
 */
export interface Cover {
  units: string[];
  files: string[];
  /** The forms in the command (or a package.json script it follows) that accord knows run more code and does not follow, named as NOT_CHECKED names them. */
  unfollowed: string[];
}

/** Owner answer, round 4: the cover is frozen at the forms above, and the output says plainly what it does not check. Printed by `accord trust`, shown and allowing. */
export const NOT_CHECKED =
  'accord checks only the files listed above; anything else the command loads is not checked: other runner forms (node --run, npm -w/--workspace, bash -c or sh -c "...", node -e, python -m, npm install lifecycle scripts, .npmrc node-options), files outside the listed directories, make or just targets, paths built from environment variables, programs on PATH and node_modules - whoever allows a script must review the pull request that changed it';

/**
 * Round 4 CR-01, WR-03, IN-02 (documented gaps): the forms word `i` starts that run more code than the cover follows. This only names them, so the output does not
 * read as complete; it binds nothing more (the coverage is frozen).
 */
function unfollowedIn(ws: readonly string[], i: number, runner: string | undefined): string[] {
  const base = (ws[i].split(/[\\/]/).pop() ?? '').replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase();
  const after = ws.slice(i + 1);
  const has = (re: RegExp): boolean => after.some((w) => re.test(w));
  const found: string[] = [];
  if (/^(node|nodejs)$/.test(base) && has(/^--run(=|$)/)) found.push('node --run');
  if (runner !== undefined && has(/^(-w|--workspaces?(=.*)?|--prefix(=.*)?|-C|--dir(=.*)?|--filter(=.*)?|-F|--cwd(=.*)?|workspaces?)$/)) found.push('npm -w/--workspace');
  if (runner !== undefined && has(/^(install|i|ci|add|rebuild|install-test|it|install-ci-test)$/)) found.push('npm install lifecycle scripts');
  if (/^(npx|bunx|pnpx)$/.test(base) || (runner !== undefined && has(/^(exec|x|dlx)$/))) found.push('npx');
  if (/^(bash|sh|zsh|dash|ksh|fish|pwsh|powershell)$/.test(base) && has(/^(-c|-command|-encodedcommand)$/i)) found.push('bash -c');
  if (base === 'cmd' && has(/^\/[ck]$/i)) found.push('bash -c');
  if (/^(node|nodejs|deno|bun|ruby|perl|php)$/.test(base) && has(/^(-e|--eval(=.*)?|-p|--print(=.*)?|eval)$/)) found.push('node -e');
  if (/^(python[0-9.]*|py|pypy[0-9.]*)$/.test(base) && has(/^-c$/)) found.push('node -e');
  if (/^(python[0-9.]*|py|pypy[0-9.]*)$/.test(base) && has(/^-m/)) found.push('python -m');
  if (/^(make|gmake|just|task|rake|gradle|gradlew|mvn|mvnw)$/.test(base)) found.push('make or just targets');
  if (/\$|%[A-Za-z_][A-Za-z0-9_]*%/.test(ws[i])) found.push('paths built from environment variables');
  if (/\s/.test(ws[i])) found.push('bash -c');
  return found;
}

/** The package.json of the working tree, when it parses: its scripts and its main. */
function packageOf(root: string): { scripts: Record<string, unknown>; main: unknown } | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { scripts, main } = parsed as { scripts?: unknown; main?: unknown };
    return { scripts: typeof scripts === 'object' && scripts !== null ? (scripts as Record<string, unknown>) : {}, main };
  } catch {
    return undefined;
  }
}

/** A word as a posix path relative to the root, or undefined when it points outside the repository. */
function inside(root: string, raw: string): string | undefined {
  const rel = relative(root, resolve(root, raw.replaceAll('\\', '/'))).split(sep).join('/');
  return rel === '..' || rel.startsWith('../') || isAbsolute(rel) ? undefined : rel;
}

/**
 * What the command can run in the repository, from its text and the working tree (see `Cover`). Each path is matched to the tracked files without regard to case,
 * on every system, because Windows and macOS open `Scripts/x.mjs` as `scripts/x.mjs`.
 * - A word that is a tracked file, or becomes one with an extension Node, PATHEXT or an interpreter adds (`node scripts/tracker` runs `scripts/tracker.js`), binds the
 *   directory of that file recursively; a file at the repository root binds `./`. A word that is a tracked directory binds that directory.
 * - `.` (as in `node .`) binds package.json and the main it names (`index` when it names none), resolved the same way.
 * - npm, pnpm, yarn or bun binds the files that runner reads (package.json, .npmrc and the like) and follows the package.json script it runs, with its `pre` and `post`
 *   scripts, as a command of its own.
 * - When no word reaches a file of the repository, the root manifests an interpreter or task runner reads from the working directory are bound.
 * Not covered, and stated as such: a file the script loads from another directory, a make or just target's own scripts, a path built from an environment variable,
 * and anything outside the repository (a program on PATH, installed dependencies).
 */
export function cover(root: string, command: string, tracked: readonly string[] = gitTracked(root)): Cover {
  const byLower = new Map<string, string[]>();
  for (const f of tracked) byLower.set(f.toLowerCase(), [...(byLower.get(f.toLowerCase()) ?? []), f]);
  const units = new Set<string>();
  let named = false;
  const files = (rel: string): string[] => byLower.get(rel.toLowerCase()) ?? [];
  const directories = (rel: string): string[] => {
    const prefix = rel.toLowerCase() + '/';
    return [...new Set(tracked.filter((f) => f.toLowerCase().startsWith(prefix)).map((f) => f.slice(0, prefix.length)))];
  };
  /** Bind what `rel` names as a script or a directory; true when it names something tracked. `probe` adds the extensions (a word in script position, or a path). */
  const script = (rel: string, probe = true): boolean => {
    const hits = [rel, ...(probe ? EXTENSIONS.map((e) => rel + e) : [])].flatMap(files);
    for (const f of hits) units.add(f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : ROOT_UNIT);
    const dirs = rel === '' ? [] : directories(rel);
    for (const d of dirs) units.add(d);
    return hits.length + dirs.length > 0;
  };
  const runnerFiles = (name: string): void => {
    for (const f of name.endsWith('/') ? directories(name.slice(0, -1)) : files(name)) units.add(f);
  };
  const pkg = packageOf(root);
  const followed = new Set<string>();
  const unfollowed = new Set<string>();
  const visit = (text: string, depth: number): void => {
    const { ws, starts } = words(text);
    const positions = scriptPositions(ws, starts);
    // `run` and the script name after it name no file; a bare name (`yarn x`, `npm test`) is still tried as a path too, since a flag with a value can shift it
    const scriptNames = new Set<number>();
    ws.forEach((word, i) => {
      if (scriptNames.has(i)) return;
      const runner = /^(npm|pnpm|yarn|bun)(\.cmd|\.exe|\.ps1)?$/i.exec(word.split(/[\\/]/).pop() ?? '')?.[1].toLowerCase();
      for (const u of unfollowedIn(ws, i, runner)) unfollowed.add(u);
      if (runner !== undefined) {
        for (const f of RUNNERS[runner]) runnerFiles(f);
        const rest = ws.map((w, j) => ({ w, j })).filter(({ w, j }) => j > i && !w.startsWith('-'));
        const at = rest[0] !== undefined && RUN_WORDS.has(rest[0].w) ? 1 : 0;
        if (at === 1) for (const r of rest.slice(0, 2)) scriptNames.add(r.j);
        const name = rest[at] === undefined ? undefined : at === 1 ? rest[at].w : (SCRIPT_ALIASES[rest[at].w] ?? rest[at].w);
        if (name !== undefined && depth >= SCRIPT_DEPTH) unfollowed.add(`a package.json script chain deeper than ${SCRIPT_DEPTH}`);
        if (name !== undefined && depth < SCRIPT_DEPTH) {
          for (const n of ['pre' + name, name, 'post' + name]) {
            const body = pkg?.scripts[n];
            if (typeof body === 'string' && !followed.has(n)) {
              followed.add(n);
              visit(body, depth + 1);
            }
          }
        }
      }
      for (const raw of word.includes('=') ? [word, word.slice(word.lastIndexOf('=') + 1)] : [word]) {
        const rel = inside(root, raw);
        if (rel === undefined) continue;
        if (rel === '') {
          for (const f of files('package.json')) units.add(f);
          const main = inside(root, typeof pkg?.main === 'string' && pkg.main !== '' ? pkg.main : 'index');
          if (main !== undefined && main !== '' && script(main)) named = true;
        } else if (script(rel, positions.has(i) || /[\\/]/.test(raw))) named = true;
      }
    });
  };
  visit(command, 0);
  if (!named) for (const m of ROOT_MANIFESTS) for (const f of files(m)) units.add(f);
  // round 4 WR-01: every component is matched without regard to case, so an index entry `Scripts/lib.mjs` (one folder on Windows and macOS) is held by `scripts/`
  const held = new Set<string>();
  for (const u of units) {
    if (u === ROOT_UNIT) for (const f of tracked) if (!isRecords(f)) held.add(f);
    if (u !== ROOT_UNIT && u.endsWith('/')) for (const f of tracked) if (under(f, u)) held.add(f);
    if (!u.endsWith('/')) held.add(u);
  }
  return { units: [...units].sort(), files: [...held].sort(), unfollowed: [...unfollowed].sort() };
}

/** True when the tracked path `f` lies below the directory unit `u` (ending in `/`), compared without regard to case. */
function under(f: string, u: string): boolean {
  return f.toLowerCase().startsWith(u.toLowerCase());
}

/** True for a path under accord/ (the ticket records), whatever the case of the folder's name. */
function isRecords(f: string): boolean {
  return under(f, 'accord/');
}

/** The tracked files the command can reach (the `files` of its `cover`), as posix paths relative to the root, sorted. */
export function reach(root: string, command: string, tracked: readonly string[] = gitTracked(root)): string[] {
  return cover(root, command, tracked).files;
}

/** The units of a cover as one phrase a person reads: `scripts/ (2 files), package.json`, or `no file of the repository`. */
export function coverText(c: Cover): string {
  if (c.units.length === 0) return 'no file of the repository';
  const count = (u: string): number => (u === ROOT_UNIT ? c.files.filter((f) => !isRecords(f)) : c.files.filter((f) => under(f, u))).length;
  const plural = (n: number): string => `${n} file${n === 1 ? '' : 's'}`;
  return c.units.map((u) => (u === ROOT_UNIT ? `./ (every tracked file outside accord/, ${plural(count(u))})` : u.endsWith('/') ? `${shown(u)} (${plural(count(u))})` : shown(u))).join(', ');
}

/** git, run in `cwd`, with its output as text; `input` goes to its stdin. */
function gitText(cwd: string, args: readonly string[], input?: string | Buffer): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...(input === undefined ? {} : { input }) });
}

/** The working tree's index: the object id and mode of each path at stage 0. A conflicted path has no id here, so it is read from the working tree. */
interface IndexEntries {
  paths: string[];
  id: Map<string, { mode: string; oid: string }>;
}

/** `git ls-files -s -z`, read NUL-separated: every tracked path, sorted, and the id git holds for each one. */
function indexEntries(root: string): IndexEntries {
  let out: string;
  try {
    out = gitText(root, ['ls-files', '-s', '-z']);
  } catch {
    throw new UsageError('git ls-files failed in ' + root);
  }
  const id = new Map<string, { mode: string; oid: string }>();
  const paths = new Set<string>();
  for (const rec of out.split('\0')) {
    const m = /^(\d+) ([0-9a-f]+) (\d)\t(.*)$/s.exec(rec);
    if (m === null) continue;
    paths.add(m[4]);
    if (m[3] === '0') id.set(m[4], { mode: m[1], oid: m[2] });
  }
  return { paths: [...paths].sort(), id };
}

/**
 * Round 4 WR-02, WR-06: the content id of each covered file as it is in the working tree (that is what would run), read through git rather than by reading every
 * file. A file git sees unchanged takes the object id the index holds: the blob of a regular file (a file of any size, with its line endings as git stores
 * them, so a checkout with `core.autocrlf` digests like one without), the link text of a symlink, the commit of a submodule (gitlink). A file `git diff-files`
 * reports changed is hashed the way `git add` would store it: a regular file by `git hash-object` (streamed), a symlink by its link text, a checked-out
 * submodule by the commit it has checked out. `missing` is kept for a path that is not on disk.
 */
function contentIds(root: string, files: readonly string[], index: IndexEntries): Record<string, string> {
  const changed = new Set(gitText(root, ['diff-files', '--name-only', '-z', '--ignore-submodules=none']).split('\0'));
  const ids: Record<string, string> = {};
  const hashLater: string[] = [];
  for (const f of files) {
    const entry = index.id.get(f);
    const abs = join(root, ...f.split('/'));
    if (entry?.mode === '160000') {
      // a submodule: the commit checked out when it is, else the commit the index records
      let head = '';
      try {
        if (existsSync(join(abs, '.git'))) head = gitText(abs, ['rev-parse', '--verify', '-q', 'HEAD']).trim();
      } catch {
        /* a submodule git cannot read: the commit the index records */
      }
      ids[f] = head === '' ? entry.oid : head;
      continue;
    }
    if (entry !== undefined && !changed.has(f)) {
      ids[f] = entry.oid;
      continue;
    }
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(abs);
    } catch {
      ids[f] = 'missing';
      continue;
    }
    if (st.isSymbolicLink()) ids[f] = gitText(root, ['hash-object', '--no-filters', '--stdin'], readlinkSync(abs, { encoding: 'buffer' })).trim();
    else if (st.isFile()) hashLater.push(f);
    else ids[f] = 'missing';
  }
  // `--stdin-paths` reads one path per line; a name holding a line break or starting with a quote is hashed on its own
  const plain = hashLater.filter((f) => !f.includes('\n') && !f.startsWith('"'));
  const alone = hashLater.filter((f) => f.includes('\n') || f.startsWith('"'));
  if (plain.length > 0) {
    const out = gitText(root, ['hash-object', '--stdin-paths'], plain.join('\n') + '\n').trim().split('\n');
    plain.forEach((f, i) => (ids[f] = out[i]));
  }
  for (const f of alone) ids[f] = gitText(root, ['hash-object', '--', f]).trim();
  return ids;
}

/** The digest of the command text and of each covered file's content id, in path order. */
function digestOf(command: string, files: readonly string[], ids: Record<string, string>): string {
  const hash = createHash('sha256');
  hash.update('command\0' + command + '\n');
  for (const f of files) hash.update(f + '\0' + ids[f] + '\n');
  return 'sha256:' + hash.digest('hex');
}

/** One digest of the command text and of every file it reaches, as they are in the working tree (that is what would run), with each file's own content id. */
export function scriptDigest(root: string, command: string): { digest: string; hashes: Record<string, string> } & Cover {
  const index = indexEntries(root);
  const { units, files, unfollowed } = cover(root, command, index.paths);
  const hashes = contentIds(root, files, index);
  return { digest: digestOf(command, files, hashes), hashes, units, files, unfollowed };
}

/** One allow as read from disk: a known kind, a command and a digest as strings, and `files`, when present, a plain map of strings. */
function isAllow(a: unknown): a is Allow {
  if (typeof a !== 'object' || a === null || Array.isArray(a)) return false;
  const { kind, command, digest, files, allowedAt } = a as Record<string, unknown>;
  if (!(SCRIPT_KINDS as readonly unknown[]).includes(kind) || typeof command !== 'string' || typeof digest !== 'string') return false;
  if (allowedAt !== undefined && typeof allowedAt !== 'string') return false;
  if (files === undefined) return true;
  return typeof files === 'object' && files !== null && !Array.isArray(files) && Object.values(files).every((v) => typeof v === 'string');
}

/**
 * The record as it is on disk, and what of it was not read: `ignored` counts the entries that are not a valid allow (round 4 IN-01: a hand edit or a bad write is
 * read as no allow, never a crash), `unreadable` is true when the file is there but is not a version-2 record at all.
 */
function readRecord(root: string, name: string): { record: TrustFile; ignored: number; unreadable: boolean } {
  let text: string;
  try {
    text = readFileSync(trustFile(root, name), 'utf8');
  } catch {
    return { record: { version: 2, allows: [] }, ignored: 0, unreadable: false };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === 'object' && parsed !== null && (parsed as TrustFile).version === 2 && Array.isArray((parsed as TrustFile).allows)) {
      const all = (parsed as { allows: unknown[] }).allows;
      const allows = all.filter((a): a is Allow => isAllow(a) && kindsIn(name).includes(a.kind));
      return { record: { version: 2, allows }, ignored: all.length - allows.length, unreadable: false };
    }
  } catch {
    /* not JSON: read as no allow */
  }
  return { record: { version: 2, allows: [] }, ignored: 0, unreadable: true };
}

function read(root: string, name: string): TrustFile {
  return readRecord(root, name).record;
}

/** The warning to print when a record holds entries accord could not read, or is not a record at all, one line per record file; undefined when they read whole. */
export function recordWarning(root: string): string | undefined {
  const lines = RECORDS.flatMap((name) => {
    const { ignored, unreadable } = readRecord(root, name);
    const file = shown(trustFile(root, name).replaceAll('\\', '/'));
    if (unreadable) return [`warning: ${file} is not a trust record accord can read, so it is read as no allow; the next accord trust allow writes it again`];
    if (ignored > 0) return [`warning: ${file}: ${ignored} ${ignored === 1 ? 'entry is' : 'entries are'} not a valid allow and ${ignored === 1 ? 'was' : 'were'} ignored`];
    return [];
  });
  return lines.length === 0 ? undefined : lines.join('\n');
}

/** How long a writer waits for the record lock, and the age past which a lock a killed process left behind is taken over. */
const LOCK_WAIT_MS = 15_000;
const LOCK_STALE_MS = 60_000;

/**
 * Round 4 IN-01: run `change` on the record as it is on disk now, under an exclusive lock file beside it, and write what it returns (or remove the record for
 * `'remove'`). Every writer reads the record again inside the lock, so two allows in parallel worktrees both land and an allow made while a revoke ran never
 * brings back what the revoke withdrew.
 */
function update(root: string, name: string, change: (record: TrustFile) => TrustFile | 'remove'): void {
  const file = trustFile(root, name);
  const lock = file + '.lock';
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EBUSY') throw e;
      let age = -1;
      try {
        age = Date.now() - statSync(lock).mtimeMs;
      } catch {
        // round 5 WR-04: no lock file to wait for (EPERM where accord cannot create files): retried until the wait ends, then the OS error is thrown
      }
      if (age > LOCK_STALE_MS) {
        rmSync(lock, { force: true });
        continue;
      }
      if (Date.now() > until) {
        if (age < 0) throw e;
        throw new UsageError(`another accord trust is writing the trust record (its lock ${shown(lock.replaceAll('\\', '/'))} is held) - nothing was changed; run it again, or remove that file if no accord trust is running`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    const next = change(read(root, name));
    if (next === 'remove') rmSync(file, { force: true });
    else write(file, next);
  } finally {
    rmSync(lock, { force: true });
  }
}

/** Write the record whole through a file beside it and a rename, so a reader never sees half of it; the temporary file is removed when the write fails. */
function write(file: string, record: TrustFile): void {
  const part = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(part, JSON.stringify(record, null, 2) + '\n');
    renameSync(part, file);
  } catch (e) {
    rmSync(part, { force: true });
    throw e;
  }
}

/** Where a script stands against the allows of this repository. */
export type TrustState = 'allowed' | 'never' | 'changed' | 'other-command';

/** A declared script as it is now: the cover, the digest, how it stands, and (when an allow of this command exists) the covered files that changed since. */
export interface Inspection extends Cover {
  kind: ScriptKind;
  command: string;
  /** Undefined only from an `if-allowed` inspection of a command no allow names: there is nothing to compare a digest with, so none is computed. */
  digest: string | undefined;
  state: TrustState;
  changed: string[];
}

/** The files added, removed or edited between an allow's hashes and the ones now, sorted. */
function changedFiles(was: Record<string, string> | undefined, now: Record<string, string>): string[] {
  if (was === undefined) return [];
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((f) => was[f] !== now[f]).sort();
}

/** How `command` stands, for `kind`, in the working tree at `root`. */
export function inspect(root: string, kind: ScriptKind, command: string, hash: 'always' | 'if-allowed' = 'always'): Inspection & { hashes: Record<string, string> } {
  // round 4 WR-06: the allows are read first; a check (`if-allowed`) with no allow of this command to compare with computes the cover and hashes nothing
  const mine = read(root, RECORD_OF[kind]).allows.filter((a) => a.kind === kind);
  const same = mine.filter((a) => a.command === command);
  if (hash === 'if-allowed' && same.length === 0) {
    return { kind, command, ...cover(root, command), digest: undefined, hashes: {}, state: mine.length === 0 ? 'never' : 'other-command', changed: [] };
  }
  const now = scriptDigest(root, command);
  const state: TrustState = mine.length === 0 ? 'never' : same.length === 0 ? 'other-command' : same.some((a) => a.digest === now.digest) ? 'allowed' : 'changed';
  // the files that changed are named against the newest allow of this command that still holds its hashes
  const last = [...same].reverse().find((a) => a.files !== undefined);
  return { kind, command, ...now, state, changed: state === 'changed' ? changedFiles(last?.files, now.hashes) : [] };
}

/** The short form of a digest that accord trust shows and `accord trust <script>@<digest>` takes: its first 16 hex characters (64 bits). */
export function shortDigest(digest: string | undefined): string {
  return (digest ?? '').replace(/^sha256:/, '').slice(0, 16);
}

/** A list of paths for one line: the first `max`, then how many more. */
export function listed(paths: readonly string[], max: number): string {
  return paths.slice(0, max).map(shown).join(', ') + (paths.length > max ? ` and ${paths.length - max} more` : '');
}

/**
 * Why `command` may not run, as one line, or undefined when the person allowed exactly this command and exactly these files. The line names the command, why
 * it did not run (and which covered files changed, when an allow of this command exists), what an allow covers, and the commands that show and allow it.
 */
export function scriptRefusal(root: string, kind: ScriptKind, command: string): string | undefined {
  const i = inspect(root, kind, command, 'if-allowed');
  if (i.state === 'allowed') return undefined;
  const why =
    i.state === 'never'
      ? 'has not been allowed in this repository'
      : i.state === 'other-command'
        ? 'is not the command that was allowed'
        : `or the files it reaches changed since it was allowed${i.changed.length === 0 ? '' : ` (changed: ${listed(i.changed, 5)})`}`;
  // round 3 WR-03: the digest is read from this checkout's files, so the line names the checkout; an allow made in another one does not cover this one
  return `${kind} "${shown(command)}" ${why}, so it was not run; an allow covers ${coverText(i)} only, and no other file the command loads is checked${i.unfollowed.length === 0 ? '' : ` (not followed here: ${i.unfollowed.join(', ')})`}; run accord trust in "${shown(root.replaceAll('\\', '/'))}" to see it, then accord trust ${kind}@<the digest it shows> there to allow it (accord trust --revoke withdraws every allow)`;
}

/**
 * Record an allow for each script beside the allows already held (the same binding allowed again moves to the newest place); a kind keeps its newest
 * `KEEP_PER_KIND` allows, and only the newest `KEEP_FILES_PER_KIND` keep their per-file hashes. Returns each script as it stood just before, for the person to read.
 */
export function allowScripts(root: string, scripts: ReadonlyArray<{ kind: ScriptKind; command: string; digest?: string }>): Array<Inspection> {
  // hashed outside the lock (a large cover takes a while), then merged into the record as it is once the lock is held
  const seen = scripts.map((s) => inspect(root, s.kind, s.command));
  if (seen.length === 0) return [];
  // round 4 WR-04: a digest the person copied from the preview must still be the content's, or nothing is written
  for (const [n, s] of scripts.entries()) {
    const now = (seen[n].digest ?? '').replace(/^sha256:/, '');
    if (s.digest !== undefined && !now.startsWith(s.digest)) {
      throw new UsageError(`${s.kind} "${shown(s.command)}" changed since accord trust showed it (digest ${s.digest.slice(0, 16)} is not what it covers now) - nothing was allowed; run accord trust again and read what it shows`);
    }
  }
  const allowedAt = new Date().toISOString();
  // round 2 finding 6: each kind's allows go to its own record file
  for (const name of RECORDS) {
    const here = seen.filter((i) => RECORD_OF[i.kind] === name);
    if (here.length === 0) continue;
    update(root, name, (record) => {
      let allows = record.allows;
      for (const i of here) {
        const digest = i.digest ?? '';
        allows = [...allows.filter((a) => !(a.kind === i.kind && a.command === i.command && a.digest === digest)), { kind: i.kind, command: i.command, digest, files: i.hashes, allowedAt }];
      }
      const kept = kindsIn(name).flatMap((k) => {
        const mine = allows.filter((a) => a.kind === k).slice(-KEEP_PER_KIND);
        return mine.map((a, n) => (n < mine.length - KEEP_FILES_PER_KIND ? { kind: a.kind, command: a.command, digest: a.digest, allowedAt: a.allowedAt } : a));
      });
      return { version: 2, allows: kept };
    });
  }
  return seen.map((i) => ({ kind: i.kind, command: i.command, digest: i.digest, state: i.state, changed: i.changed, units: i.units, files: i.files, unfollowed: i.unfollowed }));
}

/** Withdraw the allows of the kinds named, or of every kind when none is named; returns the kinds that were allowed and are not any more. */
export function revokeScripts(root: string, kinds: readonly ScriptKind[] = []): ScriptKind[] {
  const gone: ScriptKind[] = [];
  for (const name of RECORDS) {
    const mine = kindsIn(name);
    if (kinds.length > 0 && !mine.some((k) => kinds.includes(k))) continue;
    update(root, name, (record) => {
      const had = mine.filter((k) => record.allows.some((a) => a.kind === k));
      const out = kinds.length === 0 ? had : had.filter((k) => kinds.includes(k));
      gone.push(...out);
      return kinds.length === 0 ? 'remove' : { version: 2, allows: record.allows.filter((a) => !out.includes(a.kind)) };
    });
  }
  return SCRIPT_KINDS.filter((k) => gone.includes(k));
}
