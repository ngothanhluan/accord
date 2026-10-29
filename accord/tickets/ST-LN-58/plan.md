---
baseline: a4cec8fa436452eac27103e2b2cf94a9886b7538
plan_hash: "fnv1a64:4a7175847055433d"
---

# Plan: ST-LN-58

Review mode: outcome. One branch, no slices.

Rules for every task:
- After changing any file under `packages/core/skills/`, run `npm run gen`, then `npm run build`, then
  `node packages/cli/dist/cli.js skills sync`, in that order (conventions.md). This rewrites
  `packages/core/src/generated/skills.ts` and the `.claude/skills/...` copies the task lists. This repository
  renders for the `claude` runtime only, so there is no `.agents/skills/` folder to update.
- A rendered SKILL.md stays within 5120 bytes and 120 lines (`packages/core/test/skills.test.ts`). When an edit
  does not fit, first re-wrap the lines of the paragraphs and list items you touched, up to 118 characters,
  changing no word. If it still does not fit, apply only the wording cut the task names. If it still does not fit
  after that, stop with `BLOCKED` and give the byte count. Never cut other wording, because the owner ruled that
  shortening must never lose a point (ledger Ruling, ST-LN-33).
- A phrase that a test in `packages/core/test/stage-skills.test.ts` asserts on the raw text (the `REQUIRED`
  table) stays on one line. When re-wrapping splits one, move the line break. Do not change the test.
- Test names hold no `@` and no comma. Each new test is a top-level `it` (or `it.skipIf`), outside any `describe`,
  so its case id is `<file>#<name with spaces as ->`.
- Tests of other tickets that this ticket supersedes keep their names and lose only the superseded assertions.
  The main session (not a task) adds a pointer line to `accord/tickets/ST-LN-31/ledger.md` and
  `accord/tickets/ST-LN-62/ledger.md` that names those assertions and this ticket.

## Task 1: The five SKILL.md mentions and the check that every reference file is named

covers: @ac-1, @ac-2, @ac-3, D-01, D-02, D-05
files: packages/core/test/skills.test.ts, packages/core/skills/accord/SKILL.md, packages/core/skills/debug/SKILL.md, packages/core/skills/verify/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord-debug/SKILL.md, .claude/skills/accord-verify/SKILL.md
verify: packages/core/test/skills.test.ts#ac-1-every-reference-file-of-a-rendered-skill-is-named-in-its-own-SKILL.md (@ac-1), packages/core/test/skills.test.ts#ac-2-the-check-fails-on-a-skill-folder-holding-a-file-its-SKILL.md-does-not-name (@ac-2), packages/core/test/skills.test.ts#ac-3-each-new-mention-names-the-step-or-event-at-which-to-read-its-file-and-every-SKILL.md-stays-within-the-caps (@ac-3)

This task covers D-05 part 1 (the five mentions and the test).

Consumes: `skillTargets(config)` and the `SkillFile` type (`{ path, text }`), both exported from
`packages/core/src/index.ts`. The test file's existing `config(over)` helper is also used. Produces two helpers in
`packages/core/test/skills.test.ts` and five new sentences in three source SKILL.md files.

Write the tests first. They fail until the sentences exist.

Helpers, placed after the existing `dirOf` and `baseOf` helpers:
- `unnamedReferences(files: SkillFile[]): string[]`. Group the files by skill folder, which is the first three
  path segments (for example `.claude/skills/accord-debug`). Return one line per problem:
  - a path with more than four segments: `<folder>: holds a subfolder (<rest of the path>)`;
  - a folder with no `SKILL.md`: `<folder>: has no SKILL.md`;
  - each other file whose name does not appear in that folder's SKILL.md text as `./<name>`:
    `<folder>: <name> is not named as ./<name> in its SKILL.md`.
- `expectEveryReferenceNamed(files: SkillFile[])`, which runs `const found = unnamedReferences(files);` and then
  `expect(found, found.join('\n')).toEqual([])`. The custom message puts every offender into the thrown error's
  `message`. Without it, the message would show only a truncated array.
- `const ALL_RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];`
- `const ROSTERS = [config({ runtimes: ALL_RUNTIMES }), config({ roles: ['ba', 'dev'], runtimes: ALL_RUNTIMES })].map(skillTargets);`
  This is the full roster and the ba and dev roster, both for every runtime.

Tests (top level, after the `render output invariants` describe):
1. `ac-1 every reference file of a rendered skill is named in its own SKILL.md`. For each element of `ROSTERS`:
   assert it is not empty; for each of `.claude/skills` and `.agents/skills`, assert the paths `<dir>/accord/finish.md`,
   `<dir>/accord-debug/worktree.md`, `<dir>/accord-debug/ids.md`, `<dir>/accord-verify/worktree.md` and
   `<dir>/accord-verify/ids.md` are present (this guards against a vacuous pass); then call
   `expectEveryReferenceNamed(files)`.
2. `ac-2 the check fails on a skill folder holding a file its SKILL.md does not name`. Build an in-memory folder:
   `.claude/skills/accord-debug/SKILL.md` with text ``Read `./failure.md`.``, plus `.claude/skills/accord-debug/failure.md`
   and `.claude/skills/accord-debug/worktree.md` with any text. Catch the error from `expectEveryReferenceNamed` on
   it (`catch (e)`, then read the message as `(e as Error).message`, since the test files typecheck under strict
   mode). Assert an error was thrown, its message contains `.claude/skills/accord-debug` and `worktree.md`, and it does
   not contain `failure.md is not named`. As a guard, add `./worktree.md` to that SKILL.md text and assert the call
   no longer throws. Also assert that `unnamedReferences` on a list that adds
   `.claude/skills/accord-debug/sub/x.md` returns a line containing `holds a subfolder`.
3. `ac-3 each new mention names the step or event at which to read its file and every SKILL.md stays within the caps`.
   Write `sentenceWith(text, needle)`: flatten whitespace to single spaces, take `i = flat.indexOf(needle)`
   (assert `i > -1`), and return the text from just after the last `'. '` before `i` to the next `'. '` after `i`
   (or the end of the text). For each rendered SKILL.md under both `.claude/skills` and `.agents/skills` of the
   first `ROSTERS` element, assert the following. Each needle is given whole in the fenced block below, one per
   line, and ends exactly where the line ends (the first two end on a comma, as in the fixed sentences).
   - in `accord/SKILL.md`, the sentence with `./finish.md` contains needle A;
   - in `accord-debug/SKILL.md`, the sentence with `./worktree.md` contains needle B and the sentence with
     `./ids.md` contains needle C;
   - in `accord-verify/SKILL.md`, the sentence with `./worktree.md` contains needle B and the sentence with
     `./ids.md` contains needle D;
   - none of the five sentences matches `/\b(?:when|if|as) (?:needed|necessary|required)\b/i`.
   ```
   A: step 6 of `./lane-s.md`,
   B: When `./failure.md` runs `accord worktree open`,
   C: at step 7
   D: at step 5
   ```
   The `A: `, `B: `, `C: ` and `D: ` prefixes are labels, not part of the needles.
   Then, for every `SKILL.md` in every element of `ROSTERS`, assert that its UTF-8 byte length is at most
   `MAX_SKILL_BYTES` and that its `split('\n').length` is at most `MAX_SKILL_LINES`, with the path as the message.

Skill text: add these five sentences, word for word, each as its own sentence.
- `packages/core/skills/accord/SKILL.md`, in the New request `- **S.**` bullet, directly after
  ``Then follow `./lane-s.md`.`` and before ``A request that carries``:
  ``At step 6 of `./lane-s.md`, report the finish as `./finish.md` says.``
- `packages/core/skills/debug/SKILL.md`, step 1, after ``For a failure found after verify, read `./failure.md`.``:
  ``When `./failure.md` runs `accord worktree open`, follow `./worktree.md`.``
- `packages/core/skills/debug/SKILL.md`, step 7, after ``and ask the owner, with what was tried.``:
  ``An answer at step 7 that changes the ticket's type follows `./ids.md`.``
- `packages/core/skills/verify/SKILL.md`, step 4, after ``a failed check goes to `./failure.md` instead of this report.``:
  ``When `./failure.md` runs `accord worktree open`, follow `./worktree.md`.``
- `packages/core/skills/verify/SKILL.md`, step 5, at the end of the last bullet, after ``it is never ticked past.``:
  ``An answer at step 5 that changes the ticket's type follows `./ids.md`.``

`accord-verify` has about 72 bytes left. To fit it, first re-wrap verify's numbered steps and bullets up to 118
characters, changing no word. A continuation line indented 3 or 5 spaces costs that many bytes. If it still does
not fit, the one wording cut allowed is in step 6: ``the notice that the review file has no author yet is expected and no reason to commit earlier``
becomes ``the review file's no-author notice is expected and no reason to commit earlier``.

Behaviour that must not change: every other sentence of the three SKILL.md files keeps its words. The
`stage-skills.test.ts` phrases for accord, debug and verify still pass, for example
``For a failure found after verify, read `./failure.md`.``, ``7. Report the finish as `./finish.md` says.``, and
``a failed check goes to `./failure.md` instead of this report``. All existing `skills.test.ts` cases still pass,
including the relative-reference, first-command, cap and backslash cases. The source `loads:` lists do not change.

Run `npm run gen`, `npm run build` and `node packages/cli/dist/cli.js skills sync`. Then run
`npx vitest run packages/core/test/skills.test.ts packages/core/test/stage-skills.test.ts`, then `npm run typecheck`
and `npm run lint`.

## Task 2: A move to lane S changes the lane M ticket in place

covers: @ac-4, D-03, D-04, D-05
files: packages/core/test/stage-skills.test.ts, packages/core/test/lane-s.test.ts, packages/core/skills/accord/ids.md, packages/core/skills/accord/lane-s.md, packages/core/skills/accord/worktree.md, packages/core/skills/accord/SKILL.md, packages/core/skills/intent/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/ids.md, .claude/skills/accord/lane-s.md, .claude/skills/accord/worktree.md, .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-intent/ids.md, .claude/skills/accord-debug/ids.md, .claude/skills/accord-debug/worktree.md, .claude/skills/accord-verify/ids.md, .claude/skills/accord-verify/worktree.md
verify: packages/core/test/stage-skills.test.ts#ac-4-a-lane-M-ticket-moved-to-lane-S-at-intent-is-changed-in-place-and-no-skill-drops-it-or-hands-it-off (@ac-4), packages/core/test/stage-skills.test.ts#risk:data-loss-the-move-to-lane-S-carries-Vetoes-Decisions-and-Corrections-into-the-new-lane-S-ticket

This task covers D-04 and D-05 part 2, and removes the drop path from the skills (D-05 part 4, skills half).
D-03 is cited only because the ticket names it. D-04 withdrew it, and this task does not act on it.

Consumes: the rendered skill output, `skillTargets(config)`. In `stage-skills.test.ts` the module-level `config` is
roles ba and dev with runtime claude. For the new test, also render
`{ ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] }` and the same with
`roles: ['ba', 'dev', 'designer']`. Produces the in-place move text in `ids.md` and removes the hand-off from four
skill files.

Write the test first: `ac-4 a lane M ticket moved to lane S at intent is changed in place and no skill drops it or hands it off`
in `packages/core/test/stage-skills.test.ts`, top level. Flatten each text with `.replace(/\s+/g, ' ')`. Over
every rendered file of both renders above:
- For every rendered `ids.md` (in accord, accord-intent, accord-debug and accord-verify, under each skill
  directory), find the heading line in the raw text: `const at = text.indexOf('\n## Moving to lane S\n')`, assert
  `at > -1`, and take `move` = `text.slice(at)` flattened. This anchors `move` on the heading line itself, so a
  mention of the heading elsewhere in the file never starts the slice; the section runs to the end of the file.
  Assert `move` contains each of the substrings in the fenced block below, one per line. Each needle is the whole
  line, ends exactly where the line ends, and holds no line break of its own:
  ```
  on the owner's yes
  keeps its id, branch and worktree, and this same session goes on with it
  an unchecked `- [ ]` item
  an uncommented `approved_hash:` line
  git log --full-history -G '^approved_hash:' --format=%h <origin's default branch>..HEAD -- accord/tickets/<id>.md
  git commit -m "intent: <id> before the move to lane S"
  replace the `lane:` line with `lane: "S"`,
  replace the `## Intent`, `## Acceptance criteria`, `## Open questions` and `## Approach` sections, headings included, with `## Understood` and `## Done when`,
  written from the intent interview already held, with no new interview
  `## Scope`, written as step 1 of the accord skill's lane S steps says
  Keep `## Vetoes`, `## Decisions` and `## Corrections` verbatim, and every other frontmatter key as it is
  git push -u origin <claim branch>
  go on at its Continue step 2 in this same session
  the lane S steps go on from step 1 on the same id, branch and worktree
  ```
  Assert that the index in `move` of `before the move to lane S` is less than that of `lane: "S"`, and that the
  index of `lane: "S"` is less than that of `git push -u origin <claim branch>`. Assert `move` contains none of
  `accord drop`, `accord new ticket`, `new session`, `new id`, `Title:`, `Keys:`.
- In every rendered file, assert that none of these substrings appears: `moved from <id>`, ``Title: …``,
  ``Keys: …``, ``carried `Keys:` ``, ``carried `## Vetoes` ``, `Understood: <one line>`,
  ``carries `Understood: …` ``, `from a drop`, `lane S without asking again`, `--reason "moved to lane S"`.
- In every rendered file, split the text on blank lines (`/\n\s*\n/`). Every paragraph whose flattened text
  contains `to lane S` contains none of `accord drop`, `accord new ticket`, `new session`. Collect the offenders
  as `path: paragraph start` and assert the list is empty.
- `accord/SKILL.md` contains `A lane never drops once its intent is approved` and
  ``to lane S in place, as `./ids.md` says``. `accord-intent/SKILL.md` contains `propose moving it to lane S` and
  ``Move it only on the owner's yes, as `## Moving to lane S` in `./ids.md` says``, and does not contain `Drop it`.
  `accord/lane-s.md` contains ``When `## Understood` and `## Done when` in `accord/tickets/<id>.md` each hold a line, keep them``.

Skill text:
- `packages/core/skills/accord/ids.md`: change the H1 to `# Ticket ids, people, dropping, and moving to lane S`,
  and replace the opening line (``Read this when config.yml has `people`. Register only when `people` exists, never create it.``) with:
  ```
  `## Assigning` and the two sections after it apply when config.yml has `people`; register only when `people` exists,
  never create it. The section on dropping applies whenever a ticket's type changes, and the last section when the
  intent interview moves a lane M ticket to lane S.
  ```
  The opening line holds neither the `## Dropping instead of renaming` heading text nor the `## Moving to lane S` one. `lane-s.test.ts` line 138 takes
  `ids.slice(ids.indexOf('## Moving to lane S'))` on the flattened file; with this wording the first match is the
  heading itself, so that line stays as it is and its kept needles (`` `git status --porcelain --untracked-files=all` ``,
  `commit only those records`, `` `git add -A` ``) and its `not.toContain('commit every change')` check read the new
  section only.
  Replace the whole `## Moving to lane S` section with:
  ```
  ## Moving to lane S

  Only during the intent interview of a lane M ticket, on the owner's yes, as `accord-intent` says. The ticket keeps its
  id, branch and worktree, and this same session goes on with it.

  1. Refuse the move, say why and that the ticket stays lane M, and stop, when `## Open questions` holds an unchecked
     `- [ ]` item, when the ticket's frontmatter holds an uncommented `approved_hash:` line, or when
     `git log --full-history -G '^approved_hash:' --format=%h <origin's default branch>..HEAD -- accord/tickets/<id>.md`
     prints a commit.
  2. In the ticket's worktree, run `git status --porcelain --untracked-files=all`. When it lists a path other than
     `accord/tickets/<id>.md` and paths under `accord/tickets/<id>/`, do not move: name those paths, say the ticket
     stays lane M, and stop. Otherwise commit only those records: run `git add -A`, which that check limits to them,
     and `git commit -m "intent: <id> before the move to lane S"` when anything is staged.
  3. In `accord/tickets/<id>.md`, replace the `lane:` line with `lane: "S"`, and replace the `## Intent`,
     `## Acceptance criteria`, `## Open questions` and `## Approach` sections, headings included, with `## Understood`
     and `## Done when`, one line each, written from the intent interview already held, with no new interview, then
     `## Scope`, written as step 1 of the accord skill's lane S steps says. Keep `## Vetoes`, `## Decisions` and
     `## Corrections` verbatim, and every other frontmatter key as it is.
  4. Commit the ticket file with `git commit -m "intent: <id> moved to lane S" -- accord/tickets/<id>.md`, push with
     `git push -u origin <claim branch>`, then load the accord skill and go on at its Continue step 2 in this same
     session, where the anchor prints `Lane: S` and the lane S steps go on from step 1 on the same id, branch and
     worktree.
  ```
  `ids.md` is rendered into folders without `lane-s.md` (accord-intent, accord-debug, accord-verify). So it names
  no `./` file. Its list names no `accord <command>`, because `skills.test.ts` fails a paragraph that names an
  accord command beside `## Open questions`.
- `packages/core/skills/accord/SKILL.md`: in the `- **S.**` bullet, delete the sentence
  ``A request that carries `Understood: …` and `Done when: …` from a drop is lane S without asking again; the scout still runs first and its files still go under `## Scope`.``
  Keep Task 1's `./finish.md` sentence. Replace the first Rules bullet with:
  ``- A lane only rises, except that the intent interview may move a lane M ticket whose intent is not approved to lane S in place, as `./ids.md` says. Complexity found mid-task lifts the lane: stop, say so, and re-enter at the new lane's first incomplete stage. A lane never drops once its intent is approved.``
  Wrap it as the file's other bullets are wrapped.
- `packages/core/skills/accord/lane-s.md`: in `## Start`, in the New request bullet, delete the sentence that starts
  ``A request moved from a lane M ticket carries `Title: …` and `Keys: …`:`` and ends ``in the `enter:` and the `stop:` path alike.``
  In step 1, delete ``When the request carried `Understood: …` and `Done when: …`, use those lines.``
- `packages/core/skills/accord/worktree.md`: in the `stop:` bullet, change
  ``its `title:`, the carried `Keys:` frontmatter lines, its `## Understood`, `## Done when` and `## Scope` lines, its carried `## Vetoes`, `## Decisions` and `## Corrections` sections and the commit and push of that ticket file``
  to ``its `title:`, its `## Understood`, `## Done when` and `## Scope` lines and the commit and push of that ticket file``.
- `packages/core/skills/intent/SKILL.md`, the `**Lane S.**` rule: change `propose dropping it to lane S` to
  `propose moving it to lane S`, and `Drop it only on the owner's yes` to `Move it only on the owner's yes`. Every
  precondition stays as written: the four lift conditions, `depends_on`, the `git diff` check, the `git status`
  check, and `From step 9 on, a lane never drops.`

Superseded assertions (keep each test name; remove only these):
- `stage-skills.test.ts` `REQUIRED.accord` (line 21): remove `'Understood:'` and `'Done when:'`.
- `stage-skills.test.ts` `risk:data-loss the move to lane S carries Vetoes Decisions and Corrections into the new lane S ticket`:
  remove the `wt` constant and ``expect(wt).toContain('`## Vetoes`')``. The other assertions stay and pass on the new
  text.
- `stage-skills.test.ts` `ac-1 a lane is proposed from the scout facts and a lane S ticket records its scope` (ST-LN-62 ac-1):
  remove `expect(s).toContain('lane S without asking again')` and ``expect(s).toContain('`## Scope`')``. Both were
  the deleted hand-off sentence.
- `stage-skills.test.ts` `ac-4 every lane S change is worked from its own lane S ticket in its worktree` (ST-LN-31 ac-4):
  remove ``'`Keys: …`'`` from `phrases`, and remove the `worktree.md` assertion that holds the old `stop:` clause.
- `lane-s.test.ts` `ac-5 a queued lane M ticket drops to lane S only at intent on the owners yes` (ST-LN-31 ac-5):
  from the intent list, remove `'propose dropping it to lane S'`. From the `move` list, remove `'do not drop'`,
  ``'`accord drop <id> --reason "moved to lane S"`'``, `'step 1 of'`, `'(lane S, moved from <id>)'`,
  `'Title: <its title> Keys: <its depends_on, tracker, priority, ui and design lines'`,
  ``'`accord new ticket --lane S --worktree`'`` and `'a new id'`. Remove
  `expect(accord).toContain('lane S without asking again')`. Leave the `lint.dropped-approved` lines; Task 4 removes them.

Behaviour that must not change: in `ids.md`, the `## Assigning`, `## When your email is not registered`,
`## Merge conflicts under people` and `## Dropping instead of renaming` sections keep their words. In `lane-s.md`,
the lane S Start, Steps, Lift and Rules text other than the two deletions stays. In `worktree.md`, every bullet
other than the `stop:` clause stays. The other accord SKILL.md sections stay, and the intent preconditions stay.
`stage-skills.test.ts` `ac-5 the ids reference drops a ticket with accord drop` and the session-check test still pass.

Run `npm run gen`, `npm run build` and `node packages/cli/dist/cli.js skills sync`. Then run
`npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/lane-s.test.ts packages/core/test/skills.test.ts`,
then `npm run typecheck` and `npm run lint`. Type each render as `AccordConfig`.

## Task 3: CI refuses a move to lane S only once intent was approved at the base or in a commit the pull request adds

covers: @ac-5, D-05, D-06
files: .github/workflows/accord.yml, packages/core/src/scaffold/workflow.ts, packages/cli/test/workflow-script.test.ts
verify: packages/cli/test/workflow-script.test.ts#ac-5-both-CI-scripts-refuse-a-move-to-lane-S-only-once-intent-was-approved-at-the-base-or-in-a-commit-the-pull-request-adds (@ac-5), packages/cli/test/workflow-script.test.ts#risk:security-a-commit-of-the-pull-request-whose-ticket-frontmatter-cannot-be-read-fails-the-lane-check-closed-in-both-scripts, packages/cli/test/workflow-script.test.ts#risk:security-the-lane-check-reads-a-lane-S-value-written-off-its-key-line-and-refuses-a-lane-L-ticket-at-the-base-in-both-scripts

This task covers D-06 and D-05 part 3 (the CI half).

Consumes: in the `lint and gate` script, the existing `fm_at <rev> <path>`, which returns 0 when it read the
frontmatter into `fm`, 1 when the file is absent at that revision, and 2 when the read cannot be settled. It also
uses `$qc`, `$BASE`, `$file` and `$id`. Produces a new `lane_dropped` and a new refusal line, identical in
`.github/workflows/accord.yml` and in the string `workflowYml` returns in `packages/core/src/scaffold/workflow.ts`.

Write the tests first, in `packages/cli/test/workflow-script.test.ts`, top level after the existing top-level
`risk:security a lane S ticket that passed gate ready...` case.
- Read this repository's script the same way that case does: the `lint and gate` step of
  `.github/workflows/accord.yml`. Run every case under both `SCRIPT` and that script.
- Add a builder `history(steps: Array<(repo: string) => void>, seed?: (repo: string) => void)`. It calls
  `makeEmptyRepo()` and pushes the repo to `repos`. It sets repo-local `user.email` (`fixture@example.invalid`),
  `user.name` (`fixture`) and `commit.gpgsign` (`false`) with `gitRun(repo, 'config', ...)`. It writes
  `docs/readme.md`, runs `seed`, and takes `base = commitMsg(repo, 'base')`. Then it runs each step and calls
  `commitMsg(repo, 'step')` only when `gitRun(repo, 'status', '--porcelain')` is not empty. It returns
  `{ repo, base }`. Import `gitRun`, `commitMsg` and `mergeMsg` from `./helpers/repo.js`. Commits go through
  `-F` (conventions.md), never `-m`.
- Ticket texts for id `LM-1`. Lane M: `---\nid: LM-1\nstatus: draft\nlane: M\n# approved_hash:\n<extra>---\n\n## Intent\nwhy\n`,
  where `<extra>` is empty, `approved_hash: "abc"\n`, or `approved_hash:\n` (no value). Lane L: the unapproved lane M
  text with `lane: M` replaced by `lane: L`. Lane S:
  `---\nid: LM-1\nstatus: draft\nlane: "S"\n# approved_hash:\n---\n\n## Understood\nx\n\n## Done when\ny\n\n## Vetoes\n- none\n`.
- Each (case, script) pair gets its own sandbox, because a run writes `script.sh` and `calls.log` into its sandbox.
- Test `ac-5 both CI scripts refuse a move to lane S only once intent was approved at the base or in a commit the pull request adds`
  (`it.skipIf(noBash)`, its own timeout of 300_000). Build every sandbox first, then run every script at once with
  `runScriptAsync`, as the neighbouring cases do. Cases:
  - pass, base unapproved: seed lane M unapproved; one step to lane S;
  - pass, absent at the base: no seed; steps lane M unapproved, then lane S;
  - fail, approved at the base: seed lane M with `approved_hash: "abc"`; one step to lane S;
  - fail, approved only on the branch: no seed; steps lane M, then lane M with `approved_hash: "abc"`, then lane S;
  - fail, any value: seed lane M unapproved; steps lane M with `approved_hash:` and no value, then lane S;
  - fail, merge side: no seed; step lane M unapproved; then one step that runs `gitRun(r, 'checkout', '-q', '-b', 'side')`,
    writes lane M with `approved_hash: "abc"`, commits with `commitMsg`, writes lane M unapproved, commits, runs
    `gitRun(r, 'checkout', '-q', '-')`, and runs `mergeMsg(r, 'side', 'merge side')`; then a step to lane S.
    The approval exists only in a commit on the merged side, and the merge result equals both parents, so a
    first-parent or path-simplified walk misses it.
  For a pass case, assert exit 0 and that the output does not contain `lane cannot drop after approval`. For a
  fail case, assert exit 1 and that the output contains `LM-1: its lane cannot drop after approval`, and that no
  call ends with ` gate done LM-1`.
- Test `risk:security a commit of the pull request whose ticket frontmatter cannot be read fails the lane check closed in both scripts`
  (`it.skipIf(noBash)`). No seed; steps: `---\n{id: LM-1, lane: M}\n---\n\n## Intent\nwhy\n`, then lane S. Assert
  exit 1 and `LM-1: its lane cannot drop after approval` for both scripts. This case goes beyond the literal first
  Then of ac-5, which speaks of a readable key: it follows the ledger Ruling that an unreadable ticket frontmatter,
  at the base or at any commit the pull request adds, counts as possibly approved, so `lane_dropped` refuses.
- Test `risk:security the lane check reads a lane S value written off its key line and refuses a lane L ticket at the base in both scripts`
  (`it.skipIf(noBash)`, its own timeout of 300_000; every sandbox first, then every run at once). Cases:
  - fail, value off its key line: seed lane M with `approved_hash: "abc"`; one step to the lane S text with
    `lane: "S"\n` replaced by `lane:\n  S\n` (YAML reads this as lane S; the old key-line grep did not);
  - fail, tagged value: the same seed; one step to the lane S text with `lane: "S"` replaced by `lane: !!str S`;
  - fail, lane L at the base: seed lane L (unapproved); one step to lane S. This guards the kept L and P clause
    (ledger Ruling);
  - pass, guard against an over-wide check: seed lane M with `approved_hash: "abc"`; one step to the same text with
    `## Intent\nwhy\n` replaced by `## Intent\nwhy\nedited\n`.
  For a fail case, assert exit 1, that the output contains `LM-1: its lane cannot drop after approval`, and that no
  call ends with ` gate done LM-1`. For the pass case, assert exit 0, that the output does not contain
  `lane cannot drop after approval`, and that some call ends with ` gate done LM-1` (the stub's gate exits 0).

Script change, the same in both files. In `workflow.ts`, write every `${` as `\${`, as the file already does; no
backslash may appear anywhere else, because `scaffold.test.ts` forbids one. Replace the comment above
`lane_dropped` and the function with:
```
          # A ticket that may be lane S at HEAD dropped its lane after approval (ST-LN-58 D-06) when an approved_hash
          # key is in its version at the base or at any commit this pull request adds (git rev-list "$BASE..HEAD",
          # merge sides included), or when it was lane L or P at the base. At HEAD, only no lane key, or lane keys
          # that each hold a plain M, L or P on the key line, rule lane S out: a value off its key line or behind a
          # tag may still read as S. A lane M ticket never approved may move to lane S in place. An unsettled read
          # at HEAD is gated, since approved_at counts it as approved; at the base or at a commit of this pull
          # request, an unsettled read or a failing rev-list fails closed. An absent file is skipped.
          lane_dropped() {
            local rc revs rev lanes
            fm_at HEAD "$file" || return 1
            lanes=$(grep -E "^${qc}?lane${qc}?[[:space:]]*:" <<< "$fm") || return 1
            grep -Evq "^${qc}?lane${qc}?[[:space:]]*:[[:space:]]*${qc}?[MLP]${qc}?[[:space:]]*(#.*)?$" <<< "$lanes" || return 1
            fm_at "$BASE" "$file"
            rc=$?
            if [ "$rc" -eq 2 ]; then return 0; fi
            if [ "$rc" -eq 0 ]; then
              grep -Eq "^[[:space:]]*${qc}?approved_hash${qc}?[[:space:]]*:" <<< "$fm" && return 0
              grep -Eq "^${qc}?lane${qc}?[[:space:]]*:[[:space:]]*${qc}?[LP]${qc}?[[:space:]]*(#.*)?$" <<< "$fm" && return 0
            fi
            if ! revs=$(git rev-list "$BASE..HEAD"); then return 0; fi
            while IFS= read -r rev; do
              [ -n "$rev" ] || continue
              fm_at "$rev" "$file"
              rc=$?
              if [ "$rc" -eq 1 ]; then continue; fi
              if [ "$rc" -ne 0 ]; then return 0; fi
              grep -Eq "^[[:space:]]*${qc}?approved_hash${qc}?[[:space:]]*:" <<< "$fm" && return 0
            done <<< "$revs"
            return 1
          }
```
Use no pathspec on `git rev-list`. A pathspec would simplify history and skip the merged side.

The two lines after `fm_at HEAD` read the lane at HEAD. `lanes` holds every lane key line; when there is none, the
ticket has no lane and is not lane S. The second grep prints the lane lines that are not a plain M, L or P (quoted or
not, with an optional comment) on the key line; when it prints nothing, the ticket is lane M, L or P and the check
stops. Anything else, `S`, a value on the next line, a tag, an anchor or a block scalar, goes on to the base and branch
checks, as `protected_at` treats a lane value that is not on its key line. A HEAD whose frontmatter `fm_at` cannot
settle still returns 1 here: the gate loop then runs `gate done` on it, because `approved_at` counts an unsettled
read as approved.

Change the refusal line to:
`echo "$id: its lane cannot drop after approval (lane S at HEAD, or a lane that is not a plain M, L or P there; approved at the base or in a commit of this pull request, or lane L or P at the base)"`.

Behaviour that must not change: `fm_at`, `approved_at`, `protected_at`, `is_dropped`, the deletion check, the
`has_code` logic, the gate loop, the `npx` pins, the step name `lint and gate`, and every message other than the
refusal line. A ticket approved at the base and lane S at HEAD still fails. So does lane L or P at the base. A ticket
whose lane at HEAD is a plain M, L or P is never refused by the lane check, so an approved lane M ticket edited in a
pull request is still gated as before. Every
existing case in `workflow-script.test.ts` still passes, including
`the workflow of this repository gates the same tickets with the same exit as the emitted one`. The scaffold and
upgrade tests still pass.

Run `npm run build`, because the cli test imports `initFiles` from the built core. Then run
`npx vitest run packages/cli/test/workflow-script.test.ts packages/core/test/scaffold.test.ts packages/cli/test/upgrade.test.ts packages/cli/test/init.test.ts`,
then `npm run typecheck` and `npm run lint`.

## Task 4: The drop lint rule goes, a moved ticket lints clean as lane S, and the README names the exception

covers: D-05, D-04
files: packages/core/src/lint/dropped.ts, packages/core/src/lint/rules.ts, packages/core/test/lane-s.test.ts, README.md, packages/cli/README.md
verify: packages/core/test/lane-s.test.ts#risk:parsing-a-lane-M-ticket-moved-in-place-to-lane-S-lints-clean-and-passes-gate-ready-as-lane-S

This task covers D-05 part 4 (the lint half) and D-05 part 3 (the lint half). For part 3,
`lint.lane-s-lane-m-records` already fails a lane S ticket that holds `approved_hash`, and it stays as it is. For
D-04, the README names the in-place move (ledger Ruling).

Consumes: `templates['ticket-lane.md']`, `lintSnapshot`, `gateReady`, `statusRows` and `anchorText`. All of them are
already importable in `packages/core/test/lane-s.test.ts` or exported from `packages/core/src/index.ts`. The
file's `snap(files, extra)` helper is used too. Produces a lint table without `lint.dropped-approved`.

Write the test first: `risk:parsing a lane M ticket moved in place to lane S lints clean and passes gate ready as lane S`
in `packages/core/test/lane-s.test.ts`, top level. Build the moved ticket from the real lane M template, as
`ids.md` `## Moving to lane S` step 3 says:
- `id:` becomes `"MV-1"`; `title:` becomes `"Export"`; the `lane:` line becomes `lane: "S"`;
- the text from `## Intent` up to `## Vetoes` is replaced by `## Understood\nThe export button writes a csv file.\n\n## Done when\nPressing export saves report.csv.\n\n## Scope\nsrc/export.ts\n\n`;
- `## Vetoes` gets the line `- "never touch the schema"`, `## Decisions` gets `- D-01 csv only` and
  `## Corrections` gets `- "no, the tsv one"`, and everything from `## Open questions` to the end is removed;
- every other frontmatter line of the template, the commented keys included, stays.

Load it with `snap({ 'accord/tickets/MV-1.md': moved }, { tree: ['src/export.ts', 'accord/config.yml', 'accord/tickets/MV-1.md'] })`.
Assert:
- `lintSnapshot(s).findings` has no `error` finding;
- the `statusRows` row for `MV-1` has `lane: 'S'` and `stage: 'intent'`;
- `gateReady(s, 'MV-1').verdict` is `'pass'`;
- `const a = anchorText(s, 'MV-1')!.split('\n')` includes the line `Lane: S`, and includes `## Vetoes` followed
  directly by `- "never touch the schema"` (`a[a.indexOf('## Vetoes') + 1]`). The anchor opens with
  `# Anchor: MV-1 "Export"` and a blank line (`packages/core/src/status/anchor.ts` lines 29 and 30), so `Lane: S`
  is its third line, not its first.

When this test fails on product code, stop with `BLOCKED` and name the finding. Do not change lint or gate code to
make it pass.

Lint change: delete `droppedApproved` and its comment from `packages/core/src/lint/dropped.ts`. Delete the
`lint.dropped-approved` row and its import from `packages/core/src/lint/rules.ts`. In `lane-s.test.ts`
`ac-5 a queued lane M ticket drops to lane S only at intent on the owners yes`, delete the `T`, `A` and `lint`
constants of its last block and the three `lint.dropped-approved` assertions. Keep the test name.

README: in `README.md`, at the end of the lane paragraph (line 105), change `A lane only rises.` to
`A lane only rises, except that a lane M ticket whose intent is not yet approved may move to lane S in place, keeping its id, branch and worktree.`
Then run `npm run gen`, which regenerates `packages/cli/README.md`. Run `npm run build` after it.

Behaviour that must not change: `lint.dropped-reason`, `lint.depends-dropped`, `lint.lane-s-lane-m-records` and
every other lint rule and level; the other `lane-s.test.ts` cases; every other README line.

Run `npx vitest run packages/core/test/lane-s.test.ts packages/core/test/lane-lint.test.ts packages/core/test/skills.test.ts`.
Then run `npm run typecheck` and `npm run lint`. CI runs both, and the typecheck reads test files under strict mode
(`tsc -p packages/core/tsconfig.test.json`). Fix an error they report in a file on this task's `files:` line. For an
error in any other file, stop with `BLOCKED` and name the file, the line and the error. Then run `tests.full`,
`npx vitest run`.
