---
phase: 09-publish-and-dogfood
plan: 02
subsystem: scaffold
tags: [github-actions, checkout, gate-done, scaffold-template, D-162]

requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "the emitted `.github/workflows/accord.yml` and its parse-based scaffold test (D-136, D-137, D-140)"
  - phase: 04-gates
    provides: "`tickStaleCommit` and `staleReview`, the two rules the default checkout was making fire"
provides:
  - "the workflow `accord init` writes checks out the pull request's head sha, not GitHub's synthetic merge commit"
  - "a test that fails if the `ref:` key is removed, changed, or joined by a third `with:` key"
affects: [09-07 init from the published package, 09-09 the one real pull request, 09-11 the 0.1.1 sweep]

actuals:
  tokens: 1151      # chars/4 over the realized diff (4602 chars across 2 files); estimate was 30000
  tasks: 2
  commits: 0        # repository forbids commits; all work left uncommitted in the working tree
  plan_head_before: 2a5040af51e33ee7cfe7db5c5a56024326ff8959

tech-stack:
  added: []
  patterns:
    - "an Actions expression goes under `with:` (a mapping the runner evaluates) or in `env:`, never in a `run:` body"
    - "the split-literal delimiter `'$' + '{{'` so a test file carries no sequence the T-07-11 case forbids"

key-files:
  created:
    - .planning/phases/09-publish-and-dogfood/09-02-SUMMARY.md
  modified:
    - packages/core/src/scaffold/workflow.ts
    - packages/core/test/scaffold.test.ts

key-decisions:
  - "The new assertion is a sibling `it` rather than an extension of the T-07-14 case: the existing comment is about shallow-checkout depth and D-162 is about which commit, so one comment could not name both failure modes in the house voice."
  - "The JSDoc's T-07-11 paragraph was rewritten, not just appended to. It asserted `the one GitHub Actions expression in this document sits in env: and nowhere else`, which the new key makes false; the invariant that actually matters — none in a `run:` body — is now what it states."
  - "The header paragraph was added as a new block, not folded into the existing `two things this document deliberately does NOT carry` list, per the plan: that list is an inventory of absences and this key is present."

patterns-established: []

requirements-completed: []   # OPS-04 deliberately NOT ticked — see "Requirement status" below

coverage:
  - id: D1
    description: "The emitted checkout names the pull request's head sha, and the `with:` block has exactly two keys so a third cannot be added silently"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#checks out the head of the pull request, not the merge commit (D-162)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`fetch-depth: 0` survives the change as the number 0, so `$BASE...HEAD` still resolves under an explicit ref"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#checks out deep enough for its own diff (T-07-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No `run:` body in the emitted document carries an Actions expression delimiter after the second expression is added (T-09-04)"
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#carries no Actions expression in any script body (T-07-11)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-21
status: complete
---

# Phase 9 Plan 2: The Emitted Checkout Names the Branch Summary

**The workflow `accord init` writes now checks out `github.event.pull_request.head.sha`, so `gate done` gates the commit the author actually wrote instead of a synthetic merge commit nobody wrote — one `with:` key, one sibling test case that pins both keys by count, and a header paragraph so the next reader does not re-derive D-162.**

## Performance

- **Duration:** 4 min
- **Tasks:** 2 of 2 executed
- **Commits:** 0 — this repository forbids them; all work is uncommitted in the working tree

## Accomplishments

### Task 2 first, because RED comes first

The plan lists the source change as Task 1 and the assertion as Task 2, but both are `tdd="true"`
and the executor's contract is RED before GREEN. The assertion was written and run against the
unchanged generator, where it failed for the right reason, and only then was the generator changed.

`packages/core/test/scaffold.test.ts` gained a sibling `it` directly below
`checks out deep enough for its own diff (T-07-14)`:

- `steps[0].with?.ref` equals the head-sha expression, built as `'$' + '{{'` plus the rest, so this
  file still contains no raw delimiter — the convention line 249 already uses for the same reason.
- `Object.keys(steps[0].with ?? {})` has length 2, a shape assertion rather than a lookup, for the
  reason the `permissions` case gives for `toEqual`: a third `with:` key that moves the checkout
  somewhere else has to fail a case instead of slipping past one.

`expect(steps).toHaveLength(3)` and `expect(steps[0].with?.['fetch-depth']).toBe(0)` are untouched.
No golden was regenerated because none pins this document — `packages/core/test/__golden__/` holds
only `*.snapshot.json`, `*.lint.json`, `*.done.json` and `*.status.json`.

### Task 1 — the key, and the two comments that make it survive a reader

`packages/core/src/scaffold/workflow.ts`:

- `ref: \${{ github.event.pull_request.head.sha }}` added beside `fetch-depth: 0`, backslash-escaped
  in the source literal exactly as the existing `BASE: \${{ ... base.sha }}` at the `env:` key is.
  `fetch-depth: 0` and its comment are byte-identical to before.
- A comment above the new key in the house voice, naming the failure mode rather than the line:
  checkout lands on the synthetic merge commit, which nobody wrote, so the stale-tick and
  stale-review rules both fail a review that is not stale — then the positive form, that the review
  must be of the code being gated, and that is the branch.
- A paragraph in the file-header block recording the same reasoning with the `cli/src/load/fs.ts`
  reference, kept out of the "two things this document deliberately does NOT carry" list.
- The JSDoc's T-07-11 paragraph rewritten. It claimed the document's *one* expression sits in `env:`
  and nowhere else; there are now two, and the invariant worth stating is that neither is in a
  `run:` body. It now says that, and names `head.sha` alongside `base.sha` as attacker-influenced.

## RED → GREEN evidence

No commits were made, so the discipline was kept by ordering and by recording the output.

**RED — the assertion against the unchanged generator:**

```
FAIL |core| test/scaffold.test.ts > initFiles — the CI workflow it plans (CLI-02) > checks out the head of the pull request, not the merge commit (D-162)
AssertionError: expected undefined to be '${{ github.event.pull_request.head.sh…' // Object.is equality
- Expected: "${{ github.event.pull_request.head.sha }}"
+ Received: undefined
 ❯ test/scaffold.test.ts:246:32
 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
```

`undefined`, not a wrong string — the key was absent, which is the defect D-162 describes.

**GREEN — after the generator change:**

```
 Test Files  1 passed (1)
      Tests  37 passed (37)
```

## must_haves truths — each verified by a command that was run

| Truth | Command | Result |
|---|---|---|
| The workflow `accord init` emits checks out the pull request's head commit, not the synthetic merge commit (D-162) | `npm test -- --project core scaffold --reporter=verbose` | `✓ ... > checks out the head of the pull request, not the merge commit (D-162)` — the case parses the document `initFiles(PKG)` returns and reads `steps[0].with.ref`; it was `undefined` before the change and equals `${{ github.event.pull_request.head.sha }}` after |
| The emitted document still carries no Actions expression in any `run:` body after a second expression is added under `with:` | same run | `✓ ... > carries no Actions expression in any script body (T-07-11)` — scans every step's `run:` for the delimiter. This is T-09-04's mitigation and it is green |
| The emitted checkout still carries `fetch-depth: 0`, so `$BASE...HEAD` still resolves | same run | `✓ ... > checks out deep enough for its own diff (T-07-14)` — `toBe(0)` on the number, unchanged, and the sibling case pins the `with:` key count at exactly 2 |

Supporting runs, all on the working tree with both changes in place:

```
npm run lint       → eslint ., clean, exit 0
npm run typecheck  → tsc -p packages/core && tsc -p packages/core/tsconfig.test.json && tsc -p packages/cli, clean, exit 0
npm test -- --project core scaffold → 37 passed (37)
```

Two acceptance criteria checked directly rather than through a test:

```
grep -n '\${{' packages/core/test/scaffold.test.ts   → no match (exit 1)
grep -n 'head.sha' packages/core/src/scaffold/workflow.ts → 65:          ref: \${{ github.event.pull_request.head.sha }}
```

The first is the acceptance criterion that this test file carries no raw delimiter outside a
concatenated literal. The second confirms the backslash escape is in the source literal, and the
still-green `no backslash in any path or any emitted line (D-51)` case confirms none reaches the
emitted document.

## Deviations from Plan

**1. Task order inverted — Task 2's assertion written before Task 1's source change.**
Both tasks carry `tdd="true"` and the orchestrator's instruction replaces the RED *commit* with RED
*ordering plus recorded output*. Writing the generator first would have made the assertion green on
arrival and proved nothing. No content changed; only the sequence.

**2. The JSDoc's T-07-11 paragraph was edited, which the plan did not list.**
The plan said "change nothing else in the emitted document" — this is a source comment, not emitted
text — and asked for a header paragraph. The T-07-11 paragraph asserted a fact ("the one GitHub
Actions expression in this document sits in `env:` and nowhere else") that the new key makes false.
Leaving a false invariant beside the code it describes is worse than the omission it would have been,
so it was restated to the invariant that still holds and still matters: none in a `run:` body.
Rule 2 (correctness), applied to a comment rather than to code.

Nothing else. `packages/cli/test/workflow-script.test.ts` was not opened and not run, per the plan's
acceptance criteria — it builds its subject from `packages/core/dist/`, which this plan does not
build, so running it here would assert the pre-D-162 bundle. It runs for real in 09-06 Task 1.
Nothing was built: no `npm run build`, no `npm pack`, no test that reads either `dist/`.

## Known Stubs

None. The change is one YAML key in a template literal and two assertions; no placeholder value, no
empty data source, no TODO was introduced. No `.planning/WINDOWS.md` entry was appended — nothing in
this plan is a stub, a skipped test, or an unrun `<verify>`. The one check the plan drops
(`--project cli workflow-script`) is deferred with a named owner in 09-06, not a broken window.

## Threat Flags

None. The change introduces no new network endpoint, auth path, file access pattern, or schema
change. The two surfaces it does touch were pre-registered in the plan's own threat model:
T-09-04 (expression placement) is mitigated and green, and T-09-05 (checking out a fork head sha) is
an accepted risk recorded there — the emitted workflow's only `run:` body executes
`npx --yes <pinned>@<pinned>` and no script from the checked-out tree, under
`permissions: { contents: read }`.

## Requirement status

**OPS-04 is not ticked.** It reads *"One real ticket passes Ready and Done on a coding agent, with a
fresh-context review's `verification.md` and the developer's `verified` ticks; time from
`new ticket` to Ready recorded."* This plan removes a structural obstacle to that happening on a
pull request; it does not carry a ticket through either gate. 09-08 and 09-09 do. The plan's own
objective records the limit in the same words: this change does **not** on its own make a
pull-request-carried ticket pass `gate done` — see `09-08-PLAN.md` Task 1.

## Self-Check: PASSED

```
[ -f packages/core/src/scaffold/workflow.ts ]                                   → FOUND
[ -f packages/core/test/scaffold.test.ts ]                                      → FOUND
[ -f .planning/phases/09-publish-and-dogfood/09-02-SUMMARY.md ]                 → FOUND
git rev-parse HEAD                                                              → 2a5040af51e33ee7cfe7db5c5a56024326ff8959, unchanged
```

No commit hashes to verify: `commits: 0` is correct and deliberate, and the two source files carry
the changes in the working tree. `git diff --numstat` reports `17/4` on the generator and `12/0` on
the test — the whole of this plan's footprint.
