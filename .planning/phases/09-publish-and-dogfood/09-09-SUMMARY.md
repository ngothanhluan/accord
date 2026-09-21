---
phase: 09-publish-and-dogfood
plan: 09
subsystem: dogfood
tags: [dogfood, readme, done-gate, fresh-context-review, pull-request, d-155, d-158]
status: complete-with-findings

requires:
  - phase: 09-publish-and-dogfood
    provides: "09-08's README-1 at Ready, and the criterion-2 ruling this plan's pull request was opened under"
provides:
  - "the rewritten README, and packages/cli/README.md carrying links that resolve off the repository's origin"
  - "accord/tickets/README-1/verification.md, written by a context that did not write the change (D-158)"
  - "pull request 1, the one D-155 allows, and the live evidence of what the generated workflow does"
  - "FINDING F-6: npx --yes <pkg>@<version> runs the workspace, not the registry, when the two match"
  - "the four separate reasons a documentation ticket cannot pass the Done gate as shipped"
affects: [09-11 which publishes 0.1.1 and thereby makes @ac-1 true, and which owns the merge]

actuals:
  tasks: 4
  commits: 8
  files_created: 2
  pull_requests: 1
  ac_hash: "fnv1a64:565100d5d96d1415"
  verified: "[ac-2, ac-3, ac-4, ac-5]"
  gate_done: fail

tech-stack:
  added: []
  patterns:
    - "a generator test that runs the generator into a throwaway file and compares bytes, rather than re-deriving its rules in the test"

key-files:
  created:
    - accord/tickets/README-1/verification.md
    - .planning/phases/09-publish-and-dogfood/09-09-SUMMARY.md
  modified:
    - README.md
    - packages/cli/README.md
    - packages/cli/scripts/gen-readme.mjs
    - packages/cli/test/readme.test.ts
    - accord/tickets/README-1.md
    - .planning/phases/09-publish-and-dogfood/09-VERIFICATION.md

key-decisions:
  - "The ticket does not reach Done in this plan and is not made to. Ruled by the owner on 2026-09-21 after the four blocking reasons were presented: record them, open the pull request, and let Done land after 09-11 publishes 0.1.1."
  - "@ac-1 is not ticked. Its Given is a reader on the registry, and the registry cannot show this text until the next release."
  - "The review's finding was fixed as new work in its own commit, which is what makes verification.md one commit stale. That was preferred to leaving a known defect in the release, and the staleness is recorded rather than hidden."
  - "The duplicated version was removed rather than matched by a wider pattern: the Released line now carries the same package@version string the run instruction does, so there is nowhere for the two to drift."
---

# 09-09: the README, the review, and what the pull request actually showed

Eight commits on `readme-1`, one per plan step plus the plan review, the review finding's fix, and the
ticks. `npm run check` green, 902 tests. Pull request 1 is open and **not merged**; merging is 09-11's,
under a blocking checkpoint, as this plan requires.

The README says what shipped. The `npx` line runs. The one link resolves from the registry's origin.
And the exercise found three things nobody had written down, which is what it was for.

## FINDING F-6: the generated workflow never ran the gate, and the reason invalidates a prior claim

`accord`'s check on the pull request is **failure**, but not for the predicted reason. It failed in
1.6 seconds with `sh: 1: accord: not found`, twice, before deriving a single ticket id.

`npx --yes @accord-dev/accord@0.1.0` resolves the spec against the workspace tree. This repository
declares a workspace named `@accord-dev/accord` at version `0.1.0`, so npm decides the spec is already
satisfied locally, declines to fetch, and runs a bin link that a checkout without an install does not
have. Reproduced in isolation from two manifests and no `node_modules`; a version the workspace does
not hold (`@0.0.0`) fetches normally in the same directory, so this is npm honouring the spec, not
ignoring it.

Only this repository can hit it. It is also the only repository the author was ever going to try
first.

The part worth more than the fix: **the same resolution means 09-07's and 09-08's `npx --yes` runs used
the local build, because `node_modules/.bin/accord` exists here.** Both summaries claim otherwise in as
many words. The results stand — the local `dist/cli.js` and the published tarball's are byte-identical,
`sha256 6f38f978...deb9e3` — so what was lost is the provenance the claim asserted, not the behaviour
it reported. Correction notes are appended to both summaries rather than edited into their prose.

Section 3 of `09-VERIFICATION.md` carries the run, the log and the reproduction.

## The Done gate cannot be passed by a documentation ticket, and that is a design finding

Four reasons, kept apart because they are four different problems. Two are this ticket's honest state:
`@ac-1` is false until 0.1.1 reaches the registry, and the ticks go stale on the commit that carries
them. The other two are about the product:

**The machine layer has never been configured in this repository.** `accord/config.yml` declares no
`tests.report`, and D-80 makes that a hard fail with no bypass. accord has been gating its own work
with a third of its own gate switched off, and nothing said so until a ticket tried to reach Done.

**Three of five scenarios have no `@test:<id>` to name, because no test can hold them.** GATE-08 gives
a scenario two options: name a test id, or be `@ui`. `@ac-2` is a claim about how a paragraph reads,
`@ac-4` is a claim about what a page does not say, and `@ac-5` is a person running a command. None is a
user interface. The shipped escape hatch would be a lie, and adding tags to buy the pass would move
`ac_hash` and drop the ticket back to Ready — the gate refuses the shortcut twice over, which is the
design working, but it leaves a whole class of true ticket with no way through.

Both recorded, neither acted on: the domain block rules out gate-semantics changes in this phase.

## What the shipped workflow itself was like to use

- **The plan review is not ceremony, twice over.** In 09-08 it found four coverage holes in criteria
  their author believed complete. Here it found that the sweep scenario was tagged to a step that ran
  before the text it was meant to sweep existed, and that a scenario reading "the tool runs" was being
  satisfied by comparing two strings with nothing ever executed. Both were invisible from inside.
- **The code review found the defect the author was closest to.** The version was written twice; the
  check saw one copy. The failure it described was specific: bump to 0.1.1, go red on the npx line, fix
  that line, ship green with the page announcing one version above a command running another — on the
  very release that finally carries the text to registry readers. Fixed as new work, per the rule that
  the reviewing context reports and does not repair.
- **`gate done`'s reasons are usable.** Two of the first eleven were the author's own formatting
  mistakes — notes written as bullets rather than `### @ac-n` blocks, and a note naming no real path.
  Both were named precisely enough to fix in one pass without reading the source.
- **`## Plan` belongs to the implementing stage and was filled at Ready.** Noted in 09-08, unchanged
  here: the plan review edited a section the BA skill's Boundaries says is not the BA's.

## Self-Check

| Must-have | Verdict |
|---|---|
| The four D-156 defects are gone and an install section exists | PASS |
| `packages/cli/README.md` regenerates with no drift | PASS — the drift test now runs the generator |
| `verification.md` written by a context that did not write the change | PASS — subagent, D-158 |
| One commit per plan step, not squashed | PASS — five, plus review, fix and ticks |
| Exactly one pull request | PASS — pull request 1, not merged |
| `gate done` PASS | **FAIL — four reasons, all recorded, nothing relaxed to change the answer** |
| Nothing amended or force-pushed to turn a gate green | PASS |

One `pending` row remains in `09-VERIFICATION.md`: section 6, 09-10's token measurement.
