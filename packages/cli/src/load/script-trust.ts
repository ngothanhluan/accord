// Owner decision (2026-11-15), repository scripts trust: a script the repository declares (`tracker.command`, `git.sync`) is branch content, so it does not run
// until the person allowed it once with `accord trust`, the way `direnv allow` or a workspace-trust prompt works. The allow is a local record that is never
// committed: `<git common dir>/accord-trust.json`, so every worktree of the repository shares it and nothing under accord/ changes. It is bound to the content, not
// only to the command text: the command text plus a digest of the files the command can reach. A branch that changes the script file, with the command text
// identical, no longer matches and asks again. Built-in adapters (none, github-issues, jira, linear) run no repository script and never come here.
//
// What the command "can reach" is decided from its text and the working tree (see `cover`), and the boundary is a stated limit, not a promise (owner answer, round 3:
// direnv-like). It follows `npm run <name>` (and pnpm, yarn, bun) to the package.json script and the files that names, resolves an extensionless path the way Node and
// PATHEXT do, and binds the whole directory of each script it reaches, recursively; a script at the repository root binds every tracked file outside accord/. A file
// the script loads from another directory, a make or just target's own scripts, and a path built from an environment variable are not covered by the digest.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { gitTracked } from './fs.js';

/** The two repository-declared scripts, named as in accord/config.yml. */
export type ScriptKind = 'tracker.command' | 'git.sync';

/** Every kind, in the order accord trust shows them. */
export const SCRIPT_KINDS: readonly ScriptKind[] = ['tracker.command', 'git.sync'];

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

/** `accord-trust.json` inside the repository's common git directory, which all worktrees share and git never tracks. */
export function trustFile(root: string): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return join(resolve(root, common), 'accord-trust.json');
}

/** The words of a command, shell quotes removed and a quoted run kept whole, so `"./my scripts/sync.sh"` is one word. */
function words(command: string): string[] {
  const out: string[] = [];
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
    else if (/[\s;&|<>()]/.test(ch)) flush();
    else word += ch;
  }
  flush();
  return out;
}

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
  /** Bind what `rel` names as a script or a directory; true when it names something tracked. */
  const script = (rel: string): boolean => {
    const hits = [rel, ...EXTENSIONS.map((e) => rel + e)].flatMap(files);
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
  const visit = (text: string, depth: number): void => {
    const ws = words(text);
    // `run` and the script name after it name no file; a bare name (`yarn x`, `npm test`) is still tried as a path too, since a flag with a value can shift it
    const scriptNames = new Set<number>();
    ws.forEach((word, i) => {
      if (scriptNames.has(i)) return;
      const runner = /^(npm|pnpm|yarn|bun)(\.cmd|\.exe|\.ps1)?$/i.exec(word.split(/[\\/]/).pop() ?? '')?.[1].toLowerCase();
      if (runner !== undefined) {
        for (const f of RUNNERS[runner]) runnerFiles(f);
        const rest = ws.map((w, j) => ({ w, j })).filter(({ w, j }) => j > i && !w.startsWith('-'));
        const at = rest[0] !== undefined && RUN_WORDS.has(rest[0].w) ? 1 : 0;
        if (at === 1) for (const r of rest.slice(0, 2)) scriptNames.add(r.j);
        const name = rest[at] === undefined ? undefined : at === 1 ? rest[at].w : (SCRIPT_ALIASES[rest[at].w] ?? rest[at].w);
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
        } else if (script(rel)) named = true;
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
  return { units: [...units].sort(), files: [...held].sort() };
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

/** The bytes with every CR LF read as LF, so a checkout with `core.autocrlf` (another worktree of the same repository) digests like one without. */
function lf(bytes: Buffer): Buffer {
  return Buffer.from(bytes.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
}

/** One digest of the command text and of the bytes of every file it reaches, as they are in the working tree (that is what would run), with each file's own hash. */
export function scriptDigest(root: string, command: string): { digest: string; hashes: Record<string, string> } & Cover {
  const { units, files } = cover(root, command);
  const hash = createHash('sha256');
  const hashes: Record<string, string> = {};
  hash.update('command\0' + command + '\n');
  for (const f of files) {
    let content: string;
    try {
      content = createHash('sha256').update(lf(readFileSync(join(root, ...f.split('/'))))).digest('hex');
    } catch {
      content = 'missing';
    }
    hashes[f] = content;
    hash.update(f + '\0' + content + '\n');
  }
  return { digest: 'sha256:' + hash.digest('hex'), hashes, units, files };
}

function read(root: string): TrustFile {
  try {
    const parsed: unknown = JSON.parse(readFileSync(trustFile(root), 'utf8'));
    const file = parsed as TrustFile;
    if (typeof file === 'object' && file !== null && file.version === 2 && Array.isArray(file.allows)) {
      const ok = (a: unknown): a is Allow =>
        typeof a === 'object' && a !== null && SCRIPT_KINDS.includes((a as Allow).kind) && typeof (a as Allow).command === 'string' && typeof (a as Allow).digest === 'string';
      return { version: 2, allows: file.allows.filter(ok) };
    }
  } catch {
    /* no record, or one that is not ours: nothing is allowed */
  }
  return { version: 2, allows: [] };
}

/** Write the record whole through a file beside it and a rename, so a reader never sees half of it. */
function write(root: string, record: TrustFile): void {
  const file = trustFile(root);
  const part = `${file}.${process.pid}.tmp`;
  writeFileSync(part, JSON.stringify(record, null, 2) + '\n');
  renameSync(part, file);
}

/** Where a script stands against the allows of this repository. */
export type TrustState = 'allowed' | 'never' | 'changed' | 'other-command';

/** A declared script as it is now: the cover, the digest, how it stands, and (when an allow of this command exists) the covered files that changed since. */
export interface Inspection extends Cover {
  kind: ScriptKind;
  command: string;
  digest: string;
  state: TrustState;
  changed: string[];
}

/** The files added, removed or edited between an allow's hashes and the ones now, sorted. */
function changedFiles(was: Record<string, string> | undefined, now: Record<string, string>): string[] {
  if (was === undefined) return [];
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((f) => was[f] !== now[f]).sort();
}

/** How `command` stands, for `kind`, in the working tree at `root`. */
export function inspect(root: string, kind: ScriptKind, command: string): Inspection & { hashes: Record<string, string> } {
  const now = scriptDigest(root, command);
  const mine = read(root).allows.filter((a) => a.kind === kind);
  const same = mine.filter((a) => a.command === command);
  const state: TrustState = mine.length === 0 ? 'never' : same.length === 0 ? 'other-command' : same.some((a) => a.digest === now.digest) ? 'allowed' : 'changed';
  // the files that changed are named against the newest allow of this command that still holds its hashes
  const last = [...same].reverse().find((a) => a.files !== undefined);
  return { kind, command, ...now, state, changed: state === 'changed' ? changedFiles(last?.files, now.hashes) : [] };
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
  const i = inspect(root, kind, command);
  if (i.state === 'allowed') return undefined;
  const why =
    i.state === 'never'
      ? 'has not been allowed in this repository'
      : i.state === 'other-command'
        ? 'is not the command that was allowed'
        : `or the files it reaches changed since it was allowed${i.changed.length === 0 ? '' : ` (changed: ${listed(i.changed, 5)})`}`;
  // round 3 WR-03: the digest is read from this checkout's files, so the line names the checkout; an allow made in another one does not cover this one
  return `${kind} "${shown(command)}" ${why}, so it was not run; an allow covers ${coverText(i)}; run accord trust in "${shown(root.replaceAll('\\', '/'))}" to see it, then accord trust ${kind} there to allow it (accord trust --revoke withdraws every allow)`;
}

/**
 * Record an allow for each script beside the allows already held (the same binding allowed again moves to the newest place); a kind keeps its newest
 * `KEEP_PER_KIND` allows, and only the newest `KEEP_FILES_PER_KIND` keep their per-file hashes. Returns each script as it stood just before, for the person to read.
 */
export function allowScripts(root: string, scripts: ReadonlyArray<{ kind: ScriptKind; command: string }>): Array<Inspection> {
  let allows = read(root).allows;
  const bound = scripts.map((s) => {
    const { hashes, ...seen } = inspect(root, s.kind, s.command);
    allows = [...allows.filter((a) => !(a.kind === s.kind && a.command === s.command && a.digest === seen.digest)), { kind: s.kind, command: s.command, digest: seen.digest, files: hashes, allowedAt: new Date().toISOString() }];
    return seen;
  });
  if (bound.length === 0) return bound;
  const kept = SCRIPT_KINDS.flatMap((k) => {
    const mine = allows.filter((a) => a.kind === k).slice(-KEEP_PER_KIND);
    return mine.map((a, i) => (i < mine.length - KEEP_FILES_PER_KIND ? { kind: a.kind, command: a.command, digest: a.digest, allowedAt: a.allowedAt } : a));
  });
  write(root, { version: 2, allows: kept });
  return bound;
}

/** Withdraw the allows of the kinds named, or of every kind when none is named; returns the kinds that were allowed and are not any more. */
export function revokeScripts(root: string, kinds: readonly ScriptKind[] = []): ScriptKind[] {
  const record = read(root);
  const had = SCRIPT_KINDS.filter((k) => record.allows.some((a) => a.kind === k));
  const gone = kinds.length === 0 ? had : had.filter((k) => kinds.includes(k));
  if (kinds.length === 0) rmSync(trustFile(root), { force: true });
  else if (gone.length > 0) write(root, { version: 2, allows: record.allows.filter((a) => !gone.includes(a.kind)) });
  return gone;
}
