---
phase: 07-scaffolding-and-example-repo
plan: 14
subsystem: testing
tags: [vitest, tsdown, eslint, typescript, jsdoc, bundle-scan]

requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "07-04's single `deniedNames` list and scan; 07-11's templates-record surface; 07-12's edits to `packages/cli/src/commands/skills.ts`, which shifted the offender's line in the bundle"
provides:
  - "One denied-name list at the repository root, `test/helpers/denied.ts`, imported downwards by both packages' test trees"
  - "A `deniedNames` scan over `packages/cli/dist/cli.js` — the only code npm uploads — guarded against a missing, truncated or silently-non-matching read"
  - "A `flatten` JSDoc that documents `github-issues`, the adapter key `config.yml` actually accepts, so the published bundle carries no denied name"
  - "The GAP-2d ruling on `packages/core/dist/index.js:1259` recorded as a settled decision with its three rejected routes"
affects: [09-publish, phase-9-dogfood, any-future-shipped-text-surface]

actuals:
  tokens: 21020
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "A repository-root `test/` directory for helpers that hold a REPOSITORY constraint rather than a package one; both packages import downwards, nothing imports across a package boundary"
    - "Scan the build's OUTPUT, not only its inputs, for any constraint that governs published bytes"

key-files:
  created:
    - test/helpers/denied.ts
  modified:
    - packages/cli/test/bin.test.ts
    - packages/cli/src/render/table.ts
    - packages/core/test/examples.test.ts
    - packages/core/test/scaffold.test.ts
    - packages/core/test/skills.test.ts
    - packages/core/test/templates.test.ts
    - packages/core/src/scaffold/pointer.ts

key-decisions:
  - "GAP-2d: `packages/core/dist/index.js:1259` is a decided NON-breach — the match is the CSS function name `linear` inside the tokens lint rule's own regex `/^(?:linear|radial|conic)-gradient\\(/i`, naming no product. Confirmed by re-scan at execution time, exactly one match, exactly that line. Three routes rejected: tighten the scan to `(?<![\\w-])name(?![\\w-])` (does not clear it — `:` precedes and `|` follows — and it loses hyphenated product names in prose); reword the lint rule to `/^[a-z]+-gradient\\(/i` (clears it, but edits a working rule to satisfy a scan and loosens what the rule accepts); allowlist (forbidden by GAP-2a). The scan stays scoped to the CLI bundle; the tokens lint rule is unmodified."
  - "The denied list lives at the repository ROOT, not in either package, because the constraint it holds is the repository's. No re-export shim was left at the old path — a shim is exactly the second copy the list moved to avoid."
  - "The new scan's ceiling is stated in the test's own comment rather than implied away: no test can prove `dist` matches `src`. Freshness comes from `npm run build` preceding `npm test`, in both CI jobs and in every verify command."

patterns-established:
  - "Guard the guard before the assertion that matters: existence with a `run npm run build first` message, a length floor, and a live probe that must still detect a planted name — the shape `packages/core/test/templates.test.ts` established, now used identically in `packages/cli/test/bin.test.ts`"

requirements-completed: [CLI-01, SKILL-04]

coverage:
  - id: D1
    description: "The bytes `npm publish` uploads carry no denied name — a `deniedNames` scan over `packages/cli/dist/cli.js` returns an empty offender list"
    requirement: CLI-01
    verification:
      - kind: unit
        ref: "packages/cli/test/bin.test.ts#the published bundle names no other tool, plugin, harness, or planning system (CLAUDE.md)"
        status: pass
    human_judgment: false
  - id: D2
    description: "That scan reads a real bundle or fails loudly — a missing `dist/cli.js` fails naming `run npm run build first`, and a live probe proves the scan still matches a planted name"
    requirement: CLI-01
    verification:
      - kind: unit
        ref: "packages/cli/test/bin.test.ts#the published bundle names no other tool, plugin, harness, or planning system (CLAUDE.md) — existence assertion, length floor >1000, and the `Fig`+`ma` probe"
        status: pass
      - kind: manual_procedural
        ref: "moved `packages/cli/dist/cli.js` aside and re-ran the suite: both the pre-existing `is built` case and the new case failed with `run npm run build first`; bundle restored"
        status: pass
    human_judgment: false
  - id: D3
    description: "One denied list, one scan, every surface — `DENIED` and `deniedNames` live at `test/helpers/denied.ts` and are imported by both packages' test trees"
    requirement: SKILL-04
    verification:
      - kind: unit
        ref: "npx vitest run --project core (23 files / 699 tests, pass) and npm run check (36 files / 888 tests, pass)"
        status: pass
      - kind: other
        ref: "grep -rn 'helpers/denied' — five references, all naming `test/helpers/denied.ts`; `packages/core/test/helpers/denied.ts` does not exist"
        status: pass
    human_judgment: false
  - id: D4
    description: "The JSDoc that put the name in the bundle now documents an adapter key accord actually ships, so the scan is green because the breach is gone rather than excused"
    requirement: CLI-01
    verification:
      - kind: unit
        ref: "packages/cli/test/bin.test.ts (green after rebuild) and npx vitest run --project cli status (12 tests, golden unchanged)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-19
status: complete
---

# Phase 7 Plan 14: The Scan Reaches the Published Bytes Summary

**The denied-name list moved to one repository-root copy, a `deniedNames` scan now reads `packages/cli/dist/cli.js` — the only code npm uploads — and it was seen to catch the real breach (`Jira` in the `flatten` JSDoc) before the reword made it green.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-19T01:55Z
- **Tasks:** 3 of 3
- **Files modified:** 8 (1 created at a new path, 1 deleted at the old path, 6 edited)

## Accomplishments

- `packages/core/test/helpers/denied.ts` → `test/helpers/denied.ts`. Four import specifiers repointed to `'../../../test/helpers/denied.js'`; three comments that named the old path updated, including the one inside core's shipped source. No re-export shim.
- A new case in `packages/cli/test/bin.test.ts` scans the built CLI bundle with the same list and the same scan every other shipped surface uses — the first call site that scans the build's OUTPUT rather than an INPUT.
- The `flatten` JSDoc in `packages/cli/src/render/table.ts` now documents `github-issues`, the only tracker adapter `config.schema.json` accepts, and states the space join in words instead of demonstrating it with a second product name.
- The GAP-2d question about `packages/core/dist/index.js` is closed as a decision, not left for Phase 9.

## RED → GREEN evidence

**RED** — after task 2, before task 3, against a freshly built bundle (`npm run build && npx vitest run --project cli bin`, exit 1):

```
FAIL  |cli| test/bin.test.ts > accord bin > the published bundle names no other tool, plugin, harness, or planning system (CLAUDE.md)
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "packages/cli/dist/cli.js:424: Jira",
+ ]
```

The received array held exactly one string: **`packages/cli/dist/cli.js:424: Jira`**. Line **424**, not the 419 the plan was written against — 07-12's edits to `skills.ts` sit above it and shifted the bundle, exactly as the plan predicted, which is why every check here matched the path prefix and not a line number.

This is a valid RED under the intentional-RED rule: the target test failed, on the assertion for the planned behaviour, with 4 of 5 cases in the same file passing. No syntax error, no zero-test discovery, no unrelated failure.

**GREEN** — after task 3's reword and a rebuild (`npm run build && npx vitest run --project cli bin`, exit 0):

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

The offender list is `[]`. Re-scanned independently outside vitest with the live `DENIED` list: `packages/cli/dist/cli.js => []`.

**The guard, guarded.** `packages/cli/dist/cli.js` was moved aside and the suite re-run: both the pre-existing `is built` case (line 11) and the new case (line 42) failed with `run npm run build first: expected false to be true`. The bundle was restored immediately. A missing build cannot read as a pass.

## Task 1 evidence: `lint` and `typecheck` after the move, before any test

Both were run before any test, as the plan required, and neither needed a configuration edit:

```
> lint
> eslint .
                                  (no output, exit 0)

> typecheck
> tsc -p packages/core && tsc -p packages/core/tsconfig.test.json && tsc -p packages/cli
                                  (no output, exit 0)
```

No `TS6059`, no `TS6307`, no `TS2307`. The move is configuration-free, as A-48 predicted: no tsconfig sets `rootDir` or `composite`, all set `noEmit: true`, so a file outside `include` reached by an import joins the program; eslint's `**/test/**` block already gives the root `test/` directory node globals, and the core-purity block is scoped to `packages/core/src/**`.

`git status --porcelain` over the eight configuration files (`tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, both package tsconfigs, `packages/core/tsconfig.test.json`, both package `vitest.config.ts`) printed **nothing** — they are tracked, clean against `HEAD`, and untouched.

## Full verification

`npm run check` (build + lint + typecheck + test), exit 0:

```
 Test Files  36 passed (36)
      Tests  888 passed (888)
```

Baseline before this plan was **36 files / 887 tests**. One file gained one case; no file was added or removed as a suite, which is the property that proves the relocated helper is a module and never a collected suite.

Core in isolation — the property the rejected "core test reads `../../cli/dist`" alternative would have broken:

```
npx vitest run --project core
 Test Files  23 passed (23)
      Tests  699 passed (699)
```

`npx vitest run --project cli status` — 12 tests pass, and `git status --porcelain packages/cli/test/__golden__/valid-build.status.txt packages/core/test/fixtures/valid-build` prints nothing. The fixture and its golden carry tracker keys as DATA and were not touched; a comment change moved no rendered byte.

## Files Created/Modified

- `test/helpers/denied.ts` — **created** (moved from `packages/core/test/helpers/denied.ts`, which no longer exists). Contents unchanged — same eight split literals, same code-point `cmp`, same `path:line: name` format, `Shortcut` still absent. The header gained one paragraph saying why it sits at the root: the constraint is the repository's, the last surface it had to reach was the published CLI bundle, and both test trees now import downwards so nothing imports a helper across a package boundary — which is what `packages/cli/test/load.test.ts:16` asks for rather than a rule the file is exempt from.
- `packages/cli/test/bin.test.ts` — the new scan case, plus the import. Asserts, in order: `existsSync(cli)` with `run npm run build first`; `text.length > 1000`; the `Fig`+`ma` live probe returning exactly `['probe.js:2: Figma']`; then the real assertion. One comment states the freshness ceiling.
- `packages/cli/src/render/table.ts` — the `flatten` JSDoc only. `flatten`'s body, `COLUMNS`, `EMPTY_CELL` and `GAP` are byte-identical.
- `packages/core/test/{examples,scaffold,skills,templates}.test.ts` — one import specifier each; `scaffold.test.ts` and `skills.test.ts` also carry an updated path comment.
- `packages/core/src/scaffold/pointer.ts` — one comment line. This is core's shipped source, so a stale path there would have been a wrong statement inside a published byte.

## Decisions Made

**GAP-2d — `packages/core/dist/index.js:1259` is a decided non-breach.** Re-scanned at execution time with the live list: core's bundle returns exactly one match, at exactly line 1259, and nothing else. The line is

```js
else if (kind === "color" && /^(?:linear|radial|conic)-gradient\(/i.test(p) && ...
```

The match is the CSS function name `linear` inside the tokens lint rule's own regex. It names no product. `packages/core/package.json` declares `files: ["dist", "schemas", "templates", "README.md"]` and the CLI depends on core, so this bundle does ship — the disposition is a ruling, not an oversight. Three routes were put and rejected:

| Route | Verdict |
|---|---|
| Tighten the scan to `(?<![\w-])name(?![\w-])` | Does **not** clear the match — `:` precedes `linear` and `\|` follows it, and the hyphen sits after the `)`. It also loses real detections, such as a hyphenated product name in prose. |
| Reword the lint rule to `/^[a-z]+-gradient\(/i` | Clears it, but edits a working rule to satisfy a scan and loosens what the rule accepts. |
| Allowlist the match | Forbidden by owner ruling GAP-2a: a constraint with an exception is one nobody can enforce later. |

The scan stays scoped to the CLI bundle, the tokens lint rule is unmodified, and Phase 9 inherits a conclusion rather than a question.

**No allowlist, skip list or exception entry exists** anywhere in the new case or in `test/helpers/denied.ts`. `DENIED` is declared in exactly one place.

## Deviations from Plan

None — the plan executed as written. Two facts differed from what the plan was written against, both of which the plan anticipated and instructed the executor to record rather than treat as failures:

1. The offender landed at **line 424**, not 419. 07-12 edited `skills.ts` above it, exactly as the plan said it would. Every check matched the path prefix, so the correct RED was read as correct.
2. `packages/core/test/helpers/denied.ts` was **untracked**, not tracked — it is part of the uncommitted Phase 6/7 work. The move was a plain `mv`, not `git mv`, which keeps the working tree unstaged as the dispatch requires.

## Findings for the owner

**1. Not committed, by instruction.** `actuals.commits: 0` is deliberate: the dispatch suspended this executor's commit protocol under the repository owner's standing rule, and the ~50 uncommitted files from phases 6 and 7 are still awaiting review. All work from this plan is in the working tree, unstaged. HEAD is unchanged at `53e9df9`.

**2. `packages/core/src/model/snapshot.ts:42` still carries a denied name in a line comment** — `design?: string; // 'https://www.figma.com/file/abc'`. This is the finding 07-13 raised; this plan did **not** action it, and nothing here made it newly in scope. Verified at execution time: core's built bundle returns only the line-1259 gradient match, so the comment is confirmed absent from `packages/core/dist/index.js` — tsdown strips line comments, and `src/` is outside core's `files:` list. It is developer-only text today. The residual risk is that it would become a published byte if that comment were ever reflowed into a block comment, which is precisely the mechanism that produced gap 2. Raising it for the owner's decision; no file this plan does not name was edited.

**3. The scan's honest ceiling.** No test can prove `dist` matches `src`. A bundle that is present but older than its source passes the new case. Freshness comes from `npm run build` preceding `npm test`, which both CI jobs and every verify command in this plan do. The test says so in its own comment rather than implying the scan is stronger than it is.

## Issues Encountered

None in the repository. One in tooling worth noting for a future executor: ad-hoc `node -e "..."` scans written from the Bash tool lost their `\\b` escapes, producing a scanner whose regex source was `Figma` rather than `\bFigma\b` and which reported false clean results. The re-scan that produced the GAP-2d evidence above builds the boundary with `String.fromCharCode(92) + 'b'` and carries a self-test line that must print `true` before its results are read. The repository's own `test/helpers/denied.ts` was never affected — its `'\\b'` is correct on disk and is what the vitest RED and GREEN ran through.

## User Setup Required

None.

## Next Phase Readiness

- Gap 2 of `07-VERIFICATION.md` is closed on both halves the owner ruled: the scan exists over the published bundle, and the name that was there is gone.
- Phase 9 (publish) inherits a green bundle and a settled GAP-2d decision.
- `test/helpers/` holds this one file by design. It is not a default home for future shared helpers; `packages/cli/test/init.test.ts` and `skills-sync.test.ts` deliberately keep their own local `listing` copies, and that stays true.

## Self-Check: PASSED

Each key-file exists on disk and appears in `git status --short --untracked-files=all` (commit verification replaced per the dispatch's override):

| File | On disk | In `git status --short` |
|---|---|---|
| `test/helpers/denied.ts` | yes | `?? test/helpers/denied.ts` |
| `packages/cli/test/bin.test.ts` | yes | `M packages/cli/test/bin.test.ts` |
| `packages/cli/src/render/table.ts` | yes | `M packages/cli/src/render/table.ts` |
| `packages/core/test/templates.test.ts` | yes | `M packages/core/test/templates.test.ts` |
| `packages/core/test/examples.test.ts` | yes | `?? packages/core/test/examples.test.ts` |
| `packages/core/test/scaffold.test.ts` | yes | `?? packages/core/test/scaffold.test.ts` |
| `packages/core/test/skills.test.ts` | yes | `?? packages/core/test/skills.test.ts` |
| `packages/core/src/scaffold/pointer.ts` | yes | `?? packages/core/src/scaffold/pointer.ts` |
| `packages/core/test/helpers/denied.ts` | **absent, as required** | n/a (was untracked) |

The `??` entries are files created by earlier uncommitted plans in phases 6 and 7; this plan edited them in place.

`.planning/phases/07-scaffolding-and-example-repo/07-14-SUMMARY.md` exists. Nothing was committed: `git rev-parse HEAD` is `53e9df94051d2b1fc66f2e50c895684b74ee6b72`, unchanged from dispatch.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-19*
