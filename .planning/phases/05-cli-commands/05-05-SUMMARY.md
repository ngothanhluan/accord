---
phase: 05
plan: 05
subsystem: cli
tags: [cli, scaffold, templates, new-ticket, CLI-04, CLI-07]
status: complete

requires:
  - "packages/cli/src/run.ts (05-01): runCli, the shared preflight, the exit-code map"
  - "packages/core/src/generated/templates.ts (Phase 1): the frozen template record"
  - "packages/core/src/write/frontmatter.ts (02-06): setFrontmatterKey and its comment round-trip"
  - "packages/cli/test/helpers/repo.ts (05-01): makeRepo, run, cleanup"
provides:
  - "newTicket(ctx, id, options) — the CLI-04 scaffold command"
  - "CLI surface: accord new ticket <id> [--type epic|story|bug]"
affects:
  - "Phase 6 skill text binds to this exact command spelling and its exit codes"
  - "Phase 7 init writes config.yml with the pin this command now also honours"

tech-stack:
  added: []
  patterns:
    - "commander Option().choices() for a closed value set, so an unknown --type is commander's own refusal mapped to exit 2 — no hand-rolled validation"
    - "one regex literal duplicating the ticket schema's id pattern, placed at the single argv-to-path boundary"

key-files:
  created:
    - packages/cli/src/commands/new-ticket.ts
    - packages/cli/test/new-ticket.test.ts
  modified:
    - packages/cli/src/run.ts
    - packages/cli/test/spawn-surface.test.ts

decisions:
  - "The id regex is a literal in new-ticket.ts, not read out of ticket.schema.json: the guard has to be visible at the one call site between argv and a filesystem write, and reading the schema at runtime to obtain it would put a JSON load between the argument and its check"
  - "--type is validated by commander's own Option().choices(), so an unknown value never reaches newTicket; it surfaces as a CommanderError, which 05-01's catch already maps to exit 2"
  - "An empty id is refused by the same pattern (it has no leading alphanumeric), so there is no separate empty-string branch"

metrics:
  duration: 14 min
  completed: 2026-09-15

actuals:
  tokens: 5400
  tasks: 2
  commits: 0
  plan_head_before: 97a7977174efa56e1d98594355d15a46af50a8b9
---

# Phase 5 Plan 5: `accord new ticket` Summary

`accord new ticket <id>` scaffolds a ticket from the active profile's template — substituting the id
and setting `type:`, and filling in nothing else — and refuses to overwrite an existing one.

## What Was Built

**`packages/cli/src/commands/new-ticket.ts`** — `newTicket(ctx, id, options): number`, four steps in
source order:

1. **Validate the id** against `^[A-Za-z0-9][A-Za-z0-9._-]*$`, the ticket schema's own pattern. This
   runs before any path is constructed, because it is the only guard between an argv string and a
   filesystem write (T-05-14). The pattern admits no slash, no backslash, no leading dot and no space,
   so no traversal sequence survives it.
2. **Select the template** from the `templates` record on the core public API — never a read of
   `packages/core/templates/*.md`, which is not shipped into a consumer's `node_modules` the way the
   generated module is. `epic` takes `epic.md`; `story` and `bug` take
   `ticket-${ctx.snapshot.config?.profile ?? 'build'}.md`, the same defaulting idiom lint and the
   gates use.
3. **Produce the text in exactly two operations**: one `replaceAll('TICKET-ID', id)` (which covers
   both the frontmatter `id` value and the Gherkin `Feature:` line), then one
   `setFrontmatterKey(text, 'type', options.type)`, which preserves the trailing guidance comment on
   that line. Nothing else is touched.
4. **Refuse or write**: `accord/tickets/<id>.md` joined to `ctx.root`; if it exists, `UsageError`
   naming the forward-slash relative path and exit 2. Otherwise a recursive `mkdir`, the write, and
   the relative path on stdout.

**`packages/cli/src/run.ts`** — a `new` command group carrying one subcommand, `ticket <id>`, with
exactly one option: `--type`, an `Option().choices(['epic','story','bug'])` defaulting to `story`. No
`--title` (rejected under D-104) and no `feature` subcommand (dead with the `features/` folder). Its
action calls the same shared `preflight` the lint and gate actions call, which is what makes D-95 true
rather than incidental — a mismatched pin stops the command before any path is built.

**`packages/cli/test/new-ticket.test.ts`** — 19 cases across two describes, one per line of the
behavior block plus the round-trip. The most valuable one loads the created ticket back through
`loadFromFs` + `loadSnapshot` and asserts the snapshot carries it under the new id with zero findings
against its file: a scaffold that does not parse wasted the BA's time, and only a round-trip proves it
parses.

**`packages/cli/test/spawn-surface.test.ts`** — `new ticket` added to the printed-path loop, twice:
the write branch (guard `accord/tickets/TCK-1.md`) and the refusal branch against the fixture's
existing `LOGIN-1` (guard `accord/tickets/LOGIN-1.md`). The loop's guard assertion moved from
`expect(out)` to `expect(out + err)` because a refusal prints its path to stderr; both streams were
already scanned for backslashes, so this only widens where the guard string may appear.

## Verification

Run from `C:/Work/accord`, all four green:

| Command | Result |
|---------|--------|
| `npm run build` | pass — `dist/cli.js` 14.24 kB |
| `npm run lint` | pass — no output |
| `npm run typecheck` | pass |
| `npm test` | **28 files / 685 tests passed**, 0 failed |

Baseline entering this plan was 27 files / 664 tests. The delta is +1 file and +21 tests: 19 in
`new-ticket.test.ts` and 2 new entries in the spawn-surface printed-path loop. No test that passed
before this plan fails now.

The plan's second automated check — `git status --porcelain packages/core/test/fixtures packages/core/templates`
must be empty — is **non-empty for a pre-existing reason, not because of this plan**. `ticket-build.md`
and `ticket-maintain.md` carry the Phase 4 `verified_hash` / `verified_commit` comment addition, and
the four `gate-*` fixture directories are untracked Phase 4 output. Both were already in the working
tree before this plan started (confirmed against the session-start `git status` and by inspecting the
diff, which is the Phase 4 hunk). Nothing in this plan writes outside a `mkdtemp` sandbox.

## Deviations from Plan

**1. [Rule 2 — missing critical coverage] `--type` validation delegated to commander, plus one case
beyond the behavior block.** The plan specified `--type` limited to three values but named no
behavior for a fourth. Using `Option().choices()` makes commander produce the refusal, which 05-01's
catch already maps to exit 2; a test asserts the exit code and that the tickets listing is unchanged.
Without it, an unknown `--type` would have been an untested path into a template lookup.

**2. [Rule 2] An empty id is covered as a fifth invalid-id case.** The plan's behavior block named
slash, backslash, leading dot and space. `accord new ticket ""` is reachable from a shell and would
otherwise construct `accord/tickets/.md`; the same pattern already refuses it, and the case is now
asserted rather than assumed.

**3. Guard assertion widened in the spawn-surface loop.** `expect(out).toContain(guard)` became
`expect(out + err).toContain(guard)` so the refusal branch, which prints to stderr, can be a loop
entry. Every pre-existing entry still passes unchanged. This is the only edit to a file this plan did
not create.

No auto-fixes were needed — nothing was found broken. No architectural decisions arose.

## Findings / assumptions needing a decision

The plan's own `planning_notes` flagged three assumptions as unsettled by any D-number. All three are
now implemented as written there, and are listed again so they are decided rather than inherited:

1. **`--type` defaults to `story`** — the type both profile templates already declare. Alternative: no
   default, forcing `--type` on every invocation. Implemented: default `story`.
2. **The created path is printed to stdout** (`accord/tickets/TCK-1.md\n`, nothing else), so it can be
   piped into an editor. Alternative: a human sentence like `created accord/tickets/TCK-1.md`, which
   is friendlier but not pipeable. Implemented: the bare path.
3. **`accord/tickets/` is created when absent** via a recursive `mkdir`, rather than treated as an
   error. Alternative: refuse, on the grounds that a repository without that folder has not been
   `init`-ed. Implemented: create it. Note this is only reachable in a repository that has an
   `accord/` folder at all, since the loader already refuses without one.

Two further behaviours the plan did not specify, decided here:

4. **A partially-written file is not cleaned up on a write failure.** `writeFileSync` is the last
   operation and the only one that can fail after the existence check; a truncated file would be
   visible to the BA in their editor, which is a better outcome than a silent unlink that discards
   the evidence. No `try`/`unlink` was added.
5. **`type:` is written double-quoted** (`type: "story"`), because D-45 makes `setFrontmatterKey`
   quote every string core writes, while the template ships it unquoted. The round-trip test proves
   this parses and produces no schema finding. Changing it would mean special-casing enum values in
   the write primitive, which is not worth it — but it does mean a scaffolded ticket differs by one
   pair of quotes from a hand-copied template.

None of these blocks the plan; all five are one-line reversals if the owner disagrees.

## Requirements

- **CLI-04** — ticked. `new ticket <id>` renders from the profile's template with the `@ac-1` tag
  scaffolding intact.
- **CLI-07** — ticked. The backslash invariant now covers all six printed-path command paths
  (`lint`, `gate ready`, `gate done`, `status`, `new ticket`, `new ticket` refusal), and the
  spawn allowlist test already enumerates `src/**` from disk, so `new-ticket.ts` was covered the
  moment it was added (it spawns nothing).

## Commits

None. **Uncommitted (project policy)** — `.claude/CLAUDE.md` requires the working tree be left dirty
for owner review. `git rev-parse --short HEAD` is still `97a7977`.

## Self-Check: PASSED

- `packages/cli/src/commands/new-ticket.ts` — FOUND
- `packages/cli/test/new-ticket.test.ts` — FOUND
- `packages/cli/src/run.ts` registers `new ticket` — FOUND (`commands/new-ticket.js` imported,
  `.command('ticket <id>')` registered)
- `packages/cli/test/spawn-surface.test.ts` contains `new ticket` loop entries — FOUND
- Commits — N/A by project policy; `HEAD` verified still at `97a7977`
