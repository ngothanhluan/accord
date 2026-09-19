---
phase: 06-skills
verified: 2026-09-17T04:50:23Z
status: passed
score: 7/7 roadmap success criteria verified (criterion 3 accepted by override — one clause owner-deferred to Phase 7)
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/WINDOWS.md"
  - ".planning/phases/06-skills/06-01-PLAN.md"
  - ".planning/phases/06-skills/06-01-SUMMARY.md"
  - ".planning/phases/06-skills/06-02-PLAN.md"
  - ".planning/phases/06-skills/06-02-SUMMARY.md"
  - ".planning/phases/06-skills/06-03-PLAN.md"
  - ".planning/phases/06-skills/06-03-SUMMARY.md"
  - ".planning/phases/06-skills/06-04-PLAN.md"
  - ".planning/phases/06-skills/06-04-SUMMARY.md"
  - ".planning/phases/06-skills/06-05-PLAN.md"
  - ".planning/phases/06-skills/06-05-SUMMARY.md"
  - ".planning/phases/06-skills/06-06-PLAN.md"
  - ".planning/phases/06-skills/06-06-SUMMARY.md"
  - ".planning/phases/06-skills/06-07-PLAN.md"
  - ".planning/phases/06-skills/06-07-SUMMARY.md"
  - ".planning/phases/06-skills/06-08-PLAN.md"
  - ".planning/phases/06-skills/06-08-SUMMARY.md"
  - "accord/config.yml"
  - "packages/cli/src/commands/skills.ts"
  - "packages/cli/src/run.ts"
  - "packages/cli/test/skill-commands.test.ts"
  - "packages/cli/test/skills-sync.test.ts"
  - "packages/cli/test/spawn-surface.test.ts"
  - "packages/core/scripts/gen-skills.mjs"
  - "packages/core/skills/ba/SKILL.md"
  - "packages/core/skills/ba/ready.md"
  - "packages/core/skills/ba/setup.md"
  - "packages/core/skills/ba/story.md"
  - "packages/core/skills/designer/SKILL.md"
  - "packages/core/skills/dev/SKILL.md"
  - "packages/core/skills/dev/code-review.md"
  - "packages/core/skills/dev/debug.md"
  - "packages/core/skills/dev/review.md"
  - "packages/core/skills/shared/prototype.md"
  - "packages/core/src/generated/skills.ts"
  - "packages/core/src/index.ts"
  - "packages/core/src/skills/render.ts"
  - "packages/core/src/skills/targets.ts"
  - "packages/core/templates/business-rules.md"
  - "packages/core/test/gate.test.ts"
  - "packages/core/test/skills.test.ts"
  - "packages/core/test/templates.test.ts"
covered_digest: "v1:sha256:6d95329d4c54da32478791d9c1af1fc4f10d11cf3bc06183c4adfeba5d1a65a2"
covered_digest_note: "Re-pinned 2026-09-17 AFTER `phase.complete` ran. The verifier's own digest over its 28 declared files was v1:sha256:cec6b691... and still reproduced exactly at close time, so nothing it measured had drifted. Two corrections followed: the 16 phase PLAN/SUMMARY artifacts were added to `covered_files` (the verifier opted into the #4155 fingerprint but declared none of them, so `allCurrentArtifactsCovered` could never pass), giving v1:sha256:d6fd8719...; then `phase.complete` rewrote `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`, which are themselves covered inputs, giving the digest above. That last delta is the phase-close bookkeeping, not unverified work — the ROADMAP text this digest covers is one checkbox and one plan-count newer than the text the verifier read."
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "ROADMAP criterion 3, second clause — none of the rendered skills restates a rule the CLI enforces (SKILL-04)"
    reason: "Verdict upheld 2026-09-16; the prose fix is scheduled for Phase 7 and tracked as WINDOWS.md entry 6. SKILL-04 stays unticked in REQUIREMENTS.md."
    accepted_by: "ngothanhluan"
    accepted_at: "2026-09-17T00:00:00Z"
re_verification:
  previous_status: gaps_found
  previous_score: "6/7 (criterion 3 partial), with gaps G-1, G-2, G-3 open"
  gaps_closed:
    - "G-1 / NF-01 — the orphan scan no longer follows a link out of the repository. `scannable()` (skills.ts:70-77) walks every component with `lstat` before `readdirSync` opens it. Reproduced closed in this verification by a hand-built sandbox, not only by the suite."
    - "G-2 / NF-03 — `review.md` step 2 now shows the column-0 shape `parseVerification` anchors on. Verified behaviourally: the fenced block, extracted from the RENDERED brief and run through the real `loadSnapshot`, yields `result: 'pass'` and non-empty evidence; the shape it replaced yields no result at all."
    - "G-3 / NF-04 — the three sentences claiming what `accord lint` checks are gone from `prototype.md`. Read in full and grepped: `accord lint` now appears once, in the step 4 heading, and states nothing about what the command covers."
  gaps_remaining:
    - "ROADMAP criterion 3, second clause — three sentences in the BA skill restate a rule the CLI enforces; SKILL-04 stays open. Owner-upheld 2026-09-16 and deferred to Phase 7 (06-06-SUMMARY CF-1, WINDOWS.md entry 6). No Phase 6 action is owed."
  corrections:
    - "The previous report's G-2 claimed `accord gate done` 'passes with the reviewer's work silently dropped' and authorised an edit to `packages/core/src/gate/done.ts`. THAT CLAIM WAS WRONG. Re-verified here in source: `evidenceUnresolved` (gate/refs.ts:146) is registered in `DONE_RULES` at level `error` on both `build` and `maintain` (rules.ts:81) and is absent from `MAINTAIN_DOWNGRADE` (rules.ts:101), so an empty evidence block fails Done on both profiles. The authorised edit was deliberately NOT made; `git status --porcelain packages/core/src/gate` is empty. The defect G-2 named was loud, not silent."
  regressions: []
gaps:
  - truth: "ROADMAP criterion 3, second clause — none of the rendered skills restates a rule the CLI enforces (SKILL-04)"
    status: overridden
    reason: "OWNER-DEFERRED, NOT UNHANDLED. 06-06 read all eleven rendered files against the Ready/Done tables and the lint RULES table and found three sentences that name a gate command and then enumerate what it blocks on. The owner upheld the verdict on 2026-09-16, left SKILL-04 open and unticked in both REQUIREMENTS.md places, and deferred the prose fix to Phase 7. Re-confirmed on disk in this verification, byte-unchanged by 06-07 and 06-08: ba/SKILL.md:23-27 enumerates the three Ready blockers; ba/story.md:57-61 reproduces a Ready row; ba/story.md section 6 (lines 62-66) names lint.vague-wording's subject and level. The deferral is recorded in 06-06-SUMMARY.md CF-1 and .planning/WINDOWS.md entry 6, status open, so it survives the phase close."
    artifacts:
      - path: "packages/core/skills/ba/SKILL.md"
        issue: "Step 3 lists the three conditions that hold a ticket short of Ready instead of letting `accord gate ready` print them"
      - path: "packages/core/skills/ba/story.md"
        issue: "Section 4 reproduces a Ready row; section 6 reproduces lint.vague-wording's subject and level"
    missing:
      - "Rewrite the three sentences to name the command and stop — scheduled for Phase 7 by owner decision; no action required in Phase 6"
flagged_prohibitions:
  - statement: "accord must not print a removal command aimed at a path outside the repository it was run in (06-07 must_haves prohibition 2)"
    verification: judgment
    status: unverified
    flagged: true
    disposition: "Holds against the vector 06-07 closed — verified by sandbox run. Does NOT hold against a second vector the review found afterwards (P3-01): `entry.name` is interpolated into the advisory unescaped, and on POSIX a directory name may contain a newline, so a planted `accord-x\\norphan / - ... rm -rf $HOME` forges a second advisory line. Not reproducible on this host — Windows forbids control characters in filenames — and not reproduced by the reviewer either. Judgment-tier: human review recommended."
advisory:
  - finding: "P3-01 — the orphan advisory interpolates an unsanitised directory name into an `rm -rf`, twice (skills.ts:153). On POSIX a newline in a planted `accord-*` name forges an advisory line."
    category: security
    reason: "New scope, raised by review pass 3 on gap-closure code. Not reproducible on Windows and not reproduced by the reviewer. It is the second half of NF-02: 06-07 deliberately and correctly resolved the non-ASCII half (a name must print verbatim to be removable) and the D-51 narrowing now strips `accord-*` entry names before scanning, which exempts control characters as a side effect. Escaping only C0/DEL/backslash at the two interpolation sites keeps the NF-02 case green. Compounds with WR-01 (`rm -rf` printed on Windows), still open."
    evidence_status: "none provided — derived from source, unreproducible on this platform"
  - finding: "P3-02 — `orphans()` runs before `ctx.stdout.write` (skills.ts:147-149), so an EACCES/EMFILE throw from `readdirSync` discards the whole sync report and returns exit 2 on a run that wrote every file successfully."
    category: architectural
    reason: "New scope, derived from call order, not reproduced (no ACL was manufactured on this host). Widened reach came from 06-05 scanning directories accord does not own; 06-07 carried the link guard across that boundary but not the failure boundary. One line moves to fix."
    evidence_status: "none provided"
  - finding: "P3-03 — `BULLETED_LABEL` (skills.test.ts:319) forbids a list marker but not indentation, and no test runs the brief's fenced block through `parseVerification`."
    category: other
    reason: "The BEHAVIOUR is verified: this report extracted the block from the rendered brief and parsed it through the real loader — `result: 'pass'`, evidence non-empty. What is missing is the guard that would keep it true. `parseVerification` strips nothing, so a four-space-indented block would pass both new invariants and still teach an unparseable shape. The brief itself promises both halves (review.md:38-39); only one is asserted."
    evidence_status: "measured — behaviour confirmed, guard coverage confirmed incomplete"
  - finding: "P3-04 — the copyable block in review.md:33 pre-fills `Result: pass` beside a placeholder `Evidence:`, so the failure the workflow exists to prevent is the one field with a working default. OWNER DECISION REQUESTED."
    category: other
    reason: "A reviewer that copies the block per `@ac-n`, fills each Evidence with something real, and leaves `pass` standing on a scenario it could not exercise produces a verification nothing downstream can distinguish from a checked one. `templates/verification.md:12-13` ships `Result: pass` too, but carries `<!-- pass | fail | blocked -->` inside the copied text; the brief moved the equivalent rule below the block. `Result: <pass | fail | blocked>` fails loudly (load.result-invalid at error) if left unfilled, and keeps both new invariants green. This is a prose/business-judgment call the owner owns, not a defect the verifier should close."
    evidence_status: "read in source; both artifacts compared"
  - finding: "06-08 F-3 — `## 4. Run `accord lint` and fix what it reports` is the closest thing left in prototype.md to a coverage claim."
    category: other
    reason: "Independently read here. The heading names the command and instructs; it does not say which prototypes are read, which fields are checked, or what is reported. It does not breach criterion 3's second clause on my reading. The executor flagged it for the owner rather than trimming it; recorded so the call stays visible."
    evidence_status: "measured"
  - finding: "WR-01, WR-03, WR-05, NF-05, NF-06, IN-01..IN-04, CF-3, P3-05, P3-06 remain open in 06-REVIEW.md."
    category: other
    reason: "Re-judged against the criteria this run. None defeats a numbered success criterion. WR-01 (`rm -rf` printed on Windows) is the delivery mechanism for P3-01 and should be weighed with it. WR-03 (a file dropped from `loads:` is never reported stale) is outside the 06-03 must-have, which speaks of `accord-*` directories. WR-05 (spawn allowlist omits exec/execSync/fork) belongs to CLI-07. P3-06 (prototype.md steps 3-5 address the designer, but dev/SKILL.md routes a dev there on an already-Ready ticket) is pre-existing and worth one sentence in Phase 7."
    evidence_status: "none provided"
  - finding: "`accord/config.yml` declares `roles: [ba, dev]` and `runtimes: [claude]`, so this repository renders neither `accord-designer` nor anything under `.agents/skills/`."
    category: architectural
    reason: "A dogfooding choice, not a shortfall. Criterion 1's three-role render and criterion 2's `.agents/` half are both covered by passing tests and, for `.agents/`, by the sandbox runs in this report. Carried unchanged."
    evidence_status: "measured"
  - finding: "Phase mode is `mvp` but the Phase 6 goal is a capability statement, not a User Story."
    category: other
    reason: "`As a …, I want to …, so that …` does not match, so the MVP User Flow Coverage table cannot be produced. Verified against the seven numbered ROADMAP success criteria instead — they are the roadmap contract and are required regardless of mode. Carried unchanged."
    evidence_status: "n/a"
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification:
  - test: "Run `npx vitest run --project cli packages/cli/test/skills-sync.test.ts` on Linux or macOS."
    expected: "All 25 cases pass — in particular `reads nothing through a link at an undeclared target directory, and still exits 0` and `narrows the scan by the linked directory and nothing else`. On POSIX, `symlinkSync(target, path, 'junction')` creates a plain symlink rather than a junction."
    why_human: "Every run of 06-07 and of this verification was on Windows, and nothing is committed, so CI has never run either leg. `lstatSync().isDirectory()` is expected — not observed — to be false for a POSIX symlink and a Windows junction alike, which is the single fact one code path covering both legs rests on. Logged as WINDOWS.md entry 7 (`unrun-verify`, `human_judgment: true`), recorded as 06-07 F-1."
  - test: "On POSIX, in a sandbox repo with `runtimes: [claude]`, create a directory under `.agents/skills/` whose name is the literal text `accord-x`, a newline, then `orphan / - no longer declared; accord never deletes - remove it with: rm -rf $HOME`. Run `accord skills sync` and count the non-empty lines on stderr."
    expected: "Decide whether one forged advisory line is acceptable output. If not, escape C0/DEL/backslash at the two interpolations on skills.ts:153 only, leaving the value pushed into `found` raw so the `accord-café` case (skills-sync.test.ts:129) stays green."
    why_human: "Windows forbids control characters in filenames, so this cannot be reproduced on the author's platform, and the reviewer did not reproduce it either. It is also a judgment call about how far accord should sanitise a name it must print verbatim to remain useful — the two requirements pull against each other. This is the flagged judgment-tier prohibition above."
---

# Phase 6: Skills Verification Report

**Phase Goal:** Each role has one workflow definition complete enough to replace a general planning system, plus the shared techniques those workflows load, rendered to SKILL.md files that Claude Code, Cursor, Copilot, and Codex all read and kept in sync with a generated marker and hash.
**Verified:** 2026-09-17T04:50:23Z
**Status:** gaps_found — one gap, owner-deferred to Phase 7
**Re-verification:** Yes — supersedes the 2026-09-16T06:13:16Z report, after gap-closure plans 06-07 and 06-08. Covers all eight plans, not only this round.

**Nothing in this phase is committed.** `git rev-parse --short HEAD` is `53e9df9`; every artifact below sits in the working tree by the owner's standing rule. No check in this report reads git history — all of them read files on disk, run code, or run tests.

**Read this first.** Of the four gaps the previous round raised, three are closed and confirmed closed by measurement in this report rather than by the summaries' word. The fourth (G-0 / SKILL-04) is the one the owner has already adjudicated and deferred to Phase 7; it is the sole reason the status is `gaps_found`, and **no Phase 6 work is owed for it**. One claim the previous report made was itself wrong and is corrected below.

## Correction to the previous report

The 2026-09-16 report's G-2 stated that `accord gate done` "passes with the reviewer's work silently dropped" when an evidence block is empty, and on that basis authorised an edit to `packages/core/src/gate/done.ts`. **That was wrong.** Verified independently here, in source:

- `evidenceUnresolved` — `packages/core/src/gate/refs.ts:146` — filters every block whose evidence `cites()` nothing. Its own doc comment says "An empty block cites nothing and fails the same way."
- It is registered at `packages/core/src/gate/rules.ts:81` as `{ id: 'gate.evidence-unresolved', level: 'error', profiles: ['build', 'maintain'] }`.
- It does not appear in `MAINTAIN_DOWNGRADE` (`rules.ts:101`), so `maintain` does not soften it to a warning.

An empty evidence block therefore fails Done on both profiles. The Done rule table is assembled in `rules.ts` from checks spread across several files, so reading `gate/done.ts` alone was never reading the behaviour. **The authorised edit was deliberately not made** — `git status --porcelain packages/core/src/gate` returns nothing, and `packages/core/src/load/verification.ts` is likewise untouched. 06-08 pinned the behaviour with two `gate.test.ts` cases instead of repairing code that was already correct. That is the right disposition, and it is recorded here so the false claim does not survive in the phase record.

## Goal Achievement

### Observable Truths — the seven ROADMAP success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Three definitions (`ba`, `dev` with `review.md`, `designer`) render to `SKILL.md` whose frontmatter contains only the six spec fields | ✓ TRUE | `packages/core/skills/{ba,dev,designer}/SKILL.md` carry `kind: role`; `render.ts` allowlists exactly `name, description, license, compatibility, metadata, allowed-tools` and drops `kind`/`loads`. Confirmed on a rendered artifact in my own sandbox: `accord-dev/SKILL.md` frontmatter is `name`, `description`, `license` and nothing else, followed by the `fnv1a64:` marker. Tests green in my process (skills.test.ts:54, :197, :203, :499) |
| 2 | `skills sync` writes each rendered skill to `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/` with a generated marker and content hash; a second run is a no-op | ✓ TRUE | `DIRS` in `targets.ts` maps claude→`.claude/skills`, codex→`.agents/skills`, cursor/copilot→both. Sandbox run 1: 9 `created`, exit 0. Sandbox run 2, no edits: 9 `unchanged`, exit 0 — the no-op is observed, not inferred. The write-call-level no-op is pinned at skills-sync.test.ts:76; the `.agents/` leg at :54 and :308 and by the junction sandbox below |
| 3 | Every rendered skill begins with a lint or gate command; **none restates a rule the CLI enforces**; a test fails if a skill names a CLI command that does not exist | ✓ PASSED (override) — clauses 1 and 3 TRUE; clause 2 accepted by override | Clause 1: every role's first step is `Run \`accord gate ready <id>\`` (skills.test.ts:214). Clause 3: skill-commands.test.ts reads the real commander tree and fails on any unregistered command, guarded against vacuity. **Clause 2 FAILS** — gap G-0, owner-upheld and deferred; SKILL-04 stays open |
| 4 | BA keeps the ticket `draft` and stops while open questions, unconfirmed assumptions, or TODO markers remain; the dev review step runs in a fresh context and writes only `verification.md`; only the developer writes `verified` | ✓ TRUE | ba/SKILL.md:23-27 names all three blockers and holds `status: draft` (skills.test.ts:460). review.md:7 opens "You are a fresh context"; :63 "The only file you write is the one named in step 2" (skills.test.ts:398, :406 — exactly one `accord/`-rooted path across both briefs, and it is verification.md). dev/SKILL.md "You tick `verified:` and nobody else does"; skills.test.ts:374 asserts exactly one rendered file tells its reader to write it |
| 5 | Two techniques render alongside the roles and are **loaded by** them, not invoked as roles; the definitions live in `packages/core/skills/` | ✓ TRUE | `dev/SKILL.md` frontmatter `loads: [dev/debug.md, dev/review.md, dev/code-review.md, shared/prototype.md]`; review.md:49 loads `./code-review.md` and appends `## Review` to the same file. `renderSkill` emits no frontmatter for a non-role, which is what keeps a reference undiscoverable as a skill. All ten definitions live under `packages/core/skills/`; `docs/skills/` is deleted |
| 6 | The workflows carry the work a general planning system would, and no session or handoff file exists anywhere | ✓ TRUE | ba/SKILL.md branches on `config.profile` at its first step after the gate; dev/SKILL.md step 3 writes `## Plan` and later steps implement; review.md is the code-review context; `accord status` plus the ticket is the resume answer (skills.test.ts:469). The no-session-file assertion runs over the render output with a matcher proven able to go red (skills.test.ts:527-540) |
| 7 | The dev skill reviews `## Plan` against intent and AC in a fresh context, reading no code and editing only `## Plan`, and a wrong-layer/wrong-order fixture comes back changed | ✓ TRUE | Structural half in CI (skills.test.ts:347, :355). Behavioural half performed in 06-06 Task 1 in a headless session with all file and search tools disallowed; the fixture came back re-sliced into vertical slices with per-`@ac-n` tags, and the **owner ruled PASS**, noting that the plan's two PASS clauses are mutually exclusive as written — a wording defect in the plan, not a shortfall in the behaviour. Fixture unchanged by 06-07/06-08 |

**Score:** 6/7 criteria verified. Criterion 3 is partial: clauses 1 and 3 hold, clause 2 fails (G-0, owner-deferred).

### Gap closure — what this round actually changed

| Gap | Raised by | Status now | How I verified it, not how the summary describes it |
|-----|-----------|-----------|------------------------------------------------------|
| G-1 / NF-01 — the orphan scan followed a link out of the repository | prior verification, reproduced there by hand | ✓ CLOSED | Built my own sandbox: `mkdtemp` repo, `runtimes: [claude]`, a **real junction** at `.agents/skills` (created with PowerShell `New-Item -ItemType Junction`, confirmed resolving — `ls` through it shows `accord-victim/`) pointing at a second `mkdtemp` outside the repo. `accord skills sync` → exit 0, 9 `created` on stdout, **stderr empty**. Control in the same sandbox: a real in-repo `.claude/skills/accord-designer` under a declared directory IS still named on stderr, so the guard narrows by exactly the linked directory rather than switching the scan off. The outside directory was byte-unchanged and was removed by me afterwards |
| G-2 / NF-03 — `review.md` step 2 taught a shape the parser rejects | prior verification | ✓ CLOSED | Extracted the fenced block out of the **rendered** brief (via `renderSkill` on the generated module) and ran it through the real `loadSnapshot`: `{"acTag":"ac-1","result":"pass","evidence":"<what you ran or inspected, and what you saw>"}` — a valid `result` and non-empty evidence. Ran the shape it replaced through the same path for contrast: `{"acTag":"ac-1","evidence":""}` — no `result` key at all, so `load.result-invalid`, and evidence dropped. The fix is load-bearing |
| G-3 / NF-04 — `prototype.md` promised lint coverage the rule table does not provide | prior verification | ✓ CLOSED | Read all 53 authored lines and grepped the rendered copy. `accord lint` survives once, in the step 4 heading `## 4. Run \`accord lint\` and fix what it reports`, which instructs without stating what the command covers. The three sentences (step 2's coverage claim, step 4's scope claim and exit condition) are gone. See the advisory on 06-08 F-3 for the residue the executor flagged |
| G-0 / SKILL-04 — three sentences restate a rule the CLI enforces | 06-06 manual read, owner-upheld | ✓ PASSED (override) — open by design | Re-read on disk: ba/SKILL.md:23-27, ba/story.md:57-61, ba/story.md §6. All three present and byte-unchanged. WINDOWS.md entry 6 is `open` and names all three. SKILL-04 is `[ ]` / Pending in both REQUIREMENTS.md places — the accurate state |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SKILL-01 | One definition per role: `ba`, `dev` (+`review.md`), `designer` | ✓ SATISFIED | Three `kind: role` definitions; skills.test.ts:440, :499. `[x]` / Complete |
| SKILL-02 | Renderer produces `SKILL.md` with only the six spec fields | ✓ SATISFIED | `render.ts` allowlist; verified on a rendered artifact in sandbox. `[x]` / Complete |
| SKILL-03 | Copies land in `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/` | ✓ SATISFIED | `DIRS` table; skills-sync.test.ts:54, :308. `[x]` / Complete |
| SKILL-04 | Every skill begins with a lint or gate call and never restates a rule the CLI enforces | ✗ BLOCKED (first half satisfied) | Opens-on-the-gate proven (skills.test.ts:214). The never-restates half failed its 06-06 manual read; owner upheld and deferred to Phase 7. Correctly `[ ]` / Pending — the accurate state, not a tracking error |
| SKILL-05 | BA interviews until no open questions remain; marks the ticket `draft` until then | ✓ SATISFIED | ba/SKILL.md:23-27; skills.test.ts:460, :476, :487. `[x]` / Complete |
| SKILL-06 | The dev workflow's final step runs the review in a fresh context that writes only `verification.md` | ✓ SATISFIED | review.md steps 1-5; skills.test.ts:363, :398, :406. Strengthened by 06-08: the brief now teaches a shape the parser accepts, verified end to end here. `[x]` / Complete |
| SKILL-07 | Only the developer writes `verified` | ✓ SATISFIED | dev/SKILL.md; skills.test.ts:374. `[x]` / Complete |
| SKILL-08 | A test asserts every CLI command named in a skill exists | ✓ SATISFIED | skill-commands.test.ts over the commander registry, guarded against vacuity. `[x]` / Complete |
| SKILL-09 | Two techniques render alongside the roles and are loaded by them; definitions live in `packages/core/skills/` | ✓ SATISFIED | `debug.md` and `code-review.md` under `dev/`, pulled by `loads:`. REQUIREMENTS.md:79 ends `packages/core/skills/`. `[x]` / Complete |
| SKILL-12 | The dev workflow reviews `## Plan` in a fresh context that reads no code and edits only `## Plan` | ✓ SATISFIED | skills.test.ts:347, :355 plus the 06-06 fresh-context run. `[x]` / Complete |
| CLI-08 | `skills sync` regenerates skill copies with a generated marker and content hash | ✓ SATISFIED | 25 passing cases in skills-sync.test.ts, including the two link cases 06-07 added; two sandbox runs of my own. REQUIREMENTS.md:67 `[x]`, :186 Complete |

All 11 phase requirement IDs are accounted for. No orphaned requirements: REQUIREMENTS.md maps exactly SKILL-01..09, SKILL-12 and CLI-08 to Phase 6, and every one is claimed by a plan. SKILL-10 and SKILL-11 sit under Deferred and are not Phase 6 scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/skills/**` (10 files) | The authored definitions | ✓ VERIFIED | 3 roles + 6 dev/ba references + `shared/prototype.md`; drift test ties them to the generated module |
| `packages/core/src/skills/render.ts` | Six-field frontmatter, marker, FNV-1a hash | ✓ VERIFIED | Substantive, imported by `targets.ts`, re-exported from `index.ts` |
| `packages/core/src/skills/targets.ts` | `skillDirs`, `allSkillDirs`, `skillTargets` | ✓ VERIFIED | `allSkillDirs()` takes no argument and reads the `DIRS` literal only — the 06-05 widening removes a config input from path composition rather than adding one (T-06-01 holds) |
| `packages/core/src/generated/skills.ts` | Committed codegen output | ✓ VERIFIED | Regenerated by 06-08; drift test green; the `dev/review.md` entry carries the new column-0 block verbatim |
| `packages/cli/src/commands/skills.ts` | The filesystem and the report | ✓ VERIFIED | Registered in `run.ts`, four D-112 states covered, `scannable()` now guards the scan set. Two advisories attach to it (P3-01, P3-02) — neither defeats a criterion |
| `packages/core/skills/dev/review.md` | Step 2 followable AND parseable from the brief alone | ✓ VERIFIED | Was ⚠️ PARTIAL. Now shows the column-0 shape; parsed end to end through `loadSnapshot` in this report |
| `packages/core/skills/shared/prototype.md` | Step 2 followable from the brief alone, claiming nothing the CLI does not do | ✓ VERIFIED | Was ⚠️ PARTIAL. Three sentences deleted; full read confirms no coverage claim survives |
| `.claude/skills/accord-*/**` (9 files) | The repository's own synced copies | ✓ VERIFIED | Compared byte-for-byte against `skillTargets(config)` without writing: **9 in sync, 0 differing, 0 missing.** No stale artifact in the working tree |
| `packages/core/test/fixtures/wrong-plan/` | Wrong-layer, wrong-order fixture | ✓ VERIFIED | Unchanged by 06-07/06-08 |
| `.planning/REQUIREMENTS.md` | Records what shipped | ✓ VERIFIED | CLI-08 ticked; SKILL-09 repointed; SKILL-04 open as ruled |
| `.planning/WINDOWS.md` | The deferrals and unrun legs survive the phase close | ✓ VERIFIED | 7 entries, all `open`. Entry 4 (the ASCII assertion's home), entry 6 (SKILL-04 deferral), entry 7 (the unrun POSIX leg, added by 06-07) are all present in both the table and the JSON block |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `packages/core/skills/**` | `packages/core/src/generated/skills.ts` | `npm run gen` / `gen-skills.mjs` | ✓ WIRED — drift test green after 06-08's regeneration |
| `generated/skills.ts` | `renderSkill` / `skillTargets` | direct import | ✓ WIRED |
| `skillTargets(config)` | `skillDirs(config)` | the **write** set, unchanged since 06-05 | ✓ WIRED |
| `orphans()` | `allSkillDirs()` → `scannable()` | the **scan** set, now guarded | ✓ WIRED — `scannable`'s last iteration evaluates the same `join(root, ...parts)` that `readdirSync` is handed at :47, so the guard cannot validate one path while the scan opens another |
| `skills sync` | `.claude/skills/accord-*/`, `.agents/skills/accord-*/` | `writeFileSync` after `assertNoLink` over every target | ✓ WIRED — the pre-pass is still the first thing `skills()` does with `targets` (:118) |
| `review.md` step 2's fenced block | `parseVerification` | a reader copying it into `verification.md` | ✓ WIRED — traced end to end through `loadSnapshot` in this report; this link did not exist before 06-08 |
| `run.ts` | `skills(ctx)` | commander subcommand, behind the pin preflight | ✓ WIRED — pin refusal proven at skills-sync.test.ts:257 |
| `dev/SKILL.md` | `./debug.md`, `./review.md`, `./code-review.md`, `./prototype.md` | `loads:` → basename beside the role | ✓ WIRED |

### Behavioural Spot-Checks

All run in my own process; none inherited from a summary.

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| The whole workspace suite | `npm test` | 32 files, **794 tests passed**, exit 0 | ✓ PASS |
| Lint | `npm run lint` | eslint silent, exit 0 | ✓ PASS |
| Types | `npm run typecheck` | tsc silent over core, core tests, cli, exit 0 | ✓ PASS |
| The phase's core suites | `npx vitest run --project core packages/core/test/skills.test.ts packages/core/test/gate.test.ts` | 162 passed | ✓ PASS |
| The phase's CLI suites | `npx vitest run --project cli packages/cli/test/skills-sync.test.ts packages/cli/test/skill-commands.test.ts` | 33 passed | ✓ PASS |
| The orphan scan respects the repository boundary (G-1) | sandbox repo + real junction at `.agents/skills` → outside dir holding `accord-victim/`; `node packages/cli/dist/cli.js skills sync` | exit 0; 9 `created`; **stderr empty**; outside dir byte-unchanged | ✓ PASS |
| The guard did not simply switch the scan off (G-1 control) | same sandbox, a real in-repo `.claude/skills/accord-designer` under a declared dir | `orphan .claude/skills/accord-designer - … rm -rf .claude/skills/accord-designer` on stderr, exit 0 | ✓ PASS |
| A second `skills sync` is a no-op | same sandbox, second run, no edits | 9 × `unchanged`, exit 0 | ✓ PASS |
| The shape review.md shows is the shape the parser accepts (G-2) | fenced block extracted from the rendered brief → `loadSnapshot` | `result: "pass"`, evidence non-empty, no `load.result-invalid` | ✓ PASS |
| The shape it replaced is the one the parser rejects (G-2 contrast) | the old bulleted lines → `loadSnapshot` | no `result` key, `evidence: ""` | ✓ PASS (fix is load-bearing) |
| `gate done` fails an empty evidence block | read `gate/refs.ts:146`, `gate/rules.ts:81`, `rules.ts:101` | `error` on both profiles, absent from `MAINTAIN_DOWNGRADE` | ✓ PASS (previous report's claim corrected) |
| `gate/done.ts` and `load/verification.ts` were not edited | `git status --porcelain` on both | empty | ✓ PASS |
| The repository's own synced copies match the render | compared `skillTargets(config)` against disk, read-only | 9 in sync, 0 differ, 0 missing | ✓ PASS |

### Probe Execution

No probe scripts are declared by any Phase 6 plan and no `scripts/*/tests/probe-*.sh` exists in the repository. Step 7c: SKIPPED (no probes in this project).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` | none | Scan over every file this phase created or modified returns nothing |
| `packages/core/skills/ba/SKILL.md` | 26 | the word `TODO` | ℹ️ Info | Prose naming the TODO-sentinel lint rule, not a debt marker. It sits inside the G-0 sentence and will be rewritten in Phase 7 anyway |

### Human Verification Required

**1. The POSIX leg of the 06-07 link guard (WINDOWS.md entry 7, 06-07 F-1)**

- **Test:** `npx vitest run --project cli packages/cli/test/skills-sync.test.ts` on Linux or macOS.
- **Expected:** 25 passed, in particular `reads nothing through a link at an undeclared target directory, and still exits 0` and `narrows the scan by the linked directory and nothing else`. On POSIX, `symlinkSync(target, path, 'junction')` creates a plain symlink rather than a junction.
- **Why human:** Every run of 06-07 and of this verification was on Windows, and nothing is committed, so CI has never run either leg. One code path covers both platforms only because `lstatSync().isDirectory()` is false for a POSIX symlink and a Windows junction alike — expected, not observed.

**2. The forged-advisory prohibition (P3-01) — judgment call**

- **Test:** On POSIX, plant an `accord-*` directory whose name contains a newline followed by text shaped like accord's own advisory, then run `accord skills sync` and count the non-empty stderr lines.
- **Expected:** Owner decides whether one forged `rm -rf` line is acceptable. If not, escape C0/DEL/backslash at the two interpolations on `skills.ts:153` only, leaving the value pushed into `found` raw so the `accord-café` case stays green.
- **Why human:** Windows forbids control characters in filenames, so it cannot be reproduced here, and the reviewer did not reproduce it either. It is also a genuine tension: the name must print verbatim to be useful (06-07's NF-02 decision, correctly made) and must not print verbatim to be safe.

Nothing else was routed here. The two behavioural items the earlier reports carried were performed in 06-06 and ruled on by the owner; everything in this round that could be checked mechanically was checked mechanically, including the two items the review flagged as coverage gaps.

### Gaps Summary

**One gap, and it is the one the owner has already ruled on.**

G-0 (criterion 3, second clause / SKILL-04) is the only finding that defeats a numbered success criterion. Three sentences in `ba/SKILL.md` and `ba/story.md` name a gate command and then enumerate what it blocks on. The verdict came from the eleven-file read 06-06 was written to perform; the owner upheld it on 2026-09-16, left SKILL-04 unticked, and scheduled the prose fix for Phase 7. It is logged twice — 06-06-SUMMARY CF-1 and WINDOWS.md entry 6, status `open`. **No Phase 6 action is required or recommended.**

If you want the phase to read `passed` rather than `gaps_found` without touching the prose, the deferral can be made formal by adding to this file's frontmatter:

```yaml
overrides:
  - must_have: "ROADMAP criterion 3, second clause — none of the rendered skills restates a rule the CLI enforces (SKILL-04)"
    reason: "Verdict upheld 2026-09-16; the prose fix is scheduled for Phase 7 and tracked as WINDOWS.md entry 6. SKILL-04 stays unticked in REQUIREMENTS.md."
    accepted_by: "ngothanhluan"
    accepted_at: "2026-09-17T00:00:00Z"
```

**Applied 2026-09-17 by the owner.** That block is now in this file's frontmatter, `overrides_applied: 1`, and the status reads `passed`. The codebase is byte-unchanged by the override: the three sentences are still there, SKILL-04 is still `[ ]` in both REQUIREMENTS.md places, and WINDOWS.md entry 6 is still `open`. What changed is the label on the deferral, not the code.

**The previous round's residue is gone.** G-1, G-2 and G-3 are all closed and all three were confirmed by measurement here rather than by reading a summary: a hand-built junction sandbox for G-1, an end-to-end parse of the rendered brief for G-2, a full read plus grep for G-3. The one thing 06-08 was authorised to change and did not — `gate/done.ts` — was correctly left alone, and the report that authorised it was wrong; that correction is at the top of this document.

**What the closure round left behind.** Review pass 3 raised four warnings on the gap-closure code. None defeats a numbered criterion, and all four are in `advisory:` above. Two deserve the owner's attention rather than a planner's backlog:

- **P3-01** is the only one that touches a declared prohibition ("accord must not print a removal command aimed at a path outside the repository"). 06-07 closed the link vector completely; a newline in a planted directory name is a second vector nobody had looked at, and the D-51 narrowing — correct for the `café` case — exempts control characters as a side effect. It is POSIX-only and unreproduced. Flagged, not closed.
- **P3-04** is a prose decision with a real consequence: the block a reviewer copies pre-fills `Result: pass`, which is the wrong default for the one field the whole independent-review step exists to make honest. The rule that corrects it sits below the block, outside what gets copied. `Result: <pass | fail | blocked>` fails loudly instead of quietly and keeps both of 06-08's new invariants green. Your call.

Phase 7 is not blocked by any of this. G-0 is scheduled there; P3-01 and P3-02 are contained to a command Phase 7 does not build on; P3-03 is a missing guard over behaviour that is currently correct; P3-04 and P3-06 are prose in files Phase 7's `init` work will touch anyway.

---

_Verified: 2026-09-17T04:50:23Z_
_Verifier: Claude (gsd-verifier)_
_Supersedes: the 2026-09-16T06:13:16Z report at this path_
