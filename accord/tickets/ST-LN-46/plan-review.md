Round record: 1

## Round 1 (whole)
1. Must — done tickets whose only scout is a lane scout (dispatched on main before the id exists, before `scout: <id> report` commits existed) are never selected by the Task 2/3 listing, the untied list is printed only inside `--gather <id>`, and no step brings it to the owner, so those transcripts expire about 2026-11-11 against the Intent and D-01 part six; the listing must count untied scout runs near the claim and a step must gather the runs the owner names before the date (criteria) — fixed
2. Should — gathering re-adds round 1's own scout transcripts (e.g. ST-LN-26, benchmark-samples.json:713) as new samples, because `runGather` skips only transcripts already in benchmark-gathered.json, so r2-scout runs them twice and they count double in means and pass ranges (ac-3, D-02) (criteria) — fixed
3. Should — Task 4 drops a prose claim when its subject is a substring of an Absent row's claim or pattern (`loadConfig` inside `loadConfigFile`), undercounting false claims (ac-2); match with the same identifier bounds (criteria) — owner: "đồng ý" (2026-11-02: left to the executor, who meets it on the first test run)
4. Should — no `verify:` test runs the real scoring path (`scoreRound` → scout scorer → state → `--round <name>` report): the ac-4 test is pure and Task 7's process test uses an agent with no scorer, and Task 7's `score({dir, sample, run, truth, core})` does not match Task 5's `scoreScoutRun(dir, {reply, ticket, base, truth}, core)`, so a wiring error shows only after 72+ real runs (criteria) — fixed
5. Should — Task 4's test contradicts its own rule: the one reply holds `` `src/a.ts:1,3` ``, which `parseScoutReport` records as a citation, so both `qux` lines of src/a.ts are cited and src/a.ts becomes allowed where the test expects `['src/b.ts']`; put the `1,3` span in a second reply (criteria, build) — owner: "đồng ý" (2026-11-02: left to the executor, who meets it on the first test run)
6. Should — after `--clean --force` the Approach's undo "`--round <name> --plan` rebuilds worktrees" fails: `prepareWorktree` (scripts/benchmark.mjs:767-791) returns a recorded path without checking it exists, so matched unscored rows score `not at base` forever, the Task 8 guard then refuses every later clean, and new briefs point at a missing folder (security) — fixed
7. Should — re-running `--gather <id>`, the Approach's undo for failure scenario (1), copies nothing when the entry is listed but its snapshot folder is missing, because Task 2 step (2) skips listed runs before the copy step (security) — fixed
8. Should — no-overwrite keeps a truncated or partial snapshot forever (an interrupted copy, or a gather while a run is still writing) and a re-run never says so; write each file whole before it takes its final name, and on a re-run compare an existing transcript.jsonl with its source and keep a differing newer copy beside it (security) — fixed
9. Should — the snapshot leaves out `<session>/tool-results/<id>.txt` files that a subagent transcript only previews (`Output too large ... saved to`), so `reads.json` holds the stub and the full output expires with the transcript, against ac-5's "the files it read are snapshotted" (security) — fixed
10. Should — runs whose transcript folder `defaultDirs(main)` does not find (a worktree outside C:/Work/accord*, which the bench-root Ruling allows) cannot be gathered even when named on the command line, and an absolute transcript name never matches `transcriptTail` (security) — fixed
11. Should — the Task 8 risk:data-loss test fixture ("as benchmark-worktree.test.ts:16-40 builds") has no docs/benchmark/round-1.md, so the round 1 guard (scripts/benchmark.mjs:809) refuses first and the test passes with the named-round guard missing; write round-1.md first and assert the refusal text (security, build) — fixed
12. Should — the named state file, the only copy of scored runs once transcripts expire, is written with a plain writeFileSync and read as "read or {}", so a kill mid-save truncates it and a fallback to `{}` then saves over every cached score; write to a temp file and rename (as packages/cli/src/commands/notice.ts:42 does) and exit 2 on a state that does not parse (security) — fixed
13. Should — the Task 1 fixture (reused by Task 7) needs commit B to hold benchmark-samples.json whose entries say `base: B`, a file holding its own commit's sha; commit the json files in a later commit C, put the linked worktree at C, keep `base: B` (build) — owner: "đồng ý" (2026-11-02: left to the executor, who meets it on the first test run)
14. Should — Task 5 spreads `...ticket` where `ticket` is a string, so `facts.ticket` is undefined and the ticket's own files are not left out of Absent searches (packages/core/src/scout/check.ts:85-101), and the Task 5 test cannot catch it; pass `ticket` only when set and test a row that would hit the ticket file (build) — fixed
15. Should — Task 3's ending step needs the Task 2 scratch listing and its selection rule, which exist only in Task 2's section and are never committed, while the executor brief holds only its own task (packages/cli/src/commands/brief.ts:43-57); restate the rule in Task 3 (build) — fixed
16. Nice — the preamble says round 1's output never changes while Task 9 changes `parseRun`'s `ms` in place as the ledger allows; name Task 9 as the exception — deferred
17. Nice — a sample left out on a later `--plan` drops its unscored rows from `state.rows`, so the clean guard stops protecting their worktrees; count over the whole matrix or keep those rows — deferred
18. Nice — a round name such as `reviewer-1` passes `r[a-z0-9-]+` and nests its worktrees inside round 1's `wt/reviewer-1`, which `--clean` removes; refuse round 1 keys or nest under `wt/rounds/<name>/` — deferred
19. Nice — `--clean` prints no sha for a detached-HEAD writer worktree (future executor rounds) before `worktree remove --force` — deferred
20. Nice — Task 1 fixture branches `t/T-1` and `t/T-9` both change `a.txt` from B, so the second `merge --no-ff` conflicts — deferred
21. Nice — Task 7's `r9-crit` definition has no `pricesAt`, which Task 1's `checkRound` refuses — deferred
22. Nice — Task 3 leaves the `<y3 file>` form and session S3's cwd open; print `run.file` in the untied line and give S3 cwd `<t>/repo` — deferred

## Round 2 (whole)
No findings

Critic: no lens, limited by the owner to checking the round 1 fixes. fixed: 1.1, 1.2, 1.4, 1.6 to 1.12, 1.14, 1.15. withdrawn: none.

## Closed
Converged at round 2: 0 Must open, 0 Should open, 7 Nice deferred, 3 Should dropped by the owner to the executor.

## Round 1 (whole)
1. Should — Task 2's `truthOf` matches `t/<ticket>` as a substring, so sample 5 (ST-LN-8) takes ST-LN-81's merge too and its recall is scored against the wrong files (D-03) (criteria) — fixed
2. Should — Task 4 reuses round 1's `matchRuns`, which builds `r1` descriptions and picks `hit[0]` in file order before checking the agent, so no `bench r2-scout` run matches and the earliest valid run is not the one counted (build) — fixed
3. Should — Task 4 drops round 1's per-turn model and effort check (`turnFlags`), so a row dispatched on the default model is scored and costed as its arm (Intent, ac-3) (criteria) — fixed

## Round 2 (diff)
1. Should — Task 4 checks model and effort only on the run already chosen as earliest, so a row first dispatched at the wrong effort and then correctly has no counted run (D-06) (build) — fixed

## Round 3 (diff)
No findings

Critic: the round 2 critic, on the changed lines only. fixed: 2.1. withdrawn: none.

## Closed
Converged at round 3 of cycle 2: 0 Must open, 0 Should open.
