# Phase 9: Publish and Dogfood - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 09-publish-and-dogfood
**Areas discussed:** Publishing mechanism, Dogfood pilot, Dogfood ticket, Measurement

---

## Publishing mechanism

### What triggers the publish workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Push tag `v0.1.0` | `on: push: tags: ['v*']`; version read from the tag and compared to the manifest; the trace lives in git | ✓ |
| `workflow_dispatch` | Run by hand from the Actions tab; easy to retry, but nothing in the repository's history marks a release | |
| GitHub Release published | Carries release notes; adds a UI step, and release notes are separate work | |
| Tag + `workflow_dispatch` | Tag as the main path, dispatch as an escape hatch for a half-failed run | |

**Notes:** Trusted publishing matches on the workflow filename, so that filename has to be fixed
before the first configuration and never renamed.

### Bootstrapping the first publish

| Option | Description | Selected |
|--------|-------------|----------|
| `0.0.0` placeholder | Publish `0.0.0` with a granular token, configure the trusted publisher, then `0.1.0` over OIDC. Criterion 1 stays literally true of `0.1.0` | ✓ |
| `0.1.0` by hand, switch afterwards | Fewest steps, no junk version; but the milestone closes on a publish path that has never run | |
| `NPM_TOKEN` secret in Actions | "From Actions" is true, "trusted publishing" is not; stores exactly the secret OIDC removes | |

**Notes:** npm configures trusted publishing on an existing package page, which is the whole reason
a placeholder is needed. The cost — one permanent `0.0.0` row per package — was accepted openly.

### How many packages go to npm

| Option | Description | Selected |
|--------|-------------|----------|
| One package, core bundled | `noExternal` in `packages/cli/tsdown.config.ts`; core goes `private`. No ordering, no lockstep, no half-published state | ✓ |
| Two packages, core then cli | Keeps the current shape and the `./schemas/*` export; needs sequential publish, a skip-if-exists check, and a same-version test | |
| Two packages, core deprecated | Keeps every cost of two packages and none of the benefit | |

**Notes:** Checked before offering this: schemas are JSON-module imports
(`packages/core/src/validate/ajv.ts:4-6`) and templates are codegen'd, so core reads nothing from
disk at runtime. The MCP host was the only named consumer of a public core, and D-117 removed it.
Flagged to the user as one-way before they chose.

### What the publish job verifies first

| Option | Description | Selected |
|--------|-------------|----------|
| Full check once (ubuntu + Node 24) | `npm ci && npm run check` inside the publish job; catches a tag pointing at a commit CI never saw | ✓ |
| Build then publish | Fastest; trusts `ci.yml` on `main` completely | |
| Full 2 OS x 2 Node matrix | Safest, but repeats what `ci.yml` already does on every push and widens the tag-to-npm window | |

---

## Dogfood pilot

### Which repository is the pilot

| Option | Description | Selected |
|--------|-------------|----------|
| Split: accord + a frontend repo | accord answers criteria 2 and 3; a real frontend repo answers criterion 4's token check | ✓ |
| accord only | One pilot, nothing else touched; but criterion 4's second half would have to be rewritten | |
| A real frontend repo only | Everything on one repository; puts accord into working code before it has proved anything | |

**Notes:** The split was forced by a fact in this repository's own `accord/config.yml` — it ships a
CLI and no interface, so the token rule is skipped here and every `.css` file present is a fixture
or an example.

### Which frontend repository

| Option | Description | Selected |
|--------|-------------|----------|
| `C:/Work/SimplT` | Verified to be a git repository with `frontend/src/app/globals.css`; measurement only, no commit lands there | ✓ |
| Another repo — user names it | | |
| Lint only, in a throwaway copy | Nothing written to the target repository at all | |

### Proving the generated workflow is green

| Option | Description | Selected |
|--------|-------------|----------|
| One pull request on accord | The dogfood ticket goes through a single pull request; `accord.yml` runs on exactly the D-137 path | ✓ |
| A pull request on a scratch repo | Leaves the real history untouched, but weakens "a real project's repository" | |
| Prove it on SimplT | Strongest evidence, but commits accord into working code first | |

**Notes:** Raised as a finding during the discussion — D-136 makes the emitted workflow
`pull_request`-only, and work on this repository goes straight to `main`, so criterion 2 had no
evidence path at all until this was decided. Adding a `push` trigger to the template was rejected as
changing a shipped rule to suit one repository.

---

## Dogfood ticket

### What the ticket is

| Option | Description | Selected |
|--------|-------------|----------|
| README install section | A real gap; right size; `ui: false` so the one profile branch does not fire | ✓ |
| Wait for real work to appear | Truest to the spirit of dogfooding, but leaves the plan open-ended | |
| The `rejected-alternatives` todo | Real, but touches schema, templates, fixtures and goldens, and still carries an unresolved question | |
| Something else — user names it | | |

**Notes:** Reading the README during the discussion turned up three further defects beyond the
missing install section — the "team contract" framing superseded by the 2026-09-11 re-aim, the
"Status: design phase" line, and a paragraph describing the MCP server removed under D-117 — plus a
hard blocker: `packages/cli/package.json` lists `README.md` in `files:` but no
`packages/cli/README.md` exists, so the npm page would be empty. All folded into the ticket's scope.

### Ordering against the publish

| Option | Description | Selected |
|--------|-------------|----------|
| `0.1.0` → ticket → `0.1.1` | npm page stale at `0.1.0`, correct at `0.1.1`; proves tag→OIDC twice and walks the D-94 pin through a real bump | ✓ |
| Fix the README first, then publish | npm page right from the start; needs a different dogfood ticket | |
| Fix it pre-publish except the install section | Splits the README work in two | |

**Notes:** Running the ticket against a local build was never offered — PROJECT.md rules it out
explicitly.

### How the fresh-context review runs

| Option | Description | Selected |
|--------|-------------|----------|
| Subagent, as the skill says | The first branch of D-109 and the path most users take | ✓ |
| A fully cleared session | Stronger isolation, but not the default the skill leads people down | |
| Both, and compare | A real measurement of whether a subagent isolates enough; costs double and produces a finding, not a gate | |

---

## Measurement

### What "time from new ticket to Ready" means

| Option | Description | Selected |
|--------|-------------|----------|
| Wall-clock, `new` → `gate ready` PASS | One number, breaks included, not arguable | ✓ |
| Active working time | Closer to the real cost, but depends on who holds the stopwatch | |
| Both numbers plus gate-run count | Most information for a later comparison; more bookkeeping | |

### Where the numbers are recorded

| Option | Description | Selected |
|--------|-------------|----------|
| `09-VERIFICATION.md` | The artifact every prior phase produces and the one a verifier reads | ✓ |
| `.planning/notes/dogfood-0-1-0.md` | Follows the existing notes precedent; separates evidence from where it is read | |
| Both, split by purpose | Numbers in VERIFICATION, narrative in a note | |

### What the token-rule check concludes

| Option | Description | Selected |
|--------|-------------|----------|
| Raw numbers, no conclusion | Findings, true positives, false positives, with an example of each. The promotion decision stays in v0.2 | ✓ |
| Set a promotion threshold now | Gives v0.2 a target, but sets it from a single stylesheet | |
| Promote to error if clean | Puts a gate behaviour change into a publish-and-dogfood phase, against ROADMAP's "before any promotion" | |

---

## Claude's Discretion

- Post-publish smoke job on a clean runner: `npx --yes @accord-dev/accord@<version> --version`.
- `packages/cli/README.md` generated from the root README by a script and covered by a drift test,
  following the existing `templates.ts` / `skills.ts` pattern.
- The publish workflow's filename fixed at creation and never renamed (trusted publisher matches it).
- `accord init` on this repository leaves the existing `config.yml` alone per D-130, so only
  `.claude/skills/` is written here.
- The publish step skips a version already on the registry rather than failing.
- Confirm the npm organisation `accord-dev` is claimable before the bootstrap. The scope name itself
  was not reopened — it is already in the manifest, `pin.ts`, the generated config, and the goldens.

## Deferred Ideas

- Promoting the token rule to error — v0.2 at the earliest.
- Release notes and changesets — already deferred by the stack decisions.
- A public core API and the `./schemas/*` export — dropped by the one-package decision.
- `.planning/todos/pending/mcp-host-spike.md` — obsolete since D-117 removed Phase 8; should be
  closed rather than carried.
- `.planning/todos/pending/rejected-alternatives-have-no-home.md` — real work, wrong size and wrong
  phase, and still carries an open question of its own.
