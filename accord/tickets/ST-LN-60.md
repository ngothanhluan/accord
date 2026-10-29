---
id: "ST-LN-60"                            # equals the file name: tickets/<id>.md
title: "A teammate's review comments on a ticket's pull request are checked and routed like review findings"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
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
ac_hash: "fnv1a64:be00e3cbcbd18da7"
---

## Understood
No accord skill says what to do with review comments on a ticket's open, unmerged pull request (lane M from verify, lane S from its step 6), so a new reference file, `./comments.md` of the accord skill, named from its `SKILL.md`, gives the one path the agent takes when someone asks it to handle them (D-03): a comment is a review thread, a top-level comment or a review's summary by a person, the owner included (D-05); each is checked against the code and marked holds, does not hold or unclear before any is fixed; questions for the unclear ones are drafted for their threads, shown to the owner and posted on the owner's yes, and nothing is fixed until each is answered in its thread by its author or in the chat by the owner; a comment against a Veto, Decision or Correction stops every comment and goes to the owner, naming it; the ones that hold are classified patch, plan-gap or intent-gap and handled as `accord-review` handles one round's findings, the patch ones fixed together, and the fix takes `./failure.md`'s path after verify (one new review round, then verify again for lane M; the lane S steps for lane S); then one reply per comment (the fixing commit, the reason it was not changed, or the answer taken) is drafted, shown to the owner together, changed as the owner says, and posted only on the owner's yes, nothing being posted to the pull request before it while fix commits are pushed as usual (D-04); no CLI code changes (D-01).

## Done when
The rendered accord skill names `./comments.md`, which states every part of that path as Understood gives it (D-06), a `risk:` test in `packages/core/test/stage-skills.test.ts` asserts each part in the rendered copy, the rendered `SKILL.md` stays within 5120 bytes and 120 lines, and lint and the full suite pass.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/core/skills/accord/comments.md
packages/core/skills/accord/SKILL.md
packages/core/test/stage-skills.test.ts
packages/core/src/generated/skills.ts
.claude/skills/accord/comments.md
.claude/skills/accord/SKILL.md

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Instructions only: the change is skill wording plus the tests that check it; no new CLI gate reads the pull request — "A" (2026-10-29, to: A, instructions only; B, instructions plus a CLI gate; C, defer)
- D-02 The two research gaps with no ticket (worktree.md's output handling moved into the CLI; a skill wording change run against a benchmark baseline) are queued as their own tickets, not folded into this one — "A" (2026-10-29, to: A, split into three tickets; B, fold all three in; C, fold only the baseline rule in)
- D-03 The agent reads a pull request's comments only when someone asks it to (names the comments or pastes a link), never on its own at every Continue — "A" (2026-10-29, to: A, on request; B, checked at every Continue of a ticket with a pull request)
- D-04 The agent drafts the reply for each comment's thread and shows the drafts to the owner; it posts them only after the owner's yes — "A" (2026-10-29, to: A, the agent drafts, the owner approves, then the agent posts; B, the agent posts on its own; C, the agent only drafts and the owner posts)
- D-05 A comment from the owner takes the same steps as a teammate's; it is written under `## Corrections` only when it changes the intent or a criterion and the owner confirms it, and nothing tells the owner's GitHub account apart — "A" (2026-10-29, to: A, the same steps, a Correction only on the owner's confirmation; B, every owner comment is a Correction, which needs the owner's GitHub account in config)
- D-06 The smallest version that counts as done holds all five parts: check each comment against the code; ask about unclear ones before fixing any; send a conflict with a Veto, Decision or Correction to the owner; fix the rest as review findings and review and verify the fix again as `failure.md` says; draft a reply for every thread, posted on the owner's yes — "yes" (2026-10-29, to: the five parts as the smallest version, with the reply to a comment that does not hold offered as the one part that could be cut)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
