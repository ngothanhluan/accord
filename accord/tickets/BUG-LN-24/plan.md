---
baseline: 55e68d149e22653ab730711c3d75cc59e5e10b94
plan_hash: "fnv1a64:209349ed07e8cb2b"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<file>#<name>` with each whitespace run turned into `-`; a test inside a
`describe` block is named `<describe> > <test>` by the vitest JUnit reporter, so its id holds `->-` between the
two. No test name begins with `@`, holds `(@ac-n)`, or holds a comma. CLI tests run the built packages, so run
`npm run build` after the core change and before any CLI test; `accord task-done` is run as
`node packages/cli/dist/cli.js`.

## Task 1: Both plan-hash refusals name the build skill's way out instead of accord gate plan
covers: @ac-1, @ac-2, @ac-3, D-01, D-02, D-03, D-04, D-05, D-06, D-07
files: packages/core/src/gate/task.ts, packages/core/test/task.test.ts, packages/cli/test/lane-commands.test.ts
verify: packages/core/test/task.test.ts#ac-1-a-plan-edited-after-it-passed-the-gate-is-refused-with-the-build-skill-way-out (@ac-1), packages/core/test/task.test.ts#ac-2-a-plan-that-never-passed-the-gate-is-sent-back-to-accord-plan (@ac-2), packages/cli/test/lane-commands.test.ts#plan-contract-checks->-ac-3-a-passing-gate-plan-writes-plan_hash-once-and-an-edited-plan-that-passes-gate-plan-again-is-recorded-done (@ac-3)
after: none

This is the reproduction task: the two core tests are written first and fail against the baseline, whose
reasons still say `run accord gate plan T-1`.

Consumes: `taskVerdict(snapshot, id, n): TaskVerdict` in `packages/core/src/gate/task.ts`, unchanged in
signature, export and check order (no plan, no `plan_hash:`, hash mismatch, then the task, its `verify:` line
and the report). Produces: the same verdict, with only the two plan-hash reason strings replaced by D-04's
sentences, word for word, with no ticket id:

```interfaces
no plan_hash:    "plan.md has no plan_hash: the plan stage has not finished; go back to accord-plan"
hash mismatch:   "plan.md changed since its plan_hash was recorded: show the owner the diff of plan.md; if the owner made the change, accord-plan reviews it; otherwise restore plan.md with the owner's yes"
```

Tests first, in `packages/core/test/task.test.ts`. The `describe('taskVerdict plan hash', ...)` block and its
one test are removed and replaced by two top-level `it(...)` tests (no `describe` wrapper), using the file's
`snap` helper and the fixture `PLAN` from `test/helpers/lane.ts`, which carries a `plan_hash:` line:
- `ac-1 a plan edited after it passed the gate is refused with the build skill way out`: the plan is `PLAN`
  with its `plan_hash:` value replaced by `"fnv1a64:0000000000000000"` (the edit the removed test made).
  `taskVerdict(s, 'T-1', 1)` equals `{ verdict: 'fail', reasons: [<the hash-mismatch sentence above>] }`, and
  `reasons.join('\n')` does not contain `accord gate plan` (a case-sensitive substring check, D-06).
- `ac-2 a plan that never passed the gate is sent back to accord-plan`: the plan is `PLAN` with its whole
  `plan_hash:` line removed (`/^plan_hash: .*\n/m`). The verdict equals `{ verdict: 'fail', reasons: [<the
  no-plan_hash sentence above>] }`, and the joined reasons do not contain `accord gate plan`.

Then change the two string literals in `packages/core/src/gate/task.ts` so both tests pass.

In `packages/cli/test/lane-commands.test.ts`, inside `describe('plan contract checks', ...)`, the test now named
`a passing gate plan writes plan_hash once; an edited plan stops task-done until gate plan runs again` is
renamed `ac-3 a passing gate plan writes plan_hash once and an edited plan that passes gate plan again is
recorded done`, and its assertion on the stale run's output changes from the substring
`plan.md changed after accord gate plan last passed` to `plan.md changed since its plan_hash was recorded`.
Everything else in it stays: the first gate plan writes `plan_hash:` once and a second run leaves the file and
its mtime unchanged, the edited plan makes `task-done T-1 1` exit 1, gate plan passes again, the report is
touched newer and written, and `task-done T-1 1` exits 0 with `- task 1 done <sha>` in the ledger; its 30000 ms
timeout stays.

Behaviour that must not change: every other reason of `taskVerdict` and `ticketTaskVerdict` and every other
test in `task.test.ts` (the `hashed` helper, `fails with one reason for a missing plan, task, verify line, or
report`, and the `recordTaskDone` tests) stay as they are; `packages/cli/src/commands/task-done.ts` is not
edited and still prints each reason verbatim under `task <n> of <id> is not done:`. Under D-05 no skill source,
generated skill copy, doc or ticket record changes, so `npm run gen` is not run.

## Failure modes
- Build step 7 (`packages/core/skills/build/SKILL.md:48`) fires on the words `plan.md changed`; the new mismatch sentence keeps them at its start, but no test ties the skill text to the reason, so an agent would miss step 7 if a future edit of either side drops those words (the Intent puts a skill-agreement check out of scope; task 1 owns the reason, and its `verify:` ac-1 test pins the exact sentence).
- An agent that reads only the CLI output could take "accord-plan reviews it" as leave to dispatch `accord-plan` before the owner has seen the diff; the sentence puts "show the owner the diff" first, and no test checks an agent's reading of it (task 1 owns the wording, which D-04 fixes).
