---
id: "BUG-LN-22"                            # equals the file name: tickets/<id>.md
title: "The approach record's risk slot refuses sentences, its documented fix drops the risk, and approval.md and the corpus miss cases"
type: "bug" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: four findings across the record parser, a skill, the release note and the corpus
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-91"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
---

## Understood
Queued 2026-11-13, not yet worked. These are the four Warnings of the round-7 code review of PR #172 (ST-LN-91, phase 3 group 1). By the owner's decision of 2026-11-13, only Critical findings were fixed after round 7, and Warnings go to a bug ticket. The code they name lands with ST-LN-91, so this waits on it.

1. **Sentences in a risk slot are refused.** `kindLike` in packages/core/src/round/record.ts reads only the first word or two of a `risk:` or `rests on: risk:` slot. A slot value that is a sentence starting with a kind, for example `— risk: security is unaffected by this change — fixed`, is therefore a record problem, and `accord approve` exits 1. The same happens to a column-0 prose line `Risk: security was reviewed …` directly under a finding, and in a plan record it refuses `round --plan`. The release note calls such a value prose. The likely fix is to treat a slot as kind-like only when its value is the kind words alone, give or take markup and punctuation.
2. **The documented fix for a misplaced risk line drops the risk.** docs/releases.md says to indent a column-0 `risk: security` line under a finding, or to leave a blank line before it. Either way `approve` then exits 0, and the Must is listed only as an ordinary risk. A deeper `rests on: risk: security` after a lazy note and a blank line is read as prose, although CommonMark renders it on the finding. Fix the note so it says to rewrite the line as ` — risk: security` on the finding line, or as an indented `rests on: risk: security`. Read that deeper line as the finding's block, or make it a record problem. Word the problem as a misplaced mark, not an unreadable one.
3. **approval.md step 2 says the short view never lists a Nice.** For a ticket claimed under 0.4.0, `show --approval --short` does list an open risk-marked Nice under `## Risks` (next.ts `approvalFindings`). Add that case to step 2.
4. **Corpus gaps.**
   - Round 6's PL2 (three plan rounds, `risks: security`, record at 0.4.1) is missing from packages/core/test/helpers/approach-corpus.ts, and `PlanRow` cannot state the `gate plan` (`gate.plan-rounds`) outcome.
   - The legacy rows say "byte comparison against origin/main", but no test compares anything; relabel them.

Source: .planning/phases/03-discuss-stage/03-group1-REVIEW7.md (WR-01..WR-04), with the failing cases in its probe outputs.

## Done when
- A fixed or open finding whose `risk:` slot is a sentence starting with a kind, or a column-0 prose sentence starting `Risk: security …` under it, is not a record problem. A slot holding only a mis-written kind still is.
- Following the release note's own fix for a misplaced `risk: security` line keeps the finding blocking.
- approval.md step 2 matches what the short view lists for a ticket claimed before 0.4.1.
- The corpus holds PL2 with its `gate plan` outcome, and no legacy row claims a comparison that no test makes.
- Each item is proven by a test that fails before its fix.

## Decisions

## Corrections

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/core/src/round/record.ts
packages/core/skills/approach/approval.md
docs/releases.md
packages/core/test/helpers/approach-corpus.ts
packages/core/test/approach-record-corpus.test.ts
