// Phase 11 D-04, D-05, D-06: a team lens is a checklist a team writes at `accord/lenses/<name>.md`, optionally with `paths:` (the security file's entry forms) and an `on_finding:` mode. The CLI, never a
// model, decides which lenses a review package names: this file reads one lens file and matches it against the changed paths of a package. Pure: the host reads the files and the diff.
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

/**
 * Read one lens file. Never throws: a frontmatter that does not read (bad YAML, an unknown key, a bad mode, an empty `paths`) gives no `paths` and mode `ask`, with its reasons in `problems`, so the lens
 * still runs on every package rather than silently not at all (`accord lint` reports the problems). A file with no frontmatter block is a lens with no paths.
 */
export function parseLens(path: string, text: string): LensFile {
  const name = stemOf(path);
  const split = splitFrontmatter(text);
  // no block, or a block with nothing in it (blank lines and comments), is a lens with no paths
  if (split.yaml === null || split.yaml.split('\n').every((l) => l.trim() === '' || l.trim().startsWith('#'))) return { name, mode: 'ask', body: split.body, problems: [] };
  const loaded = loadFrontmatter<{ paths?: string[]; on_finding?: LensMode }>(path, text, 'lens');
  if (loaded.value === undefined) {
    // the fix goes with every reason: the schema's own text ("must NOT have additional properties") names neither the key nor what a lens file may hold
    const lines = normaliseText(text).split(NEWLINE);
    const reasonOf = (f: { line?: number; rule: string; reason: string }): string => {
      if (f.rule === 'load.yaml-syntax') return f.reason;
      const key = f.line === undefined ? undefined : /^\s*([A-Za-z0-9_-]+)\s*:/.exec(lines[f.line - 1] ?? '')?.[1];
      return `${key === undefined ? '' : `the key "${key}": `}${f.reason}; ${KEYS_FIX}`;
    };
    return { name, mode: 'ask', body: loaded.body, problems: loaded.findings.map((f) => ({ line: f.line, reason: reasonOf(f) })) };
  }
  const { paths, on_finding } = loaded.value;
  return { name, ...(paths === undefined ? {} : { paths }), mode: on_finding ?? 'ask', body: loaded.body, problems: [] };
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
