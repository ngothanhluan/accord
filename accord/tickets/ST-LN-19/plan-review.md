# Plan review

## Round 1 (whole)
1. Should — Task 5's replacement span in both skills drops "ask for an explicit yes", and in intent also "on yes commit the ticket with the owner's answer quoted in the commit message"; no test checks either, so the yes step regresses silently. Name the exact span and keep both clauses word for word, with a risk:regression check — open
2. Should — Task 1's expected criteria block contradicts itself for ac-4: "its own steps from its first Then" would drop ac-4's unshared When before its first Then (D-01, D-02). Say "every step after its shared prefix", and say whether the heading and its blank line are in the compared block — open
3. Should — the ac-1 case runs ~35 in-process `accord show --approval` calls, each spawning git several times, under the cli project's 30 s testTimeout (packages/cli/vitest.config.ts:5); give it an explicit timeout as lane-flow.test.ts:96 does — open
4. Should — ac-3's last Then (`accord show` and `--json` still pass their earlier tests unchanged) is on no verify: line; add packages/cli/test/show.test.ts's existing ac-1, ac-2, and risk:security cases to Task 3's verify: — open
5. Should — Task 1's `parseFence` throws as `parser.parse` does, but `extractScenarios`'s catch needs `toMarkdown` for each finding's line (packages/core/src/load/gherkin.ts:80,94); a failing fence leaves it out of scope. Name a shape that never throws, e.g. `{ toMarkdown, doc } | { toMarkdown, error }` — open
6. Should — `approvalView` re-scans at `section.lines[0].line - 1`, which is undefined when `## Acceptance criteria` has no lines (packages/core/src/load/sections.ts:74-80), a TypeError and exit 2 where the plan says `none`; use `section.line` — open
