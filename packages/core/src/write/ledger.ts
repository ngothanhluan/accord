// Spec §8: the ledger line `task-done` writes. Pure string in, string out; the CLI owns the file.
import { normaliseText } from '../load/frontmatter.js';
import { parseLedger } from '../load/work.js';

const SKELETON = '# Ledger\n\n## Tasks\n\n## Rulings\n\n## Deferred\n';

/**
 * Adds `- task <n> done <sha>` as the last line of `## Tasks`, creating the skeleton when there is no
 * ledger and a Tasks section when the ledger has none. Returns undefined when task n already has a line,
 * so a second run writes nothing. Output is LF.
 */
export function recordTaskDone(text: string | undefined, n: number, sha: string): string | undefined {
  const base = normaliseText(text ?? SKELETON);
  if (Object.hasOwn(parseLedger('', base).done, String(n))) return undefined;
  const entry = `- task ${n} done ${sha}`;
  const lines = base.replace(/\n$/, '').split('\n');
  const at = lines.findIndex((l) => /^##\s+Tasks\s*$/i.test(l));
  if (at < 0) return [...lines, '', '## Tasks', entry].join('\n') + '\n';
  let end = lines.findIndex((l, i) => i > at && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  while (end - 1 > at && lines[end - 1].trim() === '') end--;
  lines.splice(end, 0, entry);
  return lines.join('\n') + '\n';
}
