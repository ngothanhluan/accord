---
phase: "1"
slug: "workspace-and-formats"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-05"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 (`pool: 'forks'`, `environment: 'node'`, `projects: ['packages/core', 'packages/cli']`) |
| **Config file** | none yet — Wave 0 (Plan 01-01 Task 2) creates `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| **Quick run command** | `npm test -- --project core` |
| **Full suite command** | `npm run check` (= `npm run build && npm run lint && npm run typecheck && npm test`) |
| **Estimated runtime** | quick ~5 s; full ~60 s (tsdown build + the tsc probe in `purity.test.ts`) |

---

## Sampling Rate

- **After every task (no commits — the author commits after review):** Run `npm test -- --project core` (plus `npm run lint` when `packages/core/src` or `eslint.config.js` changed)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green locally on Windows, then CI green on all four matrix legs after the author's push
- **Max feedback latency:** ~60 s (full), ~5 s (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | OPS-01, CORE-01, FMT-02, FMT-03, FMT-06 | T-01-SC / T-01-07 | exact-pinned deps, `types: []` in core, only `validate/ajv.ts` imports ajv | smoke (tracer) | `npm run build && npx tsc -p packages/core && npx tsc -p packages/cli && node packages/cli/dist/cli.js` | ✅ (creates the workspace) | ✅ green |
| 1-01-02 | 01 | 1 | FMT-02, OPS-01 | T-01-02 | invalid ticket yields path-bearing findings; unknown keys rejected | unit + golden + spawn | `npm run lint && npm run typecheck && npm test` | ✅ (`packages/core/test/schemas.test.ts`, `packages/cli/test/bin.test.ts`) | ✅ green |
| 1-01-03 | 01 | 1 | OPS-02 | T-01-01 | `permissions: contents: read`; no secrets | CI + grep | `grep -q 'windows-latest' .github/workflows/ci.yml && … && npm run check` | ✅ (`.github/workflows/ci.yml`) | ✅ green |
| 1-02-01 | 02 | 2 | CORE-01 | T-01-07 / T-01-08 | ESLint and tsc reject `node:*` and bare built-ins; ajv seam enforced; tsc probe is a committed fixture outside `src/` (test writes nothing, no coupling with parallel lint/typecheck) | unit (ESLint API, tsc spawn) | `npm test -- --project core purity && npm run typecheck` | ✅ (`packages/core/test/purity.test.ts`, `test/fixtures/purity/{tsconfig.json,probe.ts}`) | ✅ green |
| 1-02-02 | 02 | 2 | CORE-01 | T-01-07 / T-01-16 | built bundle has no built-in import; d.ts hides ajv types; missing-build message proven against an empty temp dir (`dist/` never deleted — 01-04 rebuilds it in the same wave) | unit (post-build) | `npm run build && npm test -- --project core bundle` | ✅ (`packages/core/test/bundle.test.ts`) | ✅ green |
| 1-03-01 | 03 | 2 | FMT-06 | T-01-02 / T-01-10 | config has no credential key; `reviewer` is not a field | unit + golden | `npm test -- --project core schemas` | ✅ (goldens `config.invalid.json`, `verification.invalid.json`) | ✅ green |
| 1-03-02 | 03 | 2 | FMT-02, FMT-03 | T-01-02 / T-01-05 | tracker-owned keys rejected; anchored patterns | unit + golden | `npm test -- --project core schemas` | ✅ (golden `ticket.tracker.invalid.json`) | ✅ green |
| 1-04-01 | 04 | 2 | FMT-07, FMT-01 | T-01-11 / T-01-15 | D-11 ownership guidance; generic sample values; frontmatter guidance is YAML `#` comments only, byte-identical across the two ticket templates (D-08) | grep + node one-liner | `ls packages/core/templates … && ! grep -rq '{{' packages/core/templates && node -e '<D-08 check>' ticket-build.md ticket-maintain.md` | ✅ (templates) | ✅ green |
| 1-04-02 | 04 | 2 | FMT-07 | T-01-04 | generated module committed; bundle still pure | build + grep | `npm run gen && npm run build && npm run typecheck && npm run lint && grep -q '## Acceptance criteria' packages/core/dist/index.js` | ✅ (`scripts/gen-templates.mjs`) | ✅ green |
| 1-04-03 | 04 | 2 | FMT-07, FMT-01 | T-01-04 | drift test red on an unregenerated template | unit | `npm test -- --project core templates` | ✅ (`packages/core/test/templates.test.ts`) | ✅ green |
| 1-05-01 | 05 | 2 | OPS-01, FMT-02, FMT-06, FMT-07 | T-01-13 | scoped edits only; other phases' ROADMAP entries intact | grep | `grep -q 'OPS-01…' .planning/REQUIREMENTS.md && ! grep -q 'qa.ticks' …` | ✅ (docs exist) | ✅ green |
| 1-05-02 | 05 | 2 | FMT-01 | T-01-14 | fresh-context review is the only writer of `verification.md` | grep | `grep -q 'tickets/<id>/verification.md' README.md && … && grep -q 'review.md' docs/design.md` | ✅ (docs exist) | ✅ green |
| 1-05-03 | 05 | 2 | FMT-01 | T-01-14 | N/A | unit (grep over docs) | `npm test -- --project core convention` | ✅ (`packages/core/test/convention.test.ts`) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The repository is greenfield; Wave 0 is Plan 01-01 (wave 1), which installs the framework and creates the first tests. Wave-2 plans each create their own test file in the same task that creates the behaviour.

- [x] `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts` — 01-01 Task 2
- [x] `packages/core/tsconfig.test.json` — 01-01 Task 2 (lets core tests use `node:*` while `src` stays under `types: []`)
- [x] `packages/core/test/schemas.test.ts` + `__golden__/ticket.invalid.json` — 01-01 Task 2 (FMT-02, "schemas compile", empty-input edge); extended by 01-03
- [x] `packages/cli/test/bin.test.ts` — 01-01 Task 2 (shebang, spawn via `process.execPath`)
- [x] `packages/core/test/purity.test.ts`, `bundle.test.ts`, and the probe fixture `packages/core/test/fixtures/purity/{tsconfig.json,probe.ts}` — 01-02 (CORE-01)
- [x] `packages/core/test/templates.test.ts` — 01-04 (FMT-07, drift)
- [x] `packages/core/test/convention.test.ts` — 01-05 (FMT-01)
- [x] Framework install: root `npm install` with the exact pins in 01-01 Task 1 (vitest 5.0.0, eslint 10.10.0, typescript-eslint 8.69.0, tsdown 0.23.0, typescript 5.9.3, @types/node 24.13.3, globals 17.12.0, @eslint/js 10.0.1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI is green on ubuntu-latest and windows-latest × Node 22 and 24 | OPS-02 | Requires the author to commit and push (no task commits) | After the author's push to `main`, open the GitHub Actions run `ci`; all four matrix legs green. If a Node 22 leg fails tsdown's engine check, set that leg's `node-version` to `22.18` (RESEARCH A1). |
| README.md and docs/design.md read correctly for a newcomer | FMT-01 | Rendering and prose quality | Read README.md on GitHub: folder tree shows `accord/` with `product/`, `tickets/<id>.md`, `tickets/<id>/verification.md`, `assets/<id>/`; roles are BA/designer/dev; Done gate names `verified` and the fresh-context review. |
| Goldens describe the intended findings | FMT-02, FMT-06 | The first `vitest run` writes goldens; a wrong expectation would be pinned as "correct" | Open each `packages/core/test/__golden__/*.json` and compare with the expected paths listed in the plans' acceptance criteria before the author commits. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10 s (quick) / < 90 s (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-06 (validate-phase audit; commit pending owner review)

## Validation Audit 2026-09-06

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 13 tasks map to green automated tests (`npm run check`: 6 files, 64 tests, exit 0 on Windows). The three manual-only items above remain for the owner after commit and push.
