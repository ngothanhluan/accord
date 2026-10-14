---
ticket: "SHOW-1"
commit: "3bcfa7dee916e5b87b425fb97009c090072c1858"
reviewed_on: "2026-10-14"
---

## @ac-1 the intent stage shows Intent and the criteria verbatim and takes a yes before the architect

Result: pass

Evidence: Exists: sentence A is in `packages/core/skills/intent/SKILL.md:58-63` as step 9, between step 8 (auditor, line 53) and step 10 "Next: `accord-approach`" (line 65). Substantive: the test `packages/core/test/stage-skills.test.ts:104-128` renders all four runtimes, collapses `[ \t]*\n[ \t]*` to one space, splits numbered steps, and requires exactly one step each for the sentence, the auditor dispatch and Next, in order. Wired: it reads `skillTargets(all)` output for `.agents/skills` and `.claude/skills`. The rendered source is `packages/core/src/generated/skills.ts`, which holds the sentence once, and `.claude/skills/accord-intent/SKILL.md` holds it once. Data flows: `npx vitest run test/stage-skills.test.ts` in `packages/core` gave 13 of 13 passing. The test name slugs to the ticket's `@test` id.

## @ac-2 the approach yes shows Approach verbatim instead of a brief

Result: pass

Evidence: Exists: sentence B is in `packages/core/skills/approach/SKILL.md:51-53`, step 5. `grep -c "Show the owner the brief"` returns 0 in that file and in `.claude/skills/accord-approach/SKILL.md`. Substantive: the test `packages/core/test/stage-skills.test.ts:130-146` normalises whitespace on each rendered approach SKILL.md, asserts sentence B is present and the brief sentence absent. Wired: it runs over the rendered output of every runtime directory, and `packages/core/src/generated/skills.ts` holds sentence B once. Data flows: the same vitest run passed 13 of 13. The spec update (D-01) is also present, at `docs/specs/2026-10-12-workflow-layer-design.md:127` and `:230`.
