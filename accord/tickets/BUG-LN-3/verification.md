---
ticket: "BUG-LN-3"
commit: "655b32644656c4feeba439eee6fa1dbcc98a3fda"
reviewed_on: "2026-10-17"
---

## @ac-1 A pull request that adds or edits only unapproved tickets passes without gate done

Result: pass

Evidence: Exists: packages/core/src/scaffold/workflow.ts (has_code flag, approved_at, skip branch in the ticket loop) and the test at packages/cli/test/workflow-script.test.ts:350-370. Substantive: the loop `continue`s with "not gating" only when has_code=0 and neither HEAD nor BASE has an approved_hash key. Wired: the script is the `run` block of the emitted workflow, lifted and run under bash on temp git repos with a stub accord. The test asserts add, edit and lint-fail cases make exactly one call (lint), no `gate done`, exit 0, and exit 1 when lint fails. Data flows: the decision reads real `git diff` and `git show` output from the sandbox repo. JUnit (node_modules/.cache/accord/junit.xml) shows the test passing, with 0 `<failure>` elements.

## @ac-2 A pull request that drops a ticket, or edits a dropped one, passes without gate done

Result: pass

Evidence: Exists: is_dropped in packages/core/src/scaffold/workflow.ts (status: dropped in HEAD plus a non-empty `## Dropped` section) and the test at packages/cli/test/workflow-script.test.ts:537-577. Substantive: the DROPPED cases make one call (lint) and exit 0. The real-CLI part drops an approved ticket with a reason (exit 0, one call, no lint error) and drops one with no section or only a comment (exit 1, lint's "a dropped ticket needs a ## Dropped section saying why" is printed). Wired: it forwards to the built CLI, so real `accord lint` runs. Data flows: sandbox git state drives the result. The test passes in the JUnit report.

## @ac-3 A pull request that carries code, or touches an approved ticket, still gates it

Result: pass

Evidence: Exists: packages/cli/test/workflow-script.test.ts:144-200 (GATED cases) and :372-383. Substantive: GATED covers a draft ticket plus code, a dropped ticket plus code, a deletion outside accord/, an approved base with approved_hash removed in the PR (NO_KEY_TICKET, line 188), renames, and dropped-without-reason. Each case asserts lint then `gate done <id>`, and a failing gate gives exit 1 (:381-382). Wired and data flows: workflow.ts has_code is set from `git diff --name-only` outside `accord/`, and approved_at checks BASE through git show. The risk:parsing test (:385) covers BOM, CRLF, unreadable blocks and large files, and they are all gated. Passes in JUnit.

## @ac-4 This repository's workflow gates by the same rule as the one accord init writes

Result: pass

Evidence: Exists: .github/workflows/accord.yml, whose diff against main adds the script (7 has_code lines). The test at packages/cli/test/workflow-script.test.ts:443-463 parses the yml, takes the single step named "lint and gate", and runs it and the emitted SCRIPT over every UNAPPROVED, DROPPED, NESTED_STATUS and GATED case. Substantive and wired: it asserts equal exit codes and equal lists of gated ids per case. Data flows: both scripts run against real sandbox repos. Passes in JUnit (33.9 s). The full suite had 63 files and 1282 tests passing, with 0 failures.
