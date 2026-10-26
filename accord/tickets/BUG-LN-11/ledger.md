# Ledger

## Rulings
- Ruling: intent: lane stays M although the owner asked whether it was lane S — the first scope overturned two earlier rulings (BUG-LN-2, ST-LN-3 D-06) and held more than one reading; the owner chose "A" (keep lane M) — none
- Ruling: audit: who pushes after a recorded task (the CLI's task-done or the build skill) is left to the approach — @ac-1 fixes only when origin holds the task, before the next task starts — the approach may pick a layer the owner did not expect
- Ruling: audit: @ac-1 names lane M because only lane M records build tasks with task-done; no lane guard is added beyond that — lane S has no build tasks — none
- Ruling: audit: @ac-2 "why" is git's own message, printed after accord's line, with no classification of failures by accord — reworded in the scenario — a long git message takes several lines
- Ruling: audit (after the owner chose B): that failure scenario is now @ac-3, and its "why" ruling above carries over; whether the push sits in the CLI (task-done, approve, gate plan) or in the stage skills, and whether a command exits 0 on a failed push, is the approach's choice — @ac-3 fixes only that the stage goes on without stopping or asking — a CLI exit code a script relies on may change
- Ruling: audit: @ac-2 requires each step's own change to be committed before the push, so an approval or plan left uncommitted cannot pass by pushing nothing new — reworded in the scenario — none
