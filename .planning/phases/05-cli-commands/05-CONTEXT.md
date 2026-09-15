# Phase 5: CLI Commands - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The CLI is the reference host. Phase 5 wraps the pure core functions already shipped — `loadSnapshot`, `lintSnapshot`, `gateReady`, `gateDone`, `renderText`, `setFrontmatterKey` — in commander 15 commands with process behaviour: exit codes 0/1/2, `--json`, colour via `styleText`, the `config.yml` version pin, and the read-only `github-issues` tracker adapter. It also lands the single write the whole project performs from a gate: `ac_hash` into the ticket file after a passing Ready (D-86).

In scope: CLI-04, CLI-05, CLI-06, CLI-07, INTG-01. Commands: `new ticket <id>`, `lint`, `gate ready <id>`, `gate done <id>`, `status`.

Not in scope: `init` and the CI workflow it emits (CLI-01, CLI-02, CLI-03 — Phase 7); `skills sync` (CLI-08 — Phase 6); skill text (Phase 6). `accord new feature <slug>`, listed in `docs/design.md` §7, died with the `features/` folder and must not be built.

Decision numbering continues from Phase 4 (D-01 to D-90).

</domain>

<decisions>
## Implementation Decisions

### `status` output (CLI-05)

- **D-91:** A `status` row is document data plus two cheap derived columns, and `status` never calls `gateReady` or `gateDone`. One `lintSnapshot(snapshot)` for the whole repo supplies per-ticket error/warning counts through the existing `scoped()` helper; `Ready: — | ok | stale` compares `acHash(ticket.scenarios)` against frontmatter `ac_hash`, and `Ticks: n/m bound | stale` compares `verified_hash`. Verified cost: `packages/core/src/gate/index.ts` calls `lintSnapshot(snapshot)` inside every gate invocation, so real gates for N tickets would be N full-repo lints, and most in-flight tickets would render FAIL — accurate and useless. `acHash` is pure and needs no lint, so the cheap columns answer the question a person actually types `status` to ask ("which tickets are past Ready, whose Ready is stale, whose ticks have drifted") at the cost of one lint. The columns are a trace of what is written in the files, never a verdict; a verdict comes from `gate ready <id>`.
- **D-92:** `status` returns a flat `StatusRow[]` sorted by `(parent, id)` with `parent` as a column. Children of one epic sit together without the JSON carrying a tree or a `depth` field. Real nesting was rejected because it forces every `--json` consumer to walk a structure, and sorting by `id` alone was rejected because `docs/design.md` §2 makes `parent:` the grouping axis.
- **D-93:** `status` hides `status: archived` tickets by default; `--all` shows them, and the summary line names how many were hidden so the omission is never silent. `docs/design.md` §6 explicitly anticipates "five hundred ticket files", so archived accumulation is certain rather than speculative — this is one filter and one boolean, not a speculative option.

### Version pin (CLI-06)

- **D-94:** A version mismatch is a hard refusal: exit 2, with a message naming the pinned version, the running version, and the `npx --yes @<scope>/accord@<pin>` command that fixes it. Comparison is exact string equality between `config.yml`'s `accord` key and the CLI's own `package.json` version — no semver library, no range, no tolerance. There is no flag and no environment variable that bypasses it, by the same reasoning GATE-06 uses.
  **This resolves a documented conflict.** `.planning/REQUIREMENTS.md` CLI-06 ("refuses to run") and `.planning/ROADMAP.md` Phase 5 criterion 3 ("exits 2 with a message naming both versions") agree with each other. `.claude/CLAUDE.md` (STACK Decision 6) says instead that `lint`/`gate` "warn (build profile) or fail (maintain) on mismatch", and `.planning/research/PITFALLS.md` §11 hedges ("refuses ... (or warns, per profile)"). The owner chose the requirements. Two reasons beyond precedence: the STACK rule inverts profile semantics, since D-88 makes `maintain` the *looser* profile everywhere else; and a warning is exactly what an agent ignores, which is the failure mode `docs/design.md` §7 cites to justify having a CLI at all. **Action for the planner: `.claude/CLAUDE.md` STACK Decision 6's "Version pin" row is now wrong and must be corrected in this phase.** — **Reversibility:** costly — the pin's exit code is what CI scripts and the generated workflow branch on, and loosening it later re-opens the split-version hole PITFALLS §11 describes.
- **D-95:** Every command that reads `config.yml` checks the pin: `lint`, `gate ready`, `gate done`, `status`, `new ticket`. `--version` and `--help` are exempt, because `--version` is the command a person types to diagnose the very mismatch being reported — refusing it makes the error message unactionable. `new ticket` is *not* exempt: the ticket template changes between versions. A repository with no `accord/` folder produces the existing `UsageError` from `packages/cli/src/load/fs.ts`, not a pin error.

### `ac_hash` write (GATE-01, D-86)

- **D-96:** `gate ready` writes `ac_hash` into the ticket file whenever the verdict is `pass`, with no flag to enable or suppress it; a `fail` verdict never touches the file. This is forced, not chosen: `gate.ac-hash-missing` is an `error` on both profiles (`packages/core/src/gate/rules.ts:75`), so `gate done` can never pass unless Ready wrote the hash. The "CI would dirty the working tree" objection does not arise on the main path — CLI-02 has CI run `lint` and `gate done` on touched tickets, not `gate ready`. The CLI compares the text `setFrontmatterKey` returns against the text on disk and writes only when they differ, so a second consecutive `gate ready` does not touch mtime.
- **D-97:** When the verdict is `pass` but the write fails (read-only file, permissions, full disk), the CLI prints the real gate result, then reports the write failure and exits 2. A read-only file is an environment error under the exit-code contract STACK Decision 1 already defines. Turning the verdict into `fail` was rejected as a lie — nothing is wrong with the ticket's content. Exiting 0 with a warning was rejected because CI would go green while `ac_hash` was never recorded, and the failure would surface much later as an unexplained `gate done` failure.
- **D-98:** Under `--json`, stdout carries the core result object verbatim — `GateResult`, `LintResult`, or `StatusRow[]` — with no envelope, no wrapper key, and nothing else. Every other message (the `ac_hash` write notice, the tracker warning, pin errors, usage errors) goes to stderr. This honours D-87 and D-60, which state that CI scripts and editor problem matchers bind to the core object's shape. A shared `{ command, version, exitCode, result }` envelope was rejected because it breaks that promise and forces every consumer through `.result`; adding a `wrote:` field to `GateResult` was rejected because it changes a shape D-87 locked in order to carry one human notice. — **Reversibility:** costly — this is the published machine contract; the same exposure D-56, D-60, and D-87 already recorded.

### `github-issues` adapter (INTG-01)

- **D-99:** Nothing requires a tracker. No ticket must carry a `tracker.github-issues` id, and no token must be present. Verified already true in code and needing no Phase 5 change: `tracker` is absent from `required` in `packages/core/schemas/ticket.schema.json`, and the only rule touching it — `lint.tracker-empty` (D-22, `packages/core/src/lint/ticket.ts:53`) — fires only when the key is present but empty (`tracker: {}`). An unlinked ticket renders `—` in the tracker column and produces no finding. This is `.planning/PROJECT.md`'s "Independence" constraint ("nothing may require a tracker") held to literally.
- **D-100:** When GitHub data cannot be fetched — no token, no network, rate limit exhausted, a 404 on one issue — `status` degrades softly but out loud: the tracker cell shows `—`, one line on **stderr** names the reason, and the exit code is unchanged. Every other column still prints. Exiting 2 on a missing token was rejected as making a configured adapter a hard dependency, against the PROJECT constraint and against ROADMAP criterion 5 ("every gate returns the same result with or without the token"). Silent omission was rejected because an empty cell would not distinguish "not linked" from "could not fetch".
- **D-101:** One `GET /repos/{owner}/{repo}/issues/{n}` per ticket that declares `tracker.github-issues`, issued in parallel. No pagination logic, no pull-request filtering (the list endpoint returns PRs as issues), and no issues loaded that nothing references; one failed request damages one row rather than the table. The authenticated rate limit is 5000/hour, far above pilot scale. Swapping to a single GraphQL call is a local change if N ever grows — not worth paying for now.
- **D-102:** Token lookup order is `GITHUB_TOKEN` first, then `gh auth token`, and neither is required. Reading the environment variable costs nothing and is how CI supplies a token, so CI spends no spawn at all; the variable also gives an explicit override. `gh` missing from PATH (ENOENT) is treated as "no token" and falls into D-100, never an error. `.planning/research/PITFALLS.md` §12 explicitly permits spawning `git` and `gh` by name as `.exe` binaries, so this does not touch the "never spawn `npm`, `npx`, or any `.cmd`" constraint (CLI-07).

### Command surface and root resolution (CLI-04, CLI-07)

- **D-103:** The repository root comes from `git rev-parse --show-toplevel`, so the CLI runs correctly from any subdirectory. This is a correctness requirement, not a convenience: `gitTree` runs `git ls-files` with `cwd = root`, and `git ls-files` from a subdirectory lists only that subdirectory — so a root that is not the git top-level yields an incomplete `snapshot.tree`, and D-82 evidence resolution for paths outside `accord/` (for example `test/login.spec.ts`) fails silently. Walking up from cwd looking for `accord/` was rejected for exactly that failure. The extra `git` spawn is free in practice: `packages/cli/src/load/fs.ts` already makes git a hard precondition and throws `UsageError` when it is absent. `accord/` absent from the top-level keeps producing the existing `UsageError`. `runCli(argv, { cwd, stdout, stderr })` still receives `cwd` explicitly (STACK Decision 7), so tests never read `process.cwd()`.
- **D-104:** `new ticket <id>` takes one option, `--type epic | story | bug`. `epic` renders `epic.md`; `story` and `bug` render `ticket-<profile>.md` chosen from `config.profile`. The command substitutes `TICKET-ID` (frontmatter `id` and the Gherkin `Feature:` line) and sets `type:` in the frontmatter; everything else stays as the template's placeholder text for the BA to fill. The `@ac-1` tag scaffolding ROADMAP criterion 1 asks for is already in `ticket-build.md` and `ticket-maintain.md`, so no generation is needed — only substitution. `--type` earns its place because `epic.md` exists as a distinct template (epics omit Acceptance criteria, Plan, and Verification notes) and without the option there is no way to reach it. `--title` was rejected: it saves one edit in a file the BA opens to edit anyway.

### Claude's Discretion

- Module layout under `packages/cli/src/` (suggested: `index.ts` for the commander wiring, `commands/` per command, `render/` for the ASCII table and `styleText` wrapping, `tracker/github-issues.ts`), following the shape `core/src/lint/` and `core/src/gate/` established.
- The exact `StatusRow` field names and the ASCII table's column widths, truncation rule for long titles, and behaviour on a narrow terminal. ASCII only, no box-drawing characters (PITFALLS §12); colour only when TTY, via `styleText`, which already honours `NO_COLOR` and `isTTY`.
- Epic rows render `—` in the `Ready` and `Ticks` columns, since an epic is linted but never gated (`docs/design.md` §2).
- The empty-repository case for `status` (no tickets at all) — a one-line message rather than an empty table.
- The exact wording of the pin-mismatch message, the `ac_hash` write notice, and the tracker warning, as long as the pin message names both versions (ROADMAP criterion 3).
- Exit code for `new ticket` refusing to overwrite an existing ticket — exit 2 is the natural reading of the STACK Decision 1 table (environment/usage, not a gate verdict).
- Concurrency bound for the parallel issue requests, if any; plain `Promise.all` is acceptable at pilot scale.
- Whether the pin check lives in `core` (a pure comparison given two strings) or wholly in `cli`; the version of the CLI itself must be read from its own `package.json` and never via a spawn.
- The fixture and spawn-test layout, subject to the two hard constraints already fixed: one real spawn of the built binary via `process.execPath` (never `accord.cmd`, never `npx`), and a test asserting no `\` appears in any printed path on Windows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product intent and requirements
- `.planning/REQUIREMENTS.md` — CLI-04, CLI-05, CLI-06, CLI-07, INTG-01 are this phase. CLI-01/02/03 (Phase 7) and CLI-08 (Phase 6) must not be pulled forward
- `.planning/ROADMAP.md` Phase 5 — the goal and the five success criteria; criterion 3's exit-2 clause is the winning side of the conflict D-94 resolves
- `docs/design.md` §7 — the command list; note that `accord new feature <slug>` there is dead (the `features/` folder was removed) and `init` belongs to Phase 7
- `docs/design.md` §2 — the folder convention, `parent:` as the grouping axis (D-92), and epics being linted but never gated
- `docs/design.md` §6 — "five hundred ticket files", the scale note behind D-93; and adapter `none` being fully usable
- `.planning/PROJECT.md` — the "Independence" constraint ("nothing may require a tracker") behind D-99 and D-100, and the cross-platform constraint behind D-103

### Prior phase decisions this phase depends on
- `.planning/phases/04-gates/04-CONTEXT.md` — D-86 (`gateReady` is pure and returns `acHash`; Phase 5 performs the write), D-87 (`GateResult` shape, which D-98 prints verbatim), D-88 (profile matrix; `maintain` is the looser profile, which is why D-94 rejects the STACK rule), D-78 (`git.commit` and `git.authors` supplied by the CLI loader), D-82 (reference resolution against `snapshot.tree`, which D-103 protects)
- `.planning/phases/03-lint/03-CONTEXT.md` — D-56 (`level`, and exit 1 on any error), D-58 (one sorted list), D-60 (`renderText` is colour-free in core; the CLI wraps it with `styleText`), D-72 (`tests.report`)
- `.planning/phases/02-core-model-and-loading/02-CONTEXT.md` — D-43 to D-45 (`setFrontmatterKey` quoting and comment round-trip, used by D-96), D-51 (the `git ls-files` loader and the no-`.cmd` spawn rule), D-55 (public API surface)
- `.planning/phases/01-workspace-and-formats/01-CONTEXT.md` — D-22 (`tracker: {}` says nothing — the rule D-99 checked)

### Architecture and stack
- `.claude/CLAUDE.md` "Technology Stack" Decision 1 — the 0/1/2 exit-code table and commander 15's `exitOverride` + `configureOutput`
- `.claude/CLAUDE.md` "Technology Stack" Decision 5 — `util.styleText` plus a hand-rolled ASCII `padEnd` table; no `cli-table3`, no `picocolors`
- `.claude/CLAUDE.md` "Technology Stack" Decision 6 — build, bin, `files`, `exports`, and the version pin. **The "Version pin" row is wrong per D-94 and must be corrected in this phase**
- `.claude/CLAUDE.md` "Technology Stack" Decision 7 — `runCli(argv, { cwd, stdout, stderr })`, one real spawn via `process.execPath`, the no-backslash path invariant, the two-OS matrix
- `.planning/research/PITFALLS.md` §11 — stale `npx` cache; the reason the pin exists at all. Its parenthetical "(or warns, per profile)" is superseded by D-94
- `.planning/research/PITFALLS.md` §12 — Windows: spawn only `.exe` binaries (`git`, `gh`) by name, ASCII-only table, forward-slash paths, colour only when TTY
- `.planning/research/ARCHITECTURE.md` — the host/core split the CLI is the reference implementation of

### Existing code this phase extends
- `packages/cli/src/index.ts` — the Phase 1 placeholder; its own comment says "Phase 5 replaces it with commander"
- `packages/cli/src/load/fs.ts` — `loadFromFs(root)`, `UsageError`, `gitTree`, `gitFacts`; D-103 decides who computes `root`
- `packages/cli/package.json`, `packages/cli/tsdown.config.ts`, `packages/cli/test/bin.test.ts` — the bin, the shebang assertion, and the existing spawn test
- `packages/core/src/index.ts` — the public API the CLI consumes; `loadSnapshot`, `lintSnapshot`, `gateReady`, `gateDone`, `renderText`, `setFrontmatterKey`, `templates`
- `packages/core/src/gate/index.ts` — `GateResult`, `scoped()`, and the `lintSnapshot` call inside every gate that D-91 measured
- `packages/core/src/gate/rules.ts` — `gate.ac-hash-missing` at line 75, the error that makes D-96 mandatory
- `packages/core/src/gate/hash.ts` — `acHash(scenarios)`, the pure function D-91's cheap columns call
- `packages/core/src/lint/render.ts` — `renderText`, wrapped with `styleText` by the CLI, never re-implemented
- `packages/core/src/lint/ticket.ts` — `trackerEmpty` (D-22), the rule D-99 verified
- `packages/core/src/write/frontmatter.ts` — `setFrontmatterKey`, called by D-96
- `packages/core/schemas/config.schema.json` — `accord` (the pin), `profile`, `tracker.adapter`/`tracker.repo`
- `packages/core/schemas/ticket.schema.json` — `tracker` as an optional adapter-keyed map; `status` enum for D-93
- `packages/core/templates/ticket-build.md`, `ticket-maintain.md`, `epic.md` — the templates D-104 renders

### Todos reviewed
- `.planning/todos/pending/mcp-host-spike.md` — not folded; see Deferred
- `.planning/todos/pending/rejected-alternatives-have-no-home.md` — not folded; see Deferred

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadFromFs(root)` in `packages/cli/src/load/fs.ts` already produces a complete `SnapshotInput` including `files`, `tree`, the contained tokens/report reads, and the D-78 `git` facts. Every command builds on one call to it; nothing in the loader needs to change for Phase 5 except who supplies `root` (D-103).
- `UsageError` with `readonly exitCode = 2` already exists and is exactly the exit-2 channel D-94, D-97, and the missing-`accord/` case need. The pin mismatch and the `ac_hash` write failure should raise it rather than invent a second mechanism.
- `renderText` (D-60) prints `file:line: level rule reason` plus an `N errors, M warnings` summary and is shared by `lint`, `gate ready`, and `gate done`. The CLI adds colour on top with `styleText`; it must not re-render.
- `acHash(scenarios)` in `packages/core/src/gate/hash.ts` is pure, synchronous, and dependency-free — it is what makes D-91's `Ready`/`Ticks` columns cost nothing.
- `scoped(findings, id)` in `packages/core/src/gate/index.ts` is already exported within the gate module and is the per-ticket filter D-91's counts need from one repo-wide lint. If it is not on the public API, exposing it (or a small `statusRows()` in core) is preferable to re-implementing the string comparison in the CLI.
- `setFrontmatterKey` is pure and already honours D-44/D-45 quoting and comment round-tripping, so D-96 needs no YAML handling in the CLI — only a text compare and a write.
- `packages/cli/test/bin.test.ts` already spawns the built binary; the Phase 5 spawn test (ROADMAP criterion 4) extends it rather than starting over.

### Established Patterns
- Core stays pure: no `node:*` import may appear under `packages/core/src`, enforced by ESLint and by `packages/core/test/purity.test.ts`. Everything in this phase that touches the filesystem, the network, or `process` lives in `packages/cli`.
- `path.posix` everywhere; no `\` may appear in any printed path, any `Finding.path`, or any `status` row. A test asserts this on Windows.
- Spawn only `git` and `gh` by name with a literal argument array — never through a shell, never a `.cmd`, never `npm`/`npx` (CLI-07, D-51, PITFALLS §12).
- Decisions are cited by number in code comments (`// D-96: ...`).
- Goldens are JSON of the structured result object, never ANSI text; a handful of text-render tests run with `NO_COLOR=1` (STACK Decision 7).

### Integration Points
- Phase 6 skill text calls these exact command spellings and depends on their exit codes; SKILL-08 adds a test asserting every CLI command a skill names exists, so the command surface fixed here (`new ticket`, `lint`, `gate ready`, `gate done`, `status`, and the `--type`/`--json`/`--all` options) is what Phase 6 will bind to.
- Phase 7's `init` writes `config.yml` with the CLI's own version and emits a CI workflow calling `npx --yes @<scope>/accord@<pin>`; D-94's exact-match rule is what makes that pin meaningful, and D-95 tells `init` which commands it may safely place in that workflow.
- Phase 8's MCP server is a second host over the same core; anything the CLI implements here that is not host-specific (the pin comparison, `statusRows`) is a candidate for core so it is not written twice — but only if it is genuinely pure.

</code_context>

<specifics>
## Specific Ideas

- The `status` table is the one screen a person looks at daily. Target shape: `id | type | status | parent | ui | err/warn | Ready | Ticks | tracker`, ASCII, `padEnd`, colour only when TTY.
- `Ready` cell values are exactly three: `—` (no `ac_hash` recorded), `ok` (recorded hash equals the computed one), `stale` (recorded hash differs).
- `Ticks` cell is `n/m` plus `bound` or `stale`, where the binding comes from comparing `verified_hash` to the current AC hash (D-76).
- The pin message must name both versions and the fix, e.g. `config.yml pins accord 0.2.0, running 0.1.0 — run: npx --yes @<scope>/accord@0.2.0`.
- Under `--json`, `jq '.findings[]'` must work with no unwrapping. That is the acceptance shape for D-98.
- `new ticket` on an existing file refuses and changes nothing; the refusal message names the existing path.

</specifics>

<deferred>
## Deferred Ideas

- **`--gates` on `status`** (run real gates for every ticket) — rejected under D-91 as N full-repo lints for a column that would read FAIL on every in-flight ticket. Revisit only if someone asks for a repo-wide readiness report, and then measure first.
- **GraphQL batching for the tracker adapter** — rejected under D-101 as a second API surface in v0.1. Revisit when a repository has enough linked tickets that the per-ticket GETs are visible.
- **Caching tracker responses** between runs — not built. Revisit only with evidence of rate-limit pressure.
- **`accord upgrade`** (bump the pin and regenerate wrappers) — named in `.planning/research/PITFALLS.md` §11 but in no requirement. Belongs with `init` (Phase 7) or later; do not build it here.
- **`--title` on `new ticket`** — rejected under D-104. Revisit if the BA workflow in Phase 6 turns out to create tickets non-interactively.
- **`--no-write` / `--write` on `gate ready`** — rejected under D-96. Revisit if a real caller needs a dry-run Ready.
- **Correcting `.claude/CLAUDE.md` STACK Decision 6** — this is a documentation fix D-94 requires, and it *is* in scope for this phase's plans; it is listed here only so it is not lost.

### Reviewed Todos (not folded)
- `.planning/todos/pending/mcp-host-spike.md` — matched at score 0.6 on generic keywords. Not folded: Phase 5 has exactly one host, the CLI, and the Phase 3/4 record says the MCP server is no longer needed. Close it when Phase 8 is removed from the roadmap.
- `.planning/todos/pending/rejected-alternatives-have-no-home.md` — matched at score 0.6 on generic keywords. Not folded: it is a question about where rejected alternatives live in the accord folder convention, which is a format concern, not a CLI concern.

</deferred>

---

*Phase: 05-cli-commands*
*Context gathered: 2026-09-15*
