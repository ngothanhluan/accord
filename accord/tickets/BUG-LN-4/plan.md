---
baseline: 382e1ef6d5cfe788820e1f9fcc726795a9837ccd
plan_hash: "fnv1a64:6a47279240fda0a7"
---

# Plan: BUG-LN-4

Review mode `outcome`: one branch, no slices.

Rules for every task:
- Commits carry no trailer of any kind (no Co-Authored-By, no Signed-off-by, no "Generated with" line).
- Build before every test run of `packages/cli/test/workflow-script.test.ts`: it imports `initFiles` from `@accord-dev/accord-core` (line 24), which resolves to the built `dist/index.js`, so an edit to `workflowYml` reaches no test until `npm run build` has run.
- The script lives in two places that must stay identical apart from the pin: `workflowYml` in `packages/core/src/scaffold/workflow.ts` (where every bash `${` is written `\${` inside the TypeScript template literal and the invocations are `${accord} ...`) and the `lint and gate` step of `.github/workflows/accord.yml` (plain `${`, invocations `npx --yes @accord-dev/accord@0.2.0 ...`). Every script change in a task goes into both, in the same commit. The bash below is written as it reads in `.github/workflows/accord.yml`.
- The emitted workflow text holds no backslash, no Actions expression in the `run:` body (T-07-11), no `gate ready` (D-140), and no other tool's name (`packages/core/test/scaffold.test.ts`).
- Kept byte for byte in the script: the `tickets=$(git diff --name-only --diff-filter=d "$BASE"...HEAD | grep -E '^accord/tickets/[^/]+[.]md$' || true)` line. The existing mutation probe replaces the first occurrence of `--name-only --diff-filter=d ` and of `'^accord/tickets/[^/]+[.]md$'`, so neither string may appear earlier in the script, comments included. `${accord} lint` stays the first `npx --yes <pkg>@<version> lint` (D-135 pin regex), and the text ` gate done ` stays.
- Kept unchanged: `fm_at`, `approved_at`, `lane_dropped`, the per-ticket loop and its two `not gating` lines and its lane line, the document around the step (trigger, permissions, checkout `fetch-depth` and `ref`, three steps, `env: BASE`, `shell: bash`). `approved_at` keeps deciding which tickets the per-ticket loop gates and whether a deletion counts as code (BUG-LN-3); the question "may this deleted ticket go without a drop" is answered by the new `protected_at` of Task 1 alone, so @ac-1's wider reading of approved (D-04, the lane key whose value is not on its key line) changes no gating decision, which the Intent puts out of scope.
- The fix line for a deleted ticket that is protected and not dropped is, for ticket `<t>`, exactly: `<t>: an approved or done ticket cannot be deleted before it is dropped - restore the file if this is the ticket's own branch, run accord drop <t>, merge the pull request of the drop/<t> branch it pushes, merge the default branch into this branch and push`. `accord drop` refuses on a branch where the file is gone and only pushes a `drop/<t>` branch, so every step is needed.
- "Deleted" includes renamed away: the deletion listing uses `--no-renames`, so a ticket file moved to another path is listed as deleted.
- Every existing test title in `packages/cli/test/workflow-script.test.ts` stays as it is, except the A-09 case Task 1 renames. A renamed id falls out of `accord/tests-baseline.txt`; the main session removes the A-09 line there (`packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-ticket-deleting-diff:-does-not-gate-the-ticket-the-pull-request-removes-(A-09)`). No task edits that file.
- New test titles hold no `@` and no comma. Cases in the describe `the emitted workflow script — executed` get ids `packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-<title with spaces as hyphens>`.
- Every new stub case a task adds is also a module-level `Case` that joins the `all` list of the replay test `the workflow of this repository gates the same tickets with the same exit as the emitted one`, so the two copies of the script are compared on it.

## Task 1: Reproduce the unguarded deletion and fail a deleted approved ticket that is not dropped

covers: @ac-1, @ac-2, D-01, D-02, D-03, D-04
files: packages/cli/test/workflow-script.test.ts, packages/core/src/scaffold/workflow.ts, .github/workflows/accord.yml
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-a-deleted-approved-ticket-not-dropped-at-the-base-fails-naming-the-ticket-and-accord-drop (@ac-1), packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-a-deleted-ticket-dropped-at-the-base-or-not-approved-there-passes-without-gate-done (@ac-2)

This is the failing reproduction and the wiring of the whole rule. At the baseline the script exits 0 when an accord-only pull request deletes an approved ticket, so the first test fails there; run it before the script change and see it fail.

**Test first**, in the describe `the emitted workflow script — executed`. Title: `a deleted approved ticket not dropped at the base fails naming the ticket and accord drop`. Its cases are a module-level `DELETED_APPROVED: Case[]`, each through its own `sandbox` (whose base already holds the approved `accord/tickets/OLD-1.md`):
1. `change` removes `accord/tickets/OLD-1.md`; nothing else changes.
2. `seed` writes OLD-1 as `APPROVED_TICKET` with its `approved_hash` value replaced by `""` ("whatever its value"); `change` removes it.
3. `seed` writes OLD-1 as a lane S ticket with an `ac_hash` key and no `approved_hash` (`---\nid: OLD-1\nstatus: open\nlane: S\nac_hash: "fnv1a64:0000000000000000"\n---\n\n## Understood\nx\n`); `change` removes it.
4. `change` removes OLD-1 and writes `src/app.ts` (`CODE`). This case fails if the deletion loop is put back behind the `has_code` guard.
5. A done ticket written before lanes (no lane key, an `ac_hash`, no `approved_hash`, D-04): `seed` writes OLD-1 as `---\nid: OLD-1\nstatus: open\nac_hash: "fnv1a64:0000000000000000"\n---\n\n## Intent\nold\n`; `change` removes it.
6. Verified ticks on a lane other than S, no `approved_hash` and no `ac_hash`: `seed` writes OLD-1 as `---\nid: OLD-1\nstatus: open\nlane: M\nverified: [ac-1]\n---\n\n## Intent\nold\n`; `change` removes it.
7. A lane key whose value is not on its key line: `seed` writes OLD-1 as `---\nid: OLD-1\nstatus: open\nlane: >-\n  S\nac_hash: "fnv1a64:0000000000000000"\n---\n\n## Understood\nx\n` (`fm_at` settles it: `lane: >-` is a key line and `  S` is indented); `change` removes it.
8. An unsettled read: `seed` writes OLD-1 as `FLOW_TICKET`; `change` removes it.
9. A rename: `change` removes `accord/tickets/OLD-1.md` and writes `accord/archive/OLD-1.md` with `APPROVED_TICKET`, the same bytes, so git pairs it as a rename; only `accord/` changes and no ticket file is added, so no gate runs.

Each: exit 1; `calls` is one entry ending in ` lint`; `out` contains `OLD-1: an approved or done ticket cannot be deleted before it is dropped`, `restore the file if this is the ticket's own branch`, `accord drop OLD-1`, `merge the pull request of the drop/OLD-1 branch it pushes` and `merge the default branch into this branch and push`; `out` does not contain `NOTHING_TO_GATE`. Cases 5, 6 and 7 read as unapproved under `approved_at`, so they fail if the deletion check calls `approved_at` instead of `protected_at`.

**Second test**: rework the existing case `ticket-deleting diff: does not gate the ticket the pull request removes (A-09)` into the title `a deleted ticket dropped at the base or not approved there passes without gate done`, with a module-level `DELETED_FREE: Case[]`. Each `seed` writes `accord/tickets/OLD-1.md` and each `change` removes it and changes nothing else:
1. `droppedText('status: dropped')` (approved and dropped with a reason).
2. `NO_KEY_TICKET` (open, not approved).
3. `DRAFT_TICKET` with `DRAFT-1` replaced by `OLD-1` (draft, not approved).
4. `NO_KEY_TICKET` with `status: open` replaced by `status: archived`.
5. `NO_KEY_TICKET`, and `seed` also writes `accord/tickets/OLD-1/plan.md` (`# Plan\n`); `change` removes the file and the folder (`rmSync(join(r, 'accord', 'tickets', 'OLD-1'), { recursive: true })`), so the ticket goes with its folder.
6. A block-scalar lane with no approval record (no `approved_hash`, no `ac_hash`, no `verified` key): `---\nid: OLD-1\nstatus: open\nlane: >-\n  M\n---\n\n## Intent\nold\n` (`fm_at` settles it, `approved_at` reads it as unapproved). This case fails if the lane-value-not-on-its-key-line check in `protected_at` runs before the `ac_hash` presence check.

Each: exit 0; `calls` is one entry ending in ` lint`, so no ` gate done ` ran; `out` contains `NOTHING_TO_GATE`.

Test helper changes:
- `NOTHING_TO_GATE` is read with `/echo "([^"]*nothing to gate)"/` instead of the first `echo "`, because the deletion lines below now come first in the script. Its guard case `is a multi-line script lifted from the emitted document, and bash resolved` keeps asserting it is non-empty.
- In the replay test, append `...DELETED_APPROVED, ...DELETED_FREE` to `all`, and also compare what each copy printed: `const said = (out: string): string[] => out.split('\n').filter((l) => l !== '' && !l.startsWith('npx stub'))`, then `expect(said(results[1].out)).toEqual(said(results[0].out))`. Raise that test's budget from `300_000` to `600_000`, since it runs about twice the sandboxes it ran.

**Script change**, in both copies:
- `is_dropped` takes a revision and a path: `fm_at "$1" "$2" || return 1`, the status grep as today, `text=$(git show "$1:$2") || return 1`, then the same `awk` program. Return 0 when dropped, 1 otherwise. Its caller in the per-ticket loop becomes `is_dropped HEAD "$file"`, which keeps that loop's behaviour.
- Add `protected_at`, defined after `approved_at`, with this comment and body (bracket expressions `[[]` and `[]]` stand for the brackets, because the emitted text holds no backslash):
```
          # Protected at revision $1 means deleting path $2 needs a drop first (D-01, D-04): an approved_hash key; a
          # verified key whose value is not []; an ac_hash key on lane S, with no lane key, or with a lane key whose
          # value is not on its key line. An unsettled read counts as protected.
          protected_at() {
            fm_at "$1" "$2"
            local rc=$?
            if [ "$rc" -eq 1 ]; then return 1; fi
            if [ "$rc" -ne 0 ]; then return 0; fi
            grep -Eq "^[[:space:]]*${qc}?approved_hash${qc}?[[:space:]]*:" <<< "$fm" && return 0
            if grep -Eq "^${qc}?verified${qc}?[[:space:]]*:" <<< "$fm" && ! grep -Eq "^${qc}?verified${qc}?[[:space:]]*:[[:space:]]*[[][[:space:]]*[]][[:space:]]*(#.*)?$" <<< "$fm"; then return 0; fi
            grep -Eq "^[[:space:]]*${qc}?ac_hash${qc}?[[:space:]]*:" <<< "$fm" || return 1
            grep -Eq "^${qc}?lane${qc}?[[:space:]]*:[[:space:]]*([|>][^#]*)?(#.*)?$" <<< "$fm" && return 0
            grep -Eq "^${qc}?lane${qc}?[[:space:]]*:" <<< "$fm" || return 0
            grep -Eq "^${qc}?lane${qc}?[[:space:]]*:[[:space:]]*${qc}?S${qc}?[[:space:]]*(#.*)?$" <<< "$fm"
          }
```
  A `verified:` key with any value other than `[]` (a flow list with an item, or an empty value followed by block items or by nothing) counts as ticked; that errs toward protection. The lane-value-not-on-its-key-line check runs only after the `ac_hash` presence check, so a block-scalar lane alone, with no `approved_hash`, no `ac_hash` and no ticks, leaves the ticket unprotected (D-02, DELETED_FREE case 6).
- The deletion block no longer sits inside `if [ "$has_code" -eq 0 ]`; it always runs. Inside the loop, for a path matching `^accord/tickets/[^/]+[.]md$`: `if approved_at "$BASE" "$old"; then has_code=1; fi` (BUG-LN-3's rule, kept as today); `protected_at "$BASE" "$old" || continue`; derive `gone_id=${old#accord/tickets/}` and `gone_id=${gone_id%.md}`; then `rc=0; is_dropped "$BASE" "$old" || rc=$?` (never a bare `is_dropped` statement, which `-e` would end the script on); when `rc` is not 0, `echo` the fix line of the shared rules with `$gone_id` for `<t>`, `deletion_failed=1`, `code=1`. Set `deletion_failed=0` before the block. A failing deletion listing keeps setting `has_code=1` as today.
- The no-ticket block (`if [ -z "$tickets" ]; then ... exit $code; fi`) moves below the deletion block, and prints `no ticket file changed in this pull request - nothing to gate` only when `deletion_failed` is 0: `if [ "$deletion_failed" -eq 0 ]; then echo "..."; fi`, then `exit $code`.
- Rewrite the comments that say deletion never fails: the one above `tickets=` says `--diff-filter=d` leaves deleted tickets out of the tickets to gate and the deletion check below decides whether a deletion may land (keep the `[^/]+` and `|| true` sentences); the one above the deletion block says an approved ticket deleted or renamed away counts as code, and a ticket protected at the base (`protected_at`) that is deleted or renamed away fails the check unless it is dropped at the base, while any other may be deleted (D-01, D-02, D-04). In `workflow.ts`, add one sentence to the header comment block (lines 26 to 29) saying a deleted ticket approved or done at the base fails the check unless its base version is dropped.

D-03: no code that refreshes an existing repository's workflow is touched.

Consumes: `BASE` from the step env and `git` on the checked-out branch. Produces: the same script interface (exit 0 or 1, lint output, gate output, skip lines), plus one fix line per deleted protected ticket not dropped at the base, and `protected_at`, which Tasks 2 and 4 rely on.

Done when both tests, every other case in the file (the three GATED rename cases now also exit 1, which their assertions allow), the mutation probe, and `packages/core/test/scaffold.test.ts` pass.

## Task 2: Name the swap, the unreadable dropped reason and the failing listing

covers: @ac-3, D-01
files: packages/cli/test/workflow-script.test.ts, packages/core/src/scaffold/workflow.ts, .github/workflows/accord.yml
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-a-swap-of-an-approved-ticket-for-an-unapproved-one-fails-naming-the-deleted-ticket-and-still-gates-the-new-one (@ac-3), packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:data-loss-a-deleted-ticket-dropped-at-the-base-with-a-reason-the-script-cannot-read-fails-naming-the-Dropped-reason-fix, packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:data-loss-a-failing-listing-of-deleted-files-fails-the-check-on-a-line-of-its-own

**Stub output marker first**, in `runScript`: the recording stub (not the `forward` one) prints `npx stub: <its arguments>` on stdout for every call, failing or not (`printf 'npx stub: %s\n' "$*"` after the log line and before the line that checks `ACCORD_STUB_FAIL`), so a test can assert a gate's result was printed. No existing assertion reads stub output.

**Tests first**, in the describe `the emitted workflow script — executed`:
1. `a swap of an approved ticket for an unapproved one fails naming the deleted ticket and still gates the new one`. Module-level `SWAP: Case[]` of two cases with the same `change`, which removes `accord/tickets/OLD-1.md` and writes `accord/tickets/NEW-3.md` as `DRAFT_TICKET` with `DRAFT-1` replaced by `NEW-3`; only `accord/` changes. The first case has no `fail` (the gate passes), the second `fail: 'NEW-3'` (the gate fails), so the gate's output is seen printed whatever its verdict. Each: exit 1; `out` contains `OLD-1: an approved or done ticket cannot be deleted before it is dropped` and `accord drop OLD-1`; `calls` has two entries, the second ending in ` gate done NEW-3`; `out` contains `'npx stub: ' + calls[1]`.
2. `risk:data-loss a deleted ticket dropped at the base with a reason the script cannot read fails naming the Dropped reason fix`. Module-level `UNREADABLE_REASON: Case`: `seed` writes OLD-1 as `droppedText('status: dropped')` with `superseded by NEW-2\n` replaced by `superseded by NEW-2\n<!-- note\nspanning lines -->\n` (a comment spanning lines, which `is_dropped`'s `awk` cannot settle); `change` removes it. Expect exit 1; `out` contains `OLD-1: dropped at the base but its ## Dropped reason cannot be read`; `out` does not contain `accord drop OLD-1` (that command refuses a ticket already dropped) and does not contain `NOTHING_TO_GATE`.
3. `risk:data-loss a failing listing of deleted files fails the check on a line of its own`. Add an optional `base?: string` to `Case`; the replay passes `base: c.base ?? s.base`. Module-level `BAD_BASE: Case` with `change` writing `docs/note.md` and `base: '0'.repeat(40)`, a commit the repository does not hold, so every diff fails. The test runs it with `runScript(repo, { base: '0'.repeat(40) })`. Expect exit 1; `out` contains `could not list the files this pull request deletes`; `out` does not contain `NOTHING_TO_GATE`.

Append `...SWAP`, `UNREADABLE_REASON` and `BAD_BASE` to the replay's `all`.

**Script change**, in both copies:
- `is_dropped` returns 2 when the status is dropped but the reason cannot be read: `text=$(git show "$1:$2") || return 2` and `awk ... <<< "$text" || return 2`. It still returns 1 when the frontmatter is absent or unsettled or the status is not dropped. The per-ticket loop reads only success, so its behaviour stays.
- In the deletion loop: when `rc` is 2, `echo "$gone_id: dropped at the base but its ## Dropped reason cannot be read - fix the ## Dropped reason on the default branch, then merge the default branch into this branch and push"`, `deletion_failed=1`, `code=1`; when `rc` is 1, the fix line from Task 1. Both run only after `protected_at "$BASE" "$old"` succeeded.
- When the deletion listing fails: keep `has_code=1`, and also `echo "could not list the files this pull request deletes - the check fails rather than let an approved ticket go unchecked"`, `deletion_failed=1`, `code=1`. Neither line contains `nothing to gate`.

Behaviour that must not change: Task 1's two tests and every case they and the replay hold.

Consumes: Task 1's deletion block and `deletion_failed`. Produces: three distinct deletion lines, one per cause.

Done when the three tests and every other case in the file pass.

## Task 3: Undo bash -e and run every script test under the CI flags

covers: @ac-4
files: packages/cli/test/workflow-script.test.ts, packages/core/src/scaffold/workflow.ts, .github/workflows/accord.yml
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-lint-and-a-gate-failing-together-under-the-CI-shell-flags-are-both-printed-and-the-check-fails (@ac-4), packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:regression-set-+e-is-what-keeps-lint-and-the-gates-running-after-a-bare-false-under-the-errexit-flag

**Test helper changes first**, in `runScript`:
- Start bash as GitHub starts a `shell: bash` step: `execFileSync(BASH, ['--noprofile', '--norc', '-eo', 'pipefail', 'script.sh'], options)`. `runScript` is the only place in the file that runs a workflow script, so every case runs under these flags, the existing `mutation probe: the deletion filter and the level bound are what cause those two results` and the probes of this task included. The `noBash` probe (`-c 'exit 0'`) runs no workflow script and stays.
- `ACCORD_STUB_FAIL` becomes a space-separated list of last arguments: the recording stub loops `for f in $ACCORD_STUB_FAIL; do if [ "$last" = "$f" ]; then printf 'npx stub failed: %s\n' "$*"; exit 1; fi; done` and exits 0 after the loop. Its default becomes `opts.fail ?? ''`. Every existing `fail` value is one word and keeps its meaning.

**Tests first**, in the describe `the emitted workflow script — executed`:
1. `lint and a gate failing together under the CI shell flags are both printed and the check fails`. Module-level `BOTH_FAIL: Case`: `change` writes `accord/tickets/SIGNUP-1.md` (`id: SIGNUP-1\n`), `accord/tickets/SIGNUP-2.md` (`id: SIGNUP-2\n`) and `src/app.ts` (`CODE`); `fail: 'lint SIGNUP-1'`. `git diff --name-only` lists SIGNUP-1 before SIGNUP-2, so SIGNUP-2 is gated after the failing gate. Expect exit 1; `calls` has three entries, ending in ` lint`, ` gate done SIGNUP-1` and ` gate done SIGNUP-2`; `out` contains `'npx stub failed: ' + calls[0]`, `'npx stub failed: ' + calls[1]` and `'npx stub: ' + calls[2]`. Then the flags probe in the same test: `runScript` on `sandbox((r) => write(r, 'docs/note.md', 'x\n'))` with `script: '[[ $- == *e* ]] && echo errexit-on\n[[ -o pipefail ]] && echo pipefail-on\nexit 0\n'`; expect `out` to contain `errexit-on` and `pipefail-on`. Because `runScript` is the only place that starts bash on a script, this probe shows the flags every case and probe of the file runs under. Append `BOTH_FAIL` to the replay's `all`.
2. `risk:regression set +e is what keeps lint and the gates running after a bare false under the errexit flag`. Build `withFalse = SCRIPT.replace('set -uo pipefail\n', 'set -uo pipefail\nfalse\n')` and `noUndo = withFalse.replace(/^set \+e$/m, '')`, each guarded with `expect(...).not.toBe(...)` against the text it was made from. Run both through `runScript` (`script: withFalse`, `script: noUndo`), so under the CI flags, on a sandbox shaped like `BOTH_FAIL` with no `fail`: `withFalse` gives exit 0 and three calls; `noUndo` gives a non-zero exit and zero calls. This test fails before the script change, because the script has no `set +e` line.

**Script change**, in both copies: replace the two comment lines that say the script is deliberately not -e and the `set -uo pipefail` line with
```
# GitHub runs this step as bash --noprofile --norc -eo pipefail, and -e would end the script at the first
# failing command. set +e undoes it, so lint and every gate are reported on one push and code collects the exit.
set +e
set -uo pipefail
```
`set +e` stands alone on its line, which is what the probe's `/^set \+e$/m` removes. `shell: bash` stays.

Behaviour that must not change: every existing case and the cases of Tasks 1 and 2 pass under the new flags, the real-CLI cases included.

Consumes: the stub marker from Task 2. Produces: a script that runs to its end under `-e`.

Done when the two tests, every other case in the file, and `packages/core/test/scaffold.test.ts` pass after `npm run build`.

## Task 4: Apply the deletion rule in the verify skill's local check

covers: D-01, D-04
files: packages/core/skills/verify/ci.md, packages/core/src/generated/skills.ts, .claude/skills/accord-verify/ci.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:data-loss-the-verify-skill-local-check-stops-on-a-deleted-approved-ticket-not-dropped-on-the-default-branch

Verify's Finish step 2 stands in for the CI check, so without this it reports green on a branch the check fails.

**Test first**, a top-level `it` in `packages/core/test/stage-skills.test.ts`, beside the other `risk:regression the verify skill ...` case. Title: `risk:data-loss the verify skill local check stops on a deleted approved ticket not dropped on the default branch`. Read `flatText('.claude/skills/accord-verify/ci.md')`, slice from `## Finish`, and expect it to contain `--diff-filter=D <def>...HEAD`, `` `approved_hash` ``, `` `ac_hash` ``, `` `verified` ``, ``no `lane` key``, `restore the file if this is the ticket's own branch`, `accord drop <t>`, `merge the pull request of the drop/<t> branch it pushes`, `merge the default branch into this branch and push`, `` `## Dropped` `` and `each such line is a failure: stop, nothing is pushed`, with `--diff-filter=D <def>...HEAD` before `Any failure: show it and stop`.

**Skill change**, in `packages/core/skills/verify/ci.md`, Finish step 2 only. After the sentence defining `<def>`, add: for every file `git diff --name-only --no-renames --diff-filter=D <def>...HEAD` lists as `accord/tickets/<t>.md` (a ticket renamed away is listed too), read its version at `<def>`. It is approved or done when its frontmatter has an `approved_hash` key; or a `` `verified` `` key whose value is not `[]`; or an `` `ac_hash` `` key with `lane: S`, with no `` `lane` `` key, or with a `lane` key whose value is not on its key line; a frontmatter it cannot read counts as approved. When it is approved or done and its `status` is not `dropped`, show "<t>: an approved or done ticket cannot be deleted before it is dropped - restore the file if this is the ticket's own branch, run accord drop <t>, merge the pull request of the drop/<t> branch it pushes, merge the default branch into this branch and push"; when it is approved or done, its `status` is `dropped` and its `` `## Dropped` `` section gives no reason it can read, show "<t>: fix the `## Dropped` reason on the default branch". Then: each such line is a failure: stop, nothing is pushed. When no `<def>` resolves, say the deletion check was not run. Keep every existing sentence of the step, in particular `` `accord gate done <t>` for every ticket file ``, `` `origin/master` ``, `` `accord gate done <id>` alone `` and `Any failure: show it and stop; nothing is pushed.`, which `ac-2 verify starts ci before the suite ...` asserts.

Then run, in this order: `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`. That rewrites `packages/core/src/generated/skills.ts` and `.claude/skills/accord-verify/ci.md`; commit both with the source.

Behaviour that must not change: Start and Wait of `ci.md`, and every phrase `ac-2 verify starts ci before the suite and shows the owners report only after every check finished` asserts.

Consumes: the deletion rule Tasks 1 and 2 put in the script. Produces: a verify Finish step that stops on the same deletions the CI check fails.

Done when the new test, `packages/core/test/stage-skills.test.ts`, `packages/core/test/skills.test.ts` (drift and marker cases) and `packages/cli/test/skills-sync.test.ts` pass.
