// The rules a path entry must keep to be able to match, shared by the security file and a lens file. No imports: both readers import this, and neither may import the other.
/** A path entry holding one of these is a glob; there is none (the security file and a lens file read an entry as written). */
export const GLOB_ENTRY = /[*?[]/;
/** What follows "a path entry" or `the path entry "<e>"` in the glob problem. */
export const GLOB_ENTRY_REASON = 'holds *, ? or [; there is no glob, an entry ending in / is a folder';

/**
 * The one rule set for a path entry that can never match, shared by the security file and a lens file (Phase 11 T-11-10: never a second rule set). A string rule on a repository-relative entry, never a
 * filesystem join. Returns the problem with its fix, or undefined when the entry can match. `shown` is the entry as written when `e` is only the part of it that is a path (a lens entry `<repository>:<path>`).
 */
export const unmatchableEntry = (e: string, shown: string = e): string | undefined => {
  if (e.includes('\\')) return `the path entry "${shown}" holds a backslash; write it with /, as git prints paths`;
  if (e.startsWith('/') || e.startsWith('./')) return `the path entry "${shown}" starts with / or ./; write it from the repository root without them`;
  if (e.split('/').includes('..')) return `the path entry "${shown}" holds ..; write the path from the repository root without ..`;
  return undefined;
};
