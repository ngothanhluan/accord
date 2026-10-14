# Ledger

## Tasks
- task 1 done 31c3c4d64fc7
- task 2 done 17d2ecf0a280

## Rulings

- Ruling: the spec edits are folded into Tasks 1 and 2 rather than a separate task — a docs-only task would have no test to verify it — cost if wrong: the spec edit is reviewed with no test behind it.
- Ruling: "rewrite the brief" becomes "rewrite `## Approach`" in the "owner picks another option" sentence — the brief no longer exists — cost if wrong: one changed phrase outside sentence B.
- Ruling: "owner picks another option" keeps going back to step 3, and any other no goes back to `accord-intent` step 8 — the `approach` REQUIRED row asserts `back to step 3` — cost if wrong: the two paths for a no may read as overlapping.
- Ruling: task 1's brief referred to a "shared setup" and "normalisation above" it did not hold, so the ac-1 case copies the setup from the ASK-1 ac-2 case and normalises `[ \t]*\n[ \t]*` to one space (ASK-1 ac-1, D-04) — cost if wrong: a one-line test edit.
- Ruling: approach step 5 wraps before "Decisions," so "Decisions, and Corrections as written" stays on one line, which the `approach` row at `packages/core/test/stage-skills.test.ts:19` matches on raw text — text unchanged, only the wrap — cost if wrong: none.

## Deferred

- The SHOW-1 ac-1 and ac-2 tests repeat the eight-stage `STAGES` assertion (packages/core/test/stage-skills.test.ts:108, :134); delete both lines.
- The spec's §7 item 4 still says the owner receives a brief and the brief is rewritten (docs/specs/2026-10-12-workflow-layer-design.md:225, :229); reword to the verbatim sections.
- Intent step 9 wraps at about 110 columns and approach step 5 has a short line "yes, run" (packages/core/skills/intent/SKILL.md:58-62, packages/core/skills/approach/SKILL.md:59); rewrap at 80.
- Sentence B's "any section changed" may be followed over "Treat every approved section as changed" (packages/core/skills/approach/SKILL.md:51-55); accepted by D-07.
- Any no at the approach yes returns to the audit without saying to rewrite the touched sections first, so the owner may repeat the no at intent step 9 (packages/core/skills/approach/SKILL.md:62-66); matches the approved Approach, so the owner decides.
