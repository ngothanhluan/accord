# Ledger

## Tasks

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

## Deferred
- plan round 1.5: Task 3 carries literal U+FEFF characters; write `﻿` escapes so the BOM cases survive a filter — deferred
- plan round 1.6: Task 1's "Must not change" names every case in schemas.test.ts while its Interface edits the key list at :146 — deferred
