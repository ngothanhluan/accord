---
ticket: "ST-LN-33"
commit: "c286473b2cae524169e8ebbef4a6509acb28911d"
reviewed_on: "2026-10-21"
---

## @ac-1 every rendered ask.md holds the writing rule for the owner

Result: pass

Evidence: Exists: packages/core/skills/shared/ask.md:24-31 holds the paragraph; I checked each of the eight literals against it after joining line breaks. Test packages/core/test/stage-skills.test.ts (ac-1 test) freezes the 16 old lines as literals and checks them in order. Substantive: the paragraph is real prose and the old lines are unchanged in `git diff main...HEAD` (additions only). Wired: the test renders with `skillTargets` over all four runtimes and both dirs (.agents/skills, .claude/skills) and all 8 stages; packages/core/src/generated/skills.ts is regenerated in the diff. Data flows: the checked text is the sync output. JUnit (node_modules/.cache/accord/junit.xml) shows this test passed, with 0 failures in the report.

## @ac-2 the session rules carry the sentence limit

Result: pass

Evidence: Exists: packages/core/templates/ruleset.md rule 8 "Write text for the owner in sentences of at most 25 words, as ask.md says."; packages/core/src/generated/templates.ts updated. Substantive: packages/core/test/session.test.ts (ac-2 test) builds the invocation from packages/cli/package.json name and version, calls `rulesetText`, and asserts the literal, size under 2048 bytes (the ticket's approach states 2029), no leftover `{{`, and the older checked texts. Wired and data flows: it uses the same `rulesetText` the hook uses, with the real invocation. JUnit shows it passed.

## @ac-3 the benchmark counts only the owner-facing sentences of a main session

Result: pass

Evidence: Exists: scripts/sentences.mjs `ownerSentences`; packages/core/test/sentences.test.ts ac-3 test. Substantive: I read the code. It takes only assistant `text` blocks, so user, thinking, and tool_use are skipped. It skips fences, lines starting with "|", and the span from "## Intent" to "---". It splits at `.?!` plus whitespace and at every line end. A word needs a Unicode letter or digit. `long` is words > 25. The test expects word counts [25,26,3,4,5,6,10,5] and long flags only on the 26. Wired: scripts/benchmark.mjs imports it (see ac-4). Data flows: the output comes from the parsed records. JUnit shows it passed, along with a Vietnamese risk test.

## @ac-4 the benchmark report shows the sentence lengths of each main session

Result: pass

Evidence: Exists: scripts/benchmark.mjs prints "## Sentence length in owner-facing text" with the columns start (UTC), branch, sentences, over 25 words, % over 25, longest (words), then a "Longest sentences:" list of the top 3 with word counts. Substantive: the session start is the first record with a parseable timestamp (UTC date), the branch is the first gitBranch, and the section has no pass or fail wording of its own. Wired: it reads the top-level `*.jsonl` in each folder and calls `ownerSentences`. The zero-subagent case is guarded. Data flows: packages/core/test/benchmark.test.ts spawns `node scripts/benchmark.mjs <dir>` with `process.execPath` and cwd the repository, on a temp folder with two main sessions and one subagent run. It asserts exact rows and top-3 quotes, that subagent text is excluded, and no whole-word pass or fail outside the quotes. JUnit shows it passed.

Not covered: the D-06 human side-by-side comparison (a run without the rule against one with it) is not part of any @ac and I did not run it. The owner does it at verify.
