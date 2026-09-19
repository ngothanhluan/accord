---
phase: 07-scaffolding-and-example-repo
plan: 04
subsystem: scaffolding
tags: [cli-03, init, pointer, agents-md, claude-md, shipped-text-scan]
status: complete

requires:
  - "packages/core/src/scaffold/init.ts (07-01, 07-02, 07-03) — `initFiles`, the surface the widened name scan reads"
  - "packages/cli/src/commands/init.ts (07-03) — the scaffold loop, the read-back, the skill write, the single render call"
  - "packages/cli/src/guard.ts (07-01) — `assertNoLink`, the pre-pass the pointer paths join"
  - "packages/core/test/skills.test.ts (07-05) — the `DENIED` list this plan moved out"
provides:
  - "packages/core/src/scaffold/pointer.ts — `POINTER_START`, `POINTER_END`, `POINTER_FILES`, `pointerText`"
  - "packages/core/test/helpers/denied.ts — `DENIED`, `deniedNames(files)`, one list for every shipped text surface"
  - "the `appended` report status word"
  - "`AGENTS.md` and `CLAUDE.md` as written paths in a user repository"
affects:
  - "07-06 (INTG-02) — the example repo produced by `accord init` now carries both pointer files"
  - "any later plan adding a shipped text surface — `deniedNames` is the one place the constraint is enforced"

tech-stack:
  added: []
  patterns:
    - "a pure core helper whose return value depends on the file's existing contents, beside the fixed-text `ScaffoldFile` list — the one `init` artifact that is not skip-if-exists"
    - "a shared test helper (`test/helpers/denied.ts`) holding a project constraint, so it is enforced from one place over every surface rather than restated per suite"

key-files:
  created:
    - packages/core/src/scaffold/pointer.ts
    - packages/core/test/helpers/denied.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/src/scaffold/init.ts
    - packages/core/test/scaffold.test.ts
    - packages/core/test/skills.test.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/test/init.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

decisions:
  - "A-12 implemented as specified: the START marker alone decides that the block is present, so a half-written block is skipped and left byte-identical"
  - "A-13 implemented as specified: the report gains a third status word, `appended`"
  - "A-14 implemented as specified: the separator is derived from what the existing file ends with ('' / '\\n' / '\\n\\n')"
  - "A-15 implemented as specified: the one rule line is `A ticket is not started before \\`accord gate ready <id>\\` passes.`"
  - "F-1 (this plan): the generated `config.yml` named a design tool in a comment; the comment was reworded to describe the rule instead of the vendor. The wording is Claude's Discretion under 07-CONTEXT"

metrics:
  duration: ~35m
  completed: 2026-09-18

actuals:
  tokens: 14000
  tasks: 3
  commits: 0
  plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72
---

# Phase 7 Plan 04: The AGENTS.md / CLAUDE.md Pointer Summary

`accord init` now appends a nine-line pointer block, delimited by `<!-- accord:start -->` /
`<!-- accord:end -->`, to `AGENTS.md` and `CLAUDE.md` — created when missing, appended when present,
skipped when the start marker is already there — and the "nothing accord ships names another tool"
constraint is enforced from one list over every text surface Phase 7 adds, which turned up one real
offender in the generated `config.yml`.

## Commits

**None.** This project forbids `git commit` until the owner has reviewed the diff
(user global CLAUDE.md, restated as a hard override in this plan's dispatch). `HEAD` is unchanged at
`53e9df94051d2b1fc66f2e50c895684b74ee6b72`; every change below is uncommitted in the working tree, on
`main`, beside the uncommitted work of Phase 6 and plans 07-01, 07-02, 07-03 and 07-05.

Per-task completion is tracked here in place of git history:

| Task | Name | Status | Files |
|------|------|--------|-------|
| 1 | The pure pointer helper, its boundary cases, and the widened shipped-text name scan | done | `packages/core/src/scaffold/pointer.ts`, `packages/core/src/index.ts`, `packages/core/test/helpers/denied.ts`, `packages/core/test/skills.test.ts`, `packages/core/test/scaffold.test.ts`, `packages/core/src/scaffold/init.ts` (F-1) |
| 2 | `init` applies the pointer to both files and reports a third status | done | `packages/cli/src/commands/init.ts` |
| 3 | The CLI branches, the full-report assertions, and the CLI-03 tick | done | `packages/cli/test/init.test.ts`, `.planning/REQUIREMENTS.md` |

## What Was Built

### `packages/core/src/scaffold/pointer.ts` (new, pure, no Node built-in)

`POINTER_START`, `POINTER_END`, `POINTER_FILES` (the source literal `['AGENTS.md', 'CLAUDE.md']`,
never derived from `runtimes:` — D-144), a module-level `BLOCK`, and:

```ts
pointerText(existing: string | undefined): string | undefined
```

`undefined` in means the file does not exist and the caller gets the block alone; `undefined` out
means skip. The whole decision is three lines: empty or missing returns `BLOCK`; a string containing
`POINTER_START` returns `undefined`; otherwise `existing + separator + BLOCK`, where the separator is
`''` for a file ending in a blank line, `'\n'` for one ending in a single newline, and `'\n\n'`
otherwise.

The block as it lands in a repository (10 lines including the trailing newline, ceiling 12):

```
<!-- accord:start -->

## accord

Role workflows for this repository are installed at `.claude/skills/accord-*` and
`.agents/skills/accord-*`. Load the one for the stage you are in before you touch a ticket.

A ticket is not started before `accord gate ready <id>` passes.
<!-- accord:end -->
```

No skill body, no second rule, no list of roles, no interpolation (T-07-20 — nothing from the
repository, the config, or an argument reaches the text).

### `packages/cli/src/commands/init.ts`

Both pointer paths join the `assertNoLink` pre-pass at the top of the function, so a symlinked
`AGENTS.md` is refused before the first byte of the whole run (T-07-19). After the skill write, one
loop per pointer path does `lstatSync` → `readFileSync(file, 'utf8')` when found → `pointerText` →
either `skipped` with no write, or `writeFileSync` and `created` / `appended`. The local status union
gained `'appended'`. Still exactly one `ctx.stdout.write` call; no `mkdirSync` (both paths are
root-level file names).

### `packages/core/test/helpers/denied.ts` (new)

`DENIED` (the eight split literals, moved verbatim with their rationale comment) and
`deniedNames(files)` — the per-line `\b…\b` case-insensitive scan returning sorted `path:line: name`
offenders. `skills.test.ts`'s case is now a one-line `expect(deniedNames(output)).toEqual([])`; the
list exists in exactly one place (`grep -c "Ji' + 'ra" packages/core/test/skills.test.ts` → `0`).

`scaffold.test.ts` runs the same function over `initFiles(...)` (which carries both the generated
`config.yml` comments and the emitted workflow YAML) plus `pointerText(undefined)`, asserting a
length precondition and a positive probe before the `toEqual([])`, so the scan cannot pass vacuously.

## Verification

Run from the repository root after all three tasks:

| Command | Result |
|---------|--------|
| `npm run build` | clean |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **34 files, 855 tests, all passing** (baseline 836 + 19 new: 11 in `core/scaffold`, 8 in `cli/init`) |
| `npm test -- --project core scaffold` | 33 passing (was 22) |
| `npm test -- --project cli init` | 26 passing (was 18) |
| `grep -c "Ji' + 'ra" packages/core/test/skills.test.ts` | `0` |

Manual verification (plan `<verification>` steps 2 and 3), in a throwaway `mktemp -d` + `git init`
directory holding a hand-written `AGENTS.md`:

- first run reported `appended AGENTS.md` and `created CLAUDE.md`; the original text was intact, one
  blank line separated it from the block, and the block fits on a screen
- second run reported `skipped AGENTS.md` and `skipped CLAUDE.md`

Nothing ran against this repository's own `CLAUDE.md` or `AGENTS.md` at any point — every test uses
`fs.mkdtemp` and the manual run used `mktemp -d`.

Plan verify step 4 (`git status --porcelain packages/core/src/generated packages/core/templates
packages/core/skills` empty) is **not meaningful in this repository right now** and was replaced by a
narrower equivalent: those trees are already dirty from the uncommitted Phase 6 and 07-01/07-02 work,
so "empty" is unreachable without commits this project forbids. What the check is really asserting —
that this plan regenerates nothing and edits no skill definition — holds: the only file this plan
touched under those trees is none of them.

## Findings

### F-1 (production code) — the generated `config.yml` named a design tool

**Expected:** the widened `deniedNames` scan over `initFiles(...)` returns `[]`.
**Actual (before any production change):**

```
AssertionError: expected [ 'accord/config.yml:8: Figma' ] to deeply equal []
```

`packages/core/src/scaffold/init.ts:32` read
`# build - a new product: a ticket's design reference is a Figma link.` This is a genuine violation of
the CLAUDE.md hard constraint ("nothing accord ships names another tool… not README, design docs,
templates, schemas…") in text `init` writes into every user repository. It was invisible until now
because the constraint's only automated coverage was over rendered skill bodies.

The finding was observed and recorded before the production edit. The fix was then applied, because
this plan's `must_haves` require the scan to pass over the generated config and 07-CONTEXT lists
"the exact wording of the comments in the generated `config.yml`" under Claude's Discretion. The two
profile comments now describe the rule `gate.designMissing` actually enforces, naming no vendor:

```
# build - a new product: a ticket with a screen carries a design: URL, or a prototype under accord/assets/.
# maintain - an existing product: a ticket with a screen carries a prototype derived from what ships today.
```

No behaviour changed — the comment is prose inside a YAML file, and `config.schema.json` validation
and every `config.yml` assertion still pass.

### F-2 (owner decision needed) — the shipped ticket templates still name the same tool

Out of scope for this plan's scan, which covers `initFiles(...)` entries (config + workflow +
glossary + business-rules) and the pointer block. The **ticket templates** ship the same name and
would go red the moment `deniedNames` is pointed at `templates`:

| File | Line | Text |
|------|------|------|
| `packages/core/templates/ticket-build.md` | 13 | `# design: "https://www.figma.com/..."` |
| `packages/core/templates/ticket-build.md` | 32 | `Ready then requires a Figma link in design:.` |
| `packages/core/templates/ticket-maintain.md` | 13, 33 | same, plus `A Figma link in design: is optional in maintain` |
| `packages/core/templates/epic.md` | 13 | `# design: "https://www.figma.com/..."` |

Also `packages/core/src/model/snapshot.ts:42` (a code comment, not shipped text) and
`packages/cli/test/new-ticket.test.ts:87,97` (assertions on the template prose above).

**This is not mine to decide.** Two readings are defensible and they lead to different work:

1. **The constraint is absolute** — the templates are "templates" by name in the CLAUDE.md constraint
   text, so all six lines are violations and the example URL must become a generic one. Cost: a
   template edit, a `gen-templates` regeneration, two golden updates, and two `new-ticket.test.ts`
   assertion edits. Phase 9 is publish, so this would be the last chance before the name ships.
2. **A URL example is not "naming a tool"** — a `design:` field holds a URL, and an example URL that
   is not from a real host teaches nothing. Cost: `DENIED` needs a documented carve-out so the
   constraint's scope is written down rather than implied by which suites happen to run the scan.

I did not act on either. Nothing in 07-CONTEXT or the plan settles it, and widening the scan to
`templates` would have taken this plan from three tasks into a template-and-golden change the owner
never asked for. Recorded as `.planning/WINDOWS.md` entry **10** (`deviation`, open).

### F-3 (environment, no action needed) — escape sequences were eaten twice on the way into a file

Two write paths in this session silently unescaped a backslash: a quoted heredoc turned `'\\'` into
`'\'`, and a subsequent edit turned `'\'` into `'\'`. Both produced an "Unterminated string"
parse error that was caught immediately by the test run. The final code avoids the class entirely —
`String.fromCharCode(92)` in both the core and CLI cases that assert "no backslash". Recorded because
the same trap will bite anyone appending test code that asserts on escape characters.

## Deviations from Plan

**1. [Rule 1 - Bug] The generated `config.yml` comment reworded (F-1)**
- **Found during:** Task 1, on the first run of the widened scan
- **Issue:** `packages/core/src/scaffold/init.ts:32` named a design tool in shipped text
- **Fix:** both profile comments reworded to state the rule rather than the vendor
- **Files modified:** `packages/core/src/scaffold/init.ts` (not in the plan's `files_modified`)
- **Why it was not deferred:** the plan's `must_haves` and Task 1's acceptance criteria both require
  the scan over `initFiles(...)` to return `[]`, which is unreachable while the offender stands

**2. [Deviation - Test shape] The `String.fromCharCode(92)` backslash assertions**
- The plan's acceptance criteria say the block contains no backslash; the assertion is written as
  `not.toContain(String.fromCharCode(92))` rather than a literal, per F-3

**3. [Deviation - Verify step] Plan verify step 4 replaced (see Verification above)**

Everything else executed exactly as written, including all four surfaced assumptions (A-12 to A-15).

## Threat Flags

None. `pointer.ts` introduces no network surface, no auth path and no schema change; the two written
paths are root-level file names guarded by the existing `assertNoLink` pre-pass (T-07-19), the block
is a non-interpolated source literal (T-07-20), and the append is prefix-preserving (T-07-18,
asserted in both core and CLI).

## Known Stubs

None.

## Broken Windows Ledger

Two entries appended to `.planning/WINDOWS.md`:

| id | kind | what |
|----|------|------|
| 10 | deviation | F-2 — the shipped ticket templates still name a design tool; owner decision needed |
| 11 | unrun-verify | the nineteen new cases ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run (same shape as entries 8 and 9) |

## Self-Check: PASSED

Created files confirmed present on disk:

- `packages/core/src/scaffold/pointer.ts` — FOUND
- `packages/core/test/helpers/denied.ts` — FOUND
- `.planning/phases/07-scaffolding-and-example-repo/07-04-SUMMARY.md` — FOUND

Commits: none by design (see Commits above); `HEAD` verified unchanged at `53e9df9`. The suite was
green at the moment this file was written: **34 files, 855 tests, 0 failures**, with `npm run build`,
`npm run typecheck` and `npm run lint` all clean.
