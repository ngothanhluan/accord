# Phase 4: Gates - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

`gateReady(snapshot, id)` and `gateDone(snapshot, id)` are pure functions over the Phase 2 `RepoSnapshot` that return one `GateResult` each: a verdict, the reasons listed by rule id, and the computed AC hash. They apply the build/maintain matrix, offer no bypass, and write nothing. Phase 4 also lands the frontmatter additions the tick binding needs (`verified_hash`, `verified_commit`) and the host-fact channel the commit and author checks need (`SnapshotInput.git`).

In scope: GATE-01 to GATE-11. Not in scope: commander commands, colour, and exit codes as process behaviour (Phase 5); skill text (Phase 6); GATE-12 (token rule as error) and GATE-13 (author check via the GitHub commits API), both v2.

Decision numbering continues from Phase 3 (D-01 to D-74).

</domain>

<decisions>
## Implementation Decisions

### AC hash (GATE-01, GATE-03)

- **D-75:** `ac_hash` is FNV-1a 64-bit, written as `fnv1a64:<16 lowercase hex>`. The hash is a change detector, not a security boundary — `ac_hash` lives in a file the developer can edit, so collision resistance buys nothing that editing the field does not already defeat. FNV-1a is ~10 pure lines, synchronous, and needs no dependency; Web Crypto `subtle.digest` was rejected because its `await` would make `gateReady`/`gateDone` async and contaminate the Phase 5 CLI for one 40-byte computation. The algorithm prefix makes a future change fail loudly instead of comparing silently wrong. — **Reversibility:** costly — the value is written into ticket files that outlive the release, so changing the algorithm invalidates every recorded hash.
- **D-77:** Hash input is, per scenario carrying an `@ac-n` tag, the tag (`ac-n`) followed by that scenario's `steps` (D-48 guarantees the content is stable and complete), with the scenarios sorted by the numeric part of the tag before joining. This clarifies D-48 and narrows D-69: `@ac-n` is inside the hash, every other tag (`@test:`, `@ui`, `@smoke`) stays outside, so D-69's motivation — a developer adds `@test:` after Ready without changing `ac_hash` — is preserved. Untagged scenarios are excluded (they are already `lint.ac-tag-missing`, an error). Rationale for each half: with the tag outside, swapping `@ac-1` and `@ac-2` between two scenarios leaves the hash unchanged while re-pointing every note and evidence block at different behaviour; with document order as the join order, moving a scenario down the file fails Done without a character changing, and Gherkin scenario order carries no meaning.
- **D-86:** `gateReady` stays pure and returns `acHash` in its result, computed whether the verdict passes or fails. Phase 5 calls the existing pure `setFrontmatterKey` (D-43, which already honours D-44/D-45) and writes the file only when the verdict is pass. Returning the rewritten file text was rejected because Phase 5 serialises the result for CI under `--json`; a write callback was rejected as inversion of control that costs purity and buys nothing.

### Tick binding (GATE-11)

- **D-76:** The tick's binding lives in two new frontmatter scalars, `verified_hash` and `verified_commit`; `verified` stays the flat `ac-n` string array it is today. `gate done` fails unless `verified_hash` equals the current AC hash and `verified_commit` matches the gated commit. A non-empty `verified` with either key missing fails Done with a tick-unbound reason; there is no compatibility path, as v0.1 is unreleased.
  Why not per-tick storage: GATE-02 requires the three sets to be equal, so Done only ever passes with every scenario ticked, and GATE-11 requires every tick's commit to equal the gated commit — therefore at Done every tick necessarily carries the same hash and the same commit, and per-tick storage returns the identical verdict on every honest use. The only difference is that a shared scalar lets a developer relabel an older tick by editing one value instead of overwriting an entry deliberately. That residual is inside the ceiling `docs/design.md` §5 states for itself ("What this cannot do... Claiming more would be theatre"), and closing it would cost a `verified` shape change, an extension to `setFrontmatterKey` (today `string | boolean | string[]`), and a human hand-writing 16 hex characters per scenario with no `accord tick` command in Phase 5 to write it for them. — **Reversibility:** costly — the two keys enter `ticket.schema.json` under `additionalProperties: false`, the templates, and every Phase 1–2 fixture and golden.
- Re-running Ready after an AC edit does **not** need to clear `verified`: Ready sets `ac_hash := H'` while `verified_hash` still holds `H`, so D-76 catches the stale tick. `gate ready` may therefore overwrite `ac_hash` on every passing run.

### Host-supplied facts (GATE-05, GATE-11)

- **D-78:** `SnapshotInput` and `RepoSnapshot` gain optional `git?: { commit: string; authors: Record<string, string> }` — repo-relative path to author identity. This follows the precedent D-72 set for `tests`: host-supplied, optional, carried on the snapshot, covered by the D-54 golden for free. A second `host` parameter on the gate functions was rejected because Phase 5 would have to thread two values and gate fixtures would need a mechanism outside the existing golden snapshot. The "snapshot is file content only" line was already crossed by D-65 (`files`) and D-72 (`tests`).
- **D-81:** Two commit shas are equal when, compared case-insensitively, the shorter is a prefix of the longer and both are at least 7 hex characters; a value under 7 characters fails with a sha-too-short reason. Three sources must agree — `git.commit` (host, 40 chars), `verification.md` `commit:` (agent-written), and `verified_commit` (human-written) — and git itself abbreviates to variable lengths. Truncating both to 7 was rejected as discarding information; requiring a full 40-character match was rejected because the model's own example is `commit: '1234567'`.
- A missing `git.commit` fails `gate done` rather than reporting skipped, by the same no-bypass reasoning as D-80.

### Author check (GATE-05)

- **D-79:** GATE-05 compares the author of `accord/tickets/<id>/verification.md` with the author of the gated commit; equal produces a warning, never a failure. The host supplies both (one `git log -1` on one file plus `git show -s`), so no full-history walk is needed and the check does not depend on GATE-04's extraction.
  **Finding, accepted rather than resolved:** in the workflow accord itself prescribes, this warning fires on nearly every honest ticket. `REQUIREMENTS.md` GATE-05 warns when implementation and evidence share a git author, while `docs/design.md` §4 says the reviewer is not a role — the dev workflow's last step opens a fresh agent context on the developer's own machine, and the developer commits the file it writes. The authors therefore match by construction. The owner accepted this: the warning's statement stays true, since in a solo workflow there really is no second pair of eyes. Revisit alongside GATE-13.

### Machine layer and skipped checks (GATE-06, GATE-08)

- **D-80:** When `config.yml` declares no `tests.report`, `gate done` **fails** with `gate.tests-unconfigured` on `accord/config.yml`. It does not report skipped.
  **Finding that drove this:** GATE-06 forbids a bypass flag, but GATE-08's "a host that cannot supply the report reports the check skipped" was the last bypass left — with the CLI as host (the owner recorded in Phase 3 that the MCP server is no longer needed), the only way the report is unavailable is that nobody declared it, so deleting one line from `config.yml` would remove the whole Machine layer that `docs/design.md` §5 describes as one of three layers each defeating a different lie. Only `lint.report-missing` (warning, D-72) watched that door, and a warning does not change the exit code. The "skip when the key is absent, fail when the file is absent" middle reading was rejected because it rewards never switching the layer on.
- Skipped checks render as ordinary `Finding`s at `level: 'warning'` with `gate.*-skipped` rule ids, through the existing `renderText` (D-60). No new type and no effect on the exit code.

### Evidence and verification notes (GATE-04, GATE-09, GATE-10)

- **D-82:** A reference candidate in evidence or note text is a whitespace-delimited token (surrounding punctuation stripped) that either contains `/` or carries a recognised file extension, plus any key of `snapshot.tests`. A candidate resolves when it is a segment-boundary suffix of a path in `snapshot.tree`, or a key of `snapshot.tests`. Suffix matching is deliberate: the question is whether the file exists, not whether the writer spelled the path from the repo root — `login.spec.ts` must resolve against `test/login.spec.ts`. Requiring backtick-marked spans was rejected as a new FMT rule that template and skill text would have to teach and that existing evidence would fail. This handles the command case in the `valid-build` fixture (`npm test -- login.spec.ts`) by picking the file out of the command and ignoring `npm`, `test`, and `--`.
- **D-83:** GATE-04 applies per evidence block: the whole `## @ac-n` block must contain at least one resolving reference, or Done fails. A path-shaped candidate that does not resolve raises a separate warning naming the token, never a failure. The literal per-line reading was rejected because it fails the most natural way a human writes evidence — a line of context followed by the citation. "Every candidate must resolve" was rejected because it fails a writer who cited real evidence and mistyped one character.
- **D-84:** GATE-10's "symbol present in the snapshot" is implemented as the D-82 rule and nothing else — the requirement's own parenthetical says "(the GATE-04 rule)". Core cannot check symbols: `snapshot.files` holds only prototypes, the tokens file, and the JUnit report (D-65), never source. Accepting identifier-shaped tokens unchecked would let any capitalised word pass; loading source text into the snapshot was rejected because the D-54 golden serialises the whole snapshot. The consequence is intended: a note must name a file, which is exactly what the Human layer exists to demand.
- **D-85:** The "note is not the scenario pasted back" test removes every resolving reference from the note, normalises the remainder, and fails when that remainder is empty or is a substring of the normalised scenario text (`ScenarioRef.name` plus `steps`). Normalisation is lowercase, collapsed whitespace, stripped punctuation, **Vietnamese diacritics preserved** — content in Vietnamese is the expected case and folding diacritics would manufacture false matches. No numeric threshold anywhere, per GATE-10's own reasoning that a character floor is arbitrary, language-dependent, and invites padding. The literal requirement reading (note ⊆ scenario) was rejected because it passes the cheapest dodge, pasting the scenario and appending a path; a bidirectional substring test was rejected because it fails a legitimate note that quotes the scenario and then explains.
- **D-90:** A scenario tagged `@ui` gets exactly the D-85 note rule, no stricter variant. GATE-09's word "stricter" reads as contrasting the Human layer with the Machine layer, which is how `docs/design.md` §5 puts the same point ("is exempt and leans on the human layer instead") without the word. Requiring the note to name the prototype was rejected because D-69 makes the scenario tag `@ui` independent of the frontmatter `ui:` key, so a `@ui` scenario can sit on a ticket with no prototype and the rule would be unsatisfiable; a two-reference minimum was rejected as the arbitrary threshold GATE-10 forbids. A `@ui` scenario is exempt from the test layer only — it still needs an evidence block, a bound tick, and a note.

### Result, profiles, and the Ready set (GATE-01, GATE-06, GATE-07)

- **D-87:** `GateResult` is `{ gate: 'ready' | 'done'; ticket: string; verdict: 'pass' | 'fail'; findings: Finding[]; acHash?: string }`. Rule ids are `gate.<kebab-name>`, continuing D-59. It renders through the existing `renderText` (D-60) with no change. `verdict` is `fail` if and only if at least one finding is `level: 'error'`; every warning — author match (D-79), stray token (D-83), skipped check (D-80) — leaves the verdict alone. A `GateCheck[]` type carrying per-check `pass`/`fail`/`skipped` was rejected: it needs a new renderer, new goldens, and two output shapes in Phase 5, to serve a consumer that does not exist in v0.1. — **Reversibility:** costly — Phase 5 prints this object under `--json`, and CI scripts and editor problem matchers bind to its shape, the same exposure D-56 and D-60 recorded.
- **D-88:** GATE-07 ships as mechanism with inert data: a gate rule table shaped like D-57 (`{ id, level, profiles, check }`) plus a `maintain` downgrade list naming the token and size rule ids. In v0.1 those rules are already warnings on both profiles (D-57), so the downgrade runs correctly and changes no result, which is what "`build` keeps them as configured" means when the configuration says warning. This honours D-66 ("warning, never error in v0.1") and the Phase 3 deferral of the token rule as an error to GATE-12. Promoting token and size to blocking on `build` now was rejected: it pulls GATE-12 forward and lets one hard-coded colour in a prototype block a story from entering the sprint, the "cries wolf" failure `PITFALLS.md` §13 warns about. ROADMAP success criterion 5 is therefore proved by a unit test on the downgrade function with synthetic rows, not by a fixture — no v0.1 fixture can distinguish the two profiles on these rules. v2 is a one-cell table edit.
- **D-89:** `gate ready` fails on any `error`-level finding scoped to the ticket, plus the three LINT-06 hygiene rules (`lint.sentinel`, `lint.open-question`, `lint.assumption-unconfirmed`) promoted from warning to blocking, plus the design-reference check. Ticket scope is `accord/tickets/<id>.md`, `accord/tickets/<id>/`, and `accord/assets/<id>/`. An explicit list of blocking rule ids was rejected because it fails silently: a lint error rule added in a later phase would not block Ready until somebody remembered to update a second table. Blocking on every finding regardless of level was rejected because `lint.vague-wording` must never block Ready (`docs/design.md` §5).
- An unparseable or schema-invalid `accord/config.yml` is the exit-2 branch of GATE-06 (config error), not a `fail` verdict.

### Already settled upstream — not re-decided here

- Duplicate `## @ac-n` blocks in `verification.md`: the loader already applies D-40/D-42 — the first block carrying a tag wins, later ones are skipped and produce a duplicate-heading finding (`packages/core/src/load/verification.ts`).
- A block with a missing or invalid `Result:` already produces `load.result-invalid`, which D-58 stamps `error`; under D-89's scope rule that fails the gate with no extra rule.
- `Result: blocked` fails Done exactly as `fail` does, and `verification.md` `commit:` must equal the gated commit — both stated in `docs/design.md` §5 and ROADMAP Phase 4 criterion 2.
- The design-reference rule is fully specified in `docs/design.md` §5: `ui: false` skips it on both profiles; `ui: true` on `maintain` requires `accord/assets/<id>/prototype.html` to exist; `ui: true` on `build` requires a Figma link in `design:` or a prototype.

### Claude's Discretion

- Module layout under `packages/core/src/gate/` (suggested: `hash.ts`, `refs.ts` for the shared D-82 extraction and resolution, `ready.ts`, `done.ts`, `rules.ts`, `index.ts`), following the shape `lint/` already established.
- The recognised file-extension set and the punctuation-stripping rules for D-82 candidates, including whether a trailing `:42` line suffix is stripped before resolution (it should be).
- The exact reason text for GATE-02, as long as it names which tags are missing from which of the three sets (ROADMAP criterion 2).
- Whether the shared D-82 extraction lives in `gate/` or moves next to the lint token rule, which already resolves `Derived from:` paths against `snapshot.tree` (D-67).
- Rule id names under the `gate.` prefix, and whether Ready and Done share one table or hold two.
- The `authors` record's key set and identity format (email versus name) — whichever the CLI can produce cheaply and compare exactly.
- The fixture set: at minimum a ticket that passes Ready, one that fails each Ready reason, a ticket that passes Done end to end, one per Done failure (set mismatch, stale hash, stale commit, unresolved evidence, pasted note, skipped test, unconfigured report, `Result: blocked`), and a `maintain`-profile fixture. `valid-build`'s current evidence cites `test/login.spec.ts`, which is not in its tree — it needs the file or a different citation before it can pass GATE-04.
- Whether the ticket templates gain commented `verified_hash` / `verified_commit` guidance.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product intent and requirements
- `.planning/REQUIREMENTS.md` — GATE-01 to GATE-11 are this phase; GATE-12 and GATE-13 are v2 and must not be pulled forward
- `.planning/ROADMAP.md` Phase 4 — goal and the five success criteria; criterion 5's profile clause is answered by D-88
- `docs/design.md` §5 — the Ready table, the prototype rule, and the three Done layers; the normative source for the design-reference check and for `Result: blocked` and the `commit:` match
- `docs/design.md` §3 — profiles decide what the gates require
- `docs/design.md` §4 — the reviewer is not a role; this is what makes GATE-05 fire by construction (D-79)
- `.planning/PROJECT.md` — core value and the constraints; "core never guesses" applies to every rule here
- `.planning/notes/solo-reaim-and-three-layer-done.md` — the origin of the `@test:` tag, the JUnit report, and note-by-reference

### Prior phase decisions this phase depends on
- `.planning/phases/03-lint/03-CONTEXT.md` — D-56 (`level`), D-57 (rule table and the no-profile-difference call), D-58 (one sorted list), D-59 (rule ids), D-60 (`renderText`), D-65 (`files`), D-66 (token rule stays a warning), D-69 (`@test:`/`@ui` and tags outside the hash), D-70 (`## Verification notes`), D-72 (`tests.report` and `snapshot.tests`)
- `.planning/phases/02-core-model-and-loading/02-CONTEXT.md` — D-40/D-42 (duplicate blocks by tag), D-43 to D-45 (`setFrontmatterKey`, block lists, double-quoted strings), D-46 to D-48 (`ScenarioRef`, Background in the hash input, what `steps` holds), D-51 (`tree` from `git ls-files`), D-52 (`Finding`), D-53/D-54 (fixtures and goldens), D-55 (public API)
- `.planning/phases/01-workspace-and-formats/01-CONTEXT.md` — D-07 (required headings), D-21 (`ui` defaults in the loader)

### Architecture and stack
- `.planning/research/ARCHITECTURE.md` — Pattern 1 (rules as data) and the "Matching and orphans" table: the three-set match shape D-87 and D-89 build on
- `.planning/research/PITFALLS.md` §13 (a token rule that cries wolf) — the reasoning behind D-88; §9 (a check that lies both ways) — the reasoning behind D-83 and D-85
- `.planning/research/STACK.md` Decision 4 (line scanner, no parser), Decision 5 (`styleText` stays in the CLI), Decision 7 (goldens, two-OS matrix)
- `.claude/CLAUDE.md` "Constraints" — isomorphic core, no `node:crypto`, which is what rules out `subtle.digest` in D-75

### Existing code this phase extends
- `packages/core/src/model/snapshot.ts` — add `git?` to `SnapshotInput` and `RepoSnapshot` (D-78); add `verified_hash` and `verified_commit` to `TicketFrontmatter` (D-76)
- `packages/core/schemas/ticket.schema.json` — the two new keys under `additionalProperties: false` (D-76)
- `packages/core/src/lint/rules.ts` — the table shape D-88 mirrors
- `packages/core/src/lint/index.ts` — `lintSnapshot`, whose findings D-89 filters by scope and level
- `packages/core/src/lint/render.ts` — `renderText`, reused unchanged by D-87
- `packages/core/src/load/verification.ts` — `EvidenceBlock`, and the duplicate/`Result:` handling already settled there
- `packages/core/src/write/frontmatter.ts` — `setFrontmatterKey`, called by Phase 5 under D-86
- `packages/cli/src/load/fs.ts` — must supply `git.commit` and `git.authors` (D-78), spawning `git` by name only, never a `.cmd` (D-51)
- `packages/core/src/index.ts` — export `gateReady`, `gateDone`, and `GateResult` (D-55 pattern)
- `packages/core/test/fixtures/valid-build/`, `packages/core/test/fixtures/verification-edges/` — the evidence and block-edge shapes the new rules run against

### Todo reviewed
- `.planning/todos/pending/mcp-host-spike.md` — not folded; see Deferred

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lintSnapshot` returns a sorted `Finding[]` with `level` already stamped; D-89 consumes it directly rather than re-running any rule.
- `renderText` (D-60) prints `file:line: level rule reason` plus a summary; D-87 reuses it for gate output with no change.
- `RULES` in `lint/rules.ts` is the `{ id, level, profiles, check }` table D-88 mirrors for the gate.
- `setFrontmatterKey` is pure and already applies D-44/D-45 quoting and comment round-tripping, so D-86 needs no write code in core.
- `snapshot.tree` gives the existence check for D-82, the same way D-67 uses it for `Derived from:` paths.
- `snapshot.tests` (D-72) already maps test id to `passed` / `failed` / `skipped`; GATE-08 is a join, and a `skipped` value fails Done exactly as `failed` does.
- `parseVerification` already resolves duplicate `@ac-n` blocks and invalid `Result:` values, so the gate reads `blocks` without re-parsing.
- The golden harness serialises the whole snapshot (D-54), so `git` and the new frontmatter keys are covered by extending fixtures rather than adding a mechanism.

### Established Patterns
- Rule ids are dotted with a source prefix: `load.*`, `lint.*`, now `gate.*`.
- Decisions are cited by number in code comments.
- Core purity guard plus `types: []` tsconfig: any `node:` import under `gate/` fails lint and typecheck, which is what forces the D-75 hash to be hand-written.
- `path.posix` everywhere; no `\` may appear in any `Finding.path` or gate output.
- Host-supplied, optional data rides on the snapshot (`files`, `tests`, now `git`) rather than on a second parameter.

### Integration Points
- Phase 5 wraps `GateResult` in exit codes 0/1/2, prints it with `styleText`, serialises it under `--json`, and performs the `ac_hash` write from D-86.
- Phase 5's fs loader is the only producer of `git.commit` and `git.authors`.
- Phase 6 skill text quotes `gate.*` rule ids in its Ready and Done steps, and must teach writing notes that name a file (D-84).

</code_context>

<specifics>
## Specific Ideas

- `ac_hash: "fnv1a64:8f3b2c1d4e5a6b70"` is the stored shape to design around.
- The `valid-build` fixture's evidence is the reference text for D-82: `npm test -- login.spec.ts` on one line, `test/login.spec.ts covers the happy path` on the next. The extractor must pick the file out of the command and ignore `npm`, `test`, and `--`.
- The note test in D-85 must pass `src/auth/login.ts trả 401 trước khi hash` and fail the same scenario text pasted back with a path appended.
- `verification-edges` fixture ticket `A` already exercises duplicate `## @ac-1`, `Result: PASS`, a missing `Result:`, and a non-block `## Notes` section — use it as the Done edge fixture rather than building a new one.

</specifics>

<deferred>
## Deferred Ideas

- **GATE-12 — token rule promoted to error on `build`** — stays v2 (D-66, D-88). The mechanism ships in Phase 4; only the table data changes.
- **GATE-13 — author check through the GitHub commits API** — v2; revisit together with the GATE-05 finding recorded under D-79, since a real second author is what would make that warning discriminate.
- **Per-tick binding** (`verified` as a list of objects) — rejected for v0.1 under D-76. Revisit only if an `accord tick` command exists to write the hash, so a human never hand-types it.
- **Loading source text into the snapshot** so GATE-10 can check symbols — rejected under D-84 on golden size. Revisit if a hub ever needs source in the snapshot for another reason.
- **A `@ui`-specific note rule** — rejected under D-90. Revisit if UI tickets prove to collect weak notes in the pilot.
- **Reporting which checks passed** (`GateCheck[]`) — rejected under D-87 as building for a consumer that does not exist. Revisit when a dashboard or the hub consumes gate output.
- **MCP server no longer needed** — carried forward unchanged from Phase 3. `skipped` as a host capability (GATE-05, GATE-08) only makes sense while a second host exists; D-80 already closed the one door it left open. Removing ROADMAP Phase 8 and MCP-01..07 is a roadmap-level change for `/gsd-phase`, not a Phase 4 decision.

### Reviewed Todos (not folded)
- `.planning/todos/pending/mcp-host-spike.md` — matched this phase (score 0.6) but not folded; the Phase 3 decision stands, and the owner indicates the MCP server is no longer needed. Close the todo when Phase 8 is removed from the roadmap.

</deferred>

---

*Phase: 04-gates*
*Context gathered: 2026-09-14*
