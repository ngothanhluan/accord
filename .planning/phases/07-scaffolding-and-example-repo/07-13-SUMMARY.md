---
phase: 07-scaffolding-and-example-repo
plan: 13
subsystem: core
tags: [templates, generated-record, golden, readme, claude-md-constraint, gap-closure]
status: complete

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "the three ticket templates as 07-11 left them (the `design:` line already settled under ruling F-2); `packages/core/scripts/gen-templates.mjs` as the sole writer of the generated record; the drift case at `templates.test.ts:130-137`; the `DENIED` list and `deniedNames` scan in `packages/core/test/helpers/denied.ts`"
  - phase: 02-schemas-and-lint
    provides: "`ticket.schema.json`'s `tracker` `patternProperties` rule and `config.schema.json`'s `tracker.adapter` enum, which between them decide both the replacement key and that it validates"
provides:
  - "No text accord ships uses a tracker product as the example tracker key: all three shipped ticket templates, the generated record, the rendered golden and `README.md:15` offer `github-issues`, a value `config.yml`'s adapter enum actually names (ruling GAP-2c / GAP-2c-EXT)"
  - "`Shortcut` stays out of `DENIED` with no allowlist and no written carve-out — the exception is not defended, it is made unnecessary"
  - "A user who uncomments the templates' `tracker:` line gets a ticket that lints clean, demonstrated end to end through the built CLI in a throwaway repo, with a negative control proving the schema rule reaches that line"
affects: [07-14, 09-publish-and-dogfood]

actuals:
  tokens: 4372        # chars/4 over the realized diff of this plan's seven files (17,488 chars). 16,280 of
                      # those chars are the three whole-line entries of the generated record, whose real byte
                      # delta is one word each — the line is the diff unit, not the change.
  tasks: 2
  commits: 0          # uncommitted by project rule and by explicit dispatch override — see "Task Commits"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An example inside a shipped document names a value the product's own schema enumerates, so the example cannot teach something the product does not accept — the replacement key was read off `config.schema.json`, not chosen"
    - "A constraint with a written exception is replaced by a change that removes the need for the exception, rather than by an allowlist that a later reader has to find and honour"
    - "The oracle for a generated artifact is the drift case run WITHOUT a `gen` prefix; both obvious alternatives have an unreachable direction (`git status` over that directory can never pass while the tree is uncommitted; `gen && drift` can never fail)"

key-files:
  created: []
  modified:
    - packages/core/templates/ticket-build.md
    - packages/core/templates/ticket-maintain.md
    - packages/core/templates/epic.md
    - packages/core/src/generated/templates.ts
    - packages/core/test/__golden__/ticket-build.verified-empty.md
    - README.md
    - packages/core/test/convention.test.ts

key-decisions:
  - "`github-issues` is the replacement and there was no second candidate: `config.schema.json:16`'s adapter enum is exactly `[\"none\", \"github-issues\"]`, and `none` carries no ids so it cannot illustrate an id map"
  - "The quoted `\"1234\"` value is kept. Only the key was at issue; changing the value would widen the diff for nothing"
  - "`packages/core/src/generated/templates.ts` was regenerated with `npm run gen`, never hand-edited — the generator is its only writer, and 07-11 hit this same chain once already"
  - "The drift case was run on its own with no `npm run gen` in front of it, so the green is a statement about the tree rather than about the command that just made it true"
  - "The `-u` run was fenced by a `git hash-object` baseline over the two sibling goldens the same suite owns, because `-u` re-accepts every snapshot in the files it runs and the risk is collateral acceptance, not the intended one"
  - "Test fixtures, test assertions and data goldens that carry tracker keys were left untouched: neither package's `files:` list includes `test/`, so none of them is a shipped byte"

patterns-established:
  - "Pattern: the order is edit → `gen` → baseline → `-u` → re-run without `-u` → compare baseline. The re-run is what separates a snapshot that reproduces from one that was merely accepted once"

requirements-completed: [CLI-01]
---

# Phase 7 Plan 13: The Shipped Tracker Example Names a Key Accord Has — Summary

Three shipped ticket templates, the record they generate into, the golden that snapshots one of them, and
the README that documents all three now offer `github-issues` as the `tracker:` example key — a value
`config.yml`'s adapter enum actually names — so the word that was carved out of `DENIED` as ordinary
English appears nowhere as a product name, and the carve-out no longer has to be defended.

## What Was Built

### Task 1 — the shipped templates offer a tracker key accord actually has

Line 9 of `packages/core/templates/ticket-build.md`, `ticket-maintain.md` and `epic.md` changed from
`# tracker: { shortcut: "1234" }` to `# tracker: { github-issues: "1234" }`. Line 8 — the prose above the
example — did not move, nor did key order, nor the `design:` line 07-11 already settled.

`npm run gen` then rewrote `packages/core/src/generated/templates.ts`; the record carries `github-issues`
in all three ticket entries and zero occurrences of the old key. The drift case was then run **on its own,
with no `gen` in front of it** — `npx vitest run --project core templates`, 14 passed — so the green says
the record on disk matches the directory on disk, rather than saying the generator and the test read the
same directory.

Before the `-u` run, a baseline was captured over the two sibling goldens the `write` suite owns and which
must not move:

```
$ git hash-object packages/core/test/__golden__/LOGIN-1.ac_hash.md \
                  packages/core/test/__golden__/LOGIN-1.verified.md > 07-13-goldens-before.log
6b156be1fb64736142be0db088598ab6747062d0
e030dbd2cc5f8cc8eaa1eb7575ab4adb0b017e20
```

`npx vitest run --project core write -u` then reported `Snapshots 1 updated`, `Tests 11 passed`, and
`packages/core/test/__golden__/ticket-build.verified-empty.md:9` now reads
`# tracker: { github-issues: "1234" }`. The same command re-run **without** `-u` passed 11/11, so the
regenerated snapshot reproduces rather than having been accepted once. The after-baseline compared clean:

```
$ git hash-object ... > 07-13-goldens-after.log
$ git diff --no-index --quiet 07-13-goldens-before.log 07-13-goldens-after.log
GOLDENS UNMOVED: exit 0
```

Both `.log` files were removed afterwards; they are gitignored (`.gitignore:3`) and their result is recorded
above.

### Task 2 — the README documents the key the templates now offer

`README.md:15`'s example became `tracker: { github-issues: "1234" }`, with the rest of the sentence and the
rest of the bullet unchanged, and the literal that pins it at `packages/core/test/convention.test.ts:48`
moved with it in the same change. The other six phrases in that list are untouched and the `legacyFolder`
negative assertion still holds.

**Ruled scope, recorded as the plan asks.** This is GAP-2c-EXT: the README line and its pinning literal, and
nothing else. The ruling explicitly does not widen to `docs/` or the planning files, and this plan did not
widen it. The full diff for task 2 is two lines.

## Hand Verification — `new ticket` → uncomment → `lint`

Run through the built CLI (`packages/cli/dist/cli.js`) in a throwaway git repo under the session scratchpad.

```
$ node .../cli.js init
... created accord/config.yml, templates, skill copies, AGENTS.md, CLAUDE.md ...

$ node .../cli.js new ticket LOGIN-1
accord/tickets/LOGIN-1.md

$ sed -n '9p' accord/tickets/LOGIN-1.md
# tracker: { github-issues: "1234" }

# uncomment it, exactly as a user copying the example would
$ sed -n '9p' accord/tickets/LOGIN-1.md
tracker: { github-issues: "1234" }

$ node .../cli.js lint
accord/tickets/LOGIN-1.md:45: warning lint.sentinel contains placeholder "<observable outcome>"
accord/tickets/LOGIN-1.md:45: warning lint.sentinel scenario "<observable outcome>" has a placeholder step "Given ..."
accord/tickets/LOGIN-1.md:45: warning lint.sentinel scenario "<observable outcome>" has a placeholder step "Then ..."
accord/tickets/LOGIN-1.md:45: warning lint.sentinel scenario "<observable outcome>" has a placeholder step "When ..."
accord/tickets/LOGIN-1.md:45: warning lint.test-tag-missing scenario "<observable outcome>" has no @test:<id> tag and is not @ui
accord/tickets/LOGIN-1.md:54: warning lint.plan-empty ticket has scenarios but ## Plan has no step
0 errors, 6 warnings
exit=0
```

No finding on `tracker`. The six warnings are the untouched template placeholders a freshly rendered ticket
always carries, on lines 45 and 54.

**Negative control**, so the green above is not vacuous — the same line with a key that does *not* match
`^[a-z][a-z0-9-]*$`:

```
$ sed -n '9p' accord/tickets/LOGIN-1.md
tracker: { GitHub-Issues: "1234" }

$ node .../cli.js lint
accord/tickets/LOGIN-1.md:9: error schema.additionalProperties must NOT have additional properties
... (the same 5 placeholder warnings) ...
1 errors, 5 warnings
exit=1
```

The schema rule reaches line 9 and reports there. `github-issues` passing is therefore a fact about the key,
not about the rule being asleep.

## For the Owner to Rule On — A-43's Two `snapshot.ts` Line Comments

This plan did **not** move either of these, because neither is in GAP-2c or GAP-2c-EXT. They are recorded
here rather than silently omitted, so the pair can be ruled on together.

| Location | Text | Why it was left |
|----------|------|-----------------|
| `packages/core/src/model/snapshot.ts:40` | `tracker?: Record<string, string>; // { shortcut: '1234' } — values are always strings` | Line comment, stripped by the bundler; core's `files:` list excludes `src/`; confirmed absent from `packages/core/dist/index.js`. Same shape as the README line; the difference that decides it is reach, not wording. |
| `packages/core/src/model/snapshot.ts:42` | `design?: string;` carrying a DENIED name as its example URL | Same disposition, same reason. It is the exact literal 07-11 removed from the three templates under ruling F-2, left here only because `src/` is not a shipped surface. |

If the owner would rather these moved, it is a two-line edit with no generated artifact behind it and no
test pinning either line.

## Deviations from Plan

None — the plan executed exactly as written. No deviation rule fired, no auth gate, no architectural
question.

## Task Commits

**None, by design.** The project's own `CLAUDE.md` and the owner's global `CLAUDE.md` both forbid `git
commit` without explicit approval, and the dispatch carried a MANDATORY override suspending
`<task_commit_protocol>` and `<final_commit>` for this plan. All work is left unstaged in the working tree
for the owner's review. The plan's `<output>` section says the same thing independently.

## Verification

`npm run check` (build + lint + typecheck + test) from the repository root:

```
build   ✔ core 2 files / cli 1 file, exit 0
lint    eslint . — clean
typecheck  tsc core + core tests + cli — clean
test    Test Files  36 passed (36)
        Tests  887 passed (887)
        Duration 10.96s
```

Identical to the dispatch baseline of 36 files / 887 tests. This plan adds no case; it moves a value.

Per-task verification, all run and all green:

| Command | Result |
|---------|--------|
| `npx vitest run --project core templates` (no `gen` prefix) | 14 passed — the drift case observes the tree |
| `npx vitest run --project core write -u` | 11 passed, 1 snapshot updated |
| `npx vitest run --project core write` (no `-u`) | 11 passed — the snapshot reproduces |
| `git diff --no-index --quiet` over the golden baselines | exit 0 — no sibling golden moved |
| `npx vitest run --project core convention` | covered by the full suite run above |
| hand check: `new ticket` → uncomment → `lint` | exit 0, no `tracker` finding; negative control exits 1 |

`packages/core/test/fixtures/` is untouched, as are the data goldens and
`packages/cli/test/__golden__/valid-build.status.txt`.

## Self-Check: PASSED

All seven key-files exist on disk and appear in `git status --short` (step 2 adapted per the dispatch
override — no commits to check):

```
 M README.md
 M packages/core/src/generated/templates.ts
 M packages/core/templates/epic.md
 M packages/core/templates/ticket-build.md
 M packages/core/templates/ticket-maintain.md
 M packages/core/test/__golden__/ticket-build.verified-empty.md
 M packages/core/test/convention.test.ts
```

(`packages/core/templates/business-rules.md`, `packages/core/src/generated/skills.ts` and the two
`wrong-plan.*` goldens also show as changed; they are prior plans' uncommitted work and this plan did not
touch them. The `design:` hunks visible inside the three template diffs are likewise 07-11's, co-located in
the same files.)

Content assertions re-checked at write time:

- line 9 of all three templates is exactly `# tracker: { github-issues: "1234" }`
- `packages/core/src/generated/templates.ts` contains `github-issues` 3 times and the old key 0 times
- `packages/core/test/__golden__/ticket-build.verified-empty.md:9` carries the new example
- `README.md:15` and `packages/core/test/convention.test.ts:48` carry the same literal

No stubs, no skipped tests, no unrun `<verify>` — nothing to append to `.planning/WINDOWS.md`.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change; the three registered
threats (T-07-46 hand-edited record, T-07-47 a non-accord tracker presented as an adapter, T-07-48 a stale
file-snapshot golden) were each mitigated as the register specifies.
