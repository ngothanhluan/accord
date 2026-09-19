# Phase 7: Scaffolding and Example Repo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 7-Scaffolding and Example Repo
**Areas discussed:** Idempotency and overwriting, CI workflow shape, AGENTS.md/CLAUDE.md pointer, Example repo

---

## Idempotency and overwriting

**How does `init` know a file was edited?**

| Option | Description | Selected |
|--------|-------------|----------|
| Exists = skip | Never touch a path that exists. Least code, absolute guarantee. Cost: templates never upgrade. | ✓ |
| Marker + hash like `skills sync` | Refresh pristine files, keep edited ones. Cost: markers inside templates and config. | |
| Separate hash manifest | Manifest file holds generation hashes. Cost: another state artifact to commit and drift. | |

**What does the second run print?**

| Option | Description | Selected |
|--------|-------------|----------|
| List created/skipped | Same path list both runs, marked skipped on the second. | ✓ |
| Only changes | One "nothing to do" line. Terser; shows nothing about what was checked. | |

**`init` in a repo that already has `accord/`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fill gaps, keep what exists | `init` means "conform to the contract", not "greenfield only". | ✓ |
| Refuse if `config.yml` exists | Exit 2. Safest, but no upgrade path for a team. | |

**Does `config.yml` ask anything?**

| Option | Description | Selected |
|--------|-------------|----------|
| Always defaults + comments | No prompt, no flags. Keeps the CLI non-interactive and CI-runnable. | ✓ |
| Command-line flags | `--profile`, `--roles`, `--runtimes`. More argv surface to test. | |
| Interactive prompts | Friendlier first run; breaks CI and adds a prompt layer. | |

**Notes:** Raised during the area that "exists = skip" sits in tension with `skills sync`, which must
refresh unedited copies or SKILL-11 has nothing to detect. Resolved by scoping the new rule to what
`init` itself writes and leaving the sync rule untouched (D-130 / D-131).

---

## CI workflow shape

**Where do touched tickets come from?**

| Option | Description | Selected |
|--------|-------------|----------|
| `git diff base...HEAD` | Filter `accord/tickets/*.md`, id from file name. Tracker-independent. | ✓ |
| Branch name / PR title | Depends on each team's naming convention. | |
| Every open ticket | Simplest; turns every PR red over someone else's ticket. | |

**Docs-only or no-ticket diff?**

| Option | Description | Selected |
|--------|-------------|----------|
| Pass with a reason line | Job always runs, always green, states why. Safe as a required check. | ✓ |
| Skip the job | `paths:` filter. A required check then hangs pending forever. | |

**How is accord invoked?**

| Option | Description | Selected |
|--------|-------------|----------|
| `npx --yes @accord-dev/accord@<pin>` | Matches the pin in `config.yml`; no dependency in the user's repo. | ✓ |
| setup-node + `npm ci` + local bin | Faster; forces every consuming repo to be a Node project. | |

**Does `gate ready` run in CI?**

| Option | Description | Selected |
|--------|-------------|----------|
| `lint` + `gate done` only | CLI-02 verbatim; Ready belongs to the agent session, not the PR. | ✓ |
| Both gates | Stricter; reddens every in-progress branch. | |

**Notes:** Trigger events were not specified anywhere in ROADMAP or REQUIREMENTS, so they were raised
as an open decision rather than assumed. `pull_request` only was chosen — the base sha comes from the
event, with no empty-`before`-sha edge case and no base rule needed for a manual run (D-136).

---

## AGENTS.md / CLAUDE.md pointer

**How is the block marked?**

| Option | Description | Selected |
|--------|-------------|----------|
| HTML comment pair | `<!-- accord:start -->` … `<!-- accord:end -->`. Findable, invisible when rendered. | ✓ |
| Heading only | `## accord` at the end. Cleaner to read; no accord/human boundary. | |

**Second run with the block present?**

| Option | Description | Selected |
|--------|-------------|----------|
| Skip, do not touch | Consistent with the exists-= -skip rule. | ✓ |
| Update in place between markers | Keeps the pointer current; breaks the simple rule just chosen. | |

**What goes in the block?**

| Option | Description | Selected |
|--------|-------------|----------|
| Paths + one rule line | Skill paths plus "no ticket starts before `gate ready` passes". No skill body. | ✓ |
| Paths only | Minimal; an agent that never loads a skill learns no rule at all. | |

**Which files?**

| Option | Description | Selected |
|--------|-------------|----------|
| Both, always | ROADMAP criterion 3 names both unconditionally. | ✓ |
| Filtered by `runtimes:` | Matches `skillTargets`; diverges from the criterion's wording. | |

---

## Example repo

**Where does it live?**

| Option | Description | Selected |
|--------|-------------|----------|
| `examples/` in this repo | Two directories; this repo's CI gates them. No second repo to sync. | ✓ |
| Separate GitHub repo | Most realistic install experience; cannot be exercised by this phase's CI. | |
| Reuse root `accord/` | Fewest files; maintain profile only, so INTG-02 is unprovable. | |

**Generated or hand-written?**

| Option | Description | Selected |
|--------|-------------|----------|
| `init` generates, human fills content | Proves `init` output passes the gates; matches D-104. | ✓ |
| Hand-written throughout | Full control; loses the proof. | |

**Where is the proof?**

| Option | Description | Selected |
|--------|-------------|----------|
| vitest fixture + CI job | Red locally when a gate rule changes; CI proves the emitted YAML runs. | ✓ |
| CI job only | Closest to real; slow and not runnable locally. | |
| vitest only | Fast; the generated workflow is never shown to run. | |

**Phase 6 carry-over SKILL-04?**

| Option | Description | Selected |
|--------|-------------|----------|
| Take it in Phase 7 | Content fix plus a regression test, as its own plan. Where the owner deferred it. | ✓ |
| Defer again to Phase 9 | Keeps Phase 7 focused on `init`; debt survives two more phases. | |

---

## Claude's Discretion

- Wording of the generated `config.yml` comments, the pointer's single rule line, and the workflow's
  "nothing to gate" message.
- The core/cli split for the scaffolding code — follow the D-107 shape without re-asking.
- Job and step names inside the generated workflow.

## Deferred Ideas

- A template/workflow upgrade path for already-initialised repositories (marker or hash scheme, or an
  `accord upgrade` command).
- `push` and `workflow_dispatch` triggers for the generated workflow.
- Flags or prompts for `config.yml` contents.
- SKILL-10 and SKILL-11 — already parked in REQUIREMENTS under later work.
