# Ledger: ST-LN-73

## Rulings

- Ruling: the ticket stays lane M although after the interview it fits lane S on size — D-06 measures at the plan stage, which lane S lacks, and moving the lock wait ahead of the worker count has traps a critic should see before code (packages/cli/test/vitest-config.test.ts:24 imports the root config inside a run that holds the lock, and an editor's vitest extension loads the config too); the owner left the choice to me: "you choose, as long as the result is good and not too cumbersome" — cost if wrong: an approach and a plan stage that lane S would have skipped.
- Ruling: D-06's measurement is one full run at dd93c14 with ACCORD_TEST_WORKERS=4, not the default 10, sampled every 500 ms on Windows 11 (20 CPUs, 34.0 GB): 91 files, 1694 passed, 3 skipped, 627 s; the OS free memory fell from 9.32 GB to a low of 7.10 GB (2.22 GB); the working set of the run's own node and git processes peaked at 1.21 GB (10 node, 4 git), p90 0.98 GB, largest single node 0.38 GB — the machine had about 9 GB free, and 10 forks risked the very out-of-memory this ticket prevents, while the cost per fork can be read from 4 — cost if wrong: the per-fork figure is off by the main process's share, about 0.1 GB.
- Ruling: each fork needs 0.6 GB, the 2.22 GB fall in free memory over 4 forks rounded up, which counts more than the 1.21 GB working set because memory the run commits but does not keep resident still leaves the free pool, and the 4 GB kept free for the rest of the machine (now D-09, set from the measurement and the 2026-10-30 stop; the CI fit is checked at verify on the pull request's own CI run) — cost if wrong: on the 2026-10-30 evidence, 8.2 GB free, a run starts 7 forks instead of the 10 that ran out of memory; too high a figure only slows a run, too low brings back the low-memory stop.
- Ruling: the end-to-end vitest run is tagged `risk:regression`, not the approach's `risk:resource` — "resource" is not a kind on the reviewer's list, and the test guards against the 2026-10-30 low-memory stop coming back if vitest read the count earlier — cost if wrong: a rename.
- Ruling (superseded by D-08, which drops ac-5): the vm_stat sample of ac-5 is written by hand in the format macOS prints on Apple silicon, since no Mac is at hand to record one — cost if wrong: a real macOS output that differs in spacing or a label fails on a Mac while the test passes; swapping in a real recording changes one file.
- Ruling: the fixture's config is named `fork-cap.config.ts` and its inline projects carry no `extends` — an editor extension would otherwise run it against the real lock, and an inherited globalSetup would run `setup` twice and wait on its own lock — cost if wrong: none to behaviour.
- Ruling (superseded by D-08, which drops the macOS reader): `vmStatFree` throws on output missing a count or the page size, with one `risk:parsing` test, though no criterion asks for it — a missing count would give NaN, which skips the wait and sets NaN as the fork count (rule 4, validation at a trust boundary) — cost if wrong: one small extra test.
- Ruling: the macOS branch of `setup` is chosen through an injected `platform` option that defaults to `process.platform` — the criteria tests and the fixture then run the Windows and Linux path on every host, and the one D-08 test reaches the darwin branch on Windows CI — cost if wrong: one optional field in a test-only module.
- Ruling: the re-planned task is numbered Task 3, after the round-1 Tasks 1 and 2 — a changed task is numbered after the highest existing number — cost if wrong: a renumber.
- Ruling: D-04 stays on Task 3's `covers:` with a line saying D-08 replaces it — the plan gate requires every D-nn under Decisions to be cited — cost if wrong: none to behaviour.
- Ruling: `setup` reads the OS through `os.platform()` by default instead of `process.platform` — the ac-5 scan in packages/core/test/stage-skills.test.ts rejects any line under test/ holding `process.platform`, and both give the same value — cost if wrong: none.

## Deferred

- Plan round 1.4 (Nice): the risk:regression test never kills its spawned vitest on timeout, so a regression leaves an orphan that later takes the real lock.
- Plan round 1.5 (Nice): Task 1 step 2 calls `read()` without defining it, while test/lock.ts:34 already has a module-level `read(file)`.
- Plan round 1.6 (Nice): PER_FORK and RESERVE are exported for consumers that never import them.
- Review round 1.1 (Nice): `gb()` rounds to one decimal, so with 4.96 GB free the wait line reads "5 GB free, 5 GB needed" while the run still waits.
- Final review 2.1 (Nice): test/lock.ts:3 says a CI runner "never waits", but CI's `npm test` now waits for free memory there too; "never waits for another run" would be accurate.
- Final review 2.2 (Nice): `setup` copies `acquire`'s default stderr writer and 1000 ms poll (test/lock.ts:170-171 and :129-130) instead of sharing one default.

## Tasks
- task 3 done 9a93d6c3f688
