---
ticket: "ASK-1"
commit: "753bd08b659c510c07f4c579d644464048d7ca9e"
reviewed_on: "2026-10-14"
---

## @ac-1 the shared rule holds the fixed sentence beside every stage skill that asks the owner

Result: pass

Evidence: Exists: packages/core/skills/shared/ask.md holds the D-02 sentence, wrapped across lines. The test is `ac-1 the shared ask rule...` in packages/core/test/stage-skills.test.ts, whose slug matches the ticket's @test tag. Substantive: the test normalises line breaks to one space, checks for the exact sentence, and asserts the exact STAGES and skillDirs lists. Wired: the eight SKILL.md files each have `loads: [... shared/ask.md]` on line 6, so the render emits `ask.md` beside each. `.claude/skills/*/ask.md` exists for all 8 and is tracked in git. Data flows: the test reads real `skillTargets()` output. `npm run gen` followed by `skills sync` left `git status` clean, so generated files and committed copies match the source. `vitest run` on stage-skills.test.ts and skills.test.ts passed 43 of 43. The `.agents/skills` directory is not on disk in this repo, but skillDirs for an all-runtime config is covered in the test.

## @ac-2 every stage skill that asks the owner points to the shared rule

Result: pass

Evidence: Exists: in each of the eight packages/core/skills/*/SKILL.md, the "Anything touching intent" bullet ends with "Read `./ask.md` before any question to the owner." (for example accord/SKILL.md:108-111 and plan/SKILL.md:90-94). The test is `ac-2 every stage skill points...` in packages/core/test/stage-skills.test.ts. Substantive: the test builds paragraph and list-item blocks, requires exactly one block starting "Anything touching intent" per file, and requires both "stops the run and asks the owner" and `./ask.md` inside it. Wired and data flows: it runs over rendered `skillTargets()` output for every stage and directory. The test passed, and the `.claude` renders are in sync (gen and sync produced no diff).
