---
status: complete
phase: 07-scaffolding-and-example-repo
source: [07-VERIFICATION.md]
started: 2026-09-19T09:35:00Z
updated: 2026-09-19T11:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settle DENIED-CONTRADICTION
expected: A ruling (reading A or reading B), then the corresponding one-sided edit.
context: |
  `test/helpers/denied.ts` listed `'Claude ' + 'Code'` as entry 8 of `DENIED`, while the docstring
  directly above that array said "`accord` itself and the four runtime names it targets are
  deliberately absent". Cursor, Copilot and Codex were indeed absent; Claude Code was not.

  The contradiction originates in PHASE 06, not 07: `.planning/phases/06-skills/06-01-SUMMARY.md:303`
  authors both halves in one sentence. Phase 06 passed verification with it intact; 07-14 only
  relocated the file and carried the docstring across unchanged.

  Correction to the 2026-09-19 report: `pointer.ts:26-29` does NOT name the four runtimes. It names
  the two directory paths `.claude/skills` and `.agents/skills`. Its carve-out is for paths, not for
  product names.
ruling: |
  Owner chose reading A on 2026-09-19.

  Decisive evidence found while presenting the options: `packages/core/src/scaffold/init.ts:48-50` —
  the `config.yml` that `init` writes into a user's repository — carries `claude`, `codex`, `cursor`
  and `copilot` as `runtimes:` values and in the comment above them, and that file IS a scanned
  surface (`scaffold.test.ts:407`). `skills/targets.ts:17-22` composes the same names into directory
  paths. So three of the four names CANNOT be added to `DENIED`: `\bcursor\b` matches inside
  `.cursor/` and inside `cursor and copilot -> both`, and the scan would fail on accord's own output.

  `Claude Code` was bannable only because it is spelled with a space, so the one-word form never
  collided with a path or a config token. That is an accident of spelling, not a policy. Reading B
  was rejected for the same reason: it would have fixed one README line by hand while leaving the
  other three names unenforceable, moving the asymmetry rather than removing it.

  The rule the list now states and enforces: it bans the tools accord is NOT built for — trackers,
  design tools, AI vendors, planning systems — and does not ban the four hosts accord is built to
  run inside, because their names are accord's own config values and directory components.
applied: |
  `test/helpers/denied.ts` — removed `'Claude ' + 'Code'` from `DENIED`; rewrote the docstring to
  state the reason above rather than assert an absence that was not true.
  `npm run check` exit 0 afterwards: lint clean, 3x tsc clean, 36 files / 888 tests passing.
follow_up: |
  `README.md:18` is left as it stands. It names all four runtimes, but nothing requires the change
  under reading A and no `deniedNames` call site reads README. Whether to reword it for durability
  ("comparisons date quickly") is a separate EDITORIAL decision, deliberately not coupled to the scan.
  Open, not blocking.

  CORRECTION, from the re-verification of 2026-09-19: the ruling was presented with the claim that
  "README is a published byte". That was true about the `files:` lists and FALSE about the outcome.
  Both packages name `README.md` in `files:`, but `files:` resolves inside the package directory and
  neither `packages/cli/` nor `packages/core/` contains a README — only the repo root does.
  `npm pack --dry-run` yields 2 files for the CLI and 13 for core, with no README in either.

  The ruling is unaffected: it rests on `runtimes:` config values and directory path components,
  not on README. But this is a live Phase 9 item — publishing as things stand gives two packages
  with a blank npm page. Fix is either to add a README to each package directory or to drop it from
  the `files:` lists; that is a packaging decision, deliberately not taken here.
result: pass

### 2. Run CI on a real runner
expected: |
  The `check` matrix (ubuntu-latest + windows-latest x Node 22 + 24) and the `examples` job both go
  green. The `examples` job prints `== build` and `== maintain` and exits 0.
context: |
  Nothing in phases 6 or 7 is committed, so no job has ever run on a runner. Every claim in all
  fifteen summaries and every behavioural check in the verification report is Windows-observed.
  The `examples` job relies on `sed -i`, `mktemp -d` and `cp -R` semantics; the job body was
  executed verbatim under Git Bash on Windows and passed — strong, but not ubuntu.
carried_from: 2026-09-18T11:40:00Z report — still open
result: pass
evidence: |
  Owner approved the commit on 2026-09-19. Phases 6 and 7 landed as `9f3f55b` (implementation, 80
  files) and `1c17a55` (planning artifacts, 70 files), pushed to `origin/main` as `53e9df9..1c17a55`.

  Run 35419856147 on `1c17a55` — conclusion `success`, all five jobs green:
    check (ubuntu-latest, 22)   success
    check (ubuntu-latest, 24)   success
    check (windows-latest, 22)  success
    check (windows-latest, 24)  success
    run the generated workflow's commands against the examples   success

  The examples job printed both expected lines on ubuntu, so `sed -i` / `mktemp -d` / `cp -R` behave
  there as they did under Git Bash:
    2026-09-19T03:54:31.4408102Z == build
    2026-09-19T03:54:31.8338276Z == maintain

  This closes the carry: the phase is no longer Windows-observed only. The full 2x2 matrix
  (ubuntu + windows x Node 22 + 24) has now executed the same suite that passes locally.

### 3. Confirm the skill-copy overwrite reading of success criterion 1
expected: |
  Owner agrees that "never overwrites an edited file" scopes to human-owned documents, and that
  skill copies under `.claude/skills/**` and `.agents/skills/**` are accord-owned rendered output
  governed by D-112's four-state marker rule.
context: |
  The criterion's wording is unqualified; the implementation is deliberate and reports itself
  loudly (`overwrote local edits`, held by `skills-sync.test.ts:184`). Human-owned documents ARE
  preserved — re-confirmed this pass: an edit appended to `accord/product/glossary.md` survived a
  second `init` and was reported `skipped`.
carried_from: 2026-09-18T11:40:00Z report — still open
ruling: |
  Owner confirmed on 2026-09-19: a skill copy is accord-owned rendered output, not a human-authored
  file. Overwriting a hand edit there is correct, because a kept edit drifts from the definition with
  nothing detecting it (CLI-03), and the four-state report (`skills.ts:48-70`) makes the loss loud
  rather than silent. Human-authored documents stay protected, as re-confirmed this pass.
applied: |
  `.planning/ROADMAP.md:261` — success criterion 1 reworded from "never overwrites an edited file" to
  "never overwrites a human-authored file", with the skill-copy carve-out stated inline. The criterion
  now says what the code does; no code changed.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
