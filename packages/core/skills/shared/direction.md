---
kind: reference
---

# A visual direction when the project has none

The built-in default of the visual options in `./approach-ui.md`, used when `ui.direction` names no skill. The designer role loads it too.

## 1. Find what the project already has

Do what step 1 of `./prototype.md` says: read the stylesheet or variables file the application loads, the utility-class
configuration, the components folder. The colours, type and spacing you find are what every direction spends.

## 2. Draft two or three directions

Two or three directions that differ in palette, type and spacing, not in layout alone. Each is derived from what the project already
has: a direction picks and weighs the project's own colours, type scale and spacing differently (a quiet accent or a bold one, a dense
rhythm or a loose one). When step 1 found nothing, a direction may be new, and its `Derived from:` line says so.

## 3. One HTML file each

One HTML file per direction, no build step and no assets folder. It loads nothing from outside: no remote script, stylesheet, font or
image, because the owner opens it from a disk or a branch. A comment block at the top names the ticket, the direction and a
`Derived from:` line. Describe each direction in one line for the owner: palette, type, spacing.
