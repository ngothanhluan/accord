---
phase: "2"
slug: "core-model-and-loading"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-13"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Reconstructed after execution from the seven plans, their summaries, and the test tree (validate-phase State B).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 (`pool: 'forks'`, `environment: 'node'`, projects `core` and `cli`) — installed in Phase 1 |
| **Config file** | `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| **Quick run command** | `npm test -- --project core <file-stem>` (e.g. `snapshot`, `frontmatter`, `sections`, `gherkin`, `verification`, `write`) |
| **Full suite command** | `npm run check` (= `npm run build && npm run lint && npm run typecheck && npm test`) |
| **Estimated runtime** | quick 2–10 s; `npm test` ~50 s cold on Windows (13 files, 195 tests); full ~90 s |

---

## Sampling Rate

- **After every task (no commits — the author commits after review):** Run the plan's `<automated>` command; each is a scoped `npm test -- --project core <stem>` plus `snapshot -t "fixture <name>"` so `-u` never touches a sibling plan's golden
- **After every plan wave:** Run `npm test -- --project core` (wave-end 0 failures) and `npm run check` at phase end
- **Before `/gsd-verify-work`:** `npm run check` green locally on Windows, then CI green on all four matrix legs after the author's push
- **Max feedback latency:** ~10 s (quick), ~90 s (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | CORE-02, CORE-03, CORE-06, FMT-04, FMT-05, FMT-08 | T-02-02 / T-02-04 | `Finding`/`SchemaFinding` contract; `validate()` returns findings, never throws; yaml core schema with no custom tags | unit + golden | `npm run lint && npm run typecheck && npm test -- --project core schemas` | ✅ (`packages/core/test/schemas.test.ts`) | ✅ green |
| 2-01-02 | 01 | 1 | CORE-02, CORE-03, CORE-06, FMT-04, FMT-05, FMT-08 | T-02-01 / T-02-03 / T-02-05 | `loadSnapshot` pure and non-mutating; CRLF, BOM+CRLF, mixed, backslash variants load byte-identically to LF; no backslash in any serialised path | tracer (golden, five encodings) | `npm run lint && npm run typecheck && npm test -- --project core snapshot` | ✅ (`packages/core/test/snapshot.test.ts`, `fixtures/valid-build/`, `__golden__/valid-build.snapshot.json`) | ✅ green |
| 2-01-03 | 01 | 1 | CORE-06 | T-02-04 | built bundle exports the new API and stays free of Node built-ins; `.gitattributes` has exactly 3 lines | unit (post-build) + shell | `npm run build && npm test -- --project core bundle && test "$(wc -l < .gitattributes)" -eq 3` | ✅ (`packages/core/test/bundle.test.ts`) | ✅ green |
| 2-02-01 | 02 | 2 | CORE-02, CORE-06, FMT-08 | T-02-06 / T-02-08 | every D-32 frontmatter failure class reported at its line with a pointer; ticket never partially kept; `no`/`0123`/dates stay strings | unit + golden | `npm test -- --project core frontmatter && npm test -- --project core snapshot -t "fixture (frontmatter-errors\|valid-build)"` | ✅ (`packages/core/test/frontmatter.test.ts`, `fixtures/frontmatter-errors/`, golden) | ✅ green |
| 2-02-02 | 02 | 2 | CORE-02, CORE-06, FMT-08 | T-02-07 / T-02-08 | missing, invalid, or unparsable `config.yml` is a finding with file and line, never an exception; `snapshot.config` absent | unit + golden | `npm test -- --project core frontmatter && npm test -- --project core snapshot -t "fixture (no-config\|bad-config\|config-syntax\|frontmatter-errors\|valid-build)" && npm run typecheck` | ✅ (`fixtures/{no-config,bad-config,config-syntax}/`, three goldens) | ✅ green |
| 2-03-01 | 03 | 2 | FMT-05, FMT-04, CORE-06 | T-02-09 / T-02-10 | fence state machine ignores headings inside fences; comment stripping; duplicate headings detected; whitespace-only bullets dropped | unit | `npm test -- --project core sections` | ✅ (`packages/core/test/sections.test.ts`, 22 tests) | ✅ green |
| 2-03-02 | 03 | 2 | FMT-05, FMT-04, CORE-06 | T-02-09 | fenced fakes, casing, duplicates, unterminated fence, tilde inside backtick fence, missing Requirements section each pinned with exact lines | golden | `npm test -- --project core sections && npm test -- --project core snapshot -t "fixture (body-edges\|valid-build)"` | ✅ (`fixtures/body-edges/`, `__golden__/body-edges.snapshot.json`) | ✅ green |
| 2-04-01 | 04 | 2 | FMT-04, CORE-03, CORE-06 | T-02-11 / T-02-12 / T-02-13 | steps normalisation contract (D-48) includes Background and Examples; line remap with and without synthetic Feature line; parse errors remapped; deterministic | unit | `npm test -- --project core gherkin` | ✅ (`packages/core/test/gherkin.test.ts`, 12 tests) | ✅ green |
| 2-04-02 | 04 | 2 | FMT-04, CORE-03, CORE-06 | T-02-11 / T-02-13 | Outline, vi dialect, Rule, parse error, tag variants, doc string, table, multi-fence, empty AC, unknown language each with exact Markdown lines | golden | `npm test -- --project core gherkin && npm test -- --project core snapshot -t "fixture (gherkin-shapes\|valid-build)"` | ✅ (`fixtures/gherkin-shapes/`, `__golden__/gherkin-shapes.snapshot.json`) | ✅ green |
| 2-05-01 | 05 | 2 | CORE-06 | T-02-14 / T-02-16 | `Result:` outside `pass`/`fail`/`blocked` yields `load.result-invalid` at the block line and `result` absent; evidence text comment-stripped; invalid record frontmatter is a finding | unit | `npm test -- --project core verification` | ✅ (`packages/core/test/verification.test.ts`) | ✅ green |
| 2-05-02 | 05 | 2 | CORE-06 | T-02-14 / T-02-15 | orphan record (no ticket) is a finding; record for a broken ticket still loads; stray files under `tickets/<id>/` silently ignored | golden | `npm test -- --project core verification && npm test -- --project core snapshot -t "fixture (verification-edges\|valid-build)"` | ✅ (`fixtures/verification-edges/`, `__golden__/verification-edges.snapshot.json`) | ✅ green |
| 2-06-01 | 06 | 3 | CORE-02, FMT-08 | T-02-17 / T-02-18 / T-02-19 | `setFrontmatterKey` changes one key and preserves every other byte including comments and key order; tags written as double-quoted block list; `verified` kept last | unit + Markdown golden | `npm test -- --project core write && npm run typecheck && npm run lint` | ✅ (`packages/core/test/write.test.ts`, `__golden__/LOGIN-1.*.md`, `ticket-build.verified-empty.md`) | ✅ green |
| 2-06-02 | 06 | 3 | CORE-02, FMT-08 | T-02-19 | output is LF, UTF-8, no BOM; BOM+CRLF input yields the same text as LF; idempotent; `setFrontmatterKey` and `FrontmatterValue` exported from the built bundle (D-55) | unit (post-build) | `npm run build && npm test -- --project core write && npm test -- --project core bundle` | ✅ (`write.test.ts`, `bundle.test.ts`) | ✅ green |
| 2-07-01 | 07 | 2 | CORE-06, FMT-08 | T-02-20 / T-02-21 / T-02-22 | `execFileSync('git', …)` with an argument array, no shell, no `npx`/`npm`/`.cmd`; tokens path contained inside the repo root | build + typecheck + lint + grep | `npm run build && npm run typecheck && npm run lint && ! grep -Eq "npx\|npm\|\.cmd\|shell: *true" packages/cli/src/load/fs.ts` | ✅ (`packages/cli/src/load/fs.ts`) | ✅ green |
| 2-07-02 | 07 | 2 | CORE-06, FMT-08 | T-02-20 / T-02-23 | temp-repo parity with `valid-build.snapshot.json` from a real `git ls-files` tree; `.gitignore` honoured; posix keys only; `design.tokens` escaping the root is a usage error; not-a-repo and no-`accord/` are `UsageError` exit 2 | integration (temp git repo) | `npm run build && npm test -- --project cli load` | ✅ (`packages/cli/test/load.test.ts`) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 1 installed the framework; no new infrastructure was needed. Each Phase 2 plan created its own test file, fixture, and golden in the task that created the behaviour. Wave 1 (Plan 02-01) established the shared `snapshot.test.ts` loop and the `describe('fixture <name>')` contract that lets Wave 2 plans create goldens in isolation.

- [x] `packages/core/test/snapshot.test.ts` + `test/fixtures/valid-build/` + `__golden__/valid-build.snapshot.json` — 02-01 (tracer, five encodings)
- [x] `packages/core/test/frontmatter.test.ts` + fixtures `frontmatter-errors`, `no-config`, `bad-config`, `config-syntax` — 02-02
- [x] `packages/core/test/sections.test.ts` + fixture `body-edges` — 02-03
- [x] `packages/core/test/gherkin.test.ts` + fixture `gherkin-shapes` — 02-04
- [x] `packages/core/test/verification.test.ts` + fixture `verification-edges` — 02-05
- [x] `packages/core/test/write.test.ts` + three Markdown goldens — 02-06
- [x] `packages/cli/test/load.test.ts` — 02-07 (temp git repos via `execFileSync('git', …)`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ubuntu CI legs pass with the committed goldens unchanged | CORE-06 | Requires the author to commit and push; the Windows-authored goldens are only proven cross-platform on the runner | After the push to `main`, open the GitHub Actions run `ci`; ubuntu-latest/22 and /24 green alongside both Windows legs. **Done 2026-09-13:** run at commit `f4cc8cc` green on all four legs (02-UAT.md test 1). |
| `git` absent from PATH raises `UsageError` exit 2 | CORE-06 | The suite cannot remove `git` from PATH without breaking its own temp-repo setup in the same process | In a shell without `git` on PATH, call `loadFromFs(<any dir>)`; expect `UsageError` with message `git is required but was not found on PATH` and `exitCode` 2. **Done 2026-09-13:** proven with a throwaway vitest that stripped PATH (02-UAT.md test 2). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10 s (quick) / < 90 s (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-13 (validate-phase audit; commit pending owner review)

## Validation Audit 2026-09-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 14 tasks map to green automated tests. `npm test` on this machine: 13 files, 195 tests, 194 passed. The one failure was `purity.test.ts > layer A > node:fs (prefixed)` (Phase 1) hitting vitest's 5 s per-test timeout because the first ESLint invocation took 32 s under a cold cache with every worker loading in parallel; re-run in isolation it passes 9/9 in 2.2 s and CI is green, so it is a cold-start flake, not a Phase 2 gap. Finding only, no change made: if it recurs, the fix belongs in Phase 1's test (a per-test timeout on the first ESLint call), not in production code. The two manual-only items above were both closed by 02-UAT.md.
