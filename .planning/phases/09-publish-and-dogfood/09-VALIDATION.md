---
phase: "09"
slug: "publish-and-dogfood"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-21"
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `09-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 (present and wired — no Wave 0 install) |
| **Config file** | `packages/cli/vitest.config.ts`, `packages/core/vitest.config.ts` |
| **Quick run command** | `npm test -w packages/cli` |
| **Full suite command** | `npm run check` (build + lint + typecheck + test) |
| **Estimated runtime** | ~60–90 seconds for `npm run check` |

---

## Sampling Rate

- **After every task commit:** Run `npm test -w packages/cli`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Phase gate (additional):** both CI jobs (`check` matrix and `examples`) green on `main` **before any tag is pushed**
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table fixes the requirement/command bindings the planner must honour.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| OPS-03 | `dist/cli.js` imports no `@accord-dev/accord-core` | unit | `npx vitest run -t "bin"` | ❌ W0 |
| OPS-03 | `packages/cli` declares exactly one runtime dependency (D-164) | unit | `npx vitest run -t "bin"` | ❌ W0 |
| OPS-03 | `dist/cli.js` still starts with `#!/usr/bin/env node` | unit | `npx vitest run -t "shebang"` | ✅ `bin.test.ts` |
| OPS-03 | the published bundle names no other tool | unit | `npx vitest run -t "names no other tool"` | ✅ `bin.test.ts` |
| OPS-03 | `packages/core` is `private: true` and keeps its `exports` map | unit | `npx vitest run -t "manifest shape"` | ✅ `bundle.test.ts` (+1 assertion) |
| OPS-03 | `packages/cli/README.md` matches its source | unit | `npx vitest run -t "drift"` | ❌ W0 |
| OPS-03 | the tag-vs-manifest check rejects a mismatch | unit | bash-executed test over the workflow `run:` body | ❌ W0 |
| OPS-03 | `engines` is `>=22.12.0` | unit | `npx vitest run -t "bin"` | ❌ W0 (09-01 Task 3, same case as the dependency-key assertion) |
| OPS-04 | the emitted `accord.yml` gates touched tickets | unit | `npx vitest run -t "workflow script"` | ✅ `workflow-script.test.ts` |
| OPS-04 | the emitted `accord.yml` checks out the PR head sha (D-162) | unit | `npx vitest run -t "scaffold"` | ❌ W0 |
| OPS-04 | `--version` prints the running version | unit | `npx vitest run -t "version"` | ⚠️ pins literal `'0.1.0'` — re-anchor to `pkg.version` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/cli/scripts/gen-readme.mjs` + wiring into the root `gen` script — covers D-156 defect 1
- [ ] `packages/cli/test/readme.test.ts` — drift, LF, no BOM (copy `templates.test.ts`'s drift case)
- [ ] New cases in `packages/cli/test/bin.test.ts` — core not imported; `dependencies` has one key; `engines.node` is `>=22.12.0`; `--version` reads `pkg.version` instead of the literal
- [ ] `packages/cli/test/new-ticket.test.ts:167` — re-anchor the regex off the literal version
- [ ] One `private: true` assertion in `packages/core/test/bundle.test.ts`
- [ ] A scaffold assertion that the emitted workflow carries `ref: ${{ github.event.pull_request.head.sha }}` (D-162)
- [ ] A bash-executed test over the publish workflow's version-check body, following `packages/cli/test/workflow-script.test.ts`
- [ ] Framework install: **none** — vitest is present and wired

---

## Manual-Only Verifications

Seven of this phase's deliverables cannot be asserted by any test in this repository. Every row below is
`09-VERIFICATION.md`'s job. **A plan that assumes a test will cover any of it will produce a phase that
cannot close.**

| Behavior | Requirement | Why Manual | Required Evidence |
|----------|-------------|------------|-------------------|
| Published from Actions via trusted publishing | OPS-03 / ROADMAP 1 | Happens once, on a real registry, from a real runner. A test can prove the workflow parses and that the version check rejects a mismatch; it cannot prove OIDC succeeded. | Actions run URL; publish-step log showing no token used; npm page showing the provenance attestation; the trusted-publisher field values as configured |
| `npx --yes @accord-dev/accord --version` on a clean machine | OPS-03 / ROADMAP 1 | The smoke job is the proof, and it is a job, not a test. | Smoke-job log including attempt count and printed version; ideally a second manual run with the npx cache cleared |
| The generated CI workflow is green | OPS-04 / ROADMAP 2 | Runs in a real pull request against a real diff. `workflow-script.test.ts` executes the script body against synthetic diffs; it cannot produce a green GitHub check. | PR URL; the `accord` check's conclusion; job log showing which ticket ids it gated, and the expected `lint.tokens-missing` warning |
| Ready and Done on a coding agent with a fresh-context review | OPS-04 / ROADMAP 3 | Gate *logic* is covered by Phase 4's suite. That a human-plus-agent ran the shipped skill is not a testable proposition. | `accord/tickets/<id>.md` with `ac_hash` and `verified:`; `accord/tickets/<id>/verification.md` written by the subagent (D-158); both gate transcripts showing PASS |
| Wall-clock `new ticket` → Ready | OPS-04 / ROADMAP 4, D-159 | Wall-clock time including breaks is unmeasurable by anything but a clock. | Two timestamps and the elapsed figure, with the `accord new ticket` and `accord gate ready` transcripts bracketing them |
| Token findings: genuine vs false positive | OPS-04 / ROADMAP 4, D-161, D-163 | Requires human judgement on each finding, by definition. | Raw finding count, the genuine/false-positive split, one concrete example of each, and the exact commands run in the SimplT scratch worktree |
| Bootstrap token revoked | OPS-03 / D-151 | Registry-side state. | A statement that it was revoked, with the date |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `auto` task across the
      eleven plans carries one; the exceptions are `checkpoint:*` tasks, which take `<verification>`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — all eight items above have an owning task:
      1-2 → 09-03 Tasks 1 and 2 · 3-5 → 09-01 Task 3 · 6 → 09-02 Task 2 · 7 → 09-04 Task 2 ·
      8 → nothing to install
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

`wave_0_complete` stays `false` and `status` stays `draft` on purpose: the eight Wave 0 items are
*owned by tasks*, not *written to disk*. `wave_0_complete` flips when 09-01 to 09-04 have executed
and the files exist; `status` is `validate-phase` §6's to set, not the planner's.

Set by the planner on 2026-09-21 during plan revision. `nyquist_compliant` is a planning-time
property — every task samples — and it was the last thing outstanding once 09-01 Task 3 took
ownership of the `engines` assertion.

**Approval:** pending
