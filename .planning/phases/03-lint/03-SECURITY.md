---
phase: "03"
slug: "lint"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-14"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: authored at plan time — all six `03-0*-PLAN.md` files carry a
`<threat_model>` block. Verified at ASVS L1 (grep depth), `block_on: high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repository text → `lintSnapshot` | Untrusted tickets, config, prototype HTML, and tokens CSS from any contributor | Markdown, YAML, HTML, CSS — public repo content |
| `config.yml` path → CLI filesystem read | A contributor controls `design.tokens` and `tests.report`; the host must not read outside the repository | File paths, then file bytes |
| report XML → `scanJUnit` | Untrusted XML produced by a test runner or by hand | Test ids and statuses |
| `LintResult` → CI log / editor problem matcher | Reason strings are echoed into logs read by other people | Rule ids, tags, scenario names, matched tokens |
| `Derived from:` paths → `snapshot.tree` lookup | Contributor-written paths checked for existence only, never read | Path strings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-02 | Information disclosure | `tests.report: ../../secrets.xml` pulling a file outside the repo into the snapshot | high | mitigate | `containedPath()` at `packages/cli/src/load/fs.ts:52` rejects `..`, absolute, and non-file paths; applied to both `design.tokens` and `tests.report` at `fs.ts:68-71`. Test: `packages/cli/test/load.test.ts:138` "skips a report path outside the repository" (and `:100` for tokens). | closed |
| T-03-SC | Tampering | npm installs (supply chain) | high | mitigate | No package added across all six plans; `git diff --stat -- package-lock.json` is empty. | closed |
| T-03-07 | Spoofing | ticket id differing from file stem by case (R-02-05 carry-over) | medium | mitigate | `lint.id-mismatch` (`packages/core/src/lint/rules.ts:49`, `error` level) compares `frontmatter.id` to the file stem case-sensitively; pinned by the `frontmatter-errors` lint golden. | closed |
| T-03-09 | Tampering | a near-miss `@test:` id treated as known, later letting GATE-08 pass on the wrong test | medium | mitigate | Exact own-property lookup at `packages/core/src/lint/gherkin.ts:85`. **Strengthened during UAT 03 (2026-09-14):** the original `id in tests` consulted `Object.prototype`, so an id named after a prototype member (`toString`, `constructor`) read as known and the rule stayed silent — the exact bypass this threat names. Replaced with `Object.hasOwn(tests, id)`. Test: `packages/core/test/lint.test.ts` "an unknown @test id named after an Object.prototype member still warns"; the `lint-report` golden still pins `@test:nope#missing` as unknown. | closed |
| T-03-10 | Tampering | duplicate ids where a later `passed` overwrites an earlier `failed` | medium | mitigate | `RANK` merge keeps the worst status (`packages/core/src/load/junit.ts:17,41`). **Strengthened during UAT 03:** the guard's `id in out` dropped every testcase named after an `Object.prototype` member (probe: 2 of 3 ids silently lost); now `Object.hasOwn(out, id)`. Test: `packages/core/test/junit.test.ts` "keeps testcases named after Object.prototype members". | closed |
| T-03-11 | Tampering | CDATA or comment bodies containing a fake `<testcase>` | medium | mitigate | CDATA and comments blanked before matching (`packages/core/src/load/junit.ts:25`). Tests 3 and 5 in `junit.test.ts`. | closed |
| T-03-04 | Tampering | prototype declaring its own `--x: #fff` in a local `<style>` to launder a literal | medium | mitigate | `--*` declarations skipped (`packages/core/src/lint/tokens.ts:131`); every `var(--x)` use is checked against the tokens file only, so the use site warns. | closed |
| T-03-03 | Tampering | hand-written passing report committed to the repository | medium | accept | Out of lint's scope — see Accepted Risks Log. | closed |
| T-03-01 | Denial of service | pathological input (megabyte prototype, 20 000-token class attribute, megabyte report, pathological ticket lines) against the scanners | medium | mitigate | Per-line bounded character classes, no nested quantifiers; `scanJUnit` is a single forward pass with `[^>]*?` bounded by `>` and `indexOf` for the closing tag; offset-to-line binary search in the token scanner. Test: `packages/core/test/tokens.test.ts:125` bounds a 1 MB style block plus a 20 000-token class attribute. | closed |
| T-03-05 | Information disclosure | reason strings echoing file content into CI logs | low | mitigate | Reasons echo rule ids, tags, scenario names, and the matched token only — never surrounding body text. Confirmed by reading the full rendered output of the `lint-hygiene` fixture (26 findings) during UAT 03 test 2. | closed |
| T-03-12 | Tampering | `lintSnapshot` mutating `snapshot.errors` so a second consumer sees stamped or dropped findings | low | mitigate | Spread-only merge; `packages/core/test/lint.test.ts:87` asserts the snapshot equals its `structuredClone` after two calls. | closed |
| T-03-08 | Denial of service | oversize tickets (R-02-04, R-02-07 carry-over) | low | mitigate | LINT-07 oversize warnings surface size discipline; hard limits deliberately out of scope (warning-only per D-57). | closed |
| T-03-13 | Tampering | generated template module drifting from `templates/` | low | mitigate | Drift test at `packages/core/test/templates.test.ts:126` compares the generated module to the on-disk template set and text. | closed |
| T-03-14 | Tampering | `<script>` or comment content scanned as CSS to create noise or hide a literal | low | mitigate | Comments and scripts blanked with newlines preserved before any matching (`packages/core/src/lint/tokens.ts:123`). | closed |
| T-03-15 | Information disclosure | `Derived from:` path probing the filesystem | low | mitigate | Existence is a membership test on `snapshot.tree` (`packages/core/src/lint/tokens.ts:220`); core never reads the path. | closed |
| T-03-06 | Tampering | placeholders or sentinels hidden inside HTML comments so lint stays silent | low | accept | By design — see Accepted Risks Log. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-A | T-03-03 | A contributor can hand-write a passing JUnit report. Detecting that is outside lint's scope; it belongs to Phase 4 gate design and to CI owning the report (R-03-01). Lint reports what the report says. | ngothanhluan | 2026-09-14 |
| R-03-B | T-03-06 | Sentinels and placeholders inside HTML comments are not linted, because D-73 puts template guidance in comments. Suppressing a finding this way means editing a comment a reviewer reads. | ngothanhluan | 2026-09-14 |
| R-03-C | T-03-01 (03-01 engine row) | The lint engine itself runs no regex, so the pathological-text risk lives entirely in the group rules, where it is mitigated per plan (03-02, 03-05, 03-06). No separate engine control. | ngothanhluan | 2026-09-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-14 | 16 | 16 | 0 | /gsd-secure-phase 3 (ASVS L1; short-circuit: register authored at plan time, threats_open 0) |

Two mitigations were strengthened during this run, both from UAT 03 test 3: the
prototype-chain `in` lookups behind T-03-09 and T-03-10 were replaced with
`Object.hasOwn`, closing a real bypass of T-03-09's stated control. Full suite:
390 tests passed, eslint clean, typecheck clean.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-14
