---
phase: 09-publish-and-dogfood
plan: 05
subsystem: infra
tags: [npm, publishing, trusted-publishing, oidc, registry, credentials]

requires:
  - phase: 09-publish-and-dogfood
    provides: "09-01's manifest — one runtime dependency and a private core — without which the published 0.0.0 would 404 on install and could never be replaced"
provides:
  - "@accord-dev scope confirmed owned by the author, verified from the CLI rather than assumed"
  - "@accord-dev/accord@0.0.0 exists on the public registry and installs and runs on Windows"
  - "the npm trusted-publisher record for this repository and publish.yml, as reported by the author"
  - ".planning/phases/09-publish-and-dogfood/09-VERIFICATION.md — the phase evidence file, three sections filled, six awaiting later plans"
affects: [09-06 the OIDC publish that this bootstrap exists to enable, 09-11 the 0.1.1 re-publish]

actuals:
  tokens: 2092      # chars/4 over the realized diff (8368 chars, 09-VERIFICATION.md); estimate was 25000
  tasks: 4
  commits: 0        # repository forbids commits; all work left uncommitted in the working tree
  plan_head_before: 2a5040af51e33ee7cfe7db5c5a56024326ff8959

tech-stack:
  added: []
  patterns:
    - "a throwaway credential is written to a --userconfig npmrc in the session scratchpad and deleted after use, never to ~/.npmrc and never to the repository"
    - "npm pkg set rewrites the whole manifest in expanded JSON; a temporary version bump has to be undone by restoring the file text, not by setting the value back"

key-files:
  created:
    - .planning/phases/09-publish-and-dogfood/09-VERIFICATION.md
    - .planning/phases/09-publish-and-dogfood/09-05-SUMMARY.md
  modified: []      # packages/cli/package.json was edited and restored byte-for-byte; net zero

key-decisions:
  - "Task 1 resolved as `already owned`: npm org ls accord-dev returns `ngothanhluan - owner`. The CLI answers the question the 403 bot-block on the org page could not."
  - "Task 2 answered `proceed` by the author: spend one permanent public 0.0.0 so the trusted publisher can be configured before any real version is published (D-151)."
  - "Task 2's optional fourth option — probing whether npm accepts a trusted publisher on a package that does not yet exist — was NOT attempted. The [ASSUMED] premise in 09-RESEARCH.md stands unretired."
  - "packages/cli/package.json keeps \"./dist/cli.js\" as CLAUDE.md section 6 specifies, despite npm's publish warning. The registry normalises the leading ./ away and the bin still works; changing it would edit a recorded decision and the tests asserting the string, to buy nothing."
  - "The bootstrap token was NOT revoked. The author was asked twice and elected to retain it. 09-05 therefore closes partial."

patterns-established:
  - "Verify a reported manual step rather than recording it: after the author reported the revocation done, npm whoami with that token still succeeded."

requirements-completed: []   # OPS-03 stays open — it reads `published via npm trusted publishing`, and 0.0.0 was published with a token

coverage:
  - id: D1
    description: "The npm scope @accord-dev is owned by the author, so every string already naming it is correct"
    requirement: OPS-03
    verification:
      - kind: integration
        ref: "npm whoami -> ngothanhluan; npm org ls accord-dev -> ngothanhluan - owner"
        status: pass
    human_judgment: false
  - id: D2
    description: "@accord-dev/accord@0.0.0 exists on the registry, so the package Settings page exists and a trusted publisher can be configured on it"
    requirement: OPS-03
    verification:
      - kind: integration
        ref: "npm publish --workspace packages/cli --access public -> + @accord-dev/accord@0.0.0"
        status: pass
      - kind: integration
        ref: "npm install @accord-dev/accord@0.0.0 in an empty directory -> added 2 packages; ./node_modules/.bin/accord --version -> 0.0.0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The trusted publisher names this repository and the filename publish.yml, with no environment"
    requirement: OPS-03
    verification:
      - kind: manual
        ref: "09-VERIFICATION.md#trusted-publisher-configuration"
        status: unverified
    human_judgment: true
    rationale: "npm exposes no trusted-publisher configuration through the public registry API; the packument carries only _id, name, dist-tags, versions, time, maintainers, description, license, readme, readmeFilename, _rev. The four field values are recorded as reported by the author. The first independent proof is 09-06's OIDC publish succeeding."
  - id: D4
    description: "The granular bootstrap token is revoked, with the date recorded"
    requirement: OPS-03
    verification:
      - kind: integration
        ref: "npm whoami with the bootstrap token -> ngothanhluan (still authenticates)"
        status: fail
    human_judgment: true
    rationale: "Deliberate deviation. The author was asked twice and chose to retain the token for now. Recorded as OUTSTANDING in 09-VERIFICATION.md section 7."
  - id: D5
    description: "09-VERIFICATION.md carries the exact trusted-publisher field values, so a later authentication failure can be diagnosed against what was configured"
    verification:
      - kind: integration
        ref: "grep -c '^## ' -> 10 (>=7); publish.yml present in body twice; exactly 6 occurrences of the rows-1-to-6 status word; zero backslashes; LF only"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-21
status: partial
---

# Phase 9 Plan 5: Registry Bootstrap Summary

Closes partial. Three of four must-haves are met and verified by commands that were run; the fourth —
the bootstrap token revoked — was declined by the author and is recorded as an open item rather than
quietly dropped.

## Performance

18 minutes wall-clock, four tasks, three of them human gates that consumed no executor context. One
new file of substance (`09-VERIFICATION.md`, 8368 bytes). Net source diff: zero — the only source
file touched, `packages/cli/package.json`, was restored byte-for-byte.

## Accomplishments

### Task 1 — scope ownership, answered by the CLI

`09-RESEARCH.md` had established only that the two package *names* were free. `npmjs.com/org/accord-dev`
returned a 403 bot-block that was not readable in either direction. Once a token was available, the
question turned out to have a CLI answer that needed no dashboard at all:

```
npm whoami            -> ngothanhluan
npm org ls accord-dev -> ngothanhluan - owner
```

Outcome: **already owned**. Nothing naming `@accord-dev` has to move.

### Task 2 — the one-way door, answered `proceed`

One permanent public `0.0.0` spent, as D-151 specifies. The author confirmed after being told plainly
that a published version cannot be deleted, only deprecated.

The optional fourth option — attempting the trusted-publisher form on a package that does not exist,
which would have retired an `[ASSUMED]` in `09-RESEARCH.md` — was not attempted. The premise is still
community consensus rather than documented fact, and the next project will re-ask it.

### Task 3 — published, configured, not revoked

Pre-flight before anything irreversible: npm 11.9.0 (>= 11.5.1), Node 24.14.0 (>= 22.14),
`dependencies` exactly `["commander"]`, `core.private === true`, tarball three files at 183.0 kB.

The plan's precondition reads *"09-01 is committed"*. It is not, and cannot be — this repository takes
no commits. The precondition's actual concern is that the manifest reaching the registry declares one
runtime dependency, and `npm publish` reads the working tree, not git. Verified on disk instead, which
is what the precondition was protecting.

Published, then restored:

```
+ @accord-dev/accord@0.0.0
npm install @accord-dev/accord@0.0.0  -> added 2 packages, found 0 vulnerabilities
node_modules/.bin/                    -> accord, accord.cmd, accord.ps1
accord --version                      -> 0.0.0
```

The trusted publisher was configured by the author with the four values recorded in
`09-VERIFICATION.md`. The token was not revoked — see Deviations.

### Task 4 — the phase evidence file

`.planning/phases/09-publish-and-dogfood/09-VERIFICATION.md`: three bootstrap sections filled, then the
seven Manual-Only rows in `09-VALIDATION.md`'s order. Six of the seven await later plans; the seventh
carries the outstanding token.

## FINDING F-2 — the bin warning is npm's wording, not a defect (RESOLVED, no change made)

`npm publish` emitted:

```
npm warn publish "bin[accord]" script name dist/cli.js was invalid and removed
npm warn publish Please run "npm pkg fix" to address these errors
```

Read literally that says the published package has no binary, which would make
`npx @accord-dev/accord` useless and would be a defect in 09-01's work that its local-tarball install
test had not caught.

It is not what happened. The registry manifest carries `"bin": {"accord": "dist/cli.js"}` — npm's
normaliser strips the leading `./` and re-adds the entry. Proven by installing the published version
from the public registry on Windows and getting all three shims (`accord`, `accord.cmd`, `accord.ps1`)
and a working `--version`.

No production code was changed. Per CLAUDE.md section 6 the manifest keeps `"./dist/cli.js"`; the cost
is one warning line per publish, and the alternative would edit a recorded decision plus the tests that
assert the string to buy nothing the registry does not already do for free.

## Deviations from Plan

**The bootstrap token was not revoked.** Task 3 step 3 and the fourth success criterion both require
it. The author reported the step complete; verification showed otherwise — `npm whoami` with that
token still returned `ngothanhluan`. Asked a second time, the author chose to retain it for now. The
plan's own verification (`npm token list no longer shows the bootstrap token`) therefore fails, and
this plan closes `partial`.

Consequences, both the author's call and both recorded in `09-VERIFICATION.md` section 7: the property
D-151 exists to produce — no long-lived registry credential — is not yet true, and the token string is
at rest in a session log on disk because it was pasted into the conversation.

**`09-VERIFICATION.md` section 7 does not use the word the other six rows use.** Task 4's acceptance
requires exactly six occurrences of that status word, and 09-06, 09-08, 09-09 and 09-10 each step that
count down by one. An unrevoked token in row 7 would have made it seven and broken the chain at its
first link. Row 7 says OUTSTANDING instead, which is also the more accurate word: the other six wait on
a later plan, row 7 waits on a person.

**`git status --porcelain packages/cli/package.json` is not empty.** The plan expects silence there.
It is not silent, because 09-01's uncommitted manifest change lives in that file. The check that
actually matters — that no trace of `0.0.0` and no reformatting survived — was run instead: `git diff`
on that file now shows exactly two changed lines, `dependencies` and `devDependencies`, which is 09-01's
change and nothing else.

## Observations

`npm pkg set version=0.0.0` does not edit one value. It reparses and rewrites the whole manifest in
expanded JSON, turning this repository's compact one-line objects (`"bin": { "accord": "./dist/cli.js" }`)
into four-line blocks. Setting the version back would have left that reformatting in place, and
`git checkout` was not available as an undo because the file carries 09-01's uncommitted work. The
manifest was restored by rewriting its text.

A brand-new package's packument index took roughly 150 seconds to become readable, while the
per-version endpoint answered immediately. `npm view` 404s in that window are propagation, not failure
— worth knowing before 09-06 reads the registry straight after publishing.

`dist.attestations` is `false` on `0.0.0`, correctly: it was published with a token. Provenance appears
on `0.1.0` under OIDC, and its absence here is not a finding.

## Requirement status

OPS-03 stays unticked. It reads *"Scoped package published via npm trusted publishing"*. `0.0.0` was
published with a granular token, which is the opposite of the mechanism the requirement names. OPS-03
becomes true in 09-06.

## Threat Flags

T-09-15 (bootstrap token privilege) is **not mitigated**. The mitigation this plan owned was revocation,
and it did not happen. The token is scoped to read and write on `@accord-dev` only, and was never placed
in an Actions secret.

T-09-16 (trusted-publisher spoofing) is mitigated as far as this plan can: the four field values are
recorded. They could not be independently read back.

T-09-17 (publishing before 09-01 lands) is mitigated: the pre-flight ran and passed before the publish.

T-09-18 (the temporary version edit) is mitigated: the manifest was restored and the diff verified to
contain only 09-01's two lines.

## Known Stubs

None.

## Self-Check: PARTIAL

- Scope confirmed ours, on the record — PASS
- `@accord-dev/accord@0.0.0` exists on the registry — PASS
- A trusted publisher configured against `publish.yml` with no environment — REPORTED, not verifiable here
- The bootstrap token revoked and the date written down — FAIL, deliberate
- `packages/cli/package.json` still says `0.1.0` — PASS
- `npm run check` — PASS, 900/900 across 38 files

## Blocker

None for 09-06, which needs the trusted publisher and a pushed `v0.1.0` tag, not the revocation.

The open item travels with the phase: `09-VERIFICATION.md` section 7 cannot be filled, and the phase
cannot close clean, until the token at npmjs.com -> Access Tokens is deleted and the date recorded.
