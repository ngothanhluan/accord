# Discuss: BUG-LN-25

## Gray areas
- direction options — who decides that a copy is exactly what `skills sync` writes: the CLI compares each changed copy's head text with the rendered text and passes core the exact exempt paths, core compares texts itself, or reuse `branchFact.synced` — 
- behaviour and output — at which head a copy's text is read: each package's own head (the round's head) or HEAD for every round — 
- behaviour and output — which callers get the exemption: all five call sites (gate done, accord round, review-package, diff-package) or only gate done and accord round — 
- failure and data loss — a round made with an older accord whose copies changed: scanned (fail closed) or fall back to the marker check — 
- failure and data loss — reading the copy texts fails: an error fact that makes the gate refuse, or scan the copy as not exempt — 
- scope edges — a change that deletes a copy not on the retired list: scan its removed lines, or exempt it when its base text was an intact render — 
- scope edges — whether `agent-config` can be removed with a `Removed:` line like other defaults, or is unremovable — 
- scope edges — a checklist item for agent configuration: none (hook-commands covers it) or a new MCP server item — 
- scope edges — a team's own pattern already named `agent-config`: the existing collision rule (lint problem, default wins) — 
- interfaces — the new exemption option on the exported `securityTriggers` and `matchedHunks`: optional with nothing exempt when absent, or required — 
- interfaces — where the list of rendered files comes from on the gate path: `gate.ts` and `round.ts` pass `renderedFiles(config)` in, or `load/security-facts.ts` builds its own copy — 
- measurement rules or heuristics — what "the text it writes" means: equal after `normaliseText` (line endings ignored) or byte equality — 
- test strategy — which test proves each criterion: ac-1 and ac-3 on real git in security-gate.test.ts, ac-2 and ac-4 in core; the ac-3 fixture holds a team line pattern that matches the rewritten copies so the test fails without the exemption — 
