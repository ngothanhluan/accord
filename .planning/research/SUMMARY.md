# Project Research Summary

**Project:** accord
**Domain:** Team spec-and-gate contract for AI-assisted delivery: Markdown+YAML folder convention, deterministic CLI gates, role skills for four coding agents, and a remote MCP server as the non-technical frontend
**Researched:** 2026-09-04 to 2026-09-05
**Confidence:** MEDIUM overall. HIGH for library versions and runtime skill paths; LOW for the MCP server, which postdates the four research files and is unresearched beyond client support.

This summary reconciles STACK.md, FEATURES.md, ARCHITECTURE.md and PITFALLS.md with three later documents that override them where they conflict: PROJECT.md (rewritten 2026-09-05), `.planning/notes/non-tech-frontend.md`, and the resolved section of `.planning/research/questions.md`. Where a research file says `features/` or `new feature`, read `tickets/` and `parent:`. Where STACK.md says single package, read monorepo.

## Executive Summary

Accord is a spec-gate tool in the family of Backlog.md, OpenSpec and Spec Kit, but with two things none of them have: separate roles (BA, designer, dev, QA, lead) each working in their own AI tool, and deterministic gates that an agent cannot argue with. The shape every comparable tool converges on is the one to copy: a loader turns files into an immutable snapshot, pure checkers turn the snapshot into findings with file and line, and a thin host renders findings and maps them to exit codes. Accord now has three hosts over that core: the CLI (devs, CI), the skills (coding agents), and a stateless remote MCP server (chat apps for non-technical members). The core must therefore be isomorphic: no `node:fs`, no `node:path`, no `node:util`, no `child_process`, and schemas bundled rather than read from disk.

The recommended build order follows the dependency chain and the milestone. Core first, because everything else is a renderer over it and the golden tests live there. CLI second, because `init` and the gates are what the dogfood ticket runs through. Skills third, because a skill is a thin wrapper that starts with a gate call and cannot be tested before the gate exits correctly. MCP fourth, because it reuses the core, the workflow definitions and the gate rules, and adds only OAuth and a GitHub-API loader. Packaging and dogfood last, because v0.1 is not closed by publishing but by one real ticket passing Ready and Done with a non-technical BA on a chat client.

The dominant risks are behavioural, not technical. A gate that is only called voluntarily is advisory, so `init` must emit a CI workflow and gates must have no bypass flag. A builder agent that writes the code, the evidence and the ticks will make the three sets match trivially, so the reviewer runs in a fresh context, evidence must reference real tests or files, and the AC hash recorded at Ready must still match at Done. On the mechanical side, YAML implicit typing, CRLF, BOM and Windows path handling each have a known fix and a fixture; the Windows CI job exists from the first commit so the author's platform is never the only one tested. The MCP server is the unresearched part: hosting, OAuth flavour, commit-without-clone, and whether `ajv` runs on the chosen host are all open.

## Key Findings

### Recommended Stack

STACK.md verified versions against the npm registry on 2026-09-05 and ran the YAML and Gherkin libraries locally. Its library choices stand. Its packaging choice does not: PROJECT.md now mandates a monorepo `core` / `cli` / `skills` / `mcp` because core must run in a serverless MCP host with no filesystem.

**Core technologies (unchanged):**
- Node `>=22.12.0`, TypeScript 5.9.3 (not 7.x; typescript-eslint peers on `<6.1`), ESM only.
- `yaml` 2.9 with core schema plus a `customTags` filter that keeps numerics as strings. Fixes dates, the Norway problem and ids like `1e3`. Hand-rolled frontmatter split with BOM and CRLF normalisation; no gray-matter (ARCHITECTURE.md's mention of gray-matter is superseded).
- `@cucumber/gherkin` 42 for AC parsing. Fenced `gherkin` code blocks in the ticket body; line numbers remapped to the Markdown file.
- `ajv` 8 against hand-written JSON Schema 2020-12 files. The JSON file is the contract; TypeScript types derive from it, not the reverse.
- Fence-aware line scanner for Markdown sections, not remark. PITFALLS.md §10 asked for a CommonMark parser; STACK.md's scanner handles both failure cases it names, and the template is Accord's own. Swap behind the same `sections()` interface if dogfooding shows misreads.
- commander 15 for the CLI, `util.styleText` for colour, ASCII `padEnd` table, tsdown for bundling, vitest 5 with JSON file goldens, GitHub Actions on `ubuntu-latest` and `windows-latest` x Node 22 and 24.

**What the monorepo changes:**
- Workspace tooling is now required. Recommend npm workspaces (no extra tool) with one tsdown config per package and a publish order core, skills, cli. Changesets moves from "defer" to "probably needed once there are three published packages".
- `core` may import only `yaml`, `@cucumber/gherkin` and the schema validator. Everything under `node:*` is banned there by ESLint, not just `fs`. `path.posix` logic that core needs (joining relative ids) is a five-line local helper. `styleText` and `readdir` are CLI-only.
- Schemas and templates: core imports the JSON schemas as modules so they bundle into `dist/`; the `schemas/*.json` files are still shipped by `cli` for editors and the `$schema` comment. Templates stay in `cli` and `skills`.
- The loader becomes an interface. `RepoSnapshot` is built by `cli` from the filesystem and by `mcp` from the GitHub tree or tarball API. ARCHITECTURE.md's snapshot-first pattern is what makes this cheap.
- `ajv` compiles schemas with `new Function`. Cloudflare Workers forbid that. If Workers is the host, either precompile with ajv standalone at build time or use `@cfworker/json-schema` behind a small validator interface. STACK.md already listed the latter as the Workers alternative. Decide with the hosting choice, which is unresearched.
- `@cucumber/gherkin` and `yaml` are pure JS and expected to run in Workers unchanged, but this is not verified.

### Expected Features

FEATURES.md surveyed Spec Kit, OpenSpec, BMad, Kiro, Backlog.md and Decap. Every one ships `init`, templates, schema validation with line numbers, a status view, a config file and plain Markdown in git. None ships role separation, an independent Done gate, or a lint on EARS.

**Must have (v0.1):**
- `init` scaffolding folder, `config.yml`, templates, skill copies, and a CI workflow. Idempotent; never overwrites edited files.
- `new ticket <id>` from template. No `new feature`; grouping is `parent:`.
- `lint`: frontmatter schema, EARS grammar classifier (warning-first), Gherkin parse with five rules, prototype token rule (warning-first), orphaned tick warning, size warnings.
- `gate ready` and `gate done` with reasons, exit codes 0 / 1 / 2, and no bypass flag.
- `status` table reading ticket frontmatter only.
- Five role workflows plus reviewer, rendered to SKILL.md and to the MCP `get_workflow` tool result.
- Remote MCP server: get_workflow, list tickets, get ticket, save ticket, lint, gate ready, gate done, status. GitHub OAuth, commits authored by the signed-in user.
- `github-issues` adapter, read-only, never consulted by gates.
- Windows and POSIX CI matrix.

**Should have (v1.x):** drift check on generated skill copies, `disable-model-invocation` on gate skills once Codex's unknown-key handling is verified, Gherkin to test-skeleton export, Tailwind v3 config parsing.

**Defer (v2+ or out of scope):** web UI, self-built chat UI (rejected: no API keys), Shortcut/Jira/Linear adapters, live collaborative editing, status or estimates in git, auto-ticking from test results (agents would self-certify).

### Architecture Approach

Three layers. A pure core over `RepoSnapshot` (model, lint, gate engine with rules as data, status). Impure hosts that build the snapshot and render results: `cli` (filesystem loader, commander, scaffold, skill copy), `mcp` (GitHub-API loader, Streamable HTTP, OAuth). A `skills` package holding one workflow definition per role plus renderers to SKILL.md and to tool-result text. Gate state is never stored; only inputs are (scenarios, evidence, ticks, AC hash). Rules are objects with id, gate, level, appliesTo and check, so the profile matrix is a table in code and both hosts run identical rules.

**Major components:**
1. `core/model` and `core/load`: typed `Ticket`, `Verification`, `ScenarioRef`, `RepoSnapshot`; frontmatter split; Gherkin extraction with line remap; `verification.md` parser. Loader takes a file-source interface, not `fs`.
2. `core/lint` and `core/gate`: schema, EARS, Gherkin, token rule, tick checks; `evaluateGate(snapshot, config, gate, id)`; Done gate as three-way set match plus AC hash plus evidence result check.
3. `cli`: commander wiring, fs loader, `init` / `new` / `lint` / `gate` / `status`, render (text and `--json` from the same object), version pin check, `github-issues` adapter.
4. `skills`: workflow definitions as data, rendered to `.claude/skills/accord-<role>/SKILL.md` and `.agents/skills/accord-<role>/SKILL.md` (those two paths cover Claude Code, Cursor, Copilot and Codex, verified against official docs) and to `get_workflow` output. Copies carry a generated marker and hash.
5. `mcp`: stateless Streamable HTTP server, GitHub OAuth, snapshot from GitHub API, writes through GitHub API as the signed-in user, tools listed above. Prompts offered additionally where the client supports them.

### Critical Pitfalls

1. **Gates exist only in prompts and get bypassed.** 36% of agent failures are instruction-following on a received instruction. `init` emits a CI workflow that runs `lint` and `gate done` on touched tickets; gates have no `--force`; Claude Code skills may add a hook; `status` shows the last gate result.
2. **Builder agent self-verifies.** Reviewer runs in a fresh context (`context: fork` on Claude Code, new session elsewhere); evidence lines must reference a test, command or file that exists; `gate done` warns when evidence, ticks and implementation share a git author; AC hash recorded at Ready must match at Done.
3. **YAML, CRLF, BOM and Windows paths.** `yaml` core schema with string numerics; normalise CRLF and BOM before the split; write LF and quoted strings; `path.posix` for anything stored or printed; never spawn `npm`, `npx` or any `.cmd`; ASCII table; Windows CI job from the first commit with CRLF fixtures byte-preserved by `.gitattributes`.
4. **Scenario names as tick keys orphan ticks on rename.** ARCHITECTURE.md keys ticks by name with a step hash warning; PITFALLS.md requires `@ac-n` tags as keys. This is a schema decision that must be settled before Phase 1 locks the ticket schema. Recommendation: tags, because a BA fixing a typo should not fail a finished ticket, and duplicate names are legal Gherkin. Needs the author's confirmation.
5. **Spec outweighs the code and the team stops writing it.** Maintain template is frontmatter plus one empty scenario; `lint` warns on intent > 5 lines, > 15 EARS lines, > 5 scenarios; plan is never a gate input; dogfood measures time from `new ticket` to Ready.

New pitfalls the MCP decision introduces and nobody has researched: concurrent edits through the GitHub API (blob SHA conflicts), OAuth token scope and where it lives if the server is stateless, rate limits when the gate needs the whole folder per call, and branch protection blocking direct commits.

## Implications for Roadmap

### Phase 1: Core

**Rationale:** Every host is a renderer over the core, and the golden tests that make gates deterministic live here. Nothing downstream can be tested without it.
**Delivers:** Monorepo skeleton with npm workspaces; CI on Ubuntu and Windows x Node 22 and 24 from the first commit; ticket and config JSON schemas; `core/model`, `core/load` behind a file-source interface, frontmatter and Gherkin extraction, `verification.md` parser; `lint` (schema, EARS classifier, Gherkin rules, tick checks, size warnings); gate engine with Ready and Done rules including AC hash; status rows; fixture repos and JSON goldens; ESLint purity guard banning all `node:*` in core. Prototype token rule last, warning-only, allowlist model.
**Addresses:** the deterministic gate, EARS lint, Gherkin lint, Done gate three-set match.
**Avoids:** pitfalls 3, 4, 5, and the YAML/CRLF/EARS-regex/Markdown-regex items.
**Decisions to settle first:** tick key (tags vs names), tracker field shape in frontmatter, whether the token rule ships in v0.1 as warning-only.

### Phase 2: CLI

**Rationale:** The dogfood ticket runs through `init`, `new`, `gate ready`, `gate done`. The CLI is also the reference host the skills call.
**Delivers:** filesystem loader; commander wiring with in-process `runCli`; `init` (folder, config with pinned version, templates, CI workflow that always runs and exits early on docs-only diffs), `new ticket`, `lint`, `gate`, `status`; text and `--json` renderers; exit-code contract; version pin check; `github-issues` adapter (REST via `fetch` with token from `gh auth token` or `GITHUB_TOKEN`, so the same transport serves MCP later); one real spawn test of the built bin on both OSes.
**Uses:** commander 15, `styleText`, tsdown, `path.posix`.
**Avoids:** pitfalls 1 (CI workflow), 3 (Windows), 11 (stale npx), 14 (always-run CI job).

### Phase 3: Skills

**Rationale:** Skills are thin wrappers whose first step is a gate call; they need Phase 2's exit codes. They are also the coding-agent half of the dogfood criterion.
**Delivers:** workflow definition format (one per role: BA interview, designer attach design, dev implement slice, QA verify, lead readiness review, plus reviewer); renderer to SKILL.md with spec-only frontmatter; `init` and `skills sync` copying into `.claude/skills/` and `.agents/skills/` with generated marker and hash; BA workflow that blocks Ready on open questions, assumptions or TODO markers; reviewer workflow that writes only `verification.md`; skill bodies that never restate a rule and reference `npx --yes @scope/accord@<version>`; a test that every command named in a skill exists.
**Avoids:** pitfalls 6 and 7 (drift, runtime paths, LF output), 3 (BA and QA never run the CLI).

### Phase 4: MCP server

**Rationale:** Reuses core, workflow definitions and gate rules; adds only transport, auth and a GitHub-API loader. It is the non-technical half of the dogfood criterion and the riskiest unknown, so it comes after the known parts are solid but before publish.
**Delivers:** Streamable HTTP server; GitHub OAuth with commits authored by the signed-in user; snapshot built from the GitHub tree or tarball API; tools get_workflow, list tickets, get ticket, save ticket, lint, gate ready, gate done, status; prompts as an addition where supported; deployed to a serverless host with no database; verified from claude.ai and at least one tools-only client (ChatGPT or Codex CLI).
**Implements:** the `mcp` package and the file-source interface's second implementation.
**Client support (resolved 2026-09-05):** claude.ai on every plan including Free, Claude Code, Cursor and VS Code Copilot Chat support tools, prompts and resources. ChatGPT developer mode (Plus and up, web only), Codex CLI and Copilot CLI expose tools only. Copilot coding agent and github.com chat do not support OAuth remote MCP. Hence the workflow ships as a tool result.

### Phase 5: Packaging and dogfood

**Rationale:** v0.1 closes on a real ticket, not a publish. Everything above must exist first.
**Delivers:** npm trusted publishing from GitHub Actions (Node 24, `--access public`, first publish may need a manual token); example repo with one maintain-profile and one build-profile ticket; `accord init` on the employer project; one real ticket through Ready and Done with the BA on a chat client over MCP and the developer on a coding agent with the shipped skill; time-to-Ready measured per ticket; token rule checked against the pilot's real stylesheet before any promotion to block.
**Avoids:** pitfall 1 (measure whether the spec is heavier than the code) and 13 (token rule false positives).

### Phase Ordering Rationale

- Dependencies run strictly downward: skills call the CLI, the CLI and MCP both call core, MCP reuses the skills' workflow definitions. No phase needs a later one.
- The isomorphic-core constraint is cheapest to enforce from the first commit; retrofitting `node:fs` out of a working core is the expensive path.
- The Windows CI job from the first commit is non-negotiable: the author develops on Windows and the team is mixed, so a single-OS green build hides bugs in both directions.
- MCP is fourth rather than second because it changes nothing in core and its unknowns (hosting, OAuth, commit API) are best answered against a working CLI that already proves the gates.
- Dogfood is its own phase because PROJECT.md says publishing without dogfooding does not close the milestone.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (MCP):** hosting choice (Workers vs small Node host) and whether `ajv`, `yaml`, `@cucumber/gherkin` run there; GitHub OAuth App vs GitHub App user-to-server tokens for a stateless server that still yields the real author; REST contents vs GraphQL `createCommitOnBranch` for multi-file commits; how to fetch the whole folder per gate call within rate limits; MCP SDK server API for Streamable HTTP and OAuth.
- **Phase 1 (token rule only):** colour and spacing detection heuristics are the one unproven algorithm; Tailwind v4 `@theme` extraction; keep warning-first.
- **Phase 3 (light):** re-verify the four runtimes' skill directories and Codex's handling of non-spec frontmatter keys at planning time; runtimes have moved three times in eighteen months.

Phases with standard patterns (skip research-phase):
- **Phase 1 (except token rule):** library APIs verified by running; snapshot-first and rules-as-data are established shapes.
- **Phase 2:** commander, tsdown, vitest and trusted publishing all verified against official docs with versions.
- **Phase 5:** npm publishing is documented; the rest is measurement.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH for versions, MEDIUM for choices | Registry-checked 2026-09-05; `yaml` and gherkin behaviour verified by running. Monorepo and isomorphic-core implications are reasoned, not researched. |
| Features | MEDIUM | Competitor survey and runtime skill formats from first-party docs, two or more sources each. MCP tool list comes from PROJECT.md, not from research. |
| Architecture | MEDIUM | Library APIs verified; internal structure is a recommendation. Snapshot-first pattern transfers cleanly to the MCP loader. |
| Pitfalls | MEDIUM | Primary papers and official docs cross-checked. MCP-specific pitfalls not covered. |
| MCP server | LOW | Client support matrix resolved from official docs; server-side design entirely unresearched. |

**Overall confidence:** MEDIUM

### Gaps to Address

Still open from `.planning/research/questions.md` (the client-support and no-API-key questions are resolved and not repeated):

- **Commit without clone:** REST contents endpoint vs GraphQL `createCommitOnBranch` for multi-file atomic commits with the user as author; rate limits, file size cap, branch protection. Resolve in Phase 4 planning.
- **OAuth flavour:** GitHub OAuth App vs GitHub App user-to-server tokens; which keeps the server stateless with the token in the client and still yields the real git author. Resolve in Phase 4 planning.
- **Hosting:** Cloudflare Workers vs a small Node host; whether `@cucumber/gherkin`, `yaml` and `ajv` run unchanged (ajv's `new Function` is the known problem). Resolve in Phase 4 planning; affects the validator choice in Phase 1 only if the interface is not kept narrow.
- **Gate over a folder the server never has:** fetch via tarball or tree API per call, or cache by commit SHA. Resolve in Phase 4 planning.
- **Shortcut adapter priority:** employer tracker is Shortcut; v0.1 ships `github-issues`. Decide during Phase 5 whether `none` is enough for the first real ticket.
- **Unverifiable:** ChatGPT sign-in for third-party apps (moot now that MCP is the path) and Codex cloud MCP support.

Decisions the author must make, surfaced by conflicts between research files:

- **Tick key:** `@ac-n` tags (PITFALLS.md) vs scenario name plus step hash (ARCHITECTURE.md). Recommendation: tags. Blocks the Phase 1 schema.
- **Tracker field shape:** `tracker_ids: [42]` (FEATURES.md) vs `tracker: { github-issues: 42 }` (ARCHITECTURE.md). Blocks the Phase 1 schema.
- **Author-mismatch check in `gate done`:** needs `git log`, which core cannot run. Either the CLI host supplies author data into the snapshot, or the check is CLI-only and MCP skips it. Decide in Phase 1.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-09-05) for every pinned version; local execution of `yaml` 2.9.0 and `@cucumber/gherkin` 42.0.1 on Node 24.
- Node.js v22 `util.md` and `fs.md`; docs.npmjs.com trusted publishers; Context7 for commander, vitest, tsdown.
- Agent Skills spec and the Claude Code, Cursor, Copilot and Codex skills docs (directory tables).
- Remote MCP client support: support.claude.com, claude.com/docs/connectors, developers.openai.com developer mode, learn.chatgpt.com MCP, code.claude.com MCP, cursor.com MCP docs, VS Code MCP docs, GitHub Copilot CLI and coding-agent MCP docs (cited in `questions.md`).
- Anthropic legal and compliance page on third-party use of subscription credentials.

### Secondary (MEDIUM confidence)
- arXiv 2605.29442 (20,574 agent sessions: 36% instruction-following, 23% inaccurate self-reporting); Panickssery et al. NeurIPS 2024 on self-preference.
- npm/cli #7838 and PR #8100 (stale npx cache before 11.2); CVE-2024-27980 (`.cmd` spawn EINVAL); cucumber/gherkin #13 (no stable scenario id); copilot-cli #694 (CRLF frontmatter).
- Competitor repositories: spec-kit, OpenSpec, BMAD-METHOD, Backlog.md, Kiro docs, Decap editorial workflow.
- stylelint-declaration-strict-value, Tailwind v4 announcement (token rule design).

### Tertiary (LOW confidence)
- Opinion pieces on spec-driven overhead; Cursor rules migration blog posts; merge-conflict reasoning for BA/QA collisions (no domain source).

---
*Research completed: 2026-09-05*
*Ready for roadmap: yes, with the three author decisions above settled before Phase 1 planning*
