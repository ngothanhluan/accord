---
id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: epic                                 # an epic groups stories; its stories carry the acceptance criteria
status: draft                              # draft | open | archived. Document lifecycle only; work status stays in the tracker
lane: L                                    # L: an epic | P: an epic of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL for the epic's stories.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. They bind every story of the epic. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- The chosen option and why, rejected options and why, and the split into stories with their depends_on order. -->
