---
ticket: "BUG-LN-8"
commit: "b2ba8cbb444e5a453d2fc267d37032cb86401849"
reviewed_on: "2026-10-24"
---

## @ac-1 Upgrade refreshes the lint-and-gate step of an older install

Result: pass

Evidence: Exists: refreshLintStep and locate in packages/core/src/scaffold/repin.ts:20-83; test packages/cli/test/upgrade.test.ts:121-148 with fixture packages/cli/test/fixtures/workflow-0.1.0.yml. Substantive: refreshLintStep cuts the span from workflowYml(name, version) and splices it over the old step, then guards with a whole-document toJS comparison. Wired: packages/cli/src/commands/upgrade.ts:64-67 calls refreshLintStep and then repinWorkflow, and writes the result to the workflow path on the upgrade branch. Data flows: the test pins 0.1.0, runs the `upgrade` command, reads the file from the remote branch with `git show`, and compares it to the old head plus the fresh init text from initFiles. It also asserts exactly one `lint and gate` step. `npx vitest run test/upgrade.test.ts` in packages/cli: 7 of 7 passed.

## @ac-2 Upgrade keeps every other line of the workflow

Result: pass

Evidence: Exists: test packages/cli/test/upgrade.test.ts:150-192. Substantive: the input has a hand edit (`working-directory: app`), a team step, an extra job, and trailing comments. It runs in three variants: LF, CRLF (with `.gitattributes -text`), and a shallower indent. Each expected file is the input with the edit removed and the pin changed, compared exactly with `toBe`. The splice shifts indent and keeps the line ending (repin.ts:57-74). Wired: the same upgrade.ts:64-67 path. Data flows: the upgrade branch file is read via `git show` on the remote. All variants passed in the vitest run (7 of 7).

## @ac-3 A workflow without exactly one lint and gate step is only repinned

Result: pass

Evidence: Exists: tests at packages/cli/test/upgrade.test.ts:215-228, plus risk tests for anchored, flow, and alias steps and for a failed push (:230-270). Substantive: locate returns 'count' when the step count is not 1 (repin.ts:44), and refreshLintStep returns `{refused}`. Wired: upgrade.ts:68-73 builds the warning and writes it with `ctx.stderr.write` after the push (:109). Stdout stays the three lines. If the push fails, the warning is appended to the error. Data flows: for both the no-step and two-step inputs the test asserts exit 0, the upgrade branch file equals the input with only the pin changed, and stderr contains the workflow path, `lint-and-gate script`, `was not refreshed`, and `leave exactly one step named lint and gate and run accord upgrade again`. All passed (7 of 7).
