# Phase 9: Publish and Dogfood - Research

**Researched:** 2026-09-21
**Domain:** npm trusted publishing (OIDC) from GitHub Actions; tsdown workspace bundling; release sequencing in a pinned-version monorepo
**Confidence:** HIGH for the mechanics (probed by running); MEDIUM for two npm-UI facts that could not be verified without an npm login

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-149:** The publish workflow triggers on **a pushed tag matching `v*`** and nothing else. It
  reads the version from the tag, compares it to `packages/cli/package.json`, and fails before
  publishing if they differ. `workflow_dispatch` and `release: published` were both declined:
  a dispatch leaves nothing in the repository's history saying which commit became which version,
  and a GitHub Release adds a UI step plus release notes, which is separate work. The pin (D-94) is
  exact string equality against a version in `config.yml`, so there has to be one point in git that
  names that string, and a tag is that point.
  — **Reversibility:** reversible — adding a second trigger is a workflow edit.

- **D-150:** **One package is published: `@accord-dev/accord`, with `@accord-dev/accord-core`
  bundled into `dist/cli.js`.** Core becomes `private: true` and stops being published at all.
  `packages/cli/tsdown.config.ts` gains `noExternal` for the core package; nothing else about the
  build, the tests, or the workspace layout changes. Verified safe: the schemas are imported as JSON
  modules (`packages/core/src/validate/ajv.ts:4-6`) and the templates are already codegen'd into
  `packages/core/src/generated/templates.ts`, so core reads nothing from disk at runtime and the
  `schemas/` and `templates/` entries in its `files:` list serve only the `./schemas/*` export.
  The reason core was ever a separately published package was the MCP host, removed under D-117;
  STACK.md decision 8 ("single package with two entry points, not a monorepo") is what this
  restores. What is lost: the public `@accord-dev/accord-core` API and the `./schemas/*` export for
  editor tooling. What is gained: no publish ordering, no version lockstep across two manifests, and
  no half-published state where core is on npm at a version that can never be republished.
  — **Reversibility:** one-way — once `0.1.0` of the CLI is on npm with core inlined, splitting core
  back out means publishing a new package name at a new version and finding every consumer; there
  are none today, which is exactly why the window to decide is now.

- **D-151:** The first publish bootstraps with a **`0.0.0` placeholder**: publish `0.0.0` from the
  author's machine with a granular token so the package exists on npmjs.com, configure the trusted
  publisher there against this repository and the fixed workflow filename, then let `0.1.0` publish
  from Actions over OIDC. npm configures trusted publishing on a package page, so the package has to
  exist first; this is the only ordering under which ROADMAP criterion 1 — *"published from GitHub
  Actions via npm trusted publishing"* — is literally true of `0.1.0` itself. The cost is one
  permanent `0.0.0` row on npm that nothing installs, because no `config.yml` ever pins it.
  Publishing `0.1.0` by hand was declined because it closes the milestone on a publish path that has
  never run; an `NPM_TOKEN` secret in Actions was declined because creating and storing that secret
  is the thing OIDC exists to remove.
  — **Reversibility:** one-way — a version published to npm cannot be replaced, only deprecated.

- **D-152:** The publish job runs **`npm ci && npm run check` once on `ubuntu-latest` with Node 24**
  before `npm publish`. One run, not the full 2 OS x 2 Node matrix: `ci.yml` already runs that matrix
  on every push to `main`, and the one hole it cannot cover is a tag pointing at a commit that never
  went through CI — which a single check closes. Node 24 because trusted publishing needs Node
  >= 22.14 and npm >= 11.5.1 on the publish runner.

- **D-153:** The dogfood is **split across two repositories**, because no single repository answers
  all four criteria. This repository answers criteria 2 and 3: it is a real project, D-132 already
  anticipated running `init` against it, and the ticket will be real work on it. `C:/Work/SimplT`
  answers the token half of criterion 4 and nothing else. The split is forced by a fact recorded in
  this repository's own `accord/config.yml`: *"This repository ships a CLI and no interface, so no
  file exists at this path and `accord lint` reports the token rule as skipped."* Every `.css` file
  here is a fixture or an example — there is no real stylesheet to check the rule against.

- **D-154:** The token measurement runs against **`C:/Work/SimplT`**, whose
  `frontend/src/app/globals.css` is a real stylesheet in a real git repository. That repository
  receives no commit: the run sets `design.tokens` to the stylesheet path, reads the `accord lint`
  output, and the numbers land in this repository's `09-VERIFICATION.md`. Note for planning: `init`
  writes `tokens: ""` by default (D-134), which skips the rule outright, so the measurement requires
  editing that one key after `init`.

- **D-155:** ROADMAP criterion 2 — *"the generated CI workflow is green"* — is proved by **opening
  exactly one pull request on this repository**. D-136 makes the emitted workflow trigger on
  `pull_request` only, and work here goes straight to `main`, so without a pull request `accord.yml`
  never runs and criterion 2 has no evidence. A pull request is also the only way to exercise D-137
  for real: a diff that touches `accord/tickets/*.md` is what the workflow derives its ticket list
  from. Adding a `push` trigger to the template was declined — changing a rule that ships to every
  user to suit one repository's habits inverts who the template is for. After this one pull request,
  work on this repository goes back to `main` directly.

- **D-156:** The dogfood ticket is **the README**, and its scope is larger than "add an install
  section". Four defects were found by reading it:
  1. `packages/cli/package.json` declares `files: ["dist", "README.md"]` but `packages/cli/README.md`
     does not exist — the published package would have an empty npm page.
  2. The opening line and the "business analyst, designer, and developer" paragraph still describe a
     team contract, superseded by the 2026-09-11 re-aim to four stages one person passes through.
  3. *"**Status: design phase.** Nothing is published yet."* is false the moment `0.1.0` lands.
  4. *"a stateless remote MCP server lets non-technical members work the same tickets from their chat
     app over the GitHub API"* describes a component removed under D-117.
  Plus the missing install section itself, which is what makes criterion 1's `npx` invocation
  discoverable. `ui: false`, so the one profile difference at the Ready gate (`gate/ready.ts:31`)
  does not fire, and this repository's existing `profile: maintain` is kept.

- **D-157:** The order is **publish `0.1.0` → run the ticket → publish `0.1.1`**. npm renders the
  README as of publish time, so `0.1.0`'s page is empty or stale and `0.1.1`'s is correct. This is
  accepted rather than avoided, because the two alternatives each cost more: fixing the README before
  publishing turns it into ordinary work and leaves the phase without a dogfood ticket, and running
  the ticket against a local build is ruled out by PROJECT.md — *"dogfooding from a local build does
  not close the milestone."* Two benefits fall out: the tag→OIDC path is proved twice rather than
  once, and bumping `0.1.0` to `0.1.1` walks the D-94 pin through a real version change
  (`accord/config.yml` and the generated `accord.yml` both have to move, and the pin refuses until
  they do).

- **D-158:** The fresh-context review runs **as a subagent**, which is the first branch of D-109
  ("a subagent where the runtime provides one, otherwise a new session"). A cleared session would
  isolate more strongly, but the dogfood exists to prove the shipped workflow behaves as written on
  the path most users take, not to prove a better variant of it.

- **D-159:** *"Time from `new ticket` to Ready"* means **wall-clock from the `accord new ticket`
  command to the `accord gate ready` run that prints PASS**, breaks included. One number, not
  arguable, and it is the number a person actually feels. Active working time was declined because
  it depends on who is holding the stopwatch.

- **D-160:** Both measurements go in **`.planning/phases/09-publish-and-dogfood/09-VERIFICATION.md`**,
  the artifact every prior phase already produces and the place a verifier reads. No new note file.
  The `accord/` folder receives nothing: its no-session-file rule (ROADMAP Phase 6 criterion 6) is
  about that folder, and `.planning/` is outside it.

- **D-161:** The token-rule check **records raw numbers and draws no conclusion**: how many findings,
  how many are genuinely hardcoded values, how many are false positives, with a concrete example of
  each. ROADMAP criterion 4 says the check happens *before any promotion to error*, so the promotion
  decision belongs to v0.2 and a threshold set from a single stylesheet would be a decision made on
  one data point.

### Claude's Discretion

- The publish workflow gets a **post-publish smoke job** on a clean runner that runs
  `npx --yes @accord-dev/accord@<version> --version`, which is what ROADMAP criterion 1's "works on
  a clean machine" asks for. It runs after `npm publish` in the same workflow.
- `packages/cli/README.md` is **generated by a script from the root `README.md` and covered by a
  drift test**, the same shape `packages/core/src/generated/templates.ts` and `skills.ts` already
  use. Two hand-maintained READMEs would drift; npm cannot reach a file outside the package folder.
- The publish workflow's **filename is fixed at creation and never renamed**, because the trusted
  publisher configuration on npmjs.com matches on it.
- `accord init` on this repository **leaves the existing `accord/config.yml` untouched** per D-130,
  including its `runtimes: [claude]` — so only `.claude/skills/` is written here. Nothing in
  Phase 9's criteria asks for both runtime paths.
- The `npm publish` step **skips a version already on the registry** rather than failing, so
  re-running after a partial failure is safe.
- Before the bootstrap, confirm the npm organisation `accord-dev` is claimable. `npm view` returns
  404 for both `@accord-dev/accord` and `accord-dev`, so nothing is taken, but scope ownership is a
  separate registration. The scope name itself is not reopened: it is already written into
  `packages/cli/package.json`, `pin.ts:16`, the generated `config.yml`, and the goldens, and the
  project constraint fixes the package as scoped.

### Deferred Ideas (OUT OF SCOPE)

- **Promoting the token rule from warning to error** — v0.2 at the earliest. D-161 gathers the
  evidence; the decision needs more than one stylesheet.
- **Release notes / changesets** — STACK.md already defers changesets ("`npm version` by hand is
  enough with one author"). Release notes were declined as a publish trigger under D-149.
- **A public core API and the `./schemas/*` export** — dropped by D-150. If editor tooling ever
  needs the schemas, publishing them is a new decision, not a reversal of this one.
- `.planning/todos/pending/mcp-host-spike.md` — obsolete, close rather than carry.
- `.planning/todos/pending/rejected-alternatives-have-no-home.md` — real but too large and outside
  OPS-03/OPS-04.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-03 | Scoped package published via npm trusted publishing; `engines` at Node 22.12 or later | §"npm Trusted Publishing" (permissions block, runner npm floor, bootstrap ordering, provenance, `--access`), §"Publish Workflow Shape", §"Landmine 1/2" (the published manifest is broken today and must be fixed before any publish). `engines` is already `>=22.12.0` in `packages/cli/package.json` — no change needed. |
| OPS-04 | One real ticket passes Ready and Done on a coding agent, with a fresh-context review's `verification.md` and the developer's `verified` ticks; time from `new ticket` to Ready recorded | §"Dogfood Mechanics" (the PR must carry a *passing* Done ticket or criterion 2's workflow goes red), §"Landmine 5" (`accord/` here holds only `config.yml` — `init` will write ~27 new files into the same PR), §"Validation Architecture" (D-159's wall-clock number has no automated proof and must be evidenced by hand). |
</phase_requirements>

---

## Summary

Three findings change how this phase should be planned, and two of them are blockers that the
locked decisions did not anticipate.

**First, the package cannot be published as it stands.** `packages/cli/package.json` declares
`"dependencies": { "@accord-dev/accord-core": "0.1.0", "commander": "15.0.0" }`. Under D-150 core
becomes `private: true` and is never published, so a consumer running
`npx --yes @accord-dev/accord@0.1.0` would have npm resolve `@accord-dev/accord-core@0.1.0` from the
registry and get a 404. Bundling core into `dist/cli.js` removes the *import*; it does not remove the
*declaration*. The dependency entry has to move to `devDependencies` (or be deleted) in the same
change, or `0.1.0` lands permanently broken on a one-way door.

**Second, the D-150 bundling was probed end to end and it works — better than expected.** I built the
CLI with `deps: { alwaysBundle: ['@accord-dev/accord-core'] }` into a throwaway `dist-probe/` and ran
it. tsdown resolves core through its `exports` map to `../core/dist/index.js` and transitively inlines
ajv, yaml and `@cucumber/gherkin` as well, because those are core's dependencies and not the CLI's, so
the CLI's default externalisation never sees them. The result is one 847 kB `dist/cli.js` whose only
non-builtin import is `commander`, with the shebang intact, `--version` and `--help` answering, and
`lint` returning `0 errors, 0 warnings` against `examples/build`. The `deniedNames` scan over that
bundle returns zero hits. Two consequences for the plan: core must **keep its `exports` map** even
while `private: true` (that map is how tsdown finds it), and `npm run build -w packages/core` must
still precede the CLI build (the root `build` script already does this).

**Third, D-154/D-161's token measurement cannot be produced by the command it names.** The LINT-04
rule scans `accord/assets/<id>/prototype.html` files against the token *vocabulary* declared in
`design.tokens`; it never scans the stylesheet itself. Setting `design.tokens` to SimplT's
`globals.css` and running `accord lint` in a repository with no prototype yields **zero** token
findings. The stylesheet is good pilot material — 92 `--token` declarations, Tailwind v4 `@theme`,
shadcn — but producing D-161's "how many findings, how many genuine, how many false positives"
requires authoring a `prototype.html` in SimplT to check *against* that vocabulary. This is an owner
ruling, not something the plan should quietly invent.

**Primary recommendation:** plan Wave 0 as three manifest/config corrections proved by a probe build
(dependency move, `deps.alwaysBundle`, core `private` with `exports` kept), then the publish workflow,
then the bootstrap, then the dogfood — and raise the token-measurement gap to the owner before
planning the SimplT task at all.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity proof for publishing | GitHub Actions OIDC | npm registry | The runner mints a short-lived OIDC token; npm verifies it against the trusted-publisher record. No secret is stored anywhere. |
| Version authority | git tag (`v*`) | `packages/cli/package.json` | D-149 makes the tag the one point in history that names a version; the manifest is the thing checked against it. |
| Dependency inlining | build tool (tsdown/rolldown) | — | Not a runtime concern. The published artifact is a single file; nothing resolves at install time except `commander`. |
| Package contents | `files:` in `packages/cli/package.json` | `.npmignore` (absent, correctly) | `["dist", "README.md"]` — `README.md` does not yet exist, which is defect 1 of D-156. |
| Version-pin enforcement | `packages/cli/src/pin.ts` (CLI, exact `===`) | `accord/config.yml`, generated `accord.yml` | The pin is a runtime refusal in the CLI. The workflow's tag-vs-manifest check is a *separate*, build-time guard with the same equality rule. |
| Post-publish proof | a second GitHub Actions job on a clean runner | npm registry CDN | "Works on a clean machine" cannot be proved on the runner that built it. |
| Dogfood evidence | `.planning/phases/09-publish-and-dogfood/09-VERIFICATION.md` | — | D-160. The `accord/` folder receives nothing. |

---

## Standard Stack

No new runtime dependency is introduced by this phase. Everything below is already installed and
pinned; the versions were read off disk or off the registry this session.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsdown | 0.23.0 | Bundles `dist/cli.js`; gains `deps.alwaysBundle` | Already the project's bundler. `[VERIFIED: node_modules/tsdown/package.json:3 — `"version": "0.23.0"`]` |
| commander | 15.0.0 | The only runtime import left in the published bundle | Already a CLI dependency; stays external. `[VERIFIED: probe build — `dist-probe/cli.js` imports `commander` and nothing else non-builtin]` |
| `actions/checkout` | v7 | Checkout in both publish jobs | Matches the existing `ci.yml`. `[VERIFIED: .github/workflows/ci.yml:19]` |
| `actions/setup-node` | v7 | Node 24 + `registry-url` for the OIDC handshake | Matches the existing `ci.yml`. `[VERIFIED: .github/workflows/ci.yml:20]` |
| Node.js on the publish runner | 24 | Meets the npm >= 11.5.1 / Node >= 22.14 floor without an upgrade step | Node **24.21.0 ships npm 11.19.0**. `[VERIFIED: nodejs.org/dist/index.json fetched 2026-09-20 — `v24.21.0 npm 11.19.0 lts Krypton 2026-09-07`]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `npm view` | bundled | Registry probe for the skip-if-exists guard and the smoke retry | In the publish workflow only — never from the CLI (project constraint) |
| `node --input-type=module` / `node -e` | bundled | Cross-platform version comparison in the tag check | Preferred over `jq`/`sed` so the step reads identically on any runner |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `deps.alwaysBundle` | `noExternal` (the name D-150 uses) | Both work in 0.23.0. `noExternal` is **marked deprecated in the installed types**; `deps.alwaysBundle` is the current spelling and the two cannot be combined. See Landmine 3. |
| `deps.alwaysBundle` | Just moving core to `devDependencies` | tsdown externalises `dependencies`/`peerDependencies`/`optionalDependencies` only, so a devDependency is bundled by default. This alone would achieve D-150's effect. Recommend doing **both**: the move is *mandatory* for correctness (Landmine 1), and the explicit `alwaysBundle` documents intent so a later `dependencies` edit cannot silently un-bundle core. |
| Bundling ajv/yaml/gherkin | Hoisting them into `packages/cli` `dependencies` | Bundling was probed and works, including ajv's CJS interop via a `node:module` `createRequire` shim. Hoisting would mean four registry resolutions at every `npx` and a second place to keep versions. Keep them bundled. |
| `npm install -g npm@latest` before publish | Nothing | Unnecessary on Node 24 (npm 11.19.0 >= 11.5.1). It would still be required on Node 22, which ships npm 10.9.8. `[VERIFIED: nodejs.org/dist/index.json — `v22.23.2 npm 10.9.8`]` |
| A `GITHUB_ENV`/`jq` version compare | `node -e` string equality | D-94 forbids semver tolerance. A `node -e` comparison of two strings with `!==` is the literal rule; `jq` would need installing on Windows if the job ever moves. |

**Installation:** none. No package is added to any manifest by this phase.

---

## Package Legitimacy Audit

This phase installs **no external packages**. The audit below records the registry state of the two
scoped names the phase publishes to, probed this session.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@accord-dev/accord` | npm | — (does not exist) | — | this repo | N/A — name is free | To be published by this phase |
| `@accord-dev/accord-core` | npm | — (does not exist) | — | this repo | N/A — name is free | **Never published** (D-150 makes it `private: true`) |

`[VERIFIED: npm view, 2026-09-20 — both returned `npm error code E404` / `404 Not Found - GET https://registry.npmjs.org/@accord-dev%2faccord` and the same for `@accord-dev%2faccord-core`]`

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Scope ownership is a separate question and is NOT verified.** A registry 404 on a package name
proves the *name* is free; it does not prove the *scope* `@accord-dev` is claimable, because a scope
can be registered with no packages in it. `https://www.npmjs.com/org/accord-dev` returned HTTP 403,
which is a bot-block, not a signal about existence — do not read it either way. `[ASSUMED]` The only
reliable check is logging into npmjs.com and attempting to create the organisation (or publishing
under a personal scope). The planner should make this a `checkpoint:human-verify` task **before** the
D-151 bootstrap, because every downstream string (`pin.ts:16`, the generated `config.yml`, the
goldens) already names `@accord-dev`.

---

## npm Trusted Publishing (OIDC)

### The permissions block and job shape

```yaml
permissions:
  id-token: write   # required — this is what mints the OIDC token
  contents: read
```

`[CITED: docs.npmjs.com/trusted-publishers]` — the page states the `id-token: write` permission
"allows GitHub Actions to generate OIDC tokens".

Note that `.github/workflows/ci.yml` declares `permissions: { contents: read }` at the **workflow**
level. Declare the publish permissions at the **job** level so the smoke job does not inherit
`id-token: write` it has no use for.

### `actions/setup-node` inputs

The npm docs example uses:

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: '24'
    registry-url: 'https://registry.npmjs.org'
    package-manager-cache: false
```

`[CITED: docs.npmjs.com/trusted-publishers]`

Two adjustments for this repo:

1. **Use `@v7`**, matching `ci.yml`. `[VERIFIED: .github/workflows/ci.yml:20]`
2. `registry-url` is **load-bearing** — it writes a project-level `.npmrc` pointing at the registry,
   which is what the OIDC exchange targets. `[CITED: actions/setup-node action.yml — "Optional
   registry to set up for auth. Will set the registry in a project level .npmrc and .yarnrc file"]`
3. `registry-url`, `cache`, `scope` and `package-manager-cache` all exist as inputs.
   `[VERIFIED: raw.githubusercontent.com/actions/setup-node/main/action.yml, fetched 2026-09-20]`
   `always-auth` does **not** — do not copy it from an older recipe. The repo's existing `cache: npm`
   is fine for the pre-check job; `package-manager-cache: false` is the docs' preference and is
   harmless either way.

### npm version floor on the runner

Trusted publishing requires **npm >= 11.5.1 and Node >= 22.14.0**.
`[CITED: docs.npmjs.com/trusted-publishers — "Trusted publishing requires npm CLI version 11.5.1 or later and Node version 22.14.0 or higher."]`

Node 24 satisfies both with no upgrade step:

```
v24.21.0  npm 11.19.0  lts Krypton  2026-09-07
v22.23.2  npm 10.9.8   lts Jod      2026-07-28
v26.9.0   npm 11.19.1  lts false    2026-09-16
```

`[VERIFIED: https://nodejs.org/dist/index.json, read 2026-09-20]`

**Therefore: drop the `npm install -g npm@latest` step that STACK.md/`.claude/CLAUDE.md` decision 6
prescribes.** That instruction was written when it was true; on Node 24 today it is one more network
call that can fail. If the publish job ever moves to Node 22, it becomes mandatory again — Node 22's
bundled npm 10.9.8 is below the floor. Confidence HIGH; the `index.json` numbers move, so re-check at
execution time if more than a month has passed.

### D-151: the bootstrap ordering

D-151's premise — the package must exist before a trusted publisher can be configured — is the
community consensus and is consistent with npm's documentation putting the configuration on the
package's **Settings > Trusted Publisher** page. The docs page does **not** state the requirement
explicitly, and npm has no documented "pending publisher" equivalent to PyPI's. `[ASSUMED]`

**This does not put the plan at risk in either direction.** If the premise holds, the `0.0.0`
bootstrap is required. If npm has since added pending publishers, the `0.0.0` publish is merely
unnecessary — and it is still the *safer* order, because it proves the scope is claimable and the
manifest is publishable before a real version is burned on a one-way door. Plan D-151 as written.

The fields npm asks for when adding a GitHub Actions trusted publisher:

| Field | Required | Note |
|-------|----------|------|
| Organization or user | yes | The GitHub owner |
| Repository | yes | Repository name |
| Workflow filename | yes | **Filename only**, must include the `.yml`/`.yaml` extension |
| Environment name | **optional** | A GitHub `environment:` key is *not* required |
| Allowed actions | optional | Controls `npm stage publish` vs `npm publish` |

`[CITED: docs.npmjs.com/trusted-publishers]`

Two consequences for the plan:

- **The workflow filename is fixed at creation** (the Claude's Discretion item is confirmed as
  necessary, not stylistic). Renaming the file breaks the trust relationship silently — the next tag
  push fails at publish with an auth error, not a config error.
- **No `environment:` key is needed.** Do not add one; an environment whose branch protections do not
  allow the tag ref would block the job for a reason that reads nothing like its cause.

Match is exact: owner, repo and filename must equal what runs, with no extra whitespace.

### Provenance

Automatic. `[CITED: docs.npmjs.com/trusted-publishers — "When you publish using trusted publishing
from GitHub Actions or GitLab CI/CD, npm automatically generates and publishes provenance
attestations for your package. This happens by default—you don't need to add the `--provenance`
flag."]`

Do **not** pass `--provenance`. It is redundant and, on a non-OIDC path, changes the failure mode.

### `--access public`

`.claude/CLAUDE.md` decision 6 states "Scoped packages default to restricted, so `--access public` is
mandatory on the first publish." **The current npm 11 documentation contradicts this:** the `access`
config's default is described as "'public' for new packages, existing packages it will not change the
current level". `[CITED: docs.npmjs.com/cli/v11/using-npm/config#access]`

The default changed at some point after that project note was written. Confidence MEDIUM — I did not
find the changelog entry that moved it.

**Recommendation: pass `--access public` explicitly anyway.** It is a no-op under the current default,
it is correct under the historical default, and it is self-documenting at the one call site that
matters. The cost of being wrong in the other direction is a package published `restricted` that
`npx` cannot reach on a clean machine — the exact thing criterion 1 tests.

### Skip a version already on the registry

`npm publish` fails permanently when the name+version pair exists: *"The publish will fail if the
package name and version combination already exists in the specified registry"*, and *"Once a package
is published with a given name and version, that specific name and version combination can never be
used again, even if it is removed with `npm unpublish`."* `[CITED: docs.npmjs.com/cli/v11/commands/npm-publish]`

The error surfaces as **E403** with the text "You cannot publish over the previously published
versions" (historically `EPUBLISHCONFLICT`). A distinct **E409** "Failed to save packument" is a
*transient* write collision where the version does not exist and a retry would land it — do not treat
the two the same. `[CITED: blog.npmjs.org / lerna commit 6123e86 — both codes are caught separately by
release tooling]` Confidence MEDIUM: this comes from issue trackers and a lerna commit, not from npm's
own error reference.

**Implement the skip as a pre-flight probe, not as error-string matching.** A guard reads more clearly
than a `|| true` and cannot mistake a transient 409 for a conflict:

```yaml
- name: publish unless this version is already on the registry
  run: |
    set -euo pipefail
    # `npm view` exits non-zero with E404 when the package or version is absent, which is the
    # normal case on every real release. `|| true` keeps that from ending the step; the emptiness
    # of stdout is the signal, not the exit code.
    on_registry=$(npm view "${PKG}@${VERSION}" version 2>/dev/null || true)
    if [ "$on_registry" = "$VERSION" ]; then
      echo "${PKG}@${VERSION} is already on the registry - skipping publish"
      exit 0
    fi
    npm publish --workspace packages/cli --access public
```

Note the `|| true`: on the **first** publish the package does not exist at all, so `npm view` exits
non-zero with E404 rather than printing an empty string. A guard without `|| true` and with `set -e`
would fail the very release it is meant to protect.

### The project's "never spawn npm" constraint does not apply here

`.claude/CLAUDE.md` §"What NOT to Use" forbids `child_process.spawn('npx' | 'npm')` — **from the
CLI**. `packages/cli/test/spawn-surface.test.ts` enforces it by scanning `packages/cli/src/**` for
spawn call sites with a literal-first-argument allowlist of `git` and `gh`.
`[VERIFIED: packages/cli/test/spawn-surface.test.ts:16-17 — `const srcDir = fileURLToPath(new URL('../src/', import.meta.url));` and `const ALLOWED = ['git', 'gh'];`]`

A `run:` step in a workflow YAML is not `packages/cli/src/**` and is not scanned. Running `npm ci`,
`npm run check`, `npm view` and `npm publish` from the publish workflow is unambiguously in bounds —
`ci.yml` already runs `npm ci` and `npm test` the same way. `pin.ts` likewise *prints* the string
`npx --yes ...` without spawning it, and passes the scan today.

---

## Publish Workflow Shape (D-149)

### Trigger and version extraction

```yaml
name: publish
on:
  push:
    tags: ['v*']
```

`github.ref_name` is the tag name (`v0.1.0`) on a tag push — this is the documented short form and is
what avoids stripping `refs/tags/` by hand. `[ASSUMED]` — widely used, but I did not open the GitHub
contexts reference this session. If the planner wants belt and braces, `${GITHUB_REF#refs/tags/}`
inside the step is equivalent and has no such doubt.

### The tag-vs-manifest check (exact equality, D-94's rule)

Put it in its **own step before anything else**, so a mismatch costs a few seconds rather than a build.

```yaml
- name: the tag and the manifest name the same version, exactly
  shell: bash
  env:
    TAG: ${{ github.ref_name }}
  run: |
    set -euo pipefail
    # D-94: `===` on two strings. No semver library, no range, no tolerance, no `v` coercion beyond
    # the one documented prefix strip. Node, not jq or sed: the comparison reads identically on any
    # runner, and `node` is guaranteed present by the step above.
    manifest=$(node -p "require('./packages/cli/package.json').version")
    want="${TAG#v}"
    if [ "$want" != "$manifest" ]; then
      echo "tag ${TAG} names ${want}, packages/cli/package.json names ${manifest}" >&2
      exit 1
    fi
    echo "VERSION=${manifest}" >> "$GITHUB_ENV"
```

Two notes. `node -p "require(...)"` works even though the repo is `"type": "module"` because `-p`
evaluates in CJS scope. And the `${TAG#v}` strip is the *only* transformation — everything after it is
byte equality, which is what makes this the same rule as `pin.ts`.

### Job layout (D-152)

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          registry-url: 'https://registry.npmjs.org'
          cache: npm
      - <tag-vs-manifest check, above>
      - run: npm ci
      - run: npm run check        # build + lint + typecheck + test, once (D-152)
      - <publish-unless-on-registry, above>

  smoke:
    needs: publish
    runs-on: ubuntu-latest        # a clean runner: nothing from `publish` is carried over
    steps:
      - uses: actions/setup-node@v7
        with: { node-version: 24 }
      - <npx smoke with bounded retry, below>
```

`npm run check` is `npm run build && npm run lint && npm run typecheck && npm test`.
`[VERIFIED: package.json:11 — `"check": "npm run build && npm run lint && npm run typecheck && npm test"`]`
Because `build` is `npm run build -w packages/core && npm run build -w packages/cli`
`[VERIFIED: package.json:9]`, the core-then-cli ordering that D-150's bundling depends on is already
guaranteed by this one step.

Note that the smoke job deliberately does **not** check out the repository. `npx --yes <pkg>@<ver>` in
a bare runner with no `package.json` and no `node_modules` is the closest thing Actions offers to
"a clean machine", which is criterion 1's wording.

### Registry propagation and the smoke retry

npm acknowledges a publish before every registry edge serves the new version. A single lookup
immediately after `npm publish` is a known flake: real release pipelines report a publish succeeding
and the very next `npx` failing, then passing on a manual rerun minutes later.
`[CITED: multiple release-pipeline issue reports, 2026 — e.g. stella/.github#85, lutzseverino/repo-standards#80, kryptobaseddev/cleo#1377]`
Confidence MEDIUM: this is a well-attested operational fact from many independent projects, but not a
number npm publishes. **Do not encode a fixed sleep and do not encode a 60-second budget** — the cleo
report is specifically about a ~3 s budget being too short, and the wicked-crew report about 60 s
being too short.

The accepted pattern is a bounded, logged retry with a total budget of a few minutes:

```yaml
- name: npx from a clean runner
  shell: bash
  env:
    PKG: '@accord-dev/accord'
    VERSION: ${{ needs.publish.outputs.version }}
  run: |
    set -uo pipefail
    # The registry is eventually consistent: `npm publish` returns before every edge serves the new
    # version. Retry with a bounded budget and say which attempt succeeded, so a slow release reads
    # as a slow release rather than as a broken package.
    for attempt in $(seq 1 12); do
      if out=$(npx --yes "${PKG}@${VERSION}" --version 2>&1); then
        echo "attempt ${attempt}: ${out}"
        [ "$(echo "$out" | tail -1 | tr -d '[:space:]')" = "${VERSION}" ] && exit 0
        echo "resolved, but printed '${out}' not '${VERSION}'" >&2
        exit 1
      fi
      echo "attempt ${attempt}: not yet visible; sleeping 15s"
      sleep 15
    done
    echo "${PKG}@${VERSION} never became installable within 3 minutes" >&2
    exit 1
```

Twelve attempts at 15 s is a three-minute budget. Note the inner check distinguishes *not yet visible*
(retry) from *visible but wrong output* (fail immediately) — collapsing those two would let a genuinely
broken bundle burn the full budget and then report a propagation failure.

`needs.publish.outputs.version` requires the publish job to declare
`outputs: { version: ${{ steps.<id>.outputs.version }} }` and the tag-check step to write to
`$GITHUB_OUTPUT` as well as `$GITHUB_ENV` — `GITHUB_ENV` does not cross a job boundary.

---

## tsdown Bundling of Core (D-150)

### `noExternal` is deprecated; the current spelling is `deps.alwaysBundle`

From the installed tsdown 0.23.0 type declarations, verbatim:

```
  /**
   * Cannot be combined with `deps.neverBundle`; setting both throws an error.
   * @deprecated Use {@linkcode DepsConfig.neverBundle | deps.neverBundle} instead.
   */
  external?: ExternalOption;
  /**
   * Cannot be combined with `deps.alwaysBundle`; setting both throws an error.
   * @deprecated Use {@linkcode DepsConfig.alwaysBundle | deps.alwaysBundle} instead.
   */
  noExternal?: Arrayable<string | RegExp> | NoExternalFn;
```

`[VERIFIED: node_modules/tsdown/dist/types-CYHmmaKd.d.mts:1387-1395]`

And the replacement, verbatim:

```
  /**
   * Force dependencies to be bundled, even if they are in `dependencies`, `peerDependencies`, or `optionalDependencies`.
   */
  alwaysBundle?: Arrayable<string | RegExp> | NoExternalFn;
```

`[VERIFIED: node_modules/tsdown/dist/types-CYHmmaKd.d.mts:99-103]`

Supporting types, verbatim:

```
type Arrayable<T> = T | T[];
type NoExternalFn = (id: string, importer: string | undefined) => boolean | null | undefined | void;
```

`[VERIFIED: node_modules/tsdown/dist/types-CYHmmaKd.d.mts:10, 83]`

So the accepted shapes are a string, a RegExp, an array of either, or a predicate function.
**`noExternal` still works** — deprecated is not removed — so D-150's literal wording is satisfiable.
Use `deps.alwaysBundle` anyway: same behaviour, no deprecation warning, and the two throw if both are
set.

Also relevant, verbatim, because it fires on this build:

```
  /**
   * Whitelist of dependencies allowed to be bundled from `node_modules`.
   * Throws an error if any unlisted dependency is bundled.
   *
   * - `undefined` (default): Log an info-level hint if any `node_modules`
   *   dependencies are bundled.
   * - `false`: Disable the hint and all checks about bundled dependencies.
   */
  onlyBundle?: Arrayable<string | RegExp> | false;
```

`[VERIFIED: node_modules/tsdown/dist/types-CYHmmaKd.d.mts:104-115]`

### What the probe build actually did

I created a throwaway `packages/cli/tsdown.probe.config.ts` with `outDir: 'dist-probe'` and
`deps: { alwaysBundle: ['@accord-dev/accord-core'] }`, ran it, inspected and executed the output, then
deleted both the config and `dist-probe/`. `packages/cli/dist/` was never touched.

Build output, verbatim:

```
ℹ tsdown v0.23.0 powered by rolldown v1.2.7
ℹ entry: src/index.ts
ℹ target: node22.12.0
ℹ Hint: consider adding deps.onlyBundle option to avoid unintended bundling of dependencies, or set deps.onlyBundle: false to disable this hint.
Detected dependencies in bundle:
- ajv
- fast-deep-equal
- json-schema-traverse
- fast-uri
- yaml
- @cucumber/gherkin
- @cucumber/messages
ℹ Granting execute permission to dist-probe\cli.js
ℹ dist-probe\cli.js  847.03 kB │ gzip: 181.96 kB
✔ Build complete in 1843ms
```

`[VERIFIED: probe build, 2026-09-20]`

Findings, each probed:

| Question | Answer | Evidence |
|----------|--------|----------|
| Is the shebang preserved? | **Yes** | `head -1 dist-probe/cli.js` → `#!/usr/bin/env node`. tsdown also logged "Granting execute permission". |
| Is `@accord-dev/accord-core` gone from the imports? | **Yes** | Remaining imports: `node:module`, `commander`, `node:fs`, `node:path`, `node:child_process`, `node:util`. Nothing else. |
| What else got inlined? | ajv, fast-deep-equal, json-schema-traverse, fast-uri, yaml, @cucumber/gherkin, @cucumber/messages | The build log above. These are **core's** dependencies, not the CLI's, so the CLI's default externalisation never listed them. |
| Does ajv's CJS interop survive? | **Yes** | 8 `require(` call sites behind a `node:module` `createRequire` shim; `accord lint` over `examples/build` printed `0 errors, 0 warnings` and exited 0. |
| Does the binary run? | **Yes** | `node dist-probe/cli.js --version` → `0.1.0`; `--help` listed `init`, `lint`, `gate`, `new`, `skills`. |
| Which core entry is resolved — `src` or `dist`? | **`dist`** | `grep "^//#region \.\./core/" dist-probe/cli.js` (excluding `node_modules`) yields exactly one region: `//#region ../core/dist/index.js`, with 85 region markers under `../core/`. |
| Does `deniedNames` still pass over 847 kB of third-party source? | **Yes, zero hits** | Ran the `DENIED` list (`GSD`, `BMad`, `Jira`, `Linear`, `Figma`, `Anthropic`, `OpenAI`, word-boundary, case-insensitive) over the probe bundle: `total hits: 0`. This was the risk worth checking — `Linear` is ordinary English and would have fired on a comment like "linear search". Rolldown strips the comments that would have carried it. |

`[VERIFIED: probe build + execution, 2026-09-20]` for every row.

### Consequences the plan must honour

1. **Core must keep its `exports` map.** Resolution goes `@accord-dev/accord-core` → workspace symlink
   → `exports["."]` → `./dist/index.js`. `[VERIFIED: packages/core/package.json:6-10 —
   `"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }, "./schemas/*": "./schemas/*", "./package.json": "./package.json" }`]`
   D-150 says the `./schemas/*` export is "lost" — that means *no longer promised to consumers*, not
   *deleted from the manifest*. Deleting the `"."` export would break the build.
2. **`private: true` on core is safe for `npm ci`.** npm workspaces link private workspace packages
   normally; `private` blocks publishing, not installing. `[ASSUMED]` — I did not run `npm ci` with
   the flag set, because that mutates the tree. Low risk, but it is a one-line probe the planner can
   add to Wave 0: set the flag, `npm ci`, confirm `node_modules/@accord-dev/accord-core` is still a
   symlink to `packages/core/`. `[VERIFIED: node_modules/@accord-dev/ — `accord-core -> /c/Work/accord/packages/core/`, a symlink today]`
3. **`dts` does not interact.** `packages/cli/tsdown.config.ts` already sets `dts: false`.
   `[VERIFIED: packages/cli/tsdown.config.ts:7]` Core keeps `dts: true` for its own build
   `[VERIFIED: packages/core/tsdown.config.ts:6]`, which the CLI bundle does not consume. The
   `deps.dts` sub-config exists but is not needed here.
4. **Build ordering is load-bearing.** Because resolution lands on `../core/dist/index.js`, a CLI
   build with a stale or absent `packages/core/dist/` bundles stale or nothing. The root `build`
   script already sequences core before cli `[VERIFIED: package.json:9]` — do not let any plan step
   call `npm run build -w packages/cli` on its own.
5. **Consider `deps.onlyBundle`.** tsdown emits an info-level hint on every build now. Setting
   `onlyBundle: ['@accord-dev/accord-core', 'ajv', 'fast-deep-equal', 'json-schema-traverse', 'fast-uri', 'yaml', '@cucumber/gherkin', '@cucumber/messages']` turns the hint into an assertion —
   a new transitive dependency silently entering the published bundle becomes a build failure. That is
   a genuine supply-chain guard on the one artifact npm uploads. Optional; the hint alone is
   tolerable, and eight names is a list to maintain.

### Recommended config

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { cli: 'src/index.ts' }, // first line of src/index.ts is `#!/usr/bin/env node`
  format: ['esm'],
  platform: 'node',
  dts: false,
  fixedExtension: false, // emit dist/cli.js, not cli.mjs
  // D-150: core is never published, so it must not be an install-time dependency of the one package
  // that is. `alwaysBundle` (not the deprecated `noExternal`) inlines it; its own deps — ajv, yaml,
  // gherkin — follow, because they are core's dependencies and not this package's, so the default
  // externalisation never sees them. Result: `commander` is the only runtime resolution at `npx`.
  deps: { alwaysBundle: ['@accord-dev/accord-core'] },
});
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authenticating the publish | An `NPM_TOKEN` repository secret | Trusted publishing (OIDC) | Declined by D-151 already. Also: a secret is a thing to rotate and a thing to leak; OIDC tokens are minted per job and expire. |
| Package provenance | `--provenance` plus attestation plumbing | Nothing — it is automatic under OIDC | `[CITED: docs.npmjs.com/trusted-publishers]` |
| Comparing tag to manifest | `semver` / `npx semver` / a regex | `node -p` + `!=` on two strings | D-94's rule is string equality. Any library here introduces tolerance the pin does not have. |
| Reading the manifest version in bash | `grep`/`sed`/`cut` over JSON | `node -p "require('./packages/cli/package.json').version"` | A JSON parser is already on the runner; a regex over JSON is the classic silently-wrong step. |
| Waiting for registry propagation | `sleep 60` | Bounded retry loop with a logged attempt count | A fixed sleep is either too short (flake) or always too long (slow every release). Both failure modes are documented in the issue reports cited above. |
| Two hand-written READMEs | Copy-paste root README into `packages/cli/` | A `gen-*.mjs` script + drift test, per the Claude's Discretion item | The house pattern already exists twice. See §"Generated README" below. |
| Detecting "already published" | Matching npm's error string | `npm view <pkg>@<ver> version` pre-flight | E403 (permanent conflict) and E409 (transient) both surface as publish failures; only the pre-flight distinguishes them without parsing prose. |

**Key insight:** every item in this table is a place where a small custom step would encode a
tolerance the project has deliberately refused elsewhere. The pin is exact; the tag check should be
exact; the publish skip should be a fact about the registry, not an inference from an error message.

---

## Generated README (`packages/cli/README.md`)

The house pattern, verbatim from the existing generator:

```js
// Emits src/generated/skills.ts from skills/**/*.md (D-105). Lives outside src/, so Node built-ins are allowed here.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
```

`[VERIFIED: packages/core/scripts/gen-skills.mjs:1-8]`

And the drift assertion, verbatim:

```js
  it('generated module matches templates/ (drift)', () => {
    const onDisk = readdirSync(templatesDir).filter((f) => /\.(md|html)$/.test(f)).sort();
    expect(Object.keys(templates), 'template file set drifted: run npm run gen').toEqual(onDisk);
    for (const name of onDisk) {
      const text = normalise(readFileSync(templatesDir + name, 'utf8'));
      expect(templates[name as TemplateName], `${name} drifted: run npm run gen`).toBe(text);
    }
  });
```

`[VERIFIED: packages/core/test/templates.test.ts, `describe('generated module')`]`

Follow it exactly: a `gen-readme.mjs` (wherever the planner puts it — `packages/cli/scripts/` mirrors
the core layout), wired into the root `gen` script
`[VERIFIED: package.json:8 — `"gen": "node packages/core/scripts/gen-templates.mjs && node packages/core/scripts/gen-skills.mjs"`]`,
plus a test that reads both files and compares, with the message `run npm run gen`.

Two details the existing generators already solve and the new one must copy:
`.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')` — LF and no BOM, which `templates.test.ts` also
asserts separately. And `packages/cli/README.md` must not be gitignored: `.gitignore` lists `dist/`
but not `README.md` `[VERIFIED: .gitignore]`, so a generated-and-committed file is fine.

One open sub-question for the planner: the root `README.md` contains repository-relative links
(`docs/design.md`). Those resolve on GitHub and 404 on npmjs.com. The generator should either rewrite
them to absolute GitHub URLs or the ticket should decide they are acceptable. This is a D-156 scope
detail, not a mechanic.

---

## Repo-Specific Landmines

Ordered by how expensive each is to discover late.

### Landmine 1 — the published manifest 404s on install (BLOCKING, one-way door)

```json
"dependencies": { "@accord-dev/accord-core": "0.1.0", "commander": "15.0.0" }
```

`[VERIFIED: packages/cli/package.json:10]`

`@accord-dev/accord-core` does not exist on npm and, under D-150, never will
`[VERIFIED: npm view, E404, 2026-09-20]`. Bundling removes the runtime import; the *declaration* is
what npm reads at install time. Publish this manifest and every `npx --yes @accord-dev/accord@0.1.0`
fails at resolution — including criterion 1's own smoke test and the `npx` invocations inside every
generated `accord.yml`.

**Fix:** move the entry to `devDependencies` in `packages/cli/package.json`. Workspace symlinking is
unaffected (npm links workspace packages from any dependency field), and tsdown bundles devDeps by
default, so this alone achieves D-150's effect; keep the explicit `deps.alwaysBundle` as documentation
so a future edit cannot un-bundle it silently.

**Guard:** add a test asserting `dist/cli.js` contains no `from "@accord-dev/accord-core"` and that
`packages/cli/package.json`'s `dependencies` has exactly one key (`commander`). `bin.test.ts` is the
natural home — it already reads `dist/cli.js` and already reasons about what a consumer receives.

### Landmine 2 — the token measurement cannot be produced as D-154/D-161 describe it (BLOCKING, needs an owner ruling)

The rule's scan set, verbatim:

```js
const prototypes = (snapshot: RepoSnapshot) => Object.keys(snapshot.files).filter((k) => PROTOTYPE.test(k)).sort();
```

`[VERIFIED: packages/core/src/lint/tokens.ts, near the end of the file]`

and the matcher, verbatim:

```js
export const PROTOTYPE = /^accord\/assets\/([^/]+)\/prototype\.html$/;
```

`[VERIFIED: packages/core/src/load/snapshot.ts:23]`

`design.tokens` supplies the *vocabulary* only — `tokenNames(css)` collects every `--name` declared —
and `scanPrototype(html, known)` produces the findings. There is no code path from a stylesheet to a
finding. Confirmed from the other side: the rule that *does* fire on `design.tokens` is
`tokensMissing`, whose reason text is `"...is not in the snapshot; tokens are read from
config.design.tokens only, so the token rule is skipped"`.

So in `C:/Work/SimplT` — a real git repo `[VERIFIED: git -C /c/Work/SimplT rev-parse --show-toplevel → C:/Work/SimplT]`
with no `accord/` folder `[VERIFIED: ls → No such file or directory]` — setting `design.tokens` to
`frontend/src/app/globals.css` and running `accord lint` produces **zero** token findings, because
there is no `accord/assets/<id>/prototype.html` to scan.

The stylesheet itself is excellent pilot material: **92 tokens**, Tailwind v4 (`@theme` present),
shadcn, 234 lines, first tokens `--color-background, --color-foreground, --font-sans, --font-mono,
--color-card, --color-card-foreground, --color-popover, ...`
`[VERIFIED: ran `tokenNames`'s own regex over C:/Work/SimplT/frontend/src/app/globals.css, 2026-09-20]`.
The vocabulary extraction works on real Tailwind v4.

**Options for the owner** (do not pick one inside the plan):
- **(a)** Author a `prototype.html` in SimplT from an existing page's markup and lint it against
  `globals.css`. Produces exactly D-161's numbers. Costs one authored artifact; SimplT still receives
  no commit.
- **(b)** Re-read ROADMAP criterion 4 as "the token *vocabulary* is extracted correctly from a real
  stylesheet" and record the 92-token extraction plus a spot-check as the evidence. Cheaper, but does
  not produce "how many false positives".
- **(c)** Reuse this repo's existing `examples/maintain` prototype against SimplT's stylesheet — a
  synthetic pairing, which weakens "real".

Per the project's standing rule on unspecified behaviour, this is a finding to raise, not a gap to
fill.

### Landmine 3 — `noExternal` is deprecated

Covered in full above. D-150 names `noExternal`; the installed tsdown 0.23.0 marks it
`@deprecated` in favour of `deps.alwaysBundle` and throws if both are set. Use `deps.alwaysBundle`.
This is a spelling change inside a locked decision, not a reopening of it.

### Landmine 4 — the `0.1.0` → `0.1.1` bump moves far more than three strings

CONTEXT's `## Integration Points` says three: `packages/cli/package.json`, `accord/config.yml`'s
`accord:` key, and the pinned version inside the generated `accord.yml`. Those three are necessary and
not sufficient. The pin is enforced at runtime by `pinMessage`, verbatim:

```ts
export function pinMessage(pinned: string | undefined, running: string): string | undefined {
  if (pinned === undefined || pinned === running) return undefined;
  return `config.yml pins accord ${pinned}, running ${running} - run: npx --yes ${pkg.name}@${pinned}`;
}
```

`[VERIFIED: packages/cli/src/pin.ts:14-17]`

Every place a `config.yml` pins `0.1.0` and a CLI at `0.1.1` reads it is a refusal. The full inventory,
grepped this session:

| # | Location | Count | Effect at 0.1.1 | Note |
|---|----------|-------|-----------------|------|
| 1 | `packages/cli/package.json` `version` | 1 | — | The source of truth |
| 2 | `packages/cli/package.json` `dependencies["@accord-dev/accord-core"]` | 1 | breaks workspace resolution if core's version moves and this does not | Moot once Landmine 1's fix moves it to devDependencies — but it still names `0.1.0` |
| 3 | `packages/core/package.json` `version` | 1 | — | **Recommend leaving core at `0.1.0` permanently.** It is private and unpublished; bumping it in lockstep is ceremony with a failure mode |
| 4 | `accord/config.yml` `accord:` | 1 | every CLI command in this repo exits 2 | `[VERIFIED: accord/config.yml:4 — `accord: "0.1.0"`]` |
| 5 | the generated `.github/workflows/accord.yml` (`npx --yes @accord-dev/accord@<ver>`, twice) | 1 file | the PR workflow runs the wrong CLI, which then refuses on the pin | Regenerated by re-running `accord init`? **No** — D-130 skips paths that exist. Must be edited or deleted-and-regenerated |
| 6 | `examples/build/accord/config.yml` and `examples/maintain/accord/config.yml` | 2 | **the `examples` CI job goes red** — it runs the real built CLI (`node "$cli" lint`, `node "$cli" gate done`) against both examples | `[VERIFIED: examples/*/accord/config.yml:6; .github/workflows/ci.yml `examples` job]` |
| 7 | `packages/core/test/fixtures/*/accord/config.yml` | 19 files | every CLI test using `makeRepo()` hits the pin and exits 2 | `makeRepo` copies a core fixture into a temp git repo `[VERIFIED: packages/cli/test/helpers/repo.ts — `cpSync(join(fixtures, fixture), tmp, ...)`]`. Core's own tests are blind to the pin (core never checks it) |
| 8 | `packages/cli/test/bin.test.ts:29` | 1 | **hard failure** — `expect(out.trim()).toBe('0.1.0')` | Should read `pkg.version`, as `pin.test.ts:65` already does |
| 9 | `packages/core/test/bundle.test.ts:70` | 1 | **hard failure if core's version moves** — `expect(pkg.version).toBe('0.1.0')` | Green if core stays at `0.1.0` per row 3 |
| 10 | `packages/cli/test/new-ticket.test.ts:167` | 1 | **hard failure** — `setConfig(repo, /^accord: "0\.1\.0"$/m, 'accord: "9.9.9"')`; the regex stops matching | Re-anchor on `/^accord: .*$/m`, as `pin.test.ts:15` and `skills-sync.test.ts:300` already do |

Rows 8, 9 and 10 are the only *hard-coded assertions*. Rows 4–7 are data that must move with the
version. Rows 5–7 are the ones that fail in CI rather than locally.

**Two ways to plan this.** Either (A) treat the bump as a mechanical sweep with a checklist of the ten
rows, or (B) make the bump *cheap* first: change rows 8 and 10 to read `pkg.version` and a loose
regex, and add a small script or test that rewrites every `accord: "..."` line under
`packages/core/test/fixtures/**` and `examples/**` from `packages/cli/package.json`. (B) is more work
now and turns every future bump into one command; (A) is less work now and will be done by hand again
at `0.2.0`. Given that D-157 exists partly *to exercise the bump*, (A) is defensible — but the
checklist must be in the plan, not in someone's head, because rows 6 and 7 fail after the commit, in
CI, on the release tag.

A cheaper third option worth surfacing: **`packages/cli/test/pin.test.ts` already imports `pkg` and
compares against `pkg.version`** `[VERIFIED: packages/cli/test/pin.test.ts:57, 65]`, and
`packages/cli/test/init.test.ts` does too `[VERIFIED: init.test.ts:160 — `expect(parsed(repo).accord).toBe(pkg.version)`]`.
The pattern to copy already exists in the repo; rows 8 and 10 are simply the two places it was not
applied.

### Landmine 5 — `accord/` here holds only `config.yml`

```
accord/config.yml
```

`[VERIFIED: find accord -type f, 2026-09-20 — one file]`

There are no tickets, no `product/glossary.md`, no `product/business-rules.md`, no templates, no skill
copies, no `.github/workflows/accord.yml`. D-132's "`init` fills in what is missing" means the init
run in this repository will create roughly the same ~27 files a greenfield run creates (Phase 7's
verification measured 28 created paths for greenfield, of which `config.yml` is the one that exists
here).

Two consequences:

1. **That init run and the dogfood ticket land in the same pull request** under D-155 — a ~28-file
   scaffold plus the README rewrite plus the ticket plus its `verification.md`. Worth planning as two
   commits on the branch even though they ship as one PR.
2. **`.claude/skills/` gets written here.** D-130 keeps `runtimes: [claude]`, so only the one path.
   But `AGENTS.md` / `CLAUDE.md` receive an appended pointer block (CLI-03) — and this repo's
   `.claude/CLAUDE.md` is already modified in the working tree. Check `git status` before the run; an
   append into a dirty file makes the diff harder to read than it needs to be.

### Landmine 6 — the PR's own `accord.yml` runs `gate done`, which must pass

The emitted workflow, verbatim from its generator:

```
          ${accord} lint || code=1
          tickets=$(git diff --name-only --diff-filter=d "$BASE"...HEAD | grep -E '^accord/tickets/[^/]+[.]md$' || true)
          if [ -z "$tickets" ]; then
            echo "no ticket file changed in this pull request - nothing to gate"
            exit $code
          fi
          while IFS= read -r file; do
            id=${file#accord/tickets/}
            id=${id%.md}
            ${accord} gate done "$id" || code=1
          done <<< "$tickets"
          exit $code
```

`[VERIFIED: packages/core/src/scaffold/workflow.ts, `workflowYml()`]`

So criterion 2 ("the generated CI workflow is green") and criterion 3 ("one real ticket reaches Done")
are coupled: the PR must carry the README ticket **already at Done** — `verification.md` written by
the fresh context, `verified:` ticked, `verified_commit` matching. A PR opened mid-implementation goes
red, and that red is a correct result, not a bug to work around.

There is a subtlety in `verified_commit`. The Done gate fails with a stale-review reason when
`verification.md`'s `commit:` differs from the gated commit (ROADMAP Phase 4 criterion 2). The
examples CI job works around this by rewriting the placeholder sha to the sandbox's own HEAD before
gating `[VERIFIED: .github/workflows/ci.yml, `examples` job — `sed -i "s/^verified_commit: \"1234567\"$/verified_commit: \"$sha\"/"`]`. A real ticket on a real branch cannot do that: the file cannot
carry the sha of the commit that contains it. **The planner must determine what the Done gate actually
compares against on a pull request before promising criterion 2 is reachable.** I did not read
`gate/done.ts`'s commit rule this session — confidence LOW on the exact comparison. This is the single
highest-value thing to check before planning the PR task, because it is the one failure mode that
would leave criteria 2 and 3 mutually unsatisfiable.

### Landmine 7 — `lint` in this repo is not silent

```
accord/config.yml: warning lint.tokens-missing design.tokens "docs/tokens.css" is not in the snapshot; tokens are read from config.design.tokens only, so the token rule is skipped
0 errors, 1 warnings
```

`[VERIFIED: `node packages/cli/dist/cli.js lint` at the repo root, 2026-09-20, exit 0]`

`docs/tokens.css` does not exist `[VERIFIED: ls → No such file or directory]`, which is exactly what
the config's own comment says. Exit 0, so `accord.yml` stays green — but the PR's workflow log will
show a warning, and anyone reading it as evidence for criterion 2 should know it is expected. Worth a
line in `09-VERIFICATION.md` rather than a surprise.

### Landmine 8 — core's `bundle.test.ts` pins the manifest shape D-150 edits

```js
    expect(pkg.name).toBe('@accord-dev/accord-core');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.type).toBe('module');
    expect(pkg.exports['.']).toEqual({ types: './dist/index.d.ts', default: './dist/index.js' });
    expect(pkg.exports['./schemas/*']).toBe('./schemas/*');
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'schemas', 'templates']));
```

`[VERIFIED: packages/core/test/bundle.test.ts, `it('manifest shape')`]`

Adding `private: true` does not break any of these. **Removing `exports` or `files` does** — and
D-150's prose ("What is lost: the public API and the `./schemas/*` export") could be read as licence to
remove them. Do not. `exports["."]` is load-bearing for the build (Landmine 3 / probe finding), and
this test is the guard that would catch its removal. The honest edit is: add `private: true`, change
nothing else, and add one line to this test asserting `pkg.private === true` so the decision is
recorded where someone will read it.

---

## Common Pitfalls

### Pitfall 1: Publishing before the manifest is fixed
**What goes wrong:** `0.1.0` lands on npm declaring a dependency that does not exist.
**Why it happens:** bundling feels like it removes the dependency; it removes the import.
**How to avoid:** Landmine 1's fix and guard land in Wave 0, before the D-151 bootstrap. Prove it with
`npm pack --workspace packages/cli --dry-run` and read the manifest in the tarball listing.
**Warning signs:** `npm publish --dry-run` says nothing about this — the failure is at *install* time,
on someone else's machine.

### Pitfall 2: Renaming the publish workflow file
**What goes wrong:** the next tag push authenticates as nobody and the publish fails.
**Why it happens:** the trusted publisher record matches on the filename, exactly.
**How to avoid:** pick the name once. `publish.yml` is conventional and short.
**Warning signs:** an auth error on a workflow that has not changed in any way a diff would show.

### Pitfall 3: Treating E409 as "already published"
**What goes wrong:** a transient packument write collision is silently skipped and the version never
lands, while the job reports success.
**Why it happens:** both codes look like publish failures.
**How to avoid:** the `npm view` pre-flight decides; do not parse error text. A publish that fails
after the pre-flight said "not on registry" should fail the job.
**Warning signs:** a green publish run with no new version on npm.

### Pitfall 4: A fixed sleep before the smoke test
**What goes wrong:** intermittent red on a good release, or a minute added to every release.
**Why it happens:** propagation is unbounded-ish and variable.
**How to avoid:** the bounded retry above, with the attempt number logged.
**Warning signs:** a smoke job that passes on rerun with no other change.

### Pitfall 5: Bumping core's version in lockstep
**What goes wrong:** `bundle.test.ts:70` reddens, and `packages/cli/package.json`'s dependency spec on
core has to move with it for nothing.
**Why it happens:** habit from when core was published.
**How to avoid:** core is private. Freeze it at `0.1.0` and say so in a comment.

### Pitfall 6: Running the dogfood against `packages/cli/dist/cli.js`
**What goes wrong:** the milestone does not close. PROJECT.md: *"Publishing without dogfooding, or
dogfooding from a local build, does not close the milestone."*
**Why it happens:** the local build is right there and is faster.
**How to avoid:** the ticket's commands are `npx --yes @accord-dev/accord@0.1.0 ...`, and
`09-VERIFICATION.md` records the actual invocations.
**Warning signs:** a transcript with `node packages/cli/dist/cli.js` in it.

### Anti-Patterns to Avoid

- **A `paths:` filter on the publish trigger.** Same trap D-138 already names for `accord.yml`: a
  skipped job leaves a required check pending forever.
- **An `environment:` key added "for safety".** Optional per the docs; a misconfigured environment
  blocks the tag ref with an error that reads nothing like its cause.
- **`continue-on-error: true` on the smoke job.** It is the only proof for criterion 1's "clean
  machine" clause. If it can be ignored it is not evidence.
- **Re-running `accord init` to regenerate `accord.yml` at the bump.** D-130 skips paths that exist,
  so it is a no-op. Edit the file or delete it first.

---

## Runtime State Inventory

This is a publish-and-measure phase with a version bump, not a rename — but the bump has the same
"what still holds the old string" shape, so the categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** accord has no datastore; git is the only source of truth. | none |
| Live service config | **npm registry state**, created by this phase: the `0.0.0` bootstrap row, the trusted-publisher record on the package's Settings page (owner + repo + workflow filename), and the granular bootstrap token. None of it lives in git. | Record the exact trusted-publisher field values in `09-VERIFICATION.md`; **revoke the bootstrap token** after `0.1.0` publishes over OIDC |
| OS-registered state | **None.** No scheduled task, no pm2, no daemon. | none |
| Secrets / env vars | **One, transient:** the granular npm access token used for the `0.0.0` publish, held in the author's local npm config, never in Actions. OIDC needs no secret. `GITHUB_TOKEN` is ambient. | Revoke after bootstrap; `09-VERIFICATION.md` states it was revoked |
| Build artifacts / installed packages | `packages/*/dist/` are gitignored `[VERIFIED: .gitignore — `dist/`]` and rebuilt by `npm run check`. `node_modules/@accord-dev/*` are workspace symlinks `[VERIFIED: ls -la node_modules/@accord-dev/]` and re-link on `npm ci`. **Stale `npx` cache** is the real one: a machine that ran `npx @accord-dev/accord@0.1.0` before `0.1.1` may serve the old binary — which is precisely the situation the D-94 pin exists to refuse. | none required; note that the pin refusal *is* the expected behaviour and is not a bug to report during the dogfood |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (local) | build, test, probe | ✓ | 24.x (tsdown targeted `node22.12.0`; probe ran clean) | — |
| npm (local) | `npm ci`, `npm view`, bootstrap publish | ✓ | bundled | — |
| git | everything | ✓ | — | — |
| tsdown 0.23.0 | the D-150 build change | ✓ | 0.23.0 `[VERIFIED: node_modules/tsdown/package.json]` | — |
| Network / npm registry | `npm view`, publish | ✓ | reachable (E404s returned, not timeouts) | — |
| npmjs.com account with `@accord-dev` scope | D-151 bootstrap | **✗ unverified** | — | **none — blocking**; see Package Legitimacy Audit |
| GitHub repository with Actions enabled | D-149, D-155 | ✓ (assumed — `ci.yml` runs) | — | — |
| `C:/Work/SimplT` as a git repo | D-154 | ✓ | root `C:/Work/SimplT` | — |
| `C:/Work/SimplT/frontend/src/app/globals.css` | D-154 | ✓ | 234 lines, 92 tokens | — |

**Missing dependencies with no fallback:**
- npm scope ownership of `@accord-dev`. Everything downstream (`pin.ts:16`, the generated
  `config.yml`, the goldens, the emitted `accord.yml`) already names it. Verify before the bootstrap.

**Missing dependencies with fallback:** none.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` `[VERIFIED: .planning/config.json]`, so this section applies.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 5.0.0 `[VERIFIED: package.json devDependencies]` |
| Config file | `packages/cli/vitest.config.ts`, `packages/core/vitest.config.ts` |
| Quick run command | `npx vitest run -t "<name>"` (scoped), or `npm test -w packages/cli` |
| Full suite command | `npm run check` (build + lint + typecheck + test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-03 | `dist/cli.js` imports no `@accord-dev/accord-core` | unit | `npx vitest run -t "bin"` (new case in `bin.test.ts`) | ❌ Wave 0 |
| OPS-03 | `packages/cli` declares exactly one runtime dependency | unit | same file, new case | ❌ Wave 0 |
| OPS-03 | `dist/cli.js` still starts with `#!/usr/bin/env node` | unit | `npx vitest run -t "shebang"` | ✅ `bin.test.ts` |
| OPS-03 | the published bundle names no other tool | unit | `npx vitest run -t "names no other tool"` | ✅ `bin.test.ts` (**probed green against the bundled output: 0 hits**) |
| OPS-03 | `packages/core` is `private: true` and keeps `exports` | unit | `npx vitest run -t "manifest shape"` | ✅ `bundle.test.ts` (add one `private` assertion) |
| OPS-03 | `packages/cli/README.md` matches its source | unit | `npx vitest run -t "drift"` | ❌ Wave 0 (copy `templates.test.ts`'s drift case) |
| OPS-03 | the tag-vs-manifest check rejects a mismatch | unit | a bash-executed test over the workflow's `run:` body, the shape `workflow-script.test.ts` already uses | ❌ Wave 0 — **recommended**; the repo already proved this pattern for `accord.yml` |
| OPS-03 | `engines` is `>=22.12.0` | unit | any manifest assertion | ✅ already true, unasserted |
| OPS-04 | the emitted `accord.yml` gates touched tickets | unit | `npx vitest run -t "workflow script"` | ✅ `workflow-script.test.ts` |
| OPS-04 | `--version` prints the running version | unit | `npx vitest run -t "version"` | ✅ `bin.test.ts` — **but pins the literal `'0.1.0'`; change to `pkg.version`** |

### Sampling Rate

- **Per task commit:** `npm test -w packages/cli` (the package every Wave 0 change touches)
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green, plus the two CI jobs (`check` matrix and `examples`) green on
  `main`, before any tag is pushed

### Wave 0 Gaps

- [ ] `packages/cli/scripts/gen-readme.mjs` + wiring into the root `gen` script — covers D-156 defect 1
- [ ] `packages/cli/test/readme.test.ts` (or a case in an existing file) — drift, LF, no BOM
- [ ] New cases in `packages/cli/test/bin.test.ts` — core not imported; `dependencies` has one key;
      `--version` reads `pkg.version` instead of the literal
- [ ] `packages/cli/test/new-ticket.test.ts:167` — re-anchor the regex off the literal version
- [ ] One `private: true` assertion in `packages/core/test/bundle.test.ts`
- [ ] A bash-executed test over the publish workflow's version-check body, following
      `packages/cli/test/workflow-script.test.ts`
- [ ] Framework install: **none** — vitest is present and wired

### What has NO automated proof and must be evidenced by hand in `09-VERIFICATION.md`

This is the part the verifier needs stated plainly. Four of this phase's deliverables cannot be
asserted by any test in this repository:

| Criterion / decision | Why no test can prove it | Required evidence |
|---|---|---|
| ROADMAP 1 — "published from GitHub Actions via npm trusted publishing" | The publish happens once, on a real registry, from a real runner. A test can prove the workflow *parses* and that the version check *rejects a mismatch*; it cannot prove OIDC succeeded. | The Actions run URL; the publish step's log showing no token was used; the npm package page showing the provenance attestation; the trusted-publisher field values as configured |
| ROADMAP 1 — "`npx --yes <scope>/accord --version` works on a clean machine" | The smoke job is the proof, and it is a job, not a test. | The smoke job's log including the attempt count and the printed version; ideally a second, manual run on the author's machine with the npx cache cleared |
| ROADMAP 2 — "the generated CI workflow is green" | It runs in a pull request on GitHub, against a diff. `workflow-script.test.ts` executes the script body against synthetic diffs; it cannot produce a green GitHub check. | The PR URL; the `accord` check's conclusion; the job log showing which ticket ids it gated (and the expected `lint.tokens-missing` warning, per Landmine 7) |
| ROADMAP 3 — Ready and Done on a coding agent with a fresh-context review | Gate *logic* is covered by Phase 4's suite. That a human-plus-agent ran the shipped skill is not a testable proposition. | `accord/tickets/<id>.md` with `ac_hash` and `verified:`; `accord/tickets/<id>/verification.md` written by the subagent (D-158); both gate transcripts showing PASS |
| ROADMAP 4 / D-159 — wall-clock `new ticket` → Ready | Wall-clock time including breaks is unmeasurable by anything but a clock. | Two timestamps and the elapsed figure, with the `accord new ticket` and `accord gate ready` transcripts bracketing them |
| ROADMAP 4 / D-161 — token findings, genuine vs false positive | Requires human judgement on each finding, by definition. **And see Landmine 2 — the measurement may not be producible as specified at all.** | Raw finding count, the genuine/false-positive split, one concrete example of each, and the exact commands run in SimplT |
| D-151 — bootstrap token revoked | Registry-side state. | A statement that it was revoked, with the date |

Everything in this table is `09-VERIFICATION.md`'s job. A plan that assumes a test will cover any of
it will produce a phase that cannot close.

---

## Security Domain

`workflow.security_enforcement` is `true`, ASVS level 1 `[VERIFIED: .planning/config.json]`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | GitHub Actions OIDC → npm trusted publishing. No long-lived credential exists after the bootstrap token is revoked. |
| V3 Session Management | no | No session; the OIDC token is per-job and short-lived |
| V4 Access Control | yes | `permissions:` at job level, least privilege: `id-token: write` + `contents: read` on publish only, nothing on smoke |
| V5 Input Validation | yes | The tag name is attacker-influenceable only by someone who can push a tag (i.e. a maintainer), but it flows into a shell step. Pass it through `env:`, never interpolate `${{ }}` inside `run:` |
| V6 Cryptography | no | Nothing hand-rolled; provenance attestation is npm's |
| V14 Configuration | yes | `files:` controls what is uploaded; `deps.onlyBundle` (optional) controls what is inlined |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Actions script injection via `${{ }}` inside `run:` | Tampering | Bind to `env:` and reference `$VAR`. **This repo already knows this** — `workflowYml()`'s JSDoc says "the one GitHub Actions expression in this document sits in `env:` and nowhere else… which is the standard Actions script-injection vector" `[VERIFIED: packages/core/src/scaffold/workflow.ts]`. Apply the same rule to the publish workflow's `github.ref_name`. |
| Long-lived `NPM_TOKEN` leaked from a log or a fork PR | Information disclosure | OIDC — already the locked decision (D-151) |
| Bootstrap token left live after use | Elevation of privilege | Revoke immediately after `0.1.0` publishes; record it |
| Supply-chain drift into the published bundle | Tampering | `deps.onlyBundle` as an allowlist (optional, recommended); `bin.test.ts`'s scan over `dist/cli.js`; automatic provenance |
| Publishing a scoped package `restricted` by accident | Denial of service (to users) | `--access public` explicitly |
| Workflow filename renamed, trust relationship silently lost | Spoofing (of the failure cause) | Fix the filename at creation; record it in `09-VERIFICATION.md` beside the trusted-publisher fields |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `NPM_TOKEN` secret + `--provenance` | Trusted publishing (OIDC), provenance automatic | GA 2025-07-31 `[CITED: github.blog changelog]` | No secret; drop `--provenance` |
| `npm install -g npm@latest` on the publish runner | Unnecessary on Node 24 | Node 24 now ships npm 11.19.0 | One less step, one less network call `[VERIFIED: nodejs.org/dist/index.json]` |
| Scoped packages default `restricted` | `access` default is `'public'` for new packages | unknown — I did not find the changelog | Pass `--access public` anyway; MEDIUM confidence |
| tsdown `noExternal` / `external` | `deps.alwaysBundle` / `deps.neverBundle` | by tsdown 0.23.0 | `[VERIFIED: installed type declarations, `@deprecated` tags]` |
| tsup | tsdown | already migrated | — |

**Deprecated/outdated in this repo's own notes:**
- `.claude/CLAUDE.md` decision 6: "`npm install -g npm@latest`" — no longer needed on Node 24
- `.claude/CLAUDE.md` decision 6: "Scoped packages default to restricted, so `--access public` is
  mandatory" — contradicted by current npm docs; the flag is still recommended, the *reason* has changed
- CONTEXT `## Integration Points`: "three strings together" — it is ten locations; see Landmine 4

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | npm has no "pending trusted publisher", so a package must exist before the publisher can be configured | npm Trusted Publishing / D-151 | **Low.** If wrong, the `0.0.0` bootstrap is merely unnecessary — and still the safer order, since it proves the scope and the manifest before a real version is burned |
| A2 | The npm scope `@accord-dev` is claimable | Package Legitimacy Audit | **High.** Every downstream string names it. Verify before the bootstrap — `checkpoint:human-verify` |
| A3 | `private: true` on a workspace package does not disturb `npm ci` or the symlink | tsdown Bundling, consequence 2 | **Low**, and cheaply falsifiable: set it, run `npm ci`, check the symlink |
| A4 | `github.ref_name` is the bare tag name on a tag push | Publish Workflow Shape | **Low.** `${GITHUB_REF#refs/tags/}` is an equivalent with no doubt attached |
| A5 | E403 is the permanent conflict and E409 the transient one | Skip a version already on the registry | **Low** — the `npm view` pre-flight makes the distinction moot in the recommended design |
| A6 | `--access public` is still accepted and is a no-op under the current default | npm Trusted Publishing | **Low.** If `access` were removed as a flag the publish would fail loudly at the first bootstrap, not silently |
| A7 | GitHub Actions is enabled on the repository and can push to npm from a tag ref without branch-protection interference | Environment Availability | **Low**, but untested — no publish workflow has ever run here |

---

## Open Questions

1. **How does the Done gate's commit comparison behave on a pull request?** (Landmine 6)
   - What we know: Done fails with a stale-review reason when `verification.md`'s `commit:` differs
     from the gated commit; the examples CI job sidesteps this by rewriting the sha to the sandbox's
     HEAD before gating.
   - What's unclear: what a real branch should put in `verified_commit` / `commit:` so that the PR's
     `accord.yml` sees a passing Done. A file cannot carry the sha of the commit containing it.
   - Recommendation: **read `packages/core/src/gate/done.ts`'s commit rule before planning the PR
     task.** This is the one open question that could make criteria 2 and 3 mutually unsatisfiable,
     and it is a ten-minute read. Confidence LOW — I did not open that file this session.

2. **How is D-161's token measurement to be produced?** (Landmine 2)
   - What we know: the rule scans `accord/assets/<id>/prototype.html` against the vocabulary from
     `design.tokens`; SimplT's stylesheet yields 92 tokens; SimplT has no prototype.
   - What's unclear: which of options (a)/(b)/(c) the owner wants.
   - Recommendation: raise before planning the SimplT task. Do not let a plan invent a prototype
     silently.

3. **Does the generated `packages/cli/README.md` need link rewriting for npm?**
   - What we know: the root README links `docs/design.md` relatively; npmjs.com cannot resolve it.
   - What's unclear: whether the D-156 ticket treats this as in scope.
   - Recommendation: a one-line decision in the ticket's `## Plan`, not a research question.

4. **Bump strategy: sweep-by-hand (A) or make-it-cheap-first (B)?** (Landmine 4)
   - What we know: ten locations, three of them hard assertions, three of them CI-only failures.
   - Recommendation: (A) with an explicit ten-row checklist inside the plan is defensible given D-157
     exists partly to exercise the bump. (B) costs one small script and retires the problem. Owner's
     call; either way the checklist must be written down.

5. **`deps.onlyBundle` as a supply-chain allowlist — worth the eight-name list?**
   - Recommendation: yes if the planner wants the published bundle's contents to be a checked fact
     rather than a hint in a build log. Optional.

---

## Sources

### Primary (HIGH confidence)

- **Probe build, 2026-09-20** — `packages/cli` built with `deps: { alwaysBundle: ['@accord-dev/accord-core'] }` into a throwaway `dist-probe/`, then executed: shebang, import list, `--version`, `--help`, `lint` over `examples/build`, `deniedNames` scan, core-entry resolution. Config and output deleted afterwards; `packages/cli/dist/` untouched.
- **`node_modules/tsdown/dist/types-CYHmmaKd.d.mts`** — lines 10, 83, 99-115, 1387-1395: `Arrayable`, `NoExternalFn`, `DepsConfig.alwaysBundle` / `neverBundle` / `onlyBundle`, and the `@deprecated` tags on `external` / `noExternal`
- **`https://nodejs.org/dist/index.json`**, read 2026-09-20 — bundled npm per Node line
- **`npm view @accord-dev/accord` / `@accord-dev/accord-core`**, 2026-09-20 — both E404
- **In-repo reads this session:** `packages/cli/package.json`, `packages/core/package.json`, root `package.json`, `packages/cli/tsdown.config.ts`, `packages/core/tsdown.config.ts`, `.github/workflows/ci.yml`, `accord/config.yml`, `packages/cli/src/pin.ts`, `packages/cli/src/index.ts`, `packages/core/src/scaffold/workflow.ts`, `packages/core/src/lint/tokens.ts`, `packages/core/src/load/snapshot.ts` (PROTOTYPE), `packages/core/test/templates.test.ts`, `packages/core/test/bundle.test.ts`, `packages/core/test/examples.test.ts`, `packages/cli/test/bin.test.ts`, `packages/cli/test/spawn-surface.test.ts`, `packages/cli/test/helpers/repo.ts`, `packages/core/scripts/gen-skills.mjs`, `test/helpers/denied.ts`, `eslint.config.ts`, `.gitignore`, `.planning/config.json`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`
- **`accord lint` run at the repo root and over `examples/build`**, 2026-09-20
- **`tokenNames` regex run over `C:/Work/SimplT/frontend/src/app/globals.css`**, 2026-09-20 — 92 tokens, `@theme` present

### Secondary (MEDIUM confidence)

- `docs.npmjs.com/trusted-publishers` — npm/Node floor, permissions block, setup-node example, trusted-publisher fields and their optionality, automatic provenance
- `docs.npmjs.com/cli/v11/commands/npm-publish` — duplicate-version failure, permanence, `--dry-run`
- `docs.npmjs.com/cli/v11/using-npm/config#access` — `access` default is `'public'` for new packages
- `raw.githubusercontent.com/actions/setup-node/main/action.yml` — the full input list; `always-auth` is absent
- `github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/` — GA date

### Tertiary (LOW confidence)

- Community issue reports on registry propagation delay (stella/.github#85, lutzseverino/repo-standards#80, kryptobaseddev/cleo#1377, mikeparcewski/wicked-crew#514) — the *existence* of the delay is well attested across independent projects; no specific duration is authoritative
- Community reports that npm has no pending-publisher equivalent (mssql-connectors/dab-js#2, toyamarinyon/karia#6, HJewkes/titan-platform#45) — consistent with npm's docs placing configuration on a package page, but not stated by npm
- E403 vs E409 semantics (lerna commit 6123e86, blog.npmjs.org EPUBLISHCONFLICT post) — not from npm's error reference

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| tsdown bundling (D-150) | **HIGH** | Probed by building and running; every claim has pasted output behind it |
| Repo landmines | **HIGH** | Every file read this session; line-anchored quotes |
| npm runner version floor | **HIGH** | Docs for the floor, `index.json` for the bundled versions |
| Publish workflow shape | **MEDIUM-HIGH** | The mechanics are documented; the exact YAML has never run in this repo |
| Trusted-publisher UI fields | **MEDIUM** | From npm's docs, but the "package must exist first" premise is community-sourced |
| `--access` default | **MEDIUM** | Current docs contradict the project's own note; no changelog found for the change |
| Registry propagation timing | **MEDIUM** | Phenomenon well attested; no authoritative duration exists |
| Token measurement (D-154/D-161) | **HIGH on the mechanism, BLOCKED on the plan** | The rule's scan set is read and quoted; what the owner wants instead is an open question |
| Done gate on a pull request | **LOW** | `gate/done.ts` not read this session — see Open Question 1 |
| `private: true` with `npm ci` | **LOW-MEDIUM** | Not probed; cheaply falsifiable in Wave 0 |
| npm scope availability | **UNVERIFIED** | Requires an npm login; blocking, flagged as a human checkpoint |

**Research date:** 2026-09-21
**Valid until:** 2026-10-05 (14 days). Short deliberately: the npm/Node version facts and npm's UI
both move, and this phase's decisions are one-way doors. Re-run the `index.json` check and re-read the
trusted-publishers page at execution time if more than two weeks have passed.
