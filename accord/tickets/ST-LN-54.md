---
id: "ST-LN-54"                            # equals the file name: tickets/<id>.md
title: "Finished-ticket report opens with a verdict and next steps"
type: "story" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
ac_hash: "fnv1a64:f4d8ddaf37d6d180"
---

## Understood
When a ticket finishes (accord-verify step 7, lane S step 6), the report opens with one verdict line "✅ <id> DONE — PR #<n> ready, waiting for your merge", then at most 3-4 status lines, then "Next:" with 1-3 concrete suggestions taken from `accord dashboard`, the first marked recommended; the PR is never merged by the agent and the line never claims a merge.

## Done when
The verify skill and lane-s.md source files state that report shape, `accord skills sync` has re-rendered every copy, and the skills tests pass.

## Corrections

- "vậy tại sao ko thấy link PR?" (why is there no PR link?) — the verdict line must carry the pull request link.
