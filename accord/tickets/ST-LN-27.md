---
id: "ST-LN-27"                            # equals the file name: tickets/<id>.md
title: "Pick up, Continue and New request move the running session into the ticket's worktree"
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
approved_hash: "fnv1a64:e957fa8a07519b09"
ac_hash: "fnv1a64:50b807cc510ff945"
verified_hash: "fnv1a64:50b807cc510ff945"
verified_commit: "9536f0cb4a29045f1f688cd6557fa732ba4c7549"
verified: [ac-1, ac-2, ac-3, ac-4, ac-5]
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: Pick up, Continue and New request in lane M end with a `stop:` line that makes the owner open a new session in the ticket's worktree folder and type `/accord continue <id>` there (ST-LN-7 D-08, D-13); owner: "that is not the way to work. the user has no time to do that. accord must handle it itself".
For whom: anyone working a ticket through Claude Code.
Success: from `/accord` in a Claude Code session started in the main checkout, the owner reaches the ticket's next stage without opening a folder or typing a second command, and one session never works two tickets.
Not this ticket: Cursor, Codex and Copilot (deferred, they keep the `stop:` line); moving the worktree folder (ST-LN-7 D-06 stays); a session switching from one ticket to another; a live session's hold still refuses a second session, as today (ST-LN-7 D-03).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-27

  @ac-1 @test:packages/cli/test/worktree.test.ts#ac-1-in-claude-code-pick-up-from-the-main-checkout-takes-the-hold-and-prints-enter-instead-of-stop
  Scenario: Pick up moves the Claude Code session into the ticket's worktree and goes on
    Given a Claude Code session started in the main checkout that works no ticket
    And ticket X is ready to pick up
    When the owner types "/accord pick-up X"
    Then the claim on X is committed and pushed on X's branch
    And the same session's working directory becomes X's worktree folder and the session starts X at the stage and step that "accord anchor" prints for X
    And no "stop:" line is shown and the owner opens no folder

  @ac-2 @test:packages/cli/test/worktree.test.ts#ac-2-in-claude-code-continue-from-the-main-checkout-enters-a-claimed-worktree-whose-session-ended-with-or-without-a-worktree-here
  Scenario: Continue moves the Claude Code session into a claimed ticket's worktree and goes on
    Given a Claude Code session started in the main checkout that works no ticket
    And ticket X is claimed, by anyone as today, whether or not its worktree exists on this machine, and the session that worked it has ended, closed or crashed, mid-stage or between stages
    When the owner types "/accord continue X"
    Then the same session's working directory becomes X's worktree folder and the session resumes X at the stage and step that "accord anchor" prints for X
    And no "stop:" line is shown and the owner opens no folder

  @ac-3 @test:packages/cli/test/worktree.test.ts#ac-3-in-claude-code-a-new-lane-m-ticket-is-committed-pushed-and-held-and-prints-enter-instead-of-stop
  Scenario: A lane M new request moves the Claude Code session into the new ticket's worktree and goes on
    Given a Claude Code session started in the main checkout that works no ticket
    When the owner types "/accord <request>" and the request is classified lane M
    Then the new ticket is written, committed and pushed on its branch
    And the same session's working directory becomes the new ticket's worktree folder and the session starts its intent interview
    And no "stop:" line is shown and the owner opens no folder

  @ac-4 @test:packages/cli/test/worktree.test.ts#ac-4-in-claude-code-a-session-that-works-a-ticket-refuses-other-tickets-and-new-tickets-and-changes-nothing
  Scenario: A Claude Code session that works a ticket refuses a second ticket
    Given a Claude Code session that picked up, continued or created ticket A, or that was started in A's worktree folder or a folder inside it, at any later point in its life, even after A is done or merged
    When the owner types "/accord pick-up B", "/accord continue B", or "/accord <request>" in any lane, even a request about A
    Then accord refuses, naming A, saying to open a new session in the main checkout for other work, and saying to type a request about A without "/accord"
    And no ticket file, branch, worktree, claim or file change is made for the other work

  @ac-5 @test:packages/cli/test/worktree.test.ts#ac-5-outside-claude-code-pick-up-continue-and-new-ticket-print-the-stop-lines-and-nothing-is-refused
  Scenario: Sessions other than Claude Code keep today's behaviour
    Given a session that is not Claude Code, started in the main checkout
    When the owner picks up, continues, or creates a lane M ticket
    Then accord prints the "stop:" line with the worktree's path and "/accord continue <id>" as it does today
    And the session is not refused a second ticket, as today
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
- "must not work 2 tickets in the same sessino"

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Only Claude Code sessions move into the ticket's worktree in this ticket; Cursor, Codex and Copilot are deferred to a later ticket and keep today's behaviour — "defer it. for now only support claude."
- D-02 A session that works a ticket refuses Pick up, Continue and New request for any other ticket, names the ticket it works and says to open a new session in the main checkout, and creates or claims nothing — "A"
- D-03 Moving into the worktree means the session's own working directory becomes the worktree folder, so every later command, relative path and file edit lands there; not a session left in the main checkout that sends each call to the worktree — "A"
- D-04 A session works ticket A when it holds A's hold after picking up, continuing or creating A, or when it was started in A's worktree folder, even before any command — "A"
- D-05 In a session that works a ticket, "/accord <request>" is refused in every lane, lane S included, so the ticket's branch holds only that ticket's work — "A"
- D-06 In a session that works a ticket, only "/accord" (the dashboard) and "/accord continue" naming that same ticket run; every other "/accord <text>" is refused, even one about that ticket, and the refusal says to type a request about the ticket without "/accord" — "A"
- D-07 The refusal of "/accord <text>" in a session that works a ticket is enforced by a Claude Code UserPromptExpansion hook matched to the typed "/accord" command, so it fires only when the owner types "/accord …" and does not depend on the model following the skill — "ok A2"
- D-08 The worktree stays the sibling folder (ST-LN-7 D-06), and the owner accepts the one approval Claude Code asks for when a session enters a path outside `.claude/worktrees/` — "A"
- D-09 In a session that works a ticket, `accord new ticket` is refused with or without `--worktree`; changing a ticket's type drops it and commits that there, then says to open a new session in the main checkout to create the new ticket — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-19, on the proposed part "the worktree may move under .claude/worktrees/ so one session can switch between two tickets": "must not work 2 tickets in the same sessino"
- 2026-10-19, on D-01 ("A": Cursor, Codex and Copilot in this ticket), asked whether those runtimes must be enforced by the tool: "defer it. for now only support claude."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: the CLI tells Claude Code from other runtimes with `claudeEnv` (packages/cli/src/load/proc.ts:53) and, only in Claude Code and only from the main checkout, `accord worktree open <id> [--continue]` and `accord new ticket --worktree` take this session's hold there and print `enter: <path>` instead of the `stop:` lines; the one shared skill text, on `enter:`, pushes the claim and carries any people entry first, then calls Claude Code's EnterWorktree with that path, then resumes at Continue step 2; if the move fails it shows the path, "type /accord continue <id> to retry" and "or close this session and open one in that folder", and edits nothing. Every other runtime keeps today's output and refuses nothing (D-01).
Works ticket A (Claude Code only): a hold in the holds file whose marker equals the session id, or a linked worktree (git-dir differs from git-common-dir) on A's branch or any folder inside it; a linked worktree on a detached or unreadable branch refuses, except `continue <id>` from that id's own worktree. Then `worktree open` (all but `A --continue`), `new ticket` with or without `--worktree` (D-09), and a new `accord worktree check` exit 2 before any write, naming A and saying to open a new session in the main checkout, and to type a request about A without "/accord". The skill runs `worktree check` before every New request, from the dashboard too, and in a ticket session the dashboard offers only Continue A.
New public interface: the `enter: <path>` output line, `accord worktree check`, and `accord hook prompt-expansion`, a Claude Code UserPromptExpansion hook with matcher `accord` written by `accord skills sync`; it reads `session_id`, `command_name`, `command_args` and `cwd` from stdin, writes only JSON to stdout, and blocks any `/accord <args>` except none or `continue <A>` (D-07). Also: the SessionStart startup hook takes a free hold when the session starts in a ticket worktree, `worktree clean` keeps a worktree this session holds, and the session-resume hook, when a held session restarts in the main checkout, prints the anchor and the line to enter the held worktree.
Probed 2026-10-19 (Claude Code 2.1.303, Windows): EnterWorktree `path` into a sibling worktree works from a launch folder that is itself a worktree, `C:/` paths included; the session id and CLAUDE_PID stay; subagents start in the new folder; temp-dir writes and `git push` work after the move, `git -C` naming the main checkout is refused; UserPromptExpansion fires for a typed `/accord …` skill with `command_name` "accord", does not fire for `/accord-x`, blocks with `decision: block`, and its stdin `session_id` equals CLAUDE_CODE_SESSION_ID; `--resume` keeps the session id; after the move hooks and settings still come from the launch folder and SessionStart does not fire; a headless session that ends inside the worktree leaves it in place.
Rejected: UserPromptSubmit (about 1 s of npx on every prompt, and fires on subagent reports and peer messages); the panel mod's `prompt.submit` (enforcement would hang on the optional panel); skill-only refusal (lane S would rest on the model); worktrees under `.claude/worktrees/` (D-08: one approval click per move is accepted; moving them puts worktrees inside the main checkout); a per-runtime skill render (Cursor and Copilot read .claude/skills too).
Affected: packages/cli/src/commands/worktree.ts, new-ticket.ts, hook.ts, anchor.ts, run.ts and index.ts (stdin into runCli), packages/cli/src/load/proc.ts (read only); packages/core/src/scaffold/hooks.ts (`HookEntries`, `hookEntries`, `isAccordHookCommand` widened so a re-sync replaces old entries); packages/core/skills/accord/SKILL.md, worktree.md, ids.md and the regenerated copies; .claude/settings.json.
Risks, kept from the critic: (Should) after the move the session runs the launch folder's hooks and skills, so a ticket branch pinned to an older accord than main fails the pin check in the worktree; `worktree open` in Claude Code refuses before the move when the worktree's pinned version differs from the running one, naming the fix (merge the default branch into the ticket branch). (Should) the hook allows the prompt, with one stderr line, when it cannot read the holds file or git, so a broken holds file never blocks every `/accord`; the CLI refusals stay as the backstop. (Should) exiting an interactive session that entered a worktree by path is documented only for worktrees Claude created; a keep/remove prompt there could delete uncommitted work if answered remove; checked by hand at verify. (Nice) two processes resumed from one session id share the marker, so the hold does not refuse the second.
Tests: ac-1..ac-4 in-process vitest with real git in packages/cli/test/worktree.test.ts under a Claude env (hold taken, `enter:` printed, no `stop:`; every refusal leaves worktree list, branches, `log --all` and tickets unchanged), hook tests for prompt-expansion block and allow, and skill phrase tests in packages/core/test/stage-skills.test.ts for push-then-enter; ac-5 under an empty env from the main checkout and from inside a worktree, stop lines unchanged and nothing refused. Hand checks at verify: the live move and its approval prompt, a typed `/accord <text>` blocked, resume, compaction, and interactive exit.
