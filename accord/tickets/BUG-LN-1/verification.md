---
ticket: "BUG-LN-1"
commit: "ed782736d341ff713a96c15684385802a597b3df"
reviewed_on: "2026-10-15"
---

## @ac-1 A brief carries the plan's preamble

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:255-263 builds a plan with the rule between frontmatter and Task 1, and asserts exact output (ticket, `---`, blank, rule, blank, Task 2; no Task 1). Substantive and wired: packages/cli/src/commands/brief.ts:19-24 trims blank edge lines of plan.preamble and writes it between `---` and the task section with no label; packages/core/src/load/work.ts:41-45 and :109 fill `Plan.preamble` in parsePlan (field declared at packages/core/src/model/snapshot.ts:116). Data flows: the preamble comes from the plan text read by the loader, not a constant. Ran: the JUnit report node_modules/.cache/accord/junit.xml holds "ac-1 a brief carries the plan preamble" with no failure (0 `<failure` in the file).

## @ac-2 A plan with no preamble gives the same brief as before

Result: pass

Evidence: packages/cli/test/lane-commands.test.ts:270-278 uses a whitespace-only gap and asserts the exact old output (ticket, `---`, blank, Task 1). packages/cli/src/commands/brief.ts:19-22 drops blank edge lines so `rules` is '' and the write at :24 equals the old format. JUnit report shows the test passed.

## @ac-3 Evidence tokens that are not files draw no warning

Result: pass

Evidence: packages/core/test/gate.test.ts:978-986 cites a real test plus all nine tokens from the scenario, and asserts no gate.reference-unknown and no gate.evidence-unresolved; passed in junit.xml. Substantive: packages/core/src/gate/refs.ts fileShaped (the "fileShaped" function, called from unresolvedRefs) rejects globs, `://`, no-extension last segments and existing directories. Wired: referenceUnknown (refs.ts) calls unresolvedRefs per evidence block, reached through gate done. Data flows: I ran `node packages/cli/dist/cli.js gate done ST-LN-1` on the real repo; it printed 0 gate.reference-unknown lines (ticket body says it drew 18 before). The command exits on unrelated stale-commit errors, which do not concern this criterion.

## @ac-4 A mistyped file path still warns

Result: pass

Evidence: packages/core/test/gate.test.ts:988-997 cites a real test plus `src/nope.ts` and `../x.md` and asserts exactly two warnings, each naming one token, level warning; passed in junit.xml. packages/core/src/gate/refs.ts fileShaped keeps a token with a real extension that is neither a directory nor a glob, so both survive; referenceUnknown emits one finding per token.

## @ac-5 The error gate still needs a file or a test

Result: pass

Evidence: packages/core/test/gate.test.ts:999-1004 cites only prose, `.claude/skills` and `feature/{id}`, expects exactly one gate.evidence-unresolved at level error and verdict fail; passed in junit.xml. The `candidates`, `resolves`, `cites` and `evidenceUnresolved` code in packages/core/src/gate/refs.ts is unchanged by the filter, which sits only in unresolvedRefs.
