---
id: "BUG-LN-3"                            # equals the file name: tickets/<id>.md
title: "A pull request that adds draft tickets to the backlog can pass the accord check"
type: "bug" # story | bug. An epic uses its own template
status: draft                             # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
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
approved_hash: "fnv1a64:89771291e28defe5"
ac_hash: "fnv1a64:6d23ac3ae5200d11"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
On 2026-10-17 PR #28, which adds only draft tickets ST-LN-8..15, failed the accord check: the workflow `accord init` writes runs `accord gate done` on every ticket file a pull request touches, so a backlog cannot land on the default branch, and dropping a ticket the way the ids rules say ("commit and merge that") fails the same way.
For a team where one person files the backlog and another picks it up, and for anyone dropping a ticket.
Success: PR #28 passes the accord check and merges; a pull request that carries code still gates every ticket it touches.
Not in scope: `gate done` and `gate ready` rules themselves, gating pull requests that touch no ticket file, the CI test matrix.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-3

  # "Approved" below means the ticket's parsed frontmatter has an `approved_hash` key, in the pull request's
  # version or in the base commit's version of the file; a commented `# approved_hash:` line is not a key.
  # "Dropped" means `status: dropped` in the pull request's version, with a `## Dropped` section `accord lint` accepts.

  @ac-1 @test:packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-unapproved-tickets-in-an-accord-only-diff:-lint-runs-and-no-gate-done-runs-and-the-exit-follows-lint
  Scenario: A pull request that adds or edits only unapproved tickets passes without gate done
    Given a pull request whose diff changes only files under `accord/`
    And no ticket file `accord/tickets/<id>.md` it adds or changes is approved, in its own version or in the base commit's
    When the lint-and-gate script of the workflow `accord init` writes runs on it
    Then `accord gate done` runs on none of those tickets, `accord lint` runs, and the script exits 0 when lint has no error
    And the script exits 1 when lint reports an error

  @ac-2
  Scenario: A pull request that drops a ticket, or edits a dropped one, passes without gate done
    Given a pull request whose diff changes only files under `accord/`
    And it changes ticket X, which is dropped in the pull request's version, approved or not
    When the lint-and-gate script runs on it
    Then `accord gate done` does not run on X, and the script exits 0 when lint has no error
    And when X's `## Dropped` section is missing or empty, lint reports an error and the script exits 1

  @ac-3
  Scenario: A pull request that carries code, or touches an approved ticket, still gates it
    Given a pull request that changes ticket X
    And either its diff changes any file outside `accord/`, whatever X says, or its diff changes only files under `accord/` while X is approved in its own version or in the base commit's and is not dropped
    When the lint-and-gate script runs on it
    Then it runs `accord gate done X`, and exits 1 when that gate fails
    And removing `approved_hash` from X in the pull request does not stop `accord gate done X` from running when the base commit's X has it

  @ac-4
  Scenario: This repository's workflow gates by the same rule as the one `accord init` writes
    Given the workflow `accord init` writes and this repository's `.github/workflows/accord.yml`
    When the cases of @ac-1, @ac-2 and @ac-3 run against the lint-and-gate script of each
    Then in every case both scripts run `accord gate done` on the same tickets and exit with the same code
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 All four parts are in scope and none is cut: unapproved tickets pass, dropped tickets pass, a pull request with code still gates every ticket it touches, and the workflow `accord init` writes applies the same rule as this repository's — "Làm tiếp, đủ cả 4 phần (Recommended)", then "Đủ cả 4 phần, không cắt (Recommended)"
- D-02 `gate done` is skipped for a ticket only when it is unapproved (no `approved_hash`) or dropped with a reason, and the pull request changes nothing outside `accord/`; a pull request with code gates every ticket it touches whatever the ticket says — "Ticket nháp/đã bỏ VÀ PR không có code (Recommended)"
- D-03 A ticket counts as approved when `approved_hash` is in its frontmatter in the pull request's version or in the base commit's version, so deleting the key cannot skip the gate — "Có dấu ở main HOẶC trong PR thì kiểm (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: the rule in the lint-and-gate bash script, in both workflows.** Before the loop, the script in `packages/core/src/scaffold/workflow.ts` sets a code flag from `git -c core.quotePath=false diff --name-only --no-renames "$BASE"...HEAD` minus paths under `accord/` (deletions count as code). Per ticket, a helper prints the frontmatter of the file at BASE and at HEAD (`git show`), held in a variable and grepped through a here-string, never a pipeline. Approved: a non-comment line matching `^[[:space:]]*['"]?approved_hash['"]?[[:space:]]*:` in either version. Dropped: `status` equal to `dropped` in HEAD, matched with POSIX classes that absorb spaces, tabs, quotes, a trailing comment and a stray CR. A ticket is skipped, with a one-line reason printed below the no-ticket echo, only when the diff has no code and the ticket is unapproved or dropped. Every read the script cannot settle (a version present but no `---` block found, a `git show` error other than a missing path) counts as approved, so it fails closed. No backslash in the emitted script (scaffold.test.ts:37); lint still runs first and enforces the `## Dropped` reason. The same script goes into `.github/workflows/accord.yml`, differing only in the pin.
Why: it meets every criterion without a new public interface or any change to core or CLI TypeScript beyond the generator's template.
Rejected: (2) a pure core rule behind a new command such as `accord gate pr <base>` — exact YAML parsing and @ac-4 by construction, but a new public interface, a loader extension and most of the tests rewritten; held in reserve if the grep reading proves too fragile. A `gate done --base` flag — changes `gate done`, which Intent puts out of scope.
Affected: workflow.ts (script and header comment), .github/workflows/accord.yml, packages/cli/test/workflow-script.test.ts (fixtures with frontmatter at BASE and HEAD; existing cases at :193-248 get a code file or an approved base so they still gate), packages/core/test/scaffold.test.ts shape checks stay true.
Risks (critic, no Must):
- Should: a second frontmatter reader in grep beside the yaml parser; a BOM or CRLF base file whose `---` is missed would read as unapproved and skip the gate (D-03). Answer: bracket classes, no `^` on line 1, and no block found counts as approved.
- Should: `grep -q` in a pipeline under `pipefail` returns 141 on a large file and reads as unapproved. Answer: variable plus here-string, as the loop already does.
- Should: a strict `dropped` regex misses `status: dropped ` and similar, so a valid drop is gated and fails. Answer: the looser POSIX-class pattern above.
- Should: wrapping existing cases in `describe.each` renames test ids out of the baseline and fails `gate.test-untraced`. Answer: existing titles stay; one new test per @ac-1..3 on the generated script; one @ac-4 test runs those fixtures through both scripts, lifting this repository's by the step name `lint and gate`.
- Nice: PR #28 needs a fresh push or branch update after this merges; re-running its old job reuses the old workflow.
- Repositories already initialised keep the old script, since `init` skips an existing file; outside this ticket.
Tests: all four criteria at the script layer in workflow-script.test.ts, running bash on temporary git repositories with a stub `accord`; one real-CLI case stays.
