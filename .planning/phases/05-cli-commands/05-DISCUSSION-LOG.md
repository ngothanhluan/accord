# Phase 5: CLI Commands - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 05-cli-commands
**Areas discussed:** status output, Version pin, `ac_hash` write, `github-issues` adapter, repo root resolution, `new ticket` surface

---

## status output

### What a row contains

| Option | Description | Selected |
|--------|-------------|----------|
| Cheap traces | One full-repo lint for err/warn counts, plus `Ready —/ok/stale` and `Ticks n/m bound|stale` derived from `acHash()`. Never calls the gates. | ✓ |
| Document data only | id, title, type, status, parent, ui and finding counts. No gate-related column at all. | |
| Real gates for every ticket | Call `gateReady` + `gateDone` per ticket for true PASS/FAIL. | |
| Real gates behind `--gates` | Cheap by default, real gates behind a flag. Two output modes, two JSON shapes. | |

**User's choice:** Cheap traces.
**Notes:** Driven by a measurement taken during the discussion — `packages/core/src/gate/index.ts` calls `lintSnapshot(snapshot)` inside every gate invocation, so real gates for N tickets means N full-repo lints. Also noted that most in-flight tickets would render FAIL, making a correct column useless.

### Ordering and grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Flat by `(parent, id)` | Flat `StatusRow[]` with a `parent` column; children of one epic sit together. | ✓ |
| Flat by `id` | Code-point order on id alone. Simplest and most stable for goldens. | |
| Real nesting | Epic as a header row with children indented; JSON carries a tree or a `depth` field. | |

**User's choice:** Flat by `(parent, id)`.
**Notes:** `docs/design.md` §2 makes `parent:` the grouping axis, so the sort honours the model without forcing a tree into the JSON.

### Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Hide `archived`, add `--all` | Default shows draft and open; summary names how many were hidden. | ✓ |
| Print everything | No filter in v0.1. | |
| Accept id arguments | `accord status [<id>...]` plus hiding archived. | |

**User's choice:** Hide `archived`, add `--all`.
**Notes:** `docs/design.md` §6 anticipates "five hundred ticket files", so archived accumulation is certain rather than speculative.

---

## Version pin

This area opened with a documented conflict surfaced during context loading, presented to the user with its evidence: `REQUIREMENTS.md` CLI-06 and `ROADMAP.md` Phase 5 criterion 3 both demand a hard refusal at exit 2, while `.claude/CLAUDE.md` STACK Decision 6 says "warn (build profile) or fail (maintain)" and `PITFALLS.md` §11 hedges with "(or warns, per profile)".

### Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Hard refusal, exit 2 | Follow CLI-06 + ROADMAP criterion 3; record STACK Decision 6 as wrong and correct it. No bypass. | ✓ |
| Warn on build / fail on maintain | Keep STACK Decision 6; rewrite CLI-06 and the ROADMAP criterion to match. | |
| Hard refusal with an escape hatch | Exit 2 but add `ACCORD_SKIP_PIN=1` for emergencies. | |

**User's choice:** Hard refusal, exit 2.
**Notes:** Two arguments beyond document precedence were put to the user — the STACK rule inverts profile semantics (D-88 makes `maintain` the looser profile everywhere else), and a warning is precisely what an agent ignores, which is the failure mode `docs/design.md` §7 cites to justify having a CLI.

### Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Commands that read `config.yml` | `lint`, `gate ready`, `gate done`, `status`, `new ticket`. `--version` and `--help` exempt. | ✓ |
| Only `lint` and `gate` | Only verdict-producing commands blocked; `status` and `new ticket` warn. | |
| Every command | Including `--version`. | |

**User's choice:** Commands that read `config.yml`.
**Notes:** `--version` is exempt because it is the command used to diagnose the mismatch being reported; blocking it makes the error message unactionable. `new ticket` is not exempt because the template changes between versions.

### Comparison rule

| Option | Description | Selected |
|--------|-------------|----------|
| Exact string equality | `pin === pkg.version`. No semver library. | ✓ |
| Patch-compatible | `0.1.x` accepted. | |
| major.minor only | Loosest. | |

**User's choice:** Exact string equality.
**Notes:** The cost — every patch release forces every repo to edit `config.yml` — was stated and accepted as the discipline PITFALLS §11 asks for.

---

## `ac_hash` write

### When the write happens

| Option | Description | Selected |
|--------|-------------|----------|
| Always on PASS, no flag | PASS writes, FAIL never touches the file. | ✓ |
| Default write plus `--no-write` | Adds a dry run. | |
| Only with `--write` | Read-only by default. | |

**User's choice:** Always on PASS, no flag.
**Notes:** Two facts were verified before the question was asked — `gate.ac-hash-missing` is an error on both profiles (`packages/core/src/gate/rules.ts:75`), so Done can never pass unless Ready wrote the hash; and CLI-02 has CI run `lint` and `gate done`, not `gate ready`, which removes the "CI dirties the working tree" objection from the main path.

### Write failure

| Option | Description | Selected |
|--------|-------------|----------|
| exit 2, verdict still PASS | Print the real gate result, report the write failure, exit 2. | ✓ |
| Turn into fail, exit 1 | Treat as a gate failure. | |
| Warn only, exit 0 | Treat the write as incidental. | |

**User's choice:** exit 2, verdict still PASS.
**Notes:** A read-only file is an environment error under the exit-code contract STACK Decision 1 already defines. Exit 0 was rejected because CI would go green with `ac_hash` never recorded.

### `--json` output shape

| Option | Description | Selected |
|--------|-------------|----------|
| Core object verbatim | stdout is exactly `GateResult` / `LintResult` / `StatusRow[]`; everything else on stderr. | ✓ |
| Shared envelope | `{ command, version, exitCode, result }` for every command. | |
| Extra field on the object | Add `wrote:` to `GateResult`. | |

**User's choice:** Core object verbatim.
**Notes:** D-87 and D-60 already state that CI scripts and editor problem matchers bind to the core object's shape; an envelope would break that and force every consumer through `.result`.

---

## `github-issues` adapter

A constraint the user had flagged in the opening question was checked and closed before any option was presented: `PITFALLS.md` §12 explicitly permits spawning `git` and `gh` by name as `.exe` binaries, so calling `gh auth token` does not violate the "never spawn `.cmd`" rule in CLI-07.

### Fetch failure

| Option | Description | Selected |
|--------|-------------|----------|
| Soft degrade, out loud | Tracker cell shows `—`, one stderr line names the reason, exit code unchanged. | ✓ |
| No token means exit 2 | Treat a missing token as an environment error. | |
| Silently drop the column | No warning at all. | |

**User's choice:** Soft degrade, out loud.
**Notes:** `PROJECT.md`'s "nothing may require a tracker" and ROADMAP criterion 5's "the same result with or without the token" both point the same way. Silence was rejected because an empty cell would not distinguish "not linked" from "could not fetch".

### Request shape

| Option | Description | Selected |
|--------|-------------|----------|
| One request per linked ticket | `GET /repos/{o}/{r}/issues/{n}`, in parallel. | ✓ |
| List the whole repo | Paginated list endpoint plus an in-memory join. | |
| One GraphQL request | Single call for exactly N issues. | |

**User's choice:** One request per linked ticket.
**Notes:** The list endpoint also returns pull requests as issues and would load issues nothing references. The 5000/hour authenticated limit is far above pilot scale, and swapping to GraphQL later is a local change.

### Is a tracker id required?

| Option | Description | Selected |
|--------|-------------|----------|
| — | Free-text answer from the user. | ✓ |

**User's choice:** "ko require phải có github issue" — nothing may require a ticket to carry a GitHub issue, and nothing may require a token.
**Notes:** The user's first reply ("ko require cái này") was ambiguous between "do not require the token" and "drop the adapter from this phase"; the two readings were put back to them in plain text rather than guessed, and they clarified. The decision was then verified against the code rather than merely recorded: `tracker` is absent from `required` in `ticket.schema.json`, and `lint.tracker-empty` (D-22, `packages/core/src/lint/ticket.ts:53`) fires only when the key is present but empty. The behaviour the user asked for is already true; Phase 5 changes nothing.

### Token lookup order

| Option | Description | Selected |
|--------|-------------|----------|
| `GITHUB_TOKEN` first | Environment variable first; spawn `gh auth token` only when empty. | ✓ |
| `gh auth token` first | Prefer the logged-in identity; environment as fallback. | |
| `GITHUB_TOKEN` only | Never spawn `gh`. | |

**User's choice:** `GITHUB_TOKEN` first.
**Notes:** CI spends no spawn, and the variable gives an explicit override. `gh` missing from PATH is treated as no token, not an error.

---

## Repo root resolution

| Option | Description | Selected |
|--------|-------------|----------|
| `git rev-parse --show-toplevel` | Ask git; the CLI runs from any subdirectory. | ✓ |
| Walk up from cwd looking for `accord/` | No extra spawn. | |
| Require cwd to be the root | Least code. | |

**User's choice:** `git rev-parse --show-toplevel`.
**Notes:** Presented as a correctness matter rather than convenience — `git ls-files` run from a subdirectory lists only that subdirectory, so a root that is not the git top-level yields an incomplete `snapshot.tree` and D-82 evidence resolution for paths outside `accord/` fails silently. The extra spawn is free because the loader already makes git a hard precondition.

---

## `new ticket` surface

| Option | Description | Selected |
|--------|-------------|----------|
| `<id>` + `--type epic\|story\|bug` | `epic` renders `epic.md`; others render `ticket-<profile>.md`. Substitutes `TICKET-ID` and sets `type:`. | ✓ |
| `<id>` only | Always the profile template; no way to reach `epic.md`. | |
| `<id>` + `--type` + `--title` | Also fills the title at creation. | |

**User's choice:** `<id>` + `--type`.
**Notes:** The `@ac-1` scaffolding ROADMAP criterion 1 asks for is already present in both ticket templates, so the command substitutes rather than generates. `--title` was rejected as saving one edit in a file the BA opens to edit anyway.

---

## Claude's Discretion

Recorded in full in `05-CONTEXT.md` under `### Claude's Discretion`. Summary: CLI module layout; `StatusRow` field names, column widths and truncation; epic rows rendering `—` in the gate-trace columns; the empty-repository message; exact wording of the pin, write-notice and tracker messages; the exit code for `new ticket` refusing to overwrite; concurrency bound for the parallel issue requests; whether the pin comparison lives in core or the CLI; and the fixture and spawn-test layout.

## Deferred Ideas

Recorded in full in `05-CONTEXT.md` under `<deferred>`. Summary: `--gates` on `status`; GraphQL batching for the tracker adapter; caching tracker responses; `accord upgrade`; `--title` on `new ticket`; `--no-write`/`--write` on `gate ready`. Plus the two reviewed-but-not-folded todos (`mcp-host-spike.md`, `rejected-alternatives-have-no-home.md`).

One item listed under Deferred is **in scope** for this phase and appears there only so it is not lost: correcting the "Version pin" row of STACK Decision 6 in `.claude/CLAUDE.md`, which D-94 requires.
