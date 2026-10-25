---
id: "REFS-1"                            # equals the file name: tickets/<id>.md
title: "Gate done reads dot-led paths and line ranges in citations"
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
approved_hash: "fnv1a64:714b1316f3c21b76"
ac_hash: "fnv1a64:255ab926f9a5859c"
verified_hash: "fnv1a64:255ab926f9a5859c"
verified_commit: "835b72ce9a4f4293914b575d5df50ed03cd5bea1"
verified:
  - "ac-1"
  - "ac-2"
  - "ac-3"
  - "ac-4"
  - "ac-5"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
`gate done` trims a leading `.` from each citation and keeps a `:n-m` line range, so the verifier's ordinary
citations (`.claude/x.md`, `./x.md`, `path:12-14`) name nothing and the gate warns or fails (dogfood item 27).
For the owner and the verifier at the verify stage. Done when such citations resolve, a `../` citation is still
reported as written, and the verifier states how to cite. Not: `path#L12` forms, a root dotfile without `/` or
a known extension, the `docs/design.md` "path or symbol" sentence.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: REFS-1

  @ac-1 @test:packages/core/test/gate.test.ts#ac-1-a-citation-under-a-dot-led-directory-resolves
  Scenario: a citation under a dot-led directory resolves
    Given the snapshot tree holds .claude/skills/x.md
    And a verification.md evidence block whose only citation is `.claude/skills/x.md`, in backticks
    When gate done runs for that ticket
    Then the result carries neither gate.evidence-unresolved nor gate.reference-unknown for that block

  @ac-2 @test:packages/core/test/gate.test.ts#ac-2-a-citation-starting-with-dot-slash-resolves
  Scenario: a citation starting with ./ resolves
    Given the snapshot tree holds docs/x.md
    And a verification.md evidence block whose only citation is ./docs/x.md, a bare token in prose
    When gate done runs for that ticket
    Then the result carries neither gate.evidence-unresolved nor gate.reference-unknown for that block

  @ac-3 @test:packages/core/test/gate.test.ts#ac-3-a-citation-with-a-line-range-resolves
  Scenario: a citation with a line range resolves
    Given the snapshot tree holds packages/core/src/x.ts
    And a verification.md evidence block whose only citation is packages/core/src/x.ts:12-14, a bare token in prose
    When gate done runs for that ticket
    Then the result carries neither gate.evidence-unresolved nor gate.reference-unknown for that block
    And no line count of packages/core/src/x.ts is read

  @ac-4 @test:packages/core/test/gate.test.ts#ac-4-a-parent-directory-citation-is-reported-as-written
  Scenario: a citation starting with ../ is still reported, as written
    Given the snapshot tree holds docs/x.md and no path outside the repository
    And a verification.md evidence block citing docs/x.md and ../x.md, both bare tokens in prose
    When gate done runs for that ticket
    Then the result carries exactly one gate.reference-unknown warning for that block, and its message holds "../x.md"
    And no gate.evidence-unresolved error for that block

  @ac-5 @test:packages/core/test/agents.test.ts#ac-5-the-verifier-states-how-to-cite-a-file
  Scenario: the verifier states how to cite a file
    Given one rendered output of the verifier agent
    When a reader looks for the rule on citing a file
    Then it holds the sentence "Cite a file by its path from the repository root, with `:n` or `:n-m` after it for a line or a range of lines." verbatim
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
(none)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Three parts: the citation reader stops trimming a leading `.` (a trailing one still goes); it removes a `:n-m` line range as it removes `:n` and `:n:m`; the verifier holds a rule on citing a file. Not: `path#L12` forms, which collide with `file#name` test ids; the `docs/design.md:111` sentence, fixed in the docs PR — "Right (Recommended)"
- D-02 A `../x` citation is still reported, because the tree is repo-relative and a file outside the repository is not evidence; the finding names it as written, `../x.md`, not `/x.md` — "Still report it (Recommended)"
- D-03 The verifier holds one fixed sentence, checked verbatim by a test over the rendered agent — "Fixed sentence, test the render (Recommended)"
- D-04 The smallest version is all three parts — "All three parts (Recommended)"
- D-05 (audit) ac-1 cites in backticks, ac-2 to ac-4 as bare tokens in prose; the reader already treats both alike, so each form is held by one criterion — "Agree to all 4 (Recommended)"
- D-06 (audit) A `:n-m` citation resolves when its file is in the tree, whatever the file's length; core holds no source text (D-84), and `:n-m` goes as `:n` goes (D-01) — "Agree to all 4 (Recommended)"
- D-07 (audit) ac-4 yields exactly one `gate.reference-unknown` warning for the block, its message holding `"../x.md"`, none for `docs/x.md`; ac-5 reads one render of the verifier, because every runtime renders from the same source — "Agree to all 4 (Recommended)"
- D-08 (approach critic) D-01 narrowed: a leading `.` is kept only where it starts a path — `./x`, `../x`, or a dot-name such as `.claude/x` or `.eslintrc.json`; a token that is only `.` plus a known extension (`.md`, `.ts`) and a run of dots before a path (`...packages/x.ts`) are read as today, so neither raises a new warning nor stops resolving — "Only when it starts a path (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: edit `token()` in place, keeping a leading dot only where it starts a path.** The end trim is
unchanged, so a trailing `.` still goes. At the start, `token()` trims every PUNCT character but `.`, then reads
the leading dot run: it keeps a run of one or two dots followed by `/` or `\`, and a single dot followed by a
character that is neither PUNCT nor `.`, `/`, `\` (`.claude/x`, `.eslintrc.json`); any other run is stripped and
the start trim continues past it, as today (D-08). A token that is exactly `.` plus an EXT entry is not a
candidate. `POSITION` becomes `/:\d+(?:[:-]\d+)?$/` (D-01, D-06). `normaliseKey` already strips `./`; `../x`
and `..\x` stay unresolved and are named as written (D-02). The note rules share `token()`, so notes gain the
same reading (D-82). The verifier gains the D-03 sentence.
**Rejected:** never trimming a leading dot (D-01 literally): every `.md` word in a verifier's prose would warn,
and `...packages/x.ts` would stop resolving (D-08).
**Affected:** `packages/core/src/gate/refs.ts` only, among sources; `packages/core/agents/verifier.md`; the
generated agents and the installed verifier, in the order `npm run gen`, `npm run build`,
`node packages/cli/dist/cli.js skills sync`; the committed installed verifier is checked to hold the sentence.
**Risks (critic):** Should, kept and fixed above: a quote or backtick after a dot (`."packages/x.ts"`) would
have stopped resolving, and `..\x.md` would have been named `\x.md`. Should: a stale dist leaves the installed
verifier without the sentence while ac-5 passes, so the order above is fixed. New, intended: a note that passed
`gate.note-pasted` only because a `.claude/` or `:n-m` token stayed unresolved now fails it.
**Tests:** ac-1..ac-4 in `packages/core/test/gate.test.ts` through the in-memory verification helper with an
extended tree, ac-3 citing `:9000-9001`; risk tests in `packages/core/test/refs.test.ts` for `.md` in prose,
`...packages/x.ts`, `."packages/x.ts"` and `..\x.md`; ac-5 one test over the rendered verifier agent.
