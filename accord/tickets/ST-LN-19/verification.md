---
ticket: "ST-LN-19"
commit: "d716d151ebdddf5f36f7fc3477d2162e3d71fd1d"
reviewed_on: "2026-10-18"
---

## @ac-1 every scenario of every real ticket can be rebuilt exactly from the view

Result: pass

Evidence: Exists: packages/cli/test/show-approval.test.ts:124-153 reads every file in accord/tickets/, requires at least 10 tickets with a gherkin block, runs `show <id> --approval` for each, rebuilds with `rebuild()`, compares tag, title and steps to the parsed scenario, and checks no shared line goes past the first Then. Substantive: packages/core/src/status/approval.ts:29-68 builds a prefix trie over the steps before the first Then (`leadSteps` in packages/core/src/load/gherkin.ts) and prints shared steps with their ids. Wired: packages/cli/src/commands/show.ts calls `approvalView`. I ran `node packages/cli/dist/cli.js show ST-LN-19 --approval` and got exit 0 and the compact view. Data flows: the test uses the real ticket files, and JUnit shows the test passing (70s, in the 1306-test run).

## @ac-2 a step that several scenarios repeat is printed once, naming them

Result: pass

Evidence: packages/cli/test/show-approval.test.ts:66-95 builds four scenarios and asserts the shared Given line ends `(ac-1, ac-2, ac-3, ac-4)` and the shared When line ends `(ac-1, ac-2, ac-3)`. Each `**ac-n title**` block then holds its own Then steps. Code: packages/core/src/status/approval.ts:54-62 (emit) and 64-66. JUnit: passed. The live output for ST-LN-19 shows the same compaction, with no shared lines because its scenarios share nothing.

## @ac-3 the view prints the six approved sections and nothing else

Result: pass

Evidence: packages/core/src/status/approval.ts:70-72 emits the six `## ` headings from APPROVED_SECTIONS, and `prose()` prints `none` for an empty section (line 23). The live run printed `## Intent` ... through the Decisions section with no Stage, Lane or Test labels. The test at packages/cli/test/show-approval.test.ts:241 passed in JUnit. `git diff 9e86307 HEAD --stat -- packages/*/test` shows the existing CLI show tests were not modified; show-approval.test.ts is a new file, and the full suite (1306 tests) passes. packages/core/test/stage-skills.test.ts has 6 lines removed, which are the SHOW-1 tests trimmed as the Approach disclosed. They are not show tests.

## @ac-4 the intent and approach skills show the view at the owner's yes

Result: pass

Evidence: packages/core/test/stage-skills.test.ts:340-348 syncs the skills for a config that enables all runtimes and checks both target dirs (`.agents/skills`, `.claude/skills`). It takes the "**The owner's yes" step with whitespace collapsed and asserts all six required literals, plus the absence of "from the ticket file". JUnit: passed. The sources packages/core/skills/intent/SKILL.md:57 and packages/core/skills/approach/SKILL.md:51 begin the step with `accord show <id> --approval`. The installed copies under .claude/skills/accord-intent and accord-approach mention the flag.

## @ac-5 the view is laid out for a person to read, and coloured in a terminal

Result: pass

Evidence: packages/cli/test/show-approval.test.ts:313-348 runs with NO_COLOR and asserts no escape codes, bold scenario lines preceded by a blank line, every criteria line being a list line, and a blank line after every non-list prose line. With FORCE_COLOR=1 it asserts coloured headings (cyan), coloured ac-n ids (yellow, counted), and coloured keywords (green), and that `stripVTControlCharacters(on)` equals the colour-off output. I ran `FORCE_COLOR=1 ... show ST-LN-19 --approval | cat -v` and saw `^[[36m## Intent^[[39m` followed by prose lines with a blank line between them. I ran `--approval --json` and got exit 2, "cannot be used with option '--json'". JUnit: passed.
