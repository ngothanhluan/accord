---
title: Re-aim accord as a solo workflow; three-layer Done gate
date: 2026-09-11
context: exploration
---

# Re-aim accord as a solo workflow; three-layer Done gate

## Decision

accord stays the same product technically and is re-aimed from a **team contract**
to a **personal workflow set** for the author. The technical shell is unchanged:
folder convention, pure core, lint, gates, CLI, rendered skills.

What changes:

| Area | Team contract | Solo | Cost |
|---|---|---|---|
| Roles | BA / designer / dev / QA = four people | four **stages** the author plus agent passes through | workflow definitions kept, context reworded |
| Phase 8 MCP server | lets a non-technical BA work from a chat app | not needed | one phase deferred or dropped |
| Phase 9 dogfood | one real employer ticket, BA over a chat client | author runs it on a real repo | success criteria rewritten |

Phases 1-7 machinery is untouched.

## Why this is cheap right now

Phase 2 (core model and loading) is complete. Phase 3 (Lint) and Phase 4 (Gates)
have not started. Every change below lands in code that has not been written yet.
Deferring past Phase 4 turns this into a rewrite.

## The problem being solved

Stated pain: not knowing a feature's real intent, implementing the wrong thing,
needing tight intent for both BE and FE logic, needing a test plan derived from the
original intent — and the observation that **intent is already almost the test case**.

That observation is accord's founding thesis. EARS requirement = intent.
Gherkin acceptance criteria = test case. Ready gate blocks the start.
Done gate blocks the finish. No separate test plan artifact, by design.

Secondary pain, all addressed by the existing design rather than new work:

- Too many skills to remember — accord ships four skills generated from one
  definition each, versus roughly a hundred across GSD plus OMC.
- Too many artifacts — accord is two files per ticket (`<id>.md`,
  `<id>/verification.md`) versus six per phase under GSD.
- Agents drifting off the rules — `gate done` exits 1 in CI. GSD, OMC and ponytail
  are prompts, which an agent can ignore. An exit code it cannot.

## Weakness in the current Done gate

`gate done` compares three tag sets for equality: scenario `@ac-n` tags, evidence
block tags in `verification.md`, and the `verified:` array — plus `ac_hash` still
matching the value recorded at Ready.

It never asks which test ran. `Evidence:` is free text the agent writes. An agent
can write `Evidence: tested, works fine` and the gate passes. `verified: [ac-1]` is
a bare string array, so a tick leaves no trace that a human understood anything.

`ac_hash` remains the strongest existing control: it defeats an agent editing the
acceptance criteria to match the code it just wrote.

## Three-layer Done gate

| Layer | Author | Defeats | Machine-checkable |
|---|---|---|---|
| 1. Automated test | agent writes, CI runs | "the code works" when it does not | Yes — each non-`@ui` scenario maps to a test id that PASSED in CI |
| 2. Fresh-context review | second agent, clean context | an agent grading its own work | Yes — `verification.md` must map every scenario to a test id plus a code path |
| 3. Human test | the author | code that passes tests but ships the wrong feature, and an author who does not understand it | Partly — see the stated limit below |

Rules settled in this exploration:

- A scenario tagged `@ui` is exempt from the test-id requirement and leans on
  layer 3 with a stricter note. Rationale: brittle end-to-end tests get muted, and
  a muted gate is a decorative gate.
- Every scenario requires a human tick plus one line the author writes themselves
  explaining which logic makes that scenario correct. The tick binds to the AC hash
  and the commit sha; either changing drops the tick and fails the gate.
- Acceptance criteria are drafted by an agent that interviews the author, then
  approved by the author. The hash is recorded only on approval. Ready stays blocked
  while open questions, unconfirmed assumptions, or TODO markers remain.

## Stated limit — do not oversell this

A machine cannot verify comprehension. What the gate can check is that a human
touched the ticket, at the right version, in their own words, per scenario:
a non-empty note, bound to the current AC hash and commit sha. Any claim beyond
that is theatre. The note requirement was chosen over an agent-run viva
(the agent would be grading code it wrote) and over making the author write a test
themselves (heavy enough that it gets skipped by week three).

## Decisions — settled 2026-09-12

All three findings are closed. Each picked the option that reuses machinery accord already
has rather than adding a mechanism, which is also the cheapest option in each case.

### D-A — a scenario binds to its test with a `@test:<id>` tag (FMT-09, GATE-08)

An explicit Gherkin tag, e.g. `@test:auth.spec.ts#rejects-bad-password`. Verified against the
installed `@cucumber/gherkin` 42: that string parses as a single tag, and `ScenarioRef.tags[]`
already keeps tags raw, so the loader needs no change.

Rejected — deriving the test id from the scenario name: scenario names are prose and often
Vietnamese (`'Đăng nhập thành công'` is the example in `model/snapshot.ts`), so slugging is
messy and forcing English names costs the BA-readability the format exists for. Worse, renaming
a scenario breaks the binding silently.

Rejected — matching scenario names against test-runner output: only works under a BDD runner
that reads Gherkin directly (playwright-bdd, Reqnroll, cucumber-js), which would make accord
require a runner choice, against the independence constraint. Viable later as an optional fast
path, never as the requirement.

Chosen because explicit reference is already the idiom: `@ac-n` is an explicit tag, and GATE-04
already requires evidence to reference something present in the snapshot. A fuzzy matcher would
be the only magic in the design.

### D-B — test results enter core as a JUnit XML file in the snapshot (FMT-11)

Core is pure and cannot run tests. `config.yml` gains `tests.report`; the host reads that file
into `SnapshotInput.files`; core joins `@test:` ids against the passed test cases.

JUnit XML because vitest, jest, playwright, pytest and `dotnet test` all emit it, so no runner
is mandated. Reading it needs no XML dependency — a line scan over `<testcase>` with its
`<failure>` / `<skipped>` children, the same precedent as Decision 4 (fence scanner, no
CommonMark parser). A host with no report available reports the check skipped, as GATE-05 does.

### D-C — the human note is checked by reference, not by length (GATE-10)

Two rules, no character floor:

1. The note must reference at least one path or symbol present in the snapshot — the GATE-04
   rule reused, no new concept. It forces the author to open the code and name what they saw,
   which is the only real anti-vibe-coding lever available.
2. The note must not be identical to, or a substring of, the scenario text — a few lines of
   code that block the most likely cheat, pasting the scenario back.

A character-count floor was rejected: the number is arbitrary, it is language-dependent
(Vietnamese and English differ per character), and it induces padding — the failure it creates
is worse than the one it prevents.

Limit restated: nothing catches `works as expected, see src/auth.ts`. No rule can. The rule
raises friction just above mindless; a determined author can still defeat it, but at that point
they are deceiving themselves rather than being deceived by the system.

### D-D — the note lives in a `## Verification notes` body section, not in frontmatter (FMT-10)

One `### @ac-n` block per ticked scenario, in a section placed last in the ticket body, after
`## Plan`.

Decided by YAML fragility. The note is the one field guaranteed to be free-form human prose, and
`note: the rule is: round half even` is a YAML parse error. Decision 2 of the stack already
treats unquoted plain scalars as a first-class hazard; putting the most free-form field into YAML
walks into the trap the project documented for itself.

Three supporting reasons: no Phase 2 rework (`verified: string[]`, `ticket.schema.json` and
`setFrontmatterKey` D-43..D-45 / FMT-08 survive untouched); no new concept (the section scanner
exists and the `acTag` join is what the gate already does across three files); and `## Plan`
already set the precedent for a non-BA-owned section at the end of the body.

Rejected — putting the note in `verification.md`: `design.md` §4 states only the fresh review
context writes that file, and the whole point of the note is that it is the author's.

Limit: nothing stops an agent writing the note. accord is procedural, not tool-enforced, as
`design.md` already admits about the reviewer. The counterweight is the git trail — the
author-mismatch pattern of GATE-05 plus the commit-sha binding of GATE-11. Friction and a
record, not proof.

### Requirement IDs touched

Added to v1: FMT-09, FMT-10, FMT-11, GATE-08, GATE-09, GATE-10, GATE-11.
Fixed: v2 already used GATE-08 and GATE-09 for unrelated items; those were renumbered to
GATE-12 and GATE-13 so v1 stays contiguous. Traceability rows and the coverage count
(57 to 64) were updated with them.

## Deliberately not captured as a separate artifact

Whether `accord init` should **replace** the GSD and OMC skill surface in a repo
rather than stack on top of it. If accord becomes a fourth layer, the
"too many skills" pain gets worse, not better. This is a Phase 6/7 question, not a
Phase 3/4 one, and it only becomes answerable once `accord/` exists — the folder
does not exist in this repo yet, which is also why these notes live under
`.planning/` rather than in accord's own folder.
