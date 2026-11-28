// Phase 11 D-05, 11-ac-5: lint.lens-file. A lens file a team writes wrongly would be a review check that goes missing without a word, so every problem `parseLens` returns is one error naming the file, the line
// where it can and the fix. Reads the snapshot only: the lens files kept at `accord/lenses/<name>.md` and, for the files that are no lens, the tree.
import type { RepoSnapshot } from '../model/snapshot.js';
import { LENS_DIR, isLensFile, parseLens } from '../lens/spec.js';
import type { Draft } from './rules.js';

/** A placeholder that keeps an empty folder in git is no lens file and no mistake (Ruling R9). */
const KEEP = LENS_DIR + '.gitkeep';

/** The lint check of `lint.lens-file`: one draft per lens-file problem, and one per file under the folder that is no lens (only `<name>.md` directly under it is read). A repository with no lens folder has none. */
export function lensFile(snapshot: RepoSnapshot): Draft[] {
  const out: Draft[] = [];
  for (const file of Object.keys(snapshot.files).sort()) {
    if (!isLensFile(file)) continue;
    for (const p of parseLens(file, snapshot.files[file]).problems) out.push({ file, ...(p.line === undefined ? {} : { line: p.line }), reason: p.reason });
  }
  for (const file of snapshot.tree) {
    if (!file.startsWith(LENS_DIR) || isLensFile(file) || file === KEEP) continue;
    out.push({ file, reason: `${file} is ignored: only <name>.md directly under ${LENS_DIR} is a lens; rename it to <name>.md in that folder, or move it out of the folder` });
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : (a.line ?? 0) - (b.line ?? 0)));
}
