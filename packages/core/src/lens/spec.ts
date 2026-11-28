// Phase 11 D-04, D-05, D-06: a team lens is a checklist a team writes at `accord/lenses/<name>.md`, optionally with `paths:` (the security file's entry forms) and an `on_finding:` mode. The CLI, never a
// model, decides which lenses a review package names: this file reads one lens file and matches it against the changed paths of a package. Pure: the host reads the files and the diff.
import { GLOB_ENTRY, GLOB_ENTRY_REASON, unmatchableEntry } from '../security/entry.js';
import { pathEntryMatches } from '../security/match.js';
import { loadFrontmatter, normaliseText, splitFrontmatter } from '../load/frontmatter.js';

/** The folder of lens files, directly under which each `<name>.md` is one lens. */
export const LENS_DIR = 'accord/lenses/';

/** A lens file is `<name>.md` directly under the lens folder; a file deeper down or of another type is no lens. */
export const isLensFile = (path: string): boolean => path.startsWith(LENS_DIR) && /^[^/]+[.]md$/.test(path.slice(LENS_DIR.length));

/** The lenses accord's own review roles run; a team lens may not take one of these names. */
export const BUILT_IN_LENS_NAMES = ['intent', 'quality', 'security', 'integration', 'both', 'ui'] as const;

/** What a finding of the lens does (D-06): `block` stops the round, `ask` puts the finding to the owner, `warn` records it. */
export type LensMode = 'block' | 'ask' | 'warn';

export interface LensProblem {
  /** The file line, when the reader can name one. */
  line?: number;
  reason: string;
}

export interface LensFile {
  /** The file stem. */
  name: string;
  /** The entries of `paths:`; absent when the lens has none (it runs on every package) or when its frontmatter did not read. */
  paths?: string[];
  /** `on_finding:`, `ask` when absent or unreadable (D-06). */
  mode: LensMode;
  /** The checklist: the text after the frontmatter block. */
  body: string;
  problems: LensProblem[];
}

/** What a lens file's frontmatter may hold, as the fix every frontmatter problem names. */
const KEYS_FIX = 'a lens file may hold only paths (a list of repository paths) and on_finding (block, ask or warn)';

/** The part of one other repository a package carries: its name and the paths its diff changed. */
export interface OtherChange {
  name: string;
  changed: string[];
}

const NEWLINE = /\n/;

const stemOf = (path: string): string => {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.endsWith('.md') ? file.slice(0, -3) : file;
};

/** The lens name rule: lower-case letters, digits and dashes, starting with a letter or a digit. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** The problems of the `paths:` entries: the security file's rules (shared, never a second set), applied to the path part of an entry, with the line of the entry where it can be found. */
function entryProblems(paths: string[], lines: string[], bodyOffset: number): LensProblem[] {
  const out: LensProblem[] = [];
  const inFrontmatter = lines.slice(0, Math.max(bodyOffset - 1, 0));
  const keyLine = inFrontmatter.findIndex((l) => /^\s*paths\s*:/.test(l)) + 1;
  for (const entry of paths) {
    const r = REPO_ENTRY.exec(entry);
    const rest = r === null ? entry : r[2];
    const reason = GLOB_ENTRY.test(rest) ? `the path entry "${entry}" ${GLOB_ENTRY_REASON}` : unmatchableEntry(rest, entry);
    if (reason === undefined) continue;
    const at = inFrontmatter.findIndex((l, n) => n > 0 && l.includes(entry)) + 1;
    const line = at > 0 ? at : keyLine > 0 ? keyLine : undefined;
    out.push({ ...(line === undefined ? {} : { line }), reason });
  }
  return out;
}

/**
 * Read one lens file. Never throws: a file that does not read well gives its reasons in `problems`, each naming the fix, and `accord lint` reports them (lint.lens-file). It still runs on every package rather
 * than silently not at all: a frontmatter that does not read, or a `paths:` entry that can never match, gives no `paths` and mode `ask`. A file with no frontmatter block is a lens with no paths. The name
 * must match the name rule and may not be a built-in lens (BUILT_IN_LENS_NAMES). Ruling R8: no checklist line starts with `#`, so a lens cannot open a heading inside the package; the body is not empty.
 */
export function parseLens(path: string, text: string): LensFile {
  const name = stemOf(path);
  const split = splitFrontmatter(text);
  const lines = normaliseText(text).split(NEWLINE);
  const problems: LensProblem[] = [];
  if (!NAME.test(name)) problems.push({ reason: `the lens name "${name}" (the file name without .md) must match ^[a-z0-9][a-z0-9-]*$; rename the file with lower-case letters, digits and dashes` });
  else if ((BUILT_IN_LENS_NAMES as readonly string[]).includes(name)) {
    problems.push({ reason: `the lens name "${name}" is one of accord's own review lenses (${BUILT_IN_LENS_NAMES.join(', ')}); rename the file` });
  }
  let paths: string[] | undefined;
  let mode: LensMode = 'ask';
  // no block, or a block with nothing in it (blank lines and comments), is a lens with no paths
  if (split.yaml !== null && !split.yaml.split(NEWLINE).every((l) => l.trim() === '' || l.trim().startsWith('#'))) {
    const loaded = loadFrontmatter<{ paths?: string[]; on_finding?: LensMode }>(path, text, 'lens');
    if (loaded.value === undefined) {
      // the fix goes with every reason: the schema's own text ("must NOT have additional properties") names neither the key nor what a lens file may hold
      for (const f of loaded.findings) {
        if (f.rule === 'load.yaml-syntax') problems.push({ line: f.line, reason: f.reason });
        else {
          const key = f.line === undefined ? undefined : /^\s*([A-Za-z0-9_-]+)\s*:/.exec(lines[f.line - 1] ?? '')?.[1];
          problems.push({ line: f.line, reason: `${key === undefined ? '' : `the key "${key}": `}${f.reason}; ${KEYS_FIX}` });
        }
      }
    } else {
      mode = loaded.value.on_finding ?? 'ask';
      const bad = loaded.value.paths === undefined ? [] : entryProblems(loaded.value.paths, lines, split.bodyOffset);
      problems.push(...bad);
      if (bad.length === 0) paths = loaded.value.paths;
    }
  }
  if (split.body.trim() === '') problems.push({ line: Math.max(split.bodyOffset, 1), reason: 'the checklist is empty: write one check per list item after the frontmatter' });
  split.body.split(NEWLINE).forEach((l, n) => {
    if (l.trimStart().startsWith('#')) problems.push({ line: split.bodyOffset + n + 1, reason: 'a checklist line starts with #, which would open a heading inside the review package: write the check as a list item ("- ...")' });
  });
  problems.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  return { name, ...(paths === undefined ? {} : { paths }), mode, body: split.body, problems };
}

/** An entry `<repository>:<path>` names another repository (a repository name never holds a `/`, a `\` or a `:`); anything else is a path of this one. */
const REPO_ENTRY = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/;

/**
 * D-05: whether `lens` runs for a package whose diff changed `changed` (this repository's paths) and `others` (each other repository's). A lens with no `paths` runs always. An entry matches by the
 * security file's matcher; an entry with a `<name>:` prefix is tried only against the paths of that repository, and a plain entry only against this repository's.
 */
export function lensMatches(lens: LensFile, changed: string[], others: OtherChange[]): boolean {
  if (lens.paths === undefined) return true;
  return lens.paths.some((entry) => {
    const r = REPO_ENTRY.exec(entry);
    if (r === null) return changed.some((p) => pathEntryMatches(entry, p));
    const other = others.find((o) => o.name === r[1]);
    return other !== undefined && other.changed.some((p) => pathEntryMatches(r[2], p));
  });
}

/** Code point order of the name, so the list is the same on every runtime. */
const byName = (a: LensFile, b: LensFile): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * D-04, Ruling R5: the lenses a package of a ticket in `lane` names: those of `lenses` that match, in name order; none for lane S (it has no dispatched reviewer), lane R or a ticket with no lane.
 */
export function lensesFor(lenses: LensFile[], at: { lane: string | undefined; changed: string[]; others: OtherChange[] }): LensFile[] {
  if (at.lane !== 'M' && at.lane !== 'L' && at.lane !== 'P') return [];
  return lenses.filter((l) => lensMatches(l, at.changed, at.others)).sort(byName);
}
