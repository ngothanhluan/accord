# Business rules

<!-- BA. Rules, thresholds, tolerances, rounding, and edge cases already decided; one rule per bullet.
When a story depends on a rule, the ticket cites it instead of restating it. At handover, epic requirements are folded in here.
When a rule was chosen over an alternative, a `Rejected: <option> — <reason>` line goes directly beneath it, so the next reader finds the argument instead of re-proposing the option that lost. -->

- A day is written as year, month and day separated by hyphens, everywhere the product shows or exports one
  - Rejected: the reader's local format — a file leaves the product and is read in another timezone and another country, so the ambiguous formats stop being readable the moment they are shared
- Hours are recorded to two decimal places and are never rounded again on the way out of the product
- A field a person typed is wrapped in double quotes when it holds a comma, a double quote, or a line break, and a double quote inside it is written twice
  - Rejected: stripping the character instead — the export is used to reconcile against a source system, so a silently altered name reads as a different person
- A report covers whole days in the workspace's own timezone; a member with no hours on a day has no line for that day
