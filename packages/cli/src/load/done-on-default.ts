// Phase 15 D-23: a ticket done on the default branch is not edited, by a person or by accord. The writers that put a key into a ticket file ask this first. The reading is the dashboard's
// (BUG-LN-13): the ticket's records on origin's default ref, else the local main or master when the clone has no origin. Never throws and never guesses: no default ref, an unsafe id or any git
// failure says "not done", so a writer behaves as it always did where nothing can be read.
import { isDone, SAFE_ID } from '@accord-dev/accord-core';
import { doneRef, snapshotAt } from './fs.js';

/** The one line every refusing writer prints. */
export const doneRefusal = (id: string): string => `${id} is done on the default branch; a done ticket is not edited`;

/** True when ticket `id` is done in the records of the default ref, read from `root` (a checkout or a linked worktree of the repository). */
export function doneOnDefaultBranch(root: string, id: string): boolean {
  if (!SAFE_ID.test(id)) return false;
  try {
    const ref = doneRef(root);
    return ref !== undefined && isDone(snapshotAt(root, ref, [id]), id);
  } catch {
    return false;
  }
}
