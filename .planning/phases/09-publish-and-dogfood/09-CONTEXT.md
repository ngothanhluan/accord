# Phase 9: Publish and Dogfood - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

v0.1 goes onto npm from GitHub Actions through trusted publishing, and the package that lands
there is then used — not a local build — to put the contract into a repository and carry one real
ticket through Ready and Done.

In scope: OPS-03, OPS-04. Two pilots, each answering a different criterion: this repository
answers criteria 2 and 3, and `C:/Work/SimplT` answers the token half of criterion 4.

Not in scope: promoting the token rule from warning to error (ROADMAP criterion 4 says the check
happens *before* any promotion); SKILL-10 and SKILL-11, both parked in REQUIREMENTS under later
work; the `rejected-alternatives` todo, which is a format change; release notes; changesets.
No gate rule changes and no lint rule changes.

Decision numbering continues from Phase 7 (D-01 to D-148).

</domain>

<decisions>
## Implementation Decisions

### Publishing mechanism

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

### Pilots

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

### Dogfood ticket

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

### Measurement

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

### Rulings made at planning (2026-09-21)

These three were raised by Phase 9 research, confirmed against source by the planning orchestrator,
and ruled on by the author before the planner ran. They are locked on the same footing as D-149 to
D-161.

- **D-162:** The emitted CI workflow's checkout step **gains `ref: ${{ github.event.pull_request.head.sha }}`**.
  Without it `accord.yml` can never pass `gate done` on a pull request, which makes ROADMAP criteria 2
  and 3 mutually unsatisfiable: `actions/checkout` with no `ref:` lands on GitHub's synthetic merge
  commit, `gate done` binds ticks to `git show -s --format=%H HEAD` (`packages/cli/src/load/fs.ts:76`),
  and the author's `verified_commit` is their branch head — so `tickStaleCommit` and `staleReview` both
  fire. The repository's own `examples` CI job only avoids this by `sed`-rewriting the sha to the
  sandbox HEAD, which a real branch cannot do. The fix is one line in
  `packages/core/src/scaffold/workflow.ts` plus its scaffold test and golden. It is also the more
  correct semantics: accord's rule is that the review must be of the code being gated, and what a
  fresh-context review read is the branch, not a speculative merge. `$BASE...HEAD` still resolves
  under `fetch-depth: 0`. This is a scaffold-template change, not a gate-rule change, so the domain
  block's "no gate rule changes and no lint rule changes" still holds.
  — **Reversibility:** reversible in the template, but it ships inside `0.1.0`, so shipping without it
  means every user's generated workflow carries the defect until they re-run `init`.

- **D-163:** The D-161 token measurement **authors one `accord/assets/<id>/prototype.html` in a scratch
  worktree of `C:/Work/SimplT`**, derived from one real screen's rendered markup, and runs `accord lint`
  with `design.tokens` set to `frontend/src/app/globals.css`. The rule reads its *vocabulary* from
  `design.tokens` but scans only prototypes (`packages/core/src/lint/tokens.ts:201-206`), so a
  stylesheet with no prototype yields zero findings for a structural reason rather than a clean one.
  A prototype is the artifact accord's own designer stage expects, so this exercises the rule as
  designed rather than working around it. D-154 still holds: the worktree is scratch and SimplT
  receives no commit; only the numbers travel, into `09-VERIFICATION.md`. D-161's "raw numbers, no
  conclusion" rule is unchanged.
  — **Reversibility:** reversible — the prototype is scratch and nothing downstream depends on it.

- **D-164:** `@accord-dev/accord-core` **moves from `dependencies` to `devDependencies` in
  `packages/cli/package.json`** in the same change that makes core `private: true`. Bundling under
  D-150 removes the *import*, not the *declaration*: a published `0.1.0` that still declares the
  dependency would send `npx` to the registry for a package that is never published, and every install
  would 404. This is a mechanical consequence of D-150 rather than a new choice, recorded because the
  window closes permanently the moment `0.1.0` is published.
  — **Reversibility:** one-way once published — a broken `0.1.0` can only be deprecated, not replaced.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and milestone
- `.planning/ROADMAP.md` §"Phase 9: Publish and Dogfood" — the four success criteria this phase is
  judged on, and the note that Phase 8 was removed
- `.planning/REQUIREMENTS.md` — OPS-03 and OPS-04 (lines 91-92); the Out of Scope block at line 132
- `.planning/PROJECT.md` §"Milestone: v0.1" (lines 15-25) — the three closing conditions, and the
  sentence that rules out dogfooding from a local build

### Publishing facts already settled
- `.claude/CLAUDE.md` §"Decisions" item 6 — trusted publishing (OIDC, `id-token: write`, npm
  >= 11.5.1, Node >= 22.14, `--access public`), `files`, `exports`, shebang, `.gitattributes`, the
  version pin as a hard refusal, and the scoped-package constraint
- `.claude/CLAUDE.md` §"What NOT to Use" — never spawn `npm` or `npx` from the CLI

### Decisions this phase builds on
- `.planning/phases/07-scaffolding-and-example-repo/07-CONTEXT.md` — D-130 (a path that exists is
  skipped), D-132 (`init` fills in what is missing in a repository that already has `accord/`),
  D-134 (`config.yml` defaults, including `tokens: ""`), D-135 (one version string), D-136 (the
  emitted workflow triggers on `pull_request` only), D-137 (touched tickets from the diff)
- `.planning/phases/06-skills/06-CONTEXT.md` — D-105 to D-109 (skills as data, rendering, the
  adaptive fresh-context sentence), D-113 (orphan scan is `sync`-only), D-119, D-125
- `.planning/notes/solo-reaim-and-three-layer-done.md` — the 2026-09-11 re-aim that makes the
  README's "team contract" wording stale

### Code the phase touches
- `packages/cli/package.json`, `packages/core/package.json` — the manifests that change under D-150
- `packages/cli/tsdown.config.ts` — where `noExternal` lands
- `packages/cli/src/pin.ts` — the exact-equality pin and its refusal message
- `packages/core/src/validate/ajv.ts:4-6` — schemas as JSON module imports, the fact that makes
  bundling core safe
- `.github/workflows/ci.yml` — the existing matrix the publish job deliberately does not repeat
- `README.md` — the dogfood ticket's subject
- `accord/config.yml` — `profile: maintain`, `runtimes: [claude]`, and the comment recording why
  the token rule is skipped here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/ci.yml` — the `check` job's shape (checkout, setup-node with `cache: npm`,
  `npm ci`, then the script steps) is what the publish job's pre-check step copies.
- `packages/core/scripts/gen-templates.mjs` and `gen-skills.mjs` plus their drift tests — the house
  pattern for "a committed file generated from a source, guarded by a test". `packages/cli/README.md`
  follows it.
- `pinMessage()` in `packages/cli/src/pin.ts` — already names the package and the fix command; the
  `0.1.0` → `0.1.1` bump exercises it without changing it.

### Established Patterns
- Version strings are compared with `===` and nothing else (D-94). The tag-vs-manifest check in the
  publish workflow follows the same rule — no semver range, no tolerance.
- Core imports no `node:*` module; a lint rule enforces it. Bundling core into the CLI does not
  change this, because the guard is on source imports, not on the bundle.
- Paths that are stored or printed use `path.posix`. Anything the publish or measurement work writes
  follows it.

### Integration Points
- `tsdown`'s `noExternal` is the single point where core stops being an external dependency; the
  `dist/cli.js` shebang assertion and the existing build tests are what catch a mistake there.
- `accord init` run from the published package writes `.github/workflows/accord.yml` alongside the
  existing `ci.yml` — different filenames, no collision.
- The `0.1.1` bump has to move three strings together: `packages/cli/package.json`,
  `accord/config.yml`'s `accord:` key, and the pinned version inside the generated `accord.yml`.

</code_context>

<specifics>
## Specific Ideas

- The pilot for the token measurement is named, not generic: `C:/Work/SimplT`, stylesheet
  `frontend/src/app/globals.css`. It is a git repository and receives no commit from this work.
- The README rewrite has four named defects (D-156), not a vague "modernise it".
- The `0.0.0` placeholder is deliberate and permanent; it is not a mistake to clean up later.

</specifics>

<deferred>
## Deferred Ideas

- **Promoting the token rule from warning to error** — v0.2 at the earliest. D-161 gathers the
  evidence; the decision needs more than one stylesheet.
- **Release notes / changesets** — STACK.md already defers changesets ("`npm version` by hand is
  enough with one author"). Release notes were declined as a publish trigger under D-149.
- **A public core API and the `./schemas/*` export** — dropped by D-150. If editor tooling ever
  needs the schemas, publishing them is a new decision, not a reversal of this one.

### Reviewed Todos (not folded)
- `.planning/todos/pending/mcp-host-spike.md` — **obsolete**. It is a spike to de-risk Phase 8,
  which was removed under D-117. It should be closed rather than carried; nothing in it applies to a
  publish-and-dogfood phase.
- `.planning/todos/pending/rejected-alternatives-have-no-home.md` — real and worth doing, but it is
  a format change touching `ticket.schema.json`, the templates, and Phase 1-2 fixtures and goldens,
  and the todo itself still carries an unresolved question ("is this BA-only, or does a developer's
  rejected implementation approach belong in `## Plan`?"). Too large for a first dogfood ticket and
  outside OPS-03/OPS-04.

</deferred>

---

*Phase: 9-Publish and Dogfood*
*Context gathered: 2026-09-20*
