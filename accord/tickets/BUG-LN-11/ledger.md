# Ledger

## Rulings
- Ruling: intent: lane stays M although the owner asked whether it was lane S — the first scope overturned two earlier rulings (BUG-LN-2, ST-LN-3 D-06) and held more than one reading; the owner chose "A" (keep lane M) — none
- Ruling: audit: who pushes after a recorded task (the CLI's task-done or the build skill) is left to the approach — @ac-1 fixes only when origin holds the task, before the next task starts — the approach may pick a layer the owner did not expect
- Ruling: audit: @ac-1 names lane M because only lane M records build tasks with task-done; no lane guard is added beyond that — lane S has no build tasks — none
- Ruling: audit: @ac-2 "why" is git's own message, printed after accord's line, with no classification of failures by accord — reworded in the scenario — a long git message takes several lines
- Ruling: audit (after the owner chose B): that failure scenario is now @ac-3, and its "why" ruling above carries over; whether the push sits in the CLI (task-done, approve, gate plan) or in the stage skills, and whether a command exits 0 on a failed push, is the approach's choice — @ac-3 fixes only that the stage goes on without stopping or asking — a CLI exit code a script relies on may change
- Ruling: approach: chosen architect option 2 (`accord worktree push <id>` called by the stage skills) — lightest that keeps @ac-3 deterministic — the push depends on the skill clause being followed (critic Should 1, kept as a risk)
- Ruling: approach: the push names the branch ref, not HEAD — correct from any worktree — none
- Ruling: approach: a push killed by the time limit prints `no answer within N seconds` after the failure line (critic Should 2) — git gives no message then, and @ac-3 promises a reason — none
- Ruling: approach: build step 6 (re-approved approach) also pushes (critic Should 3) — the Intent lists approach approval as a stage change — none
- Ruling: plan: the plan and build skill clauses drop "go on even if it fails" — the 5120-byte cap leaves no room (rendered plan 5061, build 5010 bytes), and the command exits 0 with a failure line saying the commits stay local until the next push — an agent may pause at a failed push in plan or build
- Ruling: plan round 1: the go-on for a failed `accord worktree push` lives in accord/worktree.md (no SKILL.md byte cap), whose `push of` bullet is narrowed to Continue's merge push — the line prefix matched a stop rule, and plan and build have no room for the clause — a session that never loaded worktree.md may still pause at a failed push
- Ruling: audit: @ac-2 requires each step's own change to be committed before the push, so an approval or plan left uncommitted cannot pass by pushing nothing new — reworded in the scenario — none
