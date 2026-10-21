# Ledger

## Rulings
- Ruling: the debugger is left out of round 1 — no past debugger run exists to sample (0 of 742 runs, 2026-10-12 to 2026-10-21) — its effort stays unmeasured until a later round
- Ruling: commit 0496cf0 is reachable from no branch since it was rewritten as 1c4dcff (ST-LN-7 ledger), so the approach must find it through the transcript or the object store; ac-4 keeps it as the owner's known case — a reader of branch history alone misses it
- Ruling: the two audits' splits were settled in the criteria's wording, not asked one by one (owner: questions short and few), each by the reading closest to the intent: the round's own setting is what a turn is checked against, a fresh pinned judge per run, the whole suite for an executor, matching Musts by issue not wording, general rules naming no known case, round 6 as past the cap — the owner approves the final text verbatim — a reading the owner did not mean reaches the plan
- Ruling: commit 0496cf0 is pinned by the local ref `refs/keep/ST-LN-14-0496cf0` (made 2026-10-21) — it is unreachable, and git gc may delete it once the two-week prune window passes, while ac-4 needs it — a stray local ref; delete it with `git update-ref -d` after the ticket is done
- Ruling: the script itself runs the whole suite and `accord gate plan` in each run's worktree — a deterministic check is no model call, and a result the session reports would be recall — each executor worktree needs its own setup, so the round takes longer
- Ruling: output tokens come from `usage.output_tokens` once per message id; the 4-characters estimate stays only as a labelled fallback — benchmark.mjs:40 says the transcript may keep the usage from the stream's start, so the planner checks one real run first — the output column could be undercounted
- Ruling: `launchedWithDefaults` is not used — the probe runs carried `effort` overrides and still recorded `launchedWithDefaults: true` — none
