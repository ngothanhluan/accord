# Ledger: BUG-LN-25

## Rulings
- Ruling: the approach ladder is 1. Exact-path exempt list read per package: core skips content patterns only for an optional list of exact exempt paths, and the CLI builds that list per package by comparing each changed rendered copy's head text with the render; 2. Batched copy read: the same, but gate done reads every round's copy texts in one batch before scanning; Exact-path exempt list read per package is Recommended because it meets every criterion and Decision with the least new code, while the batch saves at most one git process per round and its extra pass adds a way to read a path at the wrong round's head — kept so a resumed or revised round critiques the option ## Approach names and nobody picks again — a ruled-out option comes back
- Ruling: no release-notes entry in this ticket — no criterion asks for one — one bullet is added later
- Ruling: `agent-config` goes before `security-config` in the template — the order is cosmetic — the id lists in the security tests are reordered
- Ruling: the existing test titled "seven patterns" keeps its name and only its body changes — the title is its report id — a misleading test name until renamed
- Ruling: copies are looked up only when a changed path starts with `.claude/` or `.agents/`, and exemption is still decided by exact path — it avoids rendering every copy on rounds that touch none (approach 1.2) — a sync root outside those folders would be scanned, never wrongly exempt
- Ruling: the baseline tests are CI run 44471586361 (success) on 7056161f, whose product code equals the plan baseline (only `accord/` changed since), instead of a local tests.full — the owner prefers CI over a 30-minute local full run — a failure that shows only on this machine is found later, at verify's full run
- Ruling: the ac-1 fixture is built in the test body, not by `claimed` — `run(['skills','sync'])` is async and `claimed` has sync callers — a few duplicated fixture lines
- Ruling: the CLI passes no `exempt` until task 2, so every copy is scanned in between — as the brief orders — none
- Ruling: `factsFor` memoises the rendered-files getter, so the render runs at most once per command across rounds — as the brief says — one extra closure
- Ruling: the ac-3 test checks that `.claude/settings.json` is untouched with an allow-list over `git diff --name-only base head` — as the brief orders — none

## Deferred
- approach 1.1: place the copy read inside the `try` of `securitySections` (review-package, diff-package) so a read failure prints `(cannot tell: …)` — failing case: `git cat-file` fails while reading copies at HEAD and `accord review-package <id>` exits 2 with no package
- approach 1.2: reuse the rendered list gate done already builds for the branch fact, or render only when a round changed a copy — failing case: `accord round <id>` on a ticket whose rounds never touch a copy still renders every skill, agent and plugin file

## Tasks
- task 1 done a1ed5334216d
- task 2 done 5b6f70fbd3d8
