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

Status: pending — filled by 09-06.

Required evidence: Actions run URL; publish-step log showing no token was used; the npm page showing
the provenance attestation; the trusted-publisher field values as configured, recorded above.

## 2. npx on a clean machine prints the version (OPS-03 / ROADMAP 1)

Status: pending — filled by 09-06.

Required evidence: smoke-job log including attempt count and printed version; ideally a second manual
run with the npx cache cleared.

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

Status: pending — filled by 09-09.

Required evidence: two timestamps and the elapsed figure, with the `accord new ticket` and
`accord gate ready` transcripts bracketing them.

## 6. Token findings: genuine vs false positive (OPS-04 / ROADMAP 4, D-161, D-163)

Status: pending — filled by 09-10.

Required evidence: raw finding count, the genuine/false-positive split, one concrete example of each,
and the exact commands run in the SimplT scratch worktree. Both D-160 measurements land in this file;
this repository's own `accord/` folder receives nothing from 09-05.

## 7. Bootstrap token revoked (OPS-03 / D-151)

Status: **OUTSTANDING — deliberate deviation, 2026-09-21.**

The granular bootstrap token has **not** been revoked. The author was asked twice and elected to
retain it for now.

Verified live rather than assumed: after the author reported the step done, `npm whoami` using that
token still returned `ngothanhluan`, so the credential remains valid with read and write on the
`@accord-dev` scope.

This is the one row of the seven that 09-05 was scoped to close, so 09-05 closes as partial rather
than complete. Two consequences follow, both deliberate and both the author's call:

- The property D-151 exists to produce — that this project holds no long-lived registry credential —
  is not yet true. It becomes true when the token is deleted at npmjs.com -> Access Tokens.
- The token string was pasted into a Claude Code session transcript on 2026-09-21 and is therefore at
  rest in that session log on disk, which raises the value of revoking it above the ordinary hygiene
  case.

This section carries the word OUTSTANDING rather than the status word used by rows 1 through 6, so
that those rows still number exactly six. 09-06, 09-08, 09-09 and 09-10 each step that count down by
one and are only checkable if it starts at six. When the token is revoked, replace this section's
status with the revocation date; do not reintroduce the rows-1-to-6 status word here.
