---
phase: 07-scaffolding-and-example-repo
verified: 2026-09-19T10:45:00Z
status: passed
score: 5/5 must-haves verified
covered_files:

  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
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
  - ".planning/phases/07-scaffolding-and-example-repo/07-12-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-12-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-13-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-13-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-14-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-14-SUMMARY.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-15-PLAN.md"
  - ".planning/phases/07-scaffolding-and-example-repo/07-15-SUMMARY.md"
  - "README.md"
  - "packages/cli/src/commands/init.ts"
  - "packages/cli/src/commands/skills.ts"
  - "packages/cli/src/guard.ts"
  - "packages/cli/src/render/table.ts"
  - "packages/cli/test/bin.test.ts"
  - "packages/cli/test/init.test.ts"
  - "packages/cli/test/skills-sync.test.ts"
  - "packages/core/src/generated/templates.ts"
  - "packages/core/src/scaffold/init.ts"
  - "packages/core/src/scaffold/pointer.ts"
  - "packages/core/src/scaffold/workflow.ts"
  - "packages/core/templates/epic.md"
  - "packages/core/templates/ticket-build.md"
  - "packages/core/templates/ticket-maintain.md"
  - "packages/core/test/convention.test.ts"
  - "packages/core/test/examples.test.ts"
  - "packages/core/test/scaffold.test.ts"
  - "packages/core/test/templates.test.ts"
  - "test/helpers/denied.ts"

covered_digest: "v1:sha256:6e1ec536563e10be29ba8a53f05cda28a87d6aeb2347a9bd2df7b645f7772dfb"
behavior_unverified: 0
overrides_applied: 0

digest_note: >-
  The list gains one entry over the 2026-09-19T09:30Z report: `.planning/ROADMAP.md`, because success
  criterion 1 was reworded today and the criterion text this report verifies against is now itself
  evidence — a further reword should invalidate the digest. Control run, so the staleness claim is
  measured rather than assumed: over the IDENTICAL 51-file list the previous report used, the digest is
  now `v1:sha256:d3e3c461b96039da471663c3eaa4a7d65ff7dd6226a1435a6edb26aff389d85b`, against that
  report's `v1:sha256:cfbb3861…`. `test/helpers/denied.ts` alone moved it.

digest_restamp: >-
  The digest above is NOT the one this report was written with. It was recomputed at 2026-09-19T11:05Z,
  after the phase transition ticked the Phase 7 checkbox in `.planning/ROADMAP.md`, which is a covered
  file — so completing the phase invalidated its own verification. That is a real seam in the mechanism,
  not a one-off: the file carrying criterion 1's text (evidence) also carries the completion marker
  (bookkeeping), and the fingerprint cannot tell them apart. Re-stamped deliberately, and only after
  the delta was CHECKED rather than assumed: `git diff .planning/ROADMAP.md` against `1c17a55` — the
  commit holding the exact content the verifier stamped — is one line, line 22, `- [ ]` to `- [x]` plus
  a completion date. Criterion 1's text at line 261 is byte-identical. No evidence moved.
  Original digest, for the record: `v1:sha256:7bef65cb3e96db37e1b935f7f9b772bb27cf2fd65a3898d2d02f1ea28fd75906`.
  Recomputed with `gsd-tools query verification.fingerprint`, not by hand.

owner_rulings_this_pass:

  - item: "DENIED-CONTRADICTION"
    ruled: "2026-09-19, reading A (07-UAT.md test 1)"
    applied: >-
      `'Claude ' + 'Code'` removed from `DENIED`; the docstring rewritten to state the rule rather than
      assert an absence that was not true.
    verified_coherent: true
    evidence: >-
      All three halves of the rewritten docstring check out against the code it cites, and the ruling's
      premise is not merely asserted — it is measured. `claude`/`codex`/`cursor`/`copilot` are the
      `runtimes:` values of the config `init` writes (source `scaffold/init.ts:49-51`; the generated file
      carries them at line 27 with the comment at 25-26) and the path components `skills sync` writes into
      (`skills/targets.ts:17-22`), confirmed by a real `init` run producing `.claude/skills/accord-*` and
      `.agents/skills/accord-*`. A probe-verified scan over EVERY published byte of both packages finds
      `Codex`/`Cursor`/`Copilot` in `packages/core/dist/index.js:197-199, 505, 2631-2633, 2780-2782`,
      `dist/index.d.ts:101` and `schemas/config.schema.json:38` — so banning the one-word forms would fail
      the scan on accord's own shipped output, exactly as the docstring says. The remaining seven entries
      still hold: zero offenders across all 15 published files (one decided non-breach, below). All eight
      `deniedNames` call sites pass (10 named test files, 189 tests, run this pass).
  - item: "Success criterion 1 wording"
    ruled: "2026-09-19 (07-UAT.md test 3)"
    applied: >-
      `.planning/ROADMAP.md:261` — "never overwrites an edited file" became "never overwrites a
      human-authored file", with the skill-copy carve-out inline. No code changed.
    verified_against_code: true
    evidence: >-
      Measured on one run of the shipped binary with three hand edits planted first: `accord/product/
      glossary.md` -> `skipped`, edit intact; `AGENTS.md` -> `skipped`, edit intact, `accord:start`
      marker count still 1; `.claude/skills/accord-ba/SKILL.md` -> `overwrote local edits`, edit gone.
      The criterion now describes what the code does, in both directions.

owner_rulings_carried:
  # From archive/07-VERIFICATION-pre-gap.md, preserved there verbatim. Discharge status re-checked this pass:
  - item: WR-01
    discharged: true
    evidence: "the commented `tests:` block ships in the generated config; re-measured this pass"
  - item: F-2
    discharged: true
    evidence: "templates genericised; machine-held by `templates.test.ts:153-154`, green this pass"
  - item: "07-06 F-1"
    discharged: true
    evidence: "perturbation run recorded in an earlier pass; `examples.test.ts` green this pass"
  - item: GAP-2a
    discharged: true
    evidence: >-
      `table.ts:24` reads `{ 'github-issues': '1e3' }`; the bundle scan at `bin.test.ts:41-51` sits behind
      a live probe. Independent re-scan this pass: zero offenders in `packages/cli/dist/cli.js`.
  - item: GAP-2b
    discharged: true
    evidence: >-
      `DENIED`/`deniedNames` live only at `test/helpers/denied.ts`; eight call sites across five test
      files; `grep -rn DENIED` finds no second copy.
  - item: GAP-2c
    discharged: true
    evidence: "all three templates read `# tracker: { github-issues: \"1234\" }` at line 9"
  - item: GAP-2c-EXT
    discharged: true
    evidence: "`README.md:15` reworded to the same key; `convention.test.ts` green this pass"
  - item: GAP-2d
    discharged: true
    evidence: >-
      Re-confirmed independently: `packages/core/dist/index.js:1259` is the CSS
      `/^(?:linear|radial|conic)-gradient\(/i` alternation inside the tokens lint rule. It is the ONLY
      hit of the seven names anywhere in either package's published byte set. Decided non-breach.
  - item: GAP-SCOPE
    discharged: true
    evidence: "both blockers and all four warnings closed; the two infos correctly left out"

re_verification:
  previous_status: human_needed
  previous_score: 4/5
  previous_verified: 2026-09-19T09:30:00Z
  closed_since:
    - item: "DENIED-CONTRADICTION (truth 5 was UNCERTAIN)"
      closed_by: "owner ruling 2026-09-19 + the one-sided edit to `test/helpers/denied.ts`"
      evidence: >-
        Truth 5 is now scoreable and scores VERIFIED. See `owner_rulings_this_pass` and the Truth 5
        section below for the measured evidence, including a scan over all 15 published files.
    - item: "Human item 3 — the skill-copy overwrite reading of criterion 1"
      closed_by: "owner ruling 2026-09-19 + the ROADMAP reword"
      evidence: "criterion 1 re-verified against the NEW wording, both directions, on a live run"
  gaps_closed_earlier:
    # Closed by 07-12/13/14/15 before the previous report; regression-checked this pass, all still true.
    - "gap 1 — lossy `AGENTS.md`/`CLAUDE.md` pointer append (latin1 pair at `init.ts:121`/`:131`)"
    - "gap 2 — the published bundle named another tool (`table.ts:24` JSDoc + the bundle scan)"
    - "GC-WR-01 — a mid-loop throw lost every status already made true (`skills.ts:47` `out` array)"
    - "GC-WR-02 — no test for the config-exists refusal 07-09 moved"
    - "GC-WR-03 — the `tests:` instruction understated the edit"
    - "GC-WR-04 — `scaffold.test.ts` pinned the example side with a fixed `slice(28, 30)`"
  gaps_remaining: []
  regressions: []
  test_evidence: >-
    Ten named test files in two targeted invocations (never the full suite — the orchestrator ran that
    once immediately before this pass: `npm run check` exit 0, eslint clean, 3x tsc clean, 36 files /
    888 tests). `workflow-script.test.ts`, `bin.test.ts`, `init.test.ts`, `skills-sync.test.ts` => 4
    files / 72 tests passed. `scaffold.test.ts`, `examples.test.ts`, `templates.test.ts`,
    `skills.test.ts`, `convention.test.ts`, `skill-commands.test.ts` => 6 files / 117 tests passed.

deferred:

  - truth: "The GENERATED workflow (`accord.yml`, in a user's repository) has executed on a runner"
    addressed_in: "Phase 9"
    evidence: >-
      Phase 9 success criterion 2: "`accord init` from the published package runs on the employer
      project's repository and the generated CI workflow is green." Phase 7's own obligation is that the
      emitted script BODY is executed, which it is, under `bash`, by
      `packages/cli/test/workflow-script.test.ts` (8 cases including a mutation probe and two real-binary
      cases) — green this pass.
    carried_from: "2026-09-18T20:20:00Z report"

advisory:

  - finding: >-
      `packages/core/src/model/snapshot.ts:42` carries a denied name in a line comment:
      `design?: string; // 'https://www.figma.com/file/abc'`
    category: other
    reason: >-
      Raised by 07-13 and 07-14, outside every plan's scope, deliberately not actioned. Confirmed NOT a
      breach this pass by the same scan that cleared everything else: zero hits of that name across all
      15 published files of both packages, because tsdown strips line comments and `src/` is outside
      core's `files:` list. The residual risk is that reflowing it into a BLOCK comment would publish it
      — the exact mechanism that produced gap 2. One line to reword, whenever the owner chooses.
    evidence_status: "reproducible scan; no failing test, because nothing is currently wrong"
    new_scope_basis: "`snapshot.ts` mtime 2026-09-14T17:08 — before the phase began. Not a regression."
  - finding: >-
      `README.md` is named by `.claude/CLAUDE.md` as a surface the no-other-tools constraint covers, yet
      it is read by NO `deniedNames` call site — AND it is not actually published by either package.
    category: other
    reason: >-
      Two separate facts, one of which corrects a premise carried by the previous report. (a) No scan
      reads it: the eight call sites cover the CLI bundle, the examples, the scaffold surfaces, the skill
      bodies and the templates record. Structurally the same hole that let gap 2 ship. (b) It does not
      ship: both packages' `files:` lists name `README.md`, but neither `packages/cli/` nor
      `packages/core/` contains one — only the repository root does, and `files:` resolves inside the
      package. `npm pack --dry-run` proves it: the cli tarball is 2 files (`dist/cli.js`,
      `package.json`), the core tarball 13 (dist, schemas, templates, `package.json`). No README in
      either. So the previous report's "README.md is in BOTH packages' `files:` lists, so it is a
      published byte" is true about the list and false about the outcome. This does not disturb the
      DENIED ruling, which rests on config values and directory components, not on README — but it is a
      live Phase 9 item in its own right: as things stand, publishing yields two packages with no README
      on their npm pages.
    evidence_status: >-
      reproducible: `npm pack --dry-run -w packages/cli` -> total files 2; `-w packages/core` -> 13,
      neither listing a README. `grep -rn 'deniedNames(' packages/ test/` -> 8 call sites, none on README.
  - finding: >-
      `test/helpers/denied.ts:17` cites `scaffold/init.ts:48-50` for the `runtimes:` values; the lines
      are 49-51.
    category: other
    reason: >-
      Line 48 is blank, 49-50 are the comment, and 51 is `runtimes: [claude, codex]` — the values line
      the sentence is actually about sits outside the cited range. The claim is true; only the citation
      is off by one. Recorded because this project cites line numbers as load-bearing evidence, so a
      stale citation costs the next reader the same minute it cost this pass.
    evidence_status: "reproducible: `grep -n '' packages/core/src/scaffold/init.ts | sed -n '44,52p'`"

behavior_unverified_items: []
coincidental_reliance_items: []

human_verification:

  - test: >-
      Commit and push the branch, and let `.github/workflows/ci.yml` run — both the `check` matrix
      (ubuntu-latest + windows-latest x Node 22 + 24) and the `examples` job.
    expected: >-
      Both green. The `examples` job prints `== build` and `== maintain` and exits 0.
    why_human: >-
      Nothing in phases 6 or 7 is committed — HEAD is `53e9df9`, which predates both — so no job has ever
      run on a runner. Every behavioural claim in this report is Windows-observed. The `examples` job
      body was executed VERBATIM this pass under Git Bash on Windows and both examples passed (`lint`
      0/0, `gate ready` 0 errors, `gate done` 0 errors + 1 allowed `gate.author-match` warning, exit 0,
      accumulator 0), which is strong evidence its logic is sound — but `sed -i`, `mktemp -d` and `cp -R`
      are the parts a Windows shim can differ on, and Git Bash is not ubuntu. This is a prerequisite
      gate, not a code defect: it resolves the moment the phase is committed and pushed, and not before.
    carried_from: "2026-09-18T11:40:00Z report — still open; recorded as 07-UAT.md test 2 (blocked)"
    blocking_reason: "owner's standing rule: nothing is committed without explicit approval"
---

# Phase 7: Scaffolding and Example Repo Verification Report

**Phase Goal:** A team runs one command in an empty repository and receives the whole contract: folder,
config, templates, skills, agent pointers, and CI. An example repo proves both profiles pass both gates.

**Verified:** 2026-09-19T10:45:00Z
**Status:** human_needed — 5/5 must-haves verified; one carried prerequisite
**Re-verification:** Yes — third pass. Replaces the 2026-09-19T09:30Z report after two owner rulings.

## What changed since the 09:30 report

Two owner decisions, both recorded in `07-UAT.md`, both made today. Neither is a defect.

1. **`test/helpers/denied.ts`** — `'Claude ' + 'Code'` removed from `DENIED`, docstring rewritten. This
   closes DENIED-CONTRADICTION, the open item that left truth 5 unscoreable at 4/5.
2. **`.planning/ROADMAP.md:261`** — criterion 1 reworded to "never overwrites a **human-authored** file",
   with the skill-copy carve-out stated inline. Criterion 1 is verified below against THIS wording.

Everything else in the tree is byte-identical to what the 09:30 report measured, and the previously
closed gaps were regression-checked rather than re-litigated.

**Method.** The whole repository is uncommitted; HEAD is `53e9df9`. `git` was used only to establish
provenance, never as evidence of what this round did. Every behavioural claim comes from running the
built `packages/cli/dist/cli.js` (built 09:58) in throwaway `git init` sandboxes under the
session scratchpad — never against `C:/Work/accord` itself. The bundle's mtime is 2026-09-19T09:58 and
`find packages test -name '*.ts' -newer packages/cli/dist/cli.js` returns nothing, so the scanned and
executed bytes are newer than every source file in the phase, including today's `denied.ts` edit (09:48).

**Scanner caveat, recorded because it fired again this pass.** The first ad-hoc denied scanner written
through the shell silently lost its `\b` escapes (`'\\b'` collapsed to a single backspace character) and
its positive control returned `[]` — a clean result for a file that demonstrably carries two denied
names. That run was discarded. The scanner used for every clean result below builds the escape from
`String.fromCharCode(92)` and refuses to report unless its control fires with exactly two hits. 07-14,
07-15 and the previous verifier each recorded the same hazard independently; this is now four times.

## Goal Achievement

### Observable Truths

Truths 1-4 are the ROADMAP's four success criteria, verbatim as they read today. Truth 5 is the
CLAUDE.md hard constraint, carried in this phase's re-verification contract since the first pass.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `accord init` in an empty repo creates the root folder, `config.yml` with the pinned version, templates, and skill copies in both paths, prints every created path, and a second run changes nothing and never overwrites a **human-authored** file (skill copies are accord-owned rendered output: a hand edit there is overwritten and reported as `overwrote local edits`) | ✓ VERIFIED | Greenfield: 28 `created` lines, 28 files on disk, exit 0, `accord lint` `0 errors, 0 warnings`, pin `accord: "0.1.0"` = the CLI's own package version. Repeat run: 0 created, 6 `skipped` + 22 `unchanged`, tree byte-identical over all 28 files (sha256 snapshot, positive control fired on a 1-byte mutation). Carve-out measured in both directions — see below |
| 2 | The generated GitHub Actions workflow runs `lint` and `gate done` on touched tickets and reports a job result on docs-only and no-ticket diffs | ✓ VERIFIED | Emitted `accord.yml` read from a real `init`: `npx --yes @accord-dev/accord@0.1.0 lint`, then `git diff --name-only --diff-filter=d "$BASE"...HEAD \| grep -E '^accord/tickets/[^/]+[.]md$'`, then `gate done "$id"` per match, `exit $code` on both branches including the no-ticket early exit. `workflow-script.test.ts` green this pass — the emitted `run:` body EXECUTED under bash against six diff shapes plus a mutation probe and two real-binary cases |
| 3 | `AGENTS.md` and `CLAUDE.md` receive a short pointer to the accord skills without a copy of any skill body, created when missing and appended when present | ✓ VERIFIED | Created-when-missing: a 9-line ASCII block, two directory paths and one rule line, no skill body. Appended-when-present, byte-exact on both codecs: windows-1252 `636166e9209620646173680a` -> same prefix + `0a3c…`; UTF-8 multi-byte `2320476869206368c3ba20e280942064e1bbb120c3a16e20e29c850a` -> same prefix + `0a3c…`. Negative control confirms the prefix comparison discriminates. Status word `appended`, marker count 1 |
| 4 | The example repo holds one maintain-profile ticket and one build-profile ticket, and both pass `gate ready` and `gate done` in that repo's CI | ✓ VERIFIED (environment carried) | The `examples` CI job body run VERBATIM, both examples: `lint` `0 errors, 0 warnings` exit 0; `gate ready` `0 errors` exit 0; `gate done` `0 errors, 1 warnings` (`gate.author-match`, allowed) exit 0; accumulator 0. `examples.test.ts` green. The gates are proven; only the ubuntu runner is not — see Human Verification |
| 5 | Nothing accord ships names another tool, plugin, harness, or planning system (CLAUDE.md hard constraint) | ✓ VERIFIED | Was UNCERTAIN at 4/5; now scoreable and clean. Probe-verified scan over **every published byte of both packages** (15 files, enumerated by `npm pack --dry-run`): exactly one hit of the seven names, `core/dist/index.js:1259`, the decided GAP-2d non-breach. Detail below |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified, 0 overrides).

Every behaviour-dependent truth above was exercised by running code: the byte-level append invariant on
two encodings, the second-run no-op against a hashed tree with a firing control, the overwrite/preserve
split on three planted edits, the refusal's write-nothing property, the emitted script body under bash,
and both gates on both examples. None rests on symbol presence.

### Truth 1 — the reworded carve-out, measured in both directions

One run of the shipped binary, three hand edits planted first:

| Edited file | Kind | Reported | Edit after the run |
| --- | --- | --- | --- |
| `accord/product/glossary.md` | human-authored document | `skipped` | intact |
| `AGENTS.md` | human-authored document | `skipped` | intact; `accord:start` count still 1 |
| `.claude/skills/accord-ba/SKILL.md` | accord-owned rendered output | `overwrote local edits` | gone |

That is criterion 1 as reworded, in both directions, on the same run. The loss is loud, not silent,
which is the property the owner's ruling turns on (a kept edit would drift from the definition with
nothing detecting it — CLI-03).

One reading worth stating plainly, because the criterion's word "templates" could be read two ways:
`init` writes the two product documents instantiated from `packages/core/templates/`
(`accord/product/business-rules.md`, `accord/product/glossary.md`). It does **not** copy the ticket
templates into the repository — `accord new ticket` renders those from the package at the moment they
are needed. That is the design (one generated record, `src/generated/templates.ts`, bound to the
directory by a drift case), not an omission.

### Truth 5 — the constraint, now measured on the published byte set

The previous report could not score this truth because `DENIED` and its own docstring contradicted each
other. The owner settled it (reading A) and the code was changed one-sidedly. Three things were checked,
in the order that matters:

**1. Is the new docstring true?** It makes three checkable claims.

| Claim | Verdict | Evidence |
| --- | --- | --- |
| `claude`/`codex`/`cursor`/`copilot` are `runtimes:` values of the config `init` writes | TRUE | Source `scaffold/init.ts:49-51`; the generated `config.yml` carries them at line 27 with the comment at 25-26. Read off a real `init` run, not off the source |
| …and are components of the paths `skills sync` writes into | TRUE | `skills/targets.ts:17-22` `DIRS`; the same `init` run wrote `.claude/skills/accord-*` and `.agents/skills/accord-*`, 22 files |
| Banning them would make the scan fail on accord's own output | TRUE | Probe-verified scan of the published set finds `Codex`/`Cursor`/`Copilot` in `core/dist/index.js:197-199, 505, 2631-2633, 2780-2782`, `core/dist/index.d.ts:101`, and `core/schemas/config.schema.json:38`. Those are shipped files. A one-word ban would red the scan on the schema accord publishes |
| "this file does not contain the names it forbids" | TRUE | Self-scan of `test/helpers/denied.ts`: zero of the seven names present unsplit |

The one blemish is a citation, not a claim: the docstring points at `scaffold/init.ts:48-50`; line 48 is
blank and the `runtimes:` values line is 51. Recorded as advisory 3.

**2. Do the remaining seven entries still hold?** Scan over the exact file set `npm pack --dry-run`
reports for both packages — 15 files, the whole published surface:

```
FILES SCANNED: 15
DENIED(7) OFFENDERS: ["packages/core/dist/index.js:1259: Linear"]
```

with the control firing first (2 hits on a planted file). That single hit is the settled GAP-2d
non-breach, re-read this pass and unchanged: it is the CSS function-name alternation
`/^(?:linear|radial|conic)-gradient\(/i` inside the tokens lint rule, naming no product. The CLI bundle
— the only code npm uploads for `@accord-dev/accord` — is completely clean.

**3. Do all the call sites still pass?** Eight `deniedNames` call sites across five test files
(`bin.test.ts` x2, `examples.test.ts`, `scaffold.test.ts` x2, `skills.test.ts`, `templates.test.ts` x2).
All five files green this pass, inside 189 passing tests over ten named files.

**On `README.md:18`.** Under the owner's ruling it is not a breach: the four host runtimes are the
hosts accord is built to run inside, not tools it is not built for. Not re-raised. Two facts about that
file do belong on the record, and both are advisories rather than questions: no `deniedNames` call site
reads it, and — newly measured this pass — it is not actually published. Both packages' `files:` lists
name `README.md`, but neither package directory contains one; `npm pack --dry-run` yields 2 files for
the CLI and 13 for core, no README in either. The previous report's premise that README is "a published
byte" was true about the `files:` list and false about the outcome. The owner's `follow_up` note in
`07-UAT.md` — whether to reword line 18 for durability — remains an editorial decision, explicitly
"open, not blocking", and is deliberately not coupled to the scan.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `test/helpers/denied.ts` | seven entries, docstring stating the rule, one list at the repo root | ✓ VERIFIED | 7 split literals; no second copy in the tree; eight call sites import it downwards; self-scan clean |
| `packages/cli/src/commands/init.ts` | latin1 read/write pair; refusals above the write region; shared `results` | ✓ VERIFIED | `:121` read latin1, `:131` write latin1, `:84` `results`, `:112` passes it to `writeSkillFiles`, `:137` catch prints before rethrow |
| `packages/cli/src/commands/skills.ts` | `writeSkillFiles` pushes into a caller-supplied array | ✓ VERIFIED | `:47` `(root, targets, out: ReportRow[] = [])` |
| `packages/core/src/scaffold/pointer.ts` | pure-ASCII block, append-only | ✓ VERIFIED | proven by the byte-exact append on two encodings |
| `packages/core/src/scaffold/init.ts` | `tests:` instruction naming BOTH halves of the edit | ✓ VERIFIED | re-measured: hash-only -> `error load.yaml-syntax`; `"# "` -> `0 errors, 1 warnings`; repointed `report:` -> `0 errors, 0 warnings` |
| `packages/core/src/scaffold/workflow.ts` | `lint` + `gate done` on touched tickets, result on every branch | ✓ VERIFIED | emitted document read off a real `init`; body executed by `workflow-script.test.ts` |
| `packages/cli/test/bin.test.ts` | bundle scan behind a live probe | ✓ VERIFIED | `:41-51`: existence + length > 1000 + planted-name probe before the real assertion |
| `packages/core/test/scaffold.test.ts` | both sides anchored on their own key line; config/workflow/pointer scanned | ✓ VERIFIED | `:406-407` probe-then-assert over `initFiles` + the pointer block; `indexOf` anchors, no fixed slice |
| `packages/cli/src/render/table.ts` | JSDoc naming a real adapter key | ✓ VERIFIED | `:24` `{ 'github-issues': '1e3' }` |
| `packages/core/templates/{ticket-build,ticket-maintain,epic}.md` | `github-issues` tracker example | ✓ VERIFIED | all three at line 9 |
| `packages/core/src/generated/templates.ts` | byte-identical to `packages/core/templates/` | ✓ VERIFIED | `npm run gen` re-run under a backup-and-restore fence: zero drift in `templates.ts` and `skills.ts` |
| `README.md` | line 15 tracker key reworded | ✓ VERIFIED | `tracker: { github-issues: "1234" }` |
| `examples/{build,maintain}/**` | one ticket per profile, both gates passing | ✓ VERIFIED | both run through the real CLI in committed sandboxes |
| `.planning/ROADMAP.md:261` | criterion 1 reworded with the carve-out inline | ✓ VERIFIED | reads "never overwrites a human-authored file", carve-out present; criterion verified against it |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `init.ts` pointer loop | the human's `AGENTS.md`/`CLAUDE.md` bytes | `readFileSync(…, 'latin1')` / `writeFileSync(…, 'latin1')` | ✓ WIRED | verified as a PAIR by round-tripping real non-UTF-8 and real multi-byte input |
| `init.ts` `results` | `writeSkillFiles` `out` | same array reference, `ReportRow` from `skills.ts` | ✓ WIRED | shared by construction; the catch renders it before rethrowing |
| `bin.test.ts` | `packages/cli/dist/cli.js` | `../dist/cli.js` + `run npm run build first` guard | ✓ WIRED | bundle mtime 09:58 is newer than every phase source; no `.ts` is newer |
| both test trees | `test/helpers/denied.ts` | `../../../test/helpers/denied.js` | ✓ WIRED | downward imports only, five files, eight call sites |
| `scaffold/init.ts` `runtimes:` + `skills/targets.ts` `DIRS` | the docstring's stated rule | cited line ranges | ✓ WIRED (citation off by one) | the rule the docstring states is the rule the code implements; only the line numbers drifted |
| `packages/core/templates/` | `src/generated/templates.ts` | `npm run gen` | ✓ WIRED | regenerated this pass, zero drift |
| generated workflow | `lint` + `gate done` | emitted script body executed under `bash` | ✓ WIRED | `workflow-script.test.ts`, 8 cases incl. a mutation probe |
| `.github/workflows/ci.yml` `examples` job | `examples/*/` + `dist/cli.js` | `mktemp -d` + `cp -R` + `git init` + `sed -i` | ✓ WIRED (Windows-observed) | job body run verbatim; both examples green; never run on a runner |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| generated `config.yml` | `accord: "0.1.0"` | the CLI's own `package.json` version (D-95 pin) | ✓ compared to `packages/cli/package.json` this pass | ✓ FLOWING |
| generated `accord.yml` | `@accord-dev/accord@0.1.0` | same version source | ✓ | ✓ FLOWING |
| `init` report lines | `results[]` | pushed at each real filesystem outcome | ✓ 28 created / 0 created + 28 status rows on re-run | ✓ FLOWING |
| `bin.test.ts` scan | `text` | `readFileSync` of the real built bundle, length-guarded | ✓ | ✓ FLOWING |
| `examples.test.ts` | `snapshot` | `loadSnapshot` over the real example directories | ✓ | ✓ FLOWING |
| `gate done` verdict | live rule tables | `gateDone(snapshot, ticket)` in a sandbox repo | ✓ 1 real warning emitted (`gate.author-match`), not a constant pass | ✓ FLOWING |

### Behavioural Spot-Checks

All run on Windows 11 against `packages/cli/dist/cli.js`, in throwaway `git init` sandboxes.

| Behaviour | Command | Result | Status |
| --- | --- | --- | --- |
| Greenfield init | `node dist/cli.js init` in an empty repo | 28 `created`, 28 files, exit 0 | ✓ PASS |
| Pin is the CLI's own version | compare `config.yml` to `packages/cli/package.json` | both `0.1.0` | ✓ PASS |
| Generated repo lints clean | `node dist/cli.js lint` | `0 errors, 0 warnings`, exit 0 | ✓ PASS |
| Repeat run changes nothing | `init` again + sha256 tree snapshot | 0 created, 28/28 files identical | ✓ PASS |
| …and the snapshot is not blind | append 1 byte, re-snapshot | control FIRED | ✓ PASS |
| Human document preserved | edit `glossary.md`, re-run | `skipped`, edit intact | ✓ PASS |
| Human pointer file preserved | edit `AGENTS.md`, re-run | `skipped`, edit intact, marker count 1 | ✓ PASS |
| Skill copy overwritten and reported | edit `.claude/skills/accord-ba/SKILL.md`, re-run | `overwrote local edits`, edit gone | ✓ PASS |
| windows-1252 append byte-exact | seed `63 61 66 E9 20 96 20 64 61 73 68 0A` | prefix preserved TRUE | ✓ PASS |
| UTF-8 multi-byte append byte-exact | seed `# Ghi chú — dự án ✅` | prefix preserved TRUE | ✓ PASS |
| …and the comparison discriminates | compare against a wrong prefix | control OK (no match) | ✓ PASS |
| Refusal writes nothing (GC-WR-02) | skill target replaced by a regular file | exit 2, stdout 0 bytes, stderr `… is not a regular directory - nothing was written`, every repo file unchanged, hand edit intact | ✓ PASS |
| Hash-only uncomment is loud (GC-WR-03) | `sed 's/^# tests:/ tests:/'` then `lint` | `error load.yaml-syntax … column 1` | ✓ PASS |
| `"# "` uncomment yields a valid config | `sed 's/^# tests:/tests:/; s/^#   report:/  report:/'` | `0 errors, 1 warnings` (`lint.report-missing`) | ✓ PASS |
| Repointing `report:` clears it | create the file the runner would write | `0 errors, 0 warnings` | ✓ PASS |
| Both examples pass both gates | the `examples` job body, verbatim, + `gate ready` | 6 invocations, all exit 0, accumulator 0 | ✓ PASS |
| Published bytes carry no denied name | probe-verified scan, 15 files from `npm pack --dry-run` | 1 hit, the decided non-breach | ✓ PASS |
| Generated records have no drift | `npm run gen` under a restore fence | zero drift, `templates.ts` and `skills.ts` | ✓ PASS |
| Named tests | `vitest run` over 10 named files, 2 invocations | 72 + 117 = 189 passed | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no plan declares one. **SKIPPED (no project
probes).** The equivalent role is played by the live-probe guards inside the denied scans
(`bin.test.ts:50`, `templates.test.ts:153`, `scaffold.test.ts:406`), by `workflow-script.test.ts`'s
mutation probe, and by this pass's own controls — the tree-snapshot control, the prefix-comparison
negative control, and the scanner control that caught a dead scan before it could report a false clean.
All were run.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CLI-01 | 01, 02, 09, 10, 11, 12, 13, 14 | `init` scaffolds folder, config, templates, skill copies; idempotent; never overwrites edited files; prints what it created | ✓ SATISFIED | Truth 1, measured in both directions against the reworded criterion |
| CLI-02 | 03, 07, 10, 15 | `init` writes a CI workflow that runs `lint` and `gate done` on touched tickets and always reports a job result | ✓ SATISFIED | Truth 2; `workflow-script.test.ts` |
| CLI-03 | 04, 12 | `init` adds a short pointer to `AGENTS.md` and `CLAUDE.md` without duplicating skill bodies | ✓ SATISFIED | Truth 3; 9-line ASCII block, no skill body, byte-exact append |
| INTG-02 | 06, 08, 10, 15 | Example repo with one maintain- and one build-profile ticket passing both gates | ✓ SATISFIED | Truth 4; both gates through the real CLI |
| SKILL-04 | 05, 14 | Every skill begins with a lint or gate call and never restates a rule the CLI enforces | ✓ SATISFIED | `skills.test.ts` + `skill-commands.test.ts` green |

**Orphan check:** `.planning/REQUIREMENTS.md` maps exactly five IDs to Phase 7 — CLI-01, CLI-02, CLI-03,
SKILL-04 (Phase 6 + Phase 7), INTG-02. All five are claimed by at least one plan's `requirements:`
frontmatter. **No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | `TBD`/`FIXME`/`XXX` across every phase-touched source file | — | **None found.** Debt-marker gate passes |
| `packages/core/src/model/snapshot.ts` | 42 | denied name in a line comment | 📋 Advisory | New-scope (mtime 2026-09-14, predates the phase); confirmed absent from all 15 published files |
| `README.md` | — | covered by the CLAUDE.md constraint, read by no scan, and not actually published | 📋 Advisory | Two facts; the second corrects a premise carried by the previous report |
| `test/helpers/denied.ts` | 17 | citation `scaffold/init.ts:48-50` is off by one | 📋 Advisory | Claim true, pointer stale |
| `packages/cli/src/commands/new-ticket.ts` | 16 | the identifier `PLACEHOLDER` | ℹ️ Info | A real constant (`'TICKET-ID'`), not a stub marker |
| `.planning/ROADMAP.md` | 255 | `**Mode:** mvp` on a goal that is not a User Story | ℹ️ Info | Uniform across six phases in this roadmap, never raised by the owner, and unchanged by phase 7. Verified against the four Success Criteria — the roadmap contract — rather than refusing on a format condition this phase did not introduce |

The repo-root `07-15-example-*.log` files noted by the previous pass are gone.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
| --- | --- | --- | --- |
| 1 | `packages/core/src/model/snapshot.ts:42` names a design tool in a line comment | other | New-scope (mtime predates the phase); not in any prior `gaps:`; confirmed NOT a breach — zero hits across all 15 published files. No failing test because nothing is currently wrong |
| 2 | `README.md` is read by no `deniedNames` call site, and neither package actually publishes a README | other | New-scope; both halves reproducible (`grep -rn 'deniedNames('` -> 8 sites, none on README; `npm pack --dry-run` -> 2 and 13 files, no README in either). The second half is a Phase 9 publish item, not a phase 7 gap |
| 3 | `test/helpers/denied.ts:17` cites `scaffold/init.ts:48-50`; the lines are 49-51 | other | New-scope (introduced today by the ruling's edit); claim true, citation stale; one-line fix |

None of the three blocks the phase goal. None reverts a completed must-have.

### Human Verification Required

#### 1. Run the CI on a real runner — the single carried item

**Test:** commit and push the branch; let `.github/workflows/ci.yml` run, including the `examples` job.

**Expected:** the `check` matrix (ubuntu-latest + windows-latest x Node 22 + 24) and the `examples` job
both green; `examples` prints `== build` and `== maintain` and exits 0.

**Why human:** nothing in phases 6 or 7 is committed — 55 files sit in the working tree and HEAD is
`53e9df9`, which predates both phases — so no job has ever run on a runner. Every behavioural claim in
this report is Windows-observed. The `examples` job body was executed verbatim this pass under Git Bash
on Windows and both examples passed cleanly, which is strong; but `sed -i`, `mktemp -d` and `cp -R` are
precisely where a Windows shim can differ from GNU coreutils, and Git Bash is not ubuntu.

This is a **prerequisite gate, not a code defect.** It is not closable by a `--gaps` cycle: it resolves
the moment the phase is committed and pushed, and not before. *(Carried from the 2026-09-18T11:40Z
report; recorded as `07-UAT.md` test 2, `result: blocked`.)*

### Gaps Summary

**No gaps. No regressions. 5/5 must-haves verified.**

Both items that held the previous report at 4/5 and `human_needed` are closed by owner rulings made
today, and both rulings were checked for coherence against the code rather than taken on their face:

- **DENIED-CONTRADICTION** — settled as reading A, and the resulting seven-entry list was verified to
  still hold on the real published surface. The ruling's premise is not merely plausible, it is
  measured: `Codex`, `Cursor` and `Copilot` genuinely appear in `packages/core/dist/index.js`,
  `dist/index.d.ts` and `schemas/config.schema.json` — all shipped files — so a one-word ban would have
  failed the scan on accord's own output. The rewritten docstring states that rule, and it is true; only
  one line citation inside it drifted by one.
- **Criterion 1's wording** — reworded to "human-authored", and the criterion re-verified against the
  new wording on a single run that planted edits on both sides of the line: two human documents
  preserved and reported `skipped`, one skill copy overwritten and reported `overwrote local edits`.

Everything the earlier passes closed was regression-checked and still holds: the latin1 pointer pair,
the clean CLI bundle, the partial-report-survives-a-throw array, the write-nothing refusal, the
two-halves `tests:` instruction, and the anchored A-33 assertion.

**What stops this being `passed` is one thing, and it is not a code defect.** Nothing in phases 6 or 7
is committed, so no CI runner has ever executed — not the `check` matrix, not the `examples` job, not on
ubuntu. Every behavioural claim in this report was produced on Windows, by running the built binary. The
phase goal itself is achieved and demonstrated: a team runs one command in an empty repository and
receives the folder, the pinned config, the product documents, skill copies in both runtime paths, the
agent pointers and CI — measured by running it — and the example repo's two profiles both pass both
gates, measured by running them through the same job body CI will run.

---

_Verified: 2026-09-19T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
