---
id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: story                                # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: R                                    # R: a question answered by a research record, with a timebox and a token budget
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
---

## Question
<!-- One line: the question the research answers. -->

## Timebox
<!-- One line: <n> minutes or <n> hours. -->

## Token budget
<!-- One line: <n> weighted tokens; n may end in k or M. -->

## Decisions
<!-- The owner sets the timebox and the token budget; quote the answer: - D-01 Timebox <n> hours, token budget <n> weighted tokens — "<the owner's sentence>" -->

## Vetoes
<!-- Optional: what the owner forbids, in the owner's own words, one item per line. -->

## Corrections
<!-- Optional: every correction the owner makes, verbatim, appended and never edited. -->
