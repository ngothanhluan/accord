---
phase: 09-publish-and-dogfood
created: 2026-09-21
status: in-progress
plan_of_record: 09-05
---

# Phase 9: Publish and Dogfood — Verification Record

The home for every deliverable in this phase that no test in this repository can assert.
`09-VALIDATION.md` names seven such rows; they are the seven numbered sections at the bottom of this
file, in that table's order. Later plans append into those sections rather than inventing new ones.

Three further sections sit above them, carrying the registry bootstrap evidence from 09-05. They are
not Manual-Only rows and they are filled on creation.

## npm scope ownership

Verified 2026-09-21 from the CLI, not by reading a dashboard page. `09-RESEARCH.md`'s registry probe
established only that the two package *names* were free; it explicitly did not certify *scope*
ownership, and `npmjs.com/org/accord-dev` returned a bot-block that was not readable either way.

```
npm whoami            -> ngothanhluan
npm org ls accord-dev -> ngothanhluan - owner
```

Outcome: **already owned**. No string naming `@accord-dev` has to move — `packages/cli/package.json`,
`packages/cli/src/pin.ts:16`, the `config.yml` that `accord init` generates, the 17 committed goldens
and the `npx` invocation inside every emitted `accord.yml` all stand as written.

## The 0.0.0 bootstrap (D-151)

Published 2026-09-21 with a granular access token, from the working tree — 09-01's manifest change
was on disk, and npm publishes what is on disk, not what is in git.

```
npm warn publish "bin[accord]" script name dist/cli.js was invalid and removed
npm notice package:       @accord-dev/accord@0.0.0
npm notice 3.0kB          README.md
npm notice 847.6kB        dist/cli.js
npm notice 393B           package.json
npm notice filename:      accord-dev-accord-0.0.0.tgz
npm notice package size:  183.0 kB
npm notice unpacked size: 851.0 kB
npm notice shasum:        7f1e2e6a8e51c16cf63a4c9c5e4cb167f75cd270
npm notice total files:   3
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access
+ @accord-dev/accord@0.0.0
```

The `bin` warning is npm's wording, not a defect. The registry manifest carries
`"bin": {"accord": "dist/cli.js"}` — the normaliser strips the leading `./` and re-adds the entry.
Proven end to end by installing the published version on Windows:

```
npm install @accord-dev/accord@0.0.0  -> added 2 packages, found 0 vulnerabilities
node_modules/.bin/                    -> accord, accord.cmd, accord.ps1
accord --version                      -> 0.0.0
```

Decision recorded: `packages/cli/package.json` keeps `"./dist/cli.js"` as CLAUDE.md section 6
specifies. The cost is one warning line on every publish; the alternative edits a recorded decision
and the tests that assert the string, to buy nothing the registry does not already do.

The packument index took roughly 150 seconds to appear after the publish returned, while the
per-version endpoint answered immediately. A 404 from `npm view` in the first minutes after a first
publish is propagation, not failure.

`dist.attestations` is `false` on this version, as expected — it was published with a token. The
0.1.0 publish over OIDC is where provenance appears, and its absence here is not a finding.

Task 2's optional fourth option — attempting to configure a trusted publisher on a package that does
not yet exist, which would have retired the `[ASSUMED]` premise in `09-RESEARCH.md` — was **not
attempted**. The premise stands unretired: it remains community consensus consistent with npm
documentation placing the configuration on a package Settings page, and npm still documents no
equivalent to the pre-registration publisher flow PyPI offers. (That PyPI feature is spelled with
the same status word rows 1 through 6 use below; it is written out this way so it does not disturb
the count those rows are checked by.)

## Trusted publisher configuration

Configured by the author on `npmjs.com/package/@accord-dev/accord` -> Settings -> Trusted Publisher,
2026-09-21.

| Field | Value |
|---|---|
| Organization or user | `ngothanhluan` |
| Repository | `accord` |
| Workflow filename | `publish.yml` |
| Environment name | *(left blank)* |

Source of these values: they are the values the author was instructed to enter and reported entering.
npm does not expose trusted-publisher configuration through the public registry API — the packument
for this package carries only `_id, name, dist-tags, versions, time, maintainers, description,
license, readme, readmeFilename, _rev` — so **no independent verification of these four fields was
possible from this machine**. The first real proof is 09-06's OIDC publish succeeding. If it fails,
this table is the thing to diff against the form.

`.github/workflows/publish.yml` must never be renamed. npm matches this record on the filename alone,
and a rename breaks authentication with an error that reads nothing like its cause. The filename was
fixed at creation in 09-04 for exactly this reason.

The environment field was left blank deliberately. It is optional, and an environment whose branch
protections disallow a tag ref blocks the job with an equally misleading error.

## 1. Published from Actions via trusted publishing (OPS-03 / ROADMAP 1)

Status: **verified 2026-09-21.**

`@accord-dev/accord@0.1.0` was published by run 35581268150, from tag `v0.1.0` on commit `a4ea1e7`.

```
https://github.com/ngothanhluan/accord/actions/runs/35581268150

npm notice version:  0.1.0
npm notice shasum:   549ea29ad0cd0ea6c3bd97da9a54c9207d44b659
npm notice total files: 3
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access
npm notice publish Signed provenance statement with source and build information from GitHub Actions
npm notice publish Provenance statement published to transparency log: https://search.sigstore.dev/?logIndex=2905307661
```

No token exists anywhere on this path: the job holds `id-token: write` and nothing else, no
`NODE_AUTH_TOKEN` is set, and the repository defines no npm secret. The registry carries the
attestation, which is the half a log line cannot fake:

```
dist.attestations.url -> https://registry.npmjs.org/-/npm/v1/attestations/@accord-dev%2faccord@0.1.0
predicateType         -> https://slsa.dev/provenance/v1
```

The trusted-publisher table recorded above is verified by use rather than by report, and two failed
runs are what verified it. Both are kept:

- Run 35579914891 attempt 1 failed `E403 - OIDC permission denied for this action`. The certificate
  sigstore issued on that attempt named exactly what the form was supposed to hold — repository
  `ngothanhluan/accord`, workflow `publish.yml`, no environment, ref `refs/tags/v0.1.0` — so the
  claim side was right and the record side was not. The author corrected the configuration between
  attempts. Which field was wrong is not recorded, because npm exposes no way to read the record
  back and the before state was never captured; the lesson is to capture it next time, not to guess
  now.
- Attempt 2 failed `E422 - "repository.url" is "", expected to match
  "https://github.com/ngothanhluan/accord" from provenance`.

Neither failure wrote to the registry, which is why `0.1.0` was still free on the third run. A tag
that fails to publish is re-pointable; `v0.1.0` moved from `5a2eb4d` to `a4ea1e7` by force and cost
nothing, because nothing had ever fetched it.

That second failure names a constraint that exists only under provenance, and it is the reason
09-01 through 09-05 could all be green with a defect in the manifest. `packages/cli/package.json`
carried no `repository` field, and nothing caught it: the 0.0.0 bootstrap went up with a token,
which signs no provenance, so the registry had nothing to cross-check the manifest against. Under
trusted publishing it does — npm matches `repository.url` against the repository sigstore attests
to and refuses the publish when they differ. Stated generally, because it will recur: a publish that
skips provenance also skips every check provenance turns on, so the bootstrap proves less about the
real release path than its success suggests.

## 2. npx on a clean machine prints the version (OPS-03 / ROADMAP 1)

Status: **verified 2026-09-21.**

The `smoke` job declares no `permissions` key at all, so it cannot mint an OIDC token even by
accident, and takes no checkout, so the runner holds no `package.json` and no `node_modules`. That
is the closest thing Actions offers to a clean machine.

```
attempt 1 .. 9: not yet visible; sleeping 15s
attempt 10: 0.1.0
```

Ten attempts out of a budget of twelve — roughly 2m15s from the publish call returning to `npx
--yes @accord-dev/accord@0.1.0 --version` resolving and printing `0.1.0`, against a three-minute
ceiling. The margin is thinner than it looks comfortable being, and it is the number to watch on
the next release rather than a result to celebrate. It is also the second observation of the same
behaviour: 09-05 measured about 150 seconds for the packument index to appear after the 0.0.0
publish, while the per-version endpoint answered at once. Two data points, one shape — the registry
acknowledges a publish well before every edge serves it.

## 3. The generated CI workflow is green (OPS-04 / ROADMAP 2)

Status: **NOT MET — the workflow failed for a reason nobody predicted, recorded as FINDING F-6.**

Pull request: https://github.com/ngothanhluan/accord/pull/1 — the one pull request D-155 allows.
Run: https://github.com/ngothanhluan/accord/actions/runs/35607058696
Conclusion of the `accord` check: **failure**.

The run was ruled under 09-08 Task 1 option (a): the check goes red and the reason is the finding. The
reason it actually went red is not the reason that ruling anticipated. It never reached a gate at all:

```
Run npx --yes @accord-dev/accord@0.1.0 lint || code=1
sh: 1: accord: not found
sh: 1: accord: not found
##[error]Process completed with exit code 1.
```

Both invocations failed in about 1.6 seconds, too fast to have fetched anything. No ticket id was
derived, no `lint.tokens-missing` warning was printed, and `gate done` never ran, so the evidence this
section was meant to carry does not exist. What the log does confirm is D-162: the checkout step
reports `ref: 7781f04c5c4f54391570fe6b1cf3227c763a809d`, the branch head rather than a synthetic merge
commit, and permissions are `Contents: read`.

The staleness reasons option (a) predicted are still real and still fire. They are recorded in section
4, from the developer's machine, where the gate could actually run.

### FINDING F-6: `npx --yes <pkg>@<version>` runs the workspace, not the registry, when the two match

Root cause, reproduced in isolation rather than inferred. A directory holding nothing but a root
manifest declaring `workspaces: ["packages/cli"]`, a `packages/cli/package.json` declaring
`@accord-dev/accord` at `0.1.0` with a `bin`, and **no `node_modules`**, reproduces it exactly:

```
$ npx --yes @accord-dev/accord@0.1.0 --version
'accord' is not recognized as an internal or external command
```

npm resolves the spec against the workspace tree, finds a local package of that name and version,
declines to fetch, and tries to run a bin link that a repository without an install does not have. The
runner's `sh: 1: accord: not found` is the same failure in the runner's shell.

Asking for a version the workspace does not hold fetches normally, inside the repository and outside
it — `npx --yes @accord-dev/accord@0.0.0 --version` prints `0.0.0` in both — so this is not npx
ignoring the spec. It is npx honouring it against a local package that already satisfies it.

Two consequences, and the second is a correction to evidence already recorded in this phase.

1. The workflow `accord init` generates cannot work in a repository that *is* the package, unless the
   job installs dependencies first. Every other repository is unaffected, because no other repository
   declares a workspace of this name. A narrow blast radius, and a sharp edge in the one repository
   the author was always going to try first.

2. **The `npx --yes` runs in 09-07 and 09-08 were made from this repository's root, where
   `node_modules/.bin/accord` exists and points at `packages/cli/dist/cli.js`.** Those runs used the
   local build. 09-07's "No local build was invoked at any point" and 09-08's "Everything that touched
   it was `npx --yes @accord-dev/accord@0.1.0`" describe an intent the command did not carry out.

   The outcomes are unaffected. `packages/cli/dist/cli.js` and the published tarball's `dist/cli.js`
   are byte-identical, `sha256 6f38f978...deb9e3`, checked by unpacking
   `npm pack @accord-dev/accord@0.1.0`. The same bytes ran either way. What was lost is the provenance
   the claim asserted, not the result it reported.

   The runs that did exercise the registry are the ones made in an empty scratch directory — section
   2 above, and `@ac-5` in section 4 — because an empty directory has no workspace to satisfy the
   spec.

Not fixed here. The fix is a scaffold or gate-semantics change and this phase's domain block rules
both out; filed for v0.2 beside the tick-binding change.

## 4. Ready and Done on a coding agent with a fresh-context review (OPS-04 / ROADMAP 3)

Status: **Ready MET. Done NOT MET, for four separate reasons, all recorded rather than worked around.**

Ticket: `accord/tickets/README-1.md` — `ac_hash: fnv1a64:565100d5d96d1415`,
`verified: [ac-2, ac-3, ac-4, ac-5]`, `verified_hash: fnv1a64:565100d5d96d1415`,
`verified_commit: 61e0830`. `@ac-1` is deliberately not ticked.

Review: `accord/tickets/README-1/verification.md`, `commit: 32d9c5a`, `reviewed_on: 2026-09-21`, one
block per scenario in tag order. **Written by a subagent (D-158, the first branch of D-109)**, handed
`.claude/skills/accord-dev/review.md` and the ticket id and nothing else. It passed four scenarios,
failed `@ac-1`, and filed one finding. Nothing in it was edited by the context that wrote the change.

`accord gate ready README-1` — **PASS**, exit 0. Transcript in section 5.

`accord gate done README-1` — **FAIL**, 9 errors, run with the review and the ticks uncommitted, which
is the only arrangement in which the two commit values can equal `HEAD`:

```
accord/config.yml: error gate.tests-unconfigured no test report is declared, so the machine layer
  cannot run and Done cannot pass; set tests.report
accord/tickets/README-1.md: error gate.tags-differ scenarios lack nothing; evidence lacks nothing;
  verified lacks @ac-1
accord/tickets/README-1.md: error gate.test-tag-missing  (five times, one per scenario)
accord/tickets/README-1/verification.md: error gate.stale-review the review was written against
  commit 32d9c5a; the gated commit is 61e0830...
accord/tickets/README-1/verification.md: error gate.result-not-pass evidence block "@ac-1" records
  Result: fail
9 errors, 25 warnings
```

The same command after committing the review and the ticks reports **11** errors: the nine above plus

```
accord/tickets/README-1.md: error gate.tick-stale-commit the ticks were made against commit 61e0830;
  the gated commit is 7781f04...
```

That is the structural gap 09-08 Task 1 recorded, now observed rather than reasoned about. Committing
the tick is what makes the tick stale.

The four reasons Done is not met, kept apart because they are four different things:

1. **`@ac-1` is false at this commit and becomes true at the next release.** Its Given is a reader on
   the registry, and the registry serves the readme published with 0.1.0. `publish.yml` exits when the
   version is already on the registry, so 0.1.0 cannot be republished with the new text. 09-11's 0.1.1
   makes it true. The reviewing context found this; the author had not.
2. **The tick and the review go stale on the commit that carries them**, as above.
3. **The machine layer has never been configured in this repository.** `accord/config.yml` declares no
   `tests.report`, and D-80 makes that a hard fail with no bypass. accord has gated its own work and
   the machine layer was absent for all of it.
4. **Three of the five scenarios cannot name a `@test:<id>`, because no test can hold them.** GATE-08
   requires every scenario that is not `@ui` to name a test id from the report. `@ac-1` and `@ac-3`
   have real tests. `@ac-2` ("presents the four stages as stages one person passes through") and
   `@ac-4` ("names no part that has been removed") are claims about prose, and `@ac-5` is a person
   running a command and reading what it prints. None of the three is `@ui` in any honest reading of
   that tag.

   This is the sharpest design finding the dogfood produced: **the Done gate assumes every scenario
   that is not a user interface is machine-checkable, and a documentation ticket's scenarios are
   neither.** The shipped escape hatch is `@ui`, which would be a lie here. Adding tags to buy a pass
   would also move `ac_hash` and drop the ticket back to Ready, so the gate refuses the shortcut twice
   over. Recorded, not acted on: it is a v0.2 design question.

Nothing under `packages/core/src/gate/` or `packages/core/src/lint/` was modified, no tag was added to
obtain a pass, and `verified_commit` was not chased across commits.

## 5. Wall-clock new ticket to Ready (OPS-04 / ROADMAP 4, D-159)

Status: **measured 2026-09-21.**

```
start  2026-09-21 19:42 +0700
end    2026-09-21 19:48 +0700
        6 minutes
```

D-159's definition, so it does not have to be looked up: wall-clock from the `accord new ticket`
command to the `accord gate ready` run that printed PASS, breaks included.

The command that started the clock:

```
$ npx --yes @accord-dev/accord@0.1.0 new ticket README-1
accord/tickets/README-1.md
```

The run that stopped it — the first one to exit 0 after the readiness review's questions were
answered:

```
$ npx --yes @accord-dev/accord@0.1.0 gate ready README-1
accord/tickets/README-1.md:30: warning lint.test-tag-missing scenario "The registry page carries the
  same description, and its links work" has no @test:<id> tag and is not @ui
  ... four more of the same, one per scenario ...
0 errors, 5 warnings
updated ac_hash fnv1a64:22698da82d6828e6 -> fnv1a64:565100d5d96d1415 in accord/tickets/README-1.md
(exit 0)
```

Context, not a correction — the number is wall-clock and is not adjusted for any of this:

- The scope was decided before the clock started. D-156 enumerated the four README defects on
  2026-09-20 and 09-08's own plan restated them, so the BA stage was transcribing a decided scope
  rather than discovering one. A ticket whose subject is not already settled would not look like
  this.
- The gate was run once before the readiness review rather than after it, which is out of order
  against `story.md` steps 5 and 6. It passed, writing `ac_hash fnv1a64:22698da82d6828e6`. The
  review then filed five questions, the gate correctly refused on all five as
  `lint.open-question`, and the run recorded above is the one that passed after they were answered.
  Both the out-of-order pass and the recovery are inside the six minutes.
- Two of the five review findings were answered by amending the acceptance criteria, which is why
  the hash moved between the two passes. Nothing was relaxed: no gate rule, lint rule, criterion or
  template was changed to obtain either PASS.


## 6. Token findings: genuine vs false positive (OPS-04 / ROADMAP 4, D-161, D-163)

Status: pending — filled by 09-10.

Required evidence: raw finding count, the genuine/false-positive split, one concrete example of each,
and the exact commands run in the SimplT scratch worktree. Both D-160 measurements land in this file;
this repository's own `accord/` folder receives nothing from 09-05.

## 7. Bootstrap token revoked (OPS-03 / D-151)

Status: **CLOSED as an accepted deviation — owner ruling, 2026-09-21. The token is not revoked.**

The granular bootstrap token has **not** been revoked. The author was asked twice and elected to
retain it for now.

Verified live rather than assumed: after the author reported the step done, `npm whoami` using that
token still returned `ngothanhluan`, so the credential remains valid with read and write on the
`@accord-dev` scope.

Asked a third time on 2026-09-21, after 0.1.0 had published over OIDC without touching the token,
the author ruled: keep it, and do not hold the phase open for it. That ruling is what closes this
row. It closes as an accepted deviation, not as a success — the difference matters, because the
property below is still false and closing the row does not make it true.

This is the one row of the seven that 09-05 was scoped to close, so 09-05 closes as partial rather
than complete. Two consequences follow, both deliberate and both the author's call:

- The property D-151 exists to produce — that this project holds no long-lived registry credential —
  is not yet true. It becomes true when the token is deleted at npmjs.com -> Access Tokens.
- The token string was pasted into a Claude Code session transcript on 2026-09-21 and is therefore at
  rest in that session log on disk, which raises the value of revoking it above the ordinary hygiene
  case.

This section deliberately avoids the status word rows 1 through 6 use, so that those rows still
number exactly six. 09-06, 09-08, 09-09 and 09-10 each step that count down by one and are only
checkable if it starts at six. If the token is ever revoked, append the revocation date here; do not
reintroduce the rows-1-to-6 status word.
