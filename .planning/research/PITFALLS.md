# Pitfalls Research

**Domain:** Team spec-and-gate contract for AI-assisted delivery (folder convention, EARS/Gherkin, deterministic CLI gates, multi-runtime skill files, GitHub Issues adapter)
**Researched:** 2026-09-04
**Confidence:** MEDIUM (web sources cross-checked against official docs and primary papers; no cached digests existed, all fetched fresh)

Phase names below are suggestions for the roadmap: **Formats** (folder, schema, templates, parsers), **CLI core** (init/new/lint/status), **Gates** (ready/done, verification.md, ticks), **Skills** (canonical files + wrappers), **Prototype rule**, **Adapter** (github-issues), **Packaging** (npm, npx, CI matrix), **Dogfood** (example repo + employer project).

## Critical Pitfalls

### Pitfall 1: The spec outweighs the code and the team quietly stops writing it

**What goes wrong:**
Spec-driven tools (Kiro, Spec Kit) write three documents before any code; reviewers report the overhead "isn't worth it for small edits and bug fixes" and that specs "drift from implementation within hours". Accord's own rule, "every code-touching story including bug fixes needs a scenario", is exactly the case where teams bail. A ticket file with 15 EARS lines, five scenarios, and a plan for a two-line fix teaches the team that the contract is theatre.

**Why it happens:**
Templates invite filling every section. The BA is judged on completeness, not on ratio to code. Nobody measures time-to-Ready.

**How to avoid:**
- Make the maintain-profile Ready gate genuinely minimal: one Given/When/Then, nothing else required. Templates for maintain tickets should contain only a frontmatter block and one empty scenario.
- `lint` warns (not fails) when limits from design.md are exceeded: intent > 5 lines, > 15 EARS lines, > 5 scenarios. Size discipline is a rule in code, not a wish in a doc.
- Keep "short plan" out of the Ready gate; a plan is the dev's working note, never a gate input.
- In Dogfood, record time from `new ticket` to `gate ready` pass per ticket. If the median exceeds ~10 minutes for maintain tickets, the template is too heavy.

**Warning signs:**
Tickets skipping the accord folder entirely ("just a quick fix"); ticket files longer than the PR diff; BA copy-pasting the same scenario shape across tickets.

**Phase to address:** Formats (template weight), Dogfood (measure).

---

### Pitfall 2: Gates exist only in prompts, so they are bypassed

**What goes wrong:**
The CLI gate is only invoked because a skill file says "run `accord gate ready` first". arXiv 2605.29442 (20,574 sessions) attributes 36.49% of root causes to instruction-following failure on a clearly received instruction; Claude Code's own docs state a skill's content is "not re-read on later turns" and can drop out after compaction, and recommend hooks "to enforce behavior deterministically". A human can also just not run it. A gate that is only ever called voluntarily is advisory.

**Why it happens:**
The design says "the CLI gives the same deterministic answer"; it does, but only when called. Nothing in v0.1's requirements makes the call mandatory.

**How to avoid:**
- Add a GitHub Actions workflow to `init` output that runs `accord gate done <id>` for every ticket touched by a PR, and `accord lint` on the accord folder. CI is the only place the 36% cannot opt out.
- Ship a Claude Code `hooks` entry in the generated wrapper (PreToolUse on `git commit` or Stop) that runs the gate; other runtimes get CI only. Document this asymmetry.
- No `--force` or `--skip` flag on `gate`. Status must show the last gate result per ticket so bypass is visible, not silent.
- Set `disable-model-invocation: true` on role skills so the human explicitly starts the workflow; the gate runs inside it.

**Warning signs:**
Tickets marked done in the tracker with no `verification.md`; `status` shows PASS for tickets that never had a `gate` run recorded.

**Phase to address:** Gates (no bypass flags, result recording), Packaging (CI workflow in `init`).

---

### Pitfall 3: BA and QA never run the CLI because it lives in the dev's toolchain

**What goes wrong:**
`npx` still needs Node, a terminal, and a git checkout. A BA who works in Shortcut and Word will ask the dev to "run the thing". QA ticks end up in the dev's commits, which destroys the ownership signal the Done gate depends on (git author is the only proof of who ticked).

**Why it happens:**
The CLI is designed for devs; the roles that own the contract are not devs.

**How to avoid:**
- The role skill is the BA's interface, not the CLI. The BA runs the interview in their own agent (Claude Code, Cursor, Copilot) and the skill runs the CLI. Verify in Dogfood that the BA and QA on the pilot project can complete their skill workflow without a dev present.
- CI posts `accord status` as a PR comment so QA can read gate state in GitHub without a terminal.
- `gate done` warns when the commit author of a tick line is not in the QA roster from `config.yml` (via `git log -L` or blame on the frontmatter block). Warning, not block, because roles merge on small teams.

**Warning signs:**
All tick commits authored by one person; BA asking in chat "can someone run lint on my ticket".

**Phase to address:** Skills (BA/QA skills are first-class, tested with non-dev users), Gates (author warning), Dogfood.

---

### Pitfall 4: Agents self-verify and pre-tick, and the Done gate cannot tell

**What goes wrong:**
The same paper reports "Inaccurate Self-Reporting" in 22.58% of sessions. Self-preference research (Panickssery et al., NeurIPS 2024; arXiv 2509.26600) shows LLM evaluators favour their own outputs. A dev agent that wrote the code, writes `verification.md`, and edits the frontmatter ticks will make `gate done` pass in one session with three sets that trivially match, because it produced all three.

**Why it happens:**
Set-equality between scenarios, evidence, and ticks proves consistency, not independence. Files carry no authorship.

**How to avoid:**
- Reviewer runs in a fresh context. Claude Code wrapper uses `context: fork`; other runtimes' reviewer skill instructs starting a new session and is verified by a separate commit. Prefer a different model family for the reviewer where the team has one.
- `verification.md` evidence must be checkable: each scenario maps to a test name, command, or file path, and `gate done` verifies the referenced file or test exists. Prose evidence ("verified manually") fails.
- `gate done` compares git authors: if `verification.md` and the tick commit share an author with the implementing commits, warn loudly (block on `build` profile).
- Record a hash of the scenario block in `verification.md`; if AC changed after verification, the gate fails with "AC changed after verification".

**Warning signs:**
`verification.md` committed in the same commit as the implementation; ticks landing seconds after verification; evidence lines without file paths.

**Phase to address:** Gates.

---

### Pitfall 5: Scenario names as keys, so a rename orphans every tick

**What goes wrong:**
Gherkin has no native stable scenario ID (cucumber/gherkin #13); the JS parser assigns generated `astNodeId`s per parse, and tooling falls back to `uri:line` or content digest. If ticks and evidence key on the scenario name, a BA fixing a typo orphans the QA tick and the reviewer's evidence, and `gate done` fails on a ticket that was actually done. Duplicate names are legal Gherkin and make the set match ambiguous.

**Why it happens:**
Names are the obvious key and look stable in a five-scenario file.

**How to avoid:**
- Require a tag ID on every scenario: `@ac-1`, `@ac-2`, assigned by `new ticket` and `lint --fix`. Ticks and evidence key on the tag. Lint fails on missing or duplicate tags.
- Lint the "orphaned QA tick" case as a warning with the fix suggested (already in requirements; keep it).
- Parse with `@cucumber/gherkin`, not regex; reject files the parser rejects.

**Warning signs:**
`gate done` failures after AC edits; QA re-ticking after a BA commit.

**Phase to address:** Formats.

---

### Pitfall 6: Skill wrappers drift from the CLI and from each other

**What goes wrong:**
Skills restate the gate rules in prose ("check the ticket has at least one scenario and, if `ui: true`..."). The CLI changes; the prose does not; the agent follows the prose. Four runtimes multiply this. Cursor changed its instruction format three times in eighteen months (`.cursorrules` to `.cursor/rules/*.mdc` to folder rules to skills); Claude Code merged `.claude/commands` into skills; Copilot added `.github/skills` in 2026. Hand-edited wrappers rot.

**Why it happens:**
Wrappers are written once at `init` and never regenerated; rules are duplicated for readability.

**How to avoid:**
- Skills never restate a rule. They say "run `accord gate ready <id>`; stop on non-zero exit; show the output". The CLI output is the only rule text.
- Generate the command reference section of each canonical skill from the CLI's own help at build time; a test asserts every `accord` command mentioned in any skill exists.
- Wrapper header carries a generated marker and a hash of the canonical file. `accord init` (idempotent) regenerates wrappers whose hash is stale and refuses to overwrite a wrapper whose body was hand-edited unless `--force`. User customisation goes in the canonical file.
- One table in code maps runtime to path and frontmatter dialect, with a fixture test per runtime. Bump it as a normal change when a runtime moves.

**Warning signs:**
Diff between wrappers of the same role; an agent citing a rule the CLI does not enforce.

**Phase to address:** Skills.

---

### Pitfall 7: The four runtimes do not read the same file, and some read it twice

**What goes wrong:**
Verified discovery paths (official docs, 2026-09): Claude Code reads `.claude/skills/` only; Codex reads `.agents/skills/` (repo) and `~/.codex/skills`; Copilot reads `.github/skills`, `.claude/skills`, or `.agents/skills`; Cursor reads `.cursor/skills`, `.agents/skills`, and for compatibility `.claude/skills` and `.codex/skills`. So generating one wrapper per enabled runtime produces duplicate skills in Cursor and Copilot (both see `.claude/skills` and their own), and a Cursor user has complained about exactly this noise. Frontmatter also differs: Claude Code accepts `disable-model-invocation`, `context`, `hooks`, `argument-hint`; strict validators (claude.ai upload, `skills-ref`) reject those keys. CRLF in frontmatter breaks Copilot CLI agent loading (github/copilot-cli #694) and other regex-based loaders.

**Why it happens:**
The Agent Skills spec standardises the file, not the discovery path or the extension keys.

**How to avoid:**
- Treat `.claude/skills` as the shared location when Claude Code is enabled; Cursor and Copilot pick it up, so skip their own directories unless Claude Code is disabled. Codex needs `.agents/skills` regardless. Encode this in the runtime table and test it.
- Wrapper frontmatter is spec-minimal (`name`, `description`) plus only that runtime's extension keys. Body is one instruction: read and follow `<accord root>/skills/<role>.md`, with a POSIX path.
- Write all generated files with LF and add `.gitattributes` `<root>/** text eol=lf` in `init`. Parse with CRLF and BOM normalisation regardless.
- `name` must equal the directory name, lowercase, hyphens, no double hyphens, max 64 chars; validate in `init`.

**Warning signs:**
`/skills` list in Cursor showing two `accord-ba` entries; Copilot reporting "No such agent" on Windows-authored files.

**Phase to address:** Skills.

---

### Pitfall 8: YAML frontmatter silently changes the meaning of values

**What goes wrong:**
Unquoted `2026-08-12` becomes a JS `Date` in js-yaml; `no`/`yes`/`off` become booleans in YAML 1.1 parsers (the Norway problem); `0123` becomes `123`; a ticket ID like `1e3` becomes `1000`. A BA writes `confirmed_by: no` meaning "not yet" and the schema validator sees `false`. CRLF and BOM break regex-based frontmatter splitters (three separate tool issues found).

**Why it happens:**
YAML's implicit typing; frontmatter splitters written for LF.

**How to avoid:**
- Parse with the `yaml` package (YAML 1.2 core schema), and pass a custom schema or `customTags` so dates stay strings; declare every scalar in the JSON schema as `string` unless it is genuinely boolean, and coerce nothing.
- Normalise `\r\n` to `\n` and strip a BOM before the frontmatter split; test with CRLF and BOM fixtures.
- On write (`new`, `lint --fix`, tick updates), always quote strings and emit LF.
- Reserve `yes`/`no` nowhere in the schema; use `true`/`false` or enums.

**Warning signs:**
Schema errors on Windows-authored files only; `status` showing dates as `[object Date]`.

**Phase to address:** Formats.

---

### Pitfall 9: EARS line check that lies in both directions

**What goes wrong:**
A regex for `WHEN .* SHALL` flags prose in the intent section that happens to contain "shall", misses the WHILE/IF-THEN/WHERE patterns, rejects "the system shall" when the system is named ("the Invoice service shall"), and accepts a line with two responses. A BA learns to game the regex instead of writing a requirement.

**Why it happens:**
EARS is a grammar with five patterns and a fixed clause order (While, When, the <system> shall <response>), and the check is written as one regex over the whole file.

**How to avoid:**
- Scope the check to lines inside the `## Requirements` section only, one requirement per list item.
- Implement the grammar: optional `WHILE <state>`, optional `WHEN <trigger>` or `IF <condition> THEN`, optional `WHERE <feature>`, required `the <system> shall <response>`; classify each line by pattern and report which pattern it matched. Unmatched lines are warnings with the nearest pattern suggested, not errors, until Dogfood shows the grammar is stable.
- Lint vagueness terms as warnings (`appropriate`, `reasonable`, `user-friendly`, `etc`).

**Warning signs:**
BA complaints about "the linter wants weird wording"; requirements rewritten into unnatural forms to pass.

**Phase to address:** Formats.

---

### Pitfall 10: Markdown parsed by line regex, not by a parser

**What goes wrong:**
A heading inside a fenced code block, a second `## Acceptance criteria` section, or a Gherkin block written plain rather than fenced all confuse a line-based reader, and the gate passes or fails on layout accidents.

**How to avoid:**
Fixed template with fixed H2 names and a fenced ```gherkin block for AC; parse with a CommonMark parser (remark/mdast), locate sections by heading node, reject duplicate section headings, and hand the fenced block content to `@cucumber/gherkin`.

**Warning signs:**
Tickets that pass `lint` but whose scenarios `status` counts as zero.

**Phase to address:** Formats.

---

### Pitfall 11: `npx` runs a stale version and nobody knows

**What goes wrong:**
Before npm 11.2.0, `npx @scope/accord` reused whatever version was cached and never refreshed (npm/cli #7838; fixed by PR #8100, shipped Feb 2025). Node 20 and 22 ship npm 10.x, so most users are still on the old behaviour. A BA on a cached 0.1.0 and a dev on 0.2.0 get different gate answers from "the same deterministic CLI".

**How to avoid:**
- Store the accord version in `config.yml`; the CLI compares itself to it and refuses with "config expects 0.2.0, running 0.1.0; run `npx @scope/accord@0.2.0`" (or warns, per profile).
- Skills and the CI workflow call `npx --yes @scope/accord@<version from config>`, never the bare name.
- `accord upgrade` bumps the pin and regenerates wrappers.

**Warning signs:**
Gate results differing between machines on the same commit.

**Phase to address:** Packaging.

---

### Pitfall 12: Windows breaks the CLI in ways the author's machine does not show

**What goes wrong:**
Node 18.20.2+/20.12.2+ throw `EINVAL` when `spawn` is given a `.cmd`/`.bat` without `shell: true` (CVE-2024-27980), so spawning `npx.cmd`, `npm.cmd`, or `gh.cmd` fails. Backslash paths written into frontmatter or wrapper "read this file" lines break POSIX teammates; forward-slash globs fail if built with `path.join`. Box-drawing characters in the `status` table render as garbage in legacy `cmd.exe`. Case-insensitive filesystems hide a ticket-ID case mismatch until Linux CI. ESM-only dependencies (chalk 5, inquirer 9) crash a CommonJS build with `ERR_REQUIRE_ESM`.

**How to avoid:**
- Spawn only `.exe` binaries (`git`, `gh`) by name; never spawn npm/npx from the CLI.
- Store and print all repo-relative paths with forward slashes (`path.posix`); use `fast-glob` with forward slashes.
- Ship ESM, `engines.node >= 20`, keep dependencies to a handful (yaml, @cucumber/gherkin, a CommonMark parser, an arg parser); avoid chalk-class deps or use ESM natively.
- ASCII-only table output by default; colour only when TTY.
- CI matrix: `windows-latest` and `ubuntu-latest` from the first CLI commit, with a test that runs the full `init`, `new`, `lint`, `gate` cycle in a temp repo.

**Warning signs:**
Green CI on Ubuntu only; issues titled "EINVAL on Windows".

**Phase to address:** CLI core (paths, spawn), Packaging (matrix, ESM).

---

### Pitfall 13: Prototype token rule that cries wolf

**What goes wrong:**
A blanket regex for `#[0-9a-f]{3,6}`, `rgb(`, or `\d+px` flags `transparent`, `currentColor`, `1px` borders, `0`, SVG `fill` attributes, hex values inside `var(--x, #fallback)`, and the token definitions themselves if the prototype declares `:root` variables. It misses Tailwind arbitrary values (`bg-[#123456]`) and inline `style=""`. Token extraction also has two shapes: Tailwind v4 is CSS-first (`@theme { --color-primary: ... }`, `tailwind.config.js` no longer auto-loaded), v3 keeps a JS/TS config that cannot safely be `require`d from the CLI.

**How to avoid:**
- Allowlist model, as `stylelint-declaration-strict-value` does: for colour and spacing properties, the value must be `var(--token)`, a token-derived Tailwind class, or an explicit exemption (`transparent`, `currentColor`, `inherit`, `0`, `1px`, `100%`).
- Token sources in v0.1: CSS custom properties from declared files (covers CSS variables and Tailwind v4 `@theme`). For a v3 JS config, require the project to declare the token names in `config.yml` or export a CSS file; do not evaluate JS.
- Scan `<style>` blocks, `style=""` attributes, and Tailwind arbitrary-value classes; report line numbers. Start as a warning; promote to a block only after Dogfood on a real project.
- Flag this phase for deeper research; it is the least certain part of the design.

**Warning signs:**
Designers adding `<!-- accord-ignore -->` everywhere; every prototype failing on its first lint.

**Phase to address:** Prototype rule (separate phase after Gates; research flag).

---

### Pitfall 14: BA and QA collide in the same ticket file

**What goes wrong:**
Ticket frontmatter holds QA ticks; the body holds BA-owned AC and a dev-owned plan. Git merges fine when hunks are apart, but ticks, `status`, and `updated` fields sit within three lines of each other at the top of the file, and a BA rewording AC on the docs branch while QA ticks on another produces conflicts that non-devs cannot resolve. Batched "one docs PR per day" branches also conflict with feature branches that snapshot the ticket.

**How to avoid:**
- No `updated`/timestamp fields in frontmatter; no tracker status in git (already decided; keep it).
- Ticks as a YAML block list, one `@ac-n` per line, as the last key in frontmatter, so QA edits are append-only at a fixed location away from BA fields.
- Plan lives in a dev-owned section at the end of the body or in a separate `plan.md`; the AC block sits between fixed headings so BA hunks are distant from tick hunks.
- Skills commit directly to the working branch with small commits and rebase before push, rather than holding day-long batches.
- CI path filter: use a workflow that always runs and exits early on docs-only changes, because a skipped required check leaves the PR unmergeable under branch protection.

**Warning signs:**
Conflict markers inside frontmatter in the history; QA asking devs to "fix the merge".

**Phase to address:** Formats (layout), Gates (tick placement), Packaging (CI workflow).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Regex over whole file for EARS/Gherkin | Ships in a day | False positives train the BA to game it; parser swap later changes gate results | Never; use parsers from the start |
| Scenario name as tick key | No tags in AC | Renames orphan ticks, duplicates ambiguous | Never |
| Hand-written per-runtime wrappers | No generator to build | Four copies drift within weeks | Never (PROJECT.md already excludes it) |
| Bare `npx @scope/accord` in skills | Simpler docs | Stale-cache divergence on npm < 11.2 | Only in README examples, never in generated files |
| `status` reads `verification.md` too | Richer table | Couples status to reviewer file; slower over 500 tickets | Never (design says ticket files only) |
| Evaluate `tailwind.config.js` for tokens | Zero config for v3 users | Arbitrary code execution, ESM/TS variants break | Never in v0.1; require declared CSS or names |
| Skip Windows CI | Faster CI | Author-on-Windows hides POSIX bugs, and vice versa | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Issues | PAT pasted into `config.yml` and committed | Adapter uses `gh auth token` or `GITHUB_TOKEN` env; config holds owner/repo only; `lint` warns on token-shaped values |
| GitHub Issues | Writing status back to issues in v0.1 | Read-only in v0.1: resolve `tracker_ids` to titles/URLs for `status`; tracker stays source of truth |
| GitHub Actions | `paths-ignore` on a required check | Always-run job that exits 0 early on docs-only diffs |
| Claude Code hooks | Wrapper grants `allowed-tools: Bash(*)` | Grant only `Bash(npx --yes @scope/accord@* *)`; `allowed-tools` is applied even in untrusted folders |
| Cursor + Claude Code | Generating both `.cursor/skills` and `.claude/skills` | Cursor reads `.claude/skills`; generate one |
| Codex | Assuming it reads `.claude/skills` | Generate `.agents/skills` for Codex; keep `AGENTS.md` pointer minimal |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Generated skill with broad `allowed-tools` | Any clone runs arbitrary shell without a prompt (Claude Code does not gate this on workspace trust) | Narrow grant to the accord command only |
| Reviewer agent given write access to ticket frontmatter | Pre-ticking collapses the three-party model | Reviewer skill writes only `verification.md`; `gate done` author check |
| Prototype HTML executed with project scripts | Script injection into reviewer's browser | Prototypes are static; lint rejects `<script src=` outside the repo |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Gate output says FAIL without the fix | BA cannot self-serve; asks a dev | Every failure line names the file, line, and the one-line fix |
| `init` overwrites edited wrappers | Lost customisation, distrust of `init` | Hash-marked wrappers; refuse without `--force` |
| Dozens of lint warnings on first run | Team ignores the linter | Warnings grouped and capped; `--fix` for mechanical ones (tags, quoting, LF) |
| Non-ASCII table in `cmd.exe` | Garbled `status` | ASCII table, colour only on TTY |

## "Looks Done But Isn't" Checklist

- [ ] **`gate done`:** passes on an empty scenario set (three empty sets are equal). Verify it requires at least one scenario.
- [ ] **`gate done`:** passes when AC changed after `verification.md` was written. Verify the scenario-block hash check.
- [ ] **Wrappers:** generated for Claude Code but Codex users get nothing. Verify `.agents/skills` is emitted when `codex` is in `runtimes`.
- [ ] **Frontmatter parser:** green on the author's LF files. Verify CRLF and BOM fixtures.
- [ ] **CLI:** green on Ubuntu. Verify the `windows-latest` matrix job runs the full cycle.
- [ ] **`npx` in generated files:** uses a bare name. Verify every generated reference pins `@<version>`.
- [ ] **Role ownership:** enforced only in prose. Verify the author-roster warning exists in `gate done`.
- [ ] **Token rule:** tested only on a hand-made fixture. Verify against the pilot project's real stylesheet before promoting from warning to block.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ticks keyed by name, renames orphaned them | MEDIUM | Add `@ac-n` tags with `lint --fix`; migrate ticks by matching old names once; document as a breaking change |
| Wrappers drifted after hand edits | LOW | Move edits to canonical file; `init --force` regenerates |
| Stale `npx` versions across team | LOW | Add version pin to config; users run `npx @scope/accord@<ver>` once; npm 11.2+ users unaffected |
| Regex EARS check gamed by BA | MEDIUM | Replace with grammar classifier; re-lint all features as warnings first, block after cleanup |
| Team abandoned spec on maintain tickets | HIGH | Cut the maintain template to one scenario; re-run Dogfood measurement; accept that build-profile rigour does not transfer |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Spec outweighs code | Formats, Dogfood | Maintain template is one scenario; median time-to-Ready measured on pilot |
| 2 Gates bypassed | Gates, Packaging | No bypass flags; `init` emits CI workflow; hook in Claude Code wrapper |
| 3 BA/QA never run CLI | Skills, Dogfood | BA and QA complete their skill workflow on the pilot without a dev |
| 4 Self-verification, pre-ticking | Gates | Author-mismatch warning; evidence existence check; AC hash check |
| 5 Scenario names as keys | Formats | Tags mandatory; rename fixture keeps ticks |
| 6 Skill drift from CLI | Skills | Test: every command in skills exists; hash-marked wrappers |
| 7 Runtime paths and dialects | Skills | Runtime table with per-runtime fixture; dedupe for Cursor/Copilot; LF output |
| 8 YAML typing | Formats | Date, Norway, leading-zero, CRLF, BOM fixtures |
| 9 EARS regex | Formats | Grammar classifier with pattern report; warnings until Dogfood |
| 10 Markdown line regex | Formats | CommonMark parser; duplicate-heading fixture |
| 11 Stale npx | Packaging | Version pin in config and generated files |
| 12 Windows | CLI core, Packaging | Windows CI job runs full cycle; no `.cmd` spawns |
| 13 Token rule false positives | Prototype rule | Allowlist model; warning-first; research flag |
| 14 BA/QA file collisions | Formats, Gates, Packaging | Tick block last; no timestamps; always-run CI job |

## Sources

Confidence per seam: `websearch` cross-checked = MEDIUM; single-source = LOW.

- [arXiv 2605.29442, How Coding Agents Fail Their Users (20,574 sessions)](https://arxiv.org/html/2605.29442) — C6 instruction-following 36.49%, S7 inaccurate self-reporting 22.58% (MEDIUM, primary)
- [arXiv 2602.11988, Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988) — context files do not raise success, +20% cost (MEDIUM)
- [Panickssery et al., LLM Evaluators Recognize and Favor Their Own Generations](https://proceedings.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf); [arXiv 2509.26600](https://arxiv.org/abs/2509.26600) (MEDIUM)
- [Agent Skills specification](https://agentskills.io/specification) — name/description constraints, allowed keys (MEDIUM, primary)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills) — `.claude/skills` only, content not re-read, hooks for determinism, `allowed-tools` not trust-gated (MEDIUM, primary)
- [Cursor Agent Skills docs](https://cursor.com/docs/skills); [Cursor forum: duplicate skill roots](https://forum.cursor.com/t/toggle-or-allowlist-for-agent-skills-roots-stop-loading-claude-skills-and-codex-skills-when-i-only-want-cursor-agents/160199) (MEDIUM)
- [GitHub Docs: Adding agent skills for Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills); [copilot-cli #694 CRLF frontmatter](https://github.com/github/copilot-cli/issues/694) (MEDIUM)
- [openai/codex docs/skills.md](https://github.com/openai/codex/blob/main/docs/skills.md) (MEDIUM)
- [.cursorrules deprecated](https://www.flowql.com/en/blog/guides/cursor-rules-deprecated-libraries/); [Cursor rules guide](https://skillwright.app/blog/cursor-rules-guide) (LOW, secondary)
- [npm/cli PR #8100 npx stale cache fix, npm 11.2.0](https://github.com/npm/cli/pull/8100); [npm/cli #7838](https://github.com/npm/cli/issues/7838) (MEDIUM)
- [Node.js April 2024 security release, CVE-2024-27980](https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2); [gsd-build #2598 EINVAL on npm.cmd](https://github.com/gsd-build/get-shit-done/issues/2598) (MEDIUM)
- [BMAD-METHOD #1197 ERR_REQUIRE_ESM](https://github.com/bmad-code-org/BMAD-METHOD/issues/1197); [Joyee Cheung, require(esm) implementer's tales](https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-implementers-tales/) (MEDIUM)
- [npm 402 on scoped publish](https://github.com/npm/npm/issues/8161) (MEDIUM)
- [YAML frontmatter traps](https://formatarc.com/en/blog/markdown-frontmatter-yaml-json/); [Norway problem](https://yamlforge.dev/en/blog/yaml-norway-problem-solution-mj0b6xo6); [qwen-code #2053 CRLF/BOM](https://github.com/QwenLM/qwen-code/issues/2053) (MEDIUM)
- [cucumber/gherkin #13 unique test names](https://github.com/cucumber/gherkin/issues/13); [cucumber/gherkin README](https://github.com/cucumber/gherkin/blob/main/README.md) (MEDIUM)
- [Alistair Mavin, EARS official guide](https://alistairmavin.com/ears/); [Modern Requirements EARS guide](https://www.modernrequirements.com/blogs/ears-notation-the-practical-guide/) (MEDIUM)
- [Spec-driven development, Back to the Future?!](https://jeromevdl.medium.com/spec-driven-development-back-to-the-future-d71fde8d47cf); [Spec Kit vs Kiro](https://codemyspec.com/blog/spec-kit-vs-kiro) (LOW, opinion pieces)
- [claude-code #7777 instructions ignored](https://github.com/anthropics/claude-code/issues/7777); [cli/cli #14075 AGENTS.md not read](https://github.com/cli/cli/issues/14075) (MEDIUM)
- [stylelint-declaration-strict-value](https://github.com/AndyOGo/stylelint-declaration-strict-value) (MEDIUM)
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4); [tailwindlabs discussion #16803 on @config](https://github.com/tailwindlabs/tailwindcss/discussions/16803) (MEDIUM)
- [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) (MEDIUM)
- Merge-conflict mechanics for BA/QA collisions: no domain-specific source found; reasoned from git hunk behaviour (LOW)

---
*Pitfalls research for: Accord, team spec-and-gate contract for AI-assisted delivery*
*Researched: 2026-09-04*
