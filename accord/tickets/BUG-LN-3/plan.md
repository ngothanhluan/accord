---
baseline: 3a7bdb8a77b0ea067b3a2ab925d1dd9f6d49a4d7
plan_hash: "fnv1a64:fa5e64536a886c4a"
---

# Plan: BUG-LN-3

Review mode `outcome`: one branch, no slices.

Rules for every task:
- Commits carry no trailer of any kind (no Co-Authored-By, no Signed-off-by). The owner is the only author of every commit.
- Every existing test title in `packages/cli/test/workflow-script.test.ts` and `packages/core/test/scaffold.test.ts` stays exactly as it is, and no existing case is wrapped in `describe.each`. A renamed id falls out of `accord/tests-baseline.txt` and fails `gate.test-untraced`.
- New test titles hold no `@` and no comma.
- The emitted workflow text holds no backslash (`scaffold.test.ts`, "no backslash in any path or any emitted line (D-51)"), no Actions expression in the `run:` body (T-07-11), no `gate ready` (D-140), and no other tool's name ("finds no denied name in the config, the workflow, or the pointer block"). Backslashes in the TypeScript source (`\${` inside the template literal) are fine, since they do not reach the emitted text.
- Test id prefixes: cases in the describe `the emitted workflow script — executed` get ids `packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-<title with spaces as hyphens>`. Cases in `the emitted workflow script — against the real CLI` get `packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-against-the-real-CLI->-<title>`.

## Task 1: Reproduce the draft-backlog failure and skip unapproved tickets in an accord-only diff

covers: @ac-1, D-01, D-03
files: packages/cli/test/workflow-script.test.ts, packages/core/src/scaffold/workflow.ts
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-unapproved-tickets-in-an-accord-only-diff:-lint-runs-and-no-gate-done-runs-and-the-exit-follows-lint (@ac-1)

This is the failing reproduction (PR #28: only draft tickets, and the script gated each one) and the wiring of the whole rule. Run it at the baseline first and see it fail, because the current script calls `gate done` on every ticket it finds.

**Test first**, in the describe `the emitted workflow script — executed` of `packages/cli/test/workflow-script.test.ts`. Title: `unapproved tickets in an accord-only diff: lint runs and no gate done runs and the exit follows lint`.

Test helper changes in the same file:
- `sandbox(change, seed?)` takes an optional second callback `seed(repo)` that runs after the base files are written and before the base `commitAll`, so a case can put its own tickets into the base commit. Callers that pass no seed behave as they do today.
- The base `accord/tickets/OLD-1.md` becomes an approved ticket with frontmatter: `---\nid: OLD-1\nstatus: open\napproved_hash: "fnv1a64:0000000000000000"\n---\n\n## Intent\nold\n`. That way the mutation probe's deletion case (`noFilter` gates OLD-1) gates because the base is approved, not because of the fail-closed read. The approach asks for this explicitly.
- In the three cases `ticket-adding diff: ...`, `a failing gate exits 1 ...` and `a failing lint exits 1 ...`, the `change` callback also writes `src/app.ts` (`export const a = 1;\n`), so each still gates SIGNUP-1 because of the code rule. Their titles and assertions do not change.
- Put the ticket texts the new cases use in module-level constants, so Tasks 2 and 3 reuse them: a draft ticket built from the shape of the real template, with a commented `# approved_hash:` line and no `approved_hash` key; an approved ticket; and the variants Tasks 2 and 3 add.

Cases inside the one test. Each case gets its own `sandbox` and only `accord/` paths change:
1. Add two new draft tickets `accord/tickets/ST-8.md` and `accord/tickets/ST-9.md`, the PR #28 shape. Expect exit 0, `calls` equal to one entry ending in ` lint`, and no call containing ` gate done `.
2. Edit a draft ticket that is a draft in both versions. `seed` writes `accord/tickets/DRAFT-1.md` as a draft, and `change` edits its body. Expect the same as case 1.
3. Case 1 again with `fail: 'lint'`. Expect exit 1, one call, and that call is lint.

**Script change**, in `workflowYml` in `packages/core/src/scaffold/workflow.ts`, inside the `run: |` body:
- After the `tickets=$(...)` line and the no-ticket `if` block, before the loop, set a code flag `has_code=0`. Then: `if ! changed=$(git -c core.quotePath=false diff --name-only --no-renames "$BASE"...HEAD); then has_code=1; else outside=$(grep -v '^accord/' <<< "$changed" || true); [ -n "$outside" ] && has_code=1; fi`. Deletions count as code because there is no diff filter here. A failing diff counts as code, which fails closed.
- Add a shell function that prints the frontmatter of `"$file"` at a revision `$1`. Return 0 when it found a block, 1 when the path is absent at that revision, and 2 when it cannot settle the read. Absent: `git ls-tree --name-only "$1" -- "$file"` succeeds with empty output. Unsettled: `ls-tree` or `git show "$1:$file"` fails, or the text has no closing `---`. Hold the `git show` output in a variable and read it with `awk` through a here-string, never a pipeline (pipefail plus SIGPIPE returns 141 on a large file). The first line matches `---[[:space:]]*$` with no `^`, so a BOM is absorbed and `[[:space:]]` absorbs a CR. The block ends at the first line after it matching `^---[[:space:]]*$`. Assign `fm=$(...)` and read `$?` on its own line, never `local fm=$(...)`, because `local` masks the status.
- Approved: in either version, a block line matches `"^[[:space:]]*${qc}?approved_hash${qc}?[[:space:]]*:"` with `grep -Eq ... <<< "$fm"`. Build the quote class with no backslash by joining a double-quoted and a single-quoted bash segment: `qc="['"'"]'`, which yields `['"]`. A commented `# approved_hash:` line does not match, because `#` is neither space nor quote. A version that returned 2 counts as approved.
- Per ticket in the loop, after `id` is derived: if `has_code` is 0 and the ticket is not approved (HEAD and `$BASE` both checked, D-03), print one line such as `echo "not gating $id - not approved and this pull request changes nothing outside accord/"` and `continue`. Otherwise run `${accord} gate done "$id" || code=1` as today.

Behaviour that must not change in `workflow.ts`:
- `lint` still runs first, and its failure still sets `code=1` without stopping.
- The `tickets=$(git diff --name-only --diff-filter=d "$BASE"...HEAD | grep -E '^accord/tickets/[^/]+[.]md$' || true)` line stays byte for byte. The mutation probe replaces the first occurrence of `--name-only --diff-filter=d ` and of `'^accord/tickets/[^/]+[.]md$'`, so neither string may appear earlier in the script, comments included.
- The no-ticket `echo "no ticket file changed in this pull request - nothing to gate"` stays the first `echo "` in the script, because the test lifts `NOTHING_TO_GATE` from the first match.
- `${accord} lint` stays the first `npx --yes <pkg>@<version> lint` (D-135 pin regex), and the text ` gate done ` stays.
- The rest of the document: trigger, permissions, checkout `fetch-depth` and `ref`, the step count of 3, and `env: BASE`.

Consumes: `BASE` from the step env, and `git` in the checked-out branch. Produces: the same script interface (exit 0 or 1, lint output, then gate output), plus one skip line per ticket that is not gated.

Done when the new test, every existing case in the file, and `packages/core/test/scaffold.test.ts` pass. Run `npm run build` before the real-CLI cases.

## Task 2: Skip a dropped ticket in an accord-only diff, and prove a missing reason fails through lint

covers: @ac-2, D-02
files: packages/cli/test/workflow-script.test.ts, packages/core/src/scaffold/workflow.ts
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-against-the-real-CLI->-dropped-ticket-in-an-accord-only-diff:-no-gate-done-on-it-and-a-missing-Dropped-reason-fails-through-lint (@ac-2)

**Test first**, in the describe `the emitted workflow script — against the real CLI`. It goes there because it needs `exampleRepo` and the real `lint`. Title: `dropped ticket in an accord-only diff: no gate done on it and a missing Dropped reason fails through lint`.

Cases inside the one test:
1. Stub, using the top-level `sandbox`. The base OLD-1 is approved (Task 1). `change` rewrites OLD-1 with `approved_hash` kept and the status line `status: "dropped"   # superseded by NEW-2` followed by a CR (`\r\n` line end in that line only), plus a `## Dropped` section with a reason. Expect exit 0, one call (lint), and no ` gate done ` call.
2. Stub, same as case 1 with the status line written `status:	dropped ` (a tab before the value and a trailing space). Expect the same.
3. Real CLI (`exampleRepo`, `forward: true`). `change` rewrites `accord/tickets/SIGNUP-1.md` with `status: dropped`, an added `approved_hash: "fnv1a64:0000000000000000"` line, and a `## Dropped` section holding one line of reason. Expect exit 0, `calls.length` 1, and the output not containing `a dropped ticket needs a "## Dropped" section saying why` (the reason text of `lint.dropped-reason` in `packages/core/src/lint/dropped.ts`).
4. Real CLI, same as case 3 but with no `## Dropped` section. Expect exit 1, `calls.length` 1 (lint only, no gate done), and the output containing that reason text.
5. Real CLI, same as case 3 but `## Dropped` holds only an HTML comment. Expect the same as case 4.

**Script change**: in the per-ticket decision from Task 1, a ticket is also skipped when `has_code` is 0 and its HEAD frontmatter (return 0 only, never an unsettled read) has a line matching `"^status[[:space:]]*:[[:space:]]*${qc}?dropped${qc}?[[:space:]]*(#.*)?$"`. The match is anchored at column 0, so a nested `status:` under another key cannot mark a ticket dropped. `[[:space:]]` absorbs tabs and a trailing CR, and `(#.*)?` absorbs a comment. A dropped ticket is skipped whether or not it is approved, and an unsettled base read does not stop the skip. Print a skip line such as `echo "not gating $id - dropped and this pull request changes nothing outside accord/"`.

Behaviour that must not change: everything listed in Task 1, and lint still runs and is still what enforces the `## Dropped` reason. The script does not check the section itself.

Consumes: the frontmatter function and `has_code` from Task 1. Produces: the dropped skip.

## Task 3: Gate every ticket when the diff carries code or the ticket is approved

covers: @ac-3, D-02, D-03
files: packages/cli/test/workflow-script.test.ts, packages/core/src/scaffold/workflow.ts
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-code-in-the-diff-or-an-approved-ticket:-gate-done-runs-and-its-failure-fails-the-job (@ac-3), packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:parsing-BOM-and-CRLF-frontmatter-and-unreadable-blocks-and-large-files-read-as-approved

**Tests first**, both in the describe `the emitted workflow script — executed`. Neither should need a script change after Tasks 1 and 2. If one fails, fix the script in `workflow.ts` within the rule of Tasks 1 and 2, and keep everything Task 1 lists as unchanged.

Title `code-in-the-diff...` in full: `code in the diff or an approved ticket: gate done runs and its failure fails the job`. Cases, each expecting lint first and then exactly one call ending ` gate done <id>`:
1. A new draft ticket ST-8 plus `src/app.ts`. Gated.
2. OLD-1 rewritten as dropped with a reason, plus `src/app.ts`. Gated: with code in the diff, the dropped skip does not apply.
3. A deletion outside `accord/` (`docs/readme.md` removed) plus a new draft ST-8. Gated, because the deletion counts as code.
4. Accord-only: a new ticket NEW-1 whose HEAD frontmatter has `approved_hash`. Gated.
5. Accord-only: OLD-1, approved in the base, rewritten in HEAD with the `approved_hash` line removed. Gated (D-03).
6. Case 5 with `fail: 'OLD-1'`. Exit 1.

Title `risk:parsing...` in full: `risk:parsing BOM and CRLF frontmatter and unreadable blocks and large files read as approved`. Every case is accord-only, and each expects the ticket gated:
1. `seed` writes OLD-1 approved with a UTF-8 BOM and CRLF line ends throughout. `change` removes `approved_hash` in HEAD.
2. `seed` writes a ticket whose `---` block never closes. `change` edits it into a draft (an unsettled base counts as approved).
3. A new ticket with `approved_hash` near the top of its frontmatter and a body of about 2 MB. This guards the pipefail and SIGPIPE regression.

Interface: tests only, consuming `sandbox`, `runScript` and the ticket constants from Task 1.

## Task 4: Give this repository's workflow the same rule, and prove both scripts agree

covers: @ac-4, D-01
files: packages/cli/test/workflow-script.test.ts, .github/workflows/accord.yml, packages/core/src/scaffold/workflow.ts
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-the-workflow-of-this-repository-gates-the-same-tickets-with-the-same-exit-as-the-emitted-one (@ac-4)

**Test first**, in the describe `the emitted workflow script — executed`. Title: `the workflow of this repository gates the same tickets with the same exit as the emitted one`.
- Lift this repository's script with no re-typing. Read `fileURLToPath(new URL('../../../.github/workflows/accord.yml', import.meta.url))`, `parse` it, and take the `run` of the one step whose `name` is `lint and gate`, asserting exactly one such step.
- Run every stub case of Tasks 1, 2 (cases 1 and 2) and 3 through both `SCRIPT` and the lifted script with `runScript(repo, { base, script, fail })`, using a fresh sandbox per run. To do that, move those cases' `change`, `seed` and `fail` into one module-level array. Iterate it inside this single test with a plain loop, not `describe.each` or `it.each`, and leave the existing cases where they are. Change the tests of Tasks 1 to 3 so each reads its own cases from that array by plain loop, keeping their titles and assertions. That way the @ac-4 fixtures are the @ac-1 to @ac-3 fixtures.
- For each case, assert equal exit codes, and equal lists of the text after `gate done ` in the calls. The pins differ, so compare ids, not whole lines.
- Run it at this point and see it fail on the first draft case, because `.github/workflows/accord.yml` still has the old script.

**Change** `.github/workflows/accord.yml`: replace the `run: |` body of the `lint and gate` step with the script `workflowYml` now emits. The only difference is that this file keeps the literal pin `npx --yes @accord-dev/accord@0.1.0` where the generator interpolates `${accord}`. Bash `${...}` expansions are written without the TypeScript `\` escapes. Steps `npm ci`, `npm run build`, `npm rebuild` and `full suite (tests.full)`, the checkout `with:` block, and `env: BASE` stay as they are.

**Change** the header comment of `packages/core/src/scaffold/workflow.ts`: add one paragraph saying that `gate done` is skipped for a ticket only when the diff changes nothing outside `accord/` and the ticket is unapproved in both its HEAD and base versions, or dropped in HEAD. Say that any read the script cannot settle counts as approved, and that `.github/workflows/accord.yml` carries the same script and must be changed with it. The emitted text does not change in this step.

Consumes: the finished script from Tasks 1 to 3. Produces: a test that fails whenever the two scripts drift on these cases.

Done when the whole of `packages/cli/test/workflow-script.test.ts` and `packages/core/test/scaffold.test.ts` pass after `npm run build`.
