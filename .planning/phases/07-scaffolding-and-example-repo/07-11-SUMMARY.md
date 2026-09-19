---
phase: 07-scaffolding-and-example-repo
plan: 11
subsystem: testing
tags: [templates, claude-md-constraint, denied-names, codegen, vitest, ticket-schema]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "the `deniedNames` helper — one list, one scan — extracted in 07-04 and already called by `skills.test.ts`, `scaffold.test.ts` and `examples.test.ts`; the `generated module matches templates/ (drift)` case from 01-04 that binds the generated record byte-for-byte to `packages/core/templates/`"
  - phase: 06-skills
    provides: "the rendered-skill-body scan the `deniedNames` list was born in (SKILL-04)"
provides:
  - "No file under `packages/core/templates/` names another tool, plugin, harness, or planning system: the five offending lines across `ticket-build.md`, `ticket-maintain.md` and `epic.md` carry a neutral example URL on the IANA reserved example domain and vendor-free guidance prose"
  - "The `deniedNames` scan now covers the shipped templates as a fifth surface, via the generated `templates` record — which the drift case makes equivalent to scanning the directory, and which is the exact bytes a consumer receives after install"
  - "A recorded RED: the scan fails naming file and line on a deliberate reintroduction, and the guidance-line probe trips *only* the new case, which is the evidence that nothing detected this breach before"
  - "`accord new ticket` still renders the right template per profile, distinguished by `Ready then requires a design link in design:` — present in the build template, absent from the maintain one"
affects: [08-mcp-server, 09-publish-and-dogfood]

actuals:
  tokens: 7002        # chars/4 over the realized diff of this plan's files (28,006 chars)
  tasks: 2
  commits: 0          # uncommitted by project rule — see "Task Commits" below

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A project constraint held on a shipped surface by adding a caller to the one existing scan, never a second list and never an allowlist"
    - "Guard the guard before the assertion that matters: a non-empty-input guard and a split-literal probe offender, then the clean assertion — the shape `scaffold.test.ts:388-397` established"
    - "Codegen idempotence proven by content hashing (`git hash-object`) rather than by `git status`, because `npm run gen` also emits an untracked file"

key-files:
  created: []
  modified:
    - packages/core/templates/ticket-build.md
    - packages/core/templates/ticket-maintain.md
    - packages/core/templates/epic.md
    - packages/core/src/generated/templates.ts
    - packages/core/test/templates.test.ts
    - packages/core/test/__golden__/ticket-build.verified-empty.md
    - packages/cli/test/new-ticket.test.ts

key-decisions:
  - "The example URL is `https://example.com/design/...` — the RFC 2606 / IANA reserved example domain, `https://` so `ticket.schema.json`'s `design` pattern still matches, path `design/` so a reader still sees what the key is for, trailing ellipsis kept so it still reads as a placeholder. Identical on all three templates, which the build/maintain frontmatter-equality case requires"
  - "The guidance prose loses the vendor and keeps the category: build says `Ready then requires a design link in design:.`, maintain says `A design link in design: is optional in maintain; the prototype is the primary reference.` The build/maintain asymmetry — and therefore the only thing the two `new-ticket.test.ts` cases can name — survives intact"
  - "The new case scans `Object.entries(templates)`, not a second `readdirSync` walk (A-36): the drift case already binds the record to the directory, and the record is what ships"
  - "The non-empty guard compares the record's entry count to the on-disk `.md`/`.html` count rather than to a hardcoded number, so a new template cannot shrink the scanned set without also failing the drift case"
  - "No allowlist, no per-file exception, no carve-out for example URLs — the owner's F-2 ruling was explicit that a constraint with an exception is one nobody can enforce later"

patterns-established:
  - "Pattern: a denied-name scan proves it still bites by asserting a probe offender built from a split literal in the same case, immediately before asserting the real surface clean"
  - "Pattern: an out-of-scope-tree guard is a content-hash baseline (`find | sort | xargs sha256sum`) taken before the first edit and diffed after the last, because `git status` cannot see an edit inside an already-untracked directory"

requirements-completed: [CLI-01]

coverage:
  - id: D1
    description: "No file under `packages/core/templates/` names another tool: the three `design:` example lines carry `https://example.com/design/...` and the two guidance lines name a design link rather than a product"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#no shipped template names another tool, plugin, harness, or planning system (CLAUDE.md)"
        status: pass
      - kind: other
        ref: "grep -rniE 'F[i]gma' packages/core/templates/ — exit 1, no match; the all-eight-names grep over the same tree also reports nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The `deniedNames` scan reaches the shipped templates, and is proven to fail in the direction it exists for"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#no shipped template names another tool, plugin, harness, or planning system (CLAUDE.md) — probe offender asserted before the clean assertion"
        status: pass
      - kind: manual_procedural
        ref: "deliberate reintroduction on ticket-build.md:32 + npm run gen -> 1 failed, `expected [ 'ticket-build.md:32: Figma' ] to deeply equal []` (verbatim transcript below), then reverted to green"
        status: pass
    human_judgment: false
  - id: D3
    description: "`accord new ticket` still renders the build template under `profile: build` and the maintain template under `profile: maintain`, distinguished by the one sentence that differs"
    requirement: "CLI-01"
    verification:
      - kind: integration
        ref: "packages/cli/test/new-ticket.test.ts#--type story|bug renders the build template under profile build / under profile maintain — 4 cases, 19 passed in the suite"
        status: pass
      - kind: manual_procedural
        ref: "node packages/cli/dist/cli.js init && new ticket DEMO-1 --type story in two fresh `git init` sandboxes, one per profile — both rendered Intent sentences recorded below"
        status: pass
    human_judgment: false
  - id: D4
    description: "The uncommented example URL is schema-valid: a reader who uncomments `design:` and fills it in has a valid ticket"
    requirement: "CLI-01"
    verification:
      - kind: manual_procedural
        ref: "uncommented to `design: \"https://example.com/design/screen-1\"` in the build sandbox; `accord lint` exits 0 with no finding against `design`"
        status: pass
      - kind: unit
        ref: "packages/core/test/templates.test.ts#ticket-build.md validates against ticket.schema.json (and the maintain/epic siblings)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The generated module moved with the templates, and codegen is idempotent"
    requirement: "CLI-01"
    verification:
      - kind: other
        ref: "git hash-object packages/core/src/generated/*.ts either side of a second `npm run gen` — byte-identical, diff exit 0; run twice, once per task"
        status: pass
      - kind: unit
        ref: "packages/core/test/templates.test.ts#generated module matches templates/ (drift)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The two suites that share the `deniedNames` helper did not shrink — regression evidence for SKILL-04 and CLI-03, requirements this plan does not deliver"
    verification:
      - kind: unit
        ref: "npx vitest run --project core skills -> 42 passed; npx vitest run --project core scaffold -> 36 passed (floor 33, 07-10 added 3)"
        status: pass
      - kind: other
        ref: "git hash-object packages/core/test/helpers/*.ts unchanged against the pre-task baseline — the shared helper gained a caller, not an edit"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-09-18
status: complete
---

# Phase 07 Plan 11: The shipped templates name no tool, and the scan reaches them Summary

**Five lines across three shipped ticket templates lose the vendor and keep the instruction, and the `deniedNames` scan gains its fifth surface — so the hard CLAUDE.md naming constraint is now machine-held on every shipped text surface rather than on four of five.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-18T12:29:00Z (approx — first read)
- **Completed:** 2026-09-18T12:42:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- **The five lines.** `ticket-build.md:13`, `ticket-maintain.md:13` and `epic.md:13` now read `# design: "https://example.com/design/..."` — byte-identical to one another, `https://` intact, ellipsis intact. `ticket-build.md:32` and `ticket-maintain.md:33` name a *design link* instead of a product, keeping the build/maintain asymmetry that is the only thing the `new-ticket` profile cases can name.
- **The scan reaches them.** One new case in `packages/core/test/templates.test.ts`, inside the `generated module` describe beside the drift case, importing the same `deniedNames` from `./helpers/denied.js` that three other suites already call. No second list, no allowlist, no parameter added to the helper.
- **The scan is proven to bite.** Two deliberate reintroductions, transcripts below. The second one is the load-bearing evidence: a name on the guidance line trips *only* the new case, which is exactly the "nothing detects this" the finding described.
- **Nothing outside scope moved.** `packages/core/test/fixtures`, `docs/` and `examples/` are byte-identical to a content-hash baseline taken before the first edit (152 files). `packages/core/test/helpers/*.ts` likewise.

## The two rendered Intent sentences (verification step 2)

Two fresh `git init` sandboxes under the session scratchpad, `node packages/cli/dist/cli.js init` then `new ticket DEMO-1 --type story`, `profile:` set by hand in the maintain one (`init` has no `--profile` flag).

**`profile: build` — `accord/tickets/DEMO-1.md` Intent, last line:**

```
If the story has a screen, set ui: true in the frontmatter. Ready then requires a design link in design:. -->
```

**`profile: maintain` — `accord/tickets/DEMO-1.md` Intent, last two lines:**

```
If the story has a screen, set ui: true in the frontmatter. Ready then requires a prototype at assets/<id>/prototype.html derived from the project's existing styles.
A design link in design: is optional in maintain; the prototype is the primary reference. -->
```

Both tell a BA what Ready will demand; neither names a product. The `design:` comment line in both rendered tickets is `# design: "https://example.com/design/..."`.

**And it is schema-valid when uncommented.** In the build sandbox, `# design: "https://example.com/design/..."` was rewritten to `design: "https://example.com/design/screen-1"`. `accord lint` exits 0; the six findings it reports are the expected placeholder/`@test:`/empty-plan warnings from an unfilled scaffold, and none of them concerns `design`.

## The deliberate reintroduction (verification step 3, Task 2 acceptance criterion)

**Probe A — the frontmatter example line.** `ticket-build.md:13` restored to the vendor URL, `npm run gen`, `npx vitest run --project core templates`:

```
 ❯ |core| test/templates.test.ts (14 tests | 2 failed) 21ms
   ❯ template structure (7)
     × build and maintain differ only inside body HTML comments 5ms
   ❯ generated module (3)
     × no shipped template names another tool, plugin, harness, or planning system (CLAUDE.md) 3ms

 FAIL  |core| test/templates.test.ts > generated module > no shipped template names another tool, plugin, harness, or planning system (CLAUDE.md)
AssertionError: expected [ 'ticket-build.md:13: Figma' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "ticket-build.md:13: Figma",
+ ]

 ❯ test/templates.test.ts:154:32
```

Note that line 153 — the probe-offender assertion — passed, which is what says the scan was still matching when line 154 reported clean-or-not.

**Probe B — the guidance line, and the one that matters.** `ticket-build.md:32` restored to `Ready then requires a Figma link in design:`, `npm run gen`, same command:

```
     × no shipped template names another tool, plugin, harness, or planning system (CLAUDE.md) 6ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ 'ticket-build.md:32: Figma' ] to deeply equal []
      Tests  1 failed | 13 passed (14)
```

**One failure, and it is the new case.** Probe A tripped two cases because the frontmatter line is also compared build-against-maintain; probe B sits inside an HTML comment, where no pre-existing case could see it. Before this plan, a vendor name on that line shipped silently. That is the finding, reproduced and closed.

Both probes reverted; `grep -rniE 'F[i]gma' packages/core/templates/` exits 1, `--project core templates` reports 14 passed.

## Task Commits

`uncommitted (project CLAUDE.md: owner reviews the diff before any commit)`

Files left changed and unstaged in the working tree:

1. **Task 1: Five lines lose the vendor and keep the instruction** — `packages/core/templates/ticket-build.md`, `packages/core/templates/ticket-maintain.md`, `packages/core/templates/epic.md`, `packages/core/src/generated/templates.ts` (regenerated), `packages/cli/test/new-ticket.test.ts`, `packages/core/test/__golden__/ticket-build.verified-empty.md` (regenerated)
2. **Task 2: The scan reaches the templates, and fails when it should** — `packages/core/test/templates.test.ts`

**Plan metadata:** uncommitted — this file, `.planning/STATE.md`, `.planning/ROADMAP.md`

## Files Created/Modified

- `packages/core/templates/ticket-build.md` — line 13 neutral example URL; line 32 names a design link
- `packages/core/templates/ticket-maintain.md` — line 13 neutral example URL; line 33 names a design link
- `packages/core/templates/epic.md` — line 13 neutral example URL
- `packages/core/src/generated/templates.ts` — regenerated by `npm run gen`, never hand-edited
- `packages/core/test/templates.test.ts` — `deniedNames` import plus one new case in the `generated module` describe (+18 lines)
- `packages/core/test/__golden__/ticket-build.verified-empty.md` — regenerated by `vitest -u` scoped to the `write` suite; `git diff --numstat` reports exactly `2 2`, and `git diff -U0` shows exactly the two changed template lines (13 and, after the `verified: []` insertion, 33)
- `packages/cli/test/new-ticket.test.ts` — the matched pair of profile assertions at lines 87 and 97 now name `Ready then requires a design link in design:`

## Verification numbers

| Check | Result |
|---|---|
| `npm run gen` | `generated 7 templates`, `generated 10 skills` |
| `npm run build` | exit 0 — `dist\cli.js 29.46 kB` |
| `npm run lint` | exit 0, no output |
| `npm run typecheck` | exit 0 (core, core tests, cli) |
| `npx vitest run` (full) | **36 files, 883 tests passed** (baseline 36/882 + this plan's 1 new case) |
| `--project core templates` | 14 passed (was 13) |
| `--project core write` | 11 passed |
| `--project core skills` | **42 passed** — floor 42, unchanged (SKILL-04 regression evidence) |
| `--project core scaffold` | **36 passed** — floor 33 plus 07-10's 3 (CLI-03 regression evidence) |
| `--project cli new-ticket` | 19 passed |
| `git hash-object packages/core/src/generated/*.ts` either side of a second `npm run gen` | identical, twice (once per task) |
| `find packages/core/test/fixtures docs examples -type f \| sort \| xargs sha256sum` vs pre-edit baseline | identical, 152 files |
| `git hash-object packages/core/test/helpers/*.ts` vs pre-task baseline | identical |
| `grep -rniE 'F[i]gma' packages/core/templates/` | exit 1 (no match) |

No host flake observed — the single full-suite run was clean, so the F-3 spawn-timeout re-run was not needed.

## Does any file accord ships still name another tool?

**Yes — one, and it is not a template.** This was established by evidence, not inspection of the diff.

Method: read the published surfaces from both manifests rather than guessing them — `@accord-dev/accord-core` ships `["dist","schemas","templates","README.md"]`, `@accord-dev/accord` ships `["dist","README.md"]` — then grep all six paths for every one of the eight `DENIED` entries (split literals in the pattern), against the freshly built `dist`.

Three hits, dispositioned:

| Hit | Disposition |
|---|---|
| `packages/cli/dist/cli.js:419` — `/** \`{ shortcut: '1234', jira: '1e3' }\` becomes \`shortcut:1234 jira:1e3\`. */`, from `packages/cli/src/render/table.ts:24` | **A real residual breach.** `Ji`+`ra` is in `DENIED`. It survives into shipped bytes because it is a JSDoc block comment, which the bundler preserves. Out of this plan's scope (not in `files_modified`; A-37's principle is that widening turns a three-defect closure into a repository-wide edit). **Recorded as finding F-1 below.** |
| `packages/core/dist/index.js:1259` — `/^(?:linear\|radial\|conic)-gradient\(/i`, from `packages/core/src/lint/tokens.ts:97` | **Not a breach.** The CSS `linear-gradient` function, matched only because `-` is a word boundary. A false positive of the scan's `\b` anchoring, not a tool reference. |
| `packages/core/templates/**` | **Clean.** Zero hits for all eight names after this change — the point of the plan. |

Two occurrences that are *in source but not in shipped bytes*, verified by grepping the built `dist` for each and finding nothing: `packages/core/src/model/snapshot.ts:42` (`// 'https://www.figma.com/file/abc'`) and `packages/core/src/skills/targets.ts:15` (`// Claude Code reads .claude/skills/ only; ...`). Both are `//` line comments, which the bundler strips. They breach the constraint in the repository's source text but not in what a consumer installs.

Everything else in the repository that names a tool — test fixtures, goldens, `docs/design.md` — is not shipped at all (A-37).

## Decisions Made

See `key-decisions` in the frontmatter. The one worth restating: **no carve-out.** The owner rejected a written exception for example URLs, so the fix is the removal of the name, and the scan has no allowlist parameter and gained none.

## Deviations from Plan

**None** — plan executed as written. Two notes on how, neither a deviation in substance:

- The plan's verify commands use `npm test -- --project core templates`. I ran `npx vitest run --project core templates` — the same invocation without the npm argument-forwarding layer, which on this host is the more reliable way to pass a project filter *and* a name filter. Results are the same runner, the same config, the same counts.
- `accord init` has no `--profile` flag (the plan's verification step 2 did not assume one, but it was the natural first attempt). The maintain sandbox was made by setting `profile: maintain` in the generated `accord/config.yml`, which is what `new-ticket.test.ts` itself does.

## Findings this plan did not anticipate

**F-1 — `packages/cli/src/render/table.ts:24` names a tracker product in a JSDoc comment that ships.**
A-37 enumerated the out-of-scope occurrences as a type comment, test fixtures, goldens, and `docs/design.md`, and assumed the shipped surface was the templates. It missed that **source comments reach `dist`, and `dist` is published.** The distinction that matters is not source-vs-shipped but *line comment vs block comment*: the bundler strips `//` (so `snapshot.ts:42` and `targets.ts:15` do not ship) and preserves `/** */` (so `table.ts:24` does). One JSDoc line therefore puts `Ji`+`ra` into `@accord-dev/accord`'s published bytes today.

The deeper point: **`dist` is a shipped text surface that no `deniedNames` caller covers.** The scan now has five callers — skill bodies, scaffold surfaces, example prose, templates — and all five scan *inputs to* the build, not its output. A sixth caller over the built bundles would have caught `table.ts:24` and would keep catching the next one. That is a decision about scope and about how to spell the `linear-gradient` exclusion without an allowlist, so it belongs to the owner, not to this plan.

Suggested ticket: rewrite `table.ts:24`'s example to a neutral adapter key, and decide whether the scan grows a `dist` caller.

**A-37's recorded out-of-scope candidate, unchanged as required:** `packages/core/src/model/snapshot.ts:42` — `design?: string; // 'https://www.figma.com/file/abc'`. No change made there. Per the evidence above it does *not* reach shipped bytes, which lowers its severity relative to F-1 but does not make it correct.

## Issues Encountered

None. Both deliberate reintroductions behaved as designed and reverted cleanly; the full suite was green on the first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap 3 / F-2 is closed: the constraint is machine-held on all five shipped text surfaces the scan can reach, and proven to fail on reintroduction.
- Phase 7's three gap-closure plans (07-09, 07-10, 07-11) are all executed. The phase's eleven plans stand complete, with the whole of Phases 6 and 7 uncommitted for the owner's review.
- **Carried into the owner's queue:** finding F-1 above (`table.ts:24`, and whether `deniedNames` grows a `dist` caller). It is the last known place a shipped byte names another tool, so Phase 9's "publish and dogfood" should not ship before it is ruled on.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-18*
