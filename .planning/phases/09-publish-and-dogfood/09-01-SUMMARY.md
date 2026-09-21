---
phase: 09-publish-and-dogfood
plan: 01
subsystem: infra
tags: [npm, publishing, tsdown, bundling, package-manifest]

requires:
  - phase: 06-skills
    provides: "skills as data in core, which is part of what now gets inlined into the published bundle"
  - phase: 07-scaffolding-and-example-repo
    provides: "the D-94 version pin and the config.yml/accord.yml version strings the 0.1.1 bump will have to move"
provides:
  - "@accord-dev/accord is installable: one runtime dependency, no unpublishable name in the manifest"
  - "@accord-dev/accord-core is private: true and can never reach the registry"
  - "core inlined into dist/cli.js via tsdown deps.alwaysBundle — 29.95 kB to 847.03 kB"
  - "three guards that keep the install path from regressing, and two version literals re-anchored ahead of the 0.1.1 bump"
affects: [09-04 publish workflow, 09-06 release checks, 09-11 the 0.1.1 bump]

actuals:
  tokens: 1741      # chars/4 over the realized diff (6965 chars across 7 files); estimate was 55000
  tasks: 3
  commits: 0        # repository forbids commits; all work left uncommitted in the working tree
  plan_head_before: 2a5040af51e33ee7cfe7db5c5a56024326ff8959

tech-stack:
  added: []
  patterns:
    - "deps.alwaysBundle, not the deprecated noExternal spelling, for workspace packages that are never published"
    - "test assertions read the version from the manifest (pkg.version) rather than repeating it as a literal"

key-files:
  created:
    - .planning/phases/09-publish-and-dogfood/09-01-SUMMARY.md
  modified:
    - packages/cli/package.json
    - packages/core/package.json
    - packages/cli/tsdown.config.ts
    - packages/cli/test/bin.test.ts
    - packages/cli/test/new-ticket.test.ts
    - packages/core/test/bundle.test.ts
    - package-lock.json

key-decisions:
  - "Task 1 checkpoint answered `proceed` by the user: D-150 (core private), D-164 (core to devDependencies), and deps.alwaysBundle as the spelling."
  - "The reason core's version stays at 0.1.0 permanently is recorded as a comment beside the assertion that enforces it (packages/core/test/bundle.test.ts), because JSON admits no comment and this repository takes no commits."
  - "package-lock.json was resynced with `npm install`: npm ci validates lock against manifest, and D-152's publish job runs npm ci."

patterns-established:
  - "Version literals in tests: re-anchor to pkg.version or match on the key, never on the digits."

requirements-completed: []   # OPS-03 deliberately NOT ticked — see "Requirement status" below

coverage:
  - id: D1
    description: "A tarball packed from packages/cli installs into an empty directory with no registry 404 and the installed binary prints its version"
    requirement: OPS-03
    verification:
      - kind: integration
        ref: "npm pack --workspace packages/cli && npm install --no-save *.tgz && node node_modules/@accord-dev/accord/dist/cli.js --version"
        status: pass
    human_judgment: false
  - id: D2
    description: "packages/cli declares exactly one runtime dependency and the OPS-03 engines floor, both read by a test"
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "packages/cli/test/bin.test.ts#declares exactly one runtime dependency and the OPS-03 engines floor (D-164)"
        status: pass
    human_judgment: false
  - id: D3
    description: "packages/core is private and therefore unpublishable, while keeping the exports map tsdown resolves it through"
    verification:
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#manifest shape"
        status: pass
      - kind: integration
        ref: "npm publish --workspace packages/core --dry-run"
        status: pass
    human_judgment: false
  - id: D4
    description: "dist/cli.js still starts with the shebang and still names no other tool after core's dependency tree is inlined into it"
    verification:
      - kind: unit
        ref: "packages/cli/test/bin.test.ts#starts with a shebang"
        status: pass
      - kind: unit
        ref: "packages/cli/test/bin.test.ts#the published bundle names no other tool, plugin, harness, or planning system (CLAUDE.md)"
        status: pass
    human_judgment: true
    rationale: "The guard went red on one hit, `linear-gradient` in accord's own token-lint rule, matched case-insensitively by the `Lin`+`ear` entry in DENIED. FINDING F-1 put it to the author, who chose to drop the `i` flag from the scan so every DENIED entry matches only its canonical proper-noun spelling. Full suite now 890/890."

duration: 12min
completed: 2026-09-21
status: complete
---

# Phase 9 Plan 1: One Installable Package Summary

**`@accord-dev/accord` now installs from a tarball with no registry 404 — core is private, moved to `devDependencies`, and inlined into a single 847 kB `dist/cli.js` — but the bundle's `names no other tool` guard goes red on one false positive that needs an author decision.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3 of 3 executed
- **Commits:** 0 — this repository forbids them; all work is uncommitted in the working tree

## Accomplishments

### Task 1 — the one-way door, answered `proceed`

Not re-asked. The orchestrator put the `checkpoint:decision` to the author before this executor
started and the answer was **`proceed`**: D-150 (core `private: true`, never published), D-164 (core
moves to `devDependencies`), and `deps.alwaysBundle` as the spelling. The `keep-core-public` and
`noexternal-spelling` options were both declined.

### Task 2 — one installable package, proven by installing it

`packages/cli/package.json` `dependencies` went from two keys to one; `@accord-dev/accord-core`
moved to a new `devDependencies` object at `"0.1.0"`. `files`, `engines`, `bin`, `type`, `license`,
`version` and `scripts` are untouched.

`packages/core/package.json` gained `"private": true` on line 4. `exports`, `files` and
`dependencies` are untouched — `exports["."]` is how tsdown resolves the workspace package to
`../core/dist/index.js`, so removing it would break the build, which is the trap D-150's "what is
lost" wording sets for a careless reader.

`packages/cli/tsdown.config.ts` gained `deps: { alwaysBundle: ['@accord-dev/accord-core'] }` with a
house-voice comment naming the failure mode. The bundle went from **29.95 kB to 847.03 kB**, and
tsdown listed exactly the seven inlined packages the plan's threat model predicted: `ajv`,
`fast-deep-equal`, `json-schema-traverse`, `fast-uri`, `yaml`, `@cucumber/gherkin`,
`@cucumber/messages`. No deprecation warning was emitted. The `deps.onlyBundle` hint appeared and is
tolerated per the plan.

### Task 3 — the guards

- `packages/cli/test/bin.test.ts`: `import pkg from '../package.json' with { type: 'json' }` added;
  `--version` re-anchored from the `'0.1.0'` literal to `pkg.version`; two new cases — one asserting
  `Object.keys(pkg.dependencies)` is `['commander']` and `pkg.engines.node` is `>=22.12.0`, one
  asserting the bundle carries no `from '@accord-dev/accord-core'` import specifier.
- `packages/cli/test/new-ticket.test.ts:170`: the pin-mismatch case's `setConfig` search pattern
  loosened from `/^accord: "0\.1\.0"$/m` to `/^accord: .*$/m`.
- `packages/core/test/bundle.test.ts`: `expect(pkg.private).toBe(true)` added to `manifest shape`,
  beside the `exports` assertions it explains must stay.

`bin.test.ts` now reports 7 tests, above the plan's floor of 6.

## RED → GREEN evidence

No commits were made, so the RED/GREEN discipline was kept by ordering and recorded output.

**RED — the defect, before any fix.** Packing and installing the tarball against the unchanged
manifest:

```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@accord-dev%2faccord-core - Not found
npm error 404  The requested resource '@accord-dev/accord-core@0.1.0' could not be found
```

This is Landmine 1's exact signal. The 29.95 kB bundle also carried `from "@accord-dev/accord-core"`.

**RED — the guards, written before the fix.** The two new `bin.test.ts` cases were written and run
against the unchanged tree, three times for stability, failing identically each time:

```
FAIL test/bin.test.ts > accord bin > declares exactly one runtime dependency and the OPS-03 engines floor (D-164)
AssertionError: expected [ '@accord-dev/accord-core', …(1) ] to deeply equal [ 'commander' ]
FAIL test/bin.test.ts > accord bin > the bundle inlines core rather than importing it (D-150)
AssertionError: expected '#!/usr/bin/env node\nimport { POINTER…' not to match /from ['"]@accord-dev\/…
Tests  2 failed | 5 passed (7)
```

**GREEN — after the fix.** `added 2 packages`, no 404, and the installed binary printed `0.1.0`.

## must_haves truths — each verified by a command that was run

| Truth | Command | Result |
|---|---|---|
| A tarball installs with no registry 404 and the binary prints its version (D-150, D-164) | `npm pack --workspace packages/cli --pack-destination "$T"` → `npm install --no-save "$T"/*.tgz` → `node node_modules/@accord-dev/accord/dist/cli.js --version` | `added 2 packages, and audited 3 packages`, then `0.1.0`, exit 0 |
| Exactly one runtime dependency, and an engines floor a test reads (OPS-03) | `node -p "JSON.stringify(Object.keys(require('./packages/cli/package.json').dependencies))"` and `node -p "require('./packages/cli/package.json').engines.node"` | `["commander"]` and `>=22.12.0`; both asserted by `bin.test.ts`, passing |
| core is private and therefore unpublishable, exports kept | `node -p "require('./packages/core/package.json').private"`; `node -p "JSON.stringify(require('./packages/core/package.json').exports['.'])"`; `npm publish --workspace packages/core --dry-run` | `true`; `{"types":"./dist/index.d.ts","default":"./dist/index.js"}`; `npm warn publish Skipping workspace @accord-dev/accord-core, marked as private` |
| Shebang survives, and the bundle names no other tool | `head -1 packages/cli/dist/cli.js`; `npx vitest run --project cli bin` | `#!/usr/bin/env node` — **pass**. The names-no-other-tool half is **RED**: see FINDING F-1 |

Supporting runs: `npm run lint` clean, `npm run typecheck` clean, `npm test` **889 passed / 1 failed
(890)** — the single failure is F-1 and nothing else regressed. `npm pack` lists a two-file tarball
(`dist/cli.js` 847.0 kB, `package.json` 351 B), satisfying T-09-03's "the reader's chance to notice a
surprise". `README.md` is absent because it does not exist yet; 09-03 creates it.

## FINDING F-1 — the denied-names guard was red on a false positive (RESOLVED by the author)

**Resolution, 2026-09-21.** The orchestrator put the three options to the author, who chose a fourth that
subsumes B: drop the `i` flag in `deniedNames` so the scan is case-sensitive for **every** entry. Each name
in `DENIED` is a proper noun with one canonical spelling, so no coverage is lost, `DENIED` stays a flat
`readonly string[]`, and the whole ordinary-word false-positive class goes with it. One character removed,
plus a paragraph in the file recording why. Full suite: **890 passed (890)**, 36 files. The account below
is kept as the record of how the collision was found.

**Not fixed, deliberately.** Per CLAUDE.md, a failing test against existing code is a finding, never
a licence to change production code to make it pass.

**What fails.** `packages/cli/test/bin.test.ts` → `the published bundle names no other tool, plugin,
harness, or planning system (CLAUDE.md)`.

- Expected: `[]`
- Actual: `["packages/cli/dist/cli.js:21704: Linear"]`

**Root cause.** The hit is the CSS function name `linear-gradient`, in accord's **own** token-lint
rule at `packages/core/src/lint/tokens.ts:97`:

```ts
else if (kind === 'color' && /^(?:linear|radial|conic)-gradient\(/i.test(p) && ...
```

`test/helpers/denied.ts` matches `'Lin' + 'ear'` case-insensitively with word boundaries, so the CSS
grammar term trips the entry meant for the design tool of that name. It is one hit; a
case-insensitive scan of the whole 847 kB bundle finds no other.

**Why the plan did not predict it.** T-09-01 recorded that "the probe build confirmed zero hits
across 847 kB of **inlined third-party source**". The probe was looking in the wrong place: the hit
is not in third-party source, it is in accord's own core. Before this change core was an external
import, so the CLI-bundle scan had never covered accord's own implementation — only its shipped text
surfaces (templates, rendered skills, scaffold output, example repos). Bundling widens that scan from
"accord's prose plus third-party code" to "accord's entire implementation", and the widening is what
surfaced the collision. The plan's `prohibitions` block marked this `status: resolved,
verification: judgment`; the judgment rested on incomplete evidence.

**Is the constraint actually violated?** Arguably not. CLAUDE.md's rationale is about prose a reader
meets — "a reader meeting the name of something they do not have learns nothing". A lowercase CSS
function inside a compiled regex names a CSS function, not a tool. Only the automated proxy fires.
But the proxy is the guard, and reconciling them is a project-constraint call.

**Options, for the author to choose:**

| Option | Change | Pro | Con |
|---|---|---|---|
| **A** — drop `Lin`+`ear` from `DENIED` | one line in `test/helpers/denied.ts` | Follows a precedent already documented in that same file: `Shortcut` is deliberately absent because it is ordinary English that would flag innocent prose | The design-tool class of name loses half its coverage, resting on `Fig`+`ma` alone |
| **B** — make that one entry case-sensitive *(recommended)* | the tool is `Linear`; the CSS function is `linear` | Keeps the guard and kills this whole ordinary-word class of false positive | `DENIED` stops being a flat string list; `Linear` opening a sentence would still flag |
| **C** — scan only comments and string literals, not identifiers or regex literals | closest to the stated intent ("a comment surviving minification") | Most precise | Needs a JS tokeniser inside a test helper — far more machinery than the constraint warrants |

All three touch a guard shared by five test files, which is why this stopped rather than being
auto-fixed under deviation Rule 1.

## Deviations from Plan

**1. [Rule 3 — Blocking] `package-lock.json` resynced**

- **Found during:** Task 2, after the manifest edit
- **Issue:** `package-lock.json:3192` still recorded `@accord-dev/accord-core` under `dependencies`
  for `packages/cli`. `npm ci` fails when lock and manifest disagree, and D-152's publish job runs
  `npm ci && npm run check` — so the tag build would have failed on a file the plan never mentioned.
- **Fix:** `npm install`. Output: `up to date, audited 169 packages`, `found 0 vulnerabilities` — the
  same package count as before, so nothing new was fetched. The plan's threat model line "this plan
  installs no new external package" still holds.
- **Files modified:** `package-lock.json` (4 lines)

**2. [Documentation placement] core's frozen version reason**

- **Found during:** Task 2
- **Issue:** The plan asked for "a JSON sibling comment where the file allows one, or record the
  reason in the commit body if it does not". JSON admits no comment, and this repository takes no
  commits, so both branches were unavailable.
- **Fix:** Recorded as a comment beside the assertion that enforces it,
  `packages/core/test/bundle.test.ts` `expect(pkg.version).toBe('0.1.0')` — which is where a reader
  who tries to bump core's version actually lands.
- **Files modified:** `packages/core/test/bundle.test.ts`

**3. [Ordering] Task 3's tests written before Task 2's implementation**

Both tasks carry `tdd="true"`. Writing Task 3's guards after Task 2's fix would have made them green
on arrival and proved nothing. They were written first and run red against the unchanged tree (output
above), then Task 2's edits turned them green. The plan's own acceptance criterion — "verify by
reasoning about the assertion, not by actually reverting" — is superseded by having actually observed
the RED.

## Observations

**One transient test failure, not reproduced.** The first run of `--project cli bin` reported
`3 failed | 4 passed`; three immediately subsequent runs all reported `2 failed | 5 passed`
identically. The extra failure ordered before the dependency case, so it was one of the two cases
that spawn `node dist/cli.js` — most plausibly a momentary break in the
`node_modules/@accord-dev/accord-core` workspace symlink while the concurrent `npm pack` ran. It is
structurally gone now: after bundling, `dist/cli.js` has no external import left to resolve. Recorded
rather than chased.

## Requirement status

This plan's frontmatter carries `requirements: [OPS-03]`, and the executor contract says to tick
those on completion. **OPS-03 was left unticked.** It reads *"Scoped package **published** via npm
trusted publishing; `engines` at Node 22.12 or later"* — this plan delivers the engines half and the
installability the publish depends on, but nothing is on the registry until 09-04 builds the workflow
and 09-06 runs it. Ticking it here would have recorded a publish that has not happened. The mark was
applied by `requirements mark-complete` and then reverted in `.planning/REQUIREMENTS.md` (line 91 back
to `- [ ]`, traceability row 211 back to `Pending`). OPS-03 belongs to whichever plan actually
publishes.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. T-09-02 (the install
404) is the defect this plan closed; T-09-01 is open as FINDING F-1; T-09-03's `files` field is
unchanged and the packed tarball was listed.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/cli/package.json` — FOUND, `dependencies` has one key
- `packages/core/package.json` — FOUND, `private: true`
- `packages/cli/tsdown.config.ts` — FOUND, contains `alwaysBundle`
- `packages/cli/test/bin.test.ts` — FOUND, 7 tests, no `toBe('0.1.0')`
- `packages/cli/test/new-ticket.test.ts` — FOUND, `setConfig` pattern carries no digits
- `packages/core/test/bundle.test.ts` — FOUND, `private` assertion present
- `packages/cli/dist/cli.js` — FOUND, 847.03 kB, shebang intact
- Commits: **0 by design.** `git rev-parse HEAD` is `2a5040af51e33ee7cfe7db5c5a56024326ff8959`,
  identical to the value at plan start. All work is uncommitted in the working tree.

## Blocker

`npm test` is not fully green: 889 of 890 pass, and the one failure is FINDING F-1, which needs the
author to pick option A, B or C above. Everything the plan asked this executor to build is built and
independently verified; nothing else in the phase is blocked by it, but the phase should not reach
09-06's release checks with this red.
