---
phase: 05-cli-commands
plan: 04
subsystem: cli
tags: [status, ascii-table, padEnd, golden, windows, determinism, D-93, D-98]

# Dependency graph
requires:
  - phase: 05-cli-commands
    provides: "`statusRows(snapshot): StatusRow[]` (05-02) — the only source of row data; the CLI adds no column and no second sort"
  - phase: 05-cli-commands
    provides: "`runCli`, the shared preflight, the exit map, and `test/helpers/repo.ts` (05-01, 05-03)"
provides:
  - "`accord status [--json] [--all]` — the daily screen, an ASCII `padEnd` table over `StatusRow[]`, exit 0"
  - "`renderRows(rows, trackerCells?)` and `EMPTY_CELL` — the pure, colour-free, terminal-blind table renderer"
  - "A committed text golden for the table, plus the ASCII-only, escape-free, one-line-per-row assertions that guard it"
  - "The no-backslash invariant proven across all four repository-reading commands, not one"
affects: [05-05, 05-06, 06-skills, 08-mcp]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 4100
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A column table is a `Column[]` of `{ head, budget, cell }`: widths are derived, never configured, and no terminal dimension is read, so the text is goldenable"
    - "Sanitise before measuring: every cell's non-printable-ASCII code points become spaces and the result is cut to a constant budget, so untrusted frontmatter can neither inject an escape, forge a row, nor smuggle a glyph a legacy console cannot draw"
    - "A cross-command invariant is a loop over a case table naming each command, not one representative case"

key-files:
  created:
    - packages/cli/src/render/table.ts
    - packages/cli/src/commands/status.ts
    - packages/cli/test/status.test.ts
    - packages/cli/test/__golden__/valid-build.status.txt
  modified:
    - packages/cli/src/run.ts
    - packages/cli/test/spawn-surface.test.ts

key-decisions:
  - "Absent `type` and `status` render as blank padding, while every other absent value renders `EMPTY_CELL` — the owner's ruling on the 05-02 finding, applied narrowly to the two keys that are only absent when the frontmatter failed the schema"
  - "Every column is padded, including the last, so all table lines are the same width and a truncated cell is visible against its neighbours — this is also what makes the plan's equal-line-length assertion meaningful"
  - "The sanitiser is a printable-ASCII code-point scan, not a regular expression: eslint's `no-control-regex` refuses the character class, and no first-party file in this repository suppresses a rule. Its range mirrors `ascii()` in the tracker adapter — one rule, so a row-derived cell and a tracker-fetched one cannot diverge again"
  - "The summary line always names the hidden count, including when it is zero, so a script grepping for it never has to handle an absent line"

patterns-established:
  - "Failure messages carry the offending value: the ASCII scan reports `index N: U+XXXX \"c\"`, and the backslash scan reports the command, the stream, and the offending line"
  - "Sandbox-local test tickets are written into the `makeRepo` temp copy, never added to `packages/core/test/fixtures/`, so no Phase 1-4 golden moves"

requirements-completed: [CLI-05]

coverage:
  - id: D1
    description: "`accord status` prints one ASCII table row per ticket, in the order core returned them, and exits 0"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/status.test.ts#exits 0 and writes the table, matching the golden byte for byte"
        status: pass
      - kind: unit
        ref: "packages/cli/test/status.test.ts#renders the rows in the order core returned them, never re-sorting (D-92)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`--json` writes the StatusRow array verbatim with no envelope; an empty repository yields `[]` (D-98)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/status.test.ts#--json writes the StatusRow array verbatim, with no wrapper key (D-98)"
        status: pass
      - kind: unit
        ref: "packages/cli/test/status.test.ts#--json writes an empty array (D-98)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Archived tickets are hidden by default, revealed by `--all`, and the hidden count is named on both output modes (D-93)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/status.test.ts#hides the archived ticket, shows it under --all, and names the hidden count"
        status: pass
      - kind: unit
        ref: "packages/cli/test/status.test.ts#--json keeps stdout a bare array and puts the hidden count on stderr (D-93, D-98)"
        status: pass
      - kind: unit
        ref: "packages/cli/test/status.test.ts#--json --all leaves stderr empty and includes the archived ticket"
        status: pass
    human_judgment: false
  - id: D4
    description: "The table is ASCII only, escape-free, backslash-free, and one line per row (PITFALLS section 12, T-05-11)"
    requirement: CLI-07
    verification:
      - kind: unit
        ref: "packages/cli/test/status.test.ts#writes only ASCII, with no escape and no backslash"
        status: pass
      - kind: unit
        ref: "packages/cli/test/status.test.ts#puts every row on exactly one line"
        status: pass
      - kind: integration
        ref: "packages/cli/test/__golden__/valid-build.status.txt — 383 bytes, no code point above 127, no ESC, no backslash, LF only"
        status: pass
      # Added closing the 05-VERIFICATION gap: the three refs above all run against the all-ASCII
      # `valid-build` fixture, so they passed while the sanitiser stripped C0 controls only and let a
      # box-drawing glyph through a tracker value or a file stem. This one supplies the input the rule
      # exists to stop, and fails against the control-only predicate.
      - kind: unit
        ref: "packages/cli/test/status.test.ts#renders no character above code point 127, whatever the ticket carries"
        status: pass
    human_judgment: false
  - id: D5
    description: "An over-long cell is truncated visibly and cannot produce an unbounded or wrapped line (T-05-12)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/status.test.ts#truncates the over-long cell visibly and keeps the row one line of the usual length"
        status: pass
    human_judgment: false
  - id: D6
    description: "No command's stdout or stderr contains a backslash, on any host (D-51)"
    requirement: CLI-07
    verification:
      - kind: unit
        ref: "packages/cli/test/spawn-surface.test.ts#accord {lint | gate ready | gate done | status} prints no backslash on any host"
        status: pass
      - kind: integration
        ref: "GitHub Actions matrix ubuntu-latest + windows-latest x Node 22, 24 (.github/workflows/ci.yml) — not yet observed for this commit; the assertion is what fails there"
        status: deferred
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 4: `accord status` Summary

**The daily screen now prints: a hand-rolled ASCII `padEnd` table over the rows `statusRows` already produced, byte-identical on every host, with the archived filter, the never-silent hidden count, and `--json` carrying the array verbatim.**

## Performance

- **Duration:** 14 min
- **Tasks:** 3 of 3
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- `packages/cli/src/render/table.ts` — `renderRows` and `EMPTY_CELL`, 80 lines, no `node:` import, no terminal dimension read. Columns are a `Column[]` of `{ head, budget, cell }`; widths are derived from the measured cells with `padEnd`, so the output cannot vary with the console it lands in.
- Every cell is sanitised before it is measured (T-05-11): escape, carriage return, newline, and every other C0 control becomes a space, runs of spaces collapse, and the result is cut to a constant budget with three ASCII dots (T-05-12). A crafted frontmatter value therefore cannot inject an ANSI sequence, move the cursor, forge a row, or produce an unbounded line.
- `packages/cli/src/commands/status.ts` — 35 lines. One `statusRows` call, one archived filter applied before both writes, and the hidden count reported on **both** output modes: in the stdout summary line in text mode, and as exactly one stderr line under `--json` (D-93 plus D-98).
- `status` registered in `run.ts` beside `lint` and `gate`, through the same preflight, so the D-95 pin check is not conditional on which command was typed.
- `packages/cli/test/status.test.ts` — 11 tests across four sandboxes: the text golden, the character-set invariants, one-line-per-row, the JSON contract, the render-order check, the archived filter on both modes, the truncation case, and the empty repository on both modes.
- `packages/cli/test/spawn-surface.test.ts` — the single-command backslash case became a loop over `lint`, `gate ready LOGIN-1`, `gate done LOGIN-1`, and `status`, checking **both** streams and reporting the command, the stream, and the offending line on failure.

The rendered table, for the record (`valid-build`, trailing padding shown as it is written):

```
id       type   status  parent  ui   err/warn  ready  ticks     tracker
-------  -----  ------  ------  ---  --------  -----  --------  ----------------------
EPIC-1   epic   open    -       no   0/0       -      -         -
LOGIN-1  story  open    EPIC-1  yes  0/3       -      1/2 none  shortcut:1234 jira:1e3
2 tickets shown, 0 archived hidden
```

## Task Commits

**Nothing was committed — project policy (CLAUDE.md: leave changes uncommitted for owner review).** `HEAD` is still `97a7977`.

1. **Task 1: `accord status` end to end — rows on screen and rows on stdout** — uncommitted (project policy)
2. **Task 2: pin the table text and the character-set invariants** — uncommitted (project policy)
3. **Task 3: the no-backslash path invariant across the full command surface** — uncommitted (project policy)

**Plan metadata:** uncommitted (project policy)

## Files Created/Modified

- `packages/cli/src/render/table.ts` — `EMPTY_CELL`, the `COLUMNS` table, the sanitiser, the truncator, and `renderRows` (new)
- `packages/cli/src/commands/status.ts` — the archived filter, the hidden-count reporting, the JSON passthrough, the empty-repository line (new)
- `packages/cli/src/run.ts` — the `status` registration with `--json` and `--all`, plus its import (modified, +10 lines)
- `packages/cli/test/status.test.ts` — 11 tests over four sandboxes (new)
- `packages/cli/test/__golden__/valid-build.status.txt` — the 383-byte table golden (new)
- `packages/cli/test/spawn-surface.test.ts` — the backslash case became a four-command loop over both streams (modified)
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — plan progress and the CLI-05 tick (modified)

## Verification

Run from `C:/Work/accord`, all four green:

| Command | Result |
|---------|--------|
| `npm run build` | pass — `dist/cli.js` 12.64 kB |
| `npm run lint` | pass — no output |
| `npm run typecheck` | pass — core, core test, cli |
| `npm test` | **27 files / 661 tests passed**, 0 failed |

Baseline entering this plan was 26 files / 647 tests. The delta is exactly `status.test.ts` (+1 file, +11 tests) and the spawn-surface backslash loop (+3 tests, one case became four). No pre-existing test changed state and no pre-existing failure was observed.

Golden stability: generated on the first run (`1 written`), and the subsequent full `npm test` wrote nothing. The golden was inspected byte by byte — 383 bytes, no code point above 127, no ESC (0x1b), no backslash, no CR.

## Decisions Made

1. **Blank cells for an absent `type` and `status`, `EMPTY_CELL` for everything else.** The owner ruled that a broken-frontmatter row renders blank cells rather than a sentinel glyph. `type` and `status` are the two keys that are only ever absent when the frontmatter failed the schema, so the ruling is applied to exactly those two. `parent`, `tracker`, `ready: none`, and an epic's empty `ticks` keep the `EMPTY_CELL` hyphen, because there the hyphen is the D-100 signal that distinguishes "nothing recorded" from "could not fetch" — it is not a broken-ticket marker. See Findings.
2. **The empty cell is the ASCII hyphen, as the plan's flagged decision proposed.** D-91 and D-100 write an em dash; an em dash is outside ASCII and renders as garbage on a legacy Windows code page. One exported constant, so reversing it is a one-line change.
3. **Every column is padded, including the last.** The alternative — trimming the trailing run of spaces — makes line length depend on the last cell's content, which would make the plan's "the truncated row is the same length as every other line" assertion untrue for a reason unrelated to wrapping. The cost is trailing whitespace in the golden, which `.gitattributes` does not touch.
4. **The control-character sanitiser is a code-point scan, not a regular expression.** `[\u0000-\u001f\u007f]` is exactly what eslint's `no-control-regex` refuses, and no first-party file in this repository carries an `eslint-disable` (verified by grep — the only hits are inside `node_modules`). The scan is four lines longer and keeps that record intact.
5. **`status` exits 0 whenever it could read the repository**, as the plan's flagged decision proposed. A row is a trace, not a verdict (D-91); a `status` that exited 1 because some ticket has a lint error would be unusable in a CI script. Only the pin check and other environment errors reach exit 2.
6. **The summary line names the hidden count even when it is zero** (`2 tickets shown, 0 archived hidden`), so a consumer grepping the line never has to handle its absence. The `(--all shows them)` hint appears only when something was actually hidden.
7. **`renderRows` keeps the plan's optional `trackerCells` parameter**, which has no caller today; 05-06's adapter is the caller. It is one parameter and one `??`, and it is named in the plan's `must_haves.artifacts` and `key_links`. Flagged below as the one piece of this plan built ahead of its user.

## Deviations from Plan

**1. [Owner ruling] Absent `type` and `status` render blank, not `EMPTY_CELL`.** The plan's action says "an absent optional field renders as `EMPTY_CELL`". The owner's ruling, dispatched with this plan, overrides that for the two keys a broken ticket loses. Applied narrowly; every other absent value still renders the hyphen. Files: `packages/cli/src/render/table.ts`. Uncommitted.

**2. [Rule 3 - Blocking] The sanitiser was rewritten from a regular expression to a code-point scan.** `npm run lint` failed with `no-control-regex` on the first run. Rewritten rather than suppressed, per Decision 4. Files: `packages/cli/src/render/table.ts`. Uncommitted.

No other deviation. No production file outside this plan's `files_modified` list was touched, and `packages/core/src/status/rows.ts` was not edited.

## Findings / assumptions needing a decision

1. **Blank `type`/`status` cells versus the hyphen used everywhere else.** Implemented per the owner's ruling, but the two readings of "empty padding" were close: blank cells (what is built) or the same `EMPTY_CELL` hyphen every other absent value gets, leaving the error count as the sole differentiator (which is what the ruling's own rationale sentence argues). The visible consequence is that a broken row shows a gap where a sparse row shows a hyphen. One line each in `COLUMNS` reverses it. **Owner decision wanted:** confirm the gap, or unify on the hyphen.

2. **A non-ASCII ticket id is already refused before it can reach the table — resolved, no code change.** This entry originally asked the owner whether a non-ASCII id should pass through or be escaped, and the 05-VERIFICATION gap closure made the renderer strip it, which would have meant silent mangling: `Đăng-1` rendering as `ng-1` in the one place the author looks. **Owner ruling: refuse early and loudly at lint time rather than mangle at render time.** That ruling turned out to be the shipped behaviour already — `ticket.schema.json` constrains both `id` and `parent` to `^[A-Za-z0-9][A-Za-z0-9._-]*$`, so a non-ASCII stem is a `schema.pattern` error if the frontmatter id tracks it and a `lint.id-mismatch` error if it does not. There is no clean path to a non-ASCII id, and no new rule was added; one was written and then deleted as redundant. The renderer's printable-ASCII sanitiser stays as defence in depth for the id column, which is read from the file stem and so bypasses frontmatter validation entirely. Titles are unconstrained and stay Vietnamese in the fixtures — `title` is not a column. **Still open, separately:** a tracker *value* is `{ type: string, minLength: 1 }` with no pattern, so `shortcut: "Đăng—█"` is schema-valid and reaches the sanitiser; `schemas.test.ts:207` pins `shortcut: "é"` as valid deliberately, so constraining it is a decision in its own right and was not taken here.

3. **`ticks` renders the binding word even when nothing is bound** — `1/2 none` for a ticket with a verified tick but no `verified_hash`. The plan fixes the format as `<verified>/<tagged> <binding>` and only makes the cell empty when both counts are zero, so this is the plan followed literally. It reads slightly oddly next to the `ready` column, where `none` is rendered as the hyphen. **Owner decision wanted:** should `ticksBinding: none` also render as a hyphen (`1/2 -`), for consistency with `ready`?

4. **`renderRows`'s `trackerCells` parameter has no caller until 05-06.** Built because the plan specifies the signature and lists it as the adapter's seam. Recorded because it is the one thing here built ahead of its user.

5. **CLI-07 was left unticked.** Its two invariants (the spawn allowlist and the no-backslash rule) are now enforced across every command that exists, but `new ticket` (05-05) is still to come and prints a path in its refusal message. CLI-05 is ticked — `lint`, `gate ready`, `gate done`, and `status` all exist with `--json`.

## Issues Encountered

One, resolved: `npm run lint` rejected the control-character regular expression (Deviation 2). Everything else passed on its first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`accord status` closes CLI-05 and satisfies ROADMAP Phase 5 criterion 2 for all four reading commands. What remains in Phase 5:

- **05-05** — `accord new ticket <id> --type`. It is the last command that prints a path (the overwrite refusal), so it must be added to the `spawn-surface.test.ts` command loop when it lands; that is the moment CLI-07 can be ticked.
- **05-06** — the `github-issues` adapter. It fills `renderRows`'s `trackerCells` map and writes the D-100 warning to `ctx.stderr`; no other line of `table.ts` should need to change.

## Self-Check

- [x] `packages/cli/src/render/table.ts` — FOUND
- [x] `packages/cli/src/commands/status.ts` — FOUND
- [x] `packages/cli/test/status.test.ts` — FOUND
- [x] `packages/cli/test/__golden__/valid-build.status.txt` — FOUND
- [x] `packages/cli/src/run.ts` registers `status` with `--json` and `--all` — FOUND
- [x] `packages/cli/test/spawn-surface.test.ts` loops over four commands — FOUND
- [x] `npm test` run: 27 files / 661 tests passed
- [x] `git rev-parse HEAD` returns `97a7977174efa56e1d98594355d15a46af50a8b9` — nothing committed
- [x] No commit hashes claimed anywhere in this summary

## Self-Check: PASSED

---
*Phase: 05-cli-commands*
*Completed: 2026-09-15*
