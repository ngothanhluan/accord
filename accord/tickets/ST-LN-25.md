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

  @ac-1
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

  @ac-2
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

  @ac-4
  Scenario: Continue merges the latest main into a ticket branch that is behind
    Given a claimed ticket whose branch lacks 2 commits that are on origin's main, not yet fetched, and that do not conflict with it
    When I run "accord worktree open <id> --continue"
    Then the ticket branch gains a merge commit whose first parent is its previous head and whose second parent is the tip of origin's main, with no rebase
    And the worktree's setup commands run on that merge commit
    And the ticket branch is pushed to origin

  @ac-5
  Scenario Outline: Any /accord command removes a merged ticket's worktree and branches
    Given the tip of ticket "ST-9"'s branch is on origin's main, and its worktree has no uncommitted work and no session holds it
    When I run "<command>"
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

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-22: "pull latest từ main về đi sao kỳ vậy?"
- 2026-10-22: "tôi chọn A, tự làm trong ticket này luôn đi. với lại tôi thấy vụ worktree rối rắm quá. những plugin khác tạo worktree đâu cần xin peermission, sau khi xong ticket thì tự dọn dẹp."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
