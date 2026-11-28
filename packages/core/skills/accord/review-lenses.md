---
kind: reference
---

# The team lenses

A team writes its own review checklists as `accord/lenses/<name>.md`. `accord review-package <id>` prints the ones that apply under
`## Team lenses`, from the files at the default branch and the round's changed paths: one `### Lens <name>` section each, with its
`on_finding` mode (`warn`, `ask` or `block`), its paths and its checklist. Run exactly the lenses it prints, no more and no fewer: you
never choose, skip or add one. Only the package of round 1 and of the final review prints them, and never for lane S; a package with no
such section, or whose section holds a `(none…)` line, runs none. A line `branch only, applies after merge: <name>` names a lens this
branch added: do not run it.

## Steps, in round 1 and in the final review

1. **Dispatch.** For each `### Lens <name>` the package prints, dispatch one `accord-reviewer` with lens `<name>`, in parallel with the
   reviewers `./review.md` step 3 chose; the `ui` lens goes to the agent its `### Lens ui` line names. Give it the path of the ticket file, the path of the review package and the path of
   `accord/tickets/<id>/ledger.md`; its checklist is that lens's section of the package.
2. **Record.** When a lens's reviewer has run, write the line `Lens: <name> ran` in the round's section of `review.md`, one line per
   lens, as `./review-record.md` says. Never write it for a lens that has not run.
3. **Its findings** join the round's like any reviewer's, each ending ` — lens: <name>`, and are classified as `./review.md` step 4 says.
   A finding of the built-in `ui` lens carries no ` — lens:` mark and blocks like any built-in finding.
4. **A refusal.** When `accord round` prints `refused:` naming a lens, run the command it prints, dispatch the reviewer on the package
   that command writes, write the `Lens: <name> ran` line and commit.

## What a finding does

The lens's `on_finding` says, after the classifying of step 4; a lens finding is a `patch`, `plan-gap` or `intent-gap` as any is.

- a `warn` finding is listed and not fixed: leave it `open` with its mark. `accord round` prints it as a `warn:` line, and the verify
  report lists it for the owner. It stops nothing.
- an `ask` finding is not sent to an executor: leave it `open` with its mark. When `accord round` prints `ask:` lines, put the owner
  one finding at a time, as `./ask.md` says: fix it, defer it with its `## Deferred` line, or accept it with
  `verdict: accepted-by-owner "<the owner's sentence>"`. A fix the owner asks for is a `patch` of step 4.
- a `block` finding is fixed like any finding, a Must or a Should through step 4's executor path.
- a `risk:` finding is always fixed and never listed, asked or deferred, whatever the lens says.
