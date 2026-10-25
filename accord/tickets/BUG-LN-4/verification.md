---
ticket: "BUG-LN-4"
commit: "b8d3c1abc90837f7e0322195bdc12e03433c74c1"
reviewed_on: "2026-10-24"
---

## @ac-1 Deleting an approved ticket that was not dropped fails the check

Result: pass

Evidence: Exists: packages/cli/test/workflow-script.test.ts:321-338 is the tagged test; its cases (DELETED_APPROVED, :157-169) are an approved ticket deleted, a lane S ticket with ac_hash deleted, and a rename (delete plus add under accord/archive/), matching D-05. Substantive: packages/core/src/scaffold/workflow.ts:172-195 runs the deletion loop on every pull request. It calls protected_at (:132-143, which covers an approved_hash key, a non-empty verified list, and an ac_hash key on lane S or with no lane key). When the ticket is not dropped, it prints "<id>: an approved or done ticket cannot be deleted before it is dropped - ... run accord drop <id> ..." and sets code=1. Wired: the loop sits in the emitted "lint and gate" step, and the script ends in `exit $code`. Data flows: the test executes the emitted script under `bash --noprofile --norc -eo pipefail` (:268) in a temporary git repository with a real BASE sha. It asserts exit 1, the id, "accord drop OLD-1", the merge advice, and that only lint ran. junit.xml (fresh) lists this test with no failure (29.99s, under the 60s describe timeout).

## @ac-2 Deleting a dropped ticket or an unapproved ticket still passes

Result: pass

Evidence: Exists: the test is at packages/cli/test/workflow-script.test.ts:340-349. DELETED_FREE (:171-183) has a dropped ticket with a reason, and an unapproved ticket deleted together with its accord/tickets/OLD-1/ folder. Substantive: packages/core/src/scaffold/workflow.ts:147-157 (is_dropped) requires `status: dropped` and a non-empty ## Dropped reason. protected_at returns 1 for an unapproved ticket, which hits `continue`, so nothing is flagged. Wired and data flows: the script runs for real under the CI flags. The test asserts exit 0, exactly one npx call (lint, so no gate done), and the "nothing to gate" line, which workflow.ts:197-199 prints only when no deletion failed. junit.xml shows the test passing.

## @ac-3 Swapping an approved ticket for an unapproved one fails and still gates the new ticket

Result: pass

Evidence: Exists: the test is at packages/cli/test/workflow-script.test.ts:351-362, with one SWAP case (:185-189) that deletes OLD-1 and adds NEW-3. Substantive: the deletion loop sets code=1 and does not exit early, because `exit $code` at workflow.ts:200 is reached only when there are no tickets to gate. Otherwise the script falls through to the gate loop (:202-226), which runs `gate done NEW-3`. Data flows: the test asserts exit 1, the OLD-1 deletion message and "accord drop OLD-1", two npx calls with the second being `gate done NEW-3`, and the stub's output marker "npx stub: ..." in the printed output. junit.xml shows it passing.

## @ac-4 Every failure is reported on one push under the flags CI uses

Result: pass

Evidence: Exists: the test is at packages/cli/test/workflow-script.test.ts:538-557. Substantive: workflow.ts:80-84 puts `set +e` before `set -uo pipefail`, with a comment saying GitHub starts the script with -e. Lint and gate failures are accumulated with `|| code=1`. The `shell: bash` line is kept. Wired: the same text is in .github/workflows/accord.yml (grep finds one `set +e`), and the replay test at :514 compares it with the emitted script (passed in junit). Data flows: the test fails lint and the first gate together. It asserts exit 1, three calls (lint, SIGNUP-1, SIGNUP-2), and the failure markers printed for lint and for the first gate. A flags probe confirms errexit and pipefail are on. The `set +e` probe (:559-572) inserts a bare `false`. The calls complete with the line (3 calls, exit 0) and stop without it (0 calls). Flags clause: the only execFileSync calls on bash are :64 (an availability check, `-c 'exit 0'`, which does not run the workflow script) and :268 (runScript, with `--noprofile --norc -eo pipefail`). Every workflow-script run, probes included, goes through runScript. All of these tests pass in junit.xml.

Note outside the criteria: the full-suite junit has 1 failure out of 1524. It is packages/cli/test/show-approval.test.ts "ac-1 every scenario of every real ticket is rebuilt exactly from the approval view", a 300s timeout under load. It is not part of this ticket's files or criteria. Also, I did not re-run the suite myself; I relied on the fresh junit report plus reading the code and the tests.
