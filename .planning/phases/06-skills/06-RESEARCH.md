# Phase 6: Skills - Research

**Researched:** 2026-09-15
**Domain:** Agent Skills packaging (SKILL.md spec, four-runtime discovery), deterministic rendering and idempotent file sync in a pure TypeScript core
**Confidence:** HIGH on the two deferred facts; MEDIUM on the rendering/sync mechanics recommendations (they are design calls inside settled constraints, not external facts)

<user_constraints>
## User Constraints (from CONTEXT.md)

> **Planner: read `.planning/phases/06-skills/06-CONTEXT.md` in full.** The `<decisions>` block
> there is ~290 lines of load-bearing rationale and is *not* reproduced verbatim here. The index
> below is complete — every locked decision in CONTEXT.md appears in it, so none can be missed —
> and the decisions this research touches, corrects, or confirms are quoted verbatim in the
> sections that follow.

### Locked Decisions (complete index)

| ID | Ruling (one line) |
|----|-------------------|
| D-105 | Definitions authored as Markdown+frontmatter under `packages/core/skills/`; `scripts/gen-skills.mjs` emits `packages/core/src/generated/skills.ts`; drift test like `templates.ts`. `docs/skills/debug.md` and `code-review.md` graduate in the phase's first commit. |
| D-106 | Source frontmatter carries authoring keys (`kind: role \| technique \| reference`, `loads: [...]`); the renderer strips everything outside the six spec fields; a test asserts rendered frontmatter contains nothing else. |
| D-107 | Rendering is a pure function in `core`: `renderSkill()` + `skillTargets(config)` → `{ path, text }[]`. The CLI contributes only the filesystem write. |
| D-108 | Techniques and the review brief are **bundled reference files inside the role's own directory**, referenced by relative path — not sibling skill directories, not inlined. |
| D-109 | The dev workflow's final step names no runtime: open a fresh context — a subagent where the runtime provides one, otherwise a new session — and hand it `review.md`. One text, identical everywhere. |
| D-110 | The SKILL-08 scanner covers `SKILL.md` **and every bundled reference file**; plus a second assertion that every relative path a rendered skill references resolves to a file present in the render output. |
| D-111 | Generated marker is an HTML comment immediately **after** the closing frontmatter `---`, carrying the content hash. Hash covers the whole rendered file **excluding the marker line itself**. |
| D-112 | `sync` overwrites and reports: per file one of `created`, `unchanged`, `updated`, `overwrote local edits`; exits 0. When the hash matches, the file is **not touched at all**. |
| D-113 | `sync` **never deletes**. An `accord-*` directory no longer declared by `roles:`/`runtimes:` is named on stderr with the command to remove it; exit unchanged. |
| D-114 | `SKILL.md` is one page: the ordered steps and the CLI calls, nothing more. Technique and procedure detail lives in bundled reference files. |
| D-115 | ROADMAP criterion 7 proved in two parts: (1) CI asserts the structure + checked-in wrong-plan fixture; (2) phase verification runs that fixture through the dev skill by hand once and records `## Plan` before and after. |
| D-116 | Rejected alternatives are a **convention the BA workflow teaches**: a `Rejected: <option> — <reason>` line in `product/business-rules.md` beside the rule it explains; one guidance line added to `packages/core/templates/business-rules.md`. |
| D-117 | The MCP host spike is not run in this phase; the residue (ROADMAP Phase 8, MCP-01..07, PROJECT.md milestone criterion 2) is recorded as owner action, not Phase 6 work. |
| D-118 | `ba` is one definition with a branch at its first step: `build` profile + empty `product/` → setup branch (`setup.md`); everything else → per-story branch (`story.md`). |
| D-119 | `prototype.md` is a single source declared in the `loads:` list of **both** `designer` and `dev`; a test asserts the two rendered copies are byte-identical. |
| D-120 | The dev workflow teaches `## Plan` as **vertical slices, one step per `@ac-n` by default**, merged/split as the work demands. No ceiling on step count. |
| D-121 | `skills sync` requires `config.yml` and checks the version pin exactly as every other repository-reading command does. `init` writes `config.yml` **first**, then calls the same shared function. |
| D-122 | Skill text is written for a coding agent working alongside the author. `ba`, `dev`, `designer` are **stages one person and their agent pass through**, not job titles for four people. |
| D-123 | accord never touches, counts, or comments on skills it did not generate. `sync` and `init` read, write, and report on `accord-*` directories only. |
| D-124 | Phase 6 does **not** change the gate. The dev workflow writes the question into `## Open questions`, stops, and re-runs `accord gate ready <id>`. The recorded limit is an owner decision, out of scope. |
| D-125 | The BA's readiness review runs in a **fresh context**; its brief is `ready.md`, bundled in `accord-ba/`. |
| D-126 | `designer/SKILL.md` is deliberately thin; the substance is in the shared `prototype.md`. |
| D-127 | All skill text — `SKILL.md` and every bundled reference — is written in English. |
| D-128 | All three skills open with `accord gate ready <id>`. Each stage reads the same output for its own purpose. |
| D-129 | A test asserts a line-count ceiling on each rendered `SKILL.md` — 120 lines proposed, the planner may set the number — with bundled reference files unbounded. |

### Claude's Discretion (verbatim from CONTEXT.md)

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

### Deferred Ideas (OUT OF SCOPE — verbatim from CONTEXT.md)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKILL-01 | One workflow definition per role as data: `ba`, `dev` (with `review.md`), `designer` | Directory table confirmed (Fact 1) — one definition genuinely covers all four runtimes; no per-runtime variant is needed. Spec `name` must match parent dir → `accord-ba`/`accord-dev`/`accord-designer` are all valid spec names. |
| SKILL-02 | Renderer produces `SKILL.md` with only the six spec frontmatter fields | **The six fields are now named from the spec** (Fact 3): `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. Only `name` and `description` are required — "only the six" is an allowlist, not a mandate to emit all six. |
| SKILL-03 | Copies land in `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/`, covering all four runtimes | Fact 1 re-verified against current official docs for all four runtimes. Two copies is still correct and still minimal. |
| SKILL-04 | Every skill begins with a lint or gate call; never restates a rule the CLI enforces | Command surface read from `packages/cli/src/run.ts`; the five existing commands plus `skills sync` are the complete set a skill may name. |
| SKILL-05 | BA workflow interviews until no open questions remain; marks the ticket `draft` until then | `READY_PROMOTE` at `packages/core/src/gate/rules.ts:98` is the enforcement the skill must point at rather than restate (per SKILL-04). |
| SKILL-06 | Dev workflow's final step runs the review in a fresh context that writes only `verification.md` | Spec's progressive disclosure model confirms why D-108's bundled `review.md` is the right container — the body of `SKILL.md` is loaded on activation, referenced files only on demand. |
| SKILL-07 | Only the developer writes `verified` in frontmatter | Gate mechanics already shipped (Phase 4); the skill states ownership, not the rule. |
| SKILL-08 | A test asserts every CLI command named in a skill exists | `packages/cli/test/spawn-surface.test.ts` is the working precedent for a source-scanning test with a guard-the-guard assertion. Two implementation options compared below. |
| SKILL-09 | Two techniques render alongside role skills, loaded by them rather than invoked as roles | **Mechanism corrected:** discovery is by *filename* (`SKILL.md`), not by presence of frontmatter — so a bundled `debug.md` is undiscoverable in every one of the four runtimes. Stronger guarantee than D-108 claims. |
| SKILL-12 | Dev workflow reviews `## Plan` in a fresh context before implementing | D-115's two-part proof is sound; the structural half is a text assertion over rendered output, which the render pipeline makes cheap. |
| CLI-08 | `skills sync` regenerates skill copies with a generated marker and content hash | Marker-after-frontmatter rule verified in Codex source (Fact 2b). CRLF/BOM normalisation before hashing is a hard requirement — see Pitfall 1. |
</phase_requirements>

## Summary

The two facts the ROADMAP deferred to research time both resolve cleanly, and both resolve in
favour of the plan already written. The four-runtime directory table in
`.planning/research/ARCHITECTURE.md` Pattern 3 is **still correct** as of today: Claude Code reads
`.claude/skills/` and not `.agents/skills/`; Codex reads `.agents/skills/` and not `.claude/skills/`;
Cursor and Copilot each read both. Two copies remains the minimal covering set, and no symlink is
needed or wanted. Codex **silently ignores unknown frontmatter keys** — verified in the OpenAI
source, not inferred — which unblocks SKILL-10 as a fact without this phase acting on it.

The six Agent Skills spec frontmatter fields are `name`, `description`, `license`, `compatibility`,
`metadata`, and `allowed-tools`. Only the first two are required. This matters for SKILL-02's
reading: "frontmatter contains only the six spec fields" is an allowlist the renderer must not
exceed, not a list it must fill. The spec also blesses D-108 directly — relative file references
from `SKILL.md`, kept one level deep, are the documented pattern — and it gives an upper bound for
D-129 (the spec recommends `SKILL.md` under 500 lines), against which D-129's proposed 120 is
comfortably conforming.

One correction the planner needs: **D-111's stated reason is wrong, though its decision survives.**
D-111 says "The hash cannot live in frontmatter: SKILL-02 fixes the rendered frontmatter at the six
spec fields." But `metadata` *is* one of the six, and the spec explicitly says clients may use it to
store properties the spec does not define — so a hash at `metadata.accord-hash` would satisfy
SKILL-02. The decision still stands, on a better reason: the bundled reference files (`review.md`,
`debug.md`, `prototype.md`) have **no frontmatter at all**, and D-110 requires them to be covered by
the same drift mechanism. A frontmatter-resident hash has no home in those files, so the HTML-comment
marker has to exist regardless — and two hash mechanisms is worse than one.

**Primary recommendation:** plan this as content work with a mechanical rendering step, exactly as
the ROADMAP says; the rendering half has no unresolved technical question left, and the only two
technical traps worth budgeting for are CRLF normalisation before hashing (Pitfall 1) and making the
SKILL-08 command scanner structurally unable to miss a new command (Pitfall 2).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authoring workflow prose | `packages/core/skills/*.md` (source data) | — | D-105: the deliverable is prose, so it is authored as prose, not as TypeScript string literals. |
| Turning source `.md` into a module | `packages/core/scripts/gen-skills.mjs` (codegen, outside `src/`) | — | Node built-ins are allowed outside `src/` — the D-27 exemption `gen-templates.mjs` already relies on. |
| Stripping non-spec frontmatter; assembling `SKILL.md` text | `packages/core/src/skills/` (pure) | — | D-106 + D-107: a pure transform over data that already lives in core. |
| Deciding *which* files go *where* | `skillTargets(config)` in core (pure) | — | D-107. The `roles:`/`runtimes:` filtering (D-113, D-121) is a function of config, which core already holds. |
| Content hashing | core (pure, hand-written FNV-1a) | — | `node:crypto` is banned in core (CORE-01); `packages/core/src/gate/hash.ts` is the working precedent. |
| Reading and writing files under the repo | `packages/cli/src/commands/skills.ts` | `packages/cli/src/load/fs.ts` (`UsageError`) | D-107: the CLI contributes only the filesystem write. |
| Version pin refusal on `skills sync` | `preflight()` in `packages/cli/src/run.ts` (already built) | — | D-121 extends D-95's existing shared preflight; no new mechanism. |
| Discovering and loading the rendered skill | The four agent runtimes (filesystem contract only) | — | accord makes no API call; the contract is a directory layout and a filename. |
| Proving a skill names only real commands | vitest, `packages/cli/test/` | — | SKILL-08/D-110. The command registry lives in the CLI package, so the test does too. |

## Standard Stack

**This phase adds no dependency.** Everything it needs is already installed and already settled in
`.claude/CLAUDE.md`. No comparison is offered because no choice is open.

### Core (all already present)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` | 2.9.0 | Parse source-definition frontmatter in `gen-skills.mjs`; serialise the six rendered fields | Already the project's YAML parser (`packages/core/src/load/yaml.ts`); core-schema + `customTags` semantics are settled and tested. `[VERIFIED: packages/core/test/templates.test.ts:19-21]` |
| `commander` | 15.0.0 | Register `skills sync` on the existing spine | `packages/cli/src/run.ts` already nests `gate ready`/`gate done` and `new ticket`; `skills sync` is the same shape. `[VERIFIED: packages/cli/src/run.ts:72-105]` |
| `vitest` | 5.0.0 | Drift test, frontmatter allowlist test, command scanner, byte-identity test | Root `vitest.config.ts` runs projects `packages/core` and `packages/cli`. `[VERIFIED: vitest.config.ts]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` `readdirSync`/`readFileSync`/`writeFileSync` | built-in | `gen-skills.mjs` reads sources; the CLI writes rendered output | Codegen script and `packages/cli/src/` only — never under `packages/core/src/`. |
| `node:path` `posix` | built-in | Every path `sync` prints or embeds in a skill | D-51 invariant; `spawn-surface.test.ts` already fails CI on a stray backslash. |

**Installation:** none. `npm install` is not part of this phase.

**Version verification:** not performed — this phase introduces no package, so there is no registry
claim to verify. The versions above are read from the installed tree
(`npm ls vitest` → `vitest@5.0.0`) and from the root `package.json`. `[VERIFIED: package.json devDependencies]`

## Package Legitimacy Audit

**Not applicable.** This phase installs no external package, so the Package Legitimacy Gate has
nothing to check.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — phase adds no dependency)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## The Two Deferred Facts

These are the "light research" mandate from the ROADMAP. Both are settled.

### Fact 1 — The four-runtime skill directory table (re-verified)

The table in `.planning/research/ARCHITECTURE.md` Pattern 3 is **confirmed unchanged**. Every row was
re-fetched from that runtime's own current documentation this session.

| Runtime | Project-level directories scanned | Reads `.claude/skills/`? | Reads `.agents/skills/`? | Source |
|---------|-----------------------------------|--------------------------|--------------------------|--------|
| Claude Code | `.claude/skills/<skill-name>/SKILL.md`, plus nested `<subdir>/.claude/skills/`, plus any dir passed with `--add-dir` | **yes** | **no** | `[CITED: code.claude.com/docs/en/skills]` |
| Codex CLI | `$CWD/.agents/skills`, `$CWD/../.agents/skills`, `$REPO_ROOT/.agents/skills` | **no** | **yes** | `[CITED: learn.chatgpt.com/docs/build-skills]` |
| Cursor | `.agents/skills/`, `.cursor/skills/` (primary); `.claude/skills/`, `.codex/skills/` (backward compatibility); walks recursively | yes | yes | `[CITED: cursor.com/docs/skills]` |
| GitHub Copilot | `.github/skills`, `.claude/skills`, `.agents/skills` | yes | yes | `[CITED: docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills]` |

**Conclusion — the two-copies decision stands unchanged.** `.claude/skills/accord-<role>/` is
required by and only by Claude Code; `.agents/skills/accord-<role>/` is required by and only by
Codex; Cursor and Copilot are covered by either. Two directories is the minimal covering set, and
there is no third path any runtime needs. `[VERIFIED: cross-checked across four independent official docs]`

**Symlinks stay rejected.** Codex documents that it "supports symlinked skill folders and follows the
symlink target" `[CITED: learn.chatgpt.com/docs/build-skills]`, so a symlink would work *there* — but
the project develops on Windows, where creating one requires Developer Mode or elevation, and
`.planning/research/PITFALLS.md` §12 already rules them out. Two real directories, written by the
same pure render, is the correct call. No change.

**One consequence the ARCHITECTURE.md table implies but does not state:** because Cursor and Copilot
read *both* paths, they will each discover `accord-ba` (and `accord-dev`, `accord-designer`) **twice**
— once under each directory. Neither vendor documents what happens on a duplicate skill name.
`[ASSUMED]` The practical impact is benign here, because D-107 renders one text and D-119 already
requires byte-identical copies: whichever wins, the content is the same, and the worst case is a
duplicate entry in a skill picker. Worth one sentence in the phase's own verification notes, not a
design change. See Open Question 1.

### Fact 2 — Codex and unknown / non-spec frontmatter keys

**Codex silently ignores them. Verified in the source, not inferred.**

`codex-rs/skills/src/parser.rs` deserialises frontmatter into:

```rust
#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    metadata: SkillFrontmatterMetadata,
}
```

There is no `#[serde(deny_unknown_fields)]` attribute anywhere in that file. Serde's default
behaviour for a struct without that attribute is to accept and discard unrecognised keys. So an
unknown key is neither an error nor a warning — it is dropped during parse.
`[VERIFIED: github.com/openai/codex — codex-rs/skills/src/parser.rs, read this session via raw source and confirmed independently via Context7]`

This is also what the spec requires of a conforming implementation: unknown frontmatter fields are
ignored, which is what keeps one `SKILL.md` portable across implementations.
`[CITED: agentskills.io/specification]`

**What this unblocks and what it does not.** SKILL-10 (`disable-model-invocation` on gate skills) was
parked pending this answer; the answer is that shipping `disable-model-invocation` would not break
Codex. **It does not become Phase 6 work** — CONTEXT.md's Deferred Ideas list puts it out of scope
and D-106 already makes the phase safe either way by stripping authoring keys before render. Record
the fact; let the owner decide when to spend it. Note also that `disable-model-invocation` is
honoured by Claude Code and by Cursor `[CITED: code.claude.com/docs/en/skills]` `[CITED: cursor.com/docs/skills]`,
and is not in the six spec fields — so shipping it would require SKILL-02 to be reopened, which is a
larger change than the frontmatter question alone.

#### Fact 2b — The frontmatter-must-start-at-line-1 rule (re-confirmed)

Codex's parser requires the opening `---` to be the **very first line**:

```rust
if !matches!(lines.next(), Some(line) if line.trim() == "---") {
    return None;
}
```

with the error `#[error("missing YAML frontmatter delimited by ---")] MissingFrontmatter`.
`[VERIFIED: github.com/openai/codex — codex-rs/skills/src/parser.rs, read this session]`

Claude Code behaves the same way: it reads the frontmatter only when the opening `---` is the file's
first line, and otherwise treats the whole file — `---` markers included — as skill body.
`[ASSUMED]` — this is widely reported and matches the Codex implementation exactly, but no Anthropic
doc page states it in those words, so it does not earn a verified tag. It does not matter which tag
it carries: **D-111's placement is correct under both readings**, because a marker *after* the closing
`---` is safe whether or not a runtime tolerates leading content.

### Fact 3 — The six Agent Skills spec frontmatter fields (named, from the spec)

| Field | Required | Constraint |
|-------|----------|------------|
| `name` | **Yes** | 1–64 chars; lowercase `a-z`, `0-9`, and `-` only; no leading/trailing hyphen; no consecutive hyphens; **must match the parent directory name** |
| `description` | **Yes** | 1–1024 chars; describes what the skill does *and when to use it* |
| `license` | No | License name or reference to a bundled license file |
| `compatibility` | No | 1–500 chars; environment requirements |
| `metadata` | No | Map from string keys to string values; "Clients can use this to store additional properties not defined by the Agent Skills spec" |
| `allowed-tools` | No | Space-separated string of pre-approved tools. **Experimental** — support varies between implementations |

`[CITED: agentskills.io/specification]` — quoted verbatim from the specification's frontmatter table.
Cross-confirmed: Claude Code's own field reference marks `license` and `compatibility` as "Part of the
Agent Skills spec" `[CITED: code.claude.com/docs/en/skills]`, and Copilot documents `name`,
`description`, `license`, `allowed-tools` `[CITED: docs.github.com/.../add-skills]`.

**Three consequences the planner must carry into the plan:**

1. **SKILL-02 is an allowlist, not a checklist.** Only `name` and `description` are required. The
   renderer should emit `name` + `description` (and `license` if the project wants it, given the MIT
   package). The test D-106 calls for is "rendered frontmatter contains no key outside this set of
   six", **not** "contains all six".
2. **`name` must equal the parent directory name.** `accord-ba`, `accord-dev`, `accord-designer` all
   satisfy the charset rules (lowercase, single hyphen, no leading/trailing/consecutive hyphen). This
   is a cheap, high-value test assertion: render output path basename === rendered `name`.
3. **`description` is loaded at startup for every skill, before the body.** The spec's progressive
   disclosure model loads `name` + `description` (~100 tokens) for all skills at startup, the
   `SKILL.md` body only on activation, and referenced files only when needed.
   `[CITED: agentskills.io/specification]` This confirms D-106's reason for refusing to infer
   `description` from the first line, and it is the reason `description` must say *when to use this*,
   not just what it is.

## Architecture Patterns

### System Architecture Diagram

```
packages/core/skills/*.md          (authored prose + authoring frontmatter: kind:, loads:)
        │
        │  npm run gen  →  scripts/gen-skills.mjs   (Node built-ins allowed: outside src/)
        │                   • strip BOM, CRLF → LF
        │                   • split frontmatter from body
        ▼
packages/core/src/generated/skills.ts   (committed; drift test is the only staleness signal)
        │
        │  imported by  packages/core/src/skills/   (PURE — no node:*)
        ▼
  renderSkill(def)  ─────────────────────────────────┐
        • keep only the six spec fields              │
        • emit ---\n<fm>\n---\n<marker+hash>\n<body> │
                                                     ▼
  skillTargets(config)  ────────────────────►  { path, text }[]
        • roles:    filters WHICH accord-<role>       (paths are path.posix, always)
        • runtimes: filters WHICH target dirs
        • one entry per (file × target dir)
                                                     │
        ══════════════ core / cli boundary ══════════╪═══════════════
                                                     ▼
  packages/cli/src/commands/skills.ts        preflight(): root → snapshot → PIN (D-121)
        for each { path, text }:
          read existing file (if any)
          normalise CRLF/BOM, recompute hash excluding marker line
          ├─ file absent ................................. write → "created"
          ├─ stored hash === recomputed AND text matches .. NO WRITE → "unchanged"
          ├─ stored hash === recomputed AND text differs .. write → "updated"
          └─ stored hash !== recomputed ................... write → "overwrote local edits"
        then: scan target dirs for accord-* not in the target set
          └─ name each on stderr + the rm command (D-113) — never delete
        exit 0
                                                     │
                                                     ▼
              .claude/skills/accord-<role>/{SKILL.md,*.md}   ← Claude Code, Cursor, Copilot
              .agents/skills/accord-<role>/{SKILL.md,*.md}   ← Codex, Cursor, Copilot
```

### Recommended Project Structure

```
packages/core/skills/                 # authored source (D-105); NOT added to package.json files:
├── ba/         SKILL.md setup.md story.md ready.md
├── dev/        SKILL.md debug.md review.md code-review.md
├── designer/   SKILL.md
└── shared/     prototype.md          # single source, rendered into dev/ and designer/ (D-119)

packages/core/scripts/gen-skills.mjs  # gen-templates.mjs + a frontmatter split
packages/core/src/generated/skills.ts # committed, drift-tested
packages/core/src/skills/
├── render.ts     renderSkill()       # six-field strip, marker, hash
├── targets.ts    skillTargets()      # roles × runtimes → { path, text }[]
└── hash.ts       contentHash()       # FNV-1a, copied approach from gate/hash.ts

packages/cli/src/commands/skills.ts   # the only filesystem write
```

**Two notes on the layout.** A directory per role (above) beats a flat directory because the
`loads:` relation becomes visually obvious and `prototype.md`'s dual ownership (D-119) has an
honest home in `shared/`. And `packages/core/skills/` should **not** be added to
`packages/core/package.json` `files:` — nothing reads it at runtime; the text reaches consumers
through `dist/index.js`. (`templates/` *is* in `files:` today despite the same being true of it
`[VERIFIED: packages/core/package.json files, and grep of packages/*/src for "templates/" finds only the generated module]`,
so a reviewer may ask about the inconsistency; the lazy answer is to change neither.)

### Pattern 1: Render is a string build, not a template engine

**What:** `renderSkill()` concatenates four parts — `---`, the filtered YAML, `---` + marker line,
the body — and returns a string. No substitution, no template language.
**When to use:** always. The definition body is already final prose; there is nothing to interpolate.

```typescript
// Source: shape derived from packages/core/src/gate/hash.ts and templates.ts (this repo)
const SPEC_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'] as const;

// D-106: everything outside SPEC_FIELDS is an authoring key and never ships.
// SKILL-02 is an allowlist — `name` and `description` are the only required fields
// (agentskills.io/specification), so absent optional fields are simply not emitted.
```

### Pattern 2: The marker line is the whole drift mechanism

**What:** one HTML comment, immediately after the closing `---`, carrying the do-not-edit notice and
the content hash. The hash covers the rendered file with that one line removed.
**When to use:** on `SKILL.md` **and** on every bundled reference file (D-110). Reference files have
no frontmatter, so their marker is simply the first line.

```markdown
---
name: accord-dev
description: Use when implementing a ticket that has passed the Ready gate. Plans into `## Plan`, implements, then hands a fresh context the review brief.
---
<!-- generated by accord skills sync — do not edit — fnv1a64:0123456789abcdef -->

Step 1. Run `accord gate ready <id>`. ...
```

Because the file is read back to recompute the hash, **the read must normalise exactly as the write
did** — see Pitfall 1.

### Pattern 3: Bundled reference files are undiscoverable by filename, not by frontmatter

**What:** all four runtimes discover skills by scanning for a file **named `SKILL.md`**. Cursor
states it most explicitly — "Cursor walks the skills root recursively and picks up any `SKILL.md` it
finds" `[CITED: cursor.com/docs/skills]` — and Codex's loader constant is
`SKILLS_FILENAME: &str = "SKILL.md"` `[VERIFIED: github.com/openai/codex — codex-rs/ext/skills/src/loader/mod.rs, quoted in parser docs read this session]`.

**Why this matters:** D-108 justifies bundled reference files by saying "a bundled file has no
`name`/`description`, so no runtime discovers it on its own." That conclusion is right but the reason
is weaker than the truth. `review.md` is undiscoverable because it is **not named `SKILL.md`** —
which would hold even if it carried full frontmatter. The stronger reason is worth recording in the
plan, because it also tells you the one thing that *would* break the layout: never name a bundled
reference file `SKILL.md`, and never nest a second `SKILL.md` under `accord-<role>/` (Cursor walks
recursively and would register it as a separate skill).

The spec endorses this layout directly: "When referencing other files in your skill, use relative
paths from the skill root… Keep file references one level deep from `SKILL.md`."
`[CITED: agentskills.io/specification]`

### Anti-Patterns to Avoid

- **Per-runtime skill text.** Already Anti-Pattern 3 in `ARCHITECTURE.md`; Fact 1 re-confirms there
  is no per-runtime format, only a per-runtime directory. One text, two paths.
- **Putting the hash only in frontmatter.** It has no home in the reference files, which D-110 puts
  under the same drift rule. (`metadata.accord-hash` *would* be spec-legal — see the correction in
  the Summary — but it solves half the problem and costs a second mechanism.)
- **Emitting all six spec fields.** `compatibility` and `allowed-tools` say something real; emitting
  them empty or boilerplate is noise in a field runtimes read at startup.
- **A regex `.command('...')` scan for SKILL-08.** It finds leaf names but not the parent chain, so
  it cannot distinguish `gate ready` from a hypothetical top-level `ready`. See Pitfall 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Splitting frontmatter from body in the codegen | A Markdown parser | The existing fence/frontmatter regex shape from `packages/core/test/templates.test.ts:12` (`/^---\n([\s\S]*?)\n---(?:\n\|$)/`) | The format is fixed by spec: `---` on line 1, `---` closing. A parser answers questions nobody asked. |
| Serialising the six fields back to YAML | Hand-built `key: value` string concatenation | `yaml`'s `stringify` (already a dependency), or reuse the D-45 quoting convention already in `packages/core/src/write/frontmatter.ts` | A description containing `:` or a leading `-` breaks naive concatenation silently, and `description` is free prose written by a human. |
| Content hashing | `node:crypto` | The FNV-1a approach in `packages/core/src/gate/hash.ts` | `node:crypto` is banned in core by CORE-01 and enforced by `purity.test.ts` and ESLint. The existing 12-line implementation is the precedent; copy the approach, keep the functions separate (they answer different questions). |
| Enumerating the CLI command surface for SKILL-08 | A literal list in the test | commander's own registry, walked recursively | A literal list is exactly what the requirement says must not be possible to forget to update. |
| Comparing "is this file already correct" | A diff library | Byte comparison of the rendered string against the normalised on-disk text | D-112 needs four distinguishable states, all reachable from two equalities (text-matches, hash-matches). |
| Enumerating orphan `accord-*` directories | A glob library | `readdirSync(dir, { withFileTypes: true })` + `name.startsWith('accord-')` | The folder is one level deep by construction (D-108); `spawn-surface.test.ts` already uses `readdirSync` with `recursive`. |

**Key insight:** every mechanism this phase needs already exists somewhere in this repository, built
for a neighbouring reason. The phase's real cost is the prose, which is why the ROADMAP calls it the
heaviest phase and why none of the above should consume plan budget.

## Runtime State Inventory

This phase moves and deletes files that other things point at, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — accord holds no database and this phase adds none. Verified: no datastore exists in the repo; the only persisted state is files under `accord/` and the two skill directories. | none |
| Live service config | **None** — accord calls no external service (the "No API keys" constraint), and the four runtimes read the filesystem only, with no registration step. Verified against all four runtimes' docs this session: discovery is a directory scan, nothing is registered. | none |
| OS-registered state | **None** — no scheduled task, daemon, or shell integration is created by this project. Verified: `packages/cli/test/spawn-surface.test.ts` proves the CLI spawns only `git` and `gh`. | none |
| Secrets/env vars | **None new.** `GITHUB_TOKEN` is read by the Phase 5 tracker adapter and is untouched here. | none |
| Build artifacts | **Two, both real.** (1) `packages/core/src/generated/skills.ts` is a new committed generated module — `npm run gen` at the repo root currently runs `gen-templates.mjs` **only** `[VERIFIED: package.json scripts.gen]`, so the script must be extended or the new module will never regenerate. (2) `packages/core/templates/business-rules.md` gains the D-116 line, which moves `src/generated/templates.ts` and any template golden. | Extend `scripts.gen` to run both codegens; regenerate `templates.ts`; expect the Phase 1 template goldens to move. |
| **In-repo skill copies (this repo's own dogfood)** | `.claude/skills/accord-debug/SKILL.md` (129 lines) and `.claude/skills/accord-code-review/SKILL.md` (127 lines) are hand-maintained copies. `docs/skills/debug.md` (118) and `docs/skills/code-review.md` (116) are their sources. D-105 graduates the sources into `packages/core/skills/`; CONTEXT.md's canonical-refs note says the two `.claude/skills/accord-*` copies are **deleted in the graduation commit**. | Code edit **and** a file move: the author loses `/accord-debug` and `/accord-code-review` as standalone invocable skills (CONTEXT.md Deferred Ideas records this knowingly). After graduation, running `accord skills sync` in this repo writes `accord-ba`/`accord-dev`/`accord-designer`, not `accord-debug`. |

**The one thing to say plainly:** this repository will, after this phase, have accord's own skills
installed under `.claude/skills/` and `.agents/skills/` — generated, hashed, and regenerable. That is
a deliberate dogfood and it is the cleanest available proof of criterion 2 ("a second run is a
no-op"). But it also means the phase's first commit removes two skills the author actively uses. Plan
the graduation commit to land the replacement in the same change, not in a later one.

## Common Pitfalls

### Pitfall 1: The hash drifts on Windows because git rewrote the line endings

**What goes wrong:** `sync` writes LF (FMT-08). On a second run — or on a fresh clone in a repository
whose `.gitattributes` or `core.autocrlf` converts to CRLF — the file read back is CRLF. The
recomputed hash differs from the stored one, so every file reports `overwrote local edits` and gets
rewritten. "A second run is a no-op" (ROADMAP criterion 2) fails on exactly one of the two CI legs.
**Why it happens:** the hash input is the file's bytes, and git is allowed to change those bytes
between write and read. This project's own `.gitattributes` is `* text=auto eol=lf`
`[VERIFIED: .gitattributes]`, but `sync` writes into a *user's* repository, which has its own.
**How to avoid:** normalise before hashing, on both sides — strip BOM, `replace(/\r\n/g, '\n')` —
exactly as `gen-templates.mjs` already does `[VERIFIED: packages/core/scripts/gen-templates.mjs:10]`
and as `templates.test.ts` does when comparing `[VERIFIED: packages/core/test/templates.test.ts:24-25]`.
Hash the normalised text, never the raw bytes.
**Warning signs:** the Windows CI leg reports `updated` where Ubuntu reports `unchanged`; a fresh
clone shows a dirty tree immediately after `sync`.

### Pitfall 2: The SKILL-08 command scanner silently stops covering new commands

**What goes wrong:** the test holds a literal list, or a regex over `.command('…')` string literals.
A later phase adds a command; the test still passes; a skill can now name a command that does not
exist, or the test stops proving anything.
**Why it happens:** `runCli` builds the `Command` tree inside the function and does not export it
`[VERIFIED: packages/cli/src/run.ts:51-105]`, so the obvious route to the real registry is closed and
a copy is the path of least resistance. And commander nests: the real paths are `lint`,
`gate ready`, `gate done`, `new ticket`, `status`, and the new `skills sync` — a flat literal scan
recovers the leaves but not the chain.
**How to avoid:** two options, both acceptable under CONTEXT.md's discretion clause.

| Option | How | Cost | Recommendation |
|--------|-----|------|----------------|
| **A — commander registry** | Extract the tree construction from `runCli` into an exported function; the test walks `program.commands` recursively to build full paths | One small refactor of `run.ts`; the action closures over `code` need threading through | **Recommended.** A new command *cannot* be missed: it is registered on the same object the CLI runs. |
| B — source scan | Regex `run.ts` for `.command(...)`, reconstruct the chain from the assignment structure | No production change; mirrors `spawn-surface.test.ts` | Fragile on the chain reconstruction (`program.command('new').command('ticket <id>')`); use only if A proves awkward. |

Whichever is chosen, copy `spawn-surface.test.ts`'s **guard-the-guard** assertion —
`expect(sites.length).toBeGreaterThan(0)` with the comment "A silently empty scan would make both
assertions below vacuous" `[VERIFIED: packages/cli/test/spawn-surface.test.ts:66-70]`. D-110 widens
the scan to every bundled reference file, which makes an empty-scan bug even easier to introduce.

### Pitfall 3: The rendered `name` and the directory disagree

**What goes wrong:** `accord-ba/SKILL.md` carries `name: ba` (or `name: accord_ba`). The spec requires
`name` to match the parent directory and to be lowercase-with-hyphens; a mismatch is a validation
failure in `skills-ref validate` and undefined behaviour in the runtimes.
**Why it happens:** the source definition is keyed by role (`ba`), the output directory is prefixed
(`accord-ba`), and the prefix is applied by `skillTargets()` — a different function from the one that
writes `name`.
**How to avoid:** derive both from one value, and assert it: for every entry in the render output,
`basename(dirname(path)) === parsedFrontmatter.name`. One line, catches the whole class.
`[CITED: agentskills.io/specification]`

### Pitfall 4: A relative reference points at a file that was filtered out

**What goes wrong:** `accord-dev/SKILL.md` says "read `./prototype.md`", but the render for this
config did not emit `prototype.md` into `accord-dev/` — so the step is a dead link and the workflow
silently loses a stage.
**Why it happens:** D-119 makes `prototype.md` a shared source rendered into two roles, and D-113
filters by `roles:`. A filtering change can drop a file a `SKILL.md` still names.
**How to avoid:** D-110 already calls for this assertion — "every relative path a rendered skill
references resolves to a file present in the render output". Run it over the **render output**, not
over `packages/core/skills/`, and run it for more than one config (at minimum: all three roles, and
a roster without `designer`).
**Warning signs:** a test that only ever constructs the full-roster config.

### Pitfall 5: `sync` touches the file when it should not

**What goes wrong:** the "no-op" is implemented as "render, then write, then compare" — so the mtime
moves even when the bytes do not, and criterion 2 is true at the byte level but false to any watcher.
**How to avoid:** D-112 already states the rule ("When the recomputed hash matches, the file is not
touched at all — no write, no mtime change") and D-96 already established the compare-then-write shape
for the `ac_hash` write. Reuse it. A test can assert the mtime is unchanged across two runs, though
byte-identity plus an explicit "did we call write" counter is less flaky on Windows.

### Pitfall 6: `path.join` leaks a backslash into a printed path or a skill body

**What goes wrong:** `sync` prints one line per file; a `path.join` on Windows prints
`.claude\skills\accord-ba\SKILL.md`, and a relative reference inside a rendered skill could embed the
same.
**How to avoid:** `path.posix` everywhere, as D-51 requires. The existing guard is the `printed paths`
block in `packages/cli/test/spawn-surface.test.ts` — **add `skills sync` to its `COMMANDS` table**
with a guard string, so the invariant covers the new command automatically on the Windows CI leg
`[VERIFIED: packages/cli/test/spawn-surface.test.ts:88-104]`.

## Code Examples

### Reading the six spec fields out of a source definition

```typescript
// Source: field set from agentskills.io/specification; regex shape from
// packages/core/test/templates.test.ts:12 (this repo).
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

/** D-106: authoring keys (`kind`, `loads`) live in the source and never ship. */
const SPEC_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'] as const;
```

### The marker, and what the hash covers (D-111)

```typescript
// The marker is one line, immediately after the closing `---` — frontmatter must start at line 1
// in Claude Code and in Codex (codex-rs/skills/src/parser.rs requires the first line to be `---`).
// The hash covers the rendered file with that one line removed, so it detects BOTH
// a changed definition (fresh render ≠ file on disk) and a hand-edited copy (recomputed ≠ stored).
const MARKER = /^<!-- generated by accord skills sync .* -->$/m;

// Normalise exactly as the writer did before hashing — see Pitfall 1.
const normalise = (text: string) => text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
```

### The one assertion that catches the whole `name`/directory class

```typescript
// agentskills.io/specification: `name` "Must match the parent directory name".
for (const { path, text } of skillTargets(config)) {
  if (!path.endsWith('/SKILL.md')) continue;
  const dir = path.slice(0, -'/SKILL.md'.length).split('/').at(-1);
  expect(frontmatter(text).name, path).toBe(dir);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vendor-specific skill formats, one per tool | A shared Agent Skills spec at `agentskills.io` with a reference validator (`skills-ref validate`) | The spec is now cited by name in Claude Code, Copilot, and Codex docs | SKILL-01's "one definition" premise is stronger than when it was written: the format is a published spec, not a convergence of three vendors' conventions. |
| `.claude/skills/` as the de-facto path everyone copied | `.agents/skills/` as the vendor-neutral path, with `.claude/skills/` read for backward compatibility by Cursor and Copilot | Cursor and Copilot both now list `.agents/skills/` first or alongside | Unchanged for accord: Claude Code still reads only `.claude/skills/`, so two copies remains required. But the direction of travel is toward `.agents/`; if Claude Code ever adds it, accord drops to one copy and `skillTargets()` is the only thing that changes. |

**Deprecated/outdated:**
- Nothing in `.planning/research/ARCHITECTURE.md` Pattern 3 is stale. Its directory table, its
  two-copies conclusion, its marker-after-frontmatter rule, and its no-symlinks rule all survive
  re-verification. Its one incidental claim now superseded is the example path
  `accord/skills/<name>/SKILL.md` for the canonical source — D-105 puts the source at
  `packages/core/skills/` instead, which is a deliberate later decision, not a research error.
- ARCHITECTURE.md's advice to "keep canonical frontmatter to spec fields plus
  `disable-model-invocation`, and strip anything non-standard when writing to `.agents/skills/`" is
  superseded by D-106 + SKILL-02: strip to the six spec fields for **both** targets, so the two
  copies stay byte-identical. Fact 2 shows the per-target strip was never necessary anyway.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code ignores frontmatter that does not start at line 1 | Fact 2b | **None for this phase.** D-111 places the marker after the closing `---`, which is safe under either behaviour. The assumption only matters if someone later proposes a pre-frontmatter marker. |
| A2 | Cursor and Copilot, reading both target directories, tolerate the same skill name appearing twice | Fact 1 | Low. Both copies are byte-identical by D-107/D-119, so a duplicate picker entry is the worst case. If a runtime errors instead, the fix is a config choice by the user (`runtimes:` lists only what they use), not a design change. |
| A3 | `packages/core/skills/` need not be added to `packages/core/package.json` `files:` | Architecture Patterns | Low, and self-revealing: if a consumer needs the raw sources, the published tarball is missing them and someone says so. `templates/` sits in `files:` today as a counter-precedent. |
| A4 | A directory-per-role source layout beats a flat one | Recommended Project Structure | None — CONTEXT.md explicitly places this under Claude's Discretion. Stated as a recommendation, not a finding. |
| A5 | Option A (export the commander tree) is the better SKILL-08 scanner | Pitfall 2 | Low. Both options satisfy the requirement; A is structurally stronger, B is zero-touch. Explicitly a discretion item. |

## Open Questions (RESOLVED)

1. **Do Cursor and Copilot dedupe a skill name that appears in both `.claude/skills/` and `.agents/skills/`?**
   - What we know: both runtimes scan both directories; accord writes byte-identical copies to both.
     Claude Code documents a precedence order across *its own* scopes (enterprise > personal >
     project) and namespaces plugin skills to avoid collisions `[CITED: code.claude.com/docs/en/skills]`,
     but Claude Code reads only one of accord's two paths, so it never sees the duplicate.
   - What's unclear: neither Cursor nor Copilot documents duplicate-name behaviour at all.
   - Recommendation: do not design around it. Note it in the phase's verification notes and observe
     what the author's own Cursor does once this repository is dogfooding the generated skills —
     which is free evidence this phase produces anyway.
   - **RESOLVED:** do not design around it. Carried as a Manual-Only row in 06-VALIDATION.md;
     no plan changes either way.

2. **Should the renderer emit `license:`?**
   - What we know: the package is MIT and public; `license` is one of the six spec fields; Copilot
     and Claude Code both document it.
   - What's unclear: whether a per-skill `license: MIT` is useful to a reader or is noise in a field
     loaded at startup. The spec says only "We recommend keeping it short."
   - Recommendation: emit it. One short field, correct information, and it makes the six-field
     allowlist test exercise more than the two required fields. Low stakes either way; the planner
     may drop it without consequence.
   - **RESOLVED:** emit it. `license` is in 06-01's `SPEC_FIELDS` and in every role's source
     frontmatter.

3. **What number should D-129's ceiling be?**
   - What we know: the spec recommends "Keep your main `SKILL.md` under 500 lines" and instructions
     under 5000 tokens `[CITED: agentskills.io/specification]`. CONTEXT.md proposes 120 and leaves the
     number to the planner. The existing drafts are 116–118 source lines for *techniques*, which are
     bundled references and therefore unbounded under D-129.
   - What's unclear: whether 120 is achievable for `ba/SKILL.md`, which must carry a profile branch,
     the setup branch pointer, the per-story branch pointer, and the readiness-review handoff.
   - Recommendation: set the ceiling, write the content, and if `ba` cannot fit, move more into
     `setup.md`/`story.md` rather than raising the number — that is exactly what D-114 intends. The
     spec's 500 is a hard ceiling the test must never exceed regardless.
   - **RESOLVED:** 120, as proposed. 06-01 Task 3 lands the ceiling as a named constant and each
     role plan carries an acceptance criterion behind it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, codegen, tests | ✓ | v24.14.0 | — |
| npm | workspaces, scripts | ✓ | 11.9.0 | — |
| git | `repoRoot()`, CLI preconditions | ✓ | 2.55.0.windows.2 | — |
| vitest | the phase's entire proof surface | ✓ | 5.0.0 (installed) | — |
| Agent runtime (Claude Code / Codex / Cursor / Copilot) | D-115 part 2 — running the wrong-plan fixture through the dev skill by hand once | ✓ (Claude Code is in use in this session) | — | D-115 already splits the proof: part 1 is automated in CI and needs no runtime. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 5.0.0 |
| Config file | `vitest.config.ts` (root; `environment: 'node'`, `pool: 'forks'`, `projects: ['packages/core','packages/cli']`) |
| Quick run command | `npx vitest run packages/core/test/skills.test.ts` (substitute the file under edit) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKILL-01 | Three role definitions exist and render | unit | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-02 | Rendered frontmatter contains no key outside the six spec fields; `name` === parent directory | unit | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-03 | `skillTargets()` emits `.claude/skills/accord-<role>/…` and `.agents/skills/accord-<role>/…`, filtered by `roles:` and `runtimes:` | unit | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-04 | Every rendered `SKILL.md` first step is a `accord gate ready` call (D-128) | unit (text assertion over render output) | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-05 | BA skill text names `draft`, `## Open questions`, and stops before Ready | unit (text assertion) | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-06 | `dev/SKILL.md` names a fresh context and `verification.md`; `review.md` is bundled in `accord-dev/` | unit (text + render-output assertion) | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-07 | `verified` is written by the developer step only — no other skill text names it as a write | unit (text assertion across all rendered files) | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-08 | Every CLI command named in any rendered file (D-110: `SKILL.md` **and** references) exists in the registry | unit | `npx vitest run packages/cli/test/skill-commands.test.ts` | ❌ Wave 0 |
| SKILL-09 | `debug.md` and `code-review.md` render into `accord-dev/`, carry no `SKILL.md` filename, and are named by a step in `dev/SKILL.md` | unit | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-12 | `dev/SKILL.md` carries a plan-review step; it states "reads no code" and "edits only `## Plan`"; it precedes the implementation step | unit (ordered text assertion) | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| SKILL-12 | A wrong-plan fixture run through the dev skill by hand comes back changed (D-115 part 2) | **manual-only** | *(phase verification; recorded as `## Plan` before/after)* | ❌ Wave 0 (fixture) |
| CLI-08 | `skills sync` creates files on a clean repo; a second run reports `unchanged` and writes nothing | integration (in-process `run()` over a temp fixture repo) | `npx vitest run packages/cli/test/skills-sync.test.ts` | ❌ Wave 0 |
| CLI-08 | A hand-edited copy reports `overwrote local edits` and is restored | integration | `npx vitest run packages/cli/test/skills-sync.test.ts` | ❌ Wave 0 |
| CLI-08 | An orphaned `accord-*` directory is named on stderr with the removal command and is **not** deleted (D-113) | integration | `npx vitest run packages/cli/test/skills-sync.test.ts` | ❌ Wave 0 |
| CLI-08 | `skills sync` refuses on a version-pin mismatch with exit 2 (D-121) | integration | `npx vitest run packages/cli/test/skills-sync.test.ts` | ❌ Wave 0 |
| CLI-08 | `skills sync` prints no backslash on any host (D-51) | integration | `npx vitest run packages/cli/test/spawn-surface.test.ts` | ✅ exists — **add a row to its `COMMANDS` table** |
| D-105 | `src/generated/skills.ts` matches `packages/core/skills/` on disk; LF, no BOM | unit (drift) | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 (copy `templates.test.ts`'s `generated module` block) |
| D-119 | The two rendered `prototype.md` copies are byte-identical | unit | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| D-129 | Every rendered `SKILL.md` is within the line ceiling | unit | `npx vitest run packages/core/test/skills.test.ts` | ❌ Wave 0 |
| D-116 | `templates/business-rules.md` carries the `Rejected:` guidance line | unit | `npx vitest run packages/core/test/templates.test.ts` | ✅ exists — extend |

**Manual-only justification:** D-115 part 2 is the one criterion that cannot be automated. Its subject
is model behaviour, and the "No API keys" constraint forbids running a model inside the suite.
CONTEXT.md D-115 already accepts this split and specifies the evidence (the fixture's `## Plan` before
and after, recorded once during phase verification). Do not attempt to automate it; do not weaken the
criterion to make it automatable.

### Sampling Rate

- **Per task commit:** `npx vitest run packages/core/test/skills.test.ts` (or the CLI file under edit)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green (`build && lint && typecheck && test`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/core/test/skills.test.ts` — covers SKILL-01, -02, -03, -04, -05, -06, -07, -09, -12 (structural), D-105 drift, D-119, D-129
- [ ] `packages/cli/test/skills-sync.test.ts` — covers CLI-08 (all four D-112 states, D-113 orphan, D-121 pin)
- [ ] `packages/cli/test/skill-commands.test.ts` — covers SKILL-08 / D-110 (or fold into `skills.test.ts` if the registry is reachable from core; it is not, so the CLI package is the right home)
- [ ] Wrong-plan fixture for D-115 — a ticket whose `## Plan` targets the wrong layer and the wrong order
- [ ] Extend `packages/cli/test/spawn-surface.test.ts` `COMMANDS` with a `skills sync` row
- [ ] Extend `packages/core/test/templates.test.ts` for the D-116 guidance line
- [ ] No framework install needed — vitest 5.0.0 is present and configured.

## Security Domain

`workflow.security_enforcement` is `true` in `.planning/config.json`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | accord authenticates nobody; `skills sync` is a local file write. |
| V3 Session Management | no | No session exists. |
| V4 Access Control | no | The only authority is the filesystem's own; `sync` writes under the repo root the user already owns. |
| V5 Input Validation | **yes** | `config.yml` is validated by `config.schema.json` via ajv before `skillTargets()` sees it — `roles` and `runtimes` are closed enums with `additionalProperties: false` `[VERIFIED: packages/core/schemas/config.schema.json:30-46]`. This is what keeps a hostile config from steering a write. |
| V6 Cryptography | no | The content hash is a **drift detector, not a security control**. FNV-1a is not collision-resistant and must never be described as tamper-evidence — it detects accidental divergence, which is all D-111 claims. |
| V12 File and Resource | **yes** | `sync` writes to paths derived from config. See the threat below. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal from config into an arbitrary write | Tampering | Target paths are **not** user-supplied: `skillTargets()` composes them from a fixed table (`.claude/skills`, `.agents/skills`) and a closed `roles` enum. Neither component is free text. Keep it that way — do not add a configurable target path in this phase. |
| Destructive write over a user's own file | Tampering / Denial | D-112 overwrites by contract and *says so* per file; D-113 never deletes; git is a hard precondition of the CLI. The mitigation is the honest report, not a lock. |
| Orphan skill keeps loading after a roster change | Tampering (stale instruction) | D-113 names it on stderr with the removal command. Automatic deletion was rejected; that stands — deleting files under a user's repo is the larger risk. |
| Untrusted content reaching a runtime as instructions | Tampering | accord renders **only its own** definitions (D-123: `accord-*` directories only, never reads or reports on skills it did not generate). No user content is rendered into a skill file. |
| Hash presented as integrity | Spoofing | Do not word the marker as if it authenticates the file. "generated by accord skills sync — do not edit" plus the hash is correct; "verified" or "signed" would not be. |

## Sources

### Primary (HIGH confidence)

- `github.com/openai/codex` — `codex-rs/skills/src/parser.rs` (read as raw source this session):
  `SkillFrontmatter` struct with no `deny_unknown_fields`; the first-line `---` requirement; the
  `MissingFrontmatter` error. Cross-confirmed via Context7 `/openai/codex`, which also quoted
  `ext/skills/src/loader/mod.rs` constants (`SKILLS_FILENAME: "SKILL.md"`, `MAX_SCAN_DEPTH: 6`).
- `agentskills.io/specification` — the six frontmatter fields with their constraints, verbatim; the
  `name`-matches-directory rule; progressive disclosure; relative file references one level deep; the
  500-line `SKILL.md` recommendation; unknown fields are ignored.
- This repository, read this session: `packages/cli/src/run.ts`, `packages/cli/test/spawn-surface.test.ts`,
  `packages/core/scripts/gen-templates.mjs`, `packages/core/test/templates.test.ts`,
  `packages/core/src/gate/hash.ts`, `packages/core/src/index.ts`,
  `packages/core/schemas/config.schema.json`, `vitest.config.ts`, `package.json`, `.gitattributes`.

### Secondary (MEDIUM confidence)

- `learn.chatgpt.com/docs/build-skills` (OpenAI, redirected from `developers.openai.com/codex/skills`)
  — Codex's six scan locations; symlink support; `[[skills.config]]` in `~/.codex/config.toml`.
- `cursor.com/docs/skills` — Cursor's primary and backward-compatibility scan paths; recursive walk;
  Cursor-only frontmatter fields.
- `docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills` — Copilot's three
  project paths and two personal paths; the four frontmatter fields it documents.
- `code.claude.com/docs/en/skills` — Claude Code's six scan locations and its full frontmatter
  superset, including the note that `license` and `compatibility` are "Part of the Agent Skills spec".

### Tertiary (LOW confidence)

- Web search summary on Claude Code's frontmatter-must-start-at-line-1 behaviour (A1). Consistent with
  the verified Codex implementation, but no vendor page states it; does not affect any decision.
- Web search summary on duplicate skill names across scanned directories (A2). No vendor documents it.

## Metadata

**Confidence breakdown:**

- Runtime directory table (Fact 1): **HIGH** — four independent official sources, one per runtime, all
  re-fetched this session; conclusion unchanged from ARCHITECTURE.md.
- Codex unknown-key handling (Fact 2): **HIGH** — read in the implementation's own source, not inferred
  from docs; the behaviour is a property of the serde derive, not of documentation.
- The six spec fields (Fact 3): **HIGH** — quoted verbatim from the specification, cross-confirmed by
  two vendors' own field references.
- Standard stack: **HIGH** — no new dependency; every version read from the installed tree.
- Architecture / rendering mechanics: **MEDIUM** — these are design recommendations inside settled
  constraints, grounded in this repo's existing code, not external findings.
- Pitfalls: **MEDIUM–HIGH** — Pitfalls 1, 2, and 6 are grounded in verified repo code and a verified
  `.gitattributes`; Pitfalls 3 and 4 follow from the verified spec rules.

**Research date:** 2026-09-15
**Valid until:** 2026-10-15 for the spec and the repo facts; **2026-09-29** for the four-runtime
directory table — the ROADMAP's own note says the runtimes have moved three times in eighteen months,
and Phase 7's `init` writes the same two paths, so re-check the table if Phase 7 slips past two weeks.
