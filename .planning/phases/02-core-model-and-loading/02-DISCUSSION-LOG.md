# Phase 2: Core Model and Loading - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-06
**Phase:** 02-core-model-and-loading
**Areas discussed:** Snapshot input contract, Broken files and validation boundary, Body extraction rules, Tick write and scenario shape, Filesystem loader in the CLI, Finding shape, Fixtures and goldens, Core public API

Discussion was held in Vietnamese; options are recorded here in English.

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Keep after Phase 4 | Phase 2 only designs the input so the GitHub-API host can build it | ✓ |
| Fold into Phase 2 | Run the serverless bundling spike now | |

**User's choice:** Keep `mcp-host-spike.md` scheduled after Phase 4.

---

## Snapshot input contract

| Option | Description | Selected |
|--------|-------------|----------|
| Flat map path→text, sync | `{ files: Record<posixPath, string> }`, pure sync `loadSnapshot` | ✓ |
| Sync `list()/read()` interface | Core calls back into the host per file | |
| Async interface | Whole core becomes async | |

| Option | Description | Selected |
|--------|-------------|----------|
| Repo-root keys, core normalises `\` | `accord/tickets/X.md`; backslashes and `./` normalised | ✓ |
| Keys relative to `accord/` | Tokens file and evidence outside the folder have no place | |
| Repo-root keys, reject backslash | Input error on `\` | |

| Option | Description | Selected |
|--------|-------------|----------|
| `config.yml` inside the map, core parses | Errors to `snapshot.errors`, host decides exit 2 | ✓ |
| Host passes a typed `AccordConfig` | Both hosts repeat parse and validate | |

| Option | Description | Selected |
|--------|-------------|----------|
| `files` + `tree` now | `tree` is a content-free path list for GATE-04 | ✓ |
| Phase 4 adds it | Contract and goldens change later | |

**User's choice:** All four recommended options.

---

## Broken files and validation boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Keep entry + errors | Keyed by file stem; typed frontmatter only when valid | ✓ |
| Drop ticket, record error only | Ticket absent from the map | |

| Option | Description | Selected |
|--------|-------------|----------|
| Loader validates, with line numbers | JSON pointer mapped to YAML node | ✓ |
| Phase 3 lint validates | Loader keeps raw object | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fences under `## Acceptance criteria`, several allowed | Fences elsewhere ignored; each parsed separately | ✓ |
| Every fence in the body | ARCHITECTURE.md's "concatenate all" | |
| Exactly one fence | Second fence is an error | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore stray files, error on orphan verification | `tickets/<id>/verification.md` without its ticket is an error | ✓ |
| Warn on every unknown file | | |

**User's choice:** Asked "which cases count as broken?" before answering the first question. The six cases (no frontmatter block, YAML syntax error, non-map YAML, schema failure, id/file-name mismatch, duplicate id) plus body failures were laid out; the user accepted the rule that cases 1 to 4 keep the entry with `frontmatter` undefined and no partial object, and that cases 5 and 6 belong to Phase 3 lint.

---

## Body extraction rules

| Option | Description | Selected |
|--------|-------------|----------|
| Every non-blank line, comments and fences removed, list marker stripped | Plain lines and bullets are both requirements | ✓ |
| List items only | Plain lines ignored | |
| Plain lines only | Bullets forbidden | |

| Option | Description | Selected |
|--------|-------------|----------|
| Error at second heading, first section used | | ✓ |
| Merge both | | |
| Last wins | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive heading match | Trim, collapse whitespace, drop trailing `#` | ✓ |
| Exact match | Deviation counts as a missing heading | |

| Option | Description | Selected |
|--------|-------------|----------|
| `Result:` required, `Evidence:` free text | Missing or invalid Result is a loader error | ✓ |
| Everything optional | Phase 3 and 4 check | |

**User's choice:** All four recommended options.

---

## Tick write and scenario shape

| Option | Description | Selected |
|--------|-------------|----------|
| Block list | One tag per line; empty is `verified: []` | ✓ |
| Flow `[ac-1, ac-2]` | One line, D-03 notation | |

| Option | Description | Selected |
|--------|-------------|----------|
| Generic `setFrontmatterKey` | Keeps `verified` last, inserts new keys before it | ✓ |
| One function per key | `setVerified`, `setAcHash` | |

| Option | Description | Selected |
|--------|-------------|----------|
| Always double-quote written strings | Including tags in `verified` | ✓ |
| Let `yaml` decide | Plain when safe under YAML 1.2 | |
| Quote strings, tags plain | Two rules | |

| Option | Description | Selected |
|--------|-------------|----------|
| Extra tags allowed and ignored | Loader keeps `tags[]` and `acTag` | ✓ |
| Only `@ac-n` | Other tags are a Phase 3 finding | |

Second round (user asked for more questions on this area):

| Option | Description | Selected |
|--------|-------------|----------|
| Background steps merged into each scenario and the hash | | ✓ |
| Background ignored | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Scenario name not in hash input | Rename does not change the hash | ✓ |
| Name in hash | | |

| Option | Description | Selected |
|--------|-------------|----------|
| `Rule:` supported, scenarios collected | Rule name ignored | ✓ |
| `Rule:` unsupported | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Honour `# language:` per fence, default `en` | Keyword normalised to English | ✓ |
| English only | | |

**User's choice:** All recommended options. The user asked what a `Background:` is; after an example showing two scenarios sharing `Given` preconditions, they confirmed "gộp" (merge).

---

## Filesystem loader in the CLI

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2, `packages/cli`, `git ls-files` | `--cached --others --exclude-standard`; no git is exit 2 | ✓ |
| Phase 2, `packages/cli`, own walk | Hard-coded ignore list | |
| Leave to Phase 5 | Phase 2 is core and fixtures only | |

**User's choice:** Recommended option.

---

## Finding shape

| Option | Description | Selected |
|--------|-------------|----------|
| One type, change now | `{ file, line?, rule, reason, pointer? }`; update Phase 1 goldens | ✓ |
| Separate `LoadError` | Phase 1 `Finding` untouched | |

**User's choice:** Recommended option.

---

## Fixtures and goldens

| Option | Description | Selected |
|--------|-------------|----------|
| LF fixture folders, in-memory variants, one golden per snapshot | CRLF/BOM/backslash derived in the test | ✓ |
| Commit each variant | `crlf-*`, `bom-*` files in the repo | |
| In-memory variants, golden per ticket | | |

**User's choice:** Recommended option.

---

## Core public API

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | `loadSnapshot`, `setFrontmatterKey`, types, existing exports | ✓ |
| Export individual parsers | `parseFrontmatter`, `extractScenarios`, `sections` | |

**User's choice:** Recommended option.

---

## Claude's Discretion

Module layout under `packages/core/src/`, the `Section` model and sub-heading handling, `steps` normalisation details, how `ui` defaults to `false`, golden key ordering, the fixture set, and `execFile` vs `spawnSync` for `git`.

## Deferred Ideas

Recorded in CONTEXT.md `<deferred>`: id/file-name and duplicate-id checks (Phase 3), tag-count findings (Phase 3), evidence syntax (Phase 4), hash algorithm (Phase 4), heading-casing lint (rejected), stray-file warnings (rejected for v0.1), partial frontmatter for `status` (rejected), `mcp-host-spike.md` (after Phase 4).
