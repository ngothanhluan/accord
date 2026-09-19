---
phase: 07-scaffolding-and-example-repo
verified: 2026-09-18T20:20:00Z
status: gaps_found
score: 3/5 must-haves verified
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/phases/07-scaffolding-and-example-repo/07-01-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-01-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-02-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-02-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-03-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-03-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-04-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-04-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-05-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-05-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-06-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-06-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-07-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-07-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-08-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-08-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-09-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-09-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-10-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-10-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-11-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-11-SUMMARY.md"
  - "packages/cli/src/commands/init.ts"
  - "packages/cli/src/commands/skills.ts"
  - "packages/cli/src/guard.ts"
  - "packages/cli/src/render/table.ts"
  - "packages/cli/test/init.test.ts"
  - "packages/cli/test/new-ticket.test.ts"
  - "packages/core/src/generated/templates.ts"
  - "packages/core/src/scaffold/init.ts"
  - "packages/core/src/scaffold/pointer.ts"
  - "packages/core/src/scaffold/workflow.ts"
  - "packages/core/templates/epic.md"
  - "packages/core/templates/ticket-build.md"
  - "packages/core/templates/ticket-maintain.md"
  - "packages/core/test/scaffold.test.ts"
  - "packages/core/test/templates.test.ts"
covered_digest: "v1:sha256:4e191943540ddb811d4f6f3f9235f3ceac03f694a2b1330d04c35c49b6ad4bed"
behavior_unverified: 0
overrides_applied: 0
owner_rulings:
  # Decided 2026-09-18, after the FIRST report was written. Binding on `/gsd-plan-phase 07 --gaps`.
  # Preserved verbatim through the re-verification of 2026-09-18T20:20Z. All three are now discharged —
  # see `re_verification.gaps_closed`.
  - item: WR-01
    subject: "the generated `config.yml` has no `tests:` key, so the workflow `init` writes fails its own `gate done`"
    ruling: >-
      `init` emits a COMMENTED-OUT `tests:` block in the generated `config.yml`, with one line
      saying it must be uncommented before the first ticket carrying an `@test:` scenario.
      Chosen over adding a lint finding because the user should meet the key while reading the
      file, not when CI goes red — and because 07-CONTEXT forbids lint-rule changes in this
      phase, which would have pushed half the fix into a later phase. Matches what both shipped
      examples already do.
  - item: F-2
    subject: "`packages/core/templates/{ticket-build,ticket-maintain,epic}.md` name a design tool on 5 lines"
    ruling: >-
      Genericise: replace the named tool with a neutral example URL in all three templates and in
      the two `new-ticket.test.ts` assertions that pin that prose, AND widen the `deniedNames`
      scan 07-04 built to cover `packages/core/templates/` so a reintroduction turns a test red
      instead of shipping silently. A written carve-out for example URLs was rejected — a
      constraint with an exception is one nobody can enforce later.
  - item: "07-06 F-1"
    subject: "D-147 layer 1 rule-side sensitivity"
    ruling: >-
      Perturbation authorised and RUN — see `resolved_after_verification`. No gap work remains.
  # Decided 2026-09-18, after the SECOND report (20:20Z) was written. Binding on the gap plans this
  # report's `--gaps` run produces. Answers the three-part ruling gap 2 asked for, plus scope.
  - item: "GAP-2a"
    subject: "`packages/cli/dist/cli.js:419` names a tracker product, preserved from the JSDoc at `packages/cli/src/render/table.ts:24`"
    ruling: >-
      Reword the JSDoc to adapter keys accord actually ships, AND add a `deniedNames` scan over
      `packages/cli/dist/cli.js` so the bytes Phase 9 publishes are machine-held like every other
      shipped surface. Reword-only was rejected: gap 3 closed a surface and revealed that all five
      scan call sites read INPUTS to the build and none reads its OUTPUT, so without the scan the
      next block comment reintroduces the breach silently. Confirmed before ruling: a full DENIED
      scan over the current bundle returns exactly that one line — the `linear-gradient` false
      positive the report worried about does not occur, so no allowlist is needed.
  - item: "GAP-2b"
    subject: "where `DENIED` lives, given `load.test.ts:16` records that test helpers are not imported across packages here"
    ruling: >-
      Relocate `denied.ts` to a helper both packages' tests import, and update the five existing
      import sites. One list, one scan, every surface — which is what the file's own docstring says
      it exists to guarantee. Duplicating the list into a CLI test was rejected by that same
      docstring ("two copies of a project constraint are two things to keep in step"); having a
      core test read `../../cli/dist/cli.js` was rejected because it inverts the package dependency
      direction and breaks `vitest --project core` in isolation.
  - item: "GAP-2c"
    subject: "`Shortcut` is excluded from `DENIED` as ordinary English, while three shipped templates use it as a tracker product name"
    ruling: >-
      Reword the examples; keep the exclusion. Change the tracker example in
      `templates/{ticket-build,ticket-maintain,epic}.md` and in `table.ts` to a key accord actually
      ships (`config.yml` offers `none` and `github-issues`). The word then appears nowhere as a
      product name, so no carve-out is needed and the constraint stays absolute — consistent with
      the F-2 ruling that rejected written exceptions. Adding `Shortcut` to `DENIED` was rejected:
      it would flag ordinary prose like "a shortcut past the gate" in every future skill and
      template text.
  - item: "GAP-SCOPE"
    subject: "what the gap plans cover besides the two blockers"
    ruling: >-
      Both blockers (gap 1 lossy pointer append, gap 2 published bundle) plus all four warnings —
      GC-WR-01 (`skills.ts` returns its report, so a mid-loop throw loses every status already
      true), GC-WR-02 (no config-exists test for the refusal whose position actually moved),
      GC-WR-03 (the "uncomment the two lines" instruction understates the edit — `report:` must
      also be pointed at the runner's own file), GC-WR-04 (`scaffold.test.ts:144` pins the example
      side by the fixed `slice(28, 30)` its own comment rejects). The two infos (GC-IN-01, GC-IN-02)
      stay out of scope. Two of the four warnings are test-oracle holes of exactly the kind that let
      the original gaps ship green, so they are closed while the code is open.

  # Decided 2026-09-18, during the `--gaps` planning run, on two items the planner surfaced that
  # neither report carried. Binding on plans 07-13 and 07-14.
  - item: "GAP-2d"
    subject: "`packages/core/dist/index.js:1259` also matches the denied-name scan, and core's `files:` publishes `dist`"
    ruling: >-
      Scan the CLI bundle only, as GAP-2a says, and record core's bundle as a decided NON-BREACH
      rather than an open finding. The single match is the word `linear` inside the tokens lint
      rule's `/^(?:linear|radial|conic)-gradient\(/i` — a CSS gradient function name in a regex
      literal, not prose naming a product. The constraint exists so that a reader meeting the name
      of something they do not have learns nothing; nobody reading that alternation meets a tracker.
      Verified during the ruling, which is why the two alternatives were rejected: tightening the
      scan's word boundary to `(?<![\w-])name(?![\w-])` does NOT clear this match (the word is
      preceded by `:` and followed by `|`; the hyphen sits after `)`), and it loses real detections
      such as a hyphenated product name in prose. Rewording the lint rule to `/^[a-z]+-gradient\(/i`
      would clear it but edits a working rule to satisfy a scan and loosens what the rule accepts.
      Allowing the match is the allowlist GAP-2a forbids. 07-14 must write this rationale down so
      Phase 9 inherits a decision, not a question.
  - item: "GAP-2c-EXT"
    subject: "`README.md:15` teaches `tracker: { shortcut: \"1234\" }`, pinned by `packages/core/test/convention.test.ts:48`"
    ruling: >-
      Authorised — the extension 07-13 proposed is adopted, so it is a ruled change rather than a
      planner's unilateral widening. GAP-2c's rationale is that the word then appears nowhere as a
      product name, and `README.md` is in both packages' `files:`, so the line is a shipped byte
      carrying the word in exactly the tracker-product sense. Reword it and the `convention.test.ts`
      literal that pins it alongside the three templates. Not widened further: this covers shipped
      bytes, not every occurrence of the word across docs and planning files.


re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  previous_verified: 2026-09-18T11:40:00Z
  closed_by: "07-09 (gap 1), 07-10 (gap 2), 07-11 (gap 3)"
  gaps_closed:
    - gap: "`accord init` prints every created path — false on the D-132 pin-mismatch path"
      closed_by: "07-09"
      evidence: >-
        `packages/cli/src/commands/init.ts:77-80` resolves `guarded = refusals()` before the write
        region's `try` at line 95, and `refusals()` (48-69) takes all three refusals in order.
        Re-reproduced with the shipped binary: a sandbox holding only an `accord/config.yml`
        pinned to `0.0.1` exits 2 with the refusal on stderr, stdout empty, and a whole-tree
        `find` listing byte-identical before and after. The previous run left three files behind.
    - gap: "A repository created by `accord init` can pass the `gate done` its own workflow runs"
      closed_by: "07-10, per owner ruling WR-01 (commented block, not a lint finding)"
      evidence: >-
        `packages/core/src/scaffold/init.ts:53-57` ships the `# tests:` / `#   report:` pair with a
        one-line instruction. Re-reproduced: a fresh `init` repo lints `0 errors, 0 warnings`; the
        anchored two-line uncomment yields a config that validates with `0 errors` and a
        `tests.report` string. Held by `scaffold.test.ts:108-127` (one anchored uncomment → valid
        config; no `tests` key as shipped).
    - gap: "Nothing accord ships names another tool — 5 lines in 3 shipped ticket templates"
      closed_by: "07-11"
      evidence: >-
        All three templates now read `# design: "https://example.com/design/..."` (was
        `https://www.figma.com/...` at HEAD). The constraint is now machine-held over that surface:
        `templates.test.ts:145-155` runs `deniedNames` over `Object.entries(templates)` with a live
        probe, and `templates.test.ts:130-137` binds that record to `packages/core/templates/`
        file-by-file with `toBe`, so the scan reaches the directory's bytes. Independent grep over
        `packages/core/templates/` and `examples/` for the DENIED list returns nothing.
  gaps_remaining:
    - "Nothing accord ships names another tool — now breached on a DIFFERENT surface: the published bundle (gap 2 below)"
  regressions:
    - >-
      GC-CR-01 — the `AGENTS.md`/`CLAUDE.md` pointer append re-encodes a human's file as UTF-8,
      destroying any byte that is not valid UTF-8. Found by the gap-closure code review, confirmed
      independently here. Present in `init.ts` since 07-04; the region was rewritten by 07-09 and
      the defect survived, so it is in scope for this pass under the evidence gate
      (`packages/cli/src/commands/init.ts` mtime 2026-09-18T19:08 local, after the previous
      `verified:` stamp, and the reproduction below is a deterministic artifact).

gaps:
  - truth: >-
      `AGENTS.md` and `CLAUDE.md` receive a short pointer to the accord skills, created when
      missing and APPENDED when present (ROADMAP success criterion 3)
    status: failed
    reason: >-
      "Appended" is false at the byte level for any file that is not valid UTF-8.
      `readFileSync(file, 'utf8')` decodes with replacement and the whole decoded string is
      written back as UTF-8, so a windows-1252 / latin-1 `AGENTS.md` — what a legacy Windows
      editor produces and what git stores happily as text — loses every non-UTF-8 byte to
      `EF BF BD` (U+FFFD). `init` reports `appended AGENTS.md` and exits 0, so the one write in
      this command that is NOT skip-if-exists, into the one file whose contents belong entirely
      to a human, is silently lossy. Reproduced here with the shipped binary on the bytes
      `63 61 66 E9 20 96 20 64 61 73 68 0A`:
      orig `636166e9209620646173680a` → after `636166efbfbd20efbfbd20646173680a0a3c212d`,
      byte-exact prefix preserved: false.
      This contradicts the invariant the code is written around
      (`packages/core/src/scaffold/pointer.ts:48`, T-07-18: "for every input that returns a string,
      that input is a byte-exact prefix of the result … no re-serialisation of a document a human
      owns"). The re-serialisation is on the CLI side of the seam, so core's own tests cannot see
      it, and every pointer case in `init.test.ts` feeds ASCII, so the byte-exact-prefix assertion
      at `init.test.ts:381-391` passes vacuously.
    artifacts:
      - path: "packages/cli/src/commands/init.ts"
        issue: >-
          Line 119 decodes as `utf8`; line 124 writes the whole result back. Neither is a
          byte-for-byte codec.
    missing:
      - >-
        Round-trip the existing bytes through `latin1` at both `init.ts:119` and `:124`. `BLOCK`,
        `POINTER_START` and the separator in `scaffold/pointer.ts` are pure ASCII, so they encode
        identically and `pointerText`'s `includes(POINTER_START)` / `endsWith('\n')` tests are
        unaffected. Confirmed by the reviewer on the same bytes: latin1 prefix preserved: true.
      - >-
        One case in `init.test.ts` writing a non-UTF-8 `AGENTS.md` and asserting
        `bytes(...).startsWith(original)`. The existing `bytes()` helper at `init.test.ts:21`
        already reads `latin1`, so the assertion is one line — which is why this gap is cheap to
        close and why nothing currently holds it.
  - truth: >-
      Nothing accord ships names another tool, plugin, harness, or planning system
      (CLAUDE.md hard constraint)
    status: partial
    reason: >-
      The surface the previous report named — `packages/core/templates/` — is closed and now
      machine-held (see `re_verification.gaps_closed`). A different shipped surface is still
      breached, and it is the one Phase 9 publishes: `packages/cli/dist/cli.js:419` contains
      `{ shortcut: '1234', jira: '1e3' }`, because the bundler preserves block comments and the
      JSDoc at `packages/cli/src/render/table.ts:24` carries it. `Ji` + `ra` is a DENIED entry.
      `packages/cli/package.json` declares `files: ["dist", "README.md"]`, so `dist/cli.js` is a
      published byte. Verified by `grep -oniE '\b(shortcut|jira|…)\b' packages/cli/dist/cli.js`.
      The structural reason nothing caught it: all five `deniedNames` callers scan INPUTS to the
      build (templates record, skill bodies, scaffold text, example prose); none scans its OUTPUT.
      Recorded by the executor as `.planning/WINDOWS.md` entry 19, left open for an owner ruling.
      A second, related unruled item: `Shortcut` is deliberately excluded from `DENIED`
      (`packages/core/test/helpers/denied.ts:10-14`, "it is ordinary English") while three shipped
      templates use it in exactly the tracker-product sense — `# tracker: { shortcut: "1234" }`
      in `ticket-build.md:9`, `ticket-maintain.md:9`, `epic.md:9`. That is an exception living in
      a test helper rather than in prose, which is the shape of exception the F-2 ruling rejected.
      Both lines are pre-existing (byte-identical at HEAD `53e9df9`); `table.ts` was not touched by
      this phase (mtime 2026-09-15).
    artifacts:
      - path: "packages/cli/src/render/table.ts"
        issue: "line 24 JSDoc names a tracker product; bundled into dist/cli.js:419"
      - path: "packages/core/test/helpers/denied.ts"
        issue: "no caller scans build output; `Shortcut` excluded from DENIED by an undocumented-in-prose carve-out"
    missing:
      - >-
        Owner ruling: (a) reword the `table.ts:24` example to a neutral adapter key, and (b) decide
        whether `deniedNames` grows a caller over `packages/cli/dist/cli.js` — which must handle the
        CSS `linear-gradient` false positive without introducing an allowlist — and (c) whether
        `Shortcut` stays out of `DENIED` given three shipped templates use it as a tracker name.
      - >-
        This must be settled BEFORE Phase 9: Phase 9 is publish, and the breach is in the bytes
        Phase 9 uploads.
deferred:
  - truth: "The generated workflow has executed on a GitHub Actions runner"
    addressed_in: "Phase 9"
    evidence: >-
      Phase 9 success criterion 2: "`accord init` from the published package runs on the
      employer project's repository and the generated CI workflow is green." Phase 7's
      obligation is that the emitted script body is executed, which it is, under `bash`,
      by `packages/cli/test/workflow-script.test.ts`.
behavior_unverified_items: []
resolved_after_verification:
  - truth: "Changing a gate rule turns the examples suite red locally (D-147 layer 1)"
    status: VERIFIED
    resolved: 2026-09-18
    by: >-
      The orchestrator, after the owner explicitly authorised the perturbation that the
      sandbox had denied to both the executor (07-06 F-1) and the reviewer.
    method: >-
      `packages/core/src/gate/done.ts` was copied to a scratchpad backup, `isSha` was
      tightened from `>= 7` to `>= 8`, `npx vitest run --project core examples` was run,
      and the file was restored from the backup.
    observed: >-
      `Test Files 1 failed | Tests 2 failed | 10 passed (12)`. Both `example build > passes
      gate done` and `example maintain > passes gate done` went red, each naming the rule
      that moved:
      `error gate.sha-too-short accord/tickets/EXPORT-1.md | verified_commit "1234567" is
      not a commit sha`. The examples are therefore wired to the live rule tables, not only
      to their own data. D-147 layer 1 is proven in both directions.
    restored: >-
      `packages/core/src/gate/done.ts` line 39 is back to `>= 7`; `git status --porcelain`
      over `packages/core/src/gate` and `packages/core/src/lint` is empty; the full suite is
      878/878 green and HEAD is still 53e9df9.
    incidental_finding: >-
      `shaTooShort`'s message text hardcodes "at least 7 hexadecimal characters are needed"
      rather than deriving the number from `isSha`. Under the perturbation the message
      contradicted the rule it was reporting. Pre-existing, cosmetic, outside Phase 7's
      scope — worth a ticket.
human_verification:
  - test: >-
      Push the branch and let `.github/workflows/ci.yml` run, including the `examples`
      job, on ubuntu-latest.
    expected: >-
      Both the `check` matrix and the `examples` job go green. The `examples` job prints
      `== build` and `== maintain` and exits 0.
    why_human: >-
      Nothing in Phases 6 or 7 is committed, so no job has ever run on a runner. Every claim in
      all eleven summaries, and every behavioural check in this report, is Windows-observed.
      The `examples` job relies on `sed -i`, `mktemp -d` and `cp -R` semantics; the job body was
      executed verbatim under Git Bash on Windows and passed, which is strong but is not ubuntu.
    carried_from: "2026-09-18T11:40:00Z report — still open"
  - test: >-
      Rule on the published-bundle breach of the CLAUDE.md naming constraint: the JSDoc at
      `packages/cli/src/render/table.ts:24` names a tracker product and is bundled into
      `packages/cli/dist/cli.js:419` (gap 2 above, `.planning/WINDOWS.md` entry 19). Include the
      `Shortcut`-in-`DENIED` question, since three shipped templates use it as a tracker name.
    expected: >-
      A ruling, then a reword of the JSDoc, a decision on whether `deniedNames` grows a
      build-output caller, and a decision on `Shortcut`.
    why_human: >-
      A project-constraint interpretation on the exact bytes Phase 9 publishes, not a code fact.
      The code fact is established: the name is in `dist/cli.js` and `dist` is in `files:`.
  - test: >-
      Confirm that overwriting a hand-edited skill copy is the intended reading of
      "never overwrites an edited file" in success criterion 1.
    expected: >-
      Owner agrees that the criterion scopes to human-owned documents, and that skill copies
      under `.claude/skills/**` and `.agents/skills/**` are accord-owned rendered output
      governed by D-112's four-state marker rule.
    why_human: >-
      The criterion's wording is unqualified; the implementation is deliberate and reports
      itself loudly. Observed: editing `.claude/skills/accord-ba/SKILL.md` and re-running
      `init` prints `overwrote local edits` and replaces the file, while an edit to
      `accord/product/glossary.md` is preserved and reported `skipped`.
    carried_from: "2026-09-18T11:40:00Z report — still open"
---

# Phase 7: Scaffolding and Example Repo Verification Report

**Phase Goal:** A team runs one command in an empty repository and receives the whole contract:
folder, config, templates, skills, agent pointers, and CI. An example repo proves both profiles
pass both gates.

**Verified:** 2026-09-18T20:20:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure by 07-09, 07-10 and 07-11

**Method note.** Nothing in Phases 6 or 7 is committed; HEAD is `53e9df9` and the whole of both
phases lives in the working tree. `git diff`, `git log` and commit presence were therefore not used
as evidence of anything; where a check would normally read history, it read the filesystem instead
(file mtimes for the evidence gate, `git show HEAD:<path>` only to establish that a flagged line is
pre-existing rather than introduced). Every behavioural claim below was produced by running the
built `packages/cli/dist/cli.js` (0.1.0, built 2026-09-18 19:47) in throwaway `git init` sandboxes
under the session scratchpad, never against `C:/Work/accord` itself. Test evidence is the
orchestrator's single full run (36 files, 883 tests, green) plus one named four-file run
(`init.test.ts`, `scaffold.test.ts`, `templates.test.ts`, `new-ticket.test.ts` — 96 passed).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `accord init` in an empty repo creates the root folder, `config.yml` with the pinned version, templates, and skill copies in both paths, prints every created path, and a second run changes nothing and never overwrites an edited file | ✓ VERIFIED | Gap 1 closed by 07-09. Greenfield: 28 `created`, exit 0. Pin-mismatch: exit 2, stdout empty, whole-tree listing identical. Re-run, deleted-path and hand-edit cases regression-checked green |
| 2 | The generated GitHub Actions workflow runs `lint` and `gate done` on touched tickets and reports a job result on docs-only and no-ticket diffs | ✓ VERIFIED | Unchanged since the first pass; `workflow.ts` untouched by 07-09/10/11; `workflow-script.test.ts` inside the 883-green run. The `tests:` caveat that qualified it is now the owner-accepted residual, not a gap |
| 3 | `AGENTS.md` and `CLAUDE.md` receive a short pointer to the accord skills without a copy of any skill body, created when missing and appended when present | ✗ FAILED | GC-CR-01, confirmed independently: the append re-encodes the file as UTF-8, so a non-UTF-8 `AGENTS.md` loses bytes and is still reported `appended`, exit 0. Gap 1 below |
| 4 | The example repo holds one maintain-profile ticket and one build-profile ticket, and both pass `gate ready` and `gate done` in that repo's CI | ✓ VERIFIED | Unchanged; `examples.test.ts` 12/12 inside the 883-green run; D-147 layer 1 proven in both directions (see `resolved_after_verification`) |
| 5 | Nothing accord ships names another tool, plugin, harness, or planning system (CLAUDE.md hard constraint) | ⚠️ PARTIAL | Templates surface closed by 07-11 and now machine-held. `dist/cli.js:419` still names a tracker product via `table.ts:24`. Gap 2 below |

**Score:** 3/5 must-haves verified. The previous report scored 3/4 because it counted only the four
ROADMAP success criteria and carried the CLAUDE.md constraint outside the table; it is row 5 here so
that closing part of it cannot read as closing all of it.

### Gap 1 (previous) — `init` writes before its pin check — CLOSED by 07-09

The fix is structural, not incidental. `packages/cli/src/commands/init.ts:77-80`:

```ts
const guarded =
  lstatSync(join(ctx.root, 'accord', 'config.yml'), { throwIfNoEntry: false }) === undefined
    ? undefined
    : refusals();
```

`refusals()` (lines 48-69) performs, in order: `snapshot.config === undefined` → throw;
`pinMessage(...)` → throw; `skillTargets(config)` + `assertNoLink` over each. The write region's
`try` does not open until line 95. So every way `accord/config.yml` can exist and not yield a usable
config throws before the first byte — a directory or symlink at that path is caught by the line-33
`assertNoLink` pre-pass, a zero-byte or unparseable file gives `config === undefined`, a parseable
one pinning elsewhere gives the pin throw, and `loadFromFs` cannot return a config that skipped the
pin check.

Re-reproduced with the shipped binary, in a sandbox holding only a hand-written config pinned to
`0.0.1`:

```
config.yml pins accord 0.0.1, running 0.1.0 - run: npx --yes @accord-dev/accord@0.0.1
EXIT=2
TREE IDENTICAL      (find | sort, before vs after)
```

The previous pass left `.github/workflows/accord.yml` plus two product documents behind on this
exact path, unreported. The consequence the first report was most worried about — a workflow pinned
to the running version written into a repository that had just refused it, then `skipped` forever
because `init` is skip-if-exists — is now unreachable, because it required the loop to run with a
foreign pin on disk.

The regression is held by the right oracle: `init.test.ts`'s `refuses` helper captures `listAll(repo)`
before the run and asserts equality after, over the whole tree. The old helper checked only that two
skill directories were absent, which is precisely why the defect shipped green.

Greenfield contract re-checked unmoved: 28 `created` lines, exit 0, `accord lint` clean
(`0 errors, 0 warnings`). The one refusal that cannot be hoisted — the greenfield skill-target guard,
whose roster comes from the config that run is writing — now prints the accumulated report before
rethrowing (`init.ts:130-133`), and `init.test.ts:297` holds it.

### Gap 2 (previous) — the generated config has no `tests:` key — CLOSED by 07-10, per the owner's ruling

`packages/core/src/scaffold/init.ts:53-57` ships the stanza. Read off a real run's output:

```
# Where the test report lands. `accord gate done` reads it to check that the test behind each
# @test: tag really passed; without it there is no Done.
# Uncomment the two lines below before the first ticket carrying an @test: scenario.
# tests:
#   report: reports/junit.xml
```

Checked against exactly the three things the ruling makes load-bearing:

| Question | Result |
| --- | --- |
| Discoverable? | ✓ The key is named in the file the user is already editing, three lines of its own guidance above it, in the same shape as every other key |
| Exactly one edit? | ✓ Two `# ` strips, one anchored substitution. Held by `scaffold.test.ts:108-121`, which performs the edit rather than reading it, and guards the guard against a substitution that matched nothing |
| Performing it yields a valid config? | ✓ `validate('config', …)` returns `[]` in the test; re-confirmed with the binary — after the uncomment `accord lint` reports `0 errors, 1 warnings` and `status` exits 0 |

The residual the owner accepted is confirmed present and correct: `scaffold.test.ts:125-127` asserts
no `tests` key parses from the shipped file, so `gate.tests-unconfigured` does fire on a fresh
repository's first `@test:`-tagged ticket until a human uncomments. Writing the key uncommented
instead would have put a standing `lint.report-missing` warning on every repository from its first
minute, which is the papercut the D-134 `design.tokens: ""` amendment exists to avoid — so the
chosen shape is the right one. Not a gap.

One residual the ruling did not cover, and that the gap-closure review raises as GC-WR-03: the
uncomment alone is not sufficient. `reports/junit.xml` is accord's invention; until the team points
`report:` at the file their own runner writes, `lint` carries a `lint.report-missing` warning
(observed above) and `gate done` fails with `tests.report "reports/junit.xml" is not in the
snapshot`. The instruction line says "Uncomment the two lines below" and stops there. This is a
one-line wording fix, warning-level — the diagnostics do name the problem — and it is listed under
warnings rather than as a gap.

### Gap 3 (previous) — shipped templates name a design tool — CLOSED by 07-11

All three templates now carry `# design: "https://example.com/design/..."`.
`git show HEAD:packages/core/templates/ticket-build.md` still reads
`# design: "https://www.figma.com/..."`, so the five lines genuinely moved in the working tree.

The substitution is sound rather than merely different: `example.com` is RFC 2606 reserved, and it
still satisfies `ticket.schema.json`'s `"design": { "pattern": "^https://" }`, so a user who copies
the example gets a value that validates. Nothing keys off the host — `gate/ready.ts:24-36` tests only
`typeof === 'string'` and `!== ''`.

The constraint is now machine-held over that surface, and the wiring is real rather than a
restatement: `templates.test.ts:145-155` runs `deniedNames` over `Object.entries(templates)` with a
live probe (`'built with ' + 'Fig' + 'ma'` must be detected before the real assertion runs) and a
record-length floor against the directory listing; `templates.test.ts:130-137` then binds that record
to `packages/core/templates/` file-by-file with `toBe`. So scanning the record scans the directory's
bytes — and scans the exact bytes a consumer receives after install, since the generated module is
what ships. Independent grep over `packages/core/templates/` and `examples/` for the full DENIED list
returns nothing.

### Gap 1 (new) — the pointer append destroys non-UTF-8 bytes

This is the gap-closure review's `GC-CR-01`, and it does change the verdict: it is a blocker-class
defect in code this phase wrote, on the one `init` write that is not skip-if-exists, into the one
file whose contents belong entirely to a human, and it is silent.

Reproduced independently here with the shipped binary, in a sandbox whose `AGENTS.md` is
windows-1252 (`caf<E9> <96> dash`):

```
orig : 636166e9209620646173680a
init : appended AGENTS.md          EXIT=0
after: 636166efbfbd20efbfbd20646173680a0a3c212d
byte-exact prefix preserved: false
```

Two bytes gone, replaced by `EF BF BD`, and the command says `appended` and exits 0. `init.ts:119`
decodes with `'utf8'` (which substitutes on invalid input) and `:124` writes the decoded string back
over the whole file. That directly contradicts the invariant the function is built around, stated in
`packages/core/src/scaffold/pointer.ts:48` (T-07-18): "for every input that returns a string, that
input is a byte-exact prefix of the result. This appends and does nothing else — no substitution, no
reflow, no re-serialisation of a document a human owns."

Why no test saw it: the re-serialisation is on the CLI side of the seam, so core's own
`scaffold.test.ts:320-327` cannot reach it; and every pointer case in `init.test.ts` feeds ASCII, so
the byte-exact-prefix assertion at `init.test.ts:381-391` passes vacuously. The `bytes()` helper at
`init.test.ts:21` already reads `latin1`, so the missing case is one line.

**Evidence-gate disposition.** This is not a carried-forward gap, so it needs either a named test run
red or a deterministic reproducible artifact, plus scope. Both hold:
`packages/cli/src/commands/init.ts` has mtime 2026-09-18 19:08 local (= 12:08Z), after the previous
report's `verified: 11:40Z` stamp — 07-09 rewrote exactly this region and wrapped these lines in its
new `try` — and the byte transcript above is reproducible in one command. It blocks; it is not
advisory.

**Scope note.** Only these two paths are affected. The scaffold loop (`init.ts:96-105`) writes new
files from core's own text and never reads an existing one; the skill copies are accord-owned
rendered output under D-112. `AGENTS.md` and `CLAUDE.md` are the only human-owned files `init` reads
back and rewrites.

### Gap 2 (new surface) — the published bundle still names a tracker product

Gap 3's specific defect is closed; the truth it belongs to is not. `packages/cli/dist/cli.js:419`
contains, verbatim:

```
/** `{ shortcut: '1234', jira: '1e3' }` becomes `shortcut:1234 jira:1e3`. */
```

`Ji` + `ra` is a `DENIED` entry. The source is `packages/cli/src/render/table.ts:24`, a JSDoc block
comment — tsdown strips line comments and preserves block comments, so it survives the bundle.
`packages/cli/package.json` declares `files: ["dist", "README.md"]`, so this is a published byte, and
Phase 9 is publish.

The structural reason nothing catches it: all five `deniedNames` call sites scan INPUTS to the build —
the templates record, the rendered skill bodies, the scaffold text, the emitted workflow, the example
prose. None scans the build's OUTPUT. 07-11's A-37 assumed the shipped surface was the templates.

Precisely which surfaces hold and which do not:

| Shipped surface | Scanned by a test | Clean on an independent grep |
| --- | --- | --- |
| `packages/core/templates/**` (rendered by `new ticket`, and into `accord/product/*`) | ✓ `templates.test.ts` | ✓ |
| rendered skill bodies | ✓ `skills.test.ts` | ✓ |
| generated `config.yml` comments, emitted workflow YAML, pointer block | ✓ `scaffold.test.ts` | ✓ |
| `examples/**` | ✓ `examples.test.ts` | ✓ |
| `packages/cli/dist/cli.js` (the npm tarball's only code) | ✗ no caller | ✗ names a tracker product |

So the truth is **partially satisfied**: satisfied on every text surface accord authors and renders,
failed on the compiled artifact it publishes. It is pre-existing — `table.ts` is byte-identical at
HEAD and has mtime 2026-09-15, untouched by this phase — and the executor recorded it as
`.planning/WINDOWS.md` entry 19 rather than fixing it, because it needs an owner ruling. That is the
right call; the ruling is now the blocking item, not the engineering.

**A second, unruled part of the same question.** `packages/core/test/helpers/denied.ts:10-14`
deliberately excludes `Shortcut` from `DENIED` — "it is ordinary English and would flag prose like
'a shortcut past the gate'". But three shipped templates use it in exactly the tracker-product sense:
`# tracker: { shortcut: "1234" }` at `ticket-build.md:9`, `ticket-maintain.md:9`, `epic.md:9`, and
`table.ts:24` pairs it with `jira` as a sibling adapter key. `shortcut` is not an accord adapter —
`config.yml` offers `none` and `github-issues` — so the word is there as a product name. Those lines
are also pre-existing (byte-identical at HEAD). This is an exception to a hard constraint that lives
in a test helper rather than in prose, which is the shape of exception the F-2 ruling rejected as
"one nobody can enforce later". Flagging it so the owner rules on both halves at once; not proposing
a carve-out, and explicitly not re-opening the example-URL question the owner settled.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/cli/src/commands/init.ts` | owns the filesystem, the report, and the refusal ordering | ⚠️ PARTIAL | Ordering defect CLOSED (`refusals()` ahead of the write region). New defect: UTF-8 re-encode at 119/124 — gap 1 |
| `packages/cli/test/init.test.ts` | whole-tree before/after equality as the "wrote nothing" oracle | ✓ VERIFIED | `listAll(repo)` + `refuses`; 32 cases, green. No non-UTF-8 pointer case — the coverage hole gap 1 sits in |
| `packages/core/src/scaffold/init.ts` | renders every scaffold path and text, incl. the commented `tests:` block | ✓ VERIFIED | pure, imports no Node built-in; block present at 53-57 |
| `packages/core/test/scaffold.test.ts` | proves the uncomment is one anchored edit yielding a valid config | ✓ VERIFIED | 3 new cases; performs the edit rather than reading it; guards the guard |
| `packages/core/templates/{ticket-build,ticket-maintain,epic}.md` | no named tool | ✓ VERIFIED | `https://example.com/design/...`; schema-valid; independent grep clean |
| `packages/core/test/templates.test.ts` | `deniedNames` over the templates record, bound to the directory | ✓ VERIFIED | live probe + record-length floor + byte-for-byte drift case |
| `packages/core/test/helpers/denied.ts` | one denied-name list, every shipped surface | ⚠️ PARTIAL | Templates surface now covered (gap 3 closed). Build output not covered — gap 2 |
| `packages/cli/src/render/table.ts` | — | ⚠️ CONSTRAINT | line 24 names a tracker product; reaches `dist/cli.js:419`. Pre-existing, unruled |
| `packages/core/src/scaffold/{pointer,workflow}.ts` | pure; text and separator decisions | ✓ VERIFIED | unchanged by the gap plans; `pointer.ts`'s own byte-exact-prefix invariant is broken at the CLI seam, not here |
| `packages/cli/src/commands/skills.ts` | one `writeSkillFiles` shared by `init` and `sync` (D-131) | ⚠️ PARTIAL | Still one function, two callers. Reports by return value, so a mid-loop throw loses statuses — GC-WR-01 |
| `examples/build/**`, `examples/maintain/**`, `.github/workflows/ci.yml` | one ticket per profile, `examples` job | ✓ VERIFIED | unchanged; `examples.test.ts` 12/12 inside the green run |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `init` | pin check | `refusals()` resolved at line 77-80, before the write `try` at line 95 | ✓ WIRED IN ORDER — was the previous pass's sole `✗` |
| `refusals()` | `writeSkillFiles` | `guarded ?? refusals()` — config parsed once (A-07) | ✓ WIRED — greenfield falls through, config-exists reuses |
| `init` catch | `rendered()` | one renderer named as a local, reached by both the throw and success paths | ✓ WIRED — cannot print two different reports |
| `scaffold/init.ts` `tests:` block | `examples/build/accord/config.yml` | `scaffold.test.ts:144` compares the two comment lines | ⚠️ PARTIAL — generated side anchored by `indexOf`, example side by a fixed `slice(28,30)` (GC-WR-04) |
| `templates.test.ts` | `packages/core/templates/` | `deniedNames(Object.entries(templates))` + byte-for-byte drift case | ✓ WIRED — the scan reaches the directory's bytes |
| `deniedNames` | `packages/cli/dist/cli.js` | — | ✗ NOT WIRED — no caller scans build output (gap 2) |
| `init.ts` pointer loop | `pointer.ts`'s byte-exact-prefix invariant | `readFileSync(…, 'utf8')` / `writeFileSync(…)` | ✗ BROKEN — lossy codec on both sides (gap 1) |
| `init.ts:78` config path literal | `scaffold/init.ts:74` | three independent copies of `'accord/config.yml'` | ⚠️ PARTIAL — GC-IN-01; if core moves the config this probe reports "greenfield" always, restoring the closed gap |

### Behavioural Spot-Checks

All run against `packages/cli/dist/cli.js` 0.1.0 in throwaway sandboxes under the scratchpad.

| Behaviour | Command | Result | Status |
| --- | --- | --- | --- |
| pin mismatch writes nothing | pre-seeded `0.0.1` config, `init` | exit 2, stdout empty, `find` listing identical | ✓ PASS (was ✗) |
| greenfield init | `init` in `git init` sandbox | 28 `created`, exit 0 | ✓ PASS |
| fresh repo lints clean | `lint` | `0 errors, 0 warnings` | ✓ PASS |
| generated config carries a commented `tests:` | read config off disk | block + instruction line present | ✓ PASS |
| the uncomment yields a valid config | anchored `sed`, then `lint` / `status` | `0 errors, 1 warnings`; `status` exit 0 | ✓ PASS |
| …and nothing more is needed | same | `lint.report-missing` until the report exists | ⚠️ residual (GC-WR-03) |
| templates carry no denied name | grep DENIED over `templates/` + `examples/` | nothing | ✓ PASS |
| published bundle carries no denied name | grep DENIED over `dist/cli.js` | `jira`, `shortcut` at line 419 | ✗ FAIL (gap 2) |
| non-UTF-8 `AGENTS.md` survives the append | write windows-1252 bytes, `init`, compare | `appended`, exit 0, two bytes destroyed | ✗ FAIL (gap 1) |
| the four gap-closure suites | `vitest run init/scaffold/templates/new-ticket` | 4 files, 96 passed | ✓ PASS |
| whole workspace | orchestrator's single full run | 36 files, 883 passed | ✓ PASS |

Only one full-suite run was consumed (the orchestrator's) plus one named four-file run, per the
run-budget rule. No cross-phase regression: the repo has 36 test files and all 36 are inside the
green run, so every Phase 01-06 suite is covered by it.

### Probe Execution

Not applicable — this project ships no `scripts/*/tests/probe-*.sh`, and no Phase 7 plan, summary or
success criterion declares a probe. The equivalent runnable checks are the behavioural spot-checks
above and `packages/cli/test/workflow-script.test.ts`, which executes the emitted CI script body
under `bash`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CLI-01 | 07-01, 07-02, 07-09, 07-10, 07-11 | `init` scaffolds folder, config, templates, skill copies; idempotent; never overwrites edited files; prints what it created | ⚠️ PARTIAL | "prints what it created" now holds on both paths — the pin-mismatch path writes nothing, so there is nothing unreported. Remaining defect is narrower and different: the pointer append rewrites a human-owned file lossily when it is not UTF-8 (gap 1). Skill copies are still deliberately overwritten under D-112 with an `overwrote local edits` report — the owner-reading item below |
| CLI-02 | 07-03, 07-07, 07-10 | `init` writes a CI workflow that runs `lint` and `gate done` on touched tickets and always reports a job result | ✓ SATISFIED | Static shape read off the emitted file; behaviour executed under `bash`, 11/11. The generated config now names `tests.report`, so the out-of-box path is one documented edit from Done-capable |
| CLI-03 | 07-04 | `init` adds a short pointer to `AGENTS.md` and `CLAUDE.md` without duplicating skill bodies | ⚠️ PARTIAL | All four D-142 branches execute and the block carries no skill body, but the append is not byte-preserving on non-UTF-8 input (gap 1) |
| SKILL-04 | 07-05 | Every skill begins with a lint or gate call and never restates a rule the CLI enforces | ✓ SATISFIED | Unchanged; the rule-id ban imports the live `RULES`/`READY_RULES`/`DONE_RULES` tables |
| INTG-02 | 07-06, 07-08, 07-10 | Example repo with one maintain-profile and one build-profile ticket passing both gates | ✓ SATISFIED | Both pass lint, `gate ready` and `gate done` through the real binary, exit 0; rule-side sensitivity proven |

No orphaned and no new requirements: `.planning/REQUIREMENTS.md` maps exactly CLI-01, CLI-02, CLI-03,
SKILL-04 and INTG-02 to Phase 7; the three gap plans declare only IDs already in that set
(07-09 → CLI-01; 07-10 → CLI-01, CLI-02, INTG-02; 07-11 → CLI-01).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| all Phase 7 source, test and template files | — | `TBD` / `FIXME` / `XXX` | — | none found (grep exit 1 across the gap-closure file set) |
| `init.ts`, `scaffold/init.ts` | — | `TODO` / `HACK` / `PLACEHOLDER` | — | none found |
| `packages/cli/src/commands/init.ts` | 119, 124 | lossy codec over a human-owned file, reported as a success | 🛑 Blocker | gap 1 |
| `packages/cli/src/render/table.ts` | 24 | shipped byte names another tool (via `dist/cli.js:419`) | 🛑 Blocker (constraint) | gap 2, awaiting owner ruling |
| `packages/core/test/helpers/denied.ts` | 10-14 | a hard constraint's only exception lives in a test helper | ⚠️ Warning | gap 2, second half |
| `packages/cli/src/commands/skills.ts` | 36-58 | report returned, not accumulated — a mid-loop throw loses every status already true | ⚠️ Warning | GC-WR-01; defeats D-112's "never lose work without saying so" on a partial run |
| `packages/cli/test/init.test.ts` | 256-289 | the refusal whose position actually changed is the one with no config-exists test | ⚠️ Warning | GC-WR-02; a regression moving `assertNoLink` back inside the `try` keeps all 96 green |
| `packages/core/src/scaffold/init.ts` | 55 | "Uncomment the two lines below" understates the edit; and "uncomment" is ambiguous about the space | ⚠️ Warning | GC-WR-03 |
| `packages/core/test/scaffold.test.ts` | 144 | the example side is pinned by `slice(28, 30)` — the fixed offset its own comment rejects | ⚠️ Warning | GC-WR-04 |
| `packages/cli/src/commands/init.ts` | 78 | `'accord/config.yml'` is a literal in three places and the closed gap hinges on it | ℹ️ Info | GC-IN-01 |
| `packages/cli/src/commands/init.ts` | 48, 110 | `refusals()` is named for what it throws, used for what it returns | ℹ️ Info | GC-IN-02 |

Prohibition checks, re-run against the codebase:

- `packages/core/src/scaffold/**` imports no Node built-in — clean.
- The CLI spawns only `git` and `gh`. `npx` appears only as emitted workflow text and in the pin
  refusal message; never as a spawn target.
- Every path `init` printed on Windows used forward slashes (`init.test.ts:174` holds it on both streams).
- The generated workflow requests no write permission and contains no Actions expression inside any
  `run:` body.
- `npm run gen` is idempotent (orchestrator-verified), so `packages/core/src/generated/templates.ts`
  is a faithful record of the rewritten templates rather than a hand edit.

### Does 07-REVIEW.md's Gap-Closure Pass change the verdict?

Yes, on one finding, and it is the reason this phase is not passing.

- Its verdicts on all three gaps agree with mine, reached independently: CR-01 closed (and closed
  structurally, not accidentally), WR-01 addressed by its own stated alternative, 07-11 clean. I
  re-derived each from the code and from running the binary, not from the review.
- **`GC-CR-01` is a genuine blocker** and I accept it. I reproduced the byte loss independently
  against the shipped binary rather than taking the review's transcript, and confirmed the coverage
  hole that hid it (every `init.test.ts` pointer case is ASCII; the `bytes()` helper that would catch
  it already exists and reads `latin1`). It is in Phase 7's own code, on a data-loss path, silent,
  and untested — so the phase cannot be marked complete over it.
- Its four warnings and two infos are real but none of them blocks: GC-WR-01 and GC-WR-02 are
  coverage and reporting quality in code that is correct on its happy path; GC-WR-03 is a wording
  fix on top of an owner-accepted residual; GC-WR-04 is a test fragility whose subject claim is true.
  All are listed above so the next plan can sweep them with gap 1.
- One thing the review did not weigh, and this report does: its own `07-11 F-1` finding — the tracker
  product name in `dist/cli.js` — is not just a ticket. It is the same hard constraint gap 3 existed
  to make machine-held, on the surface Phase 9 uploads. That is gap 2 here.

### Gaps Summary

All three previous gaps are genuinely closed, each by the mechanism its plan claimed, and each
verified against the code and the running binary rather than the summary. Gap 1's fix is the one I
most expected to be cosmetic and is not: the refusals are consolidated into one callable resolved
before the write region opens, so the ordering is held by a single expression instead of by three
adjacent checks, and the test that would have caught the original defect now compares whole trees.
Gap 2 took the owner's chosen shape and is held by a test that performs the uncomment instead of
reading it. Gap 3's five lines are neutral and, more importantly, the constraint over that directory
is now machine-held through a record the drift case binds byte-for-byte to the files on disk.

Two things stop this passing.

The first is new and is the gap-closure review's blocker. `accord init`'s pointer append reads
`AGENTS.md` / `CLAUDE.md` as UTF-8 and writes the decoded string back, so a file a human wrote in
windows-1252 — ordinary on Windows, which is this project's primary development platform and an
explicit cross-platform constraint — loses every non-UTF-8 byte, and the command says `appended` and
exits 0. This is the only `init` write that is not skip-if-exists, into the only file whose contents
belong entirely to a human, and core states the byte-exact-prefix invariant it violates in a comment
three lines long. The fix is two `'latin1'` arguments and one test case; the reason it is a blocker
is not its size but its shape — silent, unrecoverable unless the file was committed, and in the file
a team is most likely to have hand-written before they ever ran accord.

The second is a constraint, not a defect, and it needs the owner rather than an engineer. Gap 3
closed the surface it named and revealed that the scan covers every text accord authors and none of
the bytes it publishes: `packages/cli/dist/cli.js:419` names a tracker product, preserved from a
JSDoc comment the bundler keeps. Phase 9 is publish. The same ruling should settle why `Shortcut` is
excluded from the denied list while three shipped templates use it as a tracker key — an exception to
a hard constraint that currently lives only in a test helper's docstring, which is the shape of
exception the F-2 ruling rejected.

---

_Verified: 2026-09-18T20:20:00Z_
_Verifier: Claude (gsd-verifier)_
_Supersedes: 2026-09-18T11:40:00Z (gaps_found, 3/4). Owner rulings and `resolved_after_verification` carried forward verbatim._
