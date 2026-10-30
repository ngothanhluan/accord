# Debug: ST-LN-63

## Episode 1

Symptom: CI run 41017154660 (workflow `ci`) on 729f57b, the first push after the merge of origin/main f772645 (BUG-LN-13) at verify, fails all four `check` jobs (ubuntu-latest and windows-latest, Node 22 and 24) with the same three tests in packages/cli/test/git-count.test.ts:
- risk:complex-branching the default ref resolves in one git process from a symbolic plain or dangling origin HEAD and falls back to the local main
- risk:complex-branching lane S gate done reads the review commit once and fails closed without one
- risk:complex-branching gate plan and gate done read baseline history for the gated ticket alone and the read commands read none

Test Files 1 failed | 94 passed (95) on each job. The merge executor reported git-count.test.ts passing locally on Windows at d3676df.

## Symptom
`npm test` (vitest run) in CI run 41017154660, all four jobs. Each of the three tests throws the same error from the test setup, before any accord command runs:

```
Error: Command failed: git commit -q -F /tmp/accord-msg-S2fgdu/msg.txt --cleanup=verbatim
Author identity unknown
*** Please tell me who you are.
fatal: empty ident name (for <runner@runnervm48cm3....cloudapp.net>) not allowed
 ❯ test/helpers/repo.ts:27:5
 ❯ gitRun test/helpers/repo.ts:120:21
 ❯ Module.commitMsg test/helpers/repo.ts:130:5
 ❯ test/git-count.test.ts:52:18      (gate plan / gate done test)
 ❯ test/git-count.test.ts:569:5      (lane S gate done test)
 ❯ seed test/git-count.test.ts:588:19 / 603:17   (default ref test)
```

The Windows jobs show the same message with `C:\Users\RUNNER~1\AppData\Local\Temp\accord-msg-*\msg.txt`. The full suite at 729f57b passes on the author's Windows machine (coordinator: 95 files passed, 1714 passed, 3 skipped, 1286.8 s, 4 workers).

## Hypotheses
Ranked before any probe:
1. The test fixture is wrong (this is the "test or measurement is wrong" hypothesis): `commitMsg` (packages/cli/test/helpers/repo.ts:124-135) runs `git commit` with no `user.name`/`user.email`. The three tests call it on a fresh `makeEmptyRepo()` that sets no identity, so the commit works only where the host has a global identity. The CI runners have none. — for: the stack trace ends in `commitMsg` at repo.ts:130 in all 12 failures; git reports "Author identity unknown"; `commitAllAt` in the same file (repo.ts:79-84) passes `-c user.email=fixture@example.invalid -c user.name=fixture -c commit.gpgsign=false`, and its comment says this is "so the host's global git config cannot change the result", but `commitMsg` does not; this machine has a global `user.name`/`user.email`, so the tests pass locally. — against: none found.
2. The merge of origin/main f772645 (BUG-LN-13) broke these tests, through a changed helper or CI config. — for: 729f57b is the first push after the merge. — against: the failure happens in the test setup, before accord runs; the helpers did not change across the merge (see Probes).
3. The product code (accord's own git calls after ST-LN-63's changes) fails on CI. — for: the three tests cover ST-LN-63 tasks 3, 8 and 9. — against: the failing command is the test helper's `git commit`, not a process accord starts; all three tests fail before their first `counted(...)` call.

## Probes
- Read CI log (ANSI stripped, 4 jobs) → all 12 failures are `git commit -q -F <tmp>/msg.txt --cleanup=verbatim` from `commitMsg` at repo.ts:130, with "Author identity unknown". No assertion fails. → accord's own code is not reached (rules out 3).
- `git diff --stat bf81a71 729f57b -- packages/cli/test/git-count.test.ts packages/cli/test/helpers/` → empty: the merge changed neither the test file nor any helper. → rules out 2.
- `gh run list --branch t/ST-LN-63` → only the two runs on 729f57b exist, so this branch was never tested on CI before. `git log -S` finds the three tests in ST-LN-63's own build commits: 82a9117 (task 3, gate plan/done), a8dc1ff (task 8, lane S), and 64aa996 (task 9, default ref). → the defect dates from the build, not from the merge; this push only exposed it.
- grep of `commitMsg(` / `makeEmptyRepo()` in git-count.test.ts → the three failing tests are the only ones that call `commitMsg` on a `makeEmptyRepo()` repository with no identity: lines 41/52/57/64/67, 566/569, and 585/588. The tests that pass call `commitMsg` on `makeClone`/`makeTemplate`/sample repositories, which set `user.email`/`user.name` from `IDENTITY` (helpers/worktree.ts:14-18, helpers/samples.ts:449/581), or they pass `-c user.email=...` themselves (git-count.test.ts:103, 854). The other test files that use `commitMsg` on empty repositories set a local identity first, for example lane-s.test.ts:55-56, dashboard.test.ts:16-17, and lane-flow.test.ts:43-44. → supports 1.
- `git config --global --get user.name` / `user.email` on this machine → `Luan Ngo` / `luan.ngothanh@zenenterprise.com.au`. → explains the local pass.
- Reproduction: scratchpad repro.sh runs `GIT_CONFIG_GLOBAL=<empty file> GIT_CONFIG_NOSYSTEM=1 ACCORD_TEST_WORKERS=4 npx vitest run packages/cli/test/git-count.test.ts -t "default ref resolves in one git process"` → 1 failed | 15 skipped, with `Error: Command failed: git commit -q -F ...accord-msg-YzyN9a\msg.txt --cleanup=verbatim / Author identity unknown / fatal: unable to auto-detect email address`, trace `commitMsg test/helpers/repo.ts:130:5 → seed git-count.test.ts:588:19`. The control is the coordinator's full-suite run at the same commit with the host config visible: green. The only difference between the two runs is the global git identity. → confirms 1.

## Fixes
- Fix 1 (fbf55b9): repo.ts's private `commitFlags(dir)`, used by `commitMsg` and `mergeMsg`, always passes `-c commit.gpgsign=false` and supplies `user.email` / `user.name` only when the repository has none; reproduction test packages/cli/test/repo-helper.test.ts "risk:environment commitMsg and mergeMsg commit in a sandbox when the host has no git identity". Red before the fix with the global config hidden (1 failed, "unable to auto-detect email address" from repo.ts:130); green after (executor: 6 files, 62 passed; git-count.test.ts with the global config hidden, 16/16). Coordinator's tests.affected over the two changed files: 35 files, 621 passed, 3 skipped, 1070 s, 4 workers. Failed fixes: 0. The CI check passing on the next push resolves the episode.

## Resolved
CI run 41024258572 on d67b280 passes all five checks: ci / check (ubuntu-latest, 22), ci / check (ubuntu-latest, 24), ci / check (windows-latest, 22), ci / check (windows-latest, 24), ci / run the generated workflow's commands against the examples; root cause `commitMsg` / `mergeMsg` had no committer identity, fixed in fbf55b9.

## Root cause
packages/cli/test/helpers/repo.ts:130: `commitMsg` runs `git commit -q -F <file> --cleanup=verbatim` without supplying a committer identity (no `-c user.email=… -c user.name=…`, and also no `-c commit.gpgsign=false`). It therefore depends on the host's global git config, unlike its sibling `commitAllAt` (repo.ts:79-84). `mergeMsg` (repo.ts:143) has the same gap. Three ST-LN-63 tests call it on a bare `makeEmptyRepo()` repository with no repository-local identity: git-count.test.ts:52, :569 and :588 (added in 82a9117, a8dc1ff and 64aa996). On GitHub runners, which have no global identity, git refuses the commit with "Author identity unknown" in the test setup. On the author's machine the global `user.name`/`user.email` hides the gap. The BUG-LN-13 merge is unrelated: 729f57b is simply the branch's first CI run. Reproduced locally by hiding the global config (probe above). The shared helper is the one point every caller goes through: `commitMsg`/`mergeMsg` in repo.ts. Every caller that passes today does so only because it set an identity itself first.
