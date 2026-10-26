# Plan review

## Round 1 (whole)
1. Must — @ac-3's go-on is not wired into plan step 8, build step 3 and build step 6: the failure line starts `push of`, which packages/core/skills/accord/worktree.md:34-35 tells the session to report and stop on, so a failed push in plan or build stops the work; the regression test pins go:false there — open
2. Should — Task 2's commit sentence lists the files to commit but leaves out packages/core/test/stage-skills.test.ts, so the risk:regression test can stay uncommitted — open
