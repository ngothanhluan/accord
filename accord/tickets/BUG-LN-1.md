---
id: "BUG-LN-1"                            # equals the file name: tickets/<id>.md
title: "Executors see the plan's shared rules, and gate done stops warning on things that are not files"
type: "bug" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
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
approved_hash: "fnv1a64:8ebfdc45bbcc07f1"
ac_hash: "fnv1a64:a26623adea5fdfac"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
`accord brief` drops the plan's text before `## Task 1`, so an executor never sees the rules the plan shares across tasks; `gate done` warns `gate.reference-unknown` on evidence tokens that are not files (branch names, git refs, fractions, separators, directories, globs), and the noise hides a real mistyped path.
For whoever runs lane M: every executor briefed by `accord brief` gets the plan's shared rules, and a `reference-unknown` warning means a mistyped file path.
Success: a brief holds the plan's preamble; ST-LN-1's verification.md, which drew 18 warnings, draws none; a mistyped file path still warns.
Not in this ticket: what the error-level gates (`gate.evidence-unresolved`, `gate.note-*`) accept, how planners split shared rules between the preamble and Task 1, and the dogfood items other than 8, 35 and 37.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-1

  @ac-1
  Scenario: A brief carries the plan's preamble
    Given a lane ticket whose plan.md has the line "Shared rule: run the build first." between its frontmatter and `## Task 1`, and a `## Task 2`
    When `accord brief <id> 2` runs
    Then it prints exactly the ticket file verbatim, the line `---`, a blank line, "Shared rule: run the build first.", a blank line, and the Task 2 section, with no heading or label added, and exits 0
    And it prints nothing of the Task 1 section

  @ac-2
  Scenario: A plan with no preamble gives the same brief as before
    Given a lane ticket whose plan.md has nothing but blank lines between its frontmatter and `## Task 1`
    When `accord brief <id> 1` runs
    Then its output is byte-identical to the output before this ticket

  @ac-3
  Scenario: Evidence tokens that are not files draw no warning
    Given a verification.md evidence block that cites a real test and also holds `feature/{id}`, `origin/t/ST-AN-3`, `refs/heads/t/`, `1/2`, `//`, `t/`, `/branch`, `packages/core/skills/*/SKILL.md`, and `.claude/skills`, a directory in the repository
    When `accord gate done <id>` runs
    Then it reports no `gate.reference-unknown` warning for that block

  @ac-4
  Scenario: A mistyped file path still warns
    Given a verification.md evidence block that cites a real test and also holds `src/nope.ts` and `../x.md`, neither in the repository
    When `accord gate done <id>` runs
    Then it reports exactly two `gate.reference-unknown` warnings for that block, one naming only "src/nope.ts" and one naming only "../x.md"

  @ac-5
  Scenario: The error gate still needs a file or a test
    Given a verification.md evidence block that holds prose, `.claude/skills`, a directory in the repository, and `feature/{id}`, and cites no file, test or test id in any form
    When `accord gate done <id>` runs
    Then it reports `gate.evidence-unresolved` for that block and exits 1
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Fix both bugs in one lane M ticket, before the dashboard ticket — "Sửa hai lỗi trước (Recommended)"
- D-02 Part B covers the whole class of false warnings: only a token that looks like a real file path warns; existing directories, globs, branch names, git refs and tokens of only `/` and `.` do not; a mistyped path that looks like a branch name may be missed, as the code already prefers a miss to a false positive — "Cả lớp báo nhầm (Recommended)"
- D-03 The error-level gates stay as they are: an evidence block must still cite a concrete file or test to pass `gate done`; a directory alone does not count — "Luật lỗi giữ nguyên (Recommended)"
- D-04 All five criteria are the smallest version that counts as done — "Cả năm tiêu chí (Recommended)"
- D-05 The preamble goes right after the brief's `---`, between blank lines, before `## Task n`, with no heading or label — "Ngay sau `---`, không nhãn (Recommended)"
- D-06 One `gate.reference-unknown` warning per unknown token, as today — "Hai cảnh báo, mỗi đường dẫn một (Recommended)"
- D-07 ac-5's evidence block cites no file or test in any form, so it must fail — "Không dẫn file hay test nào khác (Recommended)"
- D-08 The Intent covers executors briefed by `accord brief`; executors that fix review or debug findings, whose brief is the ticket plus the findings, are left for a later ticket — "Thu hẹp Intent (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] What is the smallest version that still counts as done? All five criteria (D-04).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: Option 1, amended over three critic rounds — preamble on `Plan`, and a file-shaped filter on the warning only.** Part A: `parsePlan` stores as `Plan.preamble` (a required field) the plan body from its start to the line of the first `## Task n` heading, so a `## Context` section above Task 1 is kept; `brief` prints it verbatim, a plan's own `# Title` included, between `---` and the task, between blank lines, after dropping leading and trailing lines whose `trim()` is empty; when nothing is left the output is today's (D-05, ac-2). Part B: only `unresolvedRefs`, which feeds `gate.reference-unknown`, changes. It keeps an unresolved candidate only when, on its part before the first `#`, normalised (`\` to `/`): no `://`; no glob character `*?[]{}`; the last segment has no `..` and ends in `\.[A-Za-z][A-Za-z0-9]*`; no tree path lies under it (not an existing directory); and an `L<n>`/`L<n>-L<n>` anchor does not sit on a file that exists. `candidates`, `resolves` and the error gates are untouched (D-03, ac-5).
**Rejected:** the plain `EXT` list (round 1: `.cs`, `.feature`, `.ps1` typos go silent, against D-02); Option 2 alone (round 2: a dotted directory such as `.github` still warns); a list of known branch and ref shapes (cannot tell `origin/t/ST-AN-3` from a path without guessing).
**Affected:** core `load/work.ts`, `model/snapshot.ts`, `gate/refs.ts`; cli `commands/brief.ts`; tests `lane-commands.test.ts` (its brief assertion at :234 changes, as the shared fixture's `# Plan` becomes a preamble; the name stays), `refs.test.ts`, `gate.test.ts`.
**Risks kept:**
- A mistyped path with no extension (`src/nope`) no longer warns (D-02); neither does `src/nope..ts`.
- Still warn: a branch like `release/2.x`; a heading anchor on a real file (`docs/design.md#7-tests`), kept so that a mistyped test id under a real test file still warns; a cited gitignored file (the junit report); a dotted directory outside the tree (`node_modules/.cache`); a URL without a scheme ending in a file name.
- Every brief from a plan with a `# Title` line now carries that line after `---`; accord adds no label (D-05).
- Executors fixing review or debug findings still miss the preamble (D-08), and the help text, `executor.md` and `critic.md` still describe the brief as ticket plus task; both go to Deferred.
**Tests:** ac-1, ac-2 as CLI tests on `makeLaneRepo` plans with exact output; ac-3, ac-4, ac-5 as core `gate.test.ts` cases built with `citing()`. Risk tests in `refs.test.ts`: `..\x.md` still warns (existing), a dotted directory in the tree, a `#L<n>` anchor on a real file, a `://` URL, a `## Context` above Task 1. Verify runs `accord gate done ST-LN-1`, which today draws 17 `reference-unknown` warnings, all extensionless or glob-shaped, and must draw none.
