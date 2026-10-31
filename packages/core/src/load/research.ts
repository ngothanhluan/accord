// ST-LN-13: research records. Pure string rules, no node import; the host decides which files exist.
import { normaliseText } from './frontmatter.js';

export const RESEARCH_DIR = 'accord/research/';

/** An entry names a path under accord/research/: compared as written, never normalised. */
export function isResearchPath(entry: string): boolean {
  if (!entry.startsWith(RESEARCH_DIR)) return false;
  if (entry.includes('\\')) return false;
  return !entry.split('/').some((s) => s === '' || s === '.' || s === '..');
}

/** A research path that is a Markdown file; only these count as a ticket's own files. */
export const isResearchRecord = (entry: string): boolean => isResearchPath(entry) && entry.endsWith('.md');

const DATE = /Date: \d{4}-\d{2}-\d{2}/;
const COMMIT = /Repository at `?\b[0-9a-f]{7,40}\b/;

/** Which header facts the first five lines of a record lack. */
export function recordHeaderFaults(text: string): ('date' | 'commit')[] {
  const head = normaliseText(text).split('\n').slice(0, 5);
  const faults: ('date' | 'commit')[] = [];
  if (!head.some((l) => DATE.test(l))) faults.push('date');
  if (!head.some((l) => COMMIT.test(l))) faults.push('commit');
  return faults;
}
