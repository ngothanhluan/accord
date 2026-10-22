---
id: "ST-LN-25"                            # equals the file name: tickets/<id>.md
title: "Work stays current: a newer accord is announced and upgraded by pull request, ticket branches follow main, merged tickets clean up"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
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
approved_hash: "fnv1a64:3fd9b972ca199053"
ac_hash: "fnv1a64:d14f73ef46a3a5e4"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: a repository pins its accord version and nothing says a newer one exists; a ticket claimed long ago is worked on code far behind main (this ticket was 269 commits behind) until verify; a merged ticket's worktree stays until someone types a bare `/accord`. Owner: "pull latest từ main về đi sao kỳ vậy?", "sau khi xong ticket thì tự dọn dẹp."
For whom: everyone on a team that works through accord, in Claude Code, Cursor, Codex or Copilot.
Success: a newer release is announced, asked of the registry at most once a day; one command gives a pushed branch that moves the pin everywhere, ready for a pull request; Continue leaves the ticket branch merged with the latest main; any `/accord` command removes merged tickets' worktrees and branches.
Not this ticket: no per-machine self-update; no permission-prompt work (D-03); no rebase; a worktree with uncommitted work or a live session is never removed; the CLI never calls `gh`.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-25

  @ac-1 @test:packages/cli/test/hook.test.ts#ac-1-a-newer-release-is-announced-by-the-session-start-hook-and-the-dashboard-and-the-registry-is-asked-once-in-24-hours
  Scenario Outline: A newer accord release is announced, and the registry is asked at most once in 24 hours
    Given accord/config.yml pins accord "0.1.0" and the npm registry's latest "@accord-dev/accord" is "0.2.0"
    And the registry has not been asked from this machine in the last 24 hours
    When I run "<command>", and run it again a minute later
    Then the second output holds one line saying that accord 0.2.0 is out, that the repository pins 0.1.0, and to type "/accord upgrade"
    And the registry was asked once across both runs

    Examples:
      | command                    |
      | accord hook session-start  |
      | accord dashboard           |

  @ac-2 @test:packages/cli/test/hook.test.ts#ac-2-an-unreachable-registry-adds-no-line-is-given-up-after-3-seconds-and-is-not-asked-again
  Scenario: An unreachable registry is never seen and never waited on for long
    Given the npm registry does not answer and has not been asked from this machine in the last 24 hours
    When I run "accord hook session-start", and run it again a minute later
    Then both runs print what they print today, with no line about a newer version, and exit 0
    And the request to the registry is given up after at most 3 seconds, and the second run sends none

  @ac-3
  Scenario: Upgrading moves every pin on a pushed branch and leaves the checkout alone
    Given accord/config.yml, .github/workflows/accord.yml and the accord hook commands in .claude/settings.json all pin accord "0.1.0"
    When I run "npx --yes @accord-dev/accord@0.2.0 upgrade", whose own version is 0.2.0
    Then a new branch cut from origin's latest main holds one commit that pins the running version, "0.2.0", in all three files, with the skill files that "accord skills sync" 0.2.0 writes
    And that branch is pushed to origin
    And the branch and files of the checkout I ran it in are unchanged

  @ac-4 @test:packages/cli/test/worktree.test.ts#ac-4-continue-merges-the-latest-origin-main-into-a-ticket-branch-before-verify-runs-setup-on-the-merge-and-pushes-it
  Scenario: Continue merges the latest main into a ticket branch that is behind
    Given a claimed ticket at a stage before verify whose branch lacks 2 commits that are on origin's main, not yet fetched, and that do not conflict with it
    When I run "accord worktree open <id> --continue"
    Then the ticket branch gains a merge commit whose first parent is its previous head and whose second parent is the tip of origin's main, with no rebase and never a fast-forward
    And the worktree's setup commands run on that merge commit
    And the ticket branch is pushed to origin

  @ac-5
  Scenario Outline: Any /accord command removes a done and merged ticket's worktree and branches
    Given ticket "ST-9" is done on origin's main, not yet fetched: its ticket file there is verified and passes "accord gate done"
    And its branch holds no commit after the verified commit recorded there, and its worktree has no uncommitted work and no live session holds it
    When I run "<command>" for another ticket than "ST-9"
    Then the worktree of "ST-9" is removed, its local branch is deleted, and its branch on origin is deleted

    Examples:
      | command                                     |
      | accord worktree clean                       |
      | accord worktree open <id>                   |
      | accord worktree open <id> --continue        |
      | accord new ticket <id> --lane M --worktree  |
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 This ticket also makes Continue merge `origin/main` into a ticket branch that is behind, whatever the stage (a merge commit, then the setup commands, then a push; a conflict stops and is reported), replacing ST-LN-30 D-04's report-only Continue — "tôi chọn A, tự làm trong ticket này luôn đi." (to the options: A Continue always merges when behind; B only before build; C keep report-only)
- D-02 This ticket also removes a ticket's worktree and its branches on its own once the ticket's work is merged, with no command typed for it — "sau khi xong ticket thì tự dọn dẹp."
- D-03 Permission prompts when working in a worktree are out of scope — "thôi bỏ qua vụ xin permission đi."
- D-04 The new-version notice reaches the owner through the agent: the session-start hook gives it to the agent, and the agent says it in its first reply of the session — "A" (to the options: A the agent says it in its first reply; B only the hook's existing line; C only the dashboard)
- D-05 The automatic clean of D-02 runs whenever any `/accord` command runs (the dashboard, Continue, Pick up, a new request), in every tool, never at session start — "A" (to the options: A every /accord command; B every session start, Claude Code only; C both)
- D-06 The `/accord` dashboard also shows the new-version line, in every tool, checking at most once a day, so users without a session-start hook (Cursor, Codex, Copilot) learn of it too; Claude Code still says it at session start per D-04 — "A" (to the options: A the dashboard shows it as well; B Claude Code only)
- D-07 The smallest version that counts as done is all four parts: the notice, the upgrade, Continue merging main, and the automatic clean — "A" (to the options: A all four; B drop the dashboard line; C drop the automatic clean)
- D-08 The automatic clean removes a ticket's worktree, local branch and origin branch only when the ticket is wholly done: verified and approved, and merged into origin's main; then it removes them whatever tool the worktree was worked from, keeping only a worktree with uncommitted work or one a live Claude Code session holds; a ticket merged but not done is kept — "ý tôi là chỉ xóa worktree khi ticket đó hoàn toàn done", then "A" (to the options: A done and merged, both; B merged is enough)
- D-09 Continue merges `origin/main` only while the ticket is before verify (intent, approach, plan, build, review), narrowing D-01's "whatever the stage"; verify keeps its own merge at its start (ST-LN-30), and a ticket at verify or done is never merged by Continue, so an approved verification is never made stale — "A" (to the options: A only before verify; B at every stage, done included)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-22: "pull latest từ main về đi sao kỳ vậy?"
- 2026-10-22: "tôi chọn A, tự làm trong ticket này luôn đi. với lại tôi thấy vụ worktree rối rắm quá. những plugin khác tạo worktree đâu cần xin peermission, sau khi xong ticket thì tự dọn dẹp."
- 2026-10-22, to the question "when the automatic clean cannot be sure no session is in a worktree, what should it do?" (A remove only when sure no one is in it; B remove whenever nothing is uncommitted; C give the other tools a hold too), after first answering "A": "ý tôi là chỉ xóa worktree khi ticket đó hoàn toàn done"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: inline registry check, upgrade through a temporary index, shared merge helper, clean reused.** The hook and the dashboard `await fetch` the public registry with a 3 s abort, at most once per rolling 24 h, caching the time and answer in one per-machine file outside the repository; a failed request counts as the check; the line prints only for a `x.y.z` version newer than the pin, and names `npx --yes @accord-dev/accord@<new> upgrade`. `accord upgrade`, exempt from the pin check, follows `drop`: it reads config, settings and workflow at origin's main, rewrites the three pins to its own version, renders the files `skills sync` writes, lints the result, commits once through a temporary index and pushes `upgrade/<version>`; the checkout is never touched. Continue, before verify (D-09), with no uncommitted tracked change and after the hold, calls the merge body taken out of `worktreeMerge`, then setup, then push. `worktreeClean` judges done from the ticket file at origin's main (D-08), gains "fetched already" and "skip this id" options and deletes origin branches with a lease; `worktree open` and `new ticket --worktree` call it.
**Rejected:** a temporary worktree for `upgrade` (whole-tree checkout, post-checkout hooks, a stray worktree record if killed, the worktree list changes against ac-3); a background registry check in a detached child (orphan and cache-race risk on Windows, and no criterion needs zero wait).
**Affected:** packages/cli/src/run.ts, commands/hook.ts, dashboard.ts, worktree.ts, new-ticket.ts, a new registry module beside fetch-limit.ts, a new upgrade command reusing drop.ts's pattern and skills.ts's hook merge; core scaffold pin writers; skills `accord/SKILL.md`, `accord/worktree.md` and a new upgrade reference file (the 5120-byte cap), regenerated; README; tests in worktree, hook, dashboard, skill-commands and stage-skills; a vitest setup file that stubs the registry so no test calls npm.
**Risks the option keeps (critic):** Must 1, removing a worktree under a live session of another tool, is settled by D-08 (only a wholly done ticket is cleaned). Should 2 to 12 are settled by Rulings in the ledger: merge only after the hold and with nothing uncommitted (2); verify and done are never merged (3, D-09); setup and push before the pin check (4); the `/accord upgrade` route and its exemptions (5); the stated pin exemption and no downgrade (6); lint before the upgrade commit (7); done read from main's ticket file, so squash merges clean too (8); leased origin deletes only after a fetch that succeeded, with prune (9); a proxy-only machine never sees the notice, a noted shortcut (10); the hook tells the agent to say the notice (11); the skill's "clean only from the bare `/accord`" rule replaced (12).
**Data deletion, three failure scenarios and their undo:** (S1) a worktree removed while another tool's session is in it: only a done and merged ticket is removed (D-08), uncommitted work and live Claude holds are kept, and the branch's commits are on main, so `git worktree add` brings it back. (S2) Continue merging under another session's stale file: the merge needs no uncommitted change and the hold first, and a merge is undone with `git reset --hard ORIG_HEAD` before the push or a revert after. (S3) deleting an origin branch a teammate just pushed to: the lease against the fetched sha makes the push fail instead, and nothing is deleted after a failed fetch.
**Tests:** ac-1 and ac-2 at the CLI layer with the registry module mocked, the time and request count observed; ac-3, ac-4 and ac-5 at the CLI layer against a real bare remote and clone, no git mock, as worktree.test.ts does; the Continue conflict, the dirty-worktree refusal and the lease each get a `risk:` test.
