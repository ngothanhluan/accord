---
phase: 07-scaffolding-and-example-repo
plan: 03
subsystem: infra
tags: [scaffolding, ci, github-actions, yaml-emission, security, version-pin]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    plan: 01
    provides: "`initFiles({name, version})` returning a sorted `ScaffoldFile[]`, the compute-then-render `init` write loop, `assertNoLink`, `makeEmptyRepo()`"
  - phase: 07-scaffolding-and-example-repo
    plan: 02
    provides: "the three-entry scaffold list this plan extends to four, the whole-report assertions in `init.test.ts`, and `init`'s read-back refusals"
  - phase: 05-cli
    provides: "`pinMessage` and the `npx --yes <name>@<version>` phrasing the workflow's invocation matches"
provides:
  - "`workflowYml(pkgName, version)` in `packages/core/src/scaffold/workflow.ts`: the whole generated GitHub Actions document as a pure source literal"
  - "`.github/workflows/accord.yml` as the fourth `initFiles` entry, sorted first"
  - "a parse-and-shape test suite in core that inspects the emitted document as YAML rather than grepping it as a string"
  - "an executed-not-grepped script body: the emitted `run:` block was extracted and run under bash against four real diff shapes (see Verification Results)"
affects: [07-04, 07-06, 07-07, 07-08, 09-publish]

actuals:
  tokens: 3160   # chars/4 over ~12,655 chars of realized diff; the 70,000 estimate is a different scale, see F-5
  tasks: 3
  commits: 0     # commits are forbidden in this project until the owner approves the diff
  plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

tech-stack:
  added: []
  patterns:
    - "an artifact executed by something other than accord is asserted by parsing it back into a document and inspecting keys, never by substring presence — a substring says nothing about which key it landed under"
    - "a forbidden sequence is built by concatenation in the test that scans for it, so the scanner does not flag itself (the `skills.test.ts` split-literal convention, now applied to the Actions expression delimiter)"
    - "an emitted document explains what it DOES and never what it omits: a comment naming an omission puts the omitted token back into the text that greps for its absence"

key-files:
  created:
    - packages/core/src/scaffold/workflow.ts
  modified:
    - packages/core/src/scaffold/init.ts
    - packages/core/test/scaffold.test.ts
    - packages/cli/test/init.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The grep in the emitted script uses the POSIX ERE bracket expression `[.]md$` rather than the plan's `\\.md$`. Exactly equivalent under `grep -E`, and it is the only form that satisfies the plan's own Task 2 behaviour 'no line of the emitted workflow contains a backslash' and the pre-existing D-51 case that asserts it over every `initFiles` entry — see Deviation 1"
  - "The emitted script carries three explanatory comments (why not `set -e`, why `--diff-filter=d` and `[^/]+`, why a here-string). They cost four lines of a document a person will open in their own repository and they are the difference between a script someone maintains and one someone deletes. None names an omission, per the plan's explicit instruction"
  - "The script body was not left to 07-07 to be run for the first time: the real emitted `run:` string was extracted from the parsed YAML, its `npx` invocation replaced with a stub, and executed under bash against a ticket-adding, docs-only, ticket-deleting and nested-path diff. 07-07 still owns the formal four-shape fixture; this is evidence that what it will pick up is not already broken"
  - "`init.test.ts`'s D-132 case moved from `lines(out)[0]` to `toContain`: the workflow now sorts ahead of the config, and an index-based assertion on a growing report asserts the order of the list rather than the fact the case is about"

requirements-completed: [CLI-02]

coverage:
  - id: D1
    description: "`accord init` writes `.github/workflows/accord.yml` in a repository that has neither `.github` nor `.github/workflows`, and a second run skips it"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#creates .github/workflows/accord.yml in a repository that has neither directory"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#skips it on a second run and leaves the bytes alone (D-130)"
        status: pass
      - kind: e2e
        ref: "throwaway `git init` directory: `created .github/workflows/accord.yml` then `skipped .github/workflows/accord.yml`, exit 0 both times"
        status: pass
    human_judgment: false
  - id: D2
    description: "The generated workflow triggers on `pull_request` and on nothing else (D-136)"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#triggers on pull_request and on nothing else (D-136)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The generated workflow runs `lint` and `gate done` and never `gate ready` (D-140, CLI-02 word for word)"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#runs lint and gate done, never gate ready (D-140)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The tickets gated are those in `git diff --name-only --diff-filter=d <base>...HEAD` matching `accord/tickets/<id>.md` at exactly one path level, with the id taken from the file name (D-137)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "the emitted `run:` body executed under bash against a diff adding `accord/tickets/T-1.md`, `accord/tickets/T-2.md`, `accord/tickets/T-1/verification.md` and `docs.md` — output was exactly `gate done T-1` and `gate done T-2`"
        status: pass
    human_judgment: false
  - id: D5
    description: "The emitted document cannot skip its own job: no `paths:` filter anywhere, and a no-ticket branch that echoes and exits (D-138)"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "the Task 1 absence criteria, checked over the emitted text: `paths:` absent, `nothing to gate` present"
        status: pass
      - kind: e2e
        ref: "the emitted `run:` body executed against a docs-only diff: printed `no ticket file changed in this pull request - nothing to gate`, exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "A ticket file DELETED by the diff is not gated (A-09, CLI-02 deleted-file edge)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "the emitted `run:` body executed against a diff whose only change is `git rm accord/tickets/T-2.md`: `nothing to gate`, exit 0 — no `gate.ticket-unknown`"
        status: pass
    human_judgment: false
  - id: D7
    description: "The checkout step sets `fetch-depth: 0` as a number, so `<base>...HEAD` resolves (T-07-14)"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#checks out deep enough for its own diff (T-07-14) — `toBe(0)`, not `'0'`"
        status: pass
    human_judgment: false
  - id: D8
    description: "The job invokes accord as `npx --yes <package>@<pinned version>`, and that version and the `accord:` value in the generated `config.yml` are the same string from a single `initFiles` call (D-135, D-139)"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#pins the same version the config does, from one initFiles call (D-135) — version extracted by regex, never restated"
        status: pass
    human_judgment: false
  - id: D9
    description: "`permissions: contents: read` and nothing more; the base sha travels through `env:` and no `run:` body contains a GitHub Actions expression (T-07-11, T-07-13)"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#requests read on contents and nothing more (T-07-13)"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#carries no Actions expression in any script body (T-07-11)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The workflow is LF, BOM-free, backslash-free, and ends in exactly one newline, on the disk of a real repository"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#is LF, ends in exactly one newline, and carries no carriage return"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#no backslash in any path or any emitted line (D-51) — the pre-existing whole-list case, which the workflow entry now flows through"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#writes LF on any host, with no carriage return in the file (FMT-08)"
        status: pass
    human_judgment: true
    rationale: "Windows-observed only; the POSIX leg of the line-ending assertions has never run because nothing is committed (WINDOWS.md entry 9)."
  - id: D11
    description: "The CLI still never spawns npm or npx — the string exists only inside emitted text"
    requirement: CLI-02
    verification:
      - kind: other
        ref: "`grep -rn npx packages/cli/src packages/core/src` returns only `scaffold/workflow.ts` (emitted text) and `pin.ts` (refusal message); `spawn-surface.test.ts` unchanged and green"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 03: the generated pull-request workflow Summary

**`accord init` now writes `.github/workflows/accord.yml` — a least-privilege, expression-free, version-pinned GitHub Actions job that lints the repository and runs `gate done` on exactly the tickets a pull request touches — emitted from core as a source literal, asserted by parsing the document back rather than grepping it, and with its shell body actually executed against four real diff shapes.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3 of 3
- **Files:** 1 created, 4 modified

## Accomplishments

- **The workflow is a document, and it is tested as one.** Ten new cases in `packages/core/test/scaffold.test.ts` parse the emitted text with `yaml`'s default core schema and inspect keys: `Object.keys(doc.on)` is exactly `['pull_request']`; `doc.permissions` deep-equals `{ contents: 'read' }`, so an added write scope fails rather than passing beside a `contents` lookup; `steps[0].with['fetch-depth']` is the number `0`, not the string. A substring test would have said nothing about which key any of those landed under.
- **The script body was run, not only grepped.** The plan reserves the behavioural half of D-138 for 07-07, and the brief said to write the script as if it will be executed. It was: the real `run:` string was pulled out of the parsed YAML, its two `npx --yes` invocations replaced with a stub, and executed under bash in a throwaway git repository against a ticket-adding diff (`gate done T-1`, `gate done T-2` — with `accord/tickets/T-1/verification.md` and `docs.md` correctly excluded by the `[^/]+` bound), a docs-only diff (`nothing to gate`, exit 0), a ticket-deleting diff (`nothing to gate`, exit 0 — A-09 holds, `--diff-filter=d` does exclude it), and a failing-gate run inside the loop (exit 1 — the here-string's assignment to `code` survives, which a pipe would have lost). 07-07 still owns the formal fixture; what it inherits is known to work.
- **D-135 is structural, not conventional.** `initFiles` destructures `name` as well as `version` and hands both to `workflowYml`, so the config pin and the workflow pin are two renderings of one pair of strings. The test proves the equality from a single `initFiles` call and extracts the workflow's version by regex, so it asserts equality rather than restating the input on both sides.
- **T-07-11 is closed at the shape level.** The one GitHub Actions expression in the document sits in `env: BASE:` and the script reads `"$BASE"`. A test scans every step's `run` for the expression opening delimiter, and builds that delimiter by concatenation so the test file does not contain the sequence it forbids.
- **The emitted document is one a person would keep.** Named job and step, a comment on the `fetch-depth` line saying what breaks if it is deleted, three short comments in the script saying why it is not `set -e`, why the filter excludes deletions, and why the loop reads a here-string. Nothing in it explains an absence — per the plan's instruction, the reasoning for the two omissions (`paths:`, `gate ready`) lives in `workflow.ts`'s module header where no grep over the emitted text can reach it.

## Task Completion

**No commits were made.** This project forbids `git commit` until the owner has reviewed the diff (global CLAUDE.md critical rule, restated as a hard override in the execution brief). HEAD is still `53e9df9`. Per-task completion, tracked here instead of in git history:

1. **Task 1 — author the generated workflow as a core source literal** — complete. `workflow.ts` created, `initFiles` extended to four entries. All ten Task 1 acceptance criteria checked against the emitted text: four sorted paths exactly as specified, `npx --yes x@9.9.9` exactly twice, `fetch-depth: 0` / `--diff-filter=d` / `nothing to gate` present, `gate ready` / `paths:` / backslash / CR absent, one trailing newline. `packages/core/templates/` still holds the same seven files; `gen-templates.mjs` unmodified.
2. **Task 2 — parse the emitted workflow back and assert its shape** — complete. `scaffold.test.ts` 12 cases to 22.
3. **Task 3 — prove the CLI writes and then skips the workflow, and tick CLI-02** — complete. `init.test.ts` 14 cases to 18; CLI-02 ticked in `.planning/REQUIREMENTS.md`.

## Files Modified

- `packages/core/src/scaffold/workflow.ts` *(new, 4,420 bytes)* — `workflowYml(pkgName, version)`, one template literal, no import at all. Module header records A-08's three reasons for a source literal over a template asset, and both omissions, deliberately outside the returned string.
- `packages/core/src/scaffold/init.ts` — destructures `name`; a fourth entry at `.github/workflows/accord.yml` with a comment naming why both strings come from the one call.
- `packages/core/test/scaffold.test.ts` — the whole-list path case widened to four entries; a new `describe` with the ten shape cases and narrow local `Step`/`Workflow` interfaces (cast through `unknown`, no eslint disable needed).
- `packages/cli/test/init.test.ts` — `WORKFLOW` constant, `SCAFFOLD` widened to four in code-point order, the deleted-path slice and the D-132 assertion adjusted, and a new `describe` with the four workflow cases.
- `.planning/REQUIREMENTS.md` — CLI-02 `- [ ]` to `- [x]`, traceability row `Pending` to `Complete`. Nothing else.

## Decisions Made

- **`[.]md$` rather than `\.md$` in the emitted grep.** See Deviation 1 and F-1 — the plan specified both a backslash-escaped dot and a no-backslash-anywhere assertion, and only the bracket expression satisfies both. It is the standard POSIX ERE way to match a literal dot and is exactly equivalent under `grep -E`.
- **Three comments inside the emitted script, not zero.** The plan mandated one (on `fetch-depth`) and forbade any that names an omission. The three added are all positive statements about behaviour a reader would otherwise "simplify" — `set -uo pipefail` looks like a missing `-e`, `--diff-filter=d` looks like a typo for `-D`, and a here-string looks like a pipe written oddly. Each of those "corrections" is a real bug, and all three are cheaper to prevent in four lines than to diagnose on someone else's pull request.
- **`node-version: 24` and `runs-on: ubuntu-latest`, matching A-11 and this repository's own `ci.yml` step versions (`actions/checkout@v7`, `actions/setup-node@v7`).** No matrix: this runs in a user's repository to test their tickets, not accord's portability.
- **No `cache: npm` on the setup-node step**, unlike this repository's `ci.yml`. D-139's whole point is that the user's repository needs no `package.json`, and `actions/setup-node` with `cache: npm` fails the step outright when it finds no lockfile — the cache line would break the very repositories the workflow is written for.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The plan's grep pattern and the plan's own no-backslash criterion contradict each other**

- **Found during:** Task 1
- **Issue:** Task 1's action specifies `grep -E '^accord/tickets/[^/]+\.md$'`, and Task 2's behaviour list requires "No line of the emitted workflow contains a backslash". The pre-existing case `scaffold.test.ts#no backslash in any path or any emitted line (D-51)` iterates *every* `initFiles` entry, so the fourth entry inherits it automatically — the escaped dot would have turned that case red on the first run, on every host.
- **Fix:** `grep -E '^accord/tickets/[^/]+[.]md$'`. A bracket expression containing a single `.` matches a literal dot in POSIX ERE, identically to `\.`, with no backslash in the emitted document. Verified by execution, not by reading: the running script correctly excludes `accord/tickets/T-1/verification.md` and `docs.md` while including `accord/tickets/T-1.md`.
- **Files modified:** `packages/core/src/scaffold/workflow.ts`
- **Verification:** both the D-51 case and the four-diff-shape smoke run pass.

**2. [Rule 3 — Blocking] Two 07-01/07-02 report assertions were index-based over a list this plan grows at the front**

- **Found during:** Task 3
- **Issue:** `.github/...` sorts before `accord/...`, so the workflow line is now the *first* line of every report. `init.test.ts#leaves a hand-written config.yml untouched and follows its roster (D-132)` asserted `lines(out)[0]).toBe('skipped ' + CONFIG)`, and the deleted-path case asserted a three-element slice.
- **Fix:** The D-132 case moved to `expect(lines(out)).toContain('skipped ' + CONFIG)` — the case is about the config being skipped, not about where in the list it appears; the deleted-path case kept its `slice(0, SCAFFOLD.length)` discipline with the workflow line added, because that case *is* about the per-path created/skipped mix. The whole-report `toEqual` in the first-run case needed no loosening: `SCAFFOLD` is one constant and it gained one entry.
- **Files modified:** `packages/cli/test/init.test.ts`
- **Verification:** `npm test` — 34 files, 836 tests, 836 passed.

---

**Total deviations:** 2 auto-fixed, both Rule 3 (blocking), both discovered by running rather than by reading. Deviation 1 touches the emitted production text; Deviation 2 is test-only. No plan decision was reinterpreted.

## Findings

**F-1 — the plan specified a shell pattern that its own acceptance criteria forbid.** Recorded as a finding as well as a deviation because it is a property of how the plan was written, not of this execution: Task 1's action text and Task 2's behaviour list disagree, and nothing in the plan flags the conflict. The resolution chosen (`[.]` over `\.`) preserves every stated criterion; the alternative — exempting the workflow entry from the D-51 backslash case — would have weakened a cross-cutting invariant to accommodate one character. Raising it so the owner can confirm the substitution rather than discover it in a diff.

**F-2 — four unspecified behaviours were settled by the plan's own surfaced assumptions and are now evidenced by execution, not assumed.** Per the project's "document uncertain business logic" rule, each is named with what it does and what it could have done instead:
  1. *A PR that touches no ticket* → the job runs, prints `no ticket file changed in this pull request - nothing to gate`, and exits with whatever `lint` returned (**not** unconditionally 0). Alternative: exit 0 always, which would hide a lint failure on a docs-only PR. Observed: exit 0 with a clean lint, exit 1 with a failing one.
  2. *A deleted ticket* → not gated (A-09). Alternative: gate it and require a justification, which would fail the pull request that removes an obsolete ticket. Observed: `nothing to gate`, exit 0.
  3. *Partial failure* → the exit code is the worst of `lint` and every gate; neither short-circuits the other (A-10). Alternative: `set -e`, one problem reported per push. Observed: a failing gate inside the here-string loop yields exit 1, so the loop's assignment to `code` survives.
  4. *The `[^/]+` level bound* → exactly one path level, so `accord/tickets/<id>/verification.md` is excluded and `accord/tickets/<id>.md` included. Observed against a real diff containing both.

**F-3 — the behavioural half of D-138 now has evidence, but 07-07 should still run.** The plan's must-have is explicit that nothing here may assert D-138 by substring presence alone, and that the behaviour is proven by executing the script in 07-07. This execution extracted the real emitted `run:` body and ran it against four diff shapes with a stubbed CLI (see Verification Results). That is stronger than a grep and weaker than 07-07's brief: the stub proves the *shell* logic, not that the real `accord` binary behaves as the script assumes. 07-07 is not redundant.

**F-4 — plan verification item 4 cannot be checked literally in this working tree** (07-01's F-2 and 07-02's F-4, unchanged). `git status --porcelain packages/core/src/generated packages/core/templates` is non-empty: `templates.ts` and `business-rules.md` modified, `skills.ts` untracked — all Phase 6 work, all present before this plan started. The claim the item makes, *this plan regenerates nothing*, holds: no generator was run, `gen-templates.mjs` is unmodified, and `packages/core/templates/` still holds exactly the same seven files.

**F-5 — the `actuals.tokens` and `estimate.tokens` scale gap, now observed three times in this phase.** The realized diff is ~12,655 characters, so ~3,160 tokens on the `chars/4` scale the SUMMARY contract specifies, against an estimate of 70,000 — a ~22x gap, wider than 07-01's and 07-02's ~10x. Recorded honestly rather than rounded toward the estimate. Three consecutive observations in one phase make this a property of the estimator.

**F-6 — the generated workflow has no way to tell a user their pin drifted from their config.** D-139's guarantee is that the two pins are equal *at the moment `init` runs*. Nothing keeps them equal afterwards: a user who bumps `config.yml`'s `accord:` by hand and forgets the workflow gets a CI job that invokes the old version, which then refuses at exit 2 with the pin message — a correct failure, but one whose cause reads as "CI is broken" rather than "your workflow is stale". Not a defect in this plan (D-130 forbids `init` from rewriting the file, and the refusal *is* the designed signal), but worth the owner's attention before Phase 9 dogfooding. No change proposed.

## Known Stubs

None. `workflowYml` returns the whole real document; every assertion runs against emitted text or a real file on disk. The stub used in the four-diff-shape smoke run is a throwaway shell function in a temporary directory, not a repository artifact.

## Threat Flags

None beyond the register the plan already carries. This plan adds no network call, no auth path, and no new file-access pattern in accord itself: the one new write path is a source literal in `scaffold/init.ts` already covered by T-07-01, and the emitted document's own surface is exactly T-07-11 through T-07-17, all of which are asserted or accepted as the register specifies.

## Issues Encountered

One toolchain friction worth recording: the first draft escaped every `$` in the TypeScript template literal, which is only necessary before `{`. `eslint`'s `no-useless-escape` flagged eight of them — a useful guard, because the unnecessary escapes were indistinguishable at a glance from the three necessary ones (`\${{`, `\${file#...}`, `\${id%.md}`) and would have made the next edit to this literal a guessing game.

## Verification Results

Run from the repository root, Windows, Node 24:

| Check | Result |
|---|---|
| `npm run build` | clean |
| `npm run lint` | clean, exit 0 |
| `npm run typecheck` | clean, exit 0 (core, core tests, cli) |
| `npm test` | **34 files, 836 tests, 836 passed, 0 failed** (07-02 baseline was 34 files / 822 tests; +14 cases, no new file) |
| `packages/core/test/scaffold.test.ts` alone | 22 passed (was 12) |
| `packages/cli/test/init.test.ts` alone | 18 passed (was 14) |
| `git init` + real `accord init` in a throwaway directory | `created .github/workflows/accord.yml` first line, 26 created lines, exit 0 |
| second real `accord init` in the same directory | `skipped .github/workflows/accord.yml`, exit 0 |
| the written file's bytes | no `\r`, LF throughout |
| emitted `run:` body vs. ticket-adding diff | `accord lint`, `accord gate done T-1`, `accord gate done T-2`, exit 0 — `T-1/verification.md` and `docs.md` excluded |
| emitted `run:` body vs. docs-only diff | `nothing to gate`, exit 0 |
| emitted `run:` body vs. docs-only diff, failing lint | `nothing to gate`, **exit 1** |
| emitted `run:` body vs. ticket-deleting diff | `nothing to gate`, exit 0 (A-09) |
| emitted `run:` body vs. ticket diff, failing gate | `accord gate done T-1`, **exit 1** (here-string preserves `code`) |
| `packages/core/templates/` | 7 files, unchanged |
| `packages/core/scripts/gen-templates.mjs` | unmodified |
| `grep -rn npx packages/{cli,core}/src` | only `scaffold/workflow.ts` (emitted text) and `pin.ts` (message text) — no spawn |
| `git rev-parse --short HEAD` | `53e9df9` — unchanged, no commit made |

## Self-Check: PASSED

`packages/core/src/scaffold/workflow.ts` exists and exports `workflowYml` with no import statement of any kind; `packages/core/src/scaffold/init.ts` imports it and returns the four-entry list; both test files carry their new `describe` blocks and pass; `.planning/REQUIREMENTS.md` line 61 begins `- [x] **CLI-02**` and line 180 reads `| CLI-02 | Phase 7 | Complete |`. The full suite is green at 836/836 — no claim in this document is made over a red test. No commit hashes to verify: commits are forbidden in this project until the owner approves the diff, so the whole plan is in the working tree.

## User Setup Required

None. No external service, no new dependency, no environment variable. The generated workflow needs nothing in a user's repository beyond `git` and the GitHub-hosted runner defaults.

## Next Phase Readiness

- **07-07 picks up a `run:` string that is known to work.** It is a single unsplit `run:` block in `jobs.accord.steps[2].run`, exactly as the plan's key-link requires, so `parse(initFiles(pkg).find(f => f.path === '.github/workflows/accord.yml').text).jobs.accord.steps.find(s => s.run).run` is the whole extraction. The stub-substitution used here (`s.replace(/npx --yes \S+/g, ...)`) is a two-line recipe 07-07 can reuse or replace with a real CLI invocation.
- **07-04 widens the same list by one again.** The scaffold path case in `scaffold.test.ts` and the `SCAFFOLD` constant in `init.test.ts` are the two places to edit, consciously, and both are designed to go red rather than pass silently. Note that `AGENTS.md` and `CLAUDE.md` sort *after* `accord/...`, unlike the workflow.
- **07-04's shipped-text name scan must cover the emitted workflow.** It is shipped text under the "no other tools named" constraint, and today nothing scans it — the core scan in `skills.test.ts` covers rendered skills only.
- **Open, carried into the phase:** F-4 (the porcelain check), F-6 (pin drift between the config and a workflow `init` will never rewrite), and WINDOWS.md entries 7, 8 and 9 (this plan's line-ending and path assertions are Windows-observed only).

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-18*
