---
phase: "01"
slug: "workspace-and-formats"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-06"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| frontmatter / config document → `validate()` | Untrusted YAML-derived objects (BA-authored, later chat clients over MCP) enter ajv-compiled validators | ticket frontmatter, `config.yml`, `verification.md` frontmatter |
| GitHub Actions → repository | Third-party actions run against the checkout with the workflow token | source tree, no secrets |
| npm registry → `node_modules` | Dependencies and their `.d.ts` enter the build and the core bundle | package code, type declarations |
| `templates/*.md` → `src/generated/templates.ts` → core bundle | Template text becomes string data in the published package | guidance text, sample values |
| planning documents → future executors | Requirement and roadmap text steers later phases | `.planning/**` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | `.github/workflows/ci.yml` | medium | mitigate | `permissions: contents: read` at top level (ci.yml:6-7); no secrets referenced; actions pinned to major tags, SHA pins deferred to Phase 9 | closed |
| T-01-02 | Information disclosure | schemas: undeclared keys | medium | mitigate | `additionalProperties: false` in config (3), ticket (3), verification (1) schemas; `patternProperties` on `tracker` | closed |
| T-01-03 | Spoofing | schema `$id` placeholder `https://accord.dev/...` | low | accept | ajv uses `$id` as a key only; no network `$ref`; stable URL is a Phase 9 prerequisite (D-26) | closed |
| T-01-04 | Tampering | `src/generated/templates.ts` drift | medium | mitigate | `templates.test.ts` "generated module matches templates/ (drift)" byte-compares every file; no auto-regeneration hook | closed |
| T-01-05 | Denial of service | schema `pattern` on user input | low | mitigate | All seven patterns anchored and linear (no nested quantifiers) | closed |
| T-01-06 | Tampering | ajv `new Function` in `compile()` | low | mitigate | Only the three shipped schemas compiled at module load (`validate/ajv.ts:13-15`); `validate(schemaId, doc)` takes an id | closed |
| T-01-07 | Elevation of privilege | transitive `@types/node` via dependency `.d.ts` | medium | mitigate | `"types": []` in core tsconfig; `purity.test.ts` tsc probe; `bundle.test.ts` greps dist for `node:` imports | closed |
| T-01-08 | Denial of service | probe file breaking core build | low | mitigate | Fixture lives in `test/fixtures/purity/` with its own tsconfig (`extends`, `include: [probe.ts]`), outside `src/` | closed |
| T-01-09 | Tampering | test spawning a PATH-shadowable shim | low | mitigate | Tests spawn only `process.execPath` with absolute paths (`purity.test.ts:67`, `bin.test.ts:19,25`); no `npx`/`.cmd` | closed |
| T-01-10 | Repudiation | `verification.md` `reviewer` field | low | mitigate | `verification.schema.json` declares no `reviewer`; git author is the proof (D-09) | closed |
| T-01-11 | Tampering | template guidance instructing BA to write implementation detail | low | mitigate | "never name tables, endpoints, libraries, or screens" pinned by `templates.test.ts` "ownership guidance is present" | closed |
| T-01-12 | Information disclosure | README describing employer details | low | accept | README names no employer, account, or person; `shortcut` appears only as an example adapter key | closed |
| T-01-13 | Tampering | whole-file rewrite of ROADMAP/REQUIREMENTS | medium | mitigate | ROADMAP still has 9 `### Phase` headers; REQUIREMENTS traceability table intact | closed |
| T-01-14 | Repudiation | docs implying the code author may write `verification.md` | low | mitigate | design.md §4 and §5 state only the fresh review context writes it; README line 17 repeats it | closed |
| T-01-15 | Information disclosure | template shipping person-specific sample text | low | mitigate | Sample values generic (`TICKET-ID`, `EPIC-ID`); "sample values contain no tokens" test | closed |
| T-01-16 | Denial of service | test deleting `packages/core/dist/` | low | mitigate | `bundle.test.ts` only reads `dist/`; missing-build path uses `mkdtempSync` and removes only that temp dir | closed |
| T-01-SC | Tampering | npm installs | high | mitigate | Exact pins (no `^`/`~` in any package.json); committed `package-lock.json`; `npm ci` in CI; zero `postinstall` scripts in lockfile | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01-01 | T-01-03 | Placeholder `$id` is never dereferenced; revisit when the schema URL is published in Phase 9 | author | 2026-09-06 |
| R-01-02 | T-01-12 | README carries no employer, tracker account, or personal detail | author | 2026-09-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-06 | 17 | 17 | 0 | secure-phase L1 (register authored at plan time; grep-depth verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-06
