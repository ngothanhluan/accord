# Ledger

## Tasks
- task 1 done e88add4b3ebe
- task 2 done d9f5a6df4514

## Rulings

- Ruling: the audit's two readings are settled in the criteria's wording, not by owner questions — "no tests.affected" is a missing key, since config.schema.json gives `affected` and `full` minLength 1 so an empty value is invalid config; a `verify:` entry's text before `#` is the test file under vitest, so no test-file pattern is needed (superseded below: it is kept only when it is a file); paths are joined by single spaces; ac-4 covers the core executor text and every copy `accord skills sync` renders, per the compatibility constraint — cost if wrong: one criterion reworded at a later stage and re-approved.
- Ruling: a ` (new)` mark on the `files:` line is dropped before the path goes into `{files}`; quoting of a path with spaces is left to the approach — the mark is plan notation, not part of the path — cost if wrong: the printed command passes a non-existent path to `vitest related`.
- Ruling: the plan preamble's "run the test files the task names" stays out of this ticket's criteria; the approach decides whether the plan skill changes — the brief's printed command is the one the executor text points to — cost if wrong: an executor sees two test instructions in one brief.
- Ruling: the approach critic's Must and Should findings are taken into option 1, not used to rule it out — none breaks a Veto, Decision or Correction — cost if wrong: a heavier option was the better fit. A `verify:` prefix goes into `{files}` only when it is a file in the repository or on `files:` (Must: pytest and jest classnames are not paths), and paths with shell metacharacters are single-quoted (Should: Next.js `(group)` and `[slug]`, Remix `$id`). The ac-1 join by single spaces still holds.
- Ruling: an empty path list prints the ac-3 kind of line, not a command with an empty `{files}` — an empty filter runs the whole suite under pytest or `vitest run` — cost if wrong: a task with no files gets no command.
- Ruling: the executor bullet carries a clause for a brief that prints no command (review, debug and failure briefs, ac-3): run only the test files you wrote or changed, never `tests.full` — otherwise the red/green rule breaks in the review and debug fix loops — cost if wrong: one extra sentence in the executor text.
- Ruling: a `tests.affected` without `{files}` is printed as written; repeats are matched by exact string; an invalid config.yml gets the ac-3 line; a `verify:` prefix is cut at the first `#` — the CLI never edits a configured command or normalises paths — cost if wrong: a path is run twice or cut short.
- Ruling: the workflow-layer spec's brief and tests sections are updated in this ticket — they would describe the old brief otherwise — cost if wrong: one doc paragraph.
- Ruling: the brief's exact lines are `Test command: <cmd>`, "This is the only test command the executor runs for this task.", "tests.full is printed because accord/config.yml has no tests.affected.", "No test command is configured: accord/config.yml has no tests.affected and no tests.full.", and a separate line for a task with no path — the criteria name the meaning, not the words — cost if wrong: the test strings and the spec text change together.
- Ruling: the empty-path line applies only when `tests.affected` contains `{files}`; otherwise the command is printed as written — it matches the printed-as-written Ruling — cost if wrong: a task with no path runs a command that has no filter.
- Ruling: existing tests with no `risk:` (build phrases, skill size, `stays short`) are named as must-stay-green in the task text, not on `verify:` lines — a `verify:` id that proves no criterion must carry `risk:` — cost if wrong: task-done does not check them per task; the full suite at verify does.
- Ruling: task 1's executor ran the brief's `vitest related` command as printed, though it ran 31 files in about 15 minutes — the brief says it is the only command allowed — cost if wrong: when the dependency graph is the cause, this ticket's own tests.affected is as slow for any task touching cli sources.
- Ruling: task 2's executor appended the new test with the Edit tool, since a compound bash heredoc was refused in the worktree — the content is the same either way — cost if wrong: none.

## Deferred
- plan-review 1.2 (Nice): the build skill's `description:` and refusal bullet still name `tests.affected` as the command whose report goes missing; reword to "the command the brief printed" while keeping the word `tests.affected` for `REQUIRED`.
- plan-review 1.3 (Nice): Task 1 should say that a path repeated on the `files:` line itself is left out; Task 3 (a) relies on it.
