---
title: Rejected alternatives have no home in the accord folder
date: 2026-09-14
priority: medium
after_phase: 5
---

A ticket records the decision and never what was rejected. A BA who weighed three approaches leaves one EARS line and a scenario; nothing says "X was considered and rejected because Y". The next session, the next agent, or the next person re-proposes X, and no gate objects — which is the context-loss failure `docs/design.md` §1 cites the 20,574-session study to justify the whole product against.

What already exists, and where it stops:

- `product/business-rules.md` — "rules, thresholds, rounding, edge cases already decided". A home for the rule that won, not for the option that lost.
- `assumptions[].confirmed: true` — records that something was confirmed, not what was weighed against it.
- `## Open questions` — holds questions still open; a resolved item is ticked and its reasoning evaporates.

Constraint on any fix: ROADMAP Phase 6 criterion 6 requires that "no session or handoff file exists anywhere", and `docs/design.md` §2 caps size ("If the spec is longer than the code, the spec is wrong"). So a new artifact is out. Two candidates that reuse a place that already exists:

1. A `Rejected:` line convention in `product/business-rules.md`, next to the rule it explains. Costs nothing structurally; lintable as prose only.
2. Widen `assumptions[]` to `{ text, confirmed, instead_of? }`. Schema change under `additionalProperties: false`, so it touches `ticket.schema.json`, the templates, and Phase 1–2 fixtures and goldens.

Open question either way: is this BA-only, or does a developer's rejected implementation approach belong in `## Plan` the same way? Decide before choosing a shape.

Raised while discussing Phase 4 on 2026-09-14, after contrasting accord's deliberate no-session-file design with the discussion log the planning workflow keeps. Belongs to Phase 6 (skills) or a format change, not to Phase 4.
