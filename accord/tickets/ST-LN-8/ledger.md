# Ledger

## Tasks
- task 1 done 598055defb7e
- task 2 done 23a2cd412108
- task 3 done a8da3641406d
- task 4 done 1b7fd5ceb97c
- task 5 done f710ac340ed4

## Rulings
- Ruling: the ac-1 and ac-5 tests check that the rendered text states each rule, by its key phrases (`classname`, `#`, `accord task-done`, `accord/`, `conventions.md`), not word for word — wording may be improved later without breaking the test — a test too loose to catch a dropped rule
- Ruling: task-done checks commits only when it is about to write a ledger line — ac-3 says it records nothing on a refusal, and a recorded task is already past — an already-recorded task with an offending commit is caught only by gate done
- Ruling: when the ledger's task sha does not resolve in this clone (a rebase, a fresh clone), the range falls back to `HEAD ^<defaultRef>` alone — a missing sha must not make git exit 128 — commits of earlier tasks are re-checked, which is only stricter
- Ruling: under forbid, a gate done snapshot with no commits loaded (undefined, not an empty list) is an error finding, never a pass — gateDone is public core API and must not fail open for a caller that skips the cli loader — a core caller without git must load commits or see the error
- Ruling: the commit loader passes `-c log.showSignature=false --no-show-signature` and a 64 MiB maxBuffer like the other git loaders — D-07 says the result does not depend on git config; signature lines would corrupt the sha field — none
- Ruling: brief reads conventions.md from disk, not the normalised snapshot copy — ac-2 says byte for byte — a BOM or CRLF reaches the brief as written
- Ruling: the main session, not an executor, writes this repository's accord/config.yml and accord/product/conventions.md — the executor rule bars the top-level accord/ folder — none
- Ruling: the ruleset line says "when that file exists" — repositories made before this version have no conventions.md — none
- Ruling: the subject is the message's first line and every line after it is checked — D-07 says the subject is never checked — a subject wrapped onto line 2 has that line checked, which is only stricter
- Ruling: `commits` lives on `RepoSnapshot` only, and gate.ts loads it only for gate done under forbid with a HEAD — no `git log` or exit-2 check on every command — another core caller sees the error finding instead
- Ruling: ac-4's tests go in the existing packages/cli/test/gate.test.ts and packages/core/test/gate.test.ts — gate.task-file-unknown is per task, so task 2 cannot name a file task 1 creates without `(new)` — none
- Ruling: commit tests write the message to a file and commit with `-F` and `--cleanup=verbatim` — emoji and exact bodies reach git unchanged on Windows — none
- Ruling: the ruleset's line 3 is shortened to keep it under the 2048-byte test, with a second fixed trim in rule 1 if needed, else the executor stops BLOCKED — the planner's byte count is by hand — the test catches a wrong count
- Ruling: promotion sits inside verify step 6, after gate done passes and before the commit — the accord skill resumes `done` at step 6, so the numbering must stay — none
- Ruling: D-09's route goes in a new Task 6 placed last, not folded into Task 5 — it is a different skill and Task 5 is about verify — none
- Ruling: the D-08 and D-09 tests carry `risk:complex-branching` — they guard which branch a path or a refusal takes, and no criterion names them — a reviewer may prefer another kind, which only renames the tests
- Ruling: this repository's conventions.md holds one rule line covering Co-Authored-By, every other `-by:` line and "Generated with" — round 1.2 asks for at least that, and more goes beyond the ticket — none
- Ruling: the main session's config commit is the single line `config: ST-LN-8 turn on the commit trailer check for this repository` with no body — it must not carry a forbidden line itself — none
- Ruling: the docs name conventions.md after the ticket's-own-record parenthetical, not inside it — conventions.md is not a record of the ticket — one wording change in two docs
- Ruling: the spec doc's wrapped line starts with "or `accord/product/conventions.md` (ST-LN-8 D-08)." with no leading space — a Markdown continuation line need not begin with a space — one whitespace character
- Ruling: task 2 was recorded with packages/cli/test/hook.test.ts "the prompt expansion hook blocks every accord text…" failing once in the affected run (33 s against the 30 s testTimeout; 13 s alone, and its file passes alone) — the hook does not reach this ticket's code and the baseline suite passed — a real regression would surface again in the verify full suite
- Ruling: brief tests blankness with `conv.trim() === ''` — JS trim and `\s` already cover the byte order mark — none, the blank cases in the test cover it

## Deferred
- plan round 1.5: Task 3 carries literal byte order mark characters; spell each one as a JavaScript escape so the BOM cases survive a filter — deferred
- plan round 1.6: Task 1's "Must not change" names every case in schemas.test.ts while its Interface edits the key list at :146 — deferred
- plan round 2.2: Task 2's test bullet repeats "the existing case the existing own-records case at line 434" — deferred
