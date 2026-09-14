---
phase: "3"
slug: "lint"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-14"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0, `pool: 'forks'`, `environment: 'node'`, projects `core` and `cli` |
| **Config file** | `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| **Quick run command** | `npm test -- --project core <stem>` (`lint`, `ears`, `tokens`, `junit`, `render`, `snapshot`, `schemas`, `templates`); one golden: `npm test -- --project core lint -u -t "fixture <name>"` |
| **Full suite command** | `npm run check` (= `npm run build && npm run lint && npm run typecheck && npm test`) |
| **Estimated runtime** | ~5 s per scoped run; ~40 s for `npm run check` on Windows |

---

## Sampling Rate

- **After every task (no commits in this project; after every task's working-tree change):** run the task's `<automated>` command; `npm run lint && npm run typecheck` whenever a `src/` file changed (purity guard)
- **After every plan wave:** `npm test -- --project core` green, then `npm test` (both projects)
- **Before `/gsd-verify-work`:** `npm run check` green locally on Windows
- **Max feedback latency:** ~5 seconds for a scoped run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | CORE-04, CORE-05, LINT-01, FMT-09 | T-03-07 / T-03-12 | `lint.id-mismatch` case-sensitive; `lintSnapshot` never mutates the snapshot; `schema.if` dropped, every other loader finding surfaced as `error` | tracer (golden loop, five encodings) | `npm run lint && npm run typecheck && npm test -- --project core snapshot && npm test -- --project core lint` | ❌ W0: `packages/core/test/lint.test.ts` + eight `*.lint.json` goldens (created by this task) | ⬜ pending |
| 3-01-02 | 01 | 1 | CORE-05 | T-03-05 | text and JSON render the same findings; no `node:` import in the bundle | unit + post-build | `npm run build && npm test -- --project core render && npm test -- --project core bundle && npm test -- --project cli load` | ❌ W0: `packages/core/test/render.test.ts` (created by this task) | ⬜ pending |
| 3-02-01 | 02 | 2 | LINT-05, LINT-06, LINT-07 | T-03-08 / T-03-06 / T-03-01 | oversize warnings; sentinel scan excludes comments; per-line bounded regexes | golden | `npm run lint && npm run typecheck && npm test -- --project core lint -t "fixture (lint-hygiene\|valid-build\|verification-edges\|frontmatter-errors\|body-edges\|gherkin-shapes\|no-config\|bad-config\|config-syntax)"` | ❌ W0: fixture `lint-hygiene` (HYGIENE, SIZE, HEADINGS, EPIC) + golden; regenerated `frontmatter-errors`, `body-edges`, `gherkin-shapes`, `no-config`, `bad-config`, `config-syntax` lint goldens (heading-missing delta stated per ticket) | ⬜ pending |
| 3-02-02 | 02 | 2 | LINT-08, FMT-10 | T-03-05 | plan-tag diff names both sides; notes rules; `CLEAN.md` has zero findings (no false positives) | golden + unit (rule table invariants) | `npm run lint && npm run typecheck && npm test -- --project core lint -t "fixture (lint-hygiene\|valid-build\|verification-edges\|frontmatter-errors\|body-edges\|gherkin-shapes\|no-config\|bad-config\|config-syntax)" && npm test -- --project core snapshot -t "fixture lint-hygiene"` | ❌ W0: NOTES, PLAN-EMPTY, CLEAN tickets; regenerated `valid-build`, `verification-edges`, `body-edges` lint goldens (plan-empty delta) | ⬜ pending |
| 3-03-01 | 03 | 2 | FMT-11 | T-03-10 / T-03-11 / T-03-01 | worst-status merge for duplicate ids; CDATA and comments blanked; garbage report is one `load.report-invalid`; schema rejects `tests: {}` and extra keys | unit | `npm run lint && npm run typecheck && npm test -- --project core junit && npm test -- --project core schemas && npm test -- --project core snapshot -t "fixture (bad-config\|body-edges\|config-syntax\|frontmatter-errors\|gherkin-shapes\|no-config\|valid-build\|verification-edges)"` | ❌ W0: `packages/core/test/junit.test.ts`; ✅ `schemas.test.ts` (expectation change) | ⬜ pending |
| 3-03-02 | 03 | 2 | FMT-11 | T-03-02 | `tests.report` path outside the root is skipped; no `npm`/`npx`/`.cmd` spawn | integration (temp git repo) + golden | `npm run build && npm test -- --project cli load && npm test -- --project core snapshot -t "fixture lint-report" && npm test -- --project core lint -t "fixture lint-report"` | ❌ W0: fixture `lint-report` + two goldens; ✅ `cli/test/load.test.ts` (new cases) | ⬜ pending |
| 3-04-01 | 04 | 2 | FMT-09, FMT-10 | T-03-13 | generated module matches `templates/`; no tool names in template text | unit (drift, heading pin, write golden) | `npm run gen && npm test -- --project core templates && npm test -- --project core write && npm run typecheck` | ✅ `templates.test.ts`, `write.test.ts` (expectation and golden change) | ⬜ pending |
| 3-05-01 | 05 | 3 | LINT-02 | T-03-01 | classifier tokenises on whitespace, no `\b`, one deterministic diagnosis | unit + golden | `npm run lint && npm run typecheck && npm test -- --project core ears && npm test -- --project core lint -t "fixture (lint-ears\|valid-build\|body-edges\|verification-edges\|lint-hygiene\|lint-report)"` | ❌ W0: `packages/core/test/ears.test.ts`, fixture `lint-ears`; regenerated `body-edges` lint golden (five ears-unclassified on FENCE) | ⬜ pending |
| 3-05-02 | 05 | 3 | LINT-03, FMT-09, FMT-11 | T-03-09 / T-03-05 | `@test:` id exact lookup, no fuzzy match; reasons echo tags and ids only | golden | `npm run lint && npm run typecheck && npm test -- --project core lint && npm test -- --project core snapshot -t "fixture (lint-gherkin\|lint-missing-files)"` | ❌ W0: fixtures `lint-gherkin`, `lint-missing-files`; regenerated `lint-report`, `gherkin-shapes`, `frontmatter-errors`, `body-edges`, `no-config`, `bad-config`, `config-syntax` lint goldens (no-scenarios and ac-tag deltas) | ⬜ pending |
| 3-06-01 | 06 | 4 | LINT-04 | T-03-04 / T-03-01 / T-03-14 | local `--x` declarations do not launder literals; comments and scripts blanked; 1 MB input under 2 s | unit | `npm run lint && npm run typecheck && npm test -- --project core tokens` | ❌ W0: `packages/core/test/tokens.test.ts` | ⬜ pending |
| 3-06-02 | 06 | 4 | LINT-04 | T-03-15 | `Derived from:` paths are membership-tested on `snapshot.tree`, never read; token rule warning-only | golden + full suite | `npm run build && npm run lint && npm run typecheck && npm test` | ❌ W0: fixtures `lint-tokens`, `lint-no-tokens`; `valid-build` prototype; pins in `snapshot.test.ts`, `cli/test/load.test.ts`; regenerated `verification-edges` lint golden (one prototype-derivation) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No framework install: vitest 5 and the fixture harness (`test/helpers/fixture.ts`, `snapshot.test.ts` loop) exist from Phases 1 and 2. Each plan creates its own test file, fixture, and golden in the task that creates the behaviour (Phase 2 pattern). Wave 1 (03-01) establishes the shared `lint.test.ts` loop and the `describe('fixture <name>')` contract that lets later waves generate goldens with a scoped `-u`.

- [ ] `packages/core/test/lint.test.ts` + `__golden__/<fixture>.lint.json` for the eight existing fixtures — 03-01 (tracer; also regenerates every `*.snapshot.json` for the new `files` key) — CORE-04, LINT-01, every fixture-driven requirement
- [ ] `packages/core/test/render.test.ts` — 03-01 — CORE-05
- [ ] fixture `lint-hygiene` (7 tickets) — 03-02 — LINT-05, LINT-06, LINT-07, LINT-08, FMT-10
- [ ] `packages/core/test/junit.test.ts` + fixture `lint-report` — 03-03 — FMT-11
- [ ] `packages/core/test/ears.test.ts` + fixture `lint-ears` — 03-05 — LINT-02
- [ ] fixtures `lint-gherkin`, `lint-missing-files` — 03-05 — LINT-03, FMT-09, FMT-11
- [ ] `packages/core/test/tokens.test.ts` + fixtures `lint-tokens`, `lint-no-tokens`, `valid-build` prototype — 03-06 — LINT-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate `### @ac-n` blocks under `## Verification notes` produce no finding (backstop truth in 03-02) | FMT-10 | Not specified by any decision; recorded as a backstop so the verifier asks rather than passes | Add a second `### @ac-1` block to `lint-hygiene/CLEAN.md` in a scratch copy, run `lintSnapshot`, confirm no `lint.note-orphan`; then confirm with the owner whether v0.1 should warn |

All other phase behaviours have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
