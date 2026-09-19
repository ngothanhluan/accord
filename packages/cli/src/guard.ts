// T-06-03 / T-07-02 write guard, shared by every command that puts accord's own text into a repository.
// One walk, one message, one place: `skills sync` and `init` write into overlapping trees, and a second copy
// of this function is a second thing to get wrong.
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError } from './load/fs.js';

/**
 * Every component of `path` under `root` must be a real directory, and its leaf a regular file — never a
 * symlink or a Windows junction. `lstat` declines to follow only the FINAL component, so checking the leaf
 * alone leaves a junction one directory up (`.claude/skills/accord-designer`) routing every write inside it
 * to wherever the link points, with the guard never firing.
 *
 * The first component that does not exist ends the walk: `mkdirSync(..., { recursive: true })` creates real
 * directories, so nothing below it can be a link.
 *
 * Deliberately not merged with `scannable` in `commands/skills.ts`, which walks the same way. This one
 * answers "may accord WRITE here", and a link is a refusal: exit 2, nothing written. That one answers "may
 * accord LOOK here", and a link is a silent skip, because D-113 fixes that the orphan report must not change
 * the exit code. Same walk, different questions, different dispositions.
 */
export function assertNoLink(root: string, path: string): void {
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    const found = lstatSync(join(root, ...parts.slice(0, i + 1)), { throwIfNoEntry: false });
    if (found === undefined) return;
    const leaf = i === parts.length - 1;
    if (leaf ? !found.isFile() : !found.isDirectory()) {
      throw new UsageError(
        parts.slice(0, i + 1).join('/') +
          ' is not a regular ' +
          (leaf ? 'file' : 'directory') +
          ' - nothing was written',
      );
    }
  }
}
