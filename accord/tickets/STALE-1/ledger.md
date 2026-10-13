# Ledger

## Tasks
- task 1 done 805080c8e73e

## Rulings

- Ruling: a lane ticket with no commit on its records and no claim branch has no idleDays — nothing to measure against — cost if wrong: a never-committed draft ticket is not flagged.
- Ruling: activity uses committer time (%ct, committerdate), not author time — a rebased or amended branch counts as recent — cost if wrong: a branch rebased without other work hides staleness.
- Ruling: a lane ticket at stage intent can be idle; the criteria exclude only done, dropped, and archived — cost if wrong: unapproved drafts get flagged.
- Ruling: when git log fails, lastActivity stays empty and nothing is idle, as gitFacts already treats that case — cost if wrong: a broken log silently hides staleness.
- Ruling: idle is computed in core, not by decorating rows in the CLI — --json stdout stays the core array verbatim and the CLI adds no column — cost if wrong: none known.
- Ruling: review.mode is outcome for this repository — solo owner reviews outcomes, not slices — cost if wrong: the owner wanted per-slice pull requests.
- Ruling: the claim branch t/STALE-1 stays local at the owner's word — the owner said "Giữ local" — cost if wrong: a teammate does not see the claim.
- Ruling: `accord tests baseline` run once at the plan baseline (1137 existing untraced cases listed) — the repository adopted the test policy without the file, so gate done would flag every existing case — cost if wrong: existing untraced cases are grandfathered instead of each getting a risk: name.
- Ruling: the main session writes each scenario's `@test:<id>` tag (the task's verify id) into the ticket after `accord task-done` records the task that proves it — no skill step owns the tags and executors never edit the ticket; tags sit outside the AC hash — cost if wrong: none to Ready; a wrong id fails gate done.
- Ruling: a ticket whose id has non-ASCII characters is never idle — git quotes such paths and the plan keeps the authors walk unchanged (critic round 3) — cost if wrong: such a ticket never shows idle.
- Ruling: after the clean critic round the main session added two clarifying lines to Task 4 (workspace binary for skills sync; the 5120-byte cap) — both were Nice findings and change no behaviour — cost if wrong: none.
- Ruling: (task 1 executor) the claim branch tip time is folded into lastActivity in loadFromFs through gitClaims, which now returns {claims, activity} — the Approach says so and ac-2 needs it — cost if wrong: a small change in one function; it is Task 2's code done early.
- Ruling: (task 1 executor) the not-idle check for done, dropped, and archived sits in statusRows — covers ac-4 for one line — cost if wrong: drop that line; it is Task 3's code done early.
- Ruling: (task 1 retry executor) the three tests moved to top-level it() with their setup as module-level consts — verify ids must equal the JUnit names — cost if wrong: none.
- Ruling: Tasks 2 and 3 write their tests against code Task 1 already landed, so those tests pass on arrival; their executors show them passing instead of failing first — the alternative is reverting working code — cost if wrong: two criterion tests were never seen red.

## Deferred

- @ac-4 test is core-only and does not observe that `status --all` lists dropped and archived rows (plan critic, Nice).
