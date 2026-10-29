# Plan review

## Round 1 (whole)

1. Should — build step 3's fallback for a brief that prints no command ("run the test files on the task's `verify:` line") cannot be carried out in the no-path case and differs from the executor's fallback ("run only the test files you wrote or changed"); a pytest task with no `files:` and a module-name `verify:` prefix leaves the orchestrator no file and no command, and `task-done` refuses on a stale report — open
2. Nice — the build skill's `description:` and its refusal bullet still name `tests.affected` as the command whose report goes missing, which is wrong when only `tests.full` is configured — deferred
3. Nice — Task 1 does not say that a path repeated on the `files:` line itself is left out, while Task 3 (a) relies on it and forbids changing the de-duplication — deferred
