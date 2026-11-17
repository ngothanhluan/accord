---
kind: reference
---

# The security reviewer

A round of review adds one more reviewer when the repository's list of risky patterns matches the round's diff. The list
is `accord/product/security.md` (accord's defaults when the repository has none): a team adds a pattern under a new id,
and removes a default only with a `- Removed: <id> — <reason>` line written on the owner's yes. A finding marked
`risk: security` blocks in every round, whatever the list says.

## Steps, in every round but the final review

1. **Read the list.** The round's review package, from `accord review-package <id>`, has a `## Security triggers`
   section. In round 1 you always read it. A later round's package is the last fix's diff, so it lists a trigger only when that
   fix touched a matched line or path.

2. **No trigger.** When the section says `(none: no pattern matched)`, dispatch no security reviewer and write the line
   `Security: no pattern matched` in the round's section of `review.md`.

3. **A trigger.** Any trigger, a `(cannot tell: …)` line included, means: run `accord review-package <id> --security`
   into a file outside the working tree, and dispatch one more fresh `accord-reviewer`, lens `security`, beside the
   round's other reviewers. Give it the paths of the ticket file, that file and `accord/tickets/<id>/ledger.md`. It
   checks every hunk under `## Matched hunks` against every item under `## Checklist`. Write the line
   `Security: lens security ran` in the round's section.

4. **Its findings** join the round's like any reviewer's, a security defect marked `risk: security`, and are fixed and
   re-reviewed as `./record.md` says. When a fix touches a matched line or path, the re-review round's package lists the
   trigger again, and the security reviewer runs again.

## The final review

The `(final review)` round asks none of this and writes no `Security:` line. A fix the final review makes is reviewed at
the re-review round after it, whose package lists that fix's triggers and which follows the steps above.

## The record

Every other round section carries exactly one `Security:` line, `Security: no pattern matched` included, so that the
record shows the decision was made. From accord 0.7.0:

- `accord round` and `accord gate done` refuse a round whose package had triggers and whose section lacks
  `Security: lens security ran`, naming the triggers. Run `accord review-package <id> --security --round <k>` for the
  round they name, dispatch the security reviewer on it, write the line, and commit.
- They also refuse a round section, the final review's excepted, with no `Security:` line. The refusal says the package
  had no trigger: write `Security: no pattern matched` and commit.

A ticket claimed before 0.7.0 keeps its earlier rules.
