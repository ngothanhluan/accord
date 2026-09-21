---
phase: 09-publish-and-dogfood
plan: 04
subsystem: infra
tags: [github-actions, npm, trusted-publishing, oidc, release]
status: complete
requires:
  - "packages/cli/package.json carrying the version the tag is checked against (09-01 left it at 0.1.0)"
  - "packages/cli/test/helpers/repo.ts — makeEmptyRepo / cleanup"
  - ".github/workflows/ci.yml — the step shape and the multi-line run: house style"
provides:
  - ".github/workflows/publish.yml — the release path: tag in, published package out, smoke-proved on a clean runner"
  - "the workflow FILENAME, now fixed and part of the npm trusted-publisher record 09-05 configures"
  - "jobs.publish.outputs.version — the only way the smoke job learns which version to install"
  - "packages/cli/test/publish-workflow.test.ts — the D-94 equality rule executed in both directions"
affects:
  - "09-05 — must enter `publish.yml` verbatim as the trusted-publisher workflow filename"
  - "09-06 — the tag push that first exercises this workflow end to end"
  - "09-11 — the 0.1.1 bump moves packages/cli/package.json, which the version check reads"
tech-stack:
  added: []
  patterns:
    - "a workflow run: body selected by its `id:` and executed under bash in a test, rather than grepped"
    - "skip-if-already-published as an `npm view` pre-flight probe, never as error-text matching"
    - "bounded logged retry that distinguishes not-yet-visible (retry) from visible-but-wrong (fail now)"
key-files:
  created:
    - .github/workflows/publish.yml
    - packages/cli/test/publish-workflow.test.ts
    - .planning/phases/09-publish-and-dogfood/09-04-SUMMARY.md
  modified: []
decisions:
  - "The workflow filename is `.github/workflows/publish.yml` and is fixed at creation — one-way door honoured, not reopened."
  - "Comments explaining absent keys were reworded so no forbidden literal appears in the document at all (`environment:`, `--provenance`, `continue-on-error`, a global npm upgrade command), because the acceptance criterion is a document-contains check and a comment naming the thing would trip a grep-based verifier."
  - "RED was produced by mutating the workflow's own comparison operator rather than by writing the test before the workflow — the same shape 09-03 used, and the empirical form of the plan's acceptance criterion 5."
metrics:
  duration: 14min
  completed: 2026-09-21
actuals:
  tokens: 3831      # chars/4 over the realized diff (15324 chars across 2 files); estimate was 55000
  tasks: 2
  commits: 0        # this repository forbids commits; all work left uncommitted in the working tree
plan_head_before: 2a5040af51e33ee7cfe7db5c5a56024326ff8959
requirements-completed: []   # OPS-03 deliberately NOT ticked — nothing is published yet; 09-06 ticks it
---

# Phase 09 Plan 04: The Release Path Summary

`.github/workflows/publish.yml` turns a pushed `v*` tag into a published package over OIDC with no
stored credential, refuses before `npm ci` if the tag and `packages/cli/package.json` name different
versions, skips a version already on the registry, and proves the result by installing it through
`npx` on a runner that never checked the repository out — and the refusal rule is executed by six
vitest cases rather than read.

## Tasks

### Task 1: `.github/workflows/publish.yml`

Two jobs. `publish` on `ubuntu-latest` with `permissions: { id-token: write, contents: read }`
declared at **job** level (a deliberate divergence from `ci.yml`, which declares workflow-level
permissions — the comment in the file says why), `actions/checkout@v7`, `actions/setup-node@v7` with
`node-version: 24`, `registry-url: 'https://registry.npmjs.org'` and `cache: npm`, then the
version check, `npm ci`, `npm run check` as one step (D-152), and the publish step. `smoke` with
`needs: publish`, no `permissions` key, no checkout, and one bounded `npx` retry.

Every locked constraint honoured: no second trigger, no path filter, no deployment environment, no
provenance flag, no soft-fail on the smoke job, no global npm upgrade step (Node 24 ships npm 11.19.0,
over the 11.5.1 floor — the file records that moving back to Node 22 makes it mandatory again).

The three GitHub Actions expressions in the document live under `outputs:`, `env:` and `env:`. None
appears inside a `run:` body — T-09-10's mitigation, and the property Task 2's test exercises by
supplying `TAG` through the environment exactly as the runner does.

### Task 2 (TDD): The version check executed

`packages/cli/test/publish-workflow.test.ts`, six cases. The script is lifted from the parsed
document by step `id: version` and asserted to be exactly one match, so a rename fails loudly rather
than silently testing an empty string. The bash-availability guard and its `ACCORD_BASH` knob are
copied verbatim from `workflow-script.test.ts`, with the guard-the-guard case outside the skipped
`describe` (T-07-35). The sandbox is `makeEmptyRepo()` plus a `packages/cli/package.json` carrying
`7.7.7-fixture` — obviously a fixture, so no assertion quietly starts passing for the wrong reason
after a real bump. `TAG`, `GITHUB_ENV` and `GITHUB_OUTPUT` are built into the object passed to
`execFileSync`; `process.env` is never mutated (T-07-32); all three paths are relative to the sandbox
`cwd`, so no Windows path reaches a POSIX redirection.

**RED→GREEN observed, not asserted.** The commit is waived by the repository's no-commit rule; the
ordering is not. With `publish.yml`'s comparison mutated from `!=` to `=` — the plan's acceptance
criterion 5, executed instead of reasoned about — all five behaviour cases went red:

```
FAIL  |cli| test/publish-workflow.test.ts > … > the failure names both the tag's version and the manifest's
AssertionError: expected '' to contain '9.9.9'
FAIL  |cli| test/publish-workflow.test.ts > … > a tag with no leading v is compared on its bare value
AssertionError: tag 7.7.7-fixture names 7.7.7-fixture, packages/cli/package.json names 7.7.7-fixture
: expected 1 to be +0 // Object.is equality

 Test Files  1 failed (1)
      Tests  5 failed | 1 passed (6)
```

The operator was restored and the suite went green at 6 passed. The plan asked for "at least two
cases red"; the measured answer is five, because the mutation inverts the branch rather than
weakening it.

## Verification

Every `must_haves` truth below was proved by a command that ran, in Git Bash on Windows. That is the
right local approximation: a GitHub Actions `run:` body with `shell: bash` executes under bash on
`ubuntu-latest`, so the same shell grammar, the same `set` flags, the same `${TAG#v}` expansion and
the same `[ … ]` comparison are exercised. What Git Bash cannot approximate is the runner's `npm`,
`npx` and network — so those three were PATH-shadowed by stubs whose argv is recorded, which makes
"which invocation was made" an assertion rather than a hope.

### 1. A pushed tag matching `v*` is the only thing that can trigger a publish (D-149)

```
$ node -e "…parse('.github/workflows/publish.yml')…"
{"on":{"push":{"tags":["v*"]}},"jobs":["publish","smoke"],
 "perms":{"id-token":"write","contents":"read"},"smokePerms":null,
 "needs":"publish","outputs":{"version":"${{ steps.version.outputs.version }}"}}
```

`on` is a push trigger restricted to `v*` and carries nothing else. Grep count over the document for
`workflow_dispatch`, `release:` and `paths:` — `0`, `0`, `0`.

### 2. A tag whose version differs from the manifest stops the job before anything is built (D-94)

Step order, read off the parsed document:

```
publish step order:
  0: actions/checkout@v7
  1: actions/setup-node@v7
  2: version
  3: npm ci
  4: npm run check
  5: publish unless this version is already on the registry
version step index: 2  npm ci index: 3  npm run check index: 4
```

The check sits at index 2, ahead of both. Executed, on a mismatch (`npm test -- --project cli
publish-workflow`, case 3 and case 4):

```
tag v9.9.9 names 9.9.9, packages/cli/package.json names 7.7.7-fixture
```

exit non-zero, `GITHUB_ENV` empty, `GITHUB_OUTPUT` empty. On a match, both files gain
`VERSION=7.7.7-fixture` — asserted separately, because only the second half crosses the job boundary.

### 3. `npm ci && npm run check` once on ubuntu-latest with Node 24 before publishing (D-152)

```
runs-on publish/smoke: ubuntu-latest / ubuntu-latest
node-version publish/smoke: 24 / 24
registry-url: https://registry.npmjs.org
```

One `npm ci` step and one `npm run check` step, no `strategy.matrix` anywhere in the document.

### 4. No long-lived registry credential; `id-token: write` on the publish job only

```
permissions publish: {"id-token":"write","contents":"read"}   smoke: null
credential references: none        # scan for secrets. | NPM_TOKEN | NODE_AUTH_TOKEN | _authToken
smoke has checkout: false
expressions inside run: bodies: none
all expressions in document: [ '${{ steps.version.outputs.version }}',
                               '${{ github.ref_name }}',
                               '${{ needs.publish.outputs.version }}' ]
```

T-09-11 and T-09-12 both hold structurally: the smoke job declares no permissions at all, so it
cannot mint an OIDC token, and no secret exists in the document to leak.

### 5. A version already on the registry is skipped rather than failing

The publish step's `run:` body was extracted from the parsed document and executed with `npm`
PATH-shadowed by a stub that records its argv:

```
=== A. version already on the registry -> skip, exit 0, no publish call ===
@accord-dev/accord@0.1.0 is already on the registry - skipping publish
exit=0
--- calls ---
npm view @accord-dev/accord@0.1.0 version

=== B. package not on the registry (E404) -> publishes ===
exit=0
--- calls ---
npm view @accord-dev/accord@0.1.0 version
npm publish --workspace packages/cli --access public
```

Case B is the one that matters for the `|| true`: the stub exits non-zero with `npm error code E404`
on stdout-empty, exactly as the registry does on a first publish, and the step survives `set -e` and
reaches `npm publish`. Without `|| true` this is the release the guard would have killed.

### 6. A clean runner installs the published version through `npx`, with a bounded retry naming the attempt

The smoke step's `run:` body executed with `npx` and `sleep` PATH-shadowed (the no-op `sleep` is what
makes a three-minute budget provable in under a second):

```
=== C. not visible on attempts 1-2, visible on 3 -> exit 0, names the attempt ===
attempt 1: not yet visible; sleeping 15s
attempt 2: not yet visible; sleeping 15s
attempt 3: 0.1.0
exit=0

=== D. resolves immediately but prints the wrong version -> fails now, no retry ===
attempt 1: 0.0.9
resolved, but printed '0.0.9' not '0.1.0'
exit=1
npx invocations: 1

=== E. never visible -> 12 bounded attempts, then exit 1 ===
attempt 1..12: not yet visible; sleeping 15s
@accord-dev/accord@0.1.0 never became installable within 3 minutes
exit=1
npx invocations: 12
```

Case D is the distinction the plan insisted on: a broken bundle fails on the first attempt rather
than burning the budget and being reported as a slow registry.

### Plan verification block

| Command | Result |
|---|---|
| `node -e "…parse publish.yml…"` (Task 1 `<automated>`) | exit 0, every structural clause satisfied — output above |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test -- --project cli publish-workflow` | `Test Files 1 passed (1)`, `Tests 6 passed (6)` |

`npm run build` and `npm run check` were deliberately NOT run: 09-01 owns `packages/core/dist/` and
`packages/cli/dist/` in this wave, and the unfiltered `--project cli` run would execute `bin.test.ts`
and `new-ticket.test.ts` which 09-01 edited. 09-06 Task 1 runs the whole suite on a settled tree.

### Project-constraint checks

```
denied-name hits: 0                              # both new files, case-sensitive scan, test/helpers/denied.ts list
.github/workflows/publish.yml            | CR: false | BOM: false | single trailing LF: true
packages/cli/test/publish-workflow.test.ts | CR: false | BOM: false | single trailing LF: true
```

## Deviations from Plan

**1. Comments reworded so no forbidden literal appears in the document**

- **Found during:** Task 1 verification.
- **Issue:** The plan's action text asks for a comment saying a global npm upgrade "becomes mandatory
  again if this job ever moves to Node 22", and the house comment style explains absent keys. Written
  literally, the document would contain the strings `environment:`, `--provenance`,
  `continue-on-error` and `npm install -g npm` — each inside a comment saying why it is absent — while
  acceptance criterion 4 states the document contains none of them.
- **Fix:** Each comment keeps its reasoning and drops the literal ("no GitHub deployment environment is
  declared", "the provenance flag is deliberately not passed", "nothing here is allowed to fail softly",
  "no global npm upgrade step"). Grep counts for all four are now `0`, and a grep-based verifier and a
  human reader get the same answer.
- **Files modified:** `.github/workflows/publish.yml`.
- **Rule:** not a deviation rule — both instructions are the plan's, and this is the reading that
  satisfies both.

**2. RED produced by mutating the workflow, not by writing the test first**

- **Found during:** Task 2.
- **Issue:** The subject under test — `publish.yml`'s version check — is written by Task 1, so a
  test-first ordering would have produced a `file not found` RED that proves nothing about the rule.
- **Fix:** The comparison operator was flipped to `=` before the test ran, the five behaviour cases
  observed red, and the operator restored. This is the empirical form of the plan's own acceptance
  criterion 5 ("verify by reasoning about the assertions") and the shape 09-03 used for the same
  situation. `publish.yml` is byte-identical to its pre-mutation state apart from the restoration.

Nothing else. No package was installed, no architectural change was needed, no authentication gate
was hit.

## Findings

None. Every truth in `must_haves` was verifiable by a command, and no test failed against existing
code for a reason that was not a deliberate mutation.

## Known Stubs

None. The two `run:` bodies that cannot be executed against the real services in a local shell
(`npm publish`, `npx` against the registry) are executed against recorded-argv stubs above; they are
not stubs *in the shipped artifact*, which contains the real commands.

## Threat Flags

None. The document introduces no surface absent from the plan's `<threat_model>`: T-09-10 (tag bound
through `env:`), T-09-11 (`id-token: write` on one job), T-09-12 (no stored credential), T-09-13
(filename fixed at creation) and T-09-14 (skip decided by a pre-flight probe, not by error text) are
each mitigated as written, and items 1, 4, 5 and 6 of the verification above are their evidence.

## Requirement status

OPS-03 is **not** ticked. This plan builds the release path; nothing has been published, the npm
scope is still unconfirmed (09-05) and no tag exists. 09-06 is where the requirement is met.

## Repository state

No commit, no tag, no push — this repository takes none. `git rev-parse HEAD` is
`2a5040af51e33ee7cfe7db5c5a56024326ff8959` at the start and at the end of this plan, and
`git tag -l 'v*'` is empty. Both new files are untracked in the working tree.

## Self-Check: PASSED

- `.github/workflows/publish.yml` — FOUND (7462 bytes)
- `packages/cli/test/publish-workflow.test.ts` — FOUND (7894 bytes)
- Commits: none expected, none made — `git rev-parse HEAD` unchanged at `2a5040a`
- Tags: none expected, none made — `git tag -l 'v*'` empty
