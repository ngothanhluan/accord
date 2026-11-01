---
id: "ST-LN-57"                            # equals the file name: tickets/<id>.md
title: "Review checks a fixed scope, and a late finding blocks only with evidence"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-17"]
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
approved_hash: "fnv1a64:fa8636f35b1f509f"
ac_hash: "fnv1a64:77ead066cc31368d"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
- Why: 64% of round-3+ review findings came from an earlier round's fix, and 5 of the 7 late Musts from code added mid-review by a debug episode or a merge of main, none from a defect missed earlier (`accord/research/2026-10-25-review-convergence.md`); ST-LN-14's review ran 18 rounds.
- For whom: whoever runs accord review in lane S or lane M, and the owner who waits on it.
- Success: review checks a pinned scope; code added by a debug episode or a merge gets its own round 1; `accord gate done` refuses a late block without a test or command, a Should without grounds, and a file a fix changed that nothing explains; data loss and security always block.
- Not this ticket: counting rounds, the cap, tier-up, and whether counts restart after verify (ST-LN-17); how a finding is stated and fixed (ST-LN-56); the CLI never runs a reviewer's command.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-57

  @ac-1 @test:packages/cli/test/review-scope-package.test.ts#ac-1-the-next-review-package-holds-only-the-ticket-branch-commits-after-the-last-round-head
  Scenario: The next review round covers only code added after the last round
    Given a ticket in review whose last recorded round reviewed the ticket branch up to a known head commit
    And a debug episode or a merge of main has since added commits to the ticket branch
    When the review package for the next round is built without a --base option
    Then it holds only the ticket branch's commits after that head commit, leaving out what a merge brought in from main but keeping the merge's own conflict resolutions
    And review.md records, for each round, the head commit that round reviewed up to

  @ac-2 @test:packages/core/test/finding-evidence.test.ts#ac-2-from-round-3-a-new-finding-outside-the-last-fix-files-blocks-only-with-evidence
  Scenario: From round 3, a new finding outside the last fix's files blocks only with evidence
    Given review.md whose round 3 holds a Must or a Should that is not marked as carried forward from an earlier round
    And the file in the finding's location is one that none of round 2's fix commits, every commit after round 2 up to round 3 but a merge of main, a debug episode's commits and commits that change only the ticket's records, changed, or the finding gives no file
    And the finding is not marked as data loss or security
    When accord gate done runs
    Then it fails and names the finding while the finding records neither a failing test nor a reproducing command
    And it passes that finding when the finding records a failing test or a reproducing command
    And it passes that finding when the finding is marked deferred and the ledger's Deferred names it by round and number
    And it passes the same finding without evidence when it is marked as data loss or security
    And a finding so deferred, with its Deferred line, does not count toward the stop ST-LN-17 prints from round 3, nor toward the gate done failure that stop causes

  @ac-3 @test:packages/core/test/finding-evidence.test.ts#ac-3-code-added-by-a-debug-episode-or-a-merge-starts-its-own-round-1-for-the-evidence-rule
  Scenario: Code added by a debug episode or a merge starts its own round 1 for the evidence rule
    Given a ticket whose review reached round 4
    And a debug episode or a merge of main then added commits
    When the next round reviews those commits
    Then review.md records that round as round 1 of the added code
    And accord gate done asks no evidence of a finding located in a file the package of ac-1 shows those commits changed until that code's own round 3
    And a finding in any other file keeps the ticket's round count
    And the round count ST-LN-17 keeps still counts that round as the ticket's round 5

  @ac-4
  Scenario: From round 3, a Should rests on a ticket line or a failing case
    Given review.md whose round 3 or later, counted as ac-2 and ac-3 count it, holds a Should that is not marked as carried forward from an earlier round
    When accord gate done runs
    Then it fails and names the Should when the finding records neither a reference to an acceptance criterion, Decision, Veto or Intent line that exists in the ticket, nor a failing test or reproducing command
    And it passes when the finding records one of them, or the finding is a Nice, or it is marked as data loss or security
    And it asks no grounds of a Should in round 1 or 2

  @ac-5
  Scenario: A file a fix changed needs a finding or a Ruling
    Given a review round whose fix commits, every commit after that round up to the next round but a merge of main, a debug episode's commits and commits that change only the ticket's records, change a file that is the location of no finding of that round
    When accord gate done runs
    Then it fails and names the file while the ledger's Rulings hold no Ruling giving that file's repository path and a reason
    And it passes once such a Ruling is there
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket has four parts: (1) review scope pinned to a base, code added by a debug episode or a merge reviewed as its own round 1; (2) a fix that changes a file no finding names needs a Ruling; (3) from round 3 a new finding blocks only with a failing test or a reproducing command, else Deferred, data loss and security always block; (4) a Should rests on a ticket line or an in-scope failing case, else Nice, with the same exception — "A" (2026-10-29, asked: keep all four parts)
- D-02 The ticket waits for ST-LN-17: its round-based rules (own round 1, from round 3) use the round count the CLI keeps, not one the agent counts — "A" (2026-10-29, asked: wait for ST-LN-17, build alone now, or fold round counting in)
- D-03 From round 3, a finding counts as on the last fix when it is in a file that fix changed (file, not line); only a finding outside those files needs evidence to block — "A" (2026-10-29, asked: file or line)
- D-04 The CLI checks the form: each finding line in review.md carries its grounds (a ticket line, or a test or command that reproduces it), and `accord gate done` fails on a blocking finding from round 3 outside the last fix's files without a test or command, a Should without grounds, or a file a fix changed that no finding names and no Ruling covers; the CLI never runs the command — "A" (2026-10-29, asked: CLI checks the form, skill text only, or CLI runs the evidence)
- D-05 The own round 1 for code added by a debug episode or a merge restarts only the evidence gate's count; the round cap and the stop that reports to the owner keep counting every round of the ticket — "A" (2026-10-29, asked: restart only the evidence count, or restart everything)
- D-06 The smallest version that counts as done holds all four parts — "A" (2026-10-29, asked: all four parts required, or parts 1 and 3 as the core)
- D-07 The rule that a Should rests on a ticket line or a failing case applies from round 3 only; rounds 1 and 2 fix every Should as today — "A" (2026-10-29, asked: from round 3 only, or every round)
- D-08 A finding deferred under ac-2's evidence rule, with its line in the ledger's Deferred, does not count toward ST-LN-17's stop from round 3 or the gate done failure it causes; this ticket changes that one rule of ST-LN-17 — "as proposed" (2026-10-31, asked: deferred findings leave the stop, or keep counting as ST-LN-17 does today)
- D-09 A round's fix commits are every commit after that round up to the next round, but a merge of main, a debug episode's commits and commits that change only the ticket's records; a fix split over two commits cannot escape the checks and nobody has to name each commit as "fixed in" — "A" (2026-10-31, asked: fix commits are the round's range, or only the commits findings name as "fixed in" plus a check that every commit is named)
- D-10 When the ticket branch's HEAD is already on the default branch, or the ticket is done there, gate done skips this ticket's checks and prints a line saying so; the pull request's CI gate ran them on the branch — "A" (2026-10-31, asked: skip with a notice, or keep checking and fail a ticket whose pull request merged before its tick)
- D-11 In lane S, a Should's ticket line under ac-4 may be a quote from the ticket's `## Understood` or `## Done when`, lane S's counterparts of Intent and acceptance criteria — "A" (2026-10-31, asked: allow those quotes, or accept only a test or command in lane S)
- D-12 A debug episode's commits, for ac-2, ac-3, ac-5 and D-09, are those after the commit that opens the episode and before the first review round recorded after it opened, or up to its `## Resolved` when that comes first; a later commit while the episode stays open, waiting on another operating system's CI, is a fix of the round before it and needs a finding or a Ruling — "A" (2026-10-31, asked: cut the episode at the first review round after it opened, or keep it up to `## Resolved` so an episode left open hides every later fix)
- D-13 The lane M final review is not counted as a round for ac-2's evidence rule or ac-4's grounds rule: its findings are asked neither a test or command nor a ticket line, though ST-LN-17's count keeps counting it — "as proposed" (2026-10-31, asked: leave the final review out of the evidence and grounds count, or count it so the final reviewer must give tests, commands or grounds)
- D-14 For ac-5, a file that `accord skills sync` writes as a copy of a skill, and a path config.yml lists under `generated:`, needs no finding or Ruling when a fix changes it, as gate done already never counts those files — "as proposed" (2026-10-31, asked: exempt generated and synced copies, or ask a Ruling for each copy)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
- Chosen: version 2 review record, every loop round built from a head bound to git, D-09 and D-12 ranges from one walk, fail closed. review.md opens with `Round record: 2`; each heading is `## Round <n> head <sha>` (with `(added code round 1)` or `(final review)` when they apply); each finding line ends `— <location> — <state>` plus marks (`carried from`, `risk:`, `test:`/`command:`, `rests on:`); Deferred lines read `- review <r>.<n>[ cycle <k>]: …`. The typed head must lie in git between the previous head and the last code commit before the round's record, so a head cannot be typed to skip code. Every loop package is built from the last head; `--base` is kept for the lane M final review only. One `git log --remerge-diff` walk of HEAD less the default branch gives each round's fix range (merges, debug episodes per D-12 and records-only commits left out) and the added code. Gate done checks ac-2 to ac-5 in both lanes; the D-08 deferred set reaches every `cycleState` caller; every git error fails closed; D-10 skips with a notice.
- Why: the only option to meet every criterion and D-01..D-14 with heads, ranges and marks bound to git rather than typed; six critique rounds shaped it (ledger Rulings).
- Rejected: options that defined added code as commits not named `fixed in` (against D-05), that had no walk in lane S, or that trusted typed heads (critique 1 to 3); Option 2's same-file carried-from check (against the Ruling on explicit marks) and its `--base` warning, superseded by refusing `--base` in loop rounds.
- Affected: core round/record.ts, round/next.ts (`cycleState`, `recordProblems`), gate/rounds.ts, gate/rules.ts, gate/done.ts, work.ts (Deferred), snapshot and index exports; cli load/fs.ts (walk, cat-file batch), commands/review-package.ts, gate.ts, round.ts; skills review/record.md, review/SKILL.md steps 2, 4 and 7, accord/lane-s.md, debug/SKILL.md, agents/reviewer.md, regenerated generated/skills.ts; the workflow spec's review lines.
- Risks: no Must left open; the sixth critique's Must (D-14's exemption leaking into ac-2's fix files, against D-03) is fixed by two file sets, and the owner chose no seventh critique, so the plan critic and the tests check the last revision. Kept: a squash folds every range into the last one, so every file needs a finding or a Ruling; a pull request merged past a red gate is not checked again (D-10); a re-plan's files need Rulings; a head typed above what the package printed but inside the allowed range cannot be seen; on git 2.47 remerge-diff lists a file for a clean merge, counted alike by package and gate but possibly not by CI's git, only ever looser; `(final review)` is trusted within one per stretch; review SKILL.md's 5120-byte cap and ST-LN-85's context cut are pressed by the new text; ST-LN-56, which owns the finding statement, is undrafted.
- Migration (record version 1 to 2): (1) an in-flight version 1 record keeps the old rules by the pin at its first round commit; a missing pin refuses it, undone by converting (set `Round record: 2`, copy each head from the range the message prints, one location per finding, add the marks or Rulings asked). (2) a new-pin ticket written as version 1 is refused at its first round, undone the same way. (3) a rollback to the old CLI is undone by setting line 1 to `Round record: 1`, as version 2 lines still parse; a rebase is undone by retyping each head to its rewritten commit; a squash leaves the risk above.
- Tests: ac-1 CLI in-process with real git (package after a head, a debug commit and a merge with a hand resolution: only later commits, main's code absent, resolution present, `Head:` printed, a loop `--base` refused); ac-2, ac-3, ac-4 and ac-5 core gateDone over snapshots with the host's git facts; `risk:` tests with real git for a failed remerge read, a shallow clone, `--is-ancestor` exit 128, a first-parent history through a merge touching config.yml, the pin at R_1, the unreadable-head message, a version 1 record on a new pin, D-10, and an episode left open across a round; core `risk:` tests for whole-token paths, dashes in finding text and the final-review stretch rule.
