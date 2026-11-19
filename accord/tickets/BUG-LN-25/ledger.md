# Ledger: BUG-LN-25

## Rulings
- Ruling: the approach ladder is 1. Exact-path exempt list read per package: core skips content patterns only for an optional list of exact exempt paths, and the CLI builds that list per package by comparing each changed rendered copy's head text with the render; 2. Batched copy read: the same, but gate done reads every round's copy texts in one batch before scanning; Exact-path exempt list read per package is Recommended because it meets every criterion and Decision with the least new code, while the batch saves at most one git process per round and its extra pass adds a way to read a path at the wrong round's head — kept so a resumed or revised round critiques the option ## Approach names and nobody picks again — a ruled-out option comes back
- Ruling: no release-notes entry in this ticket — no criterion asks for one — one bullet is added later
- Ruling: `agent-config` goes before `security-config` in the template — the order is cosmetic — the id lists in the security tests are reordered

## Deferred
- approach 1.1: place the copy read inside the `try` of `securitySections` (review-package, diff-package) so a read failure prints `(cannot tell: …)` — failing case: `git cat-file` fails while reading copies at HEAD and `accord review-package <id>` exits 2 with no package
- approach 1.2: reuse the rendered list gate done already builds for the branch fact, or render only when a round changed a copy — failing case: `accord round <id>` on a ticket whose rounds never touch a copy still renders every skill, agent and plugin file
