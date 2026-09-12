---
name: accord-code-review
description: Use in a fresh context after implementing a change, to review it for defects. Every finding must name a concrete failure scenario; findings without one are deleted, not softened.
---

<!-- Draft copy. Source of truth: docs/skills/code-review.md in this repo.
     Phase 6 turns that source into core data and renders this file with a
     generated marker and hash; until then this copy is maintained by hand and
     can drift. Edit the source, not this file.
     The method below applies to any codebase. The bindings to verification.md
     and ticket acceptance criteria activate once `accord init` has run. -->


A technique, not a role. The fresh review context loads it after writing the
per-scenario blocks of `tickets/<id>/verification.md`, and appends its findings
to the same file under `## Review`.

The reviewer reads the ticket first and the diff second. A review anchored in
the acceptance criteria catches "this ships the wrong feature"; a review that
starts from the diff only ever catches taste.

## Two different questions

Do not merge these. They fail in different directions.

| | Asks | Lands in |
|---|---|---|
| **Verification** | Does it do what the acceptance criteria say? | `## @ac-n` blocks |
| **Review** | Is what it does sound? | `## Review` |

Code can satisfy every scenario and still be wrong — a passing AC says nothing
about the case nobody wrote a scenario for. Code can also be immaculate and
implement the wrong thing. Both questions get asked, separately.

## Who runs it

The context that wrote the code never reviews it. Not because a different model
is better, but because a context cannot fairly audit a decision it does not
remember making. This is procedural — nothing in the CLI enforces it — so the
`dev` workflow states it plainly and opens a new context.

## Scope

Only the diff for this ticket, plus whatever must be read to judge it. Reviewing
untouched code is how a review turns into a refactor.

## The evidence rule

**Every finding names a concrete failure: specific input or state, and the
wrong output, crash, or corruption that follows. A finding without one is
deleted, not softened.**

This single rule is what separates a review from a list of opinions. "This could
be more robust" is not a finding. "`parseAmount('1e3')` returns 1000 because the
YAML core schema coerces it, so a ticket id of `1e3` silently becomes a number"
is a finding.

If a failure scenario cannot be constructed, the finding was a preference.

## What to look for

Ordered by how often it actually bites. Stop when the diff is genuinely covered;
inventing findings to fill the list is its own failure mode.

1. **Wrong behaviour at the edges the scenarios miss.** Empty, zero, one,
   negative, null, absent, duplicate, out-of-order, maximum. The scenarios cover
   the path someone thought about — the bugs live in the ones nobody did.
2. **Business logic invented rather than specified.** A threshold, a rounding
   rule, a tolerance, a retry count, or an edge-case behaviour that appears in
   the code but in neither the requirements nor `product/business-rules.md`.
   This is a finding every time, and it is raised, never quietly accepted: the
   developer decides business logic.
3. **State and lifetime.** Mutation of shared or caller-owned data, a resource
   opened and not closed, an await missing, a race between two callers.
4. **Error paths.** An error swallowed, a failure reported as success, an error
   message that cannot be acted on, an empty catch.
5. **Boundary trust.** Input from a file, a network call, or a user treated as
   already validated. Never simplify away validation at a trust boundary.
6. **Reuse missed.** The diff reimplements something that already exists in this
   repo or in the standard library. Name the existing thing and its path.
7. **The cheaper equivalent.** The same behaviour in materially less code, or a
   dependency added for what a few lines do. Only worth raising when the
   reduction is real, not stylistic.

## What is not a finding

Naming, formatting, and import order — the linter owns those or nobody does.
Preferences phrased as principles. Speculative scale ("this won't handle a
million rows") without a stated reason to expect a million rows. Anything
outside the diff. "While we're here" improvements. Restating a rule the CLI
already enforces.

## Severity

| | Meaning | Effect |
|---|---|---|
| **blocking** | Data loss, a security hole, or a scenario that is wrong in a case the AC covers | The developer fixes it before ticking `verified` |
| **finding** | A real defect outside AC coverage, or invented business logic | Recorded; the developer decides. Invented business logic is also raised in conversation |
| **note** | A cheaper equivalent or a missed reuse | Recorded only |

The gate does not read severity. It cannot tell a real blocker from a
mislabelled one, and a gate that trusts the reviewer's own grade of its own
output is not a gate. Severity is for the human.

## Output

Append to `tickets/<id>/verification.md`:

```markdown
## Review

### blocking — Rounding drops the final cent on odd totals
`src/billing/split.ts:34` — `Math.round(total / n)` on `total: 1001, n: 2`
returns 500 and 500, losing one cent. Every odd total loses its remainder.

### finding — Retry count not specified anywhere
`src/sync/push.ts:12` — retries 3 times with no backoff. Neither the
requirements nor `product/business-rules.md` state a retry policy. Raised with
the developer; do not treat 3 as decided.
```

Nothing found is a valid review. Write `No findings.` and stop — do not pad.

## The reviewer does not fix

It reports. A reviewer that edits has re-entered the work it was brought in to
judge, and there is then no independent context left to check the edit.
