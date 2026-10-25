---
id: "ST-LN-43"                            # equals the file name: tickets/<id>.md
title: "A hollow test checks what its name says again, and tests that only repeat a stronger one are removed"
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
Queued 2026-10-22, not approved; the intent interview replaces this:
- Owner, 2026-10-22, to a read-only audit of all 73 test files (~1,100 tests) by five agents: "both tickets, go ahead". Line numbers as of main 8a8ba6f. Every claim is an agent's reading except A0, checked by hand; check each before deleting. Not found anywhere: tests guarding a dropped ticket (BUG-LN-5, ST-LN-9, ST-LN-24), mock-only tests, or an `ac-` test that is not the only one tagged for its scenario. No `ac-` test is proposed for deletion.
- A0, hollow (checked by hand): packages/cli/test/lane-commands.test.ts:95 "says already recorded after the ledger line is committed and the report is older than HEAD". Commit f4ecab9 added lines 103-104, which make the report fresh again right after line 102 aged it; it now duplicates :114, and the stale-report branch for an already recorded task (packages/cli/src/commands/task-done.ts:57) has no test. Fix: delete lines 103-104 and see the test still pass for the right reason.
- A1, high confidence (duplicate unless marked). Core: gate.test.ts:723 and :856 "PASS still goes through Done … after the Human/Machine layer lands" (same fixture as :278, which asserts more); gate.test.ts:340 "is pure, deterministic, and already sorted" (purity in :729, sort in :136); gate.test.ts:654 "READY_PROMOTE names only real lint rule ids" (:213 already requires each id at level error); gate.test.ts:647 "Ready, Plan, and Done each carry both approval rows" (inspects the table; behaviour in lane-ready.test.ts:24, :28, lane-plan.test.ts:67, lane-done.test.ts:74); lane-plan.test.ts:188 "an unknown ticket fails on gate.ticket-unknown alone" (gate.test.ts:185 it.each includes gatePlan); status.test.ts:96 "places the parentless epic before its child" (:150 asserts the full order); skills.test.ts:56 "rendered frontmatter is inside the six spec fields", designer only (:227 checks every SKILL.md); scaffold.test.ts:33 "has files to check" (:76 pins the exact list); scaffold.test.ts:208 "parses as YAML" (parsed at suite load, :203); scaffold.test.ts:306 "returns a block for a file that does not exist" (:319 uses the same block); hash.test.ts:116 "fnv1a64 of the empty string is the FNV offset basis" (:59 asserts the same literal); frontmatter.test.ts:106 "BOM+CRLF input produces the same findings as LF" (snapshot.test.ts:27 covers the fixture); schemas.test.ts:180 "reviewer is not a field" (golden at :173 rejects `reviewer`); bundle.test.ts:33 "names the missing build when dist is empty" (tests a helper defined in the test file, :12-17).
- A1, cli: init.test.ts:185 "prints no backslash on either stream" (:114 pins exact stdout, empty stderr); init.test.ts:357 "creates .github/workflows/accord.yml" (:114 plus :389); init.test.ts:365 "skips it on a second run" (:202 plus :376); init.test.ts:160 "writes a config that validates" (core scaffold.test.ts:88); load.test.ts:106 "keys never contain a backslash" (:76 pins exact keys); cli.test.ts:94 "--version prints the running version" (pin.test.ts:60 stronger, bin.test.ts:30); cli.test.ts:100 "--help exits 0 and names lint" (bin.test.ts:23); readme.test.ts:46 "LF and no BOM on disk" and :67 "names its generator on the first line" (drift test :21 compares bytes with the generator); skill-commands.test.ts:95 "treats a namespace as not a command" (:91 exact list); spawn-surface.test.ts:67 "has spawn sites to check" (:73 exact list); workflow-script.test.ts:542 "is built" (bin.test.ts:11); skills-sync.test.ts:573 "writes no settings file without the claude runtime" (ac-5 :610, lines 633-637); workflow-script.test.ts:329 "a failing gate exits 1 and lint still ran first" (last GATED case of :373); lane-commands.test.ts:54 "after approval gate ready passes" (lane-flow.test.ts:43-45); lane-commands.test.ts:230 "brief prints the ticket verbatim, then the one task" (ac-1 :257); lane-commands.test.ts:567 "a pushed branch under refs/remotes/.../t/<id> claims the ticket too" (:579 and :1118); lane-commands.test.ts:666 "anchors the ticket the current branch names" (ac-4 :1214); new-ticket.test.ts:39 "writes accord/tickets/<id>.md, prints the path, exits 0" (ac-5 :310).
- A2, medium confidence, owner decides per item. Rule-table guards, one group: core gate.test.ts:526, :535, :614, :626, :636, :862, :930; lint.test.ts:393. Core: gate.test.ts:287, :163; :686 (merge into :673); lint.test.ts:46; lane-plan.test.ts:60; lane-lint.test.ts:15; work.test.ts:35; skills.test.ts:204; scaffold.test.ts:313; schemas.test.ts:144 (keep the secret-name check), :186; bundle.test.ts:67 (trim, not delete); purity.test.ts:89, :97; gherkin.test.ts:172, :199, :222, :243 and sections.test.ts:196, :204 (loadSnapshot repeats of cheaper unit tests). Cli: load.test.ts:291, :208; init.test.ts:168, :177, :472, :509, :521, :389, :142; skills-sync.test.ts:562; workflow-script.test.ts:299; spawn-surface.test.ts:118 "skills sync" row; skill-commands.test.ts:91; lane-commands.test.ts:679, :612, :768; status.test.ts:105; pin.test.ts:50 (skills-sync.test.ts:340); hook.test.ts:39 (worktree.test.ts:1208, but the cheap one may be the better keeper); worktree.test.ts:514 (asserts this repo's config.yml setup list; named in ST-LN-7 plan.md:659). Naming: hook.test.ts:11-64 (5 tests) and all 7 in pin.test.ts lack an `ac-` or `risk:` prefix.
- Also, from the plugin audit (owner, 2026-10-25, to the plugin audit's recommendation: "agreed. remember to save the research and have the related tickets reference it."): a rule that stops new hollow tests, for the executor, the planner and the reviewer's quality lens: name the production change that would make the test fail before writing it; never compute the expected value with the code under test; no test that only an intended change can fail; a mental mutation check before finishing (superpowers 7.0.0 `writing-good-tests.md`). Without it, the removals above come back.
- Research: `accord/research/2026-10-25-plugin-audit.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-43

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
