# Business rules

<!-- BA. Rules, thresholds, tolerances, rounding, and edge cases already decided; one rule per bullet.
When a story depends on a rule, the ticket cites it instead of restating it. At handover, epic requirements are folded in here.
When a rule was chosen over an alternative, a `Rejected: <option> — <reason>` line goes directly beneath it, so the next reader finds the argument instead of re-proposing the option that lost. -->

- A password is at least ten characters long; nothing else about its contents is required
  - Rejected: a mixed-character rule — it pushes people towards shorter passwords they write down
- Two email addresses that differ only in letter case are the same address
- One email address holds at most one account, and a second attempt never replaces the first
