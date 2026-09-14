# Phase 4: Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 04-gates
**Areas discussed:** AC hash & tick binding, Host-supplied facts & skipped checks, Evidence & verification notes, Result shape / profile matrix / ac_hash write, GATE-09 and verification.md edge cases

---

## AC hash & tick binding

### Hash algorithm for `ac_hash`

| Option | Description | Selected |
|--------|-------------|----------|
| FNV-1a 64-bit with prefix | ~10 pure lines, synchronous, no dependency; stored as `fnv1a64:<16 hex>` so a future algorithm change fails loudly | ✓ |
| FNV-1a 64-bit bare | 16 hex characters only; shorter, but old and new hashes become indistinguishable | |
| SHA-256 via `@noble/hashes` | Familiar, audited, zero-dep — but a dependency for a job that needs no cryptographic strength, and 64 characters in frontmatter | |

**User's choice:** FNV-1a 64-bit with prefix (D-75).
**Notes:** Framed as a change detector rather than a security boundary — `ac_hash` sits in a file the developer can already edit, so collision resistance buys nothing. Web Crypto `subtle.digest` was ruled out before the question: its `await` would make `gateReady`/`gateDone` async and contaminate the Phase 5 CLI.

### Where the tick's AC hash + commit sha binding lives

| Option | Description | Selected |
|--------|-------------|----------|
| Two shared scalars | `verified_hash` + `verified_commit`; `verified` stays a flat array. `setFrontmatterKey` unchanged | ✓ |
| `verified` becomes a list of objects | `[{ac, hash, commit}]` — catches tick laundering, but a human would hand-type 16 hex per scenario and Phase 1–2 templates, fixtures, and goldens all change | |
| Binding inside the `### @ac-n` notes blocks | Per-tick and no schema change, but a new body format and the tick splits from its binding across two places | |

**User's choice:** Two shared scalars (D-76).
**Notes:** The decisive analysis: GATE-02 requires three-set equality so Done only passes with every scenario ticked, and GATE-11 requires every tick's commit to equal the gated commit — so at Done all ticks necessarily share one hash and one commit, and per-tick storage returns the identical verdict on every honest use. The only residual is a developer relabelling an older tick by editing one value, which sits inside the ceiling `docs/design.md` §5 states for itself. Phase 5 ships no `accord tick` command, so a hand-typed hash was a real cost.

### What goes into the hash input, in what order

| Option | Description | Selected |
|--------|-------------|----------|
| `acTag` + `steps`, sorted by acTag | Catches an `@ac-n` swap, ignores scenario reordering, leaves `@test:`/`@smoke` outside as D-69 intended | ✓ |
| `steps` only, document order | Literal reading of D-48; misses the tag swap and fails Done when a scenario merely moves | |
| `acTag` + `steps`, document order | Catches the swap but treats scenario order as meaningful, so tidying the AC forces a full re-verification | |

**User's choice:** `acTag` + `steps`, sorted by acTag (D-77).
**Notes:** Raised as a hole found by reading D-48 and D-69 together — swapping `@ac-1` and `@ac-2` between two scenarios changes no `steps` byte, so the hash would not move while every note and evidence block silently re-points at different behaviour. D-69's actual motivation was `@test:`, not `@ac-n`.

### Not asked — settled by the above

Re-running Ready after an AC edit does not need to clear `verified`, because `verified_hash` still holds the old value and D-76 catches it; and a non-empty `verified` missing its binding keys fails Done, there being no v0.1 users to keep compatible.

---

## Host-supplied facts & skipped checks

### How the gated commit and git authors reach core

| Option | Description | Selected |
|--------|-------------|----------|
| `git?` on `SnapshotInput` | `{ commit, authors }` rides the snapshot as `tests` does under D-72; golden coverage free, one value for Phase 5 to thread | ✓ |
| Second host parameter on the gate functions | Keeps `RepoSnapshot` as file content, but Phase 5 threads two values and gate fixtures need a mechanism outside the existing golden | |

**User's choice:** `git?` on `SnapshotInput` (D-78).
**Notes:** Noted that the gated commit cannot come from `verification.md` — design.md requires that file's `commit:` to *equal* the gated commit, so comparing it with itself is vacuous. Also noted that the "snapshot is file content only" line was already crossed by D-65 and D-72.

### What GATE-05 compares

| Option | Description | Selected |
|--------|-------------|----------|
| `verification.md` author vs gated-commit author | One `git log -1` plus one `git show -s`; well defined and independent of GATE-04 | ✓ |
| Whole-tree authors vs the files evidence names | Most precise, but a full `git log` walk and GATE-05 becomes dependent on GATE-04's extraction | |
| Informational only, never a finding | Admits the check cannot discriminate in the current design; GATE-05 then carries no weight | |

**User's choice:** `verification.md` author vs gated-commit author (D-79).
**Notes:** Raised as a finding first: `REQUIREMENTS.md` GATE-05 warns when implementation and evidence share an author, while `docs/design.md` §4 has the review written by a fresh agent context on the developer's own machine and committed by them — so the authors match by construction and the warning fires on nearly every honest ticket. The user accepted that, on the grounds that the warning's statement stays true in a solo workflow.

### `gate done` when `config.yml` declares no `tests.report`

| Option | Description | Selected |
|--------|-------------|----------|
| Fail Done | No report means no Machine layer, and GATE-06 forbids a bypass; reason `gate.tests-unconfigured` | ✓ |
| Skipped, Done still passes | Literal reading of GATE-08's host clause, but deleting one config line routes around the whole Machine layer | |
| Skipped when the key is absent, fail when the file is absent | Middle reading — rejected as rewarding never switching the layer on | |

**User's choice:** Fail Done (D-80).
**Notes:** Raised as the heavier of the two findings: with the CLI as the only host (the owner recorded in Phase 3 that the MCP server is no longer needed), "host cannot supply the report" reduces to "nobody declared it", and only `lint.report-missing` — a warning, which does not change the exit code — watched that door.

### How two commit shas are compared

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix match, minimum 7 hex | Case-insensitive; shorter must prefix longer; under 7 fails as too short. Matches how git abbreviates | ✓ |
| Exact 40-character match | No grey area, but a human would hand-type 40 hex and every abbreviated template value fails | |
| Truncate both to 7 | Simplest, but discards information: two different shas sharing seven characters would compare equal | |

**User's choice:** Prefix match, minimum 7 hex (D-81).
**Notes:** Three sources must agree — host (40 chars), agent-written `verification.md`, human-written `verified_commit` — and the model's own example is `commit: '1234567'`. A missing `git.commit` fails Done by the same no-bypass reasoning as D-80.

---

## Evidence & verification notes

### How GATE-04 extracts and resolves references

| Option | Description | Selected |
|--------|-------------|----------|
| Path-shaped tokens, suffix match | Candidate = token with `/` or a file extension, plus any `snapshot.tests` key; resolves as a segment-boundary suffix of a `tree` path. No format change | ✓ |
| Path-shaped tokens, exact match | No grey area, but `login.spec.ts` at `test/login.spec.ts` fails and every writer must spell the full path | |
| Backtick-marked spans only | Most precise about intent, but a new FMT rule to teach in template and skill text, and all existing evidence fails | |

**User's choice:** Path-shaped tokens, suffix match (D-82).
**Notes:** Grounded on the real fixture text — `npm test -- login.spec.ts` and `test/login.spec.ts covers the happy path` in `valid-build`, and `dòng một / dòng hai / dòng ba` plus `chạy npm test` in `verification-edges`. Suffix matching answers the question actually being asked: does the file exist, not was the path spelled from the root.

### Scope of GATE-04, and unresolved path-shaped tokens

| Option | Description | Selected |
|--------|-------------|----------|
| Per block, ≥1 match; stray token → warning | Whole `## @ac-n` block needs one resolving reference; an unresolvable path-shaped token warns by name | ✓ |
| Per line, literal reading | Strictest, but bans the context sentence — the most natural way a human opens an evidence note | |
| Per block, every token must match | Catches deleted files and typos, but fails a writer who cited real evidence and mistyped one character | |

**User's choice:** Per block, ≥1 match; stray → warning (D-83).
**Notes:** Compared on three concrete evidence samples; the per-line reading fails a legitimate "context line then citation" and the every-token reading fails a one-character typo beside a valid citation.

### What "symbol present in the snapshot" means in GATE-10

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the GATE-04 rule | The requirement's own parenthetical says "(the GATE-04 rule)"; one rule, one meaning; the writer must name a file | ✓ |
| Accept identifier-shaped tokens unchecked | Easier to write, but any capitalised mid-sentence word passes and the check becomes ceremonial | |
| Load source text into the snapshot | Honest to the word "symbol", but the D-54 golden serialises the whole snapshot, so every fixture grows by megabytes | |

**User's choice:** Reuse the GATE-04 rule (D-84).
**Notes:** Core cannot check symbols — `snapshot.files` holds only prototypes, the tokens file, and the JUnit report under D-65, never source. The consequence that a note must name a file was treated as the point, not the cost.

### The "note is not the scenario pasted back" test

| Option | Description | Selected |
|--------|-------------|----------|
| Strip references, then compare | Remove resolving references, normalise the remainder, fail when empty or a substring of the scenario. No threshold | ✓ |
| Literal reading of the requirement | Simplest, but passes the cheapest dodge: paste the scenario, append a path | |
| Bidirectional substring test | Blocks paste-and-pad, but fails a legitimate note that quotes the scenario then explains | |

**User's choice:** Strip references, then compare (D-85).
**Notes:** Compared across five note samples. The chosen rule also fails a bare path with no words, since stripping leaves an empty string. Normalisation preserves Vietnamese diacritics — Vietnamese content is the expected case and folding them would manufacture false matches. GATE-10's own reasoning against a character floor ruled out every threshold-based option before the question was put.

---

## Result shape, profile matrix, `ac_hash` write

### How `gate ready` writes `ac_hash` while core stays pure

| Option | Description | Selected |
|--------|-------------|----------|
| Result carries `acHash` | `gateReady` stays pure; Phase 5 calls `setFrontmatterKey` and writes only on pass | ✓ |
| Result carries the rewritten file text | One place for the transform, but the whole file body lands in the object Phase 5 serialises for CI | |
| Write callback passed into `gateReady` | Inversion of control that costs purity and testability and buys nothing over option 1 | |

**User's choice:** Result carries `acHash` (D-86).
**Notes:** `acHash` is computed whether the verdict passes or fails; "write only on pass" is Phase 5's rule, not core's.

### Shape of `GateResult`

| Option | Description | Selected |
|--------|-------------|----------|
| `Finding[]` + verdict | `{ gate, ticket, verdict, findings, acHash? }` with `gate.*` ids, rendered by the existing `renderText`; verdict fails iff an error-level finding exists | ✓ |
| `GateCheck[]` with per-check status | Shows checks that passed, but needs a new renderer, new goldens, and two output shapes in Phase 5 | |
| `LintResult` plus a verdict flag | Least code, but no home for `acHash`, `gate`, or `ticket`, so Phase 5 wraps it anyway | |

**User's choice:** `Finding[]` + verdict (D-87).
**Notes:** Flagged as the class D-56 and D-60 already marked costly to reverse — once Phase 5 prints it under `--json`, CI scripts and problem matchers bind to the shape. Option 2 was rejected as building for a consumer that does not exist in v0.1.

### How GATE-07's profile matrix ships

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the mechanism, empty data | Gate rule table with a profile column plus a `maintain` downgrade list naming token and size ids; inert in v0.1, one cell to edit in v2 | ✓ |
| Promote token and size to blocking on `build` | Makes GATE-07 testable by fixture, but pulls GATE-12 forward and lets one hard-coded colour block a story from the sprint | |
| Drop the mechanism in v0.1 | Least code, but GATE-07 is then unimplemented and v2 rebuilds it from scratch | |

**User's choice:** Keep the mechanism, empty data (D-88).
**Notes:** Raised as the third finding: GATE-07 says `maintain` downgrades token and size rules while `build` keeps them "as configured", but D-57 already made both warnings on both profiles and Phase 3 deferred the token rule as an error to GATE-12. So the downgrade downgrades something already downgraded — the mechanism runs correctly and changes nothing. Consequence recorded: ROADMAP criterion 5 is proved by a unit test on the downgrade function, not a fixture, because no v0.1 fixture can distinguish the profiles on these rules.

### Which findings block `gate ready`

| Option | Description | Selected |
|--------|-------------|----------|
| Every error finding + LINT-06 | Any error-level finding in ticket scope, the three LINT-06 rules promoted to blocking, plus the design-reference check. New error rules block automatically | ✓ |
| An explicit list of blocking rule ids | Readable at a glance, but two tables must stay in sync and a later error rule silently fails to block Ready | |

**User's choice:** Every error finding + LINT-06 (D-89).
**Notes:** A third option — block on every finding regardless of level — was presented and ruled out in the same breath, since `lint.vague-wording` must never block Ready per `docs/design.md` §5. Ticket scope is `accord/tickets/<id>.md`, `accord/tickets/<id>/`, and `accord/assets/<id>/`. An unparseable `config.yml` is the exit-2 branch, not a fail verdict. The design-reference rule was not asked because `docs/design.md` §5 already specifies it fully.

---

## GATE-09 and verification.md edge cases

### Does a `@ui` scenario need a stricter note rule

| Option | Description | Selected |
|--------|-------------|----------|
| No — the same D-85 rule | GATE-09 is the GATE-08 exemption and nothing more; "stricter" contrasts the Human layer with the Machine layer, as `docs/design.md` §5 puts it without the word | ✓ |
| Yes — must name the prototype or design reference | Anchors on what the reviewer looked at, but D-69 makes the `@ui` scenario tag independent of frontmatter `ui:`, so the rule is unsatisfiable on a ticket with no prototype | |
| Yes — at least two references | Always satisfiable, but 2 is the arbitrary threshold GATE-10 explicitly forbids | |

**User's choice:** No — the same D-85 rule (D-90).
**Notes:** Raised as a fourth finding: GATE-09 says a `@ui` scenario "requires the stricter human note of GATE-10", but GATE-10 already applies to every ticked scenario, so the word points at no distinct rule. A `@ui` scenario still needs an evidence block, a bound tick, and a note — it is exempt from the test layer only.

### Verification.md edge cases — checked, already decided, not asked

Three candidate questions dissolved on reading `packages/core/src/load/verification.ts`:

- Two `## @ac-1` blocks with different results — the loader already applies D-40/D-42: the first block carrying a tag wins, later ones are skipped with a duplicate-heading finding.
- A block with a missing or invalid `Result:` (the fixture's `Result: PASS`) — already produces `load.result-invalid`, which D-58 stamps `error`, so D-89's scope rule fails the gate with no new rule.
- `Result: blocked` and `Result: fail` — both stated in `docs/design.md` §5 and ROADMAP Phase 4 criterion 2; not a choice.

---

## Claude's Discretion

- Module layout under `packages/core/src/gate/`, and whether the shared reference extraction lives there or beside the lint token rule that already resolves `Derived from:` paths.
- The recognised file-extension set, punctuation stripping, and trailing `:42` handling for D-82 candidates.
- GATE-02's exact reason text, provided it names which tags are missing from which of the three sets.
- `gate.*` rule id names, and whether Ready and Done share one table or hold two.
- The `authors` key set and identity format (email versus name).
- The Phase 4 fixture set, including fixing `valid-build` — its evidence cites `test/login.spec.ts`, which is not in its tree, so it cannot pass GATE-04 as it stands.
- Whether the ticket templates gain commented `verified_hash` / `verified_commit` guidance.

## Deferred Ideas

- GATE-12 (token rule as an error on `build`) — v2; the mechanism ships now, only the table data changes.
- GATE-13 (author check via the GitHub commits API) — v2; revisit with the GATE-05 finding under D-79.
- Per-tick binding as a list of objects — revisit only if an `accord tick` command exists to write the hash.
- Loading source text into the snapshot so GATE-10 can check symbols — revisit only if something else needs source in the snapshot.
- A `@ui`-specific note rule — revisit if pilot UI tickets collect weak notes.
- `GateCheck[]` reporting of passed checks — revisit when a dashboard or hub consumes gate output.
- MCP server removal — carried forward unchanged from Phase 3; a roadmap-level change for `/gsd-phase`.
