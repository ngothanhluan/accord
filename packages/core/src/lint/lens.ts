// Phase 11 D-05, 11-ac-5: lint.lens-file. A lens file a team writes wrongly would be a review check that goes missing without a word, so every problem `parseLens` returns is one error naming the file, the line
// where it can and the fix. Reads the snapshot only: the lens files kept at `accord/lenses/<name>.md` and, for the files that are no lens, the tree.
import type { RepoSnapshot } from '../model/snapshot.js';
import { isLensFile, parseLens } from '../lens/spec.js';
import type { Draft } from './rules.js';

/** The lint check of `lint.lens-file`: one draft per lens-file problem. A repository with no lens folder has none. */
export function lensFile(snapshot: RepoSnapshot): Draft[] {
  const out: Draft[] = [];
  for (const file of Object.keys(snapshot.files).sort()) {
    if (!isLensFile(file)) continue;
    for (const p of parseLens(file, snapshot.files[file]).problems) out.push({ file, ...(p.line === undefined ? {} : { line: p.line }), reason: p.reason });
  }
  return out;
}
