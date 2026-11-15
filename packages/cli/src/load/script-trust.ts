// Owner decision (2026-11-15), repository scripts trust: a script the repository declares (`tracker.command`, `git.sync`) is branch content, so it does not run
// until the person allowed it once with `accord trust`, the way `direnv allow` or a workspace-trust prompt works. The allow is a local record that is never
// committed: `<git common dir>/accord-trust.json`, so every worktree of the repository shares it and nothing under accord/ changes. It is bound to the content, not
// only to the command text: the command text plus a digest of the files the command can reach. A branch that changes the script file, with the command text
// identical, no longer matches and asks again. Built-in adapters (none, github-issues, jira, linear) run no repository script and never come here.
//
// What the command "can reach" is decided from its text alone (see `reach`), and the boundary is a stated limit, not a promise: the named files, the other tracked files of
// their directory (a script imports its neighbours), and, when the command names no file of the repository, the manifests an interpreter or task runner reads
// from the working directory. A script that loads a file from some other directory is not covered by the digest.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { gitTracked } from './fs.js';

/** The two repository-declared scripts, named as in accord/config.yml. */
export type ScriptKind = 'tracker.command' | 'git.sync';

interface Allow {
  command: string;
  digest: string;
  allowedAt: string;
}

interface TrustFile {
  version: 1;
  allows: Partial<{ [K in ScriptKind]: Allow }>;
}

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

/** `accord-trust.json` inside the repository's common git directory, which all worktrees share and git never tracks. */
export function trustFile(root: string): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return join(resolve(root, common), 'accord-trust.json');
}

/** The words of a command, shell quotes removed and a quoted run kept whole, so `"./my scripts/sync.sh"` is one word; each also tried after its last `=` (`--config=x.json`). */
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
  return out.flatMap((w) => (w.includes('=') ? [w, w.slice(w.lastIndexOf('=') + 1)] : [w]));
}

/**
 * The tracked files the command can reach, as posix paths relative to the root, sorted. A word that is a tracked file puts that file and every tracked file in its
 * directory (below it, or only the root-level files when it sits in the root) in; a word that is a tracked directory puts everything below it in; a word that is
 * not in the repository (a program on PATH, an absolute path elsewhere, a flag) adds nothing. When no word is in the repository the root manifests that exist are in.
 */
export function reach(root: string, command: string, tracked: readonly string[] = gitTracked(root)): string[] {
  const set = new Set(tracked);
  const under = (dir: string): string[] => tracked.filter((f) => (dir === '' ? !f.includes('/') : f.startsWith(dir + '/')));
  const found = new Set<string>();
  let named = false;
  for (const raw of words(command)) {
    const abs = resolve(root, raw.replaceAll('\\', '/'));
    const rel = relative(root, abs).split(sep).join('/');
    if (rel === '' || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) continue;
    if (set.has(rel)) {
      named = true;
      const slash = rel.lastIndexOf('/');
      for (const f of under(slash < 0 ? '' : rel.slice(0, slash))) found.add(f);
    } else if (tracked.some((f) => f.startsWith(rel + '/'))) {
      named = true;
      for (const f of under(rel)) found.add(f);
    }
  }
  if (!named) for (const m of ROOT_MANIFESTS) if (set.has(m)) found.add(m);
  return [...found].sort();
}

/** The bytes with every CR LF read as LF, so a checkout with `core.autocrlf` (another worktree of the same repository) digests like one without. */
function lf(bytes: Buffer): Buffer {
  return Buffer.from(bytes.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
}

/** One digest of the command text and of the bytes of every file it reaches, as they are in the working tree (that is what would run). */
export function scriptDigest(root: string, command: string): { digest: string; files: string[] } {
  const files = reach(root, command);
  const hash = createHash('sha256');
  hash.update('command\0' + command + '\n');
  for (const f of files) {
    let content: string;
    try {
      content = createHash('sha256').update(lf(readFileSync(join(root, ...f.split('/'))))).digest('hex');
    } catch {
      content = 'missing';
    }
    hash.update(f + '\0' + content + '\n');
  }
  return { digest: 'sha256:' + hash.digest('hex'), files };
}

function read(root: string): TrustFile {
  try {
    const parsed: unknown = JSON.parse(readFileSync(trustFile(root), 'utf8'));
    const file = parsed as TrustFile;
    if (typeof file === 'object' && file !== null && file.version === 1 && typeof file.allows === 'object' && file.allows !== null) return file;
  } catch {
    /* no record, or one that is not ours: nothing is allowed */
  }
  return { version: 1, allows: {} };
}

/**
 * Why `command` may not run, as one line, or undefined when the person allowed exactly this command and exactly these files. The line names the command
 * and the way to allow it; when an allow exists for this script but no longer matches it says that the command or the files changed.
 */
export function scriptRefusal(root: string, kind: ScriptKind, command: string): string | undefined {
  const allow = read(root).allows[kind];
  if (allow !== undefined && allow.command === command && allow.digest === scriptDigest(root, command).digest) return undefined;
  const why = allow === undefined ? 'has not been allowed in this repository' : allow.command === command ? 'or the files it reaches changed since it was allowed' : 'is not the command that was allowed';
  return `${kind} "${command}" ${why}, so it was not run; run accord trust to allow it (accord trust --revoke withdraws it)`;
}

/** Record an allow for each script, replacing the one it had; returns what was bound, for the person to read. */
export function allowScripts(root: string, scripts: ReadonlyArray<{ kind: ScriptKind; command: string }>): Array<{ kind: ScriptKind; command: string; digest: string; files: string[] }> {
  const record = read(root);
  const bound = scripts.map((s) => {
    const { digest, files } = scriptDigest(root, s.command);
    record.allows[s.kind] = { command: s.command, digest, allowedAt: new Date().toISOString() };
    return { ...s, digest, files };
  });
  if (bound.length > 0) writeFileSync(trustFile(root), JSON.stringify(record, null, 2) + '\n');
  return bound;
}

/** Withdraw every allow of this repository; returns the kinds that were allowed. */
export function revokeScripts(root: string): ScriptKind[] {
  const kinds = Object.keys(read(root).allows) as ScriptKind[];
  rmSync(trustFile(root), { force: true });
  return kinds;
}
