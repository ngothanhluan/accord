Round record: 1

## Round 1 (whole)
1. Must — a Folders entry without a trailing `/`, or the repository root written as `.`, matches no tracked file, so the row searches nothing and a contradicted absence claim passes — open
2. Should — `accord approve` re-runs searches and citations on the tree at approve time, not the commit the report was made on (contradicts the "evidence at its commit" Ruling): a re-approval after build or a merge of the default branch refuses a report that was right where it was made — open
3. Should — a literal pattern matches the saved `scout.md` and the ticket file once they are tracked, so a report that passed at lane time fails at approve; the ticket's own files must be left out of the search — open
4. Should — real scout output shortens paths (`status/rows.ts:26`), so citations fail by default, and no step says what to do when the lane-time check exits 1, which makes `skipped:` the habit — open
5. Should — the check counts only existing files, so new files the change creates, the commonest miscount, are still judged by a model — open
6. Should — the impact list leaves out the stage texts that run `accord approve` (approach step 5, build change of course) and their tests; the refusal arrives after the owner's yes, with no step for it — open
7. Nice — a scout-written regular expression such as `(a+)+$` can hang `accord approve` with no time or input cap — deferred
