# Ledger

## Tasks
- task 1 done cfe49572a4ff
- task 2 done e7ead5c18008

## Rulings
- Ruling: the plan loop goes in a new loaded reference, `packages/core/skills/plan/critique.md`, and `SKILL.md` step 5 points to it — the Approach named `SKILL.md`, but the rendered `SKILL.md` has a 5120-byte cap and the loop text is about 1.5 KB — cost if wrong: the loop moves back into `SKILL.md` if it fits.
- Ruling: whole-plan rounds after round 1 also get `plan-review.md`, and the critic lists the findings now fixed in either mode; a finding the planner reports fixed stays `open` until a critic confirms it — otherwise a finding open before a Must round could never close, and the planner would grade its own fix — cost if wrong: one extra line of critic output per round.
- Ruling: `plan-review.md` separates plan runs with a marker line appended at step 8, and only the sections after the last one count — a re-plan must not reopen findings from an earlier plan — cost if wrong: on resume, findings from an earlier run read as still open.
- Ruling: the spec updates are folded into tasks 1 to 3 rather than given a task of their own — a docs-only task would have no test for its `verify:` line — cost if wrong: none to behaviour.
- Ruling: the run marker in `plan-review.md` is `## Closed`, not `## Ready` — the `skills.test.ts:407` scan fails any rendered reference line holding `Ready` — cost if wrong: a rename of one marker word.
- Ruling: an owner "apply" is recorded as `open, owner: "<words>"` and a "drop" as `owner: "<words>"` — this keeps the four states and still sends an applied fix to the planner — cost if wrong: the state format is reworded in `critique.md`.
- Ruling: the round-1 lenses are named `criteria` (plan checks 1, 2, 3 and 5), `build` (checks 4 and 6) and `security` — D-05 names what each lens checks but not the names — cost if wrong: renamed in critique.md and critic.md.
- Ruling: the loop ends only after a round that reported no Must and no Should, with nothing open or unverified; if the owner drops the last finding, one cheap diff round still runs — this follows @ac-1 "ends only on a round with no Must and no Should" — cost if wrong: one extra diff read in that case.
- Ruling: a Nice gets the state `deferred` in `plan-review.md` — otherwise it has no state from the list — cost if wrong: none to behaviour.
- Ruling: the ac-5 test also reads the rendered `critique.md` — "goes to the owner at once" is done by the main session, not by either agent — cost if wrong: the test reads one more file than @ac-5 Given names.
- Ruling: the ac-1 test also checks the critic agent diff, lens and fixed-list text — that is the wiring the skill relies on, and no other test guards it — cost if wrong: the test is broader than @ac-1 Given.
- Ruling: the next critic closes an `unverified` finding, by repeating it as a new numbered finding with the missing citation or a different fix, or by withdrawing it; the owner is asked only on the URL-only route — the critic is the one who can supply a citation, the owner never reads the plan, and the planner applies only confirmed fixes — cost if wrong: a real finding the critic wrongly withdraws is dropped, as if never raised.
- Ruling: open or unverified findings still go to the planner each round, unchanged, and the critic resolves every unverified finding before the next planner dispatch — cost if wrong: one redundant `unverified` reply when a critic skips a resolution.
- Ruling: a gate that still fails blocks convergence in critique.md step 4 as well as the cap in step 6 — step 6 alone does not stop a clean round from reaching step 8 — cost if wrong: one more sentence in critique.md.
- Ruling: D-01 "a plan round with only Should findings" is read as a round after which only Shoulds are still open or unverified (`<m>` = 0); a round that reports only Shoulds while an earlier Must is still open is followed by a whole round — so D-01 and @ac-1 both hold and the round subject matches the choice — cost if wrong: one extra whole-plan read in that case.
- Ruling: a diff critic also opens the task each open or unverified finding names, and still never reads the whole plan — enough to judge an unverified finding while staying a diff read — cost if wrong: a finding that names no task gets only the hunk context.
- Ruling: the Ruling reading D-01 as "only Shoulds still open or unverified" is superseded by D-06 and the amended @ac-1, which the owner settled after plan round 4 — the planner had settled a criterion reading alone — cost if wrong: none, the owner decided.
- Ruling: a round "reports a Must" when its section in `plan-review.md` holds a Must line, whatever its state — so an owner drop of a reported Must still keeps the next round whole, and the main session can read it on resume — cost if wrong: one more whole-plan read than needed.
- Ruling: `repeated as <round>.<n>` means a critic carries the finding on under a new number, so it stays open and only a critic or the owner closes it — this squares the repeat route with the amended @ac-1 — cost if wrong: the repeat route is reworded as a withdrawal plus a new finding.
- Ruling: the cost line of the Ruling on diff critics opening finding tasks no longer applies, because the critic now also opens the section a finding names — cost if wrong: none.
- Ruling: the Ruling that "one cheap diff round still runs" after the owner drops the last finding holds only for a dropped Should; after a dropped Must the next round reads the whole plan (D-06) — plan critic round 5 found the two records disagree — cost if wrong: none to behaviour, the plan text is explicit.

## Deferred
- Two critics in parallel in plan round 1 was deferred, then taken into this ticket as D-05 on 2026-10-16 ("Chốt, gộp vào ST-LN-4 (Recommended)").
- The architect's impact analysis (callers, file:line, tests, generated files) lives only in its chat report; the planner reads the code again to write `files:` lines. Keep it as `accord/tickets/<id>/impact.md` and have the planner read it. The owner (2026-10-16): "ok đưa vào đi". Judge it with the benchmark after ST-LN-4, measuring architect and planner tokens first.
- When the owner drops the last open finding, plan step 5 still dispatches the planner with an empty list before the next critic round: one wasted dispatch, no defect (plan critic rounds 4 and 5, 2026-10-16).
