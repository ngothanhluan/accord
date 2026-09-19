---
phase: 06-skills
plan: 02
subsystem: skills
tags: [skill-content, graduation, dogfooding, vitest, fixtures]

# Dependency graph
requires:
  - phase: 06-skills
    plan: 01
    provides: "`renderSkill`/`skillTargets`/`contentHash`, `gen-skills.mjs`, the committed generated module, `accord skills sync`, and the eleven whole-render-output invariants every definition added later inherits"
  - phase: 05-cli-commands
    provides: "`preflight` (root -> snapshot -> pin, D-95) and the exact-string version pin `accord/config.yml` must satisfy"
  - phase: 04-gates
    provides: "`READY_PROMOTE` at `gate/rules.ts:98`, the mechanism behind the D-124 open-question stop the dev workflow step 6 leans on"
provides:
  - "the `dev` role definition and the three files it loads from its own package (`debug.md`, `code-review.md`, `review.md`), plus `shared/prototype.md` reaching a second role"
  - "this repository as a consumer of its own output: `accord/config.yml` and `.claude/skills/accord-dev/` written by `accord skills sync`"
  - "the structural half of ROADMAP criterion 7 (plan-review step exists, reads no code, edits only `## Plan`, precedes implementation) asserted in CI"
  - "the review-context write boundary (ROADMAP criterion 4, middle clause) asserted as a set equality over every `accord/`-rooted path the two briefs name"
  - "`packages/core/test/fixtures/wrong-plan/` — the D-115 fixture the manual half of criterion 7 needs"
affects: [06-03, 06-04, 07-init]

actuals:
  tokens: 18000
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a graduated body is copied by command, not retyped, and its fidelity is proved by `diff` against the pre-graduation file"
    - "a text assertion identifies a step by two independent substance phrases, never by a copied sentence"
    - "a write-boundary is asserted as a set equality over every path a text NAMES, with no write-verb heuristic, scoped to the files the audience actually receives"

key-files:
  created:
    - packages/core/skills/dev/SKILL.md
    - packages/core/skills/dev/debug.md
    - packages/core/skills/dev/code-review.md
    - packages/core/skills/dev/review.md
    - accord/config.yml
    - packages/core/test/fixtures/wrong-plan/accord/config.yml
    - packages/core/test/fixtures/wrong-plan/accord/tickets/TCK-1.md
    - packages/core/test/__golden__/wrong-plan.lint.json
    - packages/core/test/__golden__/wrong-plan.snapshot.json
    - .claude/skills/accord-dev/SKILL.md
    - .claude/skills/accord-dev/debug.md
    - .claude/skills/accord-dev/code-review.md
    - .claude/skills/accord-dev/review.md
    - .claude/skills/accord-dev/prototype.md
  modified:
    - packages/core/src/generated/skills.ts
    - packages/core/test/skills.test.ts
    - .planning/ROADMAP.md
  deleted:
    - docs/skills/debug.md
    - docs/skills/code-review.md
    - .claude/skills/accord-debug/SKILL.md
    - .claude/skills/accord-code-review/SKILL.md

key-decisions:
  - "`design.tokens` in this repository's own config is `docs/tokens.css`, a path that does not exist, and `accord lint` therefore carries one standing `lint.tokens-missing` warning. Honest over silent: the alternative was pointing the key at an existing non-token file to quiet the warning."
  - "\"describes writing `verified`\" is asserted as an imperative write verb immediately before the key (`tick `verified:``), which is what distinguishes an instruction to this file's reader from `code-review.md`'s third-person mention of the developer ticking it later. A bare substring match would have counted `code-review.md` and made the criterion unsatisfiable without editing a body the plan says graduates verbatim."
  - "The SKILL-09 adjacency edge (one `SKILL.md` per role directory, no bundled file named `SKILL.md`) is NOT re-asserted — 06-01 already asserts exactly that over the whole render output. A second copy would be the drift this phase exists to remove."
  - "Two golden files are new collateral: `lint.test.ts` and `snapshot.test.ts` enumerate every fixture folder with an `accord/` directory, so `wrong-plan/` generated `wrong-plan.lint.json` and `wrong-plan.snapshot.json` automatically. They are kept — the lint golden is a useful record that the fixture is Ready-clean (0 errors) apart from the two deliberately untagged plan steps."
  - "The review brief refers to the ticket as \"the ticket\" and never as an `accord/`-rooted path, so the set equality the write-boundary test asserts stays exactly one element."

requirements-completed: [SKILL-01, SKILL-06, SKILL-07, SKILL-09, SKILL-12]

coverage:
  - id: D1
    description: "`packages/core/skills/dev/SKILL.md` renders into `accord-dev/` alongside four bundled files, each reachable by a `./<name>` relative path"
    requirement: SKILL-09
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#renders as a role with its four bundled files reachable by relative path (SKILL-09, D-108)"
        status: pass
      - kind: unit
        ref: "packages/core/test/skills.test.ts#every relative reference resolves inside the same render, for more than one roster (D-110)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rendered dev `SKILL.md` names a plan-review step that reads no code and edits only `## Plan`, and it precedes the implementation step"
    requirement: SKILL-12
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#reviews the plan before the code is written (SKILL-12, D-115 part 1)"
        status: pass
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the plan review reads no code and edits only the plan (SKILL-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The review step opens a fresh context, hands it `./review.md`, names no runtime product, and states that the context which wrote the code never writes `verification.md`"
    requirement: SKILL-06
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the code review opens a fresh context, gets review.md, and names no runtime product (SKILL-06, D-109)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exactly one file in the whole render output tells its reader to write `verified`, and it is `accord-dev/SKILL.md`"
    requirement: SKILL-07
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#exactly one rendered file tells its reader to write `verified` (SKILL-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two briefs the fresh review context receives name exactly one `accord/`-rooted path, `accord/tickets/<id>/verification.md`, and state that the context reports rather than changes what it judges (ROADMAP criterion 4, middle clause)"
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#names exactly one accord/-rooted path across both briefs, and it is verification.md"
        status: pass
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the brief names verification.md and says it reports rather than changes what it judges"
        status: pass
    human_judgment: false
  - id: D6
    description: "`shared/prototype.md` loaded by two roles produces two byte-identical, non-empty copies at two different paths (D-119)"
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the two prototype.md copies are byte-identical, non-empty, and at two different paths"
        status: pass
    human_judgment: false
  - id: D7
    description: "This repository's own skills are generated output; `accord skills sync` creates `.claude/skills/accord-dev/` and a second run reports `unchanged` on every line and writes nothing"
    requirement: CLI-08
    verification:
      - kind: other
        ref: "`node packages/cli/dist/cli.js skills sync` twice in C:/Work/accord; five `created` then five `unchanged`, both exit 0; a third run left md5 and mtime unchanged"
        status: pass
    human_judgment: false
  - id: D8
    description: "`docs/skills/` and the two hand-maintained `accord-*` copies are gone, and every remaining file under `.claude/skills/` carries the generated marker"
    requirement: SKILL-09
    verification:
      - kind: other
        ref: "`ls docs/` shows no `skills/`; `.claude/skills/` holds only `accord-dev/`; all five files grep the marker"
        status: pass
    human_judgment: false
  - id: D9
    description: "A checked-in fixture whose `## Plan` targets a technical layer in a dependency-violating order, passing every other Ready check"
    requirement: SKILL-12
    verification:
      - kind: unit
        ref: "packages/core/test/__golden__/wrong-plan.lint.json — 0 errors; the only ticket-level plan findings are the two deliberately untagged steps"
        status: pass
    human_judgment: false
  - id: D10
    description: "Running the dev skill's plan-review brief by hand over the wrong-plan fixture returns a changed `## Plan` (D-115 part 2)"
    verification: []
    human_judgment: true
    rationale: "The subject is model behaviour, and the \"No API keys\" constraint forbids running a model inside the suite. 06-VALIDATION.md lists it as manual-only; it is the phase's verification step, not this plan's."

# Metrics
duration: 12 min
completed: 2026-09-16
status: complete
---

# Phase 6 Plan 2: The `dev` Slice Summary

**The heaviest of the three workflows ships as source prose: a 72-line rendered `accord-dev/SKILL.md` that reviews its own plan in a fresh context before writing code and hands the finished change to a context that never wrote it, with the two `docs/skills/` drafts graduating into the package and this repository becoming the first consumer of `accord skills sync` in the same change.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3
- **Files:** 14 created, 3 modified, 4 deleted

## Accomplishments

- **The `dev` role is real prose, not scaffolding.** `packages/core/skills/dev/SKILL.md` is nine ordered steps and the CLI calls, and nothing else (D-114). Rendered it is 72 lines against the 120-line ceiling D-129 set, so the ceiling never had to be argued about.
- **The graduation and its replacement landed in one change.** `docs/skills/debug.md` and `docs/skills/code-review.md` stopped existing in the same edit that made `packages/core/skills/dev/` the source, and `.claude/skills/accord-dev/` replaced the two hand-maintained copies. There is no window in which the author has neither.
- **This repository now eats its own output.** `accord/config.yml` exists, `node packages/cli/dist/cli.js skills sync` runs here, and the `accord-dev` skill is loadable in this very session. ROADMAP criterion 2's "a second run is a no-op" is observed in a real repository, not only a sandbox: bytes and mtime both unchanged on the third run.
- **The write boundary that ROADMAP criterion 4 is about is finally pinned.** Until now nothing asserted that the review context writes only `verification.md`. It is now a set equality over every `accord/`-rooted path the two briefs name — no write-verb heuristic, so a brief that told the reviewer to write a second artifact goes red by naming it.
- **`shared/prototype.md` reached its second role,** which is the first time D-119's byte-identity property had two copies to compare across two role directories rather than two target directories.

## Task Commits

**Nothing was committed.** The project's standing rule (global CLAUDE.md) is that work is
left in the working tree for review. Per-task commits, the SUMMARY commit, and the
tracking-file commit were all deliberately skipped, and the team lead's brief for this run
restated the prohibition as absolute.

- **Task 1: The dev workflow, its review brief, and the two techniques** — `none (uncommitted per project policy)`
- **Task 2: The graduation** — `none (uncommitted per project policy)`
- **Task 3: The wrong-plan fixture and the structural assertions** — `none (uncommitted per project policy)`

**Plan metadata:** `none (uncommitted per project policy)`

`commits: 0` in the frontmatter is measured, not narrated: `git log` carries no commit for
this plan because none was made. The full change set is visible with `git status --short`
and `git diff`.

## Files Created/Modified

**Source prose**

- `packages/core/skills/dev/SKILL.md` — `kind: role`, `name: accord-dev`, `loads: [dev/debug.md, dev/review.md, dev/code-review.md, shared/prototype.md]`; nine steps, opening on `accord gate ready <id>`, closing on `accord gate done <id>`
- `packages/core/skills/dev/debug.md` — `kind: technique`; the `docs/skills/debug.md` body with exactly one sentence changed
- `packages/core/skills/dev/code-review.md` — `kind: technique`; the `docs/skills/code-review.md` body verbatim
- `packages/core/skills/dev/review.md` — `kind: reference`; the brief the fresh review context receives, and the only thing it receives

**Deleted**

- `docs/skills/debug.md`, `docs/skills/code-review.md` (the directory is now gone)
- `.claude/skills/accord-debug/SKILL.md`, `.claude/skills/accord-code-review/SKILL.md` (both parent directories removed)

**This repository as a consumer**

- `accord/config.yml` — eight keys plus two comment blocks: `accord: "0.1.0"`, `profile: maintain`, `tracker.adapter: none`, `design.tokens: docs/tokens.css`, `roles: [ba, dev]`, `runtimes: [claude]`
- `.claude/skills/accord-dev/{SKILL.md,debug.md,review.md,code-review.md,prototype.md}` — generated output, five files, each with a marker and hash

**Fixture and tests**

- `packages/core/test/fixtures/wrong-plan/accord/{config.yml,tickets/TCK-1.md}` — a `maintain` repository with one ticket that passes every Ready check and whose `## Plan` is wrong in both ways criterion 7 names
- `packages/core/test/__golden__/wrong-plan.{lint,snapshot}.json` — generated automatically by the two fixture-enumerating golden suites
- `packages/core/test/skills.test.ts` — three new `describe` blocks (7 cases); one existing 06-01 case updated, see deviation 1
- `packages/core/src/generated/skills.ts` — regenerated by `npm run gen`; 2 skills became 6

**Tracking**

- `.planning/ROADMAP.md` — one clause of Phase 6 success criterion 5

## Decisions Made

- **The `verified` authorship predicate is an imperative verb, not a substring.** `code-review.md` graduates verbatim and contains "The developer fixes it before ticking `verified`" — a third-person mention of what the developer does later, not an instruction to the reviewer. A substring match on `verified` would have counted that file and made SKILL-07's criterion unsatisfiable without editing a body the plan forbids editing. The test matches `/\b(ticks?|writes?|records?)\s+`?verified/i`, which the gerund does not satisfy. The distinction it encodes — "tells its own reader to write it" — is the one the requirement is about.
- **The review brief names the ticket, not a path to the ticket.** `review.md` says "the ticket's `## Intent`" rather than `accord/tickets/<id>.md`. That is what keeps the write-boundary set equality at exactly one element without needing a write-verb heuristic, which the plan explicitly rejected as the weaker instrument.
- **`design.tokens` points at a file that does not exist,** and `accord lint` prints one standing warning here as a result. See findings below; this is a choice the owner may want to revisit.
- **The SKILL-09 adjacency edge was not re-asserted.** 06-01's `only a role definition is named SKILL.md, and no directory holds two` already asserts exactly the property Task 3's last acceptance criterion names, over the whole render output, with a `perDir.size > 0` guard. Writing a second copy would have been the drift this phase exists to remove.
- **`profile: maintain` for this repository.** `docs/design.md` §3 defines `maintain` as a delivered codebase receiving individual tickets, and D-88 makes it the looser profile — accord itself has shipped five phases of code.
- **`runtimes: [claude]` only,** so `.agents/skills/` is never created here. Widening it is a one-line edit; the plan flagged this as the owner's call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 06-01's "`ba` and `dev` render nothing" assertion became half-false**

- **Found during:** Task 1 verification
- **Issue:** `packages/core/test/skills.test.ts` asserted `paths.filter((p) => p.includes('accord-ba') || p.includes('accord-dev'))` equals `[]`, with the comment "`ba` and `dev` have no definition yet". Landing `dev/SKILL.md` is precisely what this plan does, so the case failed with the ten expected `accord-dev/` paths.
- **Fix:** Narrowed the negative to `accord-ba` and added a positive `toContain('.claude/skills/accord-dev/SKILL.md')` in the same case, so it still proves the two states — role declared with a definition, role declared without one — are distinguishable. The comment was updated to say so.
- **Files modified:** `packages/core/test/skills.test.ts`
- **Verification:** `npm test -- --project core skills` — 27/27 pass.
- **Committed in:** not committed (project policy)

This is a test whose premise this plan deliberately changed, not production code bent to
make a test pass. The assertion it replaced is strictly stronger than the one it removed.

### Documented deviations from the plan text

**2. Task 2 step 2 says `git rm`; a plain filesystem delete was used instead**

- **Found during:** Task 2
- **Issue:** The plan says `git rm` the four graduated files. The run's standing instruction forbids every staging and committing git operation.
- **Resolution:** `rm` plus `rmdir` of the emptied parents. The files are gone from the working tree and appear as unstaged deletions (` D`) in `git status`. Every acceptance criterion phrased as `git ls-files <path> returns nothing` was therefore evaluated against its stated intent with a working-tree check instead — see Verification Run.
- **Files modified:** none beyond the four deletions
- **Verification:** `git status --porcelain` shows ` D` for all four paths; `ls docs/` shows no `skills/`; `.claude/skills/` holds only `accord-dev/`.

**3. The three `git status --porcelain` verify commands cannot be green under the no-commit policy**

- **Found during:** Tasks 1, 2 and 3 verification
- **Issue:** `test -z "$(git status --porcelain packages/core/src/generated)"`, `... .claude/skills .agents/skills`, and `... packages/core/test/fixtures` all assume this plan's own new files are already committed. Nothing was committed.
- **Resolution:** Each was run and read against its stated intent. `packages/core/src/generated/skills.ts` is `??` because it is new; `npm run gen` run twice produces a byte-identical file (md5 `46ece59b...` both times), which is the drift the command exists to catch. `.claude/skills` shows only this plan's own intended deletions and addition, and `.agents/skills` does not exist at all; the second-sync no-op was proved directly by md5 and mtime instead. `packages/core/test/fixtures` shows one `??` entry — the new fixture — and **no modified tracked fixture**, which is the mutation the command exists to catch.
- **Files modified:** none

**4. Two golden files were generated that the plan does not list**

- **Found during:** Task 3
- **Issue:** `lint.test.ts:14` and `snapshot.test.ts:14` enumerate every directory under `test/fixtures/` that contains an `accord/` folder. Adding `wrong-plan/` therefore created `wrong-plan.lint.json` and `wrong-plan.snapshot.json` on the first run. The plan's artifact list does not mention them.
- **Resolution:** Kept, and listed under key-files. They are the mechanical consequence of the fixture layout the plan chose (`packages/core/test/fixtures/`, so both packages can reach it), and the lint golden is independently useful: it records `errors: 0`, which is the fixture's "passes every other Ready check" property written down.
- **Files modified:** none

**5. The plan predicted the token rule "has nothing to fire on"; it fired**

- **Found during:** Task 2
- **Issue:** Task 2's action text says "there is no `prototype.html` anywhere in this repository, so the token rule has nothing to fire on." `lint.tokens-missing` (`packages/core/src/lint/tokens.ts:187`) does not depend on a prototype existing — it fires whenever `design.tokens` names a path absent from the snapshot.
- **Resolution:** Accepted as a warning. `accord lint` exits 0, the acceptance criterion ("exits 0 or 1 but never 2") holds, and the warning's own text is accurate for this repository. Raised as a finding below rather than papered over by pointing `design.tokens` at an unrelated existing file.
- **Files modified:** none

---

**Total deviations:** 1 auto-fixed (blocking) + 4 documented plan/policy conflicts resolved without changing a deliverable.
**Impact on plan:** None on scope. Every artifact the plan names exists; two more were generated by existing test machinery.

## Verification Run

Every command below was run on Windows 11 (win32, Node 24) in `C:/Work/accord`.

| Command | Result |
|---|---|
| `npm run gen` | pass — `generated 6 skills`; run twice, `skills.ts` md5 identical |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test -- --project core skills` | pass — 27/27 |
| `npm run build` | pass |
| `npm run check` (`build && lint && typecheck && test`) | pass — **31 files, 753 tests, 0 failures** (was 735 before this plan) |
| `node packages/cli/dist/cli.js lint` | exit 0 — one warning, `lint.tokens-missing` |
| `node packages/cli/dist/cli.js skills sync` (1st) | 5 x `created`, exit 0 |
| `node packages/cli/dist/cli.js skills sync` (2nd) | 5 x `unchanged`, exit 0 |
| `node packages/cli/dist/cli.js skills sync` (3rd) | md5 of all five files unchanged; `SKILL.md` mtime unchanged |

### Acceptance criteria checked by hand

| Criterion | Result |
|---|---|
| `packages/core/skills/dev/` holds exactly four files | `SKILL.md`, `code-review.md`, `debug.md`, `review.md` |
| `code-review.md` body differs in zero lines from the former draft | `diff <(tail -n +5 ...) docs/skills/code-review.md` — exit 0 (run before deletion) |
| `debug.md` body differs in exactly one region | one hunk, `24,26c24,26`; the replacement second sentence begins `Resuming is` and names `accord status` |
| `loads:` equals the four-entry list | line 6 of `dev/SKILL.md` |
| rendered `accord-dev/SKILL.md` line count | 72 (ceiling 120) |
| rendered `accord-dev/SKILL.md` line 1 `---`, marker after the closing `---` | line 5 `---`, line 6 the marker |
| `accord-dev/debug.md` line 1 is the marker | yes |
| `accord:` equals `packages/cli/package.json` version | both `0.1.0` |
| ROADMAP still has 9 `### Phase N:` headings and 7 Phase 6 criteria | 9 and 7 |
| ROADMAP criterion 5 final clause | now `The definitions live in \`packages/core/skills/\`` |
| Nothing under `.agents/skills/` | `.agents` does not exist |
| Every file under `.claude/skills/` carries the marker | 5/5 |

## Issues Encountered

None requiring problem-solving beyond deviation 1.

## Findings / decisions needing owner confirmation

1. **`accord lint` in this repository prints a permanent warning.** `design.tokens: docs/tokens.css` names a file that does not exist, because accord ships a CLI and has no interface, and `lint.tokens-missing` fires on an absent tokens path regardless of whether any prototype exists. The warning's text is true and exit stays 0, but the author will see it on every run. Three ways out, none taken here because each is an owner's call: (a) leave it, and treat the warning as an accurate statement about a repository with no UI; (b) point `design.tokens` at some existing file to silence it, which trades a true warning for a false configuration; (c) make `design` optional in `config.schema.json` for projects with no interface, which is a schema change touching Phase 1–4 fixtures and goldens and is firmly out of this phase.

2. **`runtimes: [claude]` is narrower than the repository's own compatibility claim.** accord targets four runtimes and its tests assert one text is correct in both target directories, but its own config declares one. Nothing is wrong — the value is what this repository demonstrably uses — but a reader comparing the constraint to the config may read it as a retreat. Widening to `[claude, codex, cursor, copilot]` is a one-line edit that would also start writing `.agents/skills/accord-dev/` here, which is arguably better dogfooding.

3. **`/accord-debug` and `/accord-code-review` are no longer invocable as standalone skills** in this repository. 06-CONTEXT.md's Deferred Ideas records this as known and accepted: the two techniques are now loaded by `accord-dev` rather than invoked as roles of their own, which is exactly what SKILL-09 asks for. Recorded here because it is a capability the author had yesterday and does not have today, and because it is the first thing they will notice.

4. **The manual half of ROADMAP criterion 7 is outstanding and belongs to phase verification, not to this plan.** The fixture is checked in at `packages/core/test/fixtures/wrong-plan/accord/tickets/TCK-1.md` and the brief is step 4 of the rendered `accord-dev/SKILL.md`. Its intended defects, for whoever runs it: step 1 carries both `@ac-1` and `@ac-2` while steps 2 and 3 carry none (wrong layer), and step 1 consumes the output of steps 2 and 3 (wrong order). The criterion is met when the returned `## Plan` differs; record before and after in the phase verification notes.

5. **`verified_hash` and `verified_commit` are in the ticket template but not in the dev workflow's step 8.** `packages/core/templates/ticket-maintain.md` says a human writes both by hand at the moment of ticking, and `docs/design.md` §5 says each tick binds to the AC hash and the commit sha. Step 8 says to tick `verified:` and write the notes, and stops there, because SKILL-04 forbids restating what the gate checks and `accord gate done` prints its own reasons for a stale tick. If the owner judges that a developer who reads only the skill will not know to write those two keys, step 8 needs one more clause — an editorial call, and the only place in the dev workflow where the SKILL-04 line was genuinely close.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **06-03 is unblocked and now has more to scan.** SKILL-08's command scanner will see four new files; every command named in them is one of the six real paths (`gate ready`, `gate done`, `lint`, `status`, and — in no skill text — `new ticket` / `skills sync`). The D-113 orphan report now has a real repository to be tested against: `.claude/skills/` here holds exactly one `accord-*` directory.
- **06-04 adds `ba/SKILL.md` and must re-run `accord skills sync` in this repository,** because `roles: [ba, dev]` means `accord-ba/` appears the moment the definition exists. It inherits every invariant in `packages/core/test/skills.test.ts` without writing test code.
- **Phase 7's `init` must not overwrite `accord/config.yml`,** which the file says in its own first comment.
- **Nothing is committed.** `git status --short` shows the full change set for review.

## Self-Check: PASSED

- All 14 files listed under `key-files.created` exist on disk (`[ -f ]` per path); all four under `deleted` are absent, and both emptied parent directories are gone.
- `git log --oneline --all --grep="06-02"` returns nothing, which is the **expected** result under the standing no-commit rule. The frontmatter records `commits: 0` as the measured value; `git rev-list` was not run against a ledger because no commit exists to count.
- Every `<acceptance_criteria>` item from all three tasks was re-run; the five that cannot be literally satisfied under the no-commit policy or that the plan text mispredicts are recorded as deviations 2-5 above, each with its substitute check and result.
- Plan-level `<verification>`: `npm run check` green (753 tests); `skills sync` run three times from the repository root with the second reporting `unchanged` on every line and the third proved to write no bytes. The third item — the manual D-115 part 2 run — is outstanding by design and is recorded as finding 4.

---
*Phase: 06-skills*
*Completed: 2026-09-16*
