---
ticket: "BUG-LN-4"
commit: "cd0815af2b74333f1728bf6896e4aea5c719d3f5"
reviewed_on: "2026-10-28"
---

## @ac-1 Deleting an approved ticket that was not dropped fails the check

Result: pass

Evidence: Ran `ACCORD_BASH='C:\Program Files\Git\bin\bash.exe' npx vitest run packages/cli/test/workflow-script.test.ts` at cd0815a: 1 file passed, 24 tests passed, 1 skipped (the POSIX-only bash guard, `it.skipIf(process.platform === 'win32')` at packages/cli/test/workflow-script.test.ts:325). The named test (packages/cli/test/workflow-script.test.ts:355-372) exists and runs three cases from `DELETED_APPROVED` (:158-171): approved_hash, lane S with ac_hash, and delete plus re-add elsewhere (rename; the script diffs with `--no-renames`). Each asserts exit 1, only lint called (no gate done), and the id, "accord drop OLD-1" and the merge advice in the output. Substantive and wired: packages/core/src/scaffold/workflow.ts runs the deletion loop unconditionally (the `gone=$(git diff ... --diff-filter=D)` loop), calls `protected_at` (approved_hash, non-empty verified, ac_hash on lane S/absent lane) then `is_dropped`, prints the message and sets `code=1`. Data flows: the script comes from `workflowYml` and the test lifts it from the emitted document. The ids and paths come from a real git diff in a temporary repository, not from constants. `.github/workflows/accord.yml` has the same script, and the replay test at :559 (it runs these cases against it) passed.

## @ac-2 Deleting a dropped ticket or an unapproved ticket still passes

Result: pass

Evidence: The test at packages/cli/test/workflow-script.test.ts:374-383 passed in my run. It covers `DELETED_FREE` (:172-184): a ticket with `status: dropped` and a `## Dropped` reason, and an unapproved ticket deleted together with its accord/tickets/OLD-1/ folder. Each case asserts exit 0, only the lint call (so no `gate done`), and the nothing-to-gate line. In workflow.ts, `protected_at ... || continue` skips unprotected tickets, and `is_dropped` returning 0 raises no failure. The path from entry to output is the real git diff, the real awk reading of the reason, and the script's exit code, all executed under bash.

## @ac-3 Swapping an approved ticket for an unapproved one fails and still gates the new ticket

Result: pass

Evidence: The test at packages/cli/test/workflow-script.test.ts:385-396 passed. `SWAP_CHANGE` (:186-189) deletes OLD-1 and adds a draft NEW-3, with the stub gate failing for NEW-3. It asserts exit 1, the OLD-1 deletion message with "accord drop OLD-1", exactly two calls with the second being `gate done NEW-3`, and the stub's output printed. In workflow.ts the deletion failure sets `code=1` and `has_code=1` (via `approved_at` on the base) and does not `exit` before the gate loop, because the early exit fires only when `$tickets` is empty. The new ticket therefore still reaches `gate done "$id" || code=1`.

## @ac-4 Every failure is reported on one push under the flags CI uses

Result: pass

Evidence: The test at packages/cli/test/workflow-script.test.ts:589-608 passed. `BOTH_FAIL` makes lint and one gate fail. The test asserts exit 1, three calls (lint and both gates), and the "npx stub failed" markers for lint and gate 1. It also runs a flags probe script that prints `errexit-on` and `pipefail-on`. The probe confirms bash really runs with -e and pipefail. Mutation test at :610-623, passed: inserting a bare `false` leaves all 3 calls with `set +e` present and gives 0 calls when `set +e` is removed. So the `set +e` line in workflow.ts is what the test depends on. Flags: both spawn helpers (:282 and :304) pass `--noprofile --norc -eo pipefail`, and there are no other `execFile` or `spawn` calls in the file. The one flagless call is the availability check `bash -c 'exit 0'` at :65. It does not run the workflow script, so I count it as outside the clause "every test that runs the workflow script". The clause could also be read as including that line. If the owner reads it that way, it is a nit, not a failure of behaviour. The `set +e` line also sits in .github/workflows/accord.yml (the grep count is 1), and the replay test passed.
