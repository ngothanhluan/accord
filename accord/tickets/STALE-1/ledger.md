# Ledger

## Tasks
- task 1 done 805080c8e73e
- task 2 done f36e1208ca07
- task 3 done 8e6481b6bd28
- task 4 done 114574ee5424

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
- Ruling: (task 2 executor) no production change; 6b63f29 already reads local and remote-tracking claim refs and keeps the max committer time; red shown by disabling the fold, then restored — cost if wrong: the remote-tracking case would show idleDays, but the test covers it.
- Ruling: (task 3 executor) the laneless ticket (D-05) is a fourth row in the ac-4 test; 6b63f29 already skips it; red shown by forcing open=true, then restored — cost if wrong: D-05 has no separate test.
- Ruling: the `risk:drift` test on the installed /accord copy stays, at the owner's word ("Giữ, ghi ngoại lệ") — it guards the sync-from-stale-dist failure the plan critic found; `drift` is not in the spec's risk kinds — cost if wrong: one test outside the policy list.
- Ruling: (final reviewer) lens both for the final review — none named, no auth, money, migration, or deletion path — cost if wrong: security and integration lenses not applied.

## Deferred

- @ac-4 test is core-only and does not observe that `status --all` lists dropped and archived rows (plan critic, Nice).
- Test policy: consider adding `drift` (an installed copy matching its source) to the spec's risk kinds (review round 1, owner exception).
- `commitAll` in packages/cli/test/helpers/repo.ts is a one-line wrapper around `commitAllAt`; an optional date parameter would do (review round 1, Nice).
- The `gitFacts` doc comment in packages/cli/src/load/fs.ts still says only author identity is read; it now also reads commit times (final review, Nice).
- `statusRows(snapshot, now?)` does not document that `now` is unix seconds; a host passing milliseconds gets huge idleDays (final review, Nice).
