---
id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: epic                                 # an epic groups stories and bugs, holds intent and requirements for its children, is linted but never gated
status: draft                              # draft | open | archived. Document lifecycle only; work status stays in the tracker
# The epic this ticket belongs to. Grouping is by parent; there is no per-epic folder.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { shortcut: "1234" }
# When true, Ready requires a design reference; the Intent note below says which one this profile expects.
ui: false
# Optional design reference URL. Allowed on epics too.
# design: "https://www.figma.com/..."
# Unconfirmed assumptions block Ready.
# assumptions:
#   - { text: "...", confirmed: false }
---

## Intent
<!-- BA. Why, for whom, how success is measured, and explicit non-goals. About five lines.
Describe observable behaviour in business language; never name tables, endpoints, libraries, or screens.
Terms go in product/glossary.md; rules already decided go in product/business-rules.md.
An epic is never gated; design: may hold the epic-level design link for its child stories. -->

## Requirements
<!-- BA. One EARS line per requirement: WHEN <trigger> the system SHALL <response>, and its siblings. 5 to 15 lines.
Ordering of child stories, when needed, is prose here in v0.1 (ticket dependencies are deferred). -->

## Open questions
<!-- BA. `- [ ]` items; Ready stays blocked while any is unchecked. -->
