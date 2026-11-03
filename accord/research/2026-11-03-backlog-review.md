# Backlog review: overlaps, stale tickets, missing work and a phase order

Date: 2026-11-03. Repository at `e0a380b4`. Feeds every ticket `accord dashboard` listed as not done on that date (45: 1 in progress, 39 backlog, 5 blocked).

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement. Every merge, drop or split below is a proposal for the owner to decide at the ticket's intent interview.

## Question

Which queued tickets overlap, are stale, or are too large; what is missing from the backlog; and in what order should the rest be worked, given the owner's stated priority quality > cost > speed and the ST-LN-46 Corrections on over-engineering and token use.

## 1. Facts checked at `e0a380b4`

- BUG-LN-20 still holds: `gitTree` runs `git ls-files` with no `maxBuffer` (`packages/cli/src/load/fs.ts:22-26`), while `gitTracked` passes 64 MiB (:44).
- BUG-LN-16 still holds: `packages/core/skills/accord/comments.md:36-38` sends every failure comment "through `accord-debug`", while `packages/core/skills/shared/failure.md` says a lane S ticket never reaches verify.
- BUG-LN-19's cause for two of its three tests is written down: `scripts/test-linux.mjs:9-10` says Debian's git 2.47 lists a clean merge's files under `--remerge-diff`, which fails two after-verify tests that pass with git 2.54. The third test (`packages/cli/test/status.test.ts:317`) was not re-run.
- ST-LN-15's rule "release only after the whole queue is done" was not followed: tags `v0.2.0`, `v0.3.0` and `v0.4.0` (release 2026-11-02) shipped while its `depends_on` still names draft tickets, so the dashboard shows it blocked indefinitely.
- ST-LN-43's line numbers are from `8a8ba6f`, 1,198 commits before this review. Its A0 test moved from `lane-commands.test.ts:95` to `:163`; BUG-LN-17's `:819` is now `:886`.
- ST-LN-16's first half is done: BUG-LN-2 ("The dashboard shows every claimed ticket at the stage its branch holds") has `status.test.ts:317` "a ticket filed only on its pushed claim branch shows at that branch stage without a fetch". The open question in ST-LN-16 predates it.
- ST-LN-22 proposes `accord new ticket --title`; `packages/cli/src/run.ts:192` records "`--title` was rejected under D-104".
- ST-LN-22 and ST-LN-68 name `accord-architect`; `packages/core/agents/` holds no architect since ST-LN-80.
- `main` has no classic branch protection, but a ruleset "Protection Rules" (created 2026-10-22, after ST-LN-37 was queued) covers the default branch: one approving review, no force push or deletion, and `required_status_checks` with an empty list (`gh api repos/ngothanhluan/accord/rulesets/<id>`). So the accord check still blocks no merge, which is ST-LN-37's gap, now narrowed to that empty list.
- `packages/core/skills/accord/lane.md:21` lists "auth, money or data deletion", without migration, as ST-LN-36 says.
- 551 `## Deferred` items sit in ticket ledgers (counted by script over `accord/tickets/*/ledger.md`); ST-LN-12 covers only items deferred from now on.
- Benchmark run worktrees are still on disk (`git worktree list`: `accord-bench/rep46`, `accord-bench/wt/r2-scout/scout-{1,2,4,5}`), as ST-LN-88 says.
- `executor.md` is the only accord agent with no `tools:` line (`packages/core/agents/*.md`), as ST-LN-85 says.
- ST-LN-46's Corrections (2026-11-02 and 2026-11-03) are the owner's strongest recent signal: over-engineering ("how to stop you over-engineering like this? you have done this many times"), token use ("tokens are about to run out"), and method ("why not replicate some ticket. run it accurately").

## 2. Findings and options

Each finding lists 2-3 options; the first is the one recommended.

**F1. ST-LN-91 is lane L, not lane M.** It holds five changes (a discuss stage, removing approach, a "what not how" plan with lint, one checker replacing the plan critics, removing the build lens), and it makes parts of ST-LN-10, 32, 56, 72, 86 and 90 stale.
- (a) First a cheap lane M ticket with recommendations 1, 5, 6 and 7 of `2026-11-02-critic-loop-practice.md` (later rounds verify fixes only; each Must or Should cites its ticket line; the planner keeps unrelated lines byte for byte; the direction report is saved), measured on the next three tickets; then the discuss stage as 3-4 lane M stories linked by `depends_on`.
- (b) Split at once into 4 lane M stories (discuss stage; plan format and lint; plan checker; migration of tickets in flight and docs).
- (c) Keep one ticket; risks the 40-task plan the owner objected to.

**F2. The benchmark track costs more than it returns.** ST-LN-46, 89, 90, 85, 70.
- (a) ST-LN-46 is not done: it goes on as the owner's 2026-11-03 Correction says, replicating real tickets instead of synthetic briefs, and ST-LN-89 and ST-LN-90 reuse that method; defer ST-LN-90 until ST-LN-91 changes what the planner does; let ST-LN-85 prove its cheap cuts with a rule-coverage test instead of benchmark replays.
- (b) Stop widening the arms or samples of ST-LN-46 until one replicated ticket per arm has been shown to the owner (the smallest experiment first, ST-LN-93).
- (c) Shadow runs: each new ticket runs a second scout arm beside the real one, so samples accrue from real work at a spread-out cost.

**F3. Stale tickets.** ST-LN-15, 43, 16, BUG-LN-19, ST-LN-22 (`--title`, architect), ST-LN-68 (architect).
- (a) One backlog pull request that notes each stale fact in the ticket's queued intent (this record's pull request).
- (b) Lint rules for drafts: a `depends_on` that can never clear, an agent name not in `packages/core/agents/`, a path that does not exist.
- (c) A periodic groom step (see M4).

**F4. Overlapping tickets.** Proposed merges, each decided by the owner at intent: ST-LN-68 into ST-LN-84 (same mechanism: a stated rule or refused option becomes a conventions line on a yes); ST-LN-29 into ST-LN-83 (queuing an idea is one of 83's intents); ST-LN-32 into ST-LN-91 (the short approval view belongs to the discuss stage's single approval); ST-LN-11 into ST-LN-37 (one CI gate); ST-LN-74 and BUG-LN-17 into ST-LN-82 (one test-cost budget). Decide ST-LN-49 with ST-LN-83 (one command-shape decision); pair ST-LN-59 with the executor half of ST-LN-56 (points 2-5); point 1 of ST-LN-56 is ST-LN-91's checker rule.
- (a) Merge the near-duplicates (drop with "merged into <id>"), link the rest with `depends_on`.
- (b) Keep all, add `depends_on` only.
- (c) One epic per track, once lane L exists (M6).

**F5. ST-LN-22 carries five features** (duplicate check, related Decisions to scout and critic, `--title`, `accord why`, late-adoption fallback, conventions to planner and critic).
- (a) Keep ST-LN-22 as the duplicate check only; move `accord why` into the discuss stage (ST-LN-91), where a gray area needs the history; move conventions input to ST-LN-84; the owner decides again on `--title` against D-104.
- (b) Split into four tickets.

**F6. Priorities predate the current pain.** The dashboard ranks ST-LN-36, 37, 38 (2026-10-22 audit) first; the owner's recent Corrections are about cost and over-engineering.
- (a) Re-rank by hand: high for BUG-LN-20, BUG-LN-16, F1(a), M1, ST-LN-37 (its gap is now one empty required-checks list); low for ST-LN-40, 41, 42, 50.
- (b) A scored field (impact, confidence, cost) the dashboard ranks by; a schema change, so a public interface.

**F7. 551 deferred items have no path.**
- (a) A CLI-generated index of every ledger's Deferred items by age and ticket, read-only, so the owner triages in batches; ST-LN-12 handles new items.
- (b) Expiry: an item not promoted within N days counts as dropped (owner sets N).

**F8. ST-LN-70 (benchmark every wording change) costs more than it saves.**
- (a) A static check: every agent still carries each rule and tool its body names; trend the review and plan round counts ST-LN-17 already records.
- (b) Benchmark only agents with measured samples and changes over N lines.
- (c) Drop it.

**F9. BUG-LN-19 is a git-version defect of the product, not only of the tests.**
- (a) Stop depending on `--remerge-diff` output that differs by git version.
- (b) Declare a minimum git version and check it at start, exiting 2 with the version needed.
- (c) Document it and close.

**F10. ST-LN-39 and ST-LN-41 enforce per tool, against ST-LN-17's "no tool-specific hook".**
- (a) Lower their priority until ST-LN-37 makes CI a real merge gate, which a forged local record cannot pass.
- (b) A one-time value the CLI hands to the verifier dispatch and checks in the record, tool-neutral.
- (c) A Claude Code hook with "not enforced in this tool" elsewhere.

## 3. Missing from the backlog

- **M1. Size control against over-engineering.** The intent records an expected size (tasks or lines); `accord gate plan` refuses a plan over a set multiple of it without the owner's yes; each plan task cites the criterion it serves; a measurement ticket runs its smallest experiment first and shows it to the owner before widening. Queued as a draft ticket by this record's pull request.
- **M2. A token budget per ticket.** `accord cost <id>` reading transcripts as `scripts/benchmark.mjs` `parseRun` does, a budget in `config.yml`, and a stop to ask the owner at a set share of it. Transcripts are Claude Code's format, so other tools show "not measured".
- **M3. A research lane.** Tickets ST-LN-35, 42 and parts of 89 and 90 are questions, not features, yet pass intent, approach, plan, build, review and verify. A lane with a question, a timebox and a budget, whose output is an `accord/research/` record the owner reads and decides on, with no plan critique and no code review. Queued as a draft ticket by this record's pull request.
- **M4. A periodic backlog groom.** Find dead references, `depends_on` that cannot clear, near-duplicate titles and intents, oversized intents and age, and offer Keep, Merge or Drop per ticket.
- **M5. Migration when the workflow changes.** ST-LN-91 removes the approach stage; tickets in flight and repositories pinned to 0.4.0 need a path (`accord upgrade` step, release notes).
- **M6. Minimal epics.** ST-LN-91, ST-LN-22 and the tracks below need one: the dashboard groups stories by `parent:` with the epic's progress. Raises ST-LN-28's priority.
- **M7. Repeatable workflow metrics.** Rounds per stage, findings per round, weighted tokens and minutes, re-run on every release, so ST-LN-91's effect is measured against a baseline. The 2026-11-02 study's parser stayed in a session scratchpad. Queued as a draft ticket by this record's pull request.
- **M8. Corrections that repeat across tickets become conventions.** Extends ST-LN-84: at verify, a Correction whose kind appeared in two or more tickets is offered as a conventions line.

## 4. Proposed phase order

| Phase | Work | Cost |
|---|---|---|
| P0 | BUG-LN-20, BUG-LN-16 (lane S); ST-LN-46 goes on in its own worktree with real-ticket replication (F2a) | low to medium |
| P1 | This groom: the record, notes in stale and overlapping tickets, drafts for M1, M3, M7 | low |
| P2 | F1(a) with M1 and M7, measured on three tickets; then the discuss stage as stories, with M5 | medium |
| P3 | ST-LN-59 with the executor half of ST-LN-56; ST-LN-92 after measuring the lock and memory waits; ST-LN-10 and ST-LN-72, narrowed | medium |
| P4 | ST-LN-37 (with ST-LN-11, BUG-LN-18), then ST-LN-36, ST-LN-38, ST-LN-39 | medium |
| P5 | ST-LN-89 (real-ticket replays), ST-LN-85 (cheap cuts), ST-LN-90 (after P2), ST-LN-70 (F8a), M2 | medium to high |
| P6 | ST-LN-83 with ST-LN-49, ST-LN-22 (duplicate check), ST-LN-84, ST-LN-12 with F7, ST-LN-50, 40, 23, 69, 87, 88, 16, 41 | spread |
| Beside | Test cost: ST-LN-82 (with 74, BUG-LN-17), then ST-LN-43 re-audited at the current commit | medium |

## Limits

- Overlaps and sizes are judged by reading the tickets, not measured.
- ST-LN-46's state is read from its branch `t/ST-LN-46` at `e75ad60d`; its cost figures are those of `2026-11-02-critic-loop-practice.md`.
- No test was run for this review.
