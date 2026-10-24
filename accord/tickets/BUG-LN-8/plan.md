---
baseline: 67bb1d06ca5082513f9645c812914b38885902ae
plan_hash: "fnv1a64:76ce16bbd8056343"
---

# Plan: BUG-LN-8

Review mode `outcome`: one branch, no slices.

Rules for every task:
- Commits carry no trailer of any kind (no Co-Authored-By, no Signed-off-by, no "Generated with" line). Commits a test makes use `commitMsg` from `packages/cli/test/helpers/repo.ts` (`-F <file> --cleanup=verbatim`).
- The two existing test titles in `packages/cli/test/upgrade.test.ts` stay exactly as they are, and so do their assertions. A renamed id falls out of `accord/tests-baseline.txt`.
- New test titles hold no `@` and no comma. They are top-level `it(...)` calls, like the two existing ones, so the id is `packages/cli/test/upgrade.test.ts#<title with spaces as hyphens>`.
- `upgrade.ts` imports from `@accord-dev/accord-core`, which resolves to the built `dist/`. Run `npm run build` after every change under `packages/core/src/` and before running the tests.
- Core stays pure: `repin.ts` imports `yaml` (already a core dependency, see `packages/core/src/load/yaml.ts`) and nothing from `node:`.
- The three stdout lines of `accord upgrade` (`branch: ...`, `base: ...`, `title: ...`) never change. Every warning goes to `ctx.stderr`.
- Every test reads the upgraded workflow from the pushed branch, never from a checkout: `gitRun(c.remote, 'show', \`upgrade/${v}:.github/workflows/accord.yml\`)` (its output is not trimmed). A checkout under `core.autocrlf=true` turns LF into CRLF on Windows (see `packages/cli/test/worktree.test.ts` line 2107).

## Task 1: Reproduce the stale step on a 0.1.0 install and splice the fresh step in

covers: @ac-1, D-01
files: packages/cli/test/fixtures/workflow-0.1.0.yml (new), packages/cli/test/upgrade.test.ts, packages/core/src/scaffold/repin.ts, packages/core/src/index.ts, packages/cli/src/commands/upgrade.ts
verify: packages/cli/test/upgrade.test.ts#ac-1-upgrade-replaces-the-lint-and-gate-step-of-a-0.1.0-workflow-with-the-step-accord-init-writes-now (@ac-1)

This is the failing reproduction and the wiring of the whole fix. Write the fixture and the test first, run them at the baseline, and see the test fail: today's upgrade only repins, so the 0.1.0 script stays.

**Fixture.** Render `packages/cli/test/fixtures/workflow-0.1.0.yml` from the release tag: take `workflowYml` out of `git show v0.1.0:packages/core/src/scaffold/workflow.ts` and evaluate it with `pkgName` `@accord-dev/accord` and `version` `0.1.0` (for example by saving that source to a scratch `.ts` file outside the repository and running it with `npx tsx`, or by hand, as long as the bytes are the function's output). Commit it LF with one trailing newline; `.gitattributes` (`* text=auto eol=lf`) keeps it LF. Check that it holds exactly one step whose `name` is `lint and gate`.

**Test first**, in `packages/cli/test/upgrade.test.ts`, title `ac-1 upgrade replaces the lint and gate step of a 0.1.0 workflow with the step accord init writes now`. Follow the setup of the existing `ac-3` test (lines 19-33): `makeClone()`, push to `clones`, `o = c.otherClone()`, write `accord/config.yml` with its `accord:` line set to `accord: "0.1.0"` and `.github/workflows/accord.yml` set to the fixture text (read with `readFileSync(fileURLToPath(new URL('./fixtures/workflow-0.1.0.yml', import.meta.url)), 'utf8')`), `commitMsg`, push `main`. Do not write `.claude/settings.json`. Run `run(['upgrade'], c.root)`. Assert:
- exit 0, and stdout equal to `branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`;
- stderr does not contain `was not refreshed`;
- the workflow text on `upgrade/${v}`, read with `gitRun(c.remote, 'show', \`upgrade/${v}:.github/workflows/accord.yml\`)`, equals `expected`, built in the test without the code under test: `const fresh = initFiles({ name, version: v }).find((f) => f.path === '.github/workflows/accord.yml')!.text; const cut = '      - name: lint and gate\n';` then `expected = fixture.slice(0, fixture.indexOf(cut)) + fresh.slice(fresh.indexOf(cut))`, after asserting both `indexOf` results are not -1. The step is the last thing in both documents, so when 0.1.0 wrote the same lines before the step, `expected` is the whole of `fresh`; also assert `expected === fresh` when `fixture.slice(0, fixture.indexOf(cut)) === fresh.slice(0, fresh.indexOf(cut))`.
- the workflow holds exactly one step named `lint and gate` when parsed with `parse` from `yaml` (the same reading `workflow-script.test.ts` line 457 uses).

**Core function**, in `packages/core/src/scaffold/repin.ts`, beside `repinWorkflow`:

```ts
export type StepRefresh = { text: string } | { refused: 'count' | 'shape' };
/** The workflow with its one step named `lint and gate` replaced by the step `workflowYml(name, version)` writes. */
export function refreshLintStep(text: string, name: string, version: string): StepRefresh
```

Export `refreshLintStep` and the type `StepRefresh` from `packages/core/src/index.ts` on the line that exports `repinConfig, repinWorkflow`. Import `workflowYml` from `./workflow.js`.

Steps, all inside one `try` whose `catch` returns `{ refused: 'shape' }`:
1. Parse `text` with `parseDocument(text, { schema: 'core', customTags: stringNumerics, lineCounter })` (`stringNumerics` from `../load/yaml.js`). Any entry in `doc.errors` gives `{ refused: 'shape' }`.
2. Count on `doc.toJS()`: for every key of `jobs` whose value has a `steps` array, every element that is an object whose `name` is exactly the string `lint and gate`. An alias reuse counts once per occurrence, as `toJS` expands it. A count other than 1 gives `{ refused: 'count' }`. Remember the job key and the index of the one match.
3. Take the AST node with `doc.getIn(['jobs', job, 'steps', index], true)`. It must be a block map (`isMap(node) && !node.flow`), with no `anchor`, and the path must reach it (an alias on the way gives undefined). Otherwise `{ refused: 'shape' }`.
4. The old span: the start line is the line holding `node.range[0]`; that line must match `/^( *)- +/` with the match ending exactly at `node.range[0]`'s column, so the map starts on the dash line; otherwise `{ refused: 'shape' }`. The old indent is the length of the captured spaces. The end line is the line of the last non-whitespace character in `text.slice(node.range[0], node.range[1])`. The span is whole lines, start line to end line, without the end line's line break.
5. The fresh span: parse `workflowYml(name, version)` the same way and cut the span of its one `lint and gate` step by the same rule. Its indent is 6.
6. Shift every non-empty line of the fresh span by `oldIndent - 6` spaces (add or remove leading spaces); an empty line stays empty. If the old text holds `\r\n`, join the fresh lines with `\r\n`, else with `\n`.
7. Replace the old span with the shifted fresh span; every byte before the start line and after the end line's text is kept as it is.
8. Guard: parse the result the same way. It must have no errors, and `JSON.stringify(result.toJS())` must equal `JSON.stringify` of the old `toJS()` with `jobs[job].steps[index]` swapped for the fresh step's `toJS()` value. Otherwise `{ refused: 'shape' }`. On success return `{ text: result }`.

**Wiring**, in `packages/cli/src/commands/upgrade.ts` line 64: when the workflow exists, call `refreshLintStep(workflow, pkg.name, v)`; repin `'text' in r ? r.text : workflow` with `repinWorkflow(..., pkg.name, pinned, v)` and push that write. Keep the result in a variable for the warnings Task 3 adds. On a refusal the write is exactly today's repin.

Behaviour that must not change:
- `repinWorkflow` and `repinConfig` keep their signatures and output; `packages/core/test/scaffold.test.ts` stays green untouched.
- In `upgrade.ts`: the refusals and their messages, the config repin, the hooks plan, the lint check, the skill, agent and plugin writes, the temporary-index commit, the push, and the three stdout lines. No workflow on the default branch still writes nothing for it.
- The existing `ac-3 upgrade pushes a branch ...` test still passes: its 0.0.9 workflow gets the same step at `v` and every `@0.0.9` is gone.

Consumes: the workflow text from the default branch, `pkg.name`, the pinned and running versions. Produces: `refreshLintStep` in core, and an upgrade commit whose workflow carries the fresh step.

Done when the new test and both existing tests in `packages/cli/test/upgrade.test.ts`, and `packages/core/test/scaffold.test.ts`, pass after `npm run build`.

## Task 2: Prove every line outside the step survives

covers: @ac-2, D-01
files: packages/cli/test/upgrade.test.ts, packages/core/src/scaffold/repin.ts
verify: packages/cli/test/upgrade.test.ts#ac-2-upgrade-replaces-only-the-lint-and-gate-step-and-keeps-every-other-line-of-the-workflow (@ac-2)

**Test first**, title `ac-2 upgrade replaces only the lint and gate step and keeps every other line of the workflow`. It should pass on Task 1's code; if a case fails, fix `refreshLintStep` within Task 1's steps, keeping the guard.

Base text: `init09 = initFiles({ name, version: '0.0.9' }).find((f) => f.path === '.github/workflows/accord.yml')!.text`, and config pinned `accord: "0.0.9"`. Build the team's workflow `team` from `init09` by plain string edits:
- the hand edit: insert `        working-directory: app\n` right after the step's `        shell: bash\n` line;
- after the end of the file (the step's last line): `      # team note about the step\n\n      - name: team check\n        run: echo team\n  extra:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npx --yes ${name}@0.0.9 lint\n`.

`expectedTeam` is `team` with the `        working-directory: app\n` line removed and every `${name}@0.0.9` replaced by `${name}@${v}`. That is right because the 0.0.9 step and the current step differ only in the pin.

Cases, each a fresh `makeClone()` (or the same clone with `gitRun(o, 'push', '-q', 'origin', '--delete', \`upgrade/${v}\`)` between runs, as the existing refusal test does), each expecting exit 0, the unchanged stdout, stderr without `was not refreshed`, and the workflow on `upgrade/${v}`, read with `gitRun(c.remote, 'show', \`upgrade/${v}:.github/workflows/accord.yml\`)`, equal to the expected text:
1. `team` gives `expectedTeam`.
2. CRLF: `team` with every `\n` turned into `\r\n` gives `expectedTeam` with the same change. Write a `.gitattributes` holding `* -text\n` in the same commit so the CR bytes survive `git add -A` under `core.autocrlf=true`.
3. Other indent: `team` with the `steps:` list of job `accord` written two spaces shallower: every non-empty line from the first `      - uses:` line up to, not including, the `  extra:` line loses two leading spaces (the team comment and the `team check` step included, so they stay in the same list). The `extra` job is not touched. Expected: `expectedTeam` with the same two spaces removed from the same lines.

Behaviour that must not change: everything Task 1 lists, and Task 1's test.

Consumes: `refreshLintStep` through `accord upgrade`. Produces: the @ac-2 proof.

## Task 3: Warn on stderr when the step was not refreshed, and name the step in the generator's header

covers: @ac-3, D-02
files: packages/cli/test/upgrade.test.ts, packages/cli/src/commands/upgrade.ts, packages/core/src/scaffold/workflow.ts
verify: packages/cli/test/upgrade.test.ts#ac-3-a-workflow-with-no-or-two-lint-and-gate-steps-is-only-repinned-and-upgrade-warns-on-stderr (@ac-3), packages/cli/test/upgrade.test.ts#risk:complex-branching-an-anchored-or-flow-lint-and-gate-step-is-only-repinned-and-the-warning-says-it-must-be-a-block-list-item, packages/cli/test/upgrade.test.ts#risk:complex-branching-a-step-that-was-not-refreshed-still-gets-its-warning-when-the-push-fails

**Tests first.** The first two start from `init09` and a config pinned `0.0.9`, as in Task 2, and for every case expect exit 0, the unchanged stdout, and the workflow on `upgrade/${v}` (read with `gitRun(c.remote, 'show', \`upgrade/${v}:.github/workflows/accord.yml\`)`) equal to the input with every `${name}@0.0.9` replaced by `${name}@${v}` and nothing else changed. Delete `upgrade/${v}` on origin between cases as Task 2 says.

`ac-3 a workflow with no or two lint and gate steps is only repinned and upgrade warns on stderr`, cases:
1. No step: `init09` with `- name: lint and gate` replaced by `- name: lint`.
2. Two steps: `init09` followed by a job `  extra:\n    runs-on: ubuntu-latest\n    steps:\n` plus the whole `lint and gate` step of `init09` (cut from `      - name: lint and gate\n` to the end).
Each expects stderr to contain `.github/workflows/accord.yml`, `lint-and-gate script`, `was not refreshed`, and `leave exactly one step named lint and gate and run accord upgrade again`.

`risk:complex-branching an anchored or flow lint and gate step is only repinned and the warning says it must be a block list item`, cases:
1. Anchored: `init09` with `      - name: lint and gate\n` replaced by `      - &lint\n        name: lint and gate\n`.
2. Flow: `init09` with the step cut from `      - name: lint and gate\n` to the end and replaced by `      - { name: lint and gate, run: npx --yes ${name}@0.0.9 lint }\n`.
Each of these two expects stderr to contain `.github/workflows/accord.yml`, `was not refreshed`, and `must be a block list item without an anchor`.
3. Broken alias, which only the whole-document guard (Task 1 step 8) catches: `init09` with the step's `        env:\n` line replaced by `        env: &base\n`, followed by a team step `      - name: team step\n        env: *base\n        run: echo team\n` appended after the end of the file. The count is 1 and the step map is a block map without its own anchor, so steps 1 to 7 pass; the splice drops `&base`, the re-parse has no errors, and only `toJS()` throws on the unresolved `*base` (`node_modules/yaml/dist/nodes/Alias.js` lines 55-57), which the `catch` turns into `{ refused: 'shape' }`. Expects the workflow equal to the input repinned only (as above, so `&base` and `*base` are both still there) and stderr to contain `was not refreshed`.

`risk:complex-branching a step that was not refreshed still gets its warning when the push fails`: start from `init09` with `- name: lint and gate` replaced by `- name: lint` (the `count` refusal) and a config pinned `0.0.9`, pushed to `main` as above. Make origin refuse the push the way `packages/cli/test/drop.test.ts` lines 177-179 do: `const hook = \`${c.remote}/hooks/pre-receive\`; writeFileSync(hook, '#!/bin/sh\nexit 1\n'); chmodSync(hook, 0o755);` (add `chmodSync` and `rmSync` to the `node:fs` import). Run `run(['upgrade'], c.root)` and expect exit 2, stdout empty, `r.err` containing `the push failed`, `was not refreshed` and `leave exactly one step named lint and gate`, and `gitRun(c.remote, 'for-each-ref', 'refs/heads/upgrade')` equal to `''`. Remove the hook with `rmSync(hook)` at the end.

**Change** `packages/cli/src/commands/upgrade.ts`: right after Task 1's refresh, build `warning`, a string or undefined. It is undefined when the workflow is absent or was refreshed. On a refusal, with `RERUN` = `` `run accord upgrade again before merging upgrade/${v} (close its pull request, delete the branch with git push origin --delete upgrade/${v}, and fix the step on ${short} first); otherwise the refresh waits for the next release` ``:
- `count`: `` `warning: the lint-and-gate script in ${WORKFLOW} was not refreshed: leave exactly one step named lint and gate and ${RERUN}` ``
- `shape`: `` `warning: the lint-and-gate script in ${WORKFLOW} was not refreshed: the step named lint and gate must be a block list item without an anchor, as accord init writes it; make it one and ${RERUN}` ``

Use it in two places, both after the push attempt:
- In the push `catch` (lines 94-97), when `warning` is set, the `UsageError` message is today's message followed by `\n` and `warning`. When it is undefined the message is exactly today's.
- After the stdout write and before `return 0`, when `warning` is set, write `warning + '\n'` to `ctx.stderr`.

No line is written when the workflow is absent or was refreshed.

**Change** the header comment of `packages/core/src/scaffold/workflow.ts`: add one paragraph saying that `accord upgrade` finds the step by its name `lint and gate` (`refreshLintStep` in `scaffold/repin.ts`) and replaces it with the step this function writes, so renaming the step stops upgrades from refreshing the script in every repository that ran `accord init`. The emitted text does not change.

Behaviour that must not change: everything Task 1 lists, except that the push-failure message gains the warning on a refusal; that message is byte for byte today's when the step was refreshed or the workflow is absent; the emitted workflow text byte for byte (`packages/core/test/scaffold.test.ts` and `packages/cli/test/workflow-script.test.ts` stay green); stdout stays the same three lines in every case that exits 0.

Consumes: the `StepRefresh` result kept in Task 1. Produces: the two warnings, on stderr after a successful push and inside the push-failure message after a failed one.

Done when all of `packages/cli/test/upgrade.test.ts`, `packages/cli/test/workflow-script.test.ts` and `packages/core/test/scaffold.test.ts` pass after `npm run build`.
