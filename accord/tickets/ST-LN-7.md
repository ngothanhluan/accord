---
id: "ST-LN-7"                            # equals the file name: tickets/<id>.md
title: "Picking up or continuing a ticket gives it its own worktree, so tickets run in parallel"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
priority: high
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
approved_hash: "fnv1a64:4b969089e621ba14"
ac_hash: "fnv1a64:9da0ba20e817ea73"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: today Pick up and Continue switch the branch in the one checkout, so a second ticket run in parallel moves the branch under the first session, and worktrees made by hand miss their setup and pile up after their ticket merges.
For whom: anyone, solo or on a team, running two or more tickets at once through Claude Code, Cursor, Codex, or Copilot.
Success: each ticket runs in its own prepared worktree, worked only by the one session rooted there; a second session there is refused; a merged ticket's worktree is removed by the next `/accord` with nobody hunting for it.
Not this ticket: deleting merged branches and pruning remote-tracking refs (ST-LN-20); flagging two tickets that will edit the same file (ST-LN-24).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-7

  @ac-1 @test:packages/cli/test/worktree.test.ts#ac-1-pick-up-adds-the-ticket-worktree-from-origin-main-runs-setup-in-order-and-prints-where-to-continue
  Scenario: Pick up prepares the ticket's own worktree and points to a session there
    Given a repository at "C:/Work/accord" whose config.yml lists the setup commands "npm ci" and "npm run build"
    And the ticket "ST-9" has no branch and no worktree
    When "/accord pick-up ST-9" runs in a session rooted at "C:/Work/accord"
    Then "git worktree list" shows the branch "t/ST-9" checked out at "C:/Work/accord-st-9"
    And "t/ST-9" starts at the commit "origin/main" points to in the clone, whatever branch "C:/Work/accord" has checked out
    And "npm ci" then "npm run build" ran in "C:/Work/accord-st-9", in that order
    And the accord CLI command prints the path "C:/Work/accord-st-9" and the line "/accord continue ST-9" to type in a session opened there, naming no agent's own command, and the session stops
    And the branch checked out in "C:/Work/accord" is the one it had before

  @ac-2 @test:packages/cli/test/worktree.test.ts#ac-2-a-failing-setup-command-exits-2-naming-it-and-keeps-the-worktree
  Scenario: A failing setup command stops the run and keeps the worktree
    Given config.yml lists the setup commands "npm ci" and "npm run build", and "npm run build" fails
    When "/accord pick-up ST-9" runs in a session rooted at "C:/Work/accord"
    Then the accord CLI command that adds the worktree and runs the setup commands exits 2 with a message naming "npm run build"
    And the worktree "C:/Work/accord-st-9" still exists and "npm ci" ran in it
    And no path or line to open a session is printed

  @ac-3 @test:packages/cli/test/worktree.test.ts#ac-3-continue-from-another-checkout-reuses-the-worktree-holding-the-branch
  Scenario: Continue from another checkout reuses the worktree that holds the branch
    Given the branch "t/ST-9" is checked out in the worktree "C:/Work/accord-ln9", a name made by hand
    When "/accord continue ST-9" runs in a session rooted at "C:/Work/accord"
    Then no new worktree is added, no setup command runs in "C:/Work/accord-ln9", and the branch checked out in "C:/Work/accord" is unchanged
    And the accord CLI command prints the path "C:/Work/accord-ln9" and the line "/accord continue ST-9" to type in a session opened there, naming no agent's own command, and the session stops

  @ac-4
  Scenario: A second session in a held worktree is refused while the holder runs, and a dead holder's hold is taken over
    Given a Claude Code session rooted at "C:/Work/accord-st-9" holds the ticket "ST-9" and is still running, though the command that took its hold has exited
    When "/accord continue ST-9" runs in a second Claude Code session rooted at "C:/Work/accord-st-9"
    Then the accord CLI command that takes the hold exits 2 with a message naming the holding agent session by its tool, its session marker or process id, and the time it took the hold, and the second session edits nothing
    And once the holding agent session has stopped without releasing its hold, as after a crash, "/accord continue ST-9" in a new Claude Code session there takes the hold and resumes the ticket

  @ac-5
  Scenario: /accord with no argument fetches, removes the worktrees of merged tickets, and names what it keeps
    Given on the remote the main branch contains the tips of "t/ST-9", "t/ST-10" and "t/ST-12", which the local clone has not fetched, and not the tip of "t/ST-11"
    And "C:/Work/accord-st-9" is clean apart from files ignored by .gitignore, "C:/Work/accord-st-10" holds a new file not yet added to git, "C:/Work/accord-st-11" is clean, and "C:/Work/accord-st-12" is clean and held by a running session
    When "/accord" with no argument runs in a session rooted at "C:/Work/accord"
    Then it fetches from the remote, then takes each worktree to belong to the ticket whose branch "t/<id>" it has checked out, whatever the folder is called, and judges that ticket merged when the commit checked out in the worktree is an ancestor of the fetched remote main branch
    And "C:/Work/accord-st-9" is removed with "git worktree remove" and named as removed
    And "C:/Work/accord-st-10" and its uncommitted file are kept, named with the reason "uncommitted work"
    And "C:/Work/accord-st-12" is kept, named with the reason "held by another session"
    And "C:/Work/accord-st-11" is kept and not named

  @ac-6
  Scenario: A new request prepares the new ticket's worktree and points to a session there
    Given a repository at "C:/Work/accord" on the branch "main", whose config.yml lists the setup command "npm ci"
    When "/accord add an export flag" runs in a session rooted at "C:/Work/accord" and is taken as lane M with the new ticket "ST-9"
    Then "git worktree list" shows the branch "t/ST-9" checked out at "C:/Work/accord-st-9", and "npm ci" ran there
    And the branch "t/ST-9" is pushed with "accord/tickets/ST-9.md" committed on it
    And the accord CLI command prints the path "C:/Work/accord-st-9" and the line "/accord continue ST-9" to type in a session opened there, naming no agent's own command, and the session stops before the intent interview
    And "C:/Work/accord" is still on the branch "main" and holds no file "accord/tickets/ST-9.md"
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
- "ko dc thêm rườm rà cho user" (2026-10-18, on the panel question)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Split with ST-LN-20: deleting a merged ticket's local branch (`git branch -d`) and pruning stale remote-tracking refs (`git fetch --prune`) move to ST-LN-20 "A merged ticket's branch is cleaned up after its pull request merges", which depends on this ticket; this ticket keeps removing the worktree (`git worktree remove`) and the dashboard naming worktrees whose ticket is done, so the third Open question below narrows to those — "Ticket mới: dọn branch; ST-LN-7: worktree (Recommended)" (2026-10-18, asked in the ST-LN-18 session)
- D-02 The ticket holds all four parts of the request: each ticket in its own worktree; preparing that worktree; the Continue guard; removing the worktree once the ticket is done — "1. Worktree mỗi ticket, 2. Chuẩn bị worktree, 3. Chặn Continue song song, 4. Xoá worktree khi xong" (2026-10-18)
- D-03 The Continue guard is enforced by the CLI: Continue holds a lock on the ticket's worktree, a second session entering the same worktree exits 2 naming the holder, and a session mid-way through another ticket asks before switching; the lock is released when its session dies — "option 1" (2026-10-18)
- D-04 Split with ST-LN-24: detecting that two tickets in flight will edit the same files moves to ST-LN-24 "Two tickets in flight that will edit the same file are flagged before they collide", which depends on this ticket; blocking between tickets already exists through `depends_on` and `blockedBy` — "Ticket mới phụ thuộc ST-LN-7 (Khuyên)" (2026-10-18)
- D-05 Every `/accord` run removes, with plain `git worktree remove`, the worktree of each ticket whose pull request has merged, read as: after a fetch, the tip of the ticket's branch is an ancestor of the main branch (`git merge-base --is-ancestor`, no `gh`, no tracker); it skips a worktree holding uncommitted work, one locked by another session, and the one the session stands in, and names each worktree removed or skipped with the reason — "/accord tự dọn (Khuyên)" (2026-10-18)
- D-06 A ticket's worktree is the sibling folder named after the repository's folder, a hyphen, and the id in lower case (for ST-LN-7 opened from `C:/Work/accord`, `C:/Work/accord-st-ln-7`), fixed, with no config field — "Cạnh repo, theo id (Khuyên)" (2026-10-18)
- D-07 Preparing a worktree runs config.yml's new `setup` field, a list of commands run in order in the new worktree right after `git worktree add`; with no field nothing runs; a failing command stops the run, keeps the worktree, names the command, and exits 2 so the owner fixes it and continues again; this repository declares `npm ci`, `npm run build`, `npm rebuild @accord-dev/accord --ignore-scripts` — "Field `setup` trong config (Khuyên)" (2026-10-18)
- D-08 Only a session rooted in a ticket's worktree works that ticket: Pick up or Continue from any other checkout prepares the worktree (or finds the one holding the branch with `git worktree list`), prints the command to open a session there with `/accord continue <id>`, and stops; so no session ever switches tickets mid-way, and D-03's lock is held by the session rooted in the worktree — "Mở session mới ở worktree (Khuyên)" (2026-10-18)
- D-09 Showing another ticket's stage as it stands on that ticket's branch is not this ticket: it goes to ST-LN-16 "The dashboard shows tickets a teammate has pushed without a manual git fetch…" as an open question (PR #37) — "ok 1. xem có gộp dc vào ticket nào khác ko" (2026-10-18)
- D-10 The two failures found during ST-LN-21 happen only in the accord repository itself, so this ticket adds nothing for them: `npx` there resolves `@accord-dev/accord` to the repository's own unbuilt workspace package (outside it, and in a user repository with no `node_modules`, `npx --yes @accord-dev/accord@0.1.0 --version` prints 0.1.0), and only there does a ticket change the panel, so the main checkout's panel and a worktree's differ; this repository's `setup` carries `npm rebuild @accord-dev/accord --ignore-scripts` — "đồng ý" (2026-10-18)
- D-11 The audit's six double readings, settled as recommended: the open-a-session output is tool-neutral, the worktree path and the line `/accord continue <id>`, never one agent's own command; an accord CLI command adds the worktree and runs `setup`, exiting 2 on a failing command; a hold is taken over when its holder is found no longer running, which covers a crash; `/accord` fetches with prompts off (as ids.md does) before judging merges, and on a failed fetch says so and judges against the refs already in the clone; a worktree whose ticket has not merged is kept and not named; a merged worktree held by another session is kept and named with that reason — "Theo cả 6 khuyên (Khuyên)" (2026-10-18)
- D-12 The second audit's four double readings, settled as recommended: the accord CLI command prints the worktree path and the `/accord continue <id>` line, not the agent in chat; the hold belongs to the long-lived agent session, never to the short-lived process that ran the hold command; merged means an ancestor of the remote-tracking main branch just fetched, never the local `main`; only `/accord` with no argument fetches and removes worktrees, while Pick up and Continue do not — "Theo cả 4 khuyên (Khuyên)" (2026-10-18)
- D-13 New request in lane M follows D-08 too, and this ticket gains a criterion for it: it writes the ticket file, prepares the ticket's worktree (running `setup`), commits and pushes the claim from there, prints the worktree path and the line `/accord continue <id>`, and stops, so the intent interview runs in a session rooted in that worktree and the checkout the request was typed in keeps its branch — "Gộp vào ticket này, thêm ac-6 (Khuyên)" (2026-10-18, asked at the approach stage)
- D-14 Which agent session holds a ticket (D-03, @ac-4): a session is told apart by the per-session marker its tool provides where there is one (Claude Code sets one per session, checked on this machine), otherwise by the tool's own process; every chat in one Cursor or VS Code window counts as one session and is not refused by another chat there, while a session in another terminal or another tool is refused; the README states that limit; the plan begins with a hands-on check in Cursor, Copilot, and Codex before anything is built, and a tool whose session cannot be recognised fails with a clear message, never silently unheld; holds are kept in one shared file in the repository's common git directory (`.git/accord/holds`), which every worktree of the clone sees — "ok option 1" (2026-10-18, asked at the approach stage; the shared file was the owner's idea: "sao ko có một global state file để cập nhật status cung cho toàn bộ ticket?")
- D-15 The third audit's four double readings, settled as recommended: a new ticket branch (Pick up, New request) starts at the remote-tracking main branch already in the clone, never at the checkout's HEAD, with no fetch of its own; a Continue from another checkout only finds the worktree and prints its path, running nothing there, and `setup` reruns in full when the session rooted in the worktree takes the hold and `setup` has not yet finished there (after a failure, or in a worktree made by hand); the refusal names the holder by its tool, its session marker or process id, and the time it took the hold; uncommitted work means modified tracked files and new files not yet added, while files ignored by .gitignore (such as `node_modules` and `dist`) do not count and are removed with the worktree, which the README states — "Main trên remote (Khuyên)", "Chạy trong session của worktree (Khuyên)", "Tên tool + mã + giờ (Khuyên)", "Sửa + file mới; bỏ qua ignored (Khuyên)" (2026-10-18)
- D-16 The fourth audit's two double readings, settled as recommended: the tip judged merged is the commit checked out in the worktree, never the remote-tracking `origin/t/<id>`, so a worktree holding commits not yet pushed is kept; a worktree belongs to the ticket whose branch `t/<id>` it has checked out, whatever the folder is called, so a worktree made by hand is cleaned up too — "Tip local trong worktree (Khuyên)", "Theo branch đang checkout (Khuyên)" (2026-10-18)
- D-17 For now only Claude Code sessions are held: in Claude Code a session is told apart by the per-session marker Claude Code sets, and the hold works as D-03 and @ac-4 say; in Cursor, Copilot, and Codex the worktree is added, prepared, reused, and cleaned as in Claude Code, since that is git alone, but no hold is taken: the accord CLI command prints one line saying a second session is not refused in that tool yet, and goes on; the README states that limit; this replaces D-14's hands-on check in Cursor, Copilot, and Codex, its rule for telling their sessions apart, and its refusal of a tool it cannot recognise — "tạm thời chỉ support cho claude thôi", then "Worktree cho mọi tool, chặn chỉ Claude (Khuyên)" (2026-10-18, after the first plan)
- D-18 `/accord continue <id>` also applies to an id whose claim branch exists locally or on `origin`, though the checkout it runs in has no file for that ticket, as after @ac-6 while the ticket is unmerged; `accord worktree open` makes that check and prints the worktree path and the `/accord continue <id>` line as @ac-3 says, so typing Continue from the main checkout never starts a second ticket — "Nhận cả id có branch t/<id> (Khuyên)" (2026-10-18, plan critique)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- "tạm thời chỉ support cho claude thôi" (2026-10-18, after the first plan, on D-14's hands-on check in Cursor, Copilot and Codex)

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] (answered by D-02, D-06, D-07, D-08) Scope from ST-LN-6 intent (2026-10-16). The owner asked: "sao khi bắt đầu làm ticket chúng ta ko tạo worktree riêng, checkout branch riêng nhỉ?" Today `/accord` Pick up creates the claim branch and Continue switches to it in the current checkout, so a second ticket run in parallel switches the branch under the first session; ST-LN-6 ran in a worktree made by hand (`C:/Work/accord-sev`), which had no `accord` bin installed. Proposal to confirm at intent: Pick up and Continue use plain `git worktree add` (so Cursor, Codex and Copilot behave as Claude Code does) and prepare the new worktree's dependencies. Owner, on adding this ticket: "ok thêm ticket cho việc handle worktree di. code song song cũng là ưu tiên".
- [x] (answered by D-03, D-08) Guard for Continue when tickets run in parallel, added 2026-10-16. The owner asked, looking at the panel's Continue button: "khi làm nhiều ticket song song, thì bấm vào continue thì chuyện gì happen? có nên có gate chặn ở đây ko?" Today the panel submits `/accord continue <id>` into the session that owns the panel, and the skill's `git switch` either fails because the branch is checked out in another worktree (the skill says nothing about that case, so an agent may `cd` there and two sessions then edit one worktree), carries uncommitted work of another ticket across, or cuts into a stage still running. Proposal to confirm at intent: Continue finds the worktree holding the ticket's branch (`git worktree list`) and works there, or adds one; one session per worktree, held by a lock the CLI checks, so a second Continue exits 2 naming the holder; a session mid-way through another ticket asks before switching. Owner chose to put this here: "Thêm vào ST-LN-7 (Khuyên)".
- [x] (answered by D-05; branch deletion moved to ST-LN-20 by D-01) Removing the worktree when the ticket is done, added 2026-10-17. After BUG-LN-3 merged, the hand-made worktrees `C:/Work/accord-backlog` and `C:/Work/accord-sev` (ST-LN-6, merged days earlier) were still on disk and had to be found and removed by hand. The owner: "ok clean up. tôi nghĩ nên thêm rule này vào accord workflow phải ko?" Proposal to confirm at intent: once the ticket's pull request has merged, the workflow removes its worktree (plain `git worktree remove`, refusing when it holds uncommitted work) and deletes the merged local branch with `git branch -d`; the dashboard can name worktrees whose ticket is done.
- [x] (finding 1 answered by D-07; finding 2 is the open question below) What a prepared worktree means, found 2026-10-18 during ST-LN-21. Two failures in the hand-made worktree `C:/Work/accord-search`: (1) `npm ci` ran before `npm run build`, so no `node_modules/.bin/accord` was linked (the workspace's own bin points at `packages/cli/dist/cli.js`, missing at install time); in this repository `npx --yes @accord-dev/accord@0.1.0` resolves to the workspace package, so the SessionStart hooks and the panel failed with "'accord' is not recognized" until `npm rebuild @accord-dev/accord --ignore-scripts` after the build; (2) a plain `claude` started in the worktree drew the panel from `C:/Work/accord/.claude/accord-panel`, because the user-level marketplace `accord` in `~/.claude/plugins/known_marketplaces.json` points at the main checkout and wins over the worktree's relative `extraKnownMarketplaces` path, so the owner's hand check of ac-4 first saw the old panel; the branch's panel loaded only with `claude --plugin-dir` given the worktree's `.claude/accord-panel/plugin` and `--settings` given a file that sets `accord-panel@accord` to false. Proposal to confirm at intent: preparing a worktree runs the repository's own setup in an order that links its bins (a setup command named in config, since only this repository depends on itself), and the try-this steps for a ticket that changes the panel say how to load the branch's panel. Owner, on these two findings: "còn 2 việc phát sinh thì mở một ticket xử lý, hoặc xem có ticket nào dc thì gộp vào luôn".
- [x] (answered by D-10) Which panel a session rooted in a worktree shows, added 2026-10-18. D-08 makes the session rooted in the worktree the only one that works the ticket, but a plain `claude` started there still draws the panel from `C:/Work/accord/.claude/accord-panel`, because the user-level marketplace `accord` in `~/.claude/plugins/known_marketplaces.json` points at the main checkout and wins over the worktree's relative `extraKnownMarketplaces` path (.claude/settings.json:35-45). Open: does this ticket make the printed open-a-session command load the worktree's own panel, only say so in the try-this steps of a ticket that changes the panel, or leave it out.

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen:** one CLI namespace `accord worktree`, all git and process work in `packages/cli`, the skills only calling it. `accord worktree open <id>`, run outside the ticket's worktree, finds the worktree holding `t/<id>` (`git worktree list --porcelain`) and only prints its path and `/accord continue <id>` (ac-3); with no branch yet (Pick up) it adds the sibling folder named after the main checkout and the id in lower case (D-06) on a new `t/<id>` from `origin/main` (D-15), commits `claim: <id>` there at once, runs `setup` (ac-1, ac-2), and prints the path and line; the skill pushes. Run inside the ticket's worktree it takes the hold, then reruns `setup` in full when its done-marker is missing (D-15). `accord new ticket --worktree` does the same for New request: it picks the id as today, adds the worktree, writes and commits the ticket file there (ac-6). `accord worktree clean`, which bare `/accord` runs before `accord dashboard` (the panel calls only `dashboard`, D-12), fetches `origin` with prompts off, then removes each ticket-branch worktree with plain `git worktree remove` when its checked-out commit is an ancestor of `origin/main` (D-16), keeping and naming one with modified or new files, one held by a live session, and the one it runs in (D-05); a failed fetch is said and the clone's refs are used (D-11). Holds live in `accord/holds` inside the common git directory, `.git/accord/holds` for this clone (D-14): tool, session marker, pid, process start time, time taken. A holder is live while its process with that start time is in the OS process table (`ps`; `Get-CimInstance Win32_Process` on Windows). In Claude Code the session marker is `CLAUDE_CODE_SESSION_ID` and the holding process is `CLAUDE_PID`, both set by Claude Code in every command it runs (checked on this machine); in any other tool no hold is taken and one line says so (D-17). Continue accepts an id whose claim branch exists locally or on `origin` (D-18), and `worktree open` run for Continue never claims a ticket. Updates go through an exclusive lock file and a rename, so two takers cannot both win.
**Rejected:** a per-chat token passed on every Continue (lost at compaction, so a session is refused by its own hold: breaks the Veto); a time-limited lease (reads an idle live session as dead: breaks D-11); harness hooks (only Claude Code has them wired, and none fire on a crash); cleaning inside `dashboard` (the panel calls it on every turn, D-12); a status cache file for the dashboard (goes stale; other tickets' stage belongs to ST-LN-16, D-09).
**Affected:** cli `run.ts` (register `worktree`), new `commands/worktree.ts` and `load/proc.ts`, `new ticket --worktree`, `load/fs.ts:447-454` (the origin main ref lookup, shared); core `schemas/config.schema.json` and `model/snapshot.ts` (`setup: string[]`), `skills/accord/SKILL.md` (Dashboard, Continue, Pick up, New request) and the generated skills; this repository's `accord/config.yml` (`setup`, D-07); README (CLI list; the limits in D-15 and D-17); tests `schemas`, `skill-commands`, `stage-skills`, `spawn-surface`.
**Risks:** (1) Must, accepted by D-17: in Cursor, Copilot, and Codex a second session in a held worktree is not refused; the README says so. (2) Must, open until the plan's first task: whether `CLAUDE_CODE_SESSION_ID` stays the same across a resume, a compaction, and the subagents of one session, and whether a sandboxed command can see `CLAUDE_PID` in the process table, is unchecked; a session refused by its own hold, or a live holder read as dead, is the failure. (3) Should: `setup` runs through the platform shell (`npm` is a `.cmd` shim), a stated exception to "the CLI never spawns npm" required by D-07; its commands are committed repository content, trusted as `tests.affected` is. (4) Should: a long `setup` may outlast an agent's command timeout; the skill text asks for a long one. (5) Should: ignored files such as a hand-made `.env.local` go with a removed worktree (D-15). (6) Could: squash or rebase merges are never judged merged, so those worktrees stay. (7) Could: `git worktree remove` can fail on Windows over a locked file or a long path, after deleting part of the folder; the line then says kept, or removed in part, with git's message (plan critique 1.9). (8) Could, accepted by the owner ("Tự prune, in 1 dòng (Khuyên)"): a worktree folder renamed by hand looks deleted to git; `git worktree prune` drops its record and one line `pruned <path>: <reason>` names it, so its files stay but it is no longer a worktree.
**Tests:** vitest at the CLI in-process layer against real git in tmp sandboxes: ac-1, ac-2, ac-3 drive `worktree open` with `setup` commands that append to a log; ac-4 mocks `load/proc.ts` (live and dead holders, the refusal text); ac-5 uses a bare remote, a clone and four worktrees merged on the remote only; ac-6 drives `new ticket --worktree`; the skill wording is a text test, as `stage-skills` does. Risk tests: `risk:parsing` (the real process table returns this process, on both CI OSes), `risk:security` (the spawn allowlist admits `ps`, `powershell`, and one shell site), `risk:data-loss` (a file not added to git survives `clean`).
