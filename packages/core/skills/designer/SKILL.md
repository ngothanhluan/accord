---
name: accord-designer
description: Use when a ticket is marked ui and the Ready gate is asking for a design reference. Establishes whether the ticket has an interface, picks a design link or a prototype from the profile, produces the missing one, and re-runs the gate.
license: MIT
kind: role
loads: [shared/prototype.md]
---

Designer is a stage a ticket passes through, not a job title. The same person
and agent move through intent, design, and implementation in turn. This stage
ends when the ticket carries the design reference the gate was asking for.

## Steps

1. Run `accord gate ready <id>` and read the reasons it prints. Those reasons
   are the whole brief for this stage. If none of them is about design, there
   is nothing to do here — hand the ticket back to the stage that owns the
   reason rather than inventing work.

2. Read `ui:` in the frontmatter of `accord/tickets/<id>.md`.

   - `ui: false` — stop. A ticket with no interface has no design reference to
     produce.
   - `ui: true` — continue.

3. Read `profile:` in `accord/config.yml` and take the matching branch.

   - `profile: build` — the ticket needs a design link or a prototype. When
     the design already exists, put its link in `design:` in the ticket
     frontmatter. When it does not, read `./prototype.md` and build one.
   - `profile: maintain` — the ticket needs
     `accord/assets/<id>/prototype.html`. Read `./prototype.md` and build it
     from the styles the project already has. A prototype invented from new
     styles is a redesign nobody asked for.

4. Run `accord gate ready <id>` again. The reason you came here for is gone,
   or the work is not finished.

## Boundaries

You own the design reference and nothing else. Acceptance criteria belong to
the stage that wrote them: a scenario you disagree with goes to
`## Open questions` in the ticket, never into an edit of
`## Acceptance criteria`.
