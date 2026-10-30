---
ticket: "ST-LN-63"
commit: "d67b280e8641d8c12147321b6d86aec564f71074"
reviewed_on: "2026-10-30"
---

## @ac-1 A read command starts as many git processes with 20 tickets as with 1

Result: pass

Evidence: Exists: packages/cli/test/git-count.test.ts:455-496 holds the test named by the @test tag. It builds the 20-ticket sample (`sample.withMerge` asserted equal to B-6, B-8, B-17, B-19) and two one-ticket repositories (B-6 with a merge, B-7 without), each checked to hold the same branch sha as the 20-ticket one (:467-473) and a merge commit only for B-6 (:474-475). Substantive: for `status`, `anchor <id>`, `lint`, `dashboard` and `show <id>` it counts git spawns through the `node:child_process` wrapper (packages/cli/test/helpers/git-spawns.ts) in both repositories and asserts `many <= one + 2 * (other tickets with a merge)` (:491-492). It also asserts the shared walk ran in the 20-ticket `status` (:487), so the bound cannot pass because the walk failed. Wired: Part 1 is real in the source. packages/cli/src/load/fs.ts:313-338 (`gitPlanHistory`, `gitRecordsSinceFor`) are the only users of the ancestors, baseline-file and records-since reads, and they are called from packages/cli/src/commands/gate.ts:8 and :48, which is the gated-ticket path of `gate plan` and `gate done`. `loadParts` (fs.ts:841) no longer calls them. Data flows: the counts come from real `run()` calls on git repositories. The full-suite junit report (node_modules/.cache/accord/junit.xml:224) lists this test as passed in 14.0 s, with 0 failures and 0 errors in the whole run (`tests="1718" failures="0" errors="0"`). I did not re-run it; I relied on the junit report and on reading the test.

## @ac-2 Every command prints what it printed before the change

Result: pass

Evidence: Exists: packages/cli/test/goldens.test.ts:25-40, with goldens at packages/cli/test/__golden__/st-ln-63/goldens.json and git-counts.before.json. Substantive: for every key in `RUNS` it compares exit code, stdout, stderr and refs against the golden with `toBe` and `toEqual`, which is a byte comparison. It fails when a golden is missing (:33-34), and the goldens are read with `readGolden` and are never written by the test. Wired: `runSample()` in packages/cli/test/helpers/runs.ts runs the real commands (`status`, `anchor`, `lint`, `dashboard`, `show`, `gate plan`, `gate done`, pick-up, clean, `worktree merge`, `new ticket --worktree`) on the sample repositories. Data flows: the goldens were recorded by 206756d, before any product commit (the first is 82a9117). They were recorded again by f54365b from origin/main after the BUG-LN-13 merge, which is the owner's choice A at 0a9107d. `git log` on the golden folder shows only those two commits, so no later product commit changed them. junit.xml:248 lists the test as passed in 54.9 s. I did not re-run it. Note: because of the re-record, "before the change" means origin/main f772645, not the original baseline.

## @ac-3 Each worktree command starts fewer git processes than before the change

Result: pass

Evidence: Exists: packages/cli/test/git-count.test.ts:815-834. Substantive: for pick-up, clean, `worktree merge` and `new ticket --worktree` it asserts the git count is strictly below the recorded count in git-counts.before.json (:823). It then asserts each Part 2 item that touches the command shows fewer than its own recorded count (:825), and that exit code and stdout equal the golden (:826-827). For clean it asserts `deleted t/A-9` (squash-merged) and `deleted t/A-10` (rebased) appear, and that the final refs equal the golden refs (:831-833), which covers the same removed and kept branches. Wired: the source changes are in packages/cli/src/commands/worktree.ts (150 lines changed), packages/cli/src/load/fs.ts, new-ticket.ts and run.ts. The test drives them through `runSample`. A separate risk test at git-count.test.ts:655 covers the data-loss rule: the `--merged` set is keyed by sha, and a miss or a re-read tip goes to the content checks. Data flows: counts come from real spawns on a real sample repository. junit.xml:240 lists the test as passed in 24.7 s. I did not re-run it.

## @ac-4 The four slow tests are under 10 s or kept with an approved ceiling

Result: pass

Evidence: The criterion reads the owner's full-run junit report (D-07, D-11). That report is node_modules/.cache/accord/junit.xml: 1718 tests, 0 failures, 0 errors, and the 3 skipped tests are the ones you listed. None of them is a criterion test or one of the four. Times in the report:
- packages/cli/test/branch-fact.test.ts "risk:complex-branching gate done reads the branch diff from the merge base ignoring whitespace…": 6.45 s (junit.xml:48), down from 51.2 s.
- the same file, "risk:parsing gate done reads added call lines and package json maps…": 2.44 s (junit.xml:50), down from 32.3 s.
- packages/cli/test/lane-s.test.ts "risk:complex-branching the review package lists the out-of-scope files…": 8.48 s (junit.xml:564), down from 22.8 s. The test is unchanged, and the saving comes from the fc232b5 source change in review-package.ts.
- packages/cli/test/upgrade.test.ts "ac-2 upgrade replaces only the lint and gate step…": 2.19 s (junit.xml:1047), down from 107.8 s. It keeps its CRLF case end to end. The plain and indent cases moved to packages/core/test/scaffold.test.ts as the split-off test "risk:parsing the lint and gate refresh keeps every other line of a workflow…", which ran in 0.009 s (junit.xml:2857). It still asserts the same expected workflow text through `refreshLintStep` and `repinWorkflow`, the composition upgrade.ts applies.

All four, and the split-off part, are under 10 s, so no keep and no ceiling are needed for Part 4. `git diff main...HEAD -- packages/cli/vitest.config.ts` is empty, so the 90 s limit is not raised. The upgrade test passed the 90 s limit on the owner's Windows machine. I did not re-run the tests; this rests on the junit report you named. The branch-fact tests now build their history with fast-import (998f78f), which is a test-side cut as D-03 allows.

Note for the owner: the ledger (accord/tickets/ST-LN-63/ledger.md:14) says the new git-count and golden tests are kept over 10 s and that their ceilings go to the owner at verify. That is a separate approval from ac-4. These are the test times in the report: ac-1 14.0 s, ac-3 24.7 s, ac-2 golden 54.9 s.
