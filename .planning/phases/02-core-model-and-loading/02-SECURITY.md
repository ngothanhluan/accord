---
phase: "02"
slug: "core-model-and-loading"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-13"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repository content → `loadSnapshot` | Untrusted Markdown, YAML, and Gherkin authored by any contributor (or fetched from GitHub by the MCP host) reach three parsers | ticket bodies, frontmatter, `config.yml`, `verification.md` |
| snapshot keys → model paths | Host-supplied path strings are normalised and echoed into `Finding.file` and `Ticket.file`; any path under `accord/` decides what is a ticket or a record | path strings |
| frontmatter / `config.yml` text → `yaml.parseDocument` | Untrusted YAML | scalars that could be mistyped as booleans, numbers, dates |
| ticket body → `scan` / `requirementLines` | Untrusted Markdown with arbitrary fences and comments | headings, EARS lines |
| fence text → `@cucumber/gherkin` parser | Untrusted Gherkin, possibly in any dialect | scenarios, steps |
| `verification.md` text → `parseVerification` | Written by the review context; untrusted like any file | results, evidence |
| caller value → YAML text (`setFrontmatterKey`) | Strings from gate/CLI/MCP callers become YAML scalars in a file other tools read | `ac_hash`, `verified` tags |
| `config.yml design.tokens` → filesystem read | A repo-authored string chooses a file to read into the snapshot | one file's contents |
| CLI → `git` child process | Fixed argv; `root` is the cwd, not an argument | tracked and untracked path list |
| working tree → `files` | Every file under `accord/` is read as UTF-8 text | file contents |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Denial of service | `splitFrontmatter` regex, `scan`, `requirementLines` | low | mitigate | `FRONTMATTER` is anchored at `^` with one lazy group (`frontmatter.ts:9`); `scan` is a single pass over lines with `FENCE_OPEN` per line (`sections.ts:25-39`); parsers are upstream `yaml` and `@cucumber/gherkin` | closed |
| T-02-02 | Tampering | YAML implicit typing (`no`, `1e3`, dates) | medium | mitigate | `parseDocument(…, { schema: 'core', customTags: stringNumerics })` (`yaml.ts:7,20`); `valid-build.snapshot.json:92,319` pins `"1e3"` and `"2026-09-01"` as strings | closed |
| T-02-03 | Information disclosure | `Finding.reason` echoing YAML/gherkin parser messages | low | accept | R-02-01 | closed |
| T-02-04 | Elevation of privilege | `yaml` custom tags / code execution | low | mitigate | YAML 1.2 core schema only; `customTags` filter removes tags, never adds (`yaml.ts:7`); `yaml` 2.x ships no `!!js/*` tags | closed |
| T-02-05 | Tampering | path keys with `..` or absolute paths | low | accept | R-02-02 | closed |
| T-02-06 | Tampering | YAML implicit typing turning `no`/`0123`/dates into booleans/numbers/Dates | medium | mitigate | Same seam as T-02-02; `frontmatter-errors.snapshot.json:183-185` pins `"1e3"` and `"0123"` preserved | closed |
| T-02-07 | Denial of service | pathological YAML (deep nesting, aliases) | low | accept | R-02-03 | closed |
| T-02-08 | Information disclosure | `Finding.reason` from yaml/ajv | low | accept | R-02-01 | closed |
| T-02-09 | Tampering | a fence or comment used to hide a heading or smuggle a fake requirement | medium | mitigate | Fence state in `scan` (`sections.ts:33-39`) and `<!--` comment stripping (`sections.ts:118`); `body-edges.snapshot.json` pins fenced fakes and an unterminated fence never becoming sections or requirements | closed |
| T-02-10 | Denial of service | very long bodies | low | accept | R-02-04 | closed |
| T-02-11 | Tampering | scenario identity keyed on mutable names | medium | mitigate | Identity is the `@ac-n` tag (`AC_TAG`, `gherkin.ts:16,32`); names are display only; `gherkin-shapes.snapshot.json` pins untagged scenarios carry no invented id | closed |
| T-02-12 | Tampering | hash input omitting Background or Examples so an AC edit goes unnoticed | medium | mitigate | `steps = [...background, ...sc.steps]` plus collapsed Examples rows (`gherkin.ts:33-36,53`); `gherkin.test.ts` D-48 contract tests | closed |
| T-02-13 | Denial of service | pathological fence content | low | accept | R-02-04 | closed |
| T-02-14 | Repudiation | a record naming no ticket, or a `Result:` outside the three values, passing as evidence | medium | mitigate | `load.result-invalid` with `result` absent (`verification.ts:31-37`); `load.verification-orphan` (`snapshot.ts:100`); `verification-edges.snapshot.json` pins both | closed |
| T-02-15 | Spoofing | `tickets/<id>/verification.md` for an id whose ticket differs only in case | low | accept | R-02-05 | closed |
| T-02-16 | Tampering | HTML comments used to hide text inside evidence | low | mitigate | Comment stripping shared with sections (`sections.ts:118`); `verification-edges` golden pins `<!-- bỏ qua -->` removed from `evidence` | closed |
| T-02-17 | Tampering | YAML injection via a value containing `: `, `#`, or newlines | medium | mitigate | Every written string is `Scalar.QUOTE_DOUBLE` (`write.ts:30,33`); `write.test.ts:71-72` proves `x: y\nz # c` serialises as one quoted scalar | closed |
| T-02-18 | Tampering | a write reordering or dropping BA-owned keys/comments | medium | mitigate | Single-pair edit with `verified` kept last (`write.ts:54-60`); three full-text Markdown goldens and the comment-line-set assertion in `write.test.ts` | closed |
| T-02-19 | Tampering | YAML 1.1 readers misreading `no`/`007` tags written plain | low | mitigate | Double quotes on every written string (`write.ts:30,33`); booleans are the only plain scalars | closed |
| T-02-20 | Information disclosure | `design.tokens` set to `../../.ssh/id_rsa` or an absolute path pulls a file outside the repo into the snapshot | high | mitigate | `tokensPath` rejects `''`, `..`-prefixed, and absolute `relative(root, abs)` results (`fs.ts:52-57`); `load.test.ts:98` "skips a tokens path outside the repository" | closed |
| T-02-21 | Elevation of privilege | shell injection through the spawn | medium | mitigate | `execFileSync('git', [literal argv])` with no `shell` option (`fs.ts:22`); `root` is `cwd`, never an argument; Plan 02-07 Task 1 grep forbids `npx`, `npm`, `.cmd`, `shell: true` in `fs.ts` | closed |
| T-02-22 | Tampering | a malicious `git` earlier on PATH | low | accept | R-02-06 | closed |
| T-02-23 | Denial of service | huge binary under `accord/` read as utf8 | low | accept | R-02-07 | closed |
| T-02-SC | Tampering | npm installs (supply chain) | high | mitigate | No package added in Phase 2: `git diff --stat 48e56d7 HEAD -- package-lock.json package.json packages/*/package.json` is empty; the only commit touching those files since 2026-09-06 is the Phase 1 commit `b60d3f5` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-03, T-02-08 | Parser and ajv messages name keys, positions, and allowed values, never file contents beyond the offending token, and are shown to the author of that file | plan author (02-01, 02-02) | 2026-09-06 |
| R-02-02 | T-02-05 | Core never touches a filesystem; keys are opaque strings matched against `^accord/tickets/...`; path containment is owned by the CLI loader (T-02-20, closed) | plan author (02-01) | 2026-09-06 |
| R-02-03 | T-02-07 | `yaml` 2.x has no alias-expansion bomb and no merge-key expansion by default; frontmatter is bounded by the strict schema | plan author (02-02) | 2026-09-06 |
| R-02-04 | T-02-10, T-02-13 | Linear single-pass scanner with no whole-body backtracking regex; upstream Gherkin parser is linear over tokens; body size discipline is a Phase 3 lint concern | plan author (02-03, 02-04) | 2026-09-06 |
| R-02-05 | T-02-15 | Keys are matched exactly; id case-sensitivity is a Phase 3 lint concern (D-34) | plan author (02-05) | 2026-09-06 |
| R-02-06 | T-02-22 | The developer's PATH is trusted by every tool on the machine; covered by OS and endpoint security, not by accord | plan author (02-07) | 2026-09-06 |
| R-02-07 | T-02-23 | The convention holds Markdown and one CSS file; size limits are a Phase 3 lint concern | plan author (02-07) | 2026-09-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-13 | 24 | 24 | 0 | secure-phase (L1 grep-depth; register authored at plan time; no auditor spawn needed) |

Every SUMMARY's `## Threat Flags` section reads "None" beyond the plan register, so no threats were added at execution time.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-13 (commit pending owner review)
