---
id: "ST-LN-1"                            # equals the file name: tickets/<id>.md
title: "Claim branch names follow a configured template"
type: "story" # story | bug. An epic uses its own template
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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
The claim branch is fixed as `t/<id>`, while many teams name branches their own way, e.g. `feature/<id>`.
For a team, accord should create, recognise and count claim branches named by the team's template.
Success: with `branch: "feature/{id}"` in config.yml, /accord creates and pushes `feature/ST-LN-2`, `accord anchor` finds the active ticket from it, and status and next count it as a claim; `t/<id>` branches still count.
Without the key nothing changes: the template is `t/{id}`.
Not in this ticket: variables other than `{id}`, a free-text tail after the id, renaming existing branches, a configurable `claim: <id>` commit message.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-1

  @ac-1
  Scenario: The active ticket is found from a branch named by the template
    Given config.yml has `branch: "feature/{id}"` and ticket ST-AN-2 exists
    When `accord anchor` runs with no id on branch feature/ST-AN-2
    Then it prints the anchor of ST-AN-2 and exits 0

  @ac-2
  Scenario: Branches named by the template and t/ branches both count as claims
    Given config.yml has `branch: "feature/{id}"` and tickets ST-AN-2, ST-AN-3 and ST-AN-4 exist
    And the tip commit of the fetched ref origin/feature/ST-AN-2 is authored by "an@example.com", and that of origin/t/ST-AN-3 by "bo@example.com"
    When `accord status --json` and `accord next --json` run
    Then ST-AN-2 is claimed by "an@example.com" with branch "feature/ST-AN-2", and ST-AN-3 by "bo@example.com" with branch "t/ST-AN-3"
    And next lists ST-AN-4 with branch "feature/ST-AN-4" and lists neither ST-AN-2 nor ST-AN-3

  @ac-3
  Scenario: Lint rejects an invalid template and other commands fall back to t/{id}
    Given config.yml has `branch` set in turn to "{id}", "feature/{id}/{id}", "feature/x", "feature {id}", and "feature/..{id}"
    When `accord lint` runs, and `accord anchor` runs with no id on branch t/ST-AN-2
    Then lint reports a schema error on `branch` and exits 1 for each, and the anchor is that of ST-AN-2
    And with "feature/{id}" lint reports no finding on `branch`

  @ac-4
  Scenario: Without the key nothing changes
    Given config.yml has no `branch` key and tickets ST-AN-2 and ST-AN-3 exist
    And the local branch t/ST-AN-2 is checked out, and the fetched ref origin/feature/ST-AN-3 exists with no t/ST-AN-3 anywhere
    When `accord anchor` runs with no id, and `accord status --json` runs
    Then the anchor is that of ST-AN-2, ST-AN-2 is claimed, and ST-AN-3 is not claimed

  @ac-5
  Scenario: The /accord skill uses the template
    Given the /accord skill as shipped
    When its Continue, Pick up and New request steps are read
    Then Continue switches to the `branch` that `accord status --json` gives for the ticket
    And Pick up and New request create and push the `branch` that `accord next --json` or `accord status --json` gives, and none of the three steps builds a branch name itself
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Three parts: an optional config key validated by the schema, defaulting to `t/{id}`; anchor, hook and the claim read use the template; the /accord skill tells the agent to create and switch to the branch the template gives — "Đúng 3 phần (Recommended)"
- D-02 The template is fixed text plus exactly one `{id}`, matched against the whole branch name; no other variable and no free-text tail — "Chỉ {id} (Recommended)"
- D-03 `t/<id>` branches always count as claims, next to branches named by the template, so changing the template never loses a claim; `t/` stays reserved — "Đọc cả t/ lẫn mẫu mới (Recommended)"
- D-04 The schema requires exactly one `{id}`, at least one fixed character besides it, and only characters git allows in a branch name; lint reports an invalid template — "Chặt: đúng 1 {id}, có chữ cố định, tên git hợp lệ (Recommended)"
- D-05 All three parts are the smallest version that counts as done — "Cả 3 phần (Recommended)"
- D-06 An invalid template is a lint schema error (exit 1), like any other config key; while it is invalid, anchor, hook, status and next ignore it and use `t/{id}` — "Như key khác, lệnh khác dùng t/{id} (Recommended)"
- D-07 The templates in force are `t/{id}`, the `branch` in the working tree's config.yml, and the `branch` in config.yml on the fetched default branch; a template reaches the whole team once it is on the default branch, and no other ref sets one — "Máy đang chạy + nhánh mặc định (Recommended)"
- D-08 The CLI gives the branch name: each row of `status --json` and `next --json` carries `branch`, the claim branch of a claimed ticket or the name a new claim would use; the /accord skill reads it and never builds a name — "CLI in ra tên nhánh (Recommended)"
- D-09 A new claim is named by the valid template on the fetched default branch, else `t/{id}`; only a repository with no default branch uses the working tree's template, so every new claim is one the whole team counts — "Theo mẫu trên main (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] What is the smallest version that still counts as done? All three parts (D-05).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: Option 1, amended over three critic rounds — template regex in the CLI loader.** Schema gains an optional `branch`, checked by an `allOf` of small patterns (D-04): one `{id}`, a fixed character, `[A-Za-z0-9._/-]` only, no leading `-` or `/`, no trailing `/` or `.`, no `..` or `//`, no segment starting with `.` or ending in `.lock`, and no `t/` prefix other than `t/{id}`. The templates in force are `t/{id}`, the working tree's valid `branch`, and the `branch` on the fetched default branch (D-07), read by one non-interactive `git cat-file` spawn whose failure adds nothing and never errors. `gitClaims` scans one narrow `for-each-ref` pattern pair per template; a `t/` name matches only `t/{id}`; each claim keeps its branch name. The snapshot carries the templates and claim branches, so core's `statusRows`/`nextRows` give each lane row a `branch`: the claim branch, or for an unclaimed ticket the default branch's valid template, else `t/{id}`, with the working tree's template used only when there is no default branch (D-08, D-09). `activeTicket` (anchor, session-resume hook) matches the current branch against the same set. The /accord skill reads `branch` from `status --json`/`next --json` and never builds a name; ids.md says "claim branch".
**Rejected:** Option 2 (core helper, globs and a regex that must agree) serves no criterion. Templates from every ref (round 2) let a stray branch set one, breaking ac-4. The working tree's template naming new claims (round 3) creates claims teammates on the default branch never count.
**Affected:** core `schemas/config.schema.json`, `model/snapshot.ts`, `status/rows.ts`, `skills/accord/SKILL.md`, `skills/accord/ids.md`, generated and rendered skills; cli `load/fs.ts`, `commands/anchor.ts`, `commands/hook.ts`; tests in `lane-commands.test.ts`, `schemas.test.ts` (key list), `stage-skills.test.ts` (its `t/<id>` row).
**Risks kept (critic rounds 1–3; all Musts resolved by D-07, D-09 and the `t/` rule):**
- Changing from one non-`t/` template to another stops counting claims still open under the old one; `t/` claims always count (accepted with D-07).
- In a blobless clone, a default-branch config blob never fetched is skipped, so its template is not in force there; on git older than 2.44 that read may fetch the blob from the remote.
- Editing `branch` on a branch takes effect for new claims only once merged to the default branch (D-09).
- An invalid working-tree template is ignored while the default branch's valid one still applies (D-06 read with D-07); any other schema error in the working tree also drops its `branch`, as with every key.
**Tests:** ac-1 to ac-4 as CLI tests on sandbox repos (`update-ref`, `commit-tree`, an `origin/HEAD` where needed); ac-3's refusals also as schema cases, one per rule; ac-5 as a section-by-section check of Continue, Pick up and New request. Risk tests: a default-branch template seen from a working tree without the key; a template on another ref sets nothing; an invalid template's own branch never claimed; the unclaimed row's `branch`.
