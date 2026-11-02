---
id: "ST-LN-81"                            # equals the file name: tickets/<id>.md
title: "The scout's facts are checked where they decide something and saved in the ticket, so no later agent searches again"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
research: ["accord/research/2026-10-30-harness-architecture.md", "accord/research/2026-11-02-scout-trust.md"]
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
Why: the scout's reports are not trusted; its errors are missed wiring files and false "only" / "none" claims, a skipped scout goes unseen, and later agents search again because nothing is saved.
For whom: every team member whose agent picks a lane or answers intent questions from a scout report, in any host tool.
Success: a tool, not a model, catches a logged absence claim its own search contradicts, a citation that does not resolve, a lane miscount and a missing report; the report is saved in the ticket.
Not here: choosing the scout's model or effort (ST-LN-46 measures it), a tool-built wiring candidate list, parallel scouts or a refuter, and changing the planner's own impact search (ST-LN-80 D-03).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-81

  @ac-1
  Scenario: A logged absence claim that its own search contradicts fails the check
    Given a scout report whose absent table claims "no other caller of loadConfig", logging the JavaScript regular expression "loadConfig\(" over the files git tracks under "packages/", with "packages/core/src/load/config.ts" as its only allowed hit
    And the git-tracked file "packages/cli/src/commands/init.ts" also matches that expression
    When the owner runs "accord scout check" on the report
    Then it exits 1 and names the claim and "packages/cli/src/commands/init.ts"

  @ac-2
  Scenario: A citation that does not resolve fails the check
    Given a scout report whose text holds "packages/core/src/gate/scope.ts:9999", past the end of that file, and "packages/core/src/missing.ts:3", a file git does not track
    When the owner runs "accord scout check" on the report
    Then it exits 1 and names both citations

  @ac-3
  Scenario: The check computes the lane lift conditions from the report's file list
    Given a scout report whose file list holds 8 existing files: 6 product files in 2 code areas, a code area being a file's folder cut to its first four path segments, plus 1 test file and 1 copy accord generates
    And one of the 6 sits under an entry of "sensitive:" in "accord/config.yml"
    When the owner runs "accord scout check" on the report
    Then it prints 6 expected files, 2 code areas, the sensitive file with that entry's line in "accord/config.yml", and that the request lifts to lane M for more than 5 files and for a sensitive area

  @ac-4
  Scenario: A lane M ticket is approved only with a scout report that passes the check or says why it was skipped
    Given a lane M ticket
    When the owner runs "accord approve <id>" with no "accord/tickets/<id>/scout.md", or with one that "accord scout check" fails and that holds no line "skipped: <reason>"
    Then it exits 1 and names the missing or failing report
    And with a "scout.md" that the check passes, or that holds a line "skipped: <reason>", the approval goes on
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
- D-01 ST-LN-81 builds design 1 only: the scout prompt's fixed reply form, `accord scout check`, the saved report and the missing-report refusal; model and effort stay with ST-LN-46 — "OK, go with what you recommend" (2026-11-02, translated; the recommendation was option A, solution 1 only, model left to ST-LN-46)
- D-02 The smallest version that counts as done is all four criteria, ac-1 to ac-4 — "Do it in full" (2026-11-02, translated)
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-11-02, the owner (Vietnamese, translated): "The problem I want to solve is that the scout is not trusted enough today. How should it work now, which model should it use, Haiku or Sonnet? What should the architecture be so it is both fast and highly trusted? Propose 2-3 solutions."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Option 1: Checked report, facts read on demand. A new pure core module under `packages/core/src/scout/` parses the scout's fixed reply form (`## Files`, an optional `## New files` list the main session writes, the `## Absent` table `| Claim | Pattern | Folders | Allowed hits |`, every `path:line` citation, a `skipped:` line) and judges it against host facts it is given (a tracked path list and a read callback). Folders and allowed hits are normalised (`.`, `./`, `/` mean the root; an entry without a trailing `/` is a folder when tracked paths sit below it), and a row whose folders cover no tracked file fails. The ticket's own files are left out of every search: `accord/tickets/<id>.md`, everything under `accord/tickets/<id>/`, and every path the ticket's frontmatter `research:` key lists that is a research record (`isResearchRecord`), read from the ticket itself, whatever branch first added the records. Each logged JavaScript regular expression runs line by line over the remaining tracked files under the logged folders; a hit outside the allowed hits fails the row. Lane numbers are computed over `## Files` plus `## New files` (a tracked path under `## New files` fails): expected files, code areas, and each `sensitive:` match with its line in `accord/config.yml`. `accord scout check <file>` (`packages/cli/src/commands/scout.ts`) checks against the working tree's tracked files and exits 0, 1 or 2. `accord approve`, lane M, checks `scout.md` at the commit that last changed it, or against the working tree when the file has uncommitted changes, and refuses with exit 1, writing nothing, on a missing report or on a failing report with no `skipped:` line. At a commit it takes paths and sizes from one `git ls-tree -r -z -l` call and reads the text in bounded `git cat-file --batch` calls of at most 32 MiB of blobs each; a single larger blob gets its own call with a buffer sized to it, so no repository size makes approve exit 2. A new reference `shared/scout.md`, loaded by the accord, intent, approach and build skills, says how to save the report, to re-send the scout the check's output once on exit 1 and then ask the owner, and when `skipped:` may be written; approach step 5 runs the check before the owner's yes; build step 6 handles an exit 1 from approve.

Impact:
- Commands: `packages/cli/src/commands/approve.ts:9-26` (exit-1 refusal before `writeKey`, line 18); `packages/cli/src/run.ts:149-154` (approve), `:222-234` (namespace pattern for `scout check`, through `preflight`); `packages/cli/src/load/fs.ts:19-34` (`gitTree` lists untracked too, so the check reads `git ls-files -z`, per `accord/product/conventions.md:8-10` and `packages/cli/test/spawn-surface.test.ts:18-19`); `packages/cli/src/load/fs.ts:1197-1226` (`catBatch`: its fixed 64 MiB `maxBuffer` at line 1203 becomes an optional parameter defaulting to the same value; existing callers `gitFilesAt` at `:1229-1238` and the branch-diff read at `:1385` keep the default), `:1438` (the `git ls-tree -r -z` pattern, used with `-l` for blob sizes).
- Core: `packages/core/src/gate/scope.ts:32` (`matches`), `:35-36` (own-file rule, mirrored); `packages/core/src/model/snapshot.ts:113` (`TicketFrontmatter.research`, read directly) and `packages/core/src/load/research.ts` through `packages/core/src/index.ts:40` (`isResearchRecord`; `addedResearch` at `packages/core/src/gate/research.ts:9-17` is not used, since it needs branch facts and returns only records the branch adds); `packages/core/src/load/config.ts:21-33` (`configLists` gains each `sensitive` entry's line from `packages/core/src/load/yaml.ts:18-37`; callers `scope.ts:40,123` unaffected); `packages/cli/src/commands/branch-fact.ts:15`, `packages/cli/src/commands/skills.ts:87` (generated-copy list); `packages/core/src/index.ts:57` (exports).
- Text: `packages/core/agents/scout.md:8-15` (fixed form, full repository paths, wiring checklist, "search logged"; body cap `packages/core/test/agents.test.ts:100-103`); new `packages/core/skills/shared/scout.md`; `packages/core/skills/accord/lane.md:7-18,25-26`; `packages/core/skills/accord/SKILL.md:6,71-78`; `packages/core/skills/intent/SKILL.md:6,17-20`; `packages/core/skills/approach/SKILL.md:6,57-71`; `packages/core/skills/build/SKILL.md:6,43`; `packages/core/agents/planner.md:17`; caps and `./scout.md` naming in `packages/core/test/skills.test.ts:188,280-290,482`; the generated `packages/core/src/generated/agents.ts`, `generated/skills.ts` and rendered `.claude/agents/`, `.claude/skills/accord*/`, `.agents/skills/accord*/`; `README.md:105,129-139` and the generated `packages/cli/README.md:107,131-141`.
- Tests: `packages/cli/test/skill-commands.test.ts:92`; `packages/core/test/stage-skills.test.ts:26,28,738-762,885`; every lane M approve run without `scout.md`: `packages/cli/test/lane-commands.test.ts:19,24,59,350,656,771,884,1032,1137`, `lane-flow.test.ts:86`, `core-ready.test.ts:20`, `lane-s.test.ts:275`, `status.test.ts:371,409,427,449`, `worktree-push.test.ts:64,117,147`, seeded by `packages/cli/test/helpers/repo.ts:182-193` and `packages/cli/test/helpers/worktree.ts:46`.
