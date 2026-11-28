---
on_finding: block
---

- States of each screen: every screen the change adds or touches shows its empty, loading and error states, content that overflows (a long text, many rows) and a narrow width; a failing case is a screen that renders blank, shifts, clips or scrolls sideways in one of them
- Keyboard and focus: every action works with the keyboard alone, the focus order follows the reading order, the focus is always visible and never lost or trapped when a view opens or closes; a failing case is a control only a pointer reaches, or a dialog that leaves the focus behind it
- Contrast and labels: text and controls keep readable contrast in every state, and every control, field and image has a label a screen reader reads; a failing case is a placeholder standing in for a label, an icon-only control with no name, or a state shown by colour alone
- The project's own components and tokens before new ones: the change reuses the components, colours, spacing and type the project already has; a failing case is a new component or a hard-coded value beside an existing one that does the same
- Fidelity to the design reference: each screen matches the design reference the ticket names in layout, spacing, type and states; a failing case is a screen that differs from the reference with no reason written in the ticket
