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

## Deferred
