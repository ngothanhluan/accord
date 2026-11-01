---
id: "ST-LN-76"                            # equals the file name: tickets/<id>.md
title: "Merged branches made outside a ticket are cleaned with their worktrees"
type: "story" # story | bug. An epic uses its own template
status: "dropped" # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-55"]
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
Queued 2026-10-30, not approved; the intent interview replaces this:
- Why: `accord worktree clean` handles only ticket branches. Merged `backlog/`, `fix/` and `release/` branches and Claude Code agent worktrees (`.claude/worktrees/agent-*`, e.g. one on `backlog/split-worktree-test-2026-10-30` left on 2026-10-30) stay until removed by hand.
- Queued intent: clean also removes a merged non-ticket branch, local and on origin, and its worktree folder wherever it is, and keeps any such branch with a commit of its own the default branch lacks.
- Split from ST-LN-55 part (E) (its D-01, narrowed by its D-10, owner "A", 2026-10-30), taking its former ac-4 below.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-76

  @ac-1
  Scenario: A merged non-ticket branch and its worktree are cleaned
    Given a branch named "backlog/x", "fix/x" or "release/x" that has a commit of its own, every commit of it is on the default branch, and its worktree has no uncommitted work
    And a branch named "backlog/y" with a commit the default branch lacks, and a branch named "backlog/z" with no commit of its own
    When accord worktree clean runs
    Then the merged branch, local and on origin, and its worktree folder no longer exist, wherever that folder was
    And "backlog/y" and "backlog/z" and their worktrees still exist
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] "Merged" must cover fast-forward merges and agent branches merged locally: the "second parent of a merge on the first-parent chain" test misses them, and first-parent membership misreads a branch created at another branch's tip (ST-LN-55 approach critique, round 2).
- [ ] The local and origin tips are judged separately, so a teammate's later commit on origin is never deleted.
- [ ] A liveness guard for non-ticket worktrees: holds are keyed by ticket id, and path holds in the same file break worksTicket and the prompt-expansion hook.
- [ ] Skip any name the ticket branch templates recognise (`branch: "fix/{id}"` is allowed).
- [ ] `release/` branches are often long-lived: ask the owner whether they belong.

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->

## Dropped
Duplicate of ST-LN-87, which PR #152 queued on 2026-11-01 from the same ST-LN-55 split (its D-01 E, D-10, former ac-4). Same acceptance criterion and the same five open questions; ST-LN-87 keeps the work.
