---
phase: "06"
slug: "skills"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-15"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 |
| **Config file** | `vitest.config.ts` (root; `environment: 'node'`, `pool: 'forks'`, `projects: ['packages/core', 'packages/cli']`) |
| **Quick run command** | `npm test -- --project core skills` (core work) / `npm test -- --project cli skills-sync` (CLI work) |
| **Full suite command** | `npm run check` (`build && lint && typecheck && test`) |
| **Estimated runtime** | ~15 s quick, ~90 s full |

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` command (always a filtered vitest run, never the full suite)
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green on Ubuntu and Windows
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SKILL-01, SKILL-02, SKILL-03, CLI-08 | T-06-01 / T-06-02 / T-06-03 | Target paths composed from a literal directory table and the closed `roles` enum; `lstatSync` refuses a non-regular-file destination with exit 2 | unit + integration | `npm test -- --project core skills` ; `npm test -- --project cli skills-sync` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | SKILL-01, SKILL-09 | — | N/A | unit | `npm test -- --project core skills` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | SKILL-02, SKILL-04, CLI-08 | T-06-05 | Marker asserts no integrity property FNV-1a does not provide | unit + integration | `npm test -- --project core skills` ; `npm test -- --project cli skills-sync` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | SKILL-01, SKILL-06, SKILL-07, SKILL-09, SKILL-12 | T-06-06 | Only accord's own definitions are rendered; no user content is interpolated | unit | `npm test -- --project core skills` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | CLI-08 | T-06-08 | Config carries no secret and names no host (`tracker.adapter: none`) | integration (real repo) | `node packages/cli/dist/cli.js skills sync` twice, then `test -z "$(git status --porcelain .claude/skills)"` | ✅ exists (built binary) | ⬜ pending |
| 06-02-03 | 02 | 2 | SKILL-12 | — | N/A | unit (ordered text assertion) | `npm test -- --project core skills` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | SKILL-08 | — | N/A | unit (registry scan) | `npm test -- --project cli skill-commands` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | CLI-08 | T-06-04 / T-06-09 / T-06-10 | Orphans reported never deleted; `accord-*` only; pin mismatch writes nothing | integration | `npm test -- --project cli skills-sync` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 3 | CLI-08, SKILL-04 | — | Printed paths are forward-slash and ASCII on both CI legs | integration | `npm test -- --project cli spawn-surface` | ✅ exists — add a `COMMANDS` row | ⬜ pending |
| 06-04-01 | 04 | 3 | SKILL-01, SKILL-05 | T-06-06 | Same as 06-02-01 | unit | `npm test -- --project core skills` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 3 | SKILL-05 | T-06-12 | Readiness review states its own boundary; not tool-enforced, accepted | unit | `npm test -- --project core skills` | ❌ W0 | ⬜ pending |
| 06-04-03 | 04 | 3 | SKILL-01, SKILL-05 | T-06-11 | Template drift fails CI with a message naming `npm run gen` | unit + integration (real repo) | `npm test -- --project core` ; `node packages/cli/dist/cli.js skills sync` twice | ✅ exists — extend `templates.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is folded into plan 06-01 task 1, which creates both new test files as part of the
tracer slice rather than as a separate preparatory wave. Nothing in this phase has an
`<automated>` command pointing at a file no task creates.

- [ ] `packages/core/test/skills.test.ts` — created by 06-01-01; covers SKILL-01, -02, -03, -04, -05, -06, -07, -09, -12 (structural), D-105 drift, D-119, D-129
- [ ] `packages/cli/test/skills-sync.test.ts` — created by 06-01-01; covers CLI-08's four D-112 states, D-113 orphan, D-121 pin
- [ ] `packages/cli/test/skill-commands.test.ts` — created by 06-03-01; covers SKILL-08 / D-110
- [ ] `packages/core/test/fixtures/wrong-plan/` — created by 06-02-03; the D-115 fixture
- [ ] `packages/cli/test/spawn-surface.test.ts` — exists; 06-03-03 adds a `skills sync` row to its `COMMANDS` table
- [ ] `packages/core/test/templates.test.ts` — exists; 06-04-03 extends it for the D-116 guidance line
- [ ] No framework install needed — vitest 5.0.0 is present and configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A `## Plan` that targets the wrong layer or the wrong order comes back changed from the plan review | SKILL-12 (ROADMAP criterion 7, D-115 part 2) | The subject is model behaviour, and the "No API keys" constraint forbids running a model inside the test suite. D-115 accepts this split explicitly. | Once, during phase verification: open a fresh context; hand it the plan-review brief from `accord-dev/SKILL.md` step 4 plus `packages/core/test/fixtures/wrong-plan/accord/tickets/TCK-1.md`; record the `## Plan` before and after in the phase verification notes. The criterion is met when the returned plan differs. Do not automate it and do not weaken the criterion to make it automatable. |
| The three fresh-context reviews read as three instances of one shape | SKILL-06, SKILL-12, D-125 | Editorial judgement over prose; the automated half is the per-phrase assertions in 06-04-03. | Read the three rendered `SKILL.md` files and `ready.md`, `review.md` end to end once, as a user receives them. |
| No rendered skill restates a rule the CLI enforces | SKILL-04 (ROADMAP criterion 3, second clause) | Not automatable as stated: the property is whether a sentence *restates* a Ready-table row or a lint rule rather than pointing at the command that reports it, which is a judgement about intent, not a string match. A test that matched on keywords would fail differently — it would flag a skill for naming `## Open questions` at all. | Once, before `/gsd-verify-work`: read all eleven rendered files — `accord-ba/{SKILL.md,setup.md,story.md,ready.md}`, `accord-dev/{SKILL.md,debug.md,review.md,code-review.md,prototype.md}`, `accord-designer/{SKILL.md,prototype.md}` — against `docs/design.md` §5's Ready and Done tables and `packages/core/src/lint/rules.ts`. For each place a rule is mentioned, confirm the text names the command that reports it rather than reproducing what it checks. Record one line per file in the phase verification notes. |
| Cursor and Copilot, which read both target directories, tolerate the same skill name appearing twice | SKILL-03 | No vendor documents duplicate-name behaviour (RESEARCH.md Open Question 1, assumption A2). Both copies are byte-identical, so the worst case is a duplicate picker entry. | Observe what the author's own editor does once this repository is dogfooding the generated skills; record one sentence in the phase verification notes. No design change either way. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
