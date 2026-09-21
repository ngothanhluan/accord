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

Status: pending — filled by 09-08.

Required evidence: PR URL; the `accord` check's conclusion; job log showing which ticket ids it gated,
and the expected `lint.tokens-missing` warning.

## 4. Ready and Done on a coding agent with a fresh-context review (OPS-04 / ROADMAP 3)

Status: pending — filled by 09-09.

Required evidence: `accord/tickets/<id>.md` with `ac_hash` and `verified:`;
`accord/tickets/<id>/verification.md` written by the subagent (D-158); both gate transcripts showing
PASS.

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
