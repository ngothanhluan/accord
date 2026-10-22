## Episode 1

## Symptom
`node scripts/benchmark.mjs --round 1 --plan` from C:/Work/accord-st-ln-14 (HEAD a2c75bb) exits 1:

```
file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:830
    if (notBench(name)) refs[name] = sha;
    ^

ReferenceError: Cannot access 'notBench' before initialization
    at liveState (file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:830:5)
    at runPlan (file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:613:18)
    at main (file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:805:80)
    at file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:814:109
```

Nothing was written to C:/Work/accord-bench (no round-1.json, no wt/).

## Hypotheses
1. Temporal dead zone: `const notBench` at scripts/benchmark.mjs:824 is declared after the entry line at :814 that calls `main()` synchronously during module evaluation, so `liveState` (:830) reads it before its declaration has run. Evidence for: the stack trace ends at :814 (module body) and the error is the TDZ ReferenceError. Evidence against: none found.
2. The test or measurement is wrong (a stale or different copy of the script ran, or a Node quirk). Evidence for: none. Evidence against: the trace paths are this worktree's file and the line numbers match the current source.
3. Some other top-level `const`/`let`/`class` that main() reaches is also declared after :814 and would fail next. Evidence for: the ordering pattern could repeat. Evidence against: see probe 1.

Ranked: 1, 3, 2.

## Probes
- Read scripts/benchmark.mjs:797-831 → the entry guard at :814 runs `process.exitCode = main(...)`; `const notBench` is at :824; `liveState` is an `export function` at :826 (hoisted) and uses `notBench` at :830; `onLiveRefs` (:843) uses it at :845. `stopOnEscape` (:850) calls `liveState` at :861 → this supports 1.
- `awk 'NR>814 && /^(export )?(const|let|var|class) /'` on scripts/benchmark.mjs → only line 824 `const notBench`; everything else after :814 is a function declaration (`writeReport`, `liveState`, `onLiveRefs`, `stopOnEscape`), which hoists → hypothesis 3 ruled out. `grep async|await` → none, so main() is fully synchronous and nothing after :814 runs before it. The imported modules (round.mjs, compliance.mjs, plan-review.mjs) are evaluated before this module's body runs, so they cannot have this ordering problem.
- `git log -S notBench -- scripts/benchmark.mjs` → added in 27402b4 (task 11: "--judge and --round 1 stop when a round run edited or committed in a live checkout"), appended below the entry line.
- Two scratch copies of scripts/*.mjs under the scratchpad (`iso/a`, `iso/b`). `yaml` is imported by its absolute file URL because the copies have no node_modules. In copy a, line 814 is replaced by a direct `liveState('C:/Work/accord-st-ln-14')` (read-only git) at the same point in module evaluation. Copy b is a with only the `notBench` line moved above line 814. → a: `ReferenceError: Cannot access 'notBench' before initialization` at :830; b: `ok 20 refs 9 worktrees`. With the declaration order as the only variable, this confirms 1 and rules out 2.
- `npx vitest run packages/core/test/benchmark-worktree.test.ts` → 4 passed. The test imports the module, so `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])` is false, main() never runs during evaluation, and `notBench` is initialized before the test calls `liveState`. `grep` of packages/core/test/benchmark-*.test.ts finds no test that spawns scripts/benchmark.mjs as a process. That explains why the suite missed the bug.

## Fixes
- Fix 1 (cfd3e13): the entry line moved to the last line of scripts/benchmark.mjs. Reproduction test `risk:regression --round 1 --plan run as a process records live checkouts` failed before it ("expected stderr … not to contain 'before initialization'") and passes after; `npx vitest run packages/core/test/benchmark-` → 26 passed. Failed fixes: 0.

## Root cause
scripts/benchmark.mjs:824 declares `const notBench = (r) => r && !r.startsWith('refs/heads/bench/');` after the entry line scripts/benchmark.mjs:814, which calls `main()` synchronously while the module is still evaluating. When the script runs as a process, `main` → `runPlan` (:613) → `liveState` (:830) reads `notBench` while it is still in its temporal dead zone and throws. The same happens through `--round 1` / `--judge` → `stopOnEscape` (:861) → `liveState`, and through `onLiveRefs` (:845). In each case it happens before anything is written to the bench root. `notBench` is the only top-level `const`/`let`/`class` after :814; all its users route through this one declaration. Unit tests import the module, so they never reach main() during evaluation and cannot see the bug. Evidence: probe copies a and b differ in only that one line's position; a throws and b passes.

## Resolved
Root cause: `const notBench` was declared after the entry line that runs main() while scripts/benchmark.mjs loads; fixed in cfd3e13 by moving the entry line to the end of the file.

## Episode 2

## Symptom
`node scripts/benchmark.mjs --round 1 --plan` from C:/Work/accord-st-ln-14 (bench root C:/Work/accord-bench), run twice, exits 2 both times.
- Run 1 ends `suite red at base for accord-executor 2`.
- Run 2 ends `suite red at base for accord-executor 4`. In this run executor 2's base suite was green.

The only failure in each run:

```
 FAIL  |cli| test/hook.test.ts > risk:security the prompt expansion hook blocks every accord text but the dashboard and continue of the worked ticket
Error: Test timed out in 30000ms.
 ❯ test/hook.test.ts:78:1
 Test Files  1 failed | 65 passed (66)      (run 1, executor-2-medium, 332.23s)
 Test Files  1 failed | 66 passed (67)      (run 2, executor-4-medium, 288.34s)
```

The check that stops is scripts/benchmark.mjs:629. The same single full-suite run scores every executor run at :775.

## Hypotheses
1. The test's run time depends on machine load. Inside a full parallel suite on Windows it reaches the cli project's 30 s `testTimeout`, and the benchmark takes one red run as final. Evidence for: the failure is a timeout, not an assertion; the same base passes in one run and fails in the other; the test passes alone. Evidence against: none found.
2. Base 8cdf421 (and 87b424c) has a deterministic defect that makes the test hang. Evidence for: neither base contains dd4494b (PR #57, the hook slowdown fix). Evidence against: the test passes alone at 8cdf421, and the executor-2 base passed in run 2.
3. The bench environment breaks the test: environment variables inherited from the Claude Code session, or state shared between bench worktrees. Evidence for: the test is about Claude Code sessions and holds. Evidence against: it fails by timing out, never on an assertion, and the same environment is green in the other run.
4. The measurement itself is wrong. :629 runs the suite once and treats any throw as red, including an exit 2 or a spawn failure, while :775 uses `exitState`. Evidence for: :629 is `catch { return err(...) }` with no retry and no exit code check. Evidence against: here vitest really did exit 1 on a real test timeout, so the exit code was read correctly. What fails is that a single sample is treated as final.

Ranked: 1, 4 (with 1, the same defect seen from the benchmark side), 2, 3.

## Probes
- Grep of the two stderr files for the test's duration. Run 1: executor-1 (base contains dd4494b) 19277 ms pass; executor-2 42473 ms FAIL. Run 2: executor-1 18728 ms pass; executor-2 28256 ms pass; executor-3 20902 ms pass; executor-4 30947 ms FAIL. The same test at the same base 87b424c takes 42.5 s in one run and 28.3 s in the other, so the result changes between runs with no change to code → separates 1 from 2.
- `npx vitest run packages/cli/test/hook.test.ts --reporter=verbose` in C:/Work/accord-bench/wt/executor-4-medium → 7 passed; the test takes 4819 ms (another plain run: 7 passed, 8.79 s). It was run from the same session, so the environment was the same. Its time alone is about a sixth of its time in the full suite → the work is not stuck (rules out 2). The environment does not break it (rules out 3).
- `git show 8cdf421:packages/cli/vitest.config.ts` → `testTimeout: 30_000` with the comment "Every test spawns git, which is slow on Windows hosts". The root vitest.config.ts runs the core and cli projects in parallel with `pool: 'forks'` → the limit is fixed and the load comes from parallel forks, which supports 1.
- `git log --ancestry-path dd4494b..<base>` for the five executor bases → only 70b6f5a (executor 1) descends from dd4494b; 87b424c, 4ef2405, 8cdf421 and bfc26b5 do not. Bases without the fix spawn more git commands and sit closer to 30 s. This explains which samples fail, not the failure itself. The owner rules out editing base code.
- Grep of `tests.full` in scripts/ → only scripts/benchmark.mjs:629 and :775. Both call `sh(...)` (:587, `execSync`) once. Neither re-runs the suite or reads the JUnit report that `tests.report` names → 4: the benchmark has no way to tell a slow test from a red one.

## Root cause
The benchmark treats one full-suite run as final, but a test in the base suite does not give the same result under load. At scripts/benchmark.mjs:629 (the base check in `runPlan`) and :775 (scoring in `runRound`), `sh(configAt(...).tests.full, ...)` runs once (`sh` is `execSync`, :587), and its first nonzero exit is the verdict. At bases older than dd4494b, packages/cli/test/hook.test.ts:78 takes 4.8 s alone but 28-42 s inside the full parallel suite. Against the cli project's `testTimeout: 30_000`, it passes or fails depending on machine load. The evidence: base 87b424c failed at 42.5 s in run 1 and passed at 28.3 s in run 2; base 8cdf421 failed at 30.9 s and passes alone in 4.8 s. :629 and :775 are the only callers of `tests.full`, so both route through the one place where a suite run is judged.

## Fixes
- Fix 1 (af40b04): new `runSuite(dir, repo)` in scripts/benchmark.mjs.
  - It is now the only caller of `tests.full`. The base check in `runPlan` and the scoring in `runRound` both use it.
  - A red run re-runs its failing files once, read from the JUnit report and run through `tests.affected`, falling back to `tests.full`. The suite stays red only if the re-run fails too.
  - Re-runs are recorded in round-1.json `reruns` and on the run's result.
  - Two reproduction tests failed before the fix and pass after it:
    - `risk:regression a suite that fails once and passes on its re-run does not stop --plan and the re-run is recorded`;
    - `risk:regression a suite that fails on its re-run too is red`.
  - `npx vitest related --run scripts/benchmark.mjs packages/core/test/benchmark-worktree.test.ts` → 8 passed.
  - Failed fixes: 0.
- Review rounds 6 and 7 fixed the fix's Should findings in be5dd72 and e4cb482: the narrow re-run only for a fresh report of real files the run did not change, and re-run holds listed in the report; `npx vitest run packages/core/test/benchmark-` → 32 passed.

## Resolved
Root cause: one full-suite run was taken as final while a base test (hook.test.ts at bases before dd4494b) times out only under load; fixed in af40b04, be5dd72 and e4cb482 by `runSuite`, which re-runs a red suite once and counts it red only if the re-run fails, as the owner chose ("Sửa benchmark").

## Episode 3

## Symptom
`node scripts/benchmark.mjs --round 1 --plan` from C:/Work/accord-st-ln-14 (bench root C:/Work/accord-bench), run 3, passes every base suite check (executor 2 and 4 green on their re-run, recorded in round-1.json `reruns`) and then exits 2 while writing briefs:

```
reviewer-3-medium: absolute path C:/Work/accord-st-9 outside the bench root is left in the brief; absolute path C:/Work/accord-ln9 outside the bench root is left in the brief; absolute path C:/Work/accord-st-10 outside the bench root is left in the brief; absolute path C:/Work/accord-st-11 outside the bench root is left in the brief; absolute path C:/Work/accord-st-12 outside the bench root is left in the brief
```

The check is scripts/round.mjs:171, reached from the review-package file rebuild in runPlan (scripts/benchmark.mjs:679-688). The `--samples` check, which reads the text the run read, passed for the same sample.

## Hypotheses
1. The sample list's file `base` for reviewer 3, fd80243, is a commit from before ST-LN-7's history was rewritten, and it is not an ancestor of the sample `base` e711c9b. `review-package --base fd80243` at e711c9b diffs `fd80243...HEAD` from their merge-base 1cfc803, so it covers the whole ST-LN-7 branch, not the two commits the run read, and the extra files hold the five paths. — for: the lead from the main session; reviewer 3 is the only sample whose package base belongs to a rewritten branch. — against: none found.
2. The check at scripts/round.mjs:171 is wrong (a false "outside the bench root"). — for: the same sample passed `--samples`. — against: `--samples` checked a different text (the read); see the probes.
3. The rebuild itself is wrong: the CLI at base, the default-ref exclusion, or the worktree not at its base. — for: the `review-package` text is used as rebuilt with no comparison (benchmark.mjs:683, ledger Ruling "task 6 uses a review-package rebuilt at base as built"). — against: see the probes.
4. The measurement is wrong: a stale worktree or a stale round-1.json entry. — for: run 3 re-used the worktrees from runs 1 and 2. — against: see the probes.

Ranked: 1, 3, 2, 4.

## Probes
- `git merge-base --is-ancestor fd80243 e711c9b` → exit 1. `git merge-base --is-ancestor f67b830 e711c9b` → exit 0. `git log -1 --format="%H %T %ci %s"` shows that fd80243 and f67b830 have the same tree 82520f3, the same date and the same subject "plan: ST-LN-7 ready". `git branch -a --contains fd80243` → nothing. `git merge-base fd80243 e711c9b` → 1cfc803 → fd80243 is the pre-rewrite copy of f67b830 → this supports 1.
- The snapshot C:/Work/accord-bench/samples/reviewer-3/sample.json (Read). The prompt says "the review package (diff since fd80243, the plan-ready commit)". The package it read is headed `(fd80243...HEAD)` and lists 2 commits, 0125b0a and b57df05, with 8 files changed (104+, 16-). `git log fd80243..0125b0a` gives exactly those 2 commits. 0125b0a and e711c9b have the same author time (1792333196) and the same subject, and `git diff --quiet 0125b0a e711c9b` → no difference. So the sample base was mapped onto the rewritten history, but the file base was not.
- `git diff --stat fd80243...e711c9b` → 29 files, 1743+. `git diff --stat f67b830...e711c9b` → 8 files, 104+/16-, the same as the read. `git diff -U10 fd80243...e711c9b | grep -o C:/Work/...` → accord-st-9 (10), accord-ln9 (3), accord-st-10/11/12 (2 each), and accord (12) and accord-ln7 (1), which are the sample's `elsewhere` and `root` and get rewritten. The same grep over `f67b830...e711c9b` → none. So the five paths in the symptom are exactly the paths in the rebuilt package that are not rewritten → 1 confirmed. The check at :171 is right to refuse → 2 ruled out.
- `git show e711c9b:packages/cli/src/commands/review-package.ts` → a plain `base...HEAD` diff with no default-ref exclusion, so given its input the rebuild is what git defines. C:/Work/accord/.git/worktrees/reviewer-3/HEAD = e711c9b, and C:/Work/accord-bench/round-1.json `worktrees.reviewer-3.base` = e711c9b, ready → the worktree is at its base → 3 and 4 ruled out.
- Where the bases came from: scripts/benchmark-samples.json is hand-built data (3fd784a, task 12). It was written by an uncommitted scratchpad builder that follows accord/tickets/ST-LN-14/plan.md Task 12. Step 3 (plan.md:710-722) maps a sample `base` onto a rewritten branch by author time and subject. Step 5 (plan.md:727-728) takes a `review-package` file's `base` from the command's `--base` value as is, and resolves only `main`/`origin/main`. fd80243 still resolves because the object is still in the store, so nothing failed.
- Why `--samples` did not catch it: `checkSamples` (scripts/round.mjs:53) only checks that `f.base` is 40 hex characters. `snapshotSample` (scripts/benchmark.mjs:454-477) checks the text the run read, not a rebuild, and never relates `f.base` to `sample.base`. It also returns early at :431-434 once a snapshot exists, so a re-run of `--samples` checks nothing. `runPlan` (:679-686) compares a rebuilt `brief` with the read (:684-685) but takes a rebuilt `review-package` as is (:683). `f.base` has one consumer, benchmark.mjs:680. `grep review-package packages/core/test/benchmark-*.test.ts` → no test.
- Other samples: `git merge-base --is-ancestor <f.base> <s.base>` → exit 0 for reviewer 2 and final-reviewer 5 (6ead1b6/6e1edf4), final-reviewer 1 (d5586db/b7c43f8), final-reviewer 2 (786f302/60e2640), final-reviewer 3 (b5678b5/f4b7aea) and final-reviewer 4 (1dfe65b/90b6a8f). For final-reviewer 2 and 3, the first commit of the read package is the sample base (60e2640, f4b7aea). Pairs only map to the sample's own `base`/`main`, and reviewer 3 has none. So reviewer 3 is the only sample hit this way. Separate finding: in the snapshots of reviewer 2 and final-reviewer 1, 4 and 5, the `reads` entry for the package is the Read tool's "File content (…KB) exceeds maximum allowed size (256KB)…" message, not the package. For those four, `--samples` checked no package text at all. Run 3 never reached their rebuilds, so whether those pass the :171 check is not shown.

## Root cause
scripts/benchmark-samples.json, reviewer 3: the file `base` "fd80243ac273e1d28989bc650d756eb692514147" is the pre-rewrite copy of f67b830 (same tree, subject and time). It is not an ancestor of the sample `base` e711c9b, which is the rewritten copy of the run's HEAD 0125b0a. So `review-package ST-LN-7 --base fd80243` (scripts/benchmark.mjs:680, used as is at :683) diffs from merge-base 1cfc803: 29 files instead of the 8 the run read. Those extra files hold C:/Work/accord-st-9, -ln9, -st-10, -st-11 and -st-12, and scripts/round.mjs:171 correctly refuses them. The value came from the Task 12 builder rule (plan.md:727-728), which copies `--base` as is but remaps the sample `base` onto rewritten history (plan.md:710-722). Nothing in code checks it: `checkSamples` (round.mjs:53) only checks the SHA form; `snapshotSample` (benchmark.mjs:454-477) checks only the read text and returns early for an existing snapshot (:431-434); `runPlan` (:683) uses the rebuilt package without comparing it.

## Fixes
- Fix 1, 35cb1ea: `checkFileBases` refuses, on every `--samples` and `--plan` before any snapshot, worktree or brief, a review-package file base that is not an ancestor of its sample base; `packageDrift` refuses a rebuilt package that differs from the run's read when that read is the package; reviewer 3's file base is now f67b830. Reproduction test `risk:regression a review-package file base that is not an ancestor of the sample base is refused before any brief is written` failed before the fix ("checkFileBases is not a function"); `npx vitest run packages/core/test/benchmark-` → 5 files, 34 passed.
- Review round 8 found Fix 1's check unwired and its whole-text package comparison refusing reviewer 3 itself; fixed in 60ac048 (wired in `runSamples` and `runPlan`, changed-file sets compared, a cut read judged on the files it shows); round 9 re-review found no Must or Should; `npx vitest run packages/core/test/benchmark-` → 34 passed.

## Resolved
Root cause: reviewer 3's review-package file base fd80243 predates ST-LN-7's history rewrite and is not an ancestor of its sample base, so `--plan` rebuilt a package of the whole branch; fixed in 35cb1ea and 60ac048 by moving it to its rewritten copy f67b830 and by `checkFileBases` and `packageDrift`, which refuse a stale file base and a rebuilt package whose changed files differ from what the run read.

## Episode 4

## Symptom
Round 1 dispatch, after `--plan` run 4 exited 0. Both replayed runs of critic 3 (`bench r1 critic-3-medium`, `bench r1 critic-3-high`, brief C:/Work/accord-bench/briefs/critic-3-<effort>.md) report that the plan in their worktree does not hold the change the brief's diff describes:

- C:/Work/accord-bench/wt/critic-3/accord/tickets/ST-LN-33/plan.md has `plan_hash: "fnv1a64:ec8cff4c1770af3b"` and the old line 112-113 (`w(26,'d')`); the diff C:/Work/accord-bench/files/critic-3-medium/plan-r2.diff goes from `fnv1a64:69b6681aec286f65` to `fnv1a64:b2cf27f6b550dba1`.
- plan-review.md there holds only `## Round 1 (whole)`, while the brief names "finding 2.1".

The sample (scripts/benchmark-samples.json, accord-critic n 3) has base 6deb441 ("plan: ST-LN-33 round 1, 0 Must, 2 Should"), root C:/Work/accord-st-ln-33, and one file, the diff. Its snapshot C:/Work/accord-bench/samples/critic-3/sample.json records only that diff under `reads`. The original run, in C:/Work/accord-st-ln-33, presumably read a working tree holding uncommitted planner edits (plan.md at 69b6681a, a round 2 in plan-review.md), which a worktree at the sample base cannot show. So the replayed run does not see what the original run saw, and its output cannot be compared with the reference.

Critic 4 is also a diff-mode sample ("diff of plan.md since the round 2 commit") and may have the same gap; other samples whose original run read uncommitted files would too. Dispatch is paused after 14 of 130 runs (planner 1 all three, executor 1 low done; executor 1 medium and high, critic 1 and 2 all three running; critic 3 medium and high done on the gap).

## Hypotheses
1. The run read a state that a commit made in the same main-session turn as the dispatch holds. The sample `base` misses it because the base rule takes the newest commit at or before the dispatch timestamp (plan.md:718), and that commit's author time is later than the dispatch line. — for: 0790ac2 "plan: ST-LN-33 round 2, 0 Must, 1 Should" was committed 16 s before the run's first record. — against: none found.
2. The run read uncommitted working-tree edits that no commit holds; this is the symptom's presumption. — for: the planner fix and the round 2 review were made in the main session just before the dispatch. — against: see probes 2-3. For critic 3 a commit holds all of it. For other samples this one holds (probe 6).
3. The replayed worktree is not at its sample base: a stale worktree, or `prepareWorktree` reused a wrong record. — for: run 4 re-used the worktrees from runs 1-3. — against: see probe 5.
4. The measurement is wrong: the replayed critic misread its files, or the brief rewrite sent it to other files. — for: none. — against: the replayed run's quotes (plan_hash ec8cff4c, only `## Round 1`) are exactly `git show 6deb441:` of those paths.

Ranked: 1, 2, 3, 4.

## Probes
- The critic 3 transcript (C--Work-accord/b9493812-…/subagents/agent-addb1be4a5cd92960.jsonl), its Read results (`toolUseResult.file`). The run read plan-r2.diff (whole), plan-review.md (whole, 10 lines: Round 1 marked "fixed" and `## Round 2 (diff)` 1. Should, "open"), ST-LN-33.md (whole) and plan.md lines 90-139. Lines 112-115 of that plan.md are the diff's after side (`w(12,'d') + ' benchmark.mjs ' …`). So the run saw plan_hash b2cf27f6 (the fixed plan), not 69b6681a. 69b6681a is the diff's before side. → the symptom's "plan.md at 69b6681a" is wrong. The run read the plan after the 2.1 fix.
- `git show 6deb441:…/plan-review.md` → only `## Round 1 (whole)`, with findings 1.1 and 1.2 "open". `git grep plan_hash` → 6deb441 ec8cff4c (line 112 has `w(26,'d')`), 0790ac2 b2cf27f6, 821cb8b 69b6681a, be0902e and 9e22d52 b2cf27f6.
- Scratch probe C:/Users/LUANNG~1/AppData/Local/Temp/claude/C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/scratchpad/readdrift.mjs. It compares every Read and `cat` result under `root` with `git show <base>:<rel>`, skipping reads made after the run's own Edit or Write of that file. It compares by the start line and line count the Read shows, plus `totalLines`. It then searches every commit from the base time to one hour after the dispatch for one that matches all the reads. For critic 3: plan-review.md and plan.md differ at 6deb441, and every read matches 0790ac2. Nothing else matches. → 2 is ruled out for critic 3.
- Main session b9493812.jsonl:1150-1170. At 07:19:21.851Z it stages `git add plan.md plan-review.md ledger.md`. At 07:19:22.552Z it runs `git commit -q -m "plan: ST-LN-33 round 2, 0 Must, 1 Should"`. At 07:19:25.259Z the `Agent` tool_use dispatches critic 3. These are one turn, and the tools run after the turn is streamed. 0790ac2's author time is 1792567167 (07:19:27Z). The snapshot's dispatch `ts` is 1792567165259 (C:/Work/accord-bench/samples/critic-3/sample.json:5). Plan.md:718 takes "the newest author time at or before the dispatch", which gives 6deb441 (1792566877). → confirms 1.
- C:/Work/accord/.git/worktrees/critic-3/HEAD = 6deb441, and round-1.json `worktrees.critic-3.base` = 6deb441. The worktree is at its sample base → 3 ruled out. The replayed reads equal `git show 6deb441:` → 4 ruled out.
- readdrift.mjs over all 45 samples, then a per-file diff of each finding (rdiff.mjs) and the time of each drifted read (turns.mjs). Every drifted read below falls inside the first assignment, before any later coordinator message. Samples with a read under `root` that differs from `base`:
  - critic 1 (8efa8fc, round 2 whole of ST-LN-34): plan.md, 563 lines against 526. This equals c5ed054's plan.md, which was committed 9 min later. ledger.md, 35 lines against 31: c5ed054's ledger without its last line, a round 2 deferred item. plan-review.md matches the base (round 1 open). No commit holds that combination. This confirms the main session's lead.
  - critic 3 (6deb441): plan-review.md and plan.md. All the reads are at 0790ac2.
  - critic 4 (b8d77ca, diff mode, ST-LN-8): plan.md lines 188-297 differ at 193. The diff's own `index 1b0bac5..d83a8d8` line names b8d77ca's blob before and 822b95e's blob after ("plan: ST-LN-8 ready", 09:12:39, after the run). plan-review.md and the ticket match only the base. No commit holds all the reads.
  - planner 3 (6deb441, the 2.1 fix): plan.md read whole, 176 lines against 170 (the round 1 fixes). 821cb8b holds it, a commit made later, "round 2 base, plan.md before the 2.1 fix". Its plan-review.md already has round 3 and `## Closed`.
  - reviewer 2 (6e1edf4): ST-LN-8 ledger.md has one more Ruling than the base ("review round 1 uses an intent and a quality reviewer in parallel …").
  - final-reviewer 5 (6e1edf4): the same Ruling, plus the deferred review items 1.1 and 1.2 in ledger.md.
  - final-reviewer 4 (90b6a8f): ST-LN-26 ledger.md has two more Rulings (the review lens choice and an unnumbered Should).
  - auditor 1-5: the ticket each one audits differs from its base. Auditor 1 read ST-LN-14.md at 116 lines, base 66 (the old backlog draft). Auditor 2 read ST-LN-31.md at 104 lines, base 62. Auditor 3 read ST-LN-34.md at 98, base 58. Auditor 4 read ST-LN-33.md at 96, base 58. Auditor 5 read ST-LN-30.md at 110, base 107: @ac-5 is reworded and D-09/D-10 are added. No commit in the window matches any of the five.
  - Not counted: planner 1. Its whole plan.md read was cut by the Read tool (551 of 1077 lines, then a read from line 552), and both parts match the base. Architect 1 differs only in reads after the coordinator's revision messages at 13:44 and 13:56 (ST-LN-31.md `depends_on`, ledger.md absent at base). Its dispatch-time reads match the base.
  - The other 30 samples: no drift in their Read and `cat` results.
- Why nothing caught it. `snapshotSample` (scripts/benchmark.mjs:448-452) checks only that each root path named in the prompt exists at base (`existsAt`), never its content. `reads` in the snapshot are kept only for `files` (:481). `parseRun` (:226-229) strips the Read line numbers, so a cut read cannot be told from a whole one. `runPlan` creates every worktree at `s.base` (:676) and writes nothing under `root`. `prepareWorktree` (:553-566) reuses an existing record without comparing `rec.base` with `spec.base`, so a changed sample base would be ignored by the existing wt/<key>. `matchRuns` (scripts/round.mjs:284-288) counts every run with the description `bench r1 <tag>`, so re-dispatching critic 1 or critic 3 gives a duplicate and `--round 1` exits 2 (benchmark.mjs:774).
- Side finding: the transcripts of executor 1 and final-reviewer 1 are no longer at their listed paths (C--Work-accord-st-ln-34/cfa22f34-…). They are under C--Work-accord/cfa22f34-…/subagents/. Their snapshots exist, so `--plan` is not affected. I do not understand why the session folder moved.

## Root cause
The sample model assumes that the checkout the original run read equals a commit, the sample `base`. For 12 of the 45 samples it does not. The Task 12 builder rule (accord/tickets/ST-LN-14/plan.md:714-722) takes "the commit with the newest author time at or before the dispatch". Two things defeat it:
- Same-turn commits. For critic 3 the main session ran `git commit` (0790ac2, author time 07:19:27Z) in the same turn as the `Agent` dispatch (07:19:25.259Z). The rule picks 6deb441, which lacks round 2 in plan-review.md and the 2.1 fix in plan.md. Every read of the run matches 0790ac2.
- Uncommitted edits. For critic 1, critic 4, planner 3, reviewer 2, final-reviewer 4 and 5, and auditors 1-5, the run read working-tree edits that no single commit holds: plan fixes, ledger Rulings and deferred items, or the ticket being drafted.
Code check: nothing compares what a run read under `root` with `base`. `snapshotSample` (scripts/benchmark.mjs:448-452) checks only that the files exist. `runPlan` (:676) builds every worktree at `s.base` and overlays nothing. All 45 samples go through these two functions, so that is where the check belongs.

## Fixes
- Fix 1, ecaab9c: `--samples` and `--plan` compare every root read of a run with its replay worktree (base plus overlay) and refuse a difference; the sample list gives the 12 drifted samples an `overlay` (critic 3 a new base, 0790ac2); a changed worktree is rebuilt and earlier runs on it are superseded. The executor`s 45-sample check, reading the transcripts directly: 33 of 45 pass before the data change, 45 of 45 after. `npx vitest related --run` over the changed files: 4 files, 29 passed; the executor`s `npx vitest run packages/core/test/benchmark-`: 5 files, 37 passed.
