Round record: 1

## Round 1 (whole)
1. Must — a Folders entry without a trailing `/`, or the repository root written as `.`, matches no tracked file, so the row searches nothing and a contradicted absence claim passes — fixed
2. Should — `accord approve` re-runs searches and citations on the tree at approve time, not the commit the report was made on (contradicts the "evidence at its commit" Ruling): a re-approval after build or a merge of the default branch refuses a report that was right where it was made — fixed
3. Should — a literal pattern matches the saved `scout.md` and the ticket file once they are tracked, so a report that passed at lane time fails at approve; the ticket's own files must be left out of the search — fixed
4. Should — real scout output shortens paths (`status/rows.ts:26`), so citations fail by default, and no step says what to do when the lane-time check exits 1, which makes `skipped:` the habit — fixed
5. Should — the check counts only existing files, so new files the change creates, the commonest miscount, are still judged by a model — fixed
6. Should — the impact list leaves out the stage texts that run `accord approve` (approach step 5, build change of course) and their tests; the refusal arrives after the owner's yes, with no step for it — fixed
7. Nice — a scout-written regular expression such as `(a+)+$` can hang `accord approve` with no time or input cap — deferred

## Round 2 (diff)
1. Should — `approve` reads text at the report's commit with one `git cat-file --batch` call capped at 64 MiB, so a root row in a repository whose tracked files exceed 64 MiB makes approve exit 2 whether the report is true or not; read blobs in bounded batches — fixed
2. Should — the impact list points the `research:` exclusion at `addedResearch`, which returns only records the branch adds and needs branch facts the scout module does not get, so a listed record already on the default branch is still searched — fixed
3. Nice — approach step 5 checks the working tree while approve checks the report's commit, so a pass at step 5 does not guarantee approve passes after the owner's yes; give step 5 the same mode — deferred

## Round 3 (diff)
1. Nice — "no repository size makes approve exit 2" overstates: the load before the check runs `git ls-files` with Node's 1 MiB default buffer (`packages/cli/src/load/fs.ts:22-26`), and one blob past V8's string limit still crashes; limit the claim to the scout check's own reads and queue the load buffer as a separate bug — deferred
