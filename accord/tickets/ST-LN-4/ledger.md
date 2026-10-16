# Ledger

## Tasks

## Rulings
- Ruling: the plan loop goes in a new loaded reference, `packages/core/skills/plan/critique.md`, and `SKILL.md` step 5 points to it — the Approach named `SKILL.md`, but the rendered `SKILL.md` has a 5120-byte cap and the loop text is about 1.5 KB — cost if wrong: the loop moves back into `SKILL.md` if it fits.
- Ruling: whole-plan rounds after round 1 also get `plan-review.md`, and the critic lists the findings now fixed in either mode; a finding the planner reports fixed stays `open` until a critic confirms it — otherwise a finding open before a Must round could never close, and the planner would grade its own fix — cost if wrong: one extra line of critic output per round.
- Ruling: `plan-review.md` separates plan runs with a marker line appended at step 8, and only the sections after the last one count — a re-plan must not reopen findings from an earlier plan — cost if wrong: on resume, findings from an earlier run read as still open.
- Ruling: the spec updates are folded into tasks 1 to 3 rather than given a task of their own — a docs-only task would have no test for its `verify:` line — cost if wrong: none to behaviour.

## Deferred
- Two critics in parallel in plan round 1 was deferred, then taken into this ticket as D-05 on 2026-10-16 ("Chốt, gộp vào ST-LN-4 (Recommended)").
- The architect's impact analysis (callers, file:line, tests, generated files) lives only in its chat report; the planner reads the code again to write `files:` lines. Keep it as `accord/tickets/<id>/impact.md` and have the planner read it. The owner (2026-10-16): "ok đưa vào đi". Judge it with the benchmark after ST-LN-4, measuring architect and planner tokens first.
