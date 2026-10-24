# Ledger

## Tasks
- task 1 done 1f172fa36a5e
- task 2 done 36a07ceb385c
- task 3 done 14fc3045b659
- task 4 done 8a85c4183c7c
- task 5 done 455e0f3d4f0d

## Rulings

- Ruling: the check's letter set is U+0102, U+0103, U+0110, U+0111, U+01A0, U+01A1, U+01AF, U+01B0 plus U+1EA0–U+1EF9, written as escapes in the test so the test file passes itself; a, e and o with circumflex are left out — they are also French and Portuguese letters, and almost every Vietnamese sentence holds a letter of the set — cost if wrong: a Vietnamese line whose only marked letters are circumflex vowels slips past the check.
- Ruling: the replacement language for non-English test coverage is chosen at the approach — it needs a Gherkin dialect with non-ASCII keywords in @cucumber/gherkin 42 and a diacritic letter whose bare form is another word — cost if wrong: one fixture and golden set redone.
- Ruling: the product skills keep their "in the owner's words" wording; the English rule lives in this repository's conventions.md only (D-02, D-06), since accord users may record quotes in their own language — cost if wrong: agents here read "verbatim" and "English translation" side by side; conventions.md is appended to every executor brief, so the narrower rule wins.
- Ruling: a renamed test's id is replaced in place in accord/tests-baseline.txt — it is the same test under an English name, so the list does not grow — cost if wrong: the plan or done gate reports the renamed tests as untraced.
- Ruling: (audit) HTML character references are not decoded by the check — none is tracked today (0 in docs/plans/aidlc-vs-accord.html), and no tracked file is binary or holds a combining mark (771 files read on d5db8c3) — cost if wrong: Vietnamese written as `&#...;` slips past the check.
- Ruling: (audit) the auditor ran twice; both rounds' splits were settled by wording with the stricter reading (working tree via `git ls-files`, whole-file NUL test, committed file in a temporary repository, the branch's base commit as the baseline, the matcher's normalising, exactly one rule line), and no third round ran — the splits were about how to test, not what the owner wants — cost if wrong: a criterion the verifier reads a third way, caught at verify.
- Ruling: translated owner quotes keep the meaning and drop nothing (see sentence-rule lesson from ST-LN-33); an existing English gloss beside a quote becomes the quote — cost if wrong: a Decision reads differently from what the owner meant, caught at review.
- Ruling: (architect) the five trait tests use French (gherkin `fr` at node_modules/@cucumber/gherkin/dist/gherkin-languages.json:1344-1408; `où` against `ou`; a capital E with acute; an id holding it); other fixture prose goes to English — one language for all traits, and English needs no coverage of its own — cost if wrong: one fixture and golden set redone.
- Ruling: (architect) `accord approve` runs only on tickets whose approved_hash matched at d5db8c3, so a ticket stale at the base stays stale (@ac-3) — cost if wrong: a ticket's stage changes, caught by the @ac-3 test.
- Ruling: (architect) plan_hash is recomputed with core's plan body hash only where it matched at the base — old plans may no longer pass `gate plan`, and only task-done reads plan_hash — cost if wrong: a stale plan_hash on a done ticket.
- Ruling: (architect) Vietnamese written only with circumflex letters, which the check cannot see, is translated too, found by review — the Intent says main holds no Vietnamese — cost if wrong: Vietnamese left on main.
- Ruling: (architect) a file `git ls-files` lists but the working tree has deleted is skipped by the check — cost if wrong: none for committed state.
- Ruling: (architect) fixture gherkin-shapes VI.md is renamed FR.md — the test names change anyway — cost if wrong: cosmetic.
- Ruling: (critic) the Must (lines with only acute or grave accents, or none, slip past the search; gherkin-shapes RULE.md:15) breaks the Intent, not a Veto, Decision or Correction, so the option stays, amended to read each listed file whole and widen the search — cost if wrong: Vietnamese left on main, caught at review.
- Ruling: (critic) Shoulds folded into the option: fingerprints taken on the cleaned branch after the last approve; the stage map computed with core, not `accord status`; EARS French lines asserted to hold a letter above U+007F; tracker, panel, hash and LOGIN-1 tests to French; a listed path missing on disk skipped; the red accord check listed as an expected risk — each costs a few lines — cost if wrong: none beyond those lines.
- Ruling: (critic) its ST-LN-47 example is wrong (fe8fffe is in d5db8c3), but the point stands: `accord status` reads claim branches and git facts core does not, so the map is computed with core — cost if wrong: none.
- Ruling: (planner) the `verify:` lines of Tasks 7 to 10 name existing golden tests without a `risk:` prefix — those tasks write no test, a new one would only repeat the ac-1 check, and renaming goldens would change dozens of ids in tests-baseline.txt — cost if wrong: a critic Should on those four lines.
- Ruling: (planner) real tickets get `ac_hash`, `verified_hash` and `plan_hash` recomputed only where each matched at d5db8c3, not only `approved_hash` — otherwise a translated scenario would drop a done ticket to verify (ac-3) — cost if wrong: one extra key written where not needed, caught by the ac-3 test.
- Ruling: (planner) the ac-3 fingerprints are SHA-256 over the five records (ticket, ledger.md, plan.md, review.md, verification.md) with node:crypto in the test only — core's fnv1a64 is not exported — cost if wrong: none, only this test reads them.
- Ruling: (planner) the D-85 CONTEXT note tests move to French with LOGIN-1's French scenario, which they quote, and their describe is renamed "non-English" — cost if wrong: four test ids renamed in tests-baseline.txt.
- Ruling: (planner) the @ac-1 test is added in the last task, not Task 1, so every earlier task keeps a green suite — cost if wrong: none.
- Ruling: (planner) the check skips a listed path that is not a regular file (deleted path, submodule folder) via `statSync` — cost if wrong: none for committed files.
- Ruling: Task 12's `files:` marks no-vietnamese.test.ts `(new)` although Task 1 creates it — `(new)` is relative to the baseline, which `gate plan` requires — cost if wrong: none.
- Ruling: the plan critique adds a `security` lens — rewriting about 75 committed ticket records and their approval hashes is treated as a migration of approval data — cost if wrong: one extra critic's tokens.
- Ruling: (planner) real tickets' `ac_hash` and `verified_hash` are never rewritten, and the criteria text (or lane S Understood/Done when) must hash the same at base and on the branch; this replaces the ac_hash/verified_hash part of the planner Ruling on recomputing hashes (plan_hash unchanged) — no real ticket's criteria hold Vietnamese, and a rewrite would hide an accidental edit — cost if wrong: a criterion that does hold Vietnamese stops the work and goes to the owner.
- Ruling: plan step 6 does not forbid merging origin/main; merges follow the owner's standing rule (merge at once when behind) and each merge takes step 6's handling (re-judge hashes and stages at the merged main commit for the tickets the merge changed, exclude them from fingerprints.json) — the planner's ban contradicted an owner instruction, and the handling already covers a merge at any step — cost if wrong: more tickets judged against a second base, caught by the step 5 status diff.
- Ruling: (planner) plan step 7's fix dispatch uses review's own fix-brief form (the ticket byte for byte, the plan preamble, the Task 11 section, the two step 3 lines and a "fingerprints.json only" line), as accord-review SKILL.md:37-41 defines it — cost if wrong: one extra brief-format rule for the main session to follow.
- Ruling: (planner) step 5's version override applies to the merged-main worktree too — same command, and a later release could make the pins differ again — cost if wrong: one config edit that does nothing.
- Ruling: (planner) step 6 takes main's side of a conflicted ticket record with `git checkout --theirs`, since during `git merge origin/main` "theirs" is the branch merged in — cost if wrong: the wrong side is kept, which step 3's hash comparison shows.
- Ruling: (planner) step 7's trigger excludes ST-LN-48's own records, as fix 3.2 words it, which also settles Nice 3.6 — cost if wrong: none, ST-LN-48's records are not fingerprinted.
- Ruling: the plan-stage baseline run (tests.full at 4b8a9a8 plus the plan files, 2026-10-24) had 1 failure in 1517 tests: packages/cli/test/show-approval.test.ts "ac-1 every scenario of every real ticket is rebuilt exactly from the approval view" timed out at 300 s under full-suite load and passed alone in 140 s; the owner chose to track it in ST-LN-44, not fix it first — owner: "Track it in ST-LN-44" (translated from Vietnamese) — cost if wrong: the same timeout at verify, answered by rerunning that test alone.
- Ruling: merge 103ec20 of origin/main 060a8a7 (plan step 6) changed the records of BUG-LN-7, ST-LN-46, ST-LN-49 and ST-LN-50 since d5db8c3; no step 2, 3 or 5 has run and no Task 11 or 12 test exists yet, so these four take step 2 and step 3 with `B` = 060a8a7 when those steps run, go to Task 11 as excluded from fingerprints.json, and step 5 compares them against 060a8a7 (D-08) — cost if wrong: a ticket judged against the wrong base, caught by the step 5 status diff.
- Ruling: merge of origin/main efdf4fb (plan step 6) changed only accord/tickets/ST-LN-44.md since 060a8a7; ST-LN-44 joins the four tickets of merge 103ec20: it takes step 2 and step 3 with `B` = efdf4fb, is excluded from fingerprints.json, and step 5 compares it against efdf4fb (D-08); no code changed, so the CLI build stays — cost if wrong: a ticket judged against the wrong base, caught by the step 5 status diff.
- Ruling: (executor, task 1) the test and vietnameseLines were written together and the red step was shown by dropping U+0111 from the letter class (1 failed, Expected ['docs/notes/a.md:3'], Received []) — the brief gave both in one piece — cost if wrong: the red step is simulated, not a true red-first run.
- Ruling: (executor, task 3) the hash.test.ts title "hashes the UTF-8 bytes, so diacritics change the value" is kept, as the plan says; no red step was possible, since normalise already keeps diacritics — cost if wrong: none.

## Deferred

- plan-review 1.8 (Nice): gherkin-shapes RULE.md:21 is unmarked Vietnamese; the read-whole-file rule covers it, review checks it.
- plan-review 1.9 (Nice): this ticket's plan-review.md must also name check-set letters by code point.
- plan-review 1.10 (Nice): the PR body must name gate.tick-stale-commit and gate.stale-review (Approach risk line); done when the PR opens.
- plan-review 1.11 (Nice): 'Ba' at packages/core/test/verification.test.ts:40 and verification-edges A/verification.md:20 is unmarked Vietnamese; review checks it.
- plan-review 1.12 (Nice): translations must not introduce the vague-wording phrases at packages/core/src/lint/ticket.ts:41.
- plan-review 2.4 (Nice): step 3's "every ticket" must read "every ticket other than ST-LN-48", so ST-LN-48.md is never reverted.
- plan-review 2.5 (Nice): a merged file outside accord/tickets/ holding Vietnamese goes to a fix task translated by the preamble rules.
- plan-review 3.5 (Nice): after Task 10, the main session dispatches Task 12 before Task 11, although `accord anchor` names Task 11 first; Task 11's brief needs step 3's two lines.
- plan-review 3.6 (Nice): step 7 fires only on records of a ticket other than ST-LN-48.
- plan-review 3.7 (Nice): step 3's revert rule exempts every ticket step 6 names as well as step 2's list.
- plan-review 3.8 (Nice): stage-baseline.test.ts gets a one-line header comment saying it pins d5db8c3's stage map and how to regenerate base-stages.json.
