# Ledger

## Tasks

## Rulings

- Ruling: the audit's two readings are settled in the criteria's wording, not by owner questions — "no tests.affected" is a missing key, since config.schema.json gives `affected` and `full` minLength 1 so an empty value is invalid config; a `verify:` entry's text before `#` is the test file under vitest, so no test-file pattern is needed (superseded below: it is kept only when it is a file); paths are joined by single spaces; ac-4 covers the core executor text and every copy `accord skills sync` renders, per the compatibility constraint — cost if wrong: one criterion reworded at a later stage and re-approved.
- Ruling: a ` (new)` mark on the `files:` line is dropped before the path goes into `{files}`; quoting of a path with spaces is left to the approach — the mark is plan notation, not part of the path — cost if wrong: the printed command passes a non-existent path to `vitest related`.
- Ruling: the plan preamble's "run the test files the task names" stays out of this ticket's criteria; the approach decides whether the plan skill changes — the brief's printed command is the one the executor text points to — cost if wrong: an executor sees two test instructions in one brief.
- Ruling: the approach critic's Must and Should findings are taken into option 1, not used to rule it out — none breaks a Veto, Decision or Correction — cost if wrong: a heavier option was the better fit. A `verify:` prefix goes into `{files}` only when it is a file in the repository or on `files:` (Must: pytest and jest classnames are not paths), and paths with shell metacharacters are single-quoted (Should: Next.js `(group)` and `[slug]`, Remix `$id`). The ac-1 join by single spaces still holds.
- Ruling: an empty path list prints the ac-3 kind of line, not a command with an empty `{files}` — an empty filter runs the whole suite under pytest or `vitest run` — cost if wrong: a task with no files gets no command.
- Ruling: the executor bullet carries a clause for a brief that prints no command (review, debug and failure briefs, ac-3): run only the test files you wrote or changed, never `tests.full` — otherwise the red/green rule breaks in the review and debug fix loops — cost if wrong: one extra sentence in the executor text.
- Ruling: a `tests.affected` without `{files}` is printed as written; repeats are matched by exact string; an invalid config.yml gets the ac-3 line; a `verify:` prefix is cut at the first `#` — the CLI never edits a configured command or normalises paths — cost if wrong: a path is run twice or cut short.
- Ruling: the workflow-layer spec's brief and tests sections are updated in this ticket — they would describe the old brief otherwise — cost if wrong: one doc paragraph.

## Deferred
