# Phase 7: Scaffolding and Example Repo - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

One command — `accord init` — gives an empty repository the whole contract: the `accord/` folder,
`config.yml` carrying the pinned version, the templates, the skill copies in both runtime paths, a
pointer block in `AGENTS.md` and `CLAUDE.md`, and a GitHub Actions workflow that runs `lint` and
`gate done` on the tickets a pull request touches. Running it a second time changes nothing. An
example under `examples/` holds one maintain-profile ticket and one build-profile ticket, and both
pass `gate ready` and `gate done`.

In scope: CLI-01, CLI-02, CLI-03, INTG-02, plus the Phase 6 carry-over SKILL-04.

Not in scope: the MCP server (Phase 8); publish and dogfood (Phase 9); SKILL-10
(`disable-model-invocation`) and SKILL-11 (`lint` detects drift between skill copies and the
definition), both parked in REQUIREMENTS under later work. No gate rule changes and no lint rule
changes — this phase writes files and a workflow, it does not move a gate.

Decision numbering continues from Phase 6 (D-01 to D-129).

</domain>

<decisions>
## Implementation Decisions

### Idempotency and overwriting

- **D-130:** For everything `init` itself writes — `config.yml`, the templates, the CI workflow, the
  `AGENTS.md`/`CLAUDE.md` pointer — the rule is **a path that exists is skipped**. `init` never reads
  the file's contents to decide, never diffs, never writes a marker for its own benefit. This is the
  strongest possible reading of "never overwrites an edited file": there is no code path that can
  clobber a human's work, because there is no code path that writes over an existing file at all.
  The accepted cost is that a repository initialised at 0.1.0 does not receive a template improvement
  shipped at 0.2.0; upgrading a template stays a manual act, and the version pin (D-95) is what makes
  the mismatch visible.
  — **Reversibility:** reversible — the predicate is one `existsSync` at each write site; adding a
  hash or marker scheme later touches those sites and nothing else.

- **D-131:** `skills sync` keeps its own marker-and-hash rule unchanged (D-105 to D-107) and is **not**
  brought under D-130. The two rules govern different things: the skill copies are rendered output
  that must track their definition or SKILL-11 has nothing to detect, while the templates and config
  are documents a human owns from the first minute. When `init` puts skill copies in place it does so
  by calling the same sync path, so a copy that is still pristine is refreshed and a copy a human
  edited is left alone and reported — the behaviour Phase 6 already specified.
  — **Reversibility:** reversible — it is a choice of which existing function `init` calls.

- **D-132:** `init` in a repository that already has an `accord/` folder **fills in what is missing and
  keeps what is there**. It is the "make this repository conform to the contract" command, not a
  greenfield-only command. This repository is the proving case: `accord/config.yml` was written by
  hand in Phase 6 with a comment stating that `init` must not overwrite it, and under D-130 plus D-132
  running `accord init` here is safe and adds the parts Phase 6 did not write.
  — **Reversibility:** reversible.

- **D-133:** Output is a list of every path `init` considered, each marked created or skipped, and exit
  0 either way. The second run prints the same list with everything skipped rather than a single
  "nothing to do" line — a person re-running `init` is usually asking "what does accord think should
  be here", and the answer is the list. Paths are printed POSIX-style (`path.posix`), per the existing
  path invariant.

### `config.yml` generation

- **D-134:** `init` writes `config.yml` from fixed defaults with explanatory comments and **asks
  nothing and takes no flags for its contents** — no `--profile`, no `--roles`, no `--runtimes`, no
  prompt. Defaults: `profile: build`, `tracker.adapter: none`, `roles: [ba, dev, designer]`,
  `runtimes: [claude, codex]`, `design.tokens: ""` with a comment naming what to put there. Editing
  a YAML file with comments next to each key is a better first experience than answering four
  questions about terms the team has not met yet, and a non-interactive CLI is what lets the same
  binary run in CI. This extends D-104 — accord creates the document and the human fills in the
  intent — from tickets to config.
  — **Reversibility:** reversible — adding flags later is additive and breaks no existing invocation.

  — **Amended 2026-09-17 (owner ruling), `runtimes:`.** Originally `runtimes: [claude]`. ROADMAP
  criterion 1 requires "skill copies in both paths", and `targets.ts:18-22` maps `claude` to
  `['.claude/skills']` and `codex` to `['.agents/skills']` — so only a two-runtime default makes that
  criterion literally true, and PROJECT.md's premise of a mixed team on Claude Code, Cursor, Codex or
  Copilot is served by the one command rather than after someone edits config. Two alternatives were
  put and declined: amending criterion 1 (weakens "one command delivers the whole contract"), and
  having `init` seed both directories via `allSkillDirs()` while `skills sync` keeps
  `skillTargets(config)` — declined because with `runtimes: [claude]` the next `skills sync` would
  report the `.agents/skills/accord-*` copies as D-113 orphans, so a fresh repository would ship an
  orphan report on minute one. The original single-runtime reasoning is preserved above; only the
  default changed.

  — **Amended 2026-09-17 (owner ruling), `design.tokens`.** Originally "at a commented default path".
  A default path that does not exist makes `accord lint` report `lint.tokens-missing` on a
  repository's first minute — the papercut this repository already carries as WINDOWS.md entry 3.
  `tokensKey` (`packages/core/src/lint/tokens.ts:181-184`) returns `undefined` for the empty string,
  so `tokens: ""` skips the token rule outright, and `config.schema.json:26` declares
  `design.tokens` as `{"type": "string"}` with no `minLength`, so the empty string is schema-legal.
  The explanatory comment is what names the path to fill in. `gate-done/accord/config.yml` already
  ships `tokens: ""`, so this is the existing in-repo precedent rather than a new shape.

- **D-135:** The `accord:` version written into `config.yml` and the version pinned in the generated
  workflow both come from the CLI's own `package.json` and are the same string, per D-94/D-95. A test
  asserts the two values written by a single `init` run are equal.

### CI workflow shape

- **D-136:** The generated workflow triggers on `pull_request` only. The diff base is
  `github.event.pull_request.base.sha`, which the event hands over directly — no guessing, no
  `before`-sha that is empty on a branch's first push, no separate base rule for a manual run. `gate
  done` belongs at the moment a change is proposed for merge, which is exactly what this event is.
  Push-to-main and `workflow_dispatch` were considered and declined for this version; adding a trigger
  later is a template edit.
  — **Reversibility:** reversible.

- **D-137:** Touched tickets are derived from `git diff --name-only <base>...HEAD` filtered to
  `accord/tickets/*.md`, with the ticket id taken from the file name. No tracker is consulted and no
  branch-name or PR-title convention is assumed, so the workflow works under `tracker.adapter: none`
  — the independence constraint.
  — **Reversibility:** reversible.

- **D-138:** On a diff that touches no ticket — a docs-only change, a pure refactor — the job still
  runs, prints one line naming why there is nothing to gate, and exits 0. It never uses a `paths:`
  filter to skip itself, because a skipped job leaves a required status check pending forever, which
  is the failure ROADMAP criterion 2 ("always reports a job result") exists to prevent.

- **D-139:** The job invokes accord as `npx --yes @accord-dev/accord@<pinned version>`. The user's
  repository needs no `package.json` and no accord dependency, and the pin is the same string as
  `config.yml`'s, so a drifted workflow is a hard refusal rather than a silent version skew. The CLI
  itself still never spawns npm or npx (PITFALLS §12) — the workflow YAML does, on the runner.

- **D-140:** The workflow runs `lint` and `gate done` only. `gate ready` is the gate an agent passes
  before writing code, inside a working session; running it on a pull request would fail every branch
  that is mid-implementation. This matches CLI-02 word for word.

### `AGENTS.md` / `CLAUDE.md` pointer

- **D-141:** The pointer is delimited by a pair of HTML comments,
  `<!-- accord:start -->` … `<!-- accord:end -->`. The boundary is machine-findable, invisible in
  rendered Markdown, and leaves the door open to in-place updating later without re-deciding the
  format then.

- **D-142:** When the block is already present, `init` leaves the file untouched and reports it
  skipped — D-130 applied unchanged. Created when the file is missing, appended when the file exists
  without the block, skipped when the block is there.

- **D-143:** The block contains the paths to `.claude/skills/accord-*` and `.agents/skills/accord-*`
  and exactly one line of rule: a ticket is not started before `accord gate ready <id>` passes. No
  skill body is copied (CLI-03). The single line earns its place because an agent that has not loaded
  a skill still needs to know the one thing that makes it load one; anything beyond it starts
  duplicating the skills and drifting from them.

- **D-144:** Both `AGENTS.md` and `CLAUDE.md` always receive the block, regardless of `runtimes:` in
  config — ROADMAP criterion 3 names both files unconditionally. (Note for the planner: this is
  deliberately *not* the `skillTargets(config)` filtering rule, which continues to govern where skill
  copies go.)

### Example repo

- **D-145:** The example lives in `examples/` inside this repository, as two directories — one
  maintain-profile, one build-profile. A separate GitHub repository was declined: it would need
  syncing, could not be exercised by this phase's CI, and would let the example drift from the code it
  demonstrates. Reusing the root `accord/` folder was declined because the root is maintain-profile
  only and INTG-02 requires both profiles.
  — **Reversibility:** reversible.

- **D-146:** The example's skeleton is produced by running `accord init`, and the human-owned content —
  intent, EARS requirements, Gherkin scenarios, evidence — is written by hand. This is D-104 again:
  accord records intent, it does not synthesise it. The side benefit is that the example is standing
  proof that what `init` generates is a thing the gates accept.

- **D-147:** Proof is two layers. A vitest fixture test runs `gateReady` and `gateDone` against both
  example directories and asserts PASS, so changing a gate rule turns the suite red immediately and
  locally. A CI job additionally runs the generated workflow's own commands against the examples
  through the real CLI, so the emitted YAML is demonstrated to work rather than only to parse.

### Phase 6 carry-over

- **D-148:** SKILL-04 — "every skill begins with a lint or gate call and never restates a rule the CLI
  enforces" — is resolved in this phase as its own plan. The opens-on-the-gate half already passes
  (`skills.test.ts:214`); the never-restates half failed its manual read in 06-06, the owner upheld
  the finding and deferred it here. The plan covers both the content edit across the skill definitions
  and a test that fails if a skill restates an enforced rule, so the finding cannot return silently.
  Deferring again to Phase 9 was declined — the debt is content work, and Phase 9 is publish and
  dogfood.

### Claude's Discretion

- The exact wording of the comments in the generated `config.yml`, the one rule line in the pointer
  block, and the "nothing to gate" line in the workflow.
- The internal split between `core` (pure: which paths, which contents) and `cli` (the filesystem
  write). D-107's shape is the precedent and the planner should follow it without being asked.
- Job and step naming in the generated workflow.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 7: Scaffolding and Example Repo" — goal and the four success criteria
- `.planning/REQUIREMENTS.md` — CLI-01, CLI-02, CLI-03, INTG-02, SKILL-04
- `.planning/PROJECT.md` — the constraints this phase must not break (isomorphic core, cross-platform,
  independence, no other tools named)

### Decisions this phase builds on
- `.planning/phases/06-skills/06-CONTEXT.md` — D-105 to D-107 (definitions as data in core, pure
  render in core, filesystem write in cli); D-104 (accord never synthesises human intent)
- `.planning/phases/06-skills/06-VERIFICATION.md` — the SKILL-04 carry-over and the owner's deferral
- `.claude/CLAUDE.md` §Decisions 6 — the version pin as a hard refusal (D-94/D-95), the `files:` and
  `exports:` maps, and the rule that the CLI never spawns npm or npx
- `.planning/research/PITFALLS.md` §11, §12 — pin behaviour and the Windows npx spawn problem
- `.planning/WINDOWS.md` — the Windows constraints the write paths and tests must respect

### Code the phase extends
- `packages/cli/src/commands/new-ticket.ts` — the existing precedent for writing a human-owned
  document from a template
- `packages/cli/src/commands/skills.ts` — the existing write path for skill copies, and the
  orphan/link guards it already carries
- `packages/core/src/skills/targets.ts` — `skillTargets(config)`, which decides where skill copies go
- `accord/config.yml` — the hand-written config whose header comment states the constraint D-132
  satisfies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `templates` and `skills` generated records on the core public API (`packages/core/src/index.ts`) —
  the template and skill bodies `init` writes are already shipped data; nothing needs reading from
  `packages/core/templates/` at runtime, which is what makes this work after npm install.
- `skillTargets(config)` / `allSkillDirs` / `skillDirs` — the existing answer to "which skill files go
  where", reusable by `init` without change.
- `setFrontmatterKey` — used by `new-ticket` for the one place accord edits a document's frontmatter.
- `UsageError` in `packages/cli/src/load/fs.js` — the existing exit-2 path for usage and environment
  errors.

### Established Patterns
- `init` does not exist yet: `packages/cli/src/run.ts` registers `lint`, `gate ready|done`,
  `new ticket`, `skills sync`, and `status`. It is a new top-level `.command('init')` beside them.
- Core stays pure: no `node:fs` outside `src/load/` and `src/scaffold/`, enforced by the eslint
  `no-restricted-imports` guard. A scaffolding plan that decides *what* to write belongs in core; the
  writing belongs in cli.
- Runtime assets resolve through `new URL('../templates/', import.meta.url)`, never `__dirname`.
- Stored and printed paths use `path.posix`, and a test asserts no backslash appears in output.

### Integration Points
- `init` calls the same skill-writing path as `skills sync` (D-131) rather than duplicating it.
- The version string is read from the CLI's own `package.json`, the same source the pin check reads.
- The generated workflow is the first artifact accord emits that is executed by something other than
  accord, so the vitest fixture (D-147) is what keeps it honest between CI runs.

</code_context>

<specifics>
## Specific Ideas

- The second `init` run printing the full created/skipped list rather than a terse "nothing to do" is
  deliberate — the list is the answer to "what does accord think belongs here".
- The `examples/` pair is expected to double as the fixture the vitest gate test loads, rather than
  maintaining a separate fixture that says the same thing.

</specifics>

<deferred>
## Deferred Ideas

- Upgrading templates and the workflow in a repository already initialised at an older version
  (a marker or hash scheme, or an `accord upgrade` command). Ruled out of Phase 7 by D-130; revisit if
  a real version bump makes the stale-template cost visible.
- Push-to-main and `workflow_dispatch` triggers for the generated workflow (D-136).
- Flags or prompts for `config.yml` contents (D-134).
- SKILL-10 (`disable-model-invocation`) and SKILL-11 (skill-copy drift detection) — already parked in
  REQUIREMENTS under later work.

</deferred>

---

*Phase: 7-Scaffolding and Example Repo*
*Context gathered: 2026-09-17*
