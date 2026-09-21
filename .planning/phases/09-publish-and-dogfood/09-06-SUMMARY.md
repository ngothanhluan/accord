---
phase: 09-publish-and-dogfood
plan: 06
subsystem: infra
tags: [npm, publishing, trusted-publishing, oidc, provenance, release]
status: complete

requires:
  - phase: 09-publish-and-dogfood
    provides: "09-04's publish.yml, whose filename is the npm trusted-publisher record's match key"
  - phase: 09-publish-and-dogfood
    provides: "09-05's 0.0.0 bootstrap, without which the package had no settings page to configure a publisher on"
provides:
  - "@accord-dev/accord@0.1.0 on the public registry, published from GitHub Actions over OIDC with no token"
  - "a SLSA v1 provenance attestation on that version, generated automatically rather than by a --provenance flag"
  - "proof that npx installs it on a runner with no checkout and no node_modules"
  - "the trusted-publisher record verified by use, which no registry API could confirm"
affects: [09-07 which installs this published package rather than a local build, 09-11 the 0.1.1 re-publish]

actuals:
  tasks: 4
  commits: 2        # 5a2eb4d (phase 9 waves 1-2, approved by the owner) and a4ea1e7 (the repository field)
  tags: 1           # v0.1.0, force-moved from 5a2eb4d to a4ea1e7 after the second failure
  runs: 3           # 35579914891 attempts 1 and 2 failed; 35581268150 published
  plan_head_before: 2a5040af51e33ee7cfe7db5c5a56024326ff8959
  plan_head_after: a4ea1e7

tech-stack:
  added: []
  patterns:
    - "a failed publish writes nothing to the registry, so the version stays free and the tag can be force-moved to a corrected commit at no cost"
    - "the sigstore transparency log is readable evidence: the signing certificate's SAN and GitHub OID extensions give the exact OIDC claims npm was asked to match, which is the only way to diff a trusted-publisher mismatch from outside npm"

key-files:
  created:
    - .planning/phases/09-publish-and-dogfood/09-06-SUMMARY.md
  modified:
    - packages/cli/package.json        # repository field added
    - .planning/phases/09-publish-and-dogfood/09-VERIFICATION.md   # sections 1 and 2 filled
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "The owner approved commit and push for the whole of phase 9 waves 1-2 (5a2eb4d), then the release tag. This is the first commit in this repository since 2a5040a and reverses the standing leave-it-uncommitted default for this phase only."
  - "v0.1.0 was force-moved rather than abandoned for 0.1.1. Nothing had ever fetched the tag and nothing was published under it, so the usual objection to moving a tag does not apply; 0.1.1 is already reserved by 09-11 for the README re-publish (D-157 step 3)."
  - "The repository field was added as an explicit fix after the registry named it, not pre-emptively. It was raised as an observation before the second run and confirmed as the cause by E422 afterwards."
  - "Which trusted-publisher field was wrong on the first attempt is deliberately NOT recorded. npm exposes no way to read the record back and the before state was never captured; guessing would put an unverifiable claim into the evidence file."
---

# 09-06: Publish 0.1.0 from a tag over OIDC

`@accord-dev/accord@0.1.0` is on the public registry, published by run 35581268150 from tag
`v0.1.0` on commit `a4ea1e7`, with a SLSA v1 provenance attestation and no token anywhere on the
path. `npx --yes @accord-dev/accord@0.1.0 --version` prints `0.1.0` on a runner with no checkout.
ROADMAP criterion 1 is met in full, including its clean-machine clause.

It took three runs.

## FINDING F-3: the published manifest declared no repository, and only provenance could catch it

`packages/cli/package.json` carried no `repository` field from 09-01 through 09-05. Nothing in
this repository caught it: no test asserts the manifest's key set, `npm pack` does not care, and
the 0.0.0 bootstrap published cleanly without it.

Under trusted publishing the registry does care. npm matches `repository.url` against the
repository sigstore attests to and rejects the upload when they differ:

```
npm error code E422
npm error 422 Unprocessable Entity - PUT https://registry.npmjs.org/@accord-dev%2faccord
  - Error verifying sigstore provenance bundle: Failed to validate repository information:
    package.json: "repository.url" is "", expected to match
    "https://github.com/ngothanhluan/accord" from provenance
```

Fixed in `a4ea1e7` by declaring the field. No other production code changed.

The general form is worth more than the fix: **a publish that skips provenance also skips every
check provenance turns on.** The 0.0.0 bootstrap was published with a token, which signs nothing,
so its success proved less about the real release path than it appeared to. D-151's bootstrap is
a permission-granting step, not a rehearsal.

## The first failure, and how the claim side was verified without npm's help

Attempt 1 failed `E403 - OIDC permission denied for this action` against the trusted-publisher
values 09-05 recorded as reported-by-author and explicitly not independently verifiable.

Rather than guess which of four fields was wrong, the claim side was read from the sigstore
transparency log. npm publishes the provenance statement *before* the registry rejects the upload,
so a failed publish still leaves a signing certificate, and that certificate carries the exact
OIDC claims:

```
SAN: https://github.com/ngothanhluan/accord/.github/workflows/publish.yml@refs/tags/v0.1.0
1.3.6.1.4.1.57264.1.5  -> ngothanhluan/accord
1.3.6.1.4.1.57264.1.6  -> refs/tags/v0.1.0
1.3.6.1.4.1.57264.1.22 -> public
issuer                 -> https://token.actions.githubusercontent.com
environment            -> (absent)
```

Every value matched the table in `09-VERIFICATION.md`, which located the fault on npm's side and
also ruled out the obvious alternative: the certificate exists at all, so `id-token: write` was
granted and the OIDC exchange worked. The owner corrected the configuration; the specific field is
not recorded, because it cannot be read back and was never captured before the change.

## Observations

- **Propagation is the number to watch.** The smoke job succeeded on attempt 10 of 12, roughly
  2m15s against a three-minute ceiling. 09-05 measured about 150s for the same effect on 0.0.0.
  Two observations, one shape — but the margin is thin enough that a slower day fails a release
  that published correctly.
- **Two failed publishes left two orphan provenance statements** in the public transparency log
  (logIndex 2905286169 and 2905293814), describing tarballs that were never accepted. Harmless,
  permanent, and worth knowing about before someone finds them and reads them as evidence of a
  publish that did not happen.
- **`gh run rerun` needs repository admin.** The active `gh` account was not the repository owner,
  which reads as a confusing permissions error rather than a wrong-account error.
- The `npm warn publish "bin[accord]" ... was invalid and removed` line appeared again, as 09-05
  established it would. Still not a defect; the registry manifest carries the bin and the binary
  runs.

## Self-Check

| Must-have | Verdict |
|---|---|
| 0.1.0 on the registry, published from Actions over OIDC, no token | PASS |
| Provenance attestation, generated automatically | PASS — `dist.attestations`, predicate `https://slsa.dev/provenance/v1` |
| `npx --yes` prints 0.1.0 on a machine with no checkout | PASS — attempt 10 |
| The tag names the exact commit that became the version | PASS — `v0.1.0` -> `a4ea1e7` |
| 09-VERIFICATION.md carries the run URL, publish log, and smoke attempt count | PASS — sections 1 and 2 |

Complete. Four `pending` rows remain in `09-VERIFICATION.md` for 09-08, 09-09 and 09-10, down from
six, and section 7's OUTSTANDING token revocation is untouched by this plan.
