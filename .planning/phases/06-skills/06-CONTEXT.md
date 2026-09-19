# Phase 6: Skills - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Three role workflow definitions (`ba`, `dev`, `designer`) plus the reference files they load
— two techniques (systematic debugging, code review), the fresh-context review brief, the BA's
two branches, the readiness review, and the prototype guidance — live as data in `core`, render
to `SKILL.md` files carrying only the six Agent Skills spec frontmatter fields, and are written
by `accord skills sync` into `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/`
with a generated marker and a content hash.

In scope: SKILL-01 to SKILL-09, SKILL-12, CLI-08. The ROADMAP's own scope note governs how to
plan it: *"Rendering is mechanical; writing four workflows good enough to replace a mature
planning system is not. Plan it as content work with a rendering step, not the reverse."*

Not in scope: `init` and the CI workflow it emits (CLI-01, CLI-02, CLI-03 — Phase 7); the example
repo (INTG-02 — Phase 7); SKILL-11 (`lint` detects drift between copies and definition) and
SKILL-10 (`disable-model-invocation`), both already parked in REQUIREMENTS under later work.
No gate rule changes: D-124 records a real gate hole as a FINDING rather than reopening Phase 4.

Decision numbering continues from Phase 5 (D-01 to D-104).

### Target directory shape

```
accord-ba/         SKILL.md  setup.md  story.md  ready.md
accord-dev/        SKILL.md  debug.md  review.md  code-review.md  prototype.md
accord-designer/   SKILL.md  prototype.md
```

Written under `.claude/skills/` and `.agents/skills/`, filtered by `roles:` and `runtimes:` in
`config.yml`.

</domain>

<decisions>
## Implementation Decisions

### Definition source and rendering

- **D-105:** One definition per role and per reference file, authored as Markdown with frontmatter
  under `packages/core/skills/`, turned into `packages/core/src/generated/skills.ts` by a
  `scripts/gen-skills.mjs` codegen. This is the D-27 templates precedent applied unchanged: the
  script lives outside `src/`, so Node built-ins are allowed there and core stays pure; the
  committed generated module is covered by a drift test the way `templates.ts` already is.
  Structured data in TypeScript (`{ name, description, steps: [] }`) was rejected because the
  deliverable is prose — authoring multi-paragraph workflow text inside string literals makes
  every content edit a TypeScript diff, which is the exact inversion the ROADMAP scope note warns
  against. Keeping `docs/skills/*.md` as the live source was rejected because `core` would be
  reading outside its own package and `docs/` is not in the published `files:` list.
  `docs/skills/debug.md` and `docs/skills/code-review.md` graduate into `packages/core/skills/`
  in the phase's first commit and stop being the source at that moment; the existing
  `.claude/skills/accord-debug/SKILL.md` comment already describes this move.
  — **Reversibility:** costly — changing the source shape later means re-authoring every
  definition, and the codegen output is a committed module other tests pin.

- **D-106:** Source frontmatter carries authoring keys beyond the spec fields — at minimum
  `kind: role | technique | reference` and `loads: [...]` naming which reference files a role
  pulls in — and the renderer strips everything outside the six spec fields before writing
  `SKILL.md`. A test asserts the rendered frontmatter contains nothing else. This is safe with
  respect to SKILL-10's unverified question about Codex and unknown frontmatter keys, because
  source frontmatter never ships: only the stripped output reaches a runtime directory. Holding
  the role↔reference relation in a separate table was rejected because it splits one skill's
  facts across two files, and deriving `name`/`description` from the filename and first line was
  rejected because `description` is the field a runtime reads to decide whether to load the skill
  at all — too load-bearing to infer.

- **D-107:** Rendering is a pure function in `core`: `renderSkill()` plus `skillTargets(config)`
  returning `{ path, text }[]`. The CLI contributes only the filesystem write. The original
  argument for this was that Phase 8's MCP host would call the same code; with the MCP server
  recorded as not needed (D-117) that argument is gone, and the decision stands on a narrower
  one — the definitions are already data in `core` by project constraint, the transform over them
  is pure, and placing it next to its data keeps it inside the core test suite at no extra cost.
  Rendering in `cli` would mean `cli` importing raw definitions and rebuilding them, for the same
  line count in a package that cannot be reused.

### Packaging and directory shape

- **D-108:** Techniques and the review brief are **bundled reference files inside the role's own
  directory**, referenced by relative path from that role's `SKILL.md` — not sibling skill
  directories, not inlined. The deciding argument is paths, not size: a sibling directory forces
  `SKILL.md` to name an absolute path that is correct in only one of the two target directories
  (`.claude/skills/` is not read by Codex, which reads `.agents/skills/` only), so either the
  renderer rewrites the path per target — two texts to maintain — or the reference is broken in
  one runtime. A relative path is correct everywhere. It also makes SKILL-09's "loaded by them
  rather than invoked as roles" literally true: a bundled file has no `name`/`description`, so no
  runtime discovers it on its own. Inlining was rejected on correctness: the fresh review context
  must receive `review.md` *and nothing else*, and an inlined `dev/SKILL.md` hands it the
  implementation workflow too — the precise leak the separation exists to prevent.
  — **Reversibility:** costly — this shape is what lands in every user repository; changing it
  later strands directories on disk that `sync` will not delete (D-113).

- **D-109:** The dev workflow's final step is written adaptively and names no runtime: open a fresh
  context — a subagent where the runtime provides one, otherwise a new session — and hand it
  `review.md`. One text, identical everywhere, which is what the Compatibility constraint requires
  and what `docs/design.md` §4 already anticipates. Always stopping for a human was rejected
  because a manual step on every ticket is a step people skip and no gate detects. Rendering a
  different sentence per target directory was rejected because it recreates the per-runtime drift
  SKILL-01 exists to eliminate.

- **D-119:** `prototype.md` is a single source in `core` declared in the `loads:` list (D-106) of
  **both** `designer` and `dev`, so it renders into `accord-designer/` and `accord-dev/` alike.
  Duplication is in the output, never in the source, and a test asserts the two copies are
  byte-identical. This is forced by two existing rules pulling against each other: `docs/design.md`
  §5 lets **Dev or Designer** produce `prototype.html` in the `maintain` profile, while D-113 has
  `sync` honour `roles:` — so a roster without `designer` writes no `accord-designer/` at all, and
  a `ui: true` ticket still needs the guidance. Cross-directory references were rejected for the
  same path reason as D-108.

- **D-125:** The BA's readiness review runs in a **fresh context**, the same shape as the dev
  workflow's plan review (SKILL-12) and code review — three instances of one pattern: clean
  context, narrow read, narrow write. Its brief is `ready.md`, bundled in `accord-ba/`. Running it
  inline was rejected because the BA agent would be grading acceptance criteria it had just
  written, which is the failure a fresh context exists to prevent. Dropping it and leaning on
  `accord gate ready` was rejected because the gate checks **presence** — intent non-empty, at
  least one EARS line, at least one tagged scenario — and cannot read whether the criteria cover
  the intent; SKILL-04 then forbids the skill from restating what the gate does check, so dropping
  the review would delete the step entirely rather than relocate it.

### `accord skills sync` (CLI-08)

- **D-111:** The generated marker is an HTML comment placed immediately **after** the closing
  frontmatter `---` — frontmatter must start at line 1 or Claude Code ignores it
  (`.planning/research/ARCHITECTURE.md` Pattern 3) — and it carries the content hash. The hash
  covers the whole rendered file **excluding the marker line itself**. This is the only variant
  that detects both kinds of divergence: a changed definition (fresh render differs from the file
  on disk) and a hand-edited copy (hash recomputed from the file differs from the hash stored in
  it). Hashing the source definition instead was rejected because a hand edit to the copy leaves
  the source hash untouched, which removes the one thing the hash is for. A sidecar manifest was
  rejected because the marker has to stay in the file for the human reader regardless, so the
  manifest buys nothing and adds a third state that can itself drift. The hash cannot live in
  frontmatter: SKILL-02 fixes the rendered frontmatter at the six spec fields.
  — **Reversibility:** costly — the marker and hash format is written into every repository that
  runs `init` or `sync`; changing it makes every existing copy read as drifted on the next run.

- **D-112:** `sync` overwrites and reports. Per file it prints one of `created`, `unchanged`,
  `updated`, or `overwrote local edits`, and exits 0. When the recomputed hash matches, the file is
  not touched at all — no write, no mtime change — which is what makes the ROADMAP's "a second run
  is a no-op" true at the byte level, and which reuses the compare-then-write shape D-96 already
  established for the `ac_hash` write. Overwriting is the contract the file itself states, git is
  a hard precondition of the CLI so nothing is unrecoverable, and `init` (Phase 7) calls the same
  function and must never be blocked. Refusing behind a `--force` flag was rejected because it
  adds a flag for a state the contract already declares invalid; silent overwrite was rejected
  because losing someone's work without saying so is the class of behaviour this whole project
  exists to prevent.

- **D-113:** `sync` **never deletes**. When a directory matching `accord-*` exists under a target
  path but is no longer declared by `roles:` and `runtimes:`, `sync` names it on stderr together
  with the command to remove it, and exits unchanged. An orphaned skill does keep loading in the
  runtime until someone cleans it up, which is why saying nothing was rejected; automatic deletion
  was rejected because it removes files under a user's repository, and the directory may hold
  additions the generator never wrote.

- **D-121:** `skills sync` requires `config.yml` and checks the version pin exactly as every other
  repository-reading command does (D-95). `init` therefore writes `config.yml` **first** and then
  calls the same shared function — the pin matches by construction, because `init` writes the
  running CLI's own version. A config-free mode defaulting to every role and every runtime was
  rejected as a branch and a default nobody asked for, and one that makes D-113's filtering
  meaningless. `init` writing the files itself was rejected outright: two write paths is the drift
  this phase exists to remove.
  — **Reversibility:** costly — the ordering is a contract Phase 7's `init` is built against.

- **D-123:** accord never touches, counts, or comments on skills it did not generate. `sync` and
  `init` read, write, and report on `accord-*` directories only. Warning when a skills directory
  already holds many entries was rejected on two grounds: inspecting another tool's files and
  editorialising about them is outside accord's boundary, and a warning is what an agent ignores —
  the same reasoning D-94 used to make the version pin a hard refusal. This closes the question
  `.planning/notes/solo-reaim-and-three-layer-done.md` deliberately left open for "Phase 6/7":
  whether `init` should replace an existing skill surface rather than stack on it. It does
  neither; the answer is an operational choice for whoever runs `init`, not behaviour in the code.

### Workflow content

- **D-114:** `SKILL.md` is one page: the ordered steps and the CLI calls, nothing more. Technique
  and procedure detail lives in bundled reference files that the relevant step points to — the
  same mechanism as D-108, so the phase introduces no second concept. One long file per role was
  rejected because the BA definition would carry intent, EARS, Gherkin, glossary, business rules,
  the readiness review, and epic setup, and a runtime would load all of it to change one line of
  acceptance criteria. A pointer-only `SKILL.md` was rejected because the workflows have to carry
  what a general planning system carried (ROADMAP criterion 6), and pointers do not.

- **D-118:** `ba` is one definition with a branch at its first step, not two skills. After the
  opening gate call it reads `config.profile`; a `build` profile with an empty `product/` takes the
  setup branch (`setup.md` — glossary, business rules, one epic ticket per epic via
  `accord new ticket <id> --type epic`, which D-104 already ships), and everything else takes the
  per-story branch (`story.md` — intent, EARS, Gherkin, the readiness review). The branch follows
  `docs/design.md` §3, where week zero and per-story work are genuinely different activities.
  Splitting into `ba` and `ba-setup` was rejected as a violation of SKILL-01's one-definition-per-
  role rule; dropping the setup branch was rejected because ROADMAP criterion 6 names project and
  epic setup explicitly.

- **D-120:** The dev workflow teaches `## Plan` as **vertical slices, one step per `@ac-n` by
  default**, merged where one change serves several scenarios and split where one scenario needs
  several steps. No ceiling on step count. This is what lint already forces (D-74:
  `lint.plan-step-untagged` requires every step to carry an `@ac-n`, and `lint.plan-tags-differ`
  requires the plan's tag set to equal the scenario tag set), so the skill states the shape rather
  than inventing one. Teaching technical layers (schema → core → CLI → test) was rejected because
  the "test" step would then carry every tag, and because SKILL-12's review looks **for** wrong
  layering — the layer is what that review judges, so it must not be what the plan is forced into.
  Teaching nothing was rejected because SKILL-12 has to review for "wrong order" against some
  standard.

- **D-122:** Skill text is written for a coding agent working alongside the author. `ba`, `dev`,
  and `designer` are the names of **stages one person and their agent pass through**, not job
  titles for four people. This follows the re-aim recorded in
  `.planning/notes/solo-reaim-and-three-layer-done.md` (2026-09-11), whose own line — *"workflow
  definitions kept, context reworded"* — is work nobody has done yet and which belongs to this
  phase. Neutral team-or-solo phrasing was rejected because text aimed between two readers serves
  neither, and the non-technical reader lost their route in when the MCP server was dropped.
  See the debt note under D-117: `.planning/PROJECT.md` "What This Is" and `.planning/REQUIREMENTS.md`
  still describe a team contract with a non-technical BA, and that language now conflicts with the
  text this phase ships.

- **D-126:** `designer/SKILL.md` is deliberately thin: establish whether the ticket is `ui: true`,
  choose a design link or a prototype according to the profile, and run the gate; the substance is
  in the shared `prototype.md` (D-119). Padding it with token-file and `Derived from:` guidance was
  rejected because those are lint rules the CLI already enforces (LINT-04), and SKILL-04 forbids a
  skill from restating an enforced rule. Removing the role was rejected because `designer` is in
  the `roles` enum of `packages/core/schemas/config.schema.json` and SKILL-01 requires three
  definitions.

- **D-127:** All skill text — `SKILL.md` and every bundled reference — is written in English. The
  package is public and MIT, and the existing drafts in `docs/skills/` are already English. This
  constrains only accord's own shipped text: user content stays free-form, and Vietnamese scenario
  names remain first-class (they are the worked example in `packages/core/src/model/snapshot.ts`
  and the reason D-A rejected slugging test ids from scenario names). A per-language render keyed
  off config was rejected as duplicated content — the failure SKILL-01 exists to prevent — for a
  requirement nobody has raised.

- **D-128:** All three skills open with `accord gate ready <id>`, satisfying SKILL-04's "every
  skill begins with a lint or gate call". Each stage reads the same output for its own purpose:
  `ba` to see what is still missing, `dev` to refuse to start on a ticket that is not Ready,
  `designer` to see whether a design reference is what is missing. One command with three readings
  beats three commands: a repository-wide `accord lint` is noise to someone working one ticket.

### Proof and tests

- **D-110:** The SKILL-08 scanner covers `SKILL.md` **and every bundled reference file** — a CLI
  command named in `debug.md` is as able to be wrong as one named in `SKILL.md`. Alongside it, a
  second assertion: every relative path a rendered skill references resolves to a file present in
  the render output. A dead `./debug.md` breaks the workflow silently, and D-108 makes relative
  references the load-bearing mechanism of the whole layout.

- **D-115:** ROADMAP criterion 7 — *"a fixture whose plan targets the wrong layer or the wrong
  order comes back changed"* — is proved in two parts, because its subject is model behaviour and
  the "No API keys" constraint rules out running a model inside the test suite. (1) CI asserts the
  structure: `dev` carries a plan-review step, it states that the step reads no code and edits only
  `## Plan`, and it precedes the implementation step; the deliberately wrong-plan fixture is
  checked in. (2) The phase's verification runs that fixture through the dev skill by hand once and
  records the `## Plan` before and after. Structural-only was rejected because it proves the text
  exists rather than that the behaviour happens — precisely the gap this product exists to close.
  Rewriting the criterion to fit the tooling was rejected as lowering the phase to match the
  instrument.

- **D-129:** A test asserts a line-count ceiling on each rendered `SKILL.md` — 120 lines proposed,
  the planner may set the number — with bundled reference files unbounded. D-114's "one page" is
  editorial prose and will drift without a number behind it; the repository already lints ticket
  sizes, so a size rule is an established shape here rather than a new idea.

### FINDING — an open question raised after Ready is invisible to every gate

Verified in code, not inferred. `packages/core/src/gate/rules.ts:98` defines
`READY_PROMOTE = ['lint.sentinel', 'lint.open-question', 'lint.assumption-unconfirmed']`, which
promotes those findings to errors **for Ready only**. The Done rule table contains no open-question
rule, and adding an item to `## Open questions` does not change `acHash` (which covers `@ac-n` tags
and steps only, per D-77 and `packages/core/src/gate/hash.ts`). So the sequence
`docs/design.md` §4 prescribes — *"A gap goes to `## Open questions` and work stops until the BA
answers"* — has no gate behind it once a ticket is past Ready.

- **D-124:** Phase 6 does not change the gate. The dev workflow writes the question into
  `## Open questions`, stops, and re-runs `accord gate ready <id>`, which fails on the spot. The
  limit is recorded honestly rather than hidden: a failing Ready does not remove the recorded
  `ac_hash` (D-96 writes only on a pass), so `accord status` still shows `Ready: ok` and the stop
  leaves no durable trace. **Owner decision required, out of this phase's scope:** whether to add
  `lint.open-question` and `lint.assumption-unconfirmed` to the Done gate's promoted set. The
  mechanism already exists; the cost is reopening a phase that is closed and verified, and moving
  gate behaviour after Phase 4's goldens were accepted.

### Claude's Discretion

- Module layout under `packages/core/src/skills/` and the exact signatures of `renderSkill()` and
  `skillTargets()`, following the shape `lint/` and `gate/` established.
- The exact filenames under `packages/core/skills/` and whether role and reference files sit in one
  flat directory or a directory per role.
- The marker's exact wording and hash algorithm. FNV-1a is already hand-written in
  `packages/core/src/gate/hash.ts` and is the obvious reuse, but nothing binds this hash to that
  one — they answer different questions and may diverge.
- The wording of every `sync` status line, subject to D-112's four states being distinguishable and
  D-113 naming the cleanup command.
- The number behind D-129, and whether the ceiling counts lines or bytes.
- Whether the SKILL-08 command scanner reads the command list from commander's own registry or from
  a literal list, provided a new command cannot be added without the test seeing it.
- The fixture layout for the wrong-plan fixture (D-115) and whether it lives under
  `packages/core/test/fixtures/` or beside the skill tests.
- Which reference file each individual step of each workflow points to — the split between
  `SKILL.md` and its references within the D-114 rule.

### Folded Todos

- **`.planning/todos/pending/rejected-alternatives-have-no-home.md`** — folded. The problem: a
  ticket records the decision that won and never what was rejected, so the next session re-proposes
  it and no gate objects. **D-116:** resolved as a **convention the BA workflow teaches**, not a
  format change — a `Rejected: <option> — <reason>` line in `product/business-rules.md` beside the
  rule it explains, with one guidance line added to
  `packages/core/templates/business-rules.md`. Widening `assumptions[]` to
  `{ text, confirmed, instead_of? }` was rejected for this phase: `ticket.schema.json` is
  `additionalProperties: false`, so the change would reach the templates and the Phase 1–2 fixtures
  and goldens, inside the phase the ROADMAP already calls the heaviest. The todo's own constraints
  are respected — ROADMAP criterion 6 forbids a new artifact, `docs/design.md` §2 caps size, and
  `business-rules.md` is already the documented home for "rules, thresholds, rounding, edge cases
  already decided".

- **`.planning/todos/pending/mcp-host-spike.md`** — folded only to be **closed**, and the surviving
  debt recorded. **D-117:** the spike is not run in this phase. `.planning/notes/solo-reaim-and-
  three-layer-done.md` records the MCP server as not needed, and `03-CONTEXT.md:146`,
  `04-CONTEXT.md:172`, and `05-CONTEXT.md:165` each carry that forward while each declining to act,
  with the identical sentence that removing it is a roadmap-level change for `/gsd-phase`. Three
  phases of deferral have left the removal undone, and the residue is real and named here so the
  fourth does not repeat it:
  - `.planning/ROADMAP.md` still contains Phase 8 (MCP Server), and Phase 9 depends on it.
  - `.planning/PROJECT.md` milestone v0.1 criterion 2 still requires the MCP server deployed and
    reachable from a chat client — so **Phase 9 cannot close as written**.
  - `.planning/REQUIREMENTS.md` MCP-01 to MCP-07 are still Pending.
  - `.planning/PROJECT.md` "What This Is" and the REQUIREMENTS active list still describe a team
    contract with a non-technical BA, which now conflicts with D-122.

  None of this blocks Phase 6, and no Phase 6 deliverable changes either way. **Owner action:**
  run `/gsd-phase` to remove Phase 8, move MCP-01..07 to Out of Scope, and rewrite milestone
  criterion 2 — before Phase 7 completes, since Phase 9's closure depends on it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product intent and requirements
- `.planning/ROADMAP.md` Phase 6 — the goal, the seven success criteria, and the scope note that
  governs how to plan this phase ("content work with a rendering step, not the reverse")
- `.planning/REQUIREMENTS.md` — SKILL-01 to SKILL-09, SKILL-12, CLI-08 are this phase. SKILL-10 and
  SKILL-11 sit in the later-work list and must not be pulled forward; CLI-01/02/03 and INTG-02 are
  Phase 7
- `.planning/PROJECT.md` — the "Compatibility", "Independence", and "No other tools named"
  constraints, all three of which bind skill *text*, not only code; the Key Decisions rows on one
  definition per role and on `init` copying into two paths
- `.planning/notes/solo-reaim-and-three-layer-done.md` — the 2026-09-11 re-aim behind D-122
  ("workflow definitions kept, context reworded"), the Phase 8 row behind D-117, and the
  deliberately-deferred "replace or stack the skill surface" question that D-123 answers
- `docs/design.md` §4 — role ownership, the reviewer that is not a role, the two techniques loaded
  by role workflows, and the solo reading of the four roles
- `docs/design.md` §5 — the Ready and Done tables the skills must not restate (SKILL-04), and the
  Dev-or-Designer prototype rule behind D-119
- `docs/design.md` §3 — week zero versus per-story BA work, the split behind D-118
- `docs/design.md` §2 — the folder convention and the size rule ("if the spec is longer than the
  code, the spec is wrong")

### Runtime and rendering facts
- `.planning/research/ARCHITECTURE.md` Pattern 3 — the runtime→directory table (Claude Code
  `.claude/skills/` only; Codex `.agents/skills/` only; Cursor and Copilot read both), the
  two-copies conclusion, the marker-after-frontmatter rule, the no-symlinks rule on Windows, and
  Anti-Pattern 3 (per-runtime skill templates). **Re-verify the directory table and Codex's
  handling of unknown frontmatter keys at research time** — ROADMAP marks this phase "Research:
  light" for exactly that reason, and the sources there are from 2025-12 onward
- `.planning/research/PITFALLS.md` §12 — Windows constraints: forward-slash paths, ASCII output,
  spawn only `.exe` binaries

### Prior phase decisions this phase depends on
- `.planning/phases/05-cli-commands/05-CONTEXT.md` — D-94/D-95 (the pin as a hard refusal on every
  config-reading command, which D-121 extends to `sync`), D-96 (compare-then-write, reused by
  D-112), D-98 (`--json` prints the core object verbatim), D-104 (`new ticket --type epic`, used by
  the BA setup branch in D-118), and the Integration Points note that named this phase's binding to
  the command surface
- `.planning/phases/04-gates/04-CONTEXT.md` — D-77 (`acHash` covers `@ac-n` tags and steps only, so
  `@test:` added after Ready is outside it), D-88 (the profile matrix), D-86 (`gateReady` purity)
- `.planning/phases/03-lint/03-CONTEXT.md` — D-69 (the developer adds `@test:` after Ready; already
  settled, not a Phase 6 question), D-74 (the `## Plan` tag rules behind D-120), D-60 (`renderText`)
- `.planning/phases/01-workspace-and-formats/01-CONTEXT.md` — D-27, the templates codegen precedent
  D-105 copies

### Existing code this phase extends
- `packages/core/scripts/gen-templates.mjs` — the codegen D-105 mirrors; `packages/core/src/generated/templates.ts` and `packages/core/test/templates.test.ts` are the drift-test shape to copy
- `packages/core/src/index.ts` — the public API surface `renderSkill()` and `skillTargets()` join
- `packages/core/schemas/config.schema.json` — `roles` (enum `ba|dev|designer`, `ba` and `dev`
  required) and `runtimes` (enum `claude|codex|cursor|copilot`, `minItems: 1`); both are `required`,
  which is why D-113 and D-121 honour them
- `packages/core/src/gate/rules.ts:98` — `READY_PROMOTE`, the line the D-124 finding rests on
- `packages/core/src/gate/hash.ts` — `acHash`/`hashInput` and the FNV-1a implementation; the
  worked precedent for hashing in a pure core without `node:crypto`
- `packages/cli/src/index.ts` and `packages/cli/src/commands/` — the commander spine `skills sync`
  is added to, and the command list SKILL-08's test must not be able to miss
- `packages/cli/src/load/fs.ts` — `UsageError` with `exitCode = 2`, the channel D-121's pin check
  and any `sync` environment error raise
- `packages/core/templates/business-rules.md` — gains the D-116 guidance line
- `docs/skills/debug.md`, `docs/skills/code-review.md` — the two drafts that graduate into
  `packages/core/skills/` under D-105
- `.claude/skills/accord-debug/SKILL.md`, `.claude/skills/accord-code-review/SKILL.md` — the
  hand-maintained copies this repository currently carries; deleted in the graduation commit per
  D-121

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/scripts/gen-templates.mjs` is 20 lines and already does exactly what D-105 needs
  minus the frontmatter split: read a directory, strip BOM, normalise CRLF to LF, emit a
  `JSON.stringify`-quoted object into a generated module. `gen-skills.mjs` is that file plus a
  frontmatter split.
- `packages/core/test/templates.test.ts` already proves the committed generated module matches its
  sources. The same test shape covers `skills.ts`, which is what keeps `npm run gen` honest — the
  root `package.json` deliberately has no `prebuild`/`pretest` auto-regeneration (01-01-PLAN), so
  the drift test is the only signal.
- `acHash`/`hashInput` in `packages/core/src/gate/hash.ts` is a working FNV-1a over `TextEncoder`
  and `BigInt`, written specifically because `node:crypto` is banned in core. D-111's hash can copy
  that approach directly; the two hashes answer different questions and need not share a function.
- `UsageError` (`packages/cli/src/load/fs.ts`) with `readonly exitCode = 2` is the existing exit-2
  channel for the D-121 pin check and for any filesystem failure during `sync`.
- `accord new ticket <id> --type epic` (D-104) already scaffolds an epic from `epic.md`, so D-118's
  BA setup branch invokes an existing command rather than describing a manual file copy.
- `packages/core/templates/` already holds `glossary.md` and `business-rules.md`, so the BA setup
  branch has templates to name.

### Established Patterns
- Core stays pure: no `node:*` import under `packages/core/src`, enforced by ESLint and by
  `packages/core/test/purity.test.ts`. Codegen scripts live outside `src/`, which is precisely the
  exemption D-105 relies on.
- `path.posix` everywhere; no `\` in any printed path or any file content. Every path `sync`
  reports and every relative reference inside a skill is forward-slash.
- Output is LF and UTF-8 without BOM — a hard requirement for skill files specifically, since the
  runtime research records that skill files must be LF-only.
- Decisions are cited by number in code comments (`// D-111: ...`).
- Goldens are JSON of a structured result, never ANSI text. `sync`'s reported statuses should be a
  structured result the text renderer prints, not strings assembled at the print site.

### Integration Points
- Phase 7's `init` calls the same render + write function `skills sync` calls (D-121), after it has
  written `config.yml`. Everything `sync` learns about `roles:`/`runtimes:` filtering, the marker,
  and the per-file status report is what `init` will report too.
- The command surface fixed in Phase 5 is what the skills bind to, and SKILL-08's test is the guard
  on that binding in both directions: a skill naming a command that does not exist fails, and the
  test must be unable to miss a command added later.
- `packages/core/templates/business-rules.md` gains one line under D-116, which means the
  `gen-templates` drift test and the template goldens move in this phase — a small, expected
  ripple into Phase 1 artifacts.

</code_context>

<specifics>
## Specific Ideas

- Final directory shape, in both target paths:
  `accord-ba/` = `SKILL.md`, `setup.md`, `story.md`, `ready.md`;
  `accord-dev/` = `SKILL.md`, `debug.md`, `review.md`, `code-review.md`, `prototype.md`;
  `accord-designer/` = `SKILL.md`, `prototype.md`.
- Every `SKILL.md` step 1 is `accord gate ready <id>` (D-128).
- The marker sits on the first line after the closing `---` and carries both the do-not-edit notice
  and the hash, e.g. `<!-- generated by accord skills sync — do not edit — fnv1a64:… -->`.
- `sync` output is one line per file with a leading status word, and a final line naming any
  orphaned `accord-*` directory plus the command to remove it.
- The three fresh-context reviews share one shape and should read as three instances of it:
  BA readiness (`ready.md`), dev plan review (SKILL-12, before implementing), dev code review
  (`review.md` + `code-review.md`, after implementing).
- The D-116 convention line, as the BA skill would teach it:
  `Rejected: <option> — <reason>`, directly beneath the rule it explains in
  `product/business-rules.md`.

</specifics>

<deferred>
## Deferred Ideas

- **Adding `lint.open-question` and `lint.assumption-unconfirmed` to the Done gate's promoted set**
  — the D-124 finding. Mechanism exists (`READY_PROMOTE` in `packages/core/src/gate/rules.ts:98`);
  cost is reopening Phase 4 after it closed and verified. Owner decision, not Phase 6 work.
- **Removing ROADMAP Phase 8, MCP-01..07, and PROJECT.md milestone criterion 2** — D-117. Deferred
  three phases running; needs `/gsd-phase`, and must land before Phase 7 completes because Phase 9's
  closure depends on it.
- **Rewording `.planning/PROJECT.md` "What This Is" and the REQUIREMENTS active list from team
  contract to the solo re-aim** — surfaced by D-122; the shipped skill text and the project
  description will otherwise disagree with each other.
- **SKILL-11, `lint` detecting drift between copies and definition** — already parked in
  REQUIREMENTS under later work. D-111's hash is what makes it cheap when it comes.
- **SKILL-10, `disable-model-invocation` on gate skills** — blocked on verifying how Codex handles
  unknown frontmatter keys; the research step of this phase may settle the fact without the phase
  acting on it.
- **Widening `assumptions[]` to `{ text, confirmed, instead_of? }`** — the structured alternative
  D-116 rejected. Revisit if the prose `Rejected:` convention proves too weak in real use; it is a
  schema change with Phase 1–2 golden ripple, so it wants evidence first.
- **A per-language render of skill text** — rejected under D-127. Revisit only if a real user
  cannot work from English skills.
- **Techniques as independently invocable skills** — the author loses `/accord-debug` and
  `/accord-code-review` as standalone skills under D-108 and D-121. Revisit only if working without
  them in this repository proves worse than the drift a second copy would create.

### Reviewed Todos (not folded)
None — both matched todos were folded (see Folded Todos above; `mcp-host-spike.md` is folded in
order to be closed, not to be executed).

</deferred>

---

*Phase: 06-skills*
*Context gathered: 2026-09-15*
