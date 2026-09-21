---
phase: 09-publish-and-dogfood
plan: 08
subsystem: dogfood
tags: [dogfood, ticket, ready-gate, measurement, d-159, criterion-2]
status: complete

requires:
  - phase: 09-publish-and-dogfood
    provides: "09-07's scaffold — the ticket is authored through the skill files init wrote, and gated by the published CLI"
provides:
  - "accord/tickets/README-1.md at Ready, ac_hash fnv1a64:565100d5d96d1415, written and gated entirely by @accord-dev/accord@0.1.0"
  - "the D-159 wall-clock figure, recorded with its definition in 09-VERIFICATION.md section 5"
  - "the owner's ruling on ROADMAP criterion 2: option (a), the check goes red and the reason is the finding"
affects: [09-09 which takes this ticket to Done and opens the one pull request, 09-11 whose version sweep the ticket's own plan now names]

actuals:
  tasks: 3
  commits: 0        # held for the owner's diff review
  files_created: 1
  wall_clock_minutes: 6
  ac_hash: "fnv1a64:565100d5d96d1415"

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - accord/tickets/README-1.md
  modified:
    - .planning/phases/09-publish-and-dogfood/09-VERIFICATION.md

key-decisions:
  - "ROADMAP criterion 2 is satisfied by option (a): the pull request's accord check goes red, and the reason it goes red is recorded as the finding. Ruled by the owner on 2026-09-21."
  - "The README's npx line keeps its version number, and a test rather than a person catches it going stale — the rule D-94 already applies between config.yml and the running CLI, applied to the third place the version appears. This was raised as undecided business logic by the readiness review and ruled by the owner, not assumed."
  - "Repo-relative links are rewritten to absolute repository URLs by the generator. 09-03 left this open; the ticket's ## Plan closes it."
---

# 09-08: one real ticket, from nothing to Ready, timed

`accord/tickets/README-1.md` is at Ready with `ac_hash: fnv1a64:565100d5d96d1415`, five tagged
scenarios, `ui: false`, and `accord status` reporting `ready ok`. Everything that touched it was
`npx --yes @accord-dev/accord@0.1.0` — create, lint, gate, status. **Six minutes**, wall-clock,
recorded with its bracketing transcripts in `09-VERIFICATION.md` section 5, which is where the
figure lives and the only place it is interpreted.

## The ruling on ROADMAP criterion 2

The plan opened with a blocking decision, and the owner took **(a)**: open the pull request as D-155
describes, let the `accord` check report a real failure for a real reason, and treat the reason as
the finding rather than the embarrassment.

The reason is structural. `tickStaleCommit` and `staleReview` both compare a value written *inside*
the ticket to `snapshot.git.commit`, which is the checkout's `HEAD`. A file cannot carry the sha of
the commit that contains it, so once the ticks are committed those two rules necessarily fire.
D-162 changed *which* commit is gated, from GitHub's synthetic merge commit to the branch head, and
that is correct and necessary — but the branch head is still a commit the ticket cannot name.

Option (b) would have bought a green check by opening a pull request that touches no ticket file.
It was declined on the project's own stated value: a gate that passes without gating is worse than
no gate (`scaffold.test.ts:230`), and closing the milestone on that would close it on the exact
anti-pattern Phase 7 was built to prevent. Option (c) — binding the tick to the last commit that
changed something outside `accord/tickets/` — is the real fix and is a gate-semantics change this
phase's domain block rules out. It belongs in v0.2, where it can be designed.

Two follow-ups fall out of (a) and are deliberately **not** done here, because they edit the
milestone's own success criteria and belong with the evidence 09-09 produces: reword criterion 2 to
what the pull request can actually demonstrate, and file (c) as a v0.2 requirement.

## FINDING F-4: the readiness review earns its separate context

The review was run as a subagent per D-109's first branch, handed `ready.md` and the ticket id and
nothing else. It filed five questions against criteria the author had just written and believed
were complete. Four were coverage holes that are obvious once stated and were invisible from
inside: a requirement about both pages showing the same text with no scenario putting them side by
side; a requirement with no scenario at all; a scenario that checked the new claim was present
without checking the old contradicting one was gone; and a scenario that read one list when its
requirement said the whole document.

The fifth was the more valuable one, and it was not a coverage hole: *"Naming the released version
pins the description to a number that the next release makes wrong. Should the description naming an
earlier released version fail, and who or what is expected to notice?"* That is undecided business
logic, and the shipped workflow's rule is to record the question rather than resolve it. It went to
the owner and came back as a decision: yes it fails, and a test catches it, not a person — the same
string-equality rule D-94 already applies between `config.yml` and the running CLI, applied to the
third place the version appears. The ticket's `## Plan` now carries it.

This is the step a reader would most plausibly skip as ceremony, and it is the step that produced
the only thing in the ticket nobody would have thought of alone.

## FINDING F-5: a ticket at Ready cannot lint clean, and 09-08's own verify asked it to

`lint` exits 0 with six warnings: the expected `lint.tokens-missing`, plus one
`lint.test-tag-missing` per scenario. That is the shipped template behaving as it documents — a
scenario that is not `@ui` carries a `@test:<id>` tag naming a case id from the test report, and the
template says in as many words to *add it after Ready, it is outside the AC hash*. The test cases do
not exist yet, because the implementation does not.

So this plan's own verify block, which fails when lint reports more than one warning, describes a
state a ticket at Ready cannot be in. Recorded as a finding rather than acted on: inventing five
test ids to satisfy it would be tuning the dogfood until it passes, which the plan's own prohibition
block forbids. The warnings clear in 09-09 when the tests are real.

## Observations

- **The gate was run before the readiness review, which is out of order.** `story.md` puts the
  review at step 5 and the gate at step 6. It passed, writing `ac_hash fnv1a64:22698da82d6828e6`.
  The review then filed its five questions, the gate refused on all five as `lint.open-question`,
  and the second pass wrote `fnv1a64:565100d5d96d1415`. The workflow recovered without help and the
  whole detour is inside the six minutes; the sequence is recorded because a measurement of a
  workflow should say how the workflow was actually run.
- **`ac_hash` covers the acceptance criteria and nothing else, observably.** Trimming `## Intent`
  and correcting a stale `@ac-6` reference in `## Plan` left the hash byte-identical across two
  gate runs. Amending two scenarios moved it. That is the documented behaviour, confirmed by
  accident rather than by a test written to confirm it.
- **`## Plan` is filled at Ready, and the BA skill says it is not the BA's.** `lint.plan-empty`
  warns when a ticket has scenarios and an empty plan, but `SKILL.md`'s Boundaries section assigns
  `## Plan` to the stage that implements. A solo author passes through both stages and never feels
  it; two people would meet a warning one of them is told not to clear. Not acted on — it is a
  tension between shipped text and a shipped rule, and naming it is this plan's job, not resolving
  it.
- **The ticket named no other tool, harness, or planning system**, and neither will the README text
  it specifies. The constraint was live throughout because the subject is shipped prose.

## Self-Check

| Must-have | Verdict |
|---|---|
| One real ticket, created by the published CLI, `gate ready` PASS | PASS — exit 0, `ready ok` in `accord status` |
| Scope is D-156's five items, not a vague modernisation | PASS — five scenarios, one per item |
| `ac_hash` recorded in frontmatter | PASS — exactly one line, `fnv1a64:565100d5d96d1415` |
| Wall-clock from `new ticket` to the passing gate, recorded | PASS — 6 minutes, both transcripts, section 5 |
| The criterion-2 ruling is on the record | PASS — option (a), above |
| Nothing relaxed to obtain the PASS | PASS — no file under `gate/`, `lint/` or `templates/` modified |

Three `pending` rows remain in `09-VERIFICATION.md`, down from four: two for 09-09 and one for
09-10.
