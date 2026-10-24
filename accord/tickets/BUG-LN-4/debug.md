# Debug

## Episode 1

## Symptom
`npx vitest run --reporter=default --reporter=junit --outputFile.junit=node_modules/.cache/accord/junit.xml` (tests.full, at verify, on Windows, after `npm run build`):

```
 Test Files  1 failed | 78 passed (79)
      Tests  1 failed | 1520 passed | 3 skipped (1524)
   Duration  609.47s
```
The one failure (junit): packages/cli/test/workflow-script.test.ts, "the emitted workflow script — executed > a deleted approved ticket not dropped at the base fails naming the ticket and accord drop", time 68.4 s, "Test timed out in 60000ms."

## Hypotheses
Ranked before any probe.
1. The test's budget is wrong for what the test does: it loops over the 9 DELETED_APPROVED cases (packages/cli/test/workflow-script.test.ts:205-242, :400-417) inside one `it`, and that `it` inherits `{ timeout: 60_000 }` from the describe (:377), a budget sized for one sandbox per test ("Each case spawns git twice and bash once", :374). Each sandbox is a `git init`, two `git add`/`commit`/`rev-parse` rounds and one bash run that forks git, awk and grep dozens of times; on Windows under the full suite's parallel load one sandbox costs 5-11 s, so 9 of them pass 60 s. — for: 68.4 s / 9 = 7.6 s per case; the single-sandbox tests in the same failing run took 5-6 s each; the before-ticket A-09 test this one replaces was one sandbox under the same 60 s; the replay test that runs these same cases got its own 600 s budget in 383a78a ("so load cannot time it out", :612-613) and this one got none; the describe's 60 s is below the 90 s the cli project already gives every Windows test (packages/cli/vitest.config.ts:5, BUG-LN-6). — against: the baseline full suite passed, but it had no 9-case loop under 60 s.
2. The new deletion loop in the script (packages/core/src/scaffold/workflow.ts, mirrored in .github/workflows/accord.yml:130-155) hangs or runs pathologically slowly on some DELETED_APPROVED case (git waiting on stdin or a pager, a here-string read that never ends). — for: the failing test is the one whose cases all go through `approved_at`, `protected_at` and `is_dropped`. — against: the file passes alone; a hang would not finish.
3. Load from outside the suite (other vitest runs or agents on the same machine during verify) slowed the run, and the test is fine. — for: the executor run earlier saw "risk:parsing BOM and CRLF ..." at 69 s while other vitest runs shared the machine. — against: the failing run's 609 s is shorter than the 1375 s baseline; I do not know what else ran on the machine during the verify run.
4. The measurement is wrong: vitest reports a timeout for a test that did not exceed its bound, or the failure hides an assertion failure. — for: none. — against: see probes.

## Probes
- Read node_modules/vitest/dist/chunks/run.CQOUYP-x.js:3251-3291 (vitest 5.0.0 `withTimeout`) → a synchronous test body cannot be interrupted; when it returns, `deadline.exceeded()` turns a resolved result into "Test timed out"; a thrown assertion takes the `reject` path and is reported as itself → the 68.4 s failure is a body that finished with every assertion of all 9 cases passing, past its deadline. Rules out H4 and a hang (H2); a wrong-output regression would have been reported as an AssertionError.
- `npx vitest run packages/cli/test/workflow-script.test.ts` (machine idle) → passes; @ac-1 test 12.1 s for 9 cases (1.34 s per case); DELETED_FREE 6.9 s for 6 (1.15 s), GATED 12.7 s for 10 (1.27 s) → a deletion case costs the same as any other sandbox case; the deletion loop is not pathologically slow. Weakens H2 further.
- The verify run's junit (node_modules/.cache/accord/junit.xml), same file → @ac-1 68.4 s; @ac-2 test 25.9 s; GATED 27.4 s; single-sandbox tests 1.4-6.0 s; the replay test 129.5 s, passing under its own 600 s → every case slowed by 2-6x under load, and only a test holding many sandboxes under 60 s can pass that bound. Supports H1.
- `npx vitest run` (full suite again, machine otherwise idle, 467 s) → all 1524 pass; @ac-1 39.2 s = 65% of its 60 s bound, 3.2x its time alone; no other test with the 60 s describe bound passed 18 s → the test's margin is load-dependent and the smallest in the file. Supports H1; shows H3's external load is not needed to come near the bound.
- `git show b09decd:packages/cli/test/workflow-script.test.ts` and `git show 383a78a` → before the ticket, A-09 was one sandbox (`ticket-deleting diff: does not gate ...`, :312) under the same 60 s describe; 383a78a raised the replay test from 300_000 to 600_000 and gave the new looping tests nothing; `git show b09decd:packages/cli/vitest.config.ts` → the 90 s Windows default already existed at the base, so the describe's explicit 60 s overrides it downward. Supports H1.
- 30 busy-loop node processes started (scratchpad hog.mjs), then `npx vitest run packages/cli/test/workflow-script.test.ts` → reproduced: 1 failure, the same test, "Test timed out in 60000ms.", 97.5 s (10.8 s per case); the single-sandbox tests stayed at 1-6 s; the @ac-2 test took 55.5 s (6 cases) and the @ac-3 test 40.6 s (2 cases), both under but near 60 s. Only CPU load was added; no code, no outside vitest. Confirms H1: CPU load alone produces the failure through the case count. I do not know how many of the 30 hogs ran for how long (two were left when I checked, and both had already exited by the time I tried to stop them).

## Fixes

## Root cause
The test, not the product code. packages/cli/test/workflow-script.test.ts:400-417 runs all 9 DELETED_APPROVED sandboxes (:205-242) in one synchronous `it`, which inherits `{ timeout: 60_000 }` from the describe at :377. That budget was sized for one sandbox per test (the comment at :374-376), and it is below the 90 s the cli project gives every Windows test (packages/cli/vitest.config.ts:5). Each sandbox costs 1.3 s with the machine idle and 4-11 s on Windows under parallel load (verify run 7.6 s, full rerun 4.4 s, CPU-load probe 10.8 s), so 9 of them land at 39-97 s against 60 s. The body finishes with every assertion passing, and vitest fails it after the fact (`deadline.exceeded()` in vitest's `withTimeout`). The script is not slower on these cases: 1.34 s per case versus 1.15-1.27 s for the other looping tests. The ticket brought this in at 383a78a: it replaced the one-sandbox A-09 test with 9-case loops under the old per-test budget, and gave a load budget only to the replay test (300 s to 600 s). The @ac-2 test (6 cases, :419-428) and the @ac-3 test (2 cases, :430-441) share the same cause: 55.5 s and 40.6 s under the CPU-load probe.
