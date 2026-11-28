---
kind: reference
---

# UI evidence of the verify stage

A `ui: true` ticket needs evidence for each `@ui` scenario: screenshots in `accord/tickets/<id>/evidence`, each named
`ac-<n>-<state>.<ext>` (`<n>` the scenario's number, `<state>` the screen state in lower case, as in `ac-2-empty.png`). Take the first tier
below that gives them, and write its name on the criterion's `Tier:` line of `verification.md`. The CLI checks that the files exist and
names the tier; it never checks which tool made them.

## Tiers

1. **Command.** When `accord/config.yml` sets `ui.screenshots`, run that command yourself at step 2 of `./verify.md`, right after
   `tests.full` at the same commit, with `{dir}` replaced by `accord/tickets/<id>/evidence`. accord never runs it, as it never runs
   `tests.full`; a command that needs a running server starts it in its own script. The verifier records `Tier: command`.
2. **Verifier.** Else, when `accord-verifier` has a browser tool, it runs each `@ui` scenario headless and saves each screenshot there
   itself. It records `Tier: verifier`.
3. **Manual.** Else a person takes the screenshots into that folder, and the verifier records `Tier: manual`.
4. **Owner check.** When none of them gives screenshots for a `@ui` scenario, the owner check below follows. It is recorded as
   `Tier: owner check`.

The verifier first records such a scenario as `Result: blocked`.

A screenshot tier also records `Evidence commit: <sha>`, the commit verified. A screenshot of another commit is no evidence.

## The owner check

1. For each `@ui` criterion recorded `blocked`, ask the owner whether it held, one criterion at a time, as `./ask.md` says. Name the
   criterion, the commit verified and what to open, run or look at.
2. Write each answer with the owner's own words to a file outside the working tree, in the operating system's temporary folder, never
   in the repository.
3. Dispatch a fresh `accord-verifier` in `owner check mode` with the path of `accord/tickets/<id>.md` and that file. Only a fresh
   verifier writes `verification.md` (`./verify-writer.md`); you never edit it. It rewrites only the `@ui` blocks the answers name.

A criterion that held is written `Result: pass` with `Tier: owner check`, `Owner: "<the owner's words>"` and, as its evidence, the files the
check exercised. One that did not hold is `Result: fail`, and step 5 of `./verify.md` goes on to `./failure.md`.

## In the report and in git

- The owner's report names the tier of each `@ui` criterion. An owner check is weaker than a screenshot: it is the owner's word, with
  nothing to look at later. Say so beside it.
- The evidence files are committed with `verification.md` at step 6 of `./verify.md`, so the files the record cites are in the commit
  the owner approves.
- A screenshot committed to a public repository is public. Take it from test data, never from a real person's or customer's.
