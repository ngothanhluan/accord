# Ledger

## Rulings
- Ruling: the text output always prints the UP NEXT heading, with `  none` when it has no row, as YOURS, TEAM and READY do — D-04 makes it a fixed section, and the text mirrors the JSON — cost if wrong: one more line on a repository with nothing left to pick up.
- Ruling: section order, the rank, the summary counts (ST-LN-2 D-09 backlog included) and `upNext.suggest` (the first unblocked UP NEXT row) stay as they are; the action line keeps picking the first READY row, otherwise `upNext.suggest`, now whatever YOURS holds — D-01 asks for none of these to change — cost if wrong: a follow-up ticket to reorder.
- Ruling: UP NEXT leaves out every ready ticket (all of `nextRows`), not only the 20 READY shows — D-03 says the unclaimed open tickets that are not ready (architect) — cost if wrong: a ready ticket past READY's cap shows in neither section, only in `ready.more` and the summary.
- Ruling: `Dashboard.upNext` becomes required in the exported type — D-04 makes it an always-present key of a public interface (architect) — cost if wrong: a type change for core consumers who read `upNext?`.
- Ruling: `accord/tickets/ST-LN-2.md` stays untouched; its @ac-3 test keeps its name and drops the assertions that `upNext` is absent once the viewer holds a claim, and one pointer line in `accord/tickets/ST-LN-2/ledger.md` names ST-LN-18 D-01 and D-04 as superseding ST-LN-2 D-04, D-08 and the last clause of its @ac-3 — editing the ticket file changes its AC hash and drops it out of done, while the ledger is outside the hash and the PR gate (`accord.yml:48` matches only `accord/tickets/<id>.md`) — cost if wrong: ST-LN-2's own text still describes the old D-04.
- Ruling: `upNext.suggest` stays the first unblocked row of the uncapped list (critic Nice 2) — an unblocked ticket to pick up beats none when the 20 rows shown are all blocked — cost if wrong: the action line names an id not on screen; `accord status` lists it.
- Ruling: the @ac-1..3 tests treat `JSON.parse(JSON.stringify(d))` and `renderDashboard(d)` as what `accord dashboard --json` and `accord dashboard` print, in memory rather than in a git sandbox — the Approach chose this layer and the command wiring is already tested (planner) — cost if wrong: a broken `--json` wiring shows only in the existing sandbox tests.
- Ruling: the ST-LN-2 pointer goes at the end of its ledger's `## Rulings` as a line that does not start with `Ruling:` — `accord anchor` prints that section, and the line is not counted as a Ruling (planner) — cost if wrong: a reader of ST-LN-2 looks one section further.
- Ruling: the @ac-4 panel test's title starts with `ac-4` although `panel.test.ts` already holds another ticket's `ac-4 pressing a row id…` — full titles differ, so ids are unique, as in `dashboard.test.ts` (planner) — cost if wrong: matching by prefix alone finds two tests.
- Ruling: the ST-LN-2 pointer sits directly after the last line of its `## Rulings`, before `## Deferred` — the brief says the last line of `## Rulings` (executor, task 2) — cost if wrong: one line to move.
- Ruling: the executor commits 20d87c7 and f854b8f keep their `Co-Authored-By: Claude` trailer — 34 merged commits already carry it, and rewriting would change the SHAs the ledger's task lines record — cost if wrong: two commits break the "authored solely by the author" constraint as the earlier tickets' do.
- Overruled by the owner at the final review (Should 1, the "commits authored solely by the author" constraint): "Xóa trailer trước khi merge (Recommended)". The branch's commits from 20d87c7 on were rewritten to drop the trailer, trees unchanged: task 1 is now 763b5ff74dc7 and task 2 ab2a719f0e2a.

## Deferred
- Plan review 1.2 (Nice): the ST-LN-2 ledger pointer could also name D-06's absent-section clause as no longer holding for `upNext`.

## Tasks
- task 1 done 763b5ff74dc7
- task 2 done ab2a719f0e2a
