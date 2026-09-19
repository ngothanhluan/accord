---
phase: 07-scaffolding-and-example-repo
plan: 08
subsystem: examples
tags: [examples, gates, maintain-profile, ci, github-actions, intg-02, d-145, d-146, d-147]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    plan: 06
    provides: "`examples/build/`, `readDir(root: URL)`, and the one-row case table in `packages/core/test/examples.test.ts` that this plan extends by one row"
  - phase: 07-scaffolding-and-example-repo
    plan: 03
    provides: "`workflowYml(pkgName, version)` — the emitted workflow whose two commands this plan's CI job runs against the examples"
  - phase: 07-scaffolding-and-example-repo
    plan: 02
    provides: "`accord init` writing the whole contract, which produced this example's skeleton (D-146)"
  - phase: 07-scaffolding-and-example-repo
    plan: 04
    provides: "`deniedNames` / `DENIED` in `packages/core/test/helpers/denied.ts` — the shipped-text name list the example prose is scanned against"
  - phase: 04-gates
    provides: "`gateReady`, `gateDone`, `MAINTAIN_DOWNGRADE`, and `designMissing`'s maintain branch — the rules this example is the first to drive to a pass"
provides:
  - "`examples/maintain/` — a `profile: maintain`, `ui: true`, prototype-backed ticket that passes `gate ready` and `gate done` with zero findings of any level; the first maintain-profile Done pass anywhere in this repository"
  - "the `examples` job in `.github/workflows/ci.yml` — the emitted workflow's own two commands run against BOTH examples through the real `dist/cli.js` in a throwaway git repository (D-147 layer 2)"
  - "a real PASSING `gate done` through the real CLI, which closes 07-07's F-4"
  - "a written map of the maintain-profile Done route (the transcript below)"
affects: [09-publish]

actuals:
  tokens: 3444   # chars/4 over ~13,775 chars of realized diff; see F-6
  tasks: 3
  commits: 0     # commits are forbidden in this project until the owner approves the diff
  plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

tech-stack:
  added: []
  patterns:
    - "an unexplored route is driven by probing in BOTH directions: the passing state is reached, and then each rule the example is supposed to exercise is deliberately broken to confirm it was really load-bearing rather than silently inert"
    - "a CI job enumerates its inputs from a glob and rewrites the one fact a file on disk cannot carry (the sha of the commit that is about to contain it) inside a `mktemp -d` copy"

key-files:
  created:
    - examples/maintain/accord/config.yml
    - examples/maintain/accord/product/glossary.md
    - examples/maintain/accord/product/business-rules.md
    - examples/maintain/accord/tickets/EXPORT-1.md
    - examples/maintain/accord/tickets/EXPORT-1/verification.md
    - examples/maintain/accord/assets/EXPORT-1/prototype.html
    - examples/maintain/src/tokens.css
    - examples/maintain/src/export.ts
    - examples/maintain/test/export.spec.ts
    - examples/maintain/reports/junit.xml
  modified:
    - .github/workflows/ci.yml
    - packages/core/test/examples.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/WINDOWS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "the ticket carries one `@ui` scenario and one `@test:`-tagged scenario, so the human layer and the machine layer both run — an all-`@ui` ticket would have passed Done with no test report at all, which is passing by avoiding what the example demonstrates (T-07-36)"
  - "`examples/maintain` is the only configuration in this repository where `design.tokens` names a file that is in the snapshot, so `lint.token-hardcoded` genuinely executes there; three probes prove it"
  - "no `design:` key on the ticket at all — on the maintain profile the prototype is what Ready requires, so the open F-2 question about the templates' example URLs never arose in the example's own text"
  - "the CI job's sha substitution is two key-anchored `sed` expressions (`^verified_commit: \"1234567\"$`, `^commit: 1234567$`) rather than a blanket `s/1234567/$sha/g`, so it cannot touch an `ac_hash` that happened to contain the digits"

requirements-completed: [INTG-02]

coverage:
  - id: D1
    description: "`examples/maintain/` holds one `profile: maintain` ticket, completing D-145's pair alongside 07-06's `examples/build/`"
    requirement: INTG-02
    verification:
      - kind: other
        ref: "examples/maintain/accord/config.yml carries `profile: maintain`; EXPORT-1 is the one ticket"
        status: pass
      - kind: unit
        ref: "packages/core/test/examples.test.ts#was read, and holds a config and the ticket the table names (maintain row)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`gateReady` and `gateDone` both return `verdict: 'pass'` for EXPORT-1 — the first proof anywhere in this repository that a maintain-profile ticket passes Done"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#passes gate ready (maintain row)"
        status: pass
      - kind: unit
        ref: "packages/core/test/examples.test.ts#passes gate done (maintain row)"
        status: pass
      - kind: e2e
        ref: "a scratch driver over packages/core/dist/index.js: ready => pass, done => pass, zero findings of any level"
        status: pass
    human_judgment: false
  - id: D3
    description: "`lintSnapshot` returns no error-level finding for examples/maintain (in fact no finding of any level)"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#carries no error-level lint finding (maintain row)"
        status: pass
      - kind: e2e
        ref: "real CLI: `node dist/cli.js lint` in the sandbox copy prints `0 errors, 0 warnings`"
        status: pass
    human_judgment: false
  - id: D4
    description: "The example skeleton was produced by running the built `accord init` (D-146)"
    requirement: INTG-02
    verification:
      - kind: e2e
        ref: "`git init -q` in an empty examples/maintain, then `node packages/cli/dist/cli.js init` => 28 `created` lines, exit 0; everything outside accord/ and the nested .git then deleted per A-20"
        status: pass
    human_judgment: true
    rationale: "Observed once at Task 1; the directory on disk is the residue. Nothing re-asserts that the accord/ tree still equals what `init` writes — a template change would not turn this suite red."
  - id: D5
    description: "A CI job runs the generated workflow's own two commands against BOTH examples through the real dist/cli.js, in a throwaway git repository (D-147 layer 2)"
    requirement: INTG-02
    verification:
      - kind: e2e
        ref: "the `examples` job's `run:` body lifted from ci.yml and executed by hand with GITHUB_WORKSPACE=C:/Work/accord: exit 0, both examples, lint 0/0 and `gate done` 0 errors 1 warning each"
        status: pass
      - kind: other
        ref: "the job itself has never run on a runner — ubuntu-latest only, and nothing in this tree is committed (WINDOWS.md entry 14)"
        status: partial
    human_judgment: true
    rationale: "The script body is proven; the YAML wiring around it (checkout, setup-node, npm ci, npm run build) is proven only by parsing the document back and by the `check` job already using the same four steps."
  - id: D6
    description: "The maintain row drives the full six-case set with no new `it` and no golden file"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "`npx vitest run --project core examples` => 1 file, 12 tests (6 per row, twice)"
        status: pass
      - kind: other
        ref: "the only edit to examples.test.ts is the table literal; `gitFor(row)` already derived the authors record from the row, so no second entry was needed"
        status: pass
    human_judgment: false
  - id: D7
    description: "The example prose names no other tool, plugin, harness, or planning system, and no file under examples/ carries a carriage return or a backslash path"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#names no other tool, plugin, harness, or planning system (maintain row)"
        status: pass
      - kind: e2e
        ref: "grep -rlU $'\\r' examples/ => exit 1 (no match), after the CI script was run by hand"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 08: the maintain-profile example and the examples CI job Summary

**A `profile: maintain`, `ui: true`, prototype-backed ticket reaches a passing Done verdict for the first time in this repository — with zero findings of any level — and a new CI job runs the emitted workflow's own two commands against both examples through the real CLI, which is also the first real *passing* `gate done` the binary has ever produced.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 of 3
- **Files:** 10 created, 6 modified

## Task Completion

**No commits were made.** This project forbids `git commit` until the owner has reviewed the diff (global CLAUDE.md critical rule, restated as a hard override in the execution brief). HEAD is still `53e9df9`. Throwaway `fs.mkdtemp` sandboxes do commit — `gate done` binds a tick to a commit, so a pass is unreachable without one — and every such call is `cwd`-scoped with `git -C "$tmp"`. Per-task completion, tracked here instead of in git history:

1. **Task 1 — the maintain-profile example** — complete. `npm run build` clean; the three listings are non-empty; the carriage-return scan over `examples/` finds nothing. The gate transcript is below.
2. **Task 2 — one row in the case table** — complete. `npx vitest run --project core examples` → 1 file, 12 tests. One line of table changed; no new `it`, no golden, no authors entry needed.
3. **Task 3 — the CI job and the INTG-02 tick** — complete. The job's script body was lifted from the YAML and run by hand: exit 0 for both examples.

---

## The transcript: the maintain-profile Done route, in the order the gate named it

This is the deliverable the plan asked for. The ticket was written first — `ui: true`, two scenarios, the full Done apparatus, `ac_hash` and `verified_hash` both `"PENDING"` — and then the gates were run against it repeatedly.

### Run 1 — `ready: fail`, `done: fail`

```
--- ready EXPORT-1: fail  acHash=fnv1a64:44d831c3e92c7e40
  error   schema.pattern        accord/tickets/EXPORT-1.md:11 | must match pattern "^fnv1a64:[0-9a-f]{16}$"
  warning lint.intent-oversize  accord/tickets/EXPORT-1.md:15 | ## Intent has 6 lines; the limit is 5

--- done EXPORT-1: fail  acHash=fnv1a64:44d831c3e92c7e40
  error   schema.pattern        accord/tickets/EXPORT-1.md:11 | must match pattern "^fnv1a64:[0-9a-f]{16}$"
  warning lint.intent-oversize  accord/tickets/EXPORT-1.md:15 | ## Intent has 6 lines; the limit is 5
  error   gate.tags-differ      accord/tickets/EXPORT-1.md:28 | scenarios lack nothing; evidence lacks nothing; verified lacks @ac-1 @ac-2
```

| # | Rule id | What it asked for | What was supplied |
|---|---|---|---|
| 1 | `schema.pattern` (`/verified_hash`) | a value matching `^fnv1a64:[0-9a-f]{16}$` | the `acHash=` value the SAME run reported — `fnv1a64:44d831c3e92c7e40` — written into both `ac_hash` and `verified_hash`. The gate is the only place that value can come from; it is not authorable by hand |
| 2 | `lint.intent-oversize` | `## Intent` at 5 lines or fewer, counted 6 | the same five sentences rewrapped onto 5 longer lines. Nothing was cut |
| 3 | `gate.tags-differ` | `verified` to hold `@ac-1 @ac-2` — which it already did, on the page | **nothing directly.** This finding was a *consequence* of #1 and disappeared with it. See the reading below |

### The `gate.tags-differ` reading (recorded rather than guessed at, per A-28)

The reason line said `verified lacks @ac-1 @ac-2` while the ticket's frontmatter plainly listed both. Reading `packages/core/src/gate/done.ts`: `tickTags` reads `ticket.frontmatter?.verified`, and `acHashMissing`, `tickUnbound` and `shaTooShort` all short-circuit on `frontmatter === undefined`. A frontmatter block that fails schema validation does not reach the ticket as a parsed object at all, so **every frontmatter-reading Done rule goes quiet at once and `tagsDiffer` sees an empty `verified` set.** One invalid key therefore produces one loud finding plus one misleading one. Worth knowing before anyone debugs a `tags-differ` they can see is wrong: fix the schema error first and re-read.

### Run 2 — `ready: pass`, `done: pass`, zero findings of any level

```
--- ready EXPORT-1: pass  acHash=fnv1a64:44d831c3e92c7e40
--- done  EXPORT-1: pass  acHash=fnv1a64:44d831c3e92c7e40
--- lint (whole snapshot): (empty)
```

Two runs. The route turned out to be short — which is itself the finding, and is why the probes below exist.

---

## The probes: proving the route was not passed by avoiding it (T-07-36)

A two-run transcript on an unexplored route is exactly the shape a vacuous pass has. Five perturbations were made, run, and reverted. Each asks: *is this rule actually load-bearing over this example, or is it silently inert?*

| Probe | Perturbation | Result |
|---|---|---|
| **A** | `accord/assets/EXPORT-1/prototype.html` removed | `ready: fail` — `error gate.design-missing … ui: true needs accord/assets/EXPORT-1/prototype.html; **on this profile a design: URL is not enough**`. The maintain-specific branch of `designMissing` is genuinely what this example passes |
| **B** | `ui: true` → `ui: false`, prototype still removed | `ready: pass`. So it is `ui: true` and nothing else that makes the prototype required — the example is not passing Ready for some incidental reason |
| **C1** | `background: var(--colour-accent)` → `background: #1f5f4f` in the prototype | `warning lint.token-hardcoded accord/assets/EXPORT-1/prototype.html:41 \| background: hard-coded colour #1f5f4f` |
| **C2** | `var(--colour-on-accent)` → `var(--colour-button-text)` (a name `src/tokens.css` does not declare) | `warning lint.token-hardcoded …:42 \| color: unknown token var(--colour-button-text); tokens are read from config.design.tokens only` |
| **C3** | C1's hard-coded colour PLUS `design.tokens` emptied back to `""` | **silent.** Both gates pass with zero findings |

C1–C3 together are the plan's claim made concrete: `examples/maintain` is the one configuration in this repository where `tokensKey` returns a key that is in the snapshot, so `lint.token-hardcoded` actually runs. C3 shows the counterfactual — with `design.tokens: ""` the identical hard-coded colour is invisible, because `tokenHardcoded` returns early and `prototypeDerivation` takes over and is satisfied by the header comment naming `src/tokens.css`.

All five perturbations were reverted and the example is byte-identical to its pre-probe state (re-verified: both gates pass, zero findings, no carriage return under `examples/`).

---

## The CI job (D-147 layer 2)

`.github/workflows/ci.yml` gains a second top-level job, `examples`, beside `check`. `runs-on: ubuntu-latest`, no matrix. Four standard steps (`checkout@v7`, `setup-node@v7` with Node 24 and npm cache, `npm ci`, `npm run build`) then one `shell: bash` script that, for each directory matching `examples/*/` (A-29 — enumerated, never named):

1. copies it into a fresh `mktemp -d` — because `repoRoot` resolves the git top-level, and running the CLI inside `examples/maintain/` of this checkout would read *this* repository's `accord/` folder;
2. `git init -q`, `git add -A`, and a commit carrying `-c user.email=ci@example.invalid -c user.name=ci -c commit.gpgsign=false` and `--no-verify`, matching `commitAll` in the CLI test helper so the host's git configuration cannot change the outcome;
3. reads `sha=$(git -C "$tmp" rev-parse --short HEAD)` and rewrites the placeholder `1234567`;
4. runs `node "$cli" lint`, then `node "$cli" gate done "$id"` per ticket, with `$id` stripped from the file name by the same prefix/suffix idiom the emitted workflow uses (`${file#…}` / `${id%.md}`);
5. accumulates into `code` and exits with it at the end, so both examples are reported rather than only the first failure.

`node` is invoked by name with `dist/cli.js` as its argument. No `npx`, no `npm` inside the loop, no `.cmd` (PITFALLS §12).

**The script body run by hand, verbatim from the YAML** (extracted by parsing `ci.yml` and selecting the one step whose `run` contains `cli.js`), with `GITHUB_WORKSPACE=C:/Work/accord`:

```
== build
0 errors, 0 warnings
accord/tickets/SIGNUP-1/verification.md: warning gate.author-match the review and the gated commit share an author (ci@example.invalid), so no second pair of eyes touched this ticket
0 errors, 1 warnings
== maintain
0 errors, 0 warnings
accord/tickets/EXPORT-1/verification.md: warning gate.author-match the review and the gated commit share an author (ci@example.invalid), so no second pair of eyes touched this ticket
0 errors, 1 warnings
SCRIPT EXIT=0
```

(Git's `LF will be replaced by CRLF` notices, elided above, appear on this Windows host only and not on the ubuntu runner.)

**This closes 07-07's F-4.** That plan could not reach a passing `gate done` through the real binary, because `examples/build` carries the synthetic tick sha `1234567` and no repository can have that as HEAD. Rewriting the tick to the sandbox's own HEAD is the inverse move, and it works: the first real passing `gate done` this project has produced.

The one warning both examples carry is `gate.author-match` — the sandbox commits everything under one identity, so the review and the commit share an author. It is a warning by D-79 precisely so a solo developer is not blocked, and the verdict is `pass`.

## The example, file by file

| Path | What it is |
|---|---|
| `accord/config.yml` | `init`'s output verbatim except three values: `profile: maintain`, `design.tokens: "src/tokens.css"`, and an appended `tests.report` block. `accord: "0.1.0"` (A-22). |
| `accord/product/glossary.md` | Three terms the ticket then uses verbatim: weekly report, workspace member, report line. |
| `accord/product/business-rules.md` | Four rules, two carrying a `Rejected:` line (D-116). The day format and the CSV quoting rule live here so the ticket cites them instead of restating them. |
| `accord/tickets/EXPORT-1.md` | `type: story`, `ui: true`, two scenarios — `@ac-1 @ui` and `@ac-2 @test:…` — a `## Plan` with one step per criterion, a `## Verification notes` block per ticked criterion, both hashes, `verified_commit: "1234567"`. No `design:` key. |
| `accord/tickets/EXPORT-1/verification.md` | `commit: 1234567`, one `## @ac-n` section per criterion, each `Result: pass` with an `Evidence:` line resolving to a real path or test id. |
| `accord/assets/EXPORT-1/prototype.html` | The reports-screen header with the new download control. Header comment names `src/tokens.css` under `Derived from:`. Every colour and every spacing value is a `var(--…)` from that file; no `<script`. |
| `src/tokens.css` | The tokens the product already ships — six colours, four spacing steps, a radius and a body font. Written FIRST, and the prototype built from it, as the plan instructs. |
| `src/export.ts`, `test/export.spec.ts` | The code the evidence points at: an 18-line CSV writer and the two tests over it (one per branch of the quoting rule). |
| `reports/junit.xml` | Two passing cases; the first is exactly the `@test:` tag `@ac-2` carries. |

## Verification Results

Run from the repository root after all changes, Windows 11, Node 24:

| Command | Result |
|---|---|
| `npm run build` | clean |
| `npm run typecheck` | clean (core, core tests, cli) |
| `npm run lint` | clean, exit 0 (eslint covers `examples/**/*.ts`; no ignore entry added) |
| `npm test` | **36 files, 878 tests, 878 passed, 0 failed** (baseline 36 files / 872 tests; +6 cases, the six the new row generates) |
| `npx vitest run --project core examples` | 1 file, **12 tests** passed |
| `grep -rlU $'\r' examples/` | exit 1 — no carriage return anywhere under `examples/`, after the CI script ran by hand |
| `grep -c '^  examples:' .github/workflows/ci.yml` | `1` |
| `yaml.parse(ci.yml).jobs` | `['check', 'examples']` — two top-level jobs, the new one not nested |
| the `examples` job's script, run by hand | **exit 0**, both examples |
| `examples/*/…/verified_commit` and `…/commit` after that run | still `1234567` in both examples — the job wrote only into its `mktemp -d` copies |
| `git rev-parse --short HEAD` | `53e9df9` — unchanged, no commit made |
| `grep -n INTG-02 .planning/REQUIREMENTS.md` | line 95 `- [x] **INTG-02**`; line 205 `\| INTG-02 \| Phase 7 \| Complete \|` |
| `git status --porcelain` under `packages/core/src` or `packages/cli/src` from this plan | nothing — no gate rule and no lint rule was touched |

## Deviations from Plan

**1. [Rule 3 — Blocking] The plan's `git status --porcelain examples` verify is unreachable in this tree.**
`examples/` is entirely untracked (nothing in this working tree is committed), so that command prints `?? examples/` on every run regardless of what the script did. The narrower claim it encodes was checked directly instead, two ways: the placeholder shas in both examples are still `1234567` after the run, and the carriage-return scan over `examples/` still exits 1. Same handling as 07-03 F-4, 07-04, 07-06 F-4 and 07-07.

**2. [Rule 1 — Bug, mine] The first script-extraction picked the wrong step and ran `npm ci`.**
The extractor selected `steps.find(s => s.run)`, which is `npm ci` — the first step in the job carrying a `run` key. It executed (reinstalling `node_modules`, ~20 s) before I noticed. No tracked file changed: `git status --porcelain package-lock.json` is empty, and `package.json`'s modification predates this session. The extractor now selects the single step whose `run` contains `cli.js` and throws unless exactly one matches, which is 07-07's `toBe(1)` discipline applied to a scratch tool.

**3. [scope] The ticket is not the minimum that would pass.**
An all-`@ui` ticket needs no `tests.report`, no `reports/junit.xml`, no `src/`, no `test/` — `machineScenarios` filters `@ui` out, so `testsUnconfigured`, `reportMissing`, `testUnknown` and `testNotPassed` all return `[]` and Done passes on the human layer alone. That is four files and a config block cheaper, and it is exactly the shape T-07-36 warns about: an example that passes because the layer it never engages cannot object. The ticket therefore carries one `@ui` scenario and one `@test:`-tagged one, so both layers run over it.

**4. [scope] `.planning/WINDOWS.md` needed no repair this time.**
The brief warned it had gone internally inconsistent three plans running. 07-07's repair held: `windows append` accepted entry 14 first try and `windows status` reads the ledger cleanly afterwards (13 open / 0 waived / 1 fixed / 14 total). Recorded because its absence is the news.

**Total deviations:** 4. None touches production source; `packages/core/src/gate/**` and `packages/core/src/lint/**` are byte-identical to what Phase 4 left.

## Findings

**F-1 (engine behaviour, recorded as a reading not a guess) — one invalid frontmatter key silences every frontmatter-reading Done rule at once, and `gate.tags-differ` then reports a mismatch that is not there.**
*Expected:* `verified_hash: "PENDING"` produces one `schema.pattern` finding. *Actual:* it produces that finding AND `gate.tags-differ … verified lacks @ac-1 @ac-2`, against a ticket whose `verified:` list visibly holds both. The mechanism is in `done.ts`: a frontmatter block that fails schema validation does not reach the ticket as a parsed object, so `tickTags` reads an empty set while `acHashMissing`, `tickUnbound` and `shaTooShort` all short-circuit silently. This is not a defect — every one of those rules is correctly guarded — but the *composite* output is misleading, and someone will eventually spend time debugging a `tags-differ` they can see is wrong. **No code was changed** (project rule 2, and 07-CONTEXT forbids gate changes in this phase). Flagged for the owner: a possible Phase 8+ improvement is for `tagsDiffer` to stay silent when the frontmatter did not parse, the way `noScenarios` owns the all-empty case.

**F-2 (carried, still open, unchanged by this plan) — the shipped ticket templates name a design tool.**
07-04 raised it; the owner has not ruled. This plan did **not** carry that name into `examples/maintain/` and did **not** edit the templates. Because the maintain profile makes the prototype the primary reference (`designMissing`: "on this profile a design: URL is not enough"), the example's ticket needs no `design:` key at all — so no placeholder was required either and the question never arose in the example's text. The `deniedNames` case over `examples/maintain` returns `[]`, so the example is on the right side of F-2 whichever way it is ruled.

**F-3 (rule level, worth knowing) — `lint.token-hardcoded` is a warning on BOTH profiles, so nothing about a prototype can fail a maintain gate.**
`MAINTAIN_DOWNGRADE` lists the four token and size rules, but D-88 already set all four to `warning` in v0.1, so the downgrade is a documented no-op (the comment in `rules.ts` says exactly this). The consequence for a reader of `examples/maintain`: the prototype could be full of hard-coded hex values and `gate ready` and `gate done` would both still pass — probes C1 and C2 show the findings appearing and the verdict staying `pass`. The example is clean by construction, not by enforcement. Recorded because "the maintain profile checks prototypes against the tokens file" is easy to read as "blocks", and it does not.

**F-4 (business logic, decided by me, alternatives recorded) — the domain choices in the maintain example.**
The plan specifies the shape and nothing about the content, so every value below was chosen rather than derived. None affects any gate or lint rule; they affect only what a reader learns the format from. Per the project's "document uncertain business logic as findings" rule, they are listed rather than silently assumed.

| Choice | What was chosen | The alternative, and why it lost |
|---|---|---|
| The story | Adding a CSV download to a reports screen that already exists | A new screen; rejected — the maintain profile is for changes to what already ships, and a greenfield story would read as the build example again |
| Day format | year-month-day with hyphens, stated once in `business-rules.md` with a `Rejected:` line | the reader's local format; rejected in the document itself, because the file leaves the product |
| Quoting | RFC-4180 shape: wrap on comma, double quote, or line break; double an inner quote | stripping the offending character; rejected in the document, because a silently altered name reads as a different person |
| Hours precision | two decimal places, `toFixed(2)`, never rounded again on the way out | whatever the source had; rejected — the ticket's third requirement is about the file reading as the screen does |
| Criteria count | two scenarios, one `@ui` and one `@test:` | three (a scenario for the quoting rule); rejected — the limit is five, two shows a set, and every extra scenario is another tag to keep honest. The quoting branch is covered by a second *test*, which needs no tag |
| `@ac-1`'s steps | `Given` + `Then`, no `When` | adding a `When they look at the header`; rejected as noise — the criterion is about a state, not an action, and `stepEmpty` is satisfied either way |
| `reviewed_on` | `2026-09-18` | no rule reads it; any date parses |

**F-5 (informational) — `readDir` walks the whole example, including `src/`, `test/` and `reports/`.**
`loadSnapshot` only *keeps* `accord/**`, the configured tokens file and the configured report, so the extra files reach the snapshot's `tree` (which is what `resolves` tests evidence against) but not its `files`. That is why an `Evidence:` line naming `src/export.ts` resolves without `src/export.ts` ever being parsed. Not a defect; worth writing down because it is the only reason the evidence in either example resolves at all.

**F-6 — the `actuals.tokens` vs `estimate.tokens` scale gap, now five times in this phase.** ~13,775 characters of realized diff (10,750 under `examples/maintain`, ~2,725 for the CI job, ~300 for the table row and the two REQUIREMENTS lines), so ~3,444 tokens on the `chars/4` scale the SUMMARY contract specifies, against an estimate of 58,000 — a ~17x gap, between 07-07's ~10.6x and 07-03's ~22x. Recorded honestly rather than rounded toward the estimate.

## Known Stubs

None. Every file under `examples/maintain/` is finished content. `src/export.ts` is small but complete and does what the evidence claims; `test/export.spec.ts` covers both branches of its one piece of logic.

## Threat Flags

None. This plan adds no dependency, no network surface, and no new filesystem write path in accord itself. The register's five threats are each addressed: T-07-26 (the sha substitution is two key-anchored expressions over `mktemp -d` copies), T-07-27 (verified after the by-hand run — the checkout's placeholder shas are untouched), T-07-28 (an asserted criterion keeps the prototype script-free, and nothing renders it), T-07-36 (the five probes above are the mitigation, and they are in this document rather than only in my head), T-07-SC (no dependency added; `npm ci` runs against the committed lockfile as `check` already does).

## State Updates

- `.planning/REQUIREMENTS.md` — **INTG-02 ticked**, line 95 and the traceability row. Nothing else changed.
- `.planning/ROADMAP.md` — Phase 7 plan count to 8/8, the 07-08 row ticked. The phase checkbox on line 22 is deliberately left unticked: closing a phase is the verification step's call, as it was for phases 4 and 5.
- `.planning/STATE.md` — position to 8 of 8 / awaiting verification, session lines, one metric row, four decision lines, and the blocker list (07-07 F-4 marked closed, three new entries).
- `.planning/WINDOWS.md` — entry 14, the unrun `examples` CI job.

## Self-Check: PASSED

Every file claimed above exists on disk:

- `examples/maintain/` — 10 files, confirmed by `find examples/maintain -type f`: `accord/config.yml`, `accord/product/glossary.md`, `accord/product/business-rules.md`, `accord/tickets/EXPORT-1.md`, `accord/tickets/EXPORT-1/verification.md`, `accord/assets/EXPORT-1/prototype.html`, `src/tokens.css`, `src/export.ts`, `test/export.spec.ts`, `reports/junit.xml`.
- `.github/workflows/ci.yml` — parses back to two jobs, `check` and `examples`.
- `packages/core/test/examples.test.ts` — the case table holds exactly two rows and the suite reports 12 tests.
- `.planning/phases/07-scaffolding-and-example-repo/07-08-SUMMARY.md` — this file.

No commit hashes are claimed, because no commit was made. `npm test` is green at the moment of writing: **878 of 878 passing, 0 failed**. No claim in this document is made over a red test.

## Next Phase Readiness

**What this phase leaves unfinished, stated plainly** (this is the last plan of Phase 7):

- **Nothing in this phase has ever run in CI.** Not one line of it is committed, so `ubuntu-latest` has never seen `init`, the emitted workflow, the skill guard, either example, or the new `examples` job. Every claim in every Phase 7 summary is Windows-observed. WINDOWS.md entries 8, 9, 10, 11, 13 and 14 all say a version of this. It is one owner-approved commit away from being resolved, and until then it is the phase's largest single piece of unproven ground.
- **07-06 F-1 is still open:** the D-147 layer-1 claim is proven one direction short. The examples suite is shown to go red when the example *data* moves; the rule-side perturbation (tightening `isSha`) was denied by the sandbox and was not retried here either — this plan's probes are all data-side for the same reason. Owner call.
- **F-2 is still unruled** after three plans: the shipped ticket templates name a design tool in example URLs. Neither example carries the name, and the templates are untouched, so the fix stays a one-line owner decision.
- **07-07 F-3 (the disconnected-network run) and F-6 (a bare Windows box skips nine cases quietly)** are unchanged.
- **D-146 is proven once, not held.** Both examples' `accord/` trees came from a real `init` run, but nothing re-asserts that they still equal what `init` writes. A template change would not turn any suite red; it would silently make the examples stale. Worth a small test in Phase 9 if the owner wants the guarantee rather than the anecdote.
- **F-1 above** is a candidate improvement to `gate.tags-differ`, deliberately not acted on here.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-18*
