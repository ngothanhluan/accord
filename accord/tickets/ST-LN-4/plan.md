---
baseline: d71eb4e6e3ceb6f8847807dcb8b4448aecf57af9
plan_hash: "fnv1a64:dfe34e6da252e91a"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger. No product code changes: every task edits skill or agent text, the spec, and
one test file.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`. No test title
  holds `@` or a comma.
- Each new test reads the rendered text from the core render functions, never from disk: in
  `packages/core/test/stage-skills.test.ts` from the module-level `files` (`skillTargets(config)`), in
  `packages/core/test/agents.test.ts` from `agentTargets(config())`. Before matching a phrase, the test collapses
  every whitespace run to one space (`.replace(/\s+/g, ' ')`), so a sentence may wrap anywhere in the source; the
  phrase itself is written with single spaces. A test first asserts each text it reads is non-empty, naming the path.
- Source definitions are `packages/core/skills/<stage>/` and `packages/core/agents/`. After editing one, run in
  order from the repository root: `npm run gen` (rewrites `packages/core/src/generated/skills.ts` and
  `agents.ts`), `npm run build`, `node packages/cli/dist/cli.js skills sync` (rewrites the `.claude/` copies the
  task lists; every other path must print `unchanged`). Never use the npx 0.1.0 CLI for this. Commit the generated
  and rendered files with the task.
- End every task with `npm run lint`, `npm run typecheck`, then `npx vitest run packages/core/test/stage-skills.test.ts
  packages/core/test/agents.test.ts packages/core/test/skills.test.ts packages/cli/test/skills-sync.test.ts`. The
  guards those suites hold stay green: every rendered `SKILL.md` at most 120 lines and 5120 bytes
  (`skills.test.ts`), every rendered agent body at most 60 lines (the `stays short` case in `agents.test.ts`), the
  drift cases, and the scan `no rendered text restates a rule the CLI enforces` (`skills.test.ts:393-448`), which
  fails on any rendered skill or reference line holding the capitalised words `Ready` or `Done` (except
  `Done when:`) or the word `warning`. Text written by these tasks never holds those words; the `plan-review.md`
  run marker is `## Closed` for that reason.
- Every phrase in `REQUIRED` (`stage-skills.test.ts`) and `AGENT_REQUIRED` (`agents.test.ts`) stays in its text;
  neither list is edited.
- Files are LF with no BOM.
- Severity sentences, the three lines of @ac-3, used by Task 3 exactly as written here:
  - `Must: left as is, the Intent does not hold, a criterion is not reached, or a Veto, Decision or Correction is broken.`
  - `Should: left as is, a defect ships or an executor is blocked, which a later stage would catch at a higher cost.`
  - `Nice: no defect, only a clearer or smaller way.`

## Task 1: Wiring: the plan loop sizes its first critique and sends each critic after the first only the fix diff after a round with no Must
covers: @ac-1, D-01, D-04, D-05
files: packages/core/skills/plan/SKILL.md, packages/core/skills/plan/critique.md (new), packages/core/agents/critic.md, packages/core/agents/planner.md, packages/core/src/generated/skills.ts, packages/core/src/generated/agents.ts, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-plan/critique.md (new), .claude/agents/accord-critic.md, .claude/agents/accord-planner.md, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-1-the-first-plan-critique-is-sized-by-the-plan-and-a-should-only-round-reads-the-fix-diff (@ac-1)

The loop lives in a new reference, `critique.md`, loaded beside `baseline.md`, so the rendered `SKILL.md` keeps
its byte headroom under the 5120 cap; `SKILL.md` step 5 points to it. Consumes: the plan's `## Task` sections and
the critics' numbered findings. Produces: `accord/tickets/<id>/plan-review.md`, written by the main session, which
the planner and the critic rounds after the first read; a critic that takes a lens in `plan` mode and a `diff` mode.

Test first, in `packages/core/test/stage-skills.test.ts`:
- `it('ac-1 the first plan critique is sized by the plan and a should only round reads the fix diff')`: `skill` is
  the rendered `.claude/skills/accord-plan/SKILL.md`, `loop` the rendered `.claude/skills/accord-plan/critique.md`,
  `critic` the rendered `.claude/agents/accord-critic.md` (from `agentTargets(config)`; add `agentTargets` to the
  import from `../src/index.js`), each whitespace-collapsed. `step5` is the slice of `skill` from `5. **Critique.**`
  to `6. **Rounds.**`, non-empty.
  - `step5` contains `` `./critique.md` `` and `` `accord-critic` ``; `skill` contains `three revision rounds`,
    `stop and tell the owner` and `` or `accord gate plan <id>` still fails, after the third ``, and no longer
    contains `have the planner fix every Must and every Should`.
  - `loop` contains each of these phrases:
    `` Round 1 is `whole` and sized by the plan. ``;
    `` Count the `## Task` sections of `plan.md` and judge from the ticket and the plan whether the ticket touches auth, money, migration, or data deletion. ``;
    `` one `accord-critic`, no lens, for a plan of one to three tasks ``;
    `` two critics for a plan of four or more tasks, lens `criteria`, which checks that the plan reaches the criteria and the Intent, and lens `build`, which checks that an executor can build each task ``;
    `` one more critic, lens `security`, for a plan of any size whose ticket touches auth, money, migration, or data deletion, so at most three ``;
    `Merge and de-duplicate their findings into one round, numbered within it, before the planner gets them.`;
    `` Every round after a round that reported a Must is `whole` ``;
    `` Every round after a round that reported no Must is `diff` ``;
    `` `git diff <that round's commit> -- accord/tickets/<id>/plan.md`, which holds the planner's fix ``;
    `` A `diff` critic never reads the whole plan. ``;
    `` every Must and Should that is `open` or `unverified`, never a Nice ``;
    `The planner fixes every one.`;
    `` A Nice goes to the ledger under `## Deferred`, marked `deferred`, and never to the planner. ``;
    `The loop ends only on a round that reported no Must and no Should`;
    `` and the last `accord gate plan <id>` passed ``;
    `` mark that earlier finding `repeated as <this round>.<n>` ``;
    `` `<m>` and `<s>` count the Musts and the Shoulds after the last `## Closed` line that are `open` or `unverified` once this round is recorded ``.
  - `critic` contains `` Mode `diff`: ``, `` `fixed: <round>.<n>, <round>.<n>` ``, `` `criteria` runs only the first, second, third and fifth checks ``,
    `` On the changed hunks, check that no Veto is violated and that nothing goes beyond the acceptance criteria. ``,
    `` a new numbered finding that starts `repeats <round>.<n>:` `` and `` `withdrawn: <round>.<n>, <round>.<n>` ``.

Text:
- `packages/core/skills/plan/critique.md` (new), exactly:

```
---
kind: reference
---

# The critique loop

The main session keeps every critic finding in
`accord/tickets/<id>/plan-review.md`: one `## Round <n> (whole)` or
`## Round <n> (diff)` section per round, each finding on one line as
`<n>. <Must|Should|Nice> — <finding> — <state>`. The state is `open`,
`fixed`, `deferred` for a Nice, `unverified: <reason>`, `withdrawn`,
`repeated as <round>.<n>`,
`open, owner: "<the owner's words>"` for a fix the owner said to apply,
or `owner: "<the owner's words>"` for one the owner dropped. A round
with no findings says `No findings`. Only the sections after the last
`## Closed` line count; step 8 of the skill appends that line.

1. **Read.** Round 1 is `whole` and sized by the plan. Count the
   `## Task` sections of `plan.md` and judge from the ticket and the plan
   whether the ticket touches auth, money, migration, or data deletion.
   Dispatch in parallel, each in a fresh context, mode `plan`, with the
   paths of the ticket and `plan.md`, naming its lens:
   - one `accord-critic`, no lens, for a plan of one to three tasks;
   - two critics for a plan of four or more tasks, lens `criteria`,
     which checks that the plan reaches the criteria and the Intent, and
     lens `build`, which checks that an executor can build each task;
   - one more critic, lens `security`, for a plan of any size whose
     ticket touches auth, money, migration, or data deletion, so at most
     three.

   Merge and de-duplicate their findings into one round, numbered within
   it, before the planner gets them. Every round after a round that
   reported a Must is `whole`: one `accord-critic` in a fresh context, no
   lens, mode `plan`, with the paths of the ticket, `plan.md`, and
   `plan-review.md`. Every round after a round that reported no Must is
   `diff`: write
   `git diff <that round's commit> -- accord/tickets/<id>/plan.md`, which
   holds the planner's fix, into a file outside the working tree, and
   dispatch one `accord-critic` in a fresh context, mode `diff`, with the
   paths of the ticket, `plan.md`, that file, and `plan-review.md`. A
   `diff` critic never reads the whole plan.
2. **Record.** Append the round's section to `plan-review.md` and mark
   each new finding `open`. Mark `fixed` each finding a critic lists
   after `fixed:`, and `withdrawn` each one it lists after `withdrawn:`.
   When a new finding starts `repeats <round>.<n>:`, mark that earlier
   finding `repeated as <this round>.<n>`. A Nice goes to the ledger
   under `## Deferred`, marked `deferred`, and never to the planner.
3. **Owner.** A finding whose proposed fix relies on an API cited only
   by a URL outside the repository goes to the owner at once, as
   `./ask.md` says: show the finding, the fix, and the URL, and ask
   whether to apply or drop it. On apply its state becomes
   `open, owner: "<the owner's words>"`: it goes to the planner with
   those words, which confirm the API, and closes only when a critic
   lists it after `fixed:`. On drop its state becomes
   `owner: "<the owner's words>"`, which closes it.
4. **Converged.** The loop ends only on a round that reported no Must
   and no Should, when no Must or Should after the last `## Closed` line
   is `open` or `unverified`, and the last `accord gate plan <id>`
   passed: go to step 7 of the skill.
5. **Fix.** Otherwise commit `plan.md` and `plan-review.md` with the
   subject `plan: <id> round <n>, <m> Must, <s> Should`, where `<m>` and
   `<s>` count the Musts and the Shoulds after the last `## Closed` line
   that are `open` or `unverified` once this round is recorded; the next
   `diff` round reads from that commit. Dispatch `accord-planner` with the
   ticket path, the baseline, the mode, the path of `plan-review.md`, and
   every Must and Should that is `open` or `unverified`, never a Nice,
   each with the owner's words it holds. The planner fixes every one.
   Write each `unverified: <reason>` it replies into that finding's
   state; a finding it reports fixed stays `open` until a critic lists it
   after `fixed:`. Then go back to step 4 of the skill.
```

- `packages/core/skills/plan/SKILL.md`:
  - frontmatter `loads: [plan/baseline.md, plan/critique.md, shared/ask.md]`.
  - Step 1: its last sentence ends `since the last` then `` `plan: <id> ready` `` then `, if any.`; before that
    final period insert `, and reading `plan-review.md` as `./critique.md` says`, so the phrase
    `since the last `plan: <id> ready`` stays whole.
  - Step 5 becomes exactly: `5. **Critique.** Run the loop in `./critique.md`: how many `accord-critic` agents
    read, and what, which findings `accord-planner` fixes, and when the loop ends.`
  - Step 6: `If Must or Should findings are still open after the third` becomes `If a Must or Should in
    `plan-review.md` is still `open` or `unverified`, or `accord gate plan <id>` still fails, after the third`; the
    rest of the step stays, and step 4's sentence that an unfixable gate failure counts as an open finding in step 6
    stays as it is.
  - Step 8: before `Commit `plan.md``, insert `Append a `## Closed` line to `plan-review.md`.`, and `Commit
    `plan.md`, with the ledger if it changed,` becomes `Commit `plan.md` and `plan-review.md`, with the ledger if
    it changed,`.
  - If `skills.test.ts` reports the rendered `SKILL.md` over 5120 bytes, shorten only the sentences this task
    changed, keeping every phrase the ac-1 test and `REQUIRED.plan` name.
- `packages/core/agents/critic.md`:
  - The mode line: `Your caller names one mode, `approach` or `plan`,` becomes `Your caller names one mode,
    `approach`, `plan`, or `diff`,`.
  - Two new bullets after it, in this order:
    - `- In `plan` mode your caller may name a lens: `criteria` runs only the first, second, third and fifth checks
      under `Mode `plan`:`; `build` only the fourth and sixth; `security` checks only the auth, money, migration, and
      data deletion paths the plan touches. With no lens, run every check.`
    - `- When you also get `accord/tickets/<id>/plan-review.md`, list on one line,
      `fixed: <round>.<n>, <round>.<n>`, each finding it holds as `open` or `unverified` that the plan now fixes,
      and never repeat an `open` one as a numbered finding. For each it holds as `unverified` that the plan does not
      fix, read its reason: when the finding still holds, repeat it as a new numbered finding that starts
      `repeats <round>.<n>:` and carries what the reason says is missing, a citation or a different fix; when it does
      not, list it on one line, `withdrawn: <round>.<n>, <round>.<n>`.`
  - A new block after the `Mode `plan`:` block, separated from it by one blank line, so the six plan checks stay
    one unbroken block:
    ```
    Mode `diff`: you get the paths of `plan.md`, of a file holding `git diff` of `plan.md` since the last round, and of `plan-review.md`.
    - Check each finding `plan-review.md` holds as `open` or `unverified` against the diff.
    - Check that no hunk breaks what it touches: its task's `covers:`, `files:` and `verify:` lines, and every task that cites what it changes.
    - On the changed hunks, check that no Veto is violated and that nothing goes beyond the acceptance criteria.
    - Open `plan.md` only at the tasks the hunks change or that cite them; never read the whole plan.
    ```
- `packages/core/agents/planner.md`:
  - The revision sentence `On a revision you also get the critic's findings or what `accord gate plan` printed;
    fix each one in `plan.md`.` becomes `On a revision you also get the path of
    `accord/tickets/<id>/plan-review.md` and the Must and Should findings to fix, never a Nice, or what `accord gate
    plan` printed; fix each one in `plan.md`.`
  - `When you finish, reply with the path of `plan.md` and the number of tasks.` becomes `When you finish, reply
    with the path of `plan.md`, the number of tasks, and for each finding you were given its number and `fixed` or
    `unverified: <reason>`.`
- `docs/specs/2026-10-12-workflow-layer-design.md` §7 Plan, the sentence starting `At most three revision rounds`
  (lines 262-263): before it, insert: `The first critic round is sized by the plan: one critic for one to three
  tasks; two in parallel for four or more, one on the criteria and the Intent, one on whether an executor can build
  each task; one more, a security critic, when the ticket touches auth, money, migration, or data deletion; their
  findings are merged and de-duplicated. The main session keeps every finding and its state in
  `tickets/<id>/plan-review.md`. A round after one that reported a Must reads the whole plan; a round after one with
  no Must reads only `git diff` of `plan.md` from the round commit. Every Must and Should is fixed; a Nice goes to
  the ledger as deferred. The next critic repeats an unverified finding with the citation or fix it lacked, or
  withdraws it. The loop ends on a round with no Must and no Should, when none is open or unverified and the plan gate
  passes. A fix whose API is cited only by a URL goes to the owner at once.` Its rest stays.

Must not change: the critic's `approach` mode and its six `Mode `plan`:` check lines; every `AGENT_REQUIRED` phrase
of the critic and planner, the planner's `A test name never holds `@` or a comma.` and its `(@ac-` marker wording
(`skills-sync.test.ts#risk:drift-the-committed-plan-and-build-copies-carry-the-marker-wording`); plan `SKILL.md`
steps 2, 3, 4, 7 and the Rules, the `7. **Baseline tests.**` and `8. **Finish.**` headings and `./baseline.md`
(the existing ac-4 baseline test); `baseline.md` itself; the round commit subject
`plan: <id> round <n>, <m> Must, <s> Should`, which resume counts (only what `<m>` and `<s>` count is defined);
step 4's `A gate failure you cannot fix counts as an open finding in step 6.`

## Task 2: A review round with only Should findings is checked by the affected tests, not a re-review
covers: @ac-2, D-01
files: packages/core/skills/review/SKILL.md, packages/core/skills/review/record.md, packages/core/src/generated/skills.ts, .claude/skills/accord-review/SKILL.md, .claude/skills/accord-review/record.md, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-2-a-review-round-with-only-should-findings-converges-without-a-re-review (@ac-2)

Consumes: the merged findings of a review round and the `tests.affected` / `tests.full` commands of
`accord/config.yml` (`tests.affected` is optional, `packages/core/schemas/config.schema.json:46`). Produces: one
fix check, named once in step 4 and called "that command" everywhere after, which the review skill and its record
share.

Test first, in `packages/core/test/stage-skills.test.ts`:
- `it('ac-2 a review round with only should findings converges without a re-review')`: `skill` is the rendered
  `.claude/skills/accord-review/SKILL.md`, `record` the rendered `.claude/skills/accord-review/record.md`, both
  whitespace-collapsed. `step4` is the slice from `4. **Classify.**` to `5. **Converged**`, `step7` from
  `7. **Final review.**` to `8. **Record.**`, both non-empty.
  - `step4` contains `` run the `tests.affected` command over the files the fix touched, or `tests.full` when
    `tests.affected` is not configured or finds no test file. ``, `When the round reported a Must, re-review only the
    fix diff` and `When it reported only Should findings, no reviewer is dispatched again for that fix: that command
    passing checks it.`
  - `skill` contains `**Converged** means no Must is open and every Should is fixed with that command passing.` and
    no longer contains `zero Must and zero Should`.
  - `step7` contains `If it finds only Should findings, fix them and run that command as in step 4, with no
    re-review.`
  - `record` contains `every Should is fixed with that command passing` and `` or `tests.full` when
    `tests.affected` is not configured or finds no test file `` and no longer contains `zero Must and zero Should`.

Text, `packages/core/skills/review/SKILL.md`:
- Step 4, the bullet `When it reports, run the `tests.affected` command over the files the fix touched.` becomes
  `When it reports, run the `tests.affected` command over the files the fix touched, or `tests.full` when
  `tests.affected` is not configured or finds no test file.`; its next sentence, which reruns a fresh executor on a
  failure, stays.
- Step 4, the bullet `Re-review only the fix diff: ...` becomes: `When the round reported a Must, re-review only the
  fix diff: `accord review-package <id> --base <the noted sha>` into a file outside the working tree, one reviewer,
  lens `both`. When it reported only Should findings, no reviewer is dispatched again for that fix: that command
  passing checks it.`
- Step 5's first sentence becomes `**Converged** means no Must is open and every Should is fixed with that command
  passing.`; the round 3 sentence stays.
- Step 7: `If it finds a Must or Should: one fix and one scoped re-review, as in step 4.` becomes `If it finds a
  Must: one fix and one scoped re-review, as in step 4. If it finds only Should findings, fix them and run that
  command as in step 4, with no re-review.`; `If a Must is still open after that, stop and ask the owner.` stays.
- The frontmatter `description` keeps its text except `until no Must or Should is left` becomes `until no Must is
  open and every Should is fixed`.
- `packages/core/skills/review/record.md`: the `verdict: converged` bullet becomes `- `verdict: converged` when,
  after the final review, no Must is open and every Should is fixed with that command passing: `tests.affected`
  over the files the fix touched, or `tests.full` when `tests.affected` is not configured or finds no test file;`.
- `docs/specs/2026-10-12-workflow-layer-design.md` §10 Loop to convergence (lines 402-403, 409-410): `Fix every Must
  and Should marked `patch`, then re-review only the fix diff, with one reviewer.` becomes `Fix every Must and Should
  marked `patch`. After a round with a Must, re-review only the fix diff, with one reviewer; after a round with only
  Should findings, the affected tests over the fixed files, or the full suite when none apply, check the fix, with no
  re-review.`; `Converged means zero Must and zero Should.` becomes `Converged means no Must is open and every Should
  is fixed with that test command passing.`; the final review bullet's `One fix and one scoped re-review follow if
  needed, then stop.` becomes `A Must gets one fix and one scoped re-review; a Should gets a fix checked by that test
  command; then stop.`

The rendered review `SKILL.md` must stay at or under 5120 bytes; if `skills.test.ts` fails on it, shorten only the
sentences this task changed, keeping every phrase the ac-2 test names.

Must not change: every `REQUIRED.review` phrase; steps 1 to 3, 6, 8, 9 and the Rules; the classification into
`patch`, `plan-gap`, `intent-gap`; the fresh-executor rerun on a failing test run; Nice findings going to
`## Deferred`; `record.md`'s line format and the `accepted-by-owner` verdict.

## Task 3: Must, Should and Nice are defined by what happens if the finding is left
covers: @ac-3, D-01
files: packages/core/agents/critic.md, packages/core/agents/reviewer.md, packages/core/src/generated/agents.ts, .claude/agents/accord-critic.md, .claude/agents/accord-reviewer.md, .claude/agents/accord-final-reviewer.md, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/test/agents.test.ts
verify: packages/core/test/agents.test.ts#ac-3-the-critic-and-both-reviewers-define-must-should-and-nice-by-consequence (@ac-3)

Consumes: the three severity sentences of the preamble. Produces: the same three lines in the critic and in the
reviewer, so the final reviewer, rendered from `reviewer.md`, carries them too.

Test first, in `packages/core/test/agents.test.ts`:
- `it('ac-3 the critic and both reviewers define must should and nice by consequence')`: for each of
  `.claude/agents/accord-critic.md`, `.claude/agents/accord-reviewer.md`, `.claude/agents/accord-final-reviewer.md`
  from `agentTargets(config())`, whitespace-collapsed, the text contains each of the three sentences, each as one
  string in the test, word for word.

Text: in both `critic.md` and `reviewer.md`, insert directly before the `Findings:` line the line `Severity, by
what happens if the finding is left:`, then the three severity sentences of the preamble in their order, each on
one line as a `- ` bullet, copied byte for byte from the ticket's @ac-3 docstring (never retyped), then one blank
line. In `critic.md` this block follows the `Mode `diff`:` block Task 1 added, separated from it by one blank line.
`docs/specs/2026-10-12-workflow-layer-design.md` §10 (line 381): `**Findings.** `Must | Should | Nice`, numbered. No
concrete failing case, no finding.` gains after `numbered.` the three sentences, in order.

Must not change: the critic's mode blocks (its six plan checks stay one block directly under `Mode `plan`:`); the
reviewer's lenses, its Undeclared files rule and its finding template; every `AGENT_REQUIRED` phrase; the final
reviewer's routing (the `rendered agents` case on the final reviewer stays green unchanged).

## Task 4: The planner runs the critic's plan checks on its plan before it replies
covers: @ac-4, D-02
files: packages/core/agents/planner.md, packages/core/src/generated/agents.ts, .claude/agents/accord-planner.md, packages/core/test/agents.test.ts
verify: packages/core/test/agents.test.ts#ac-4-the-planner-runs-every-plan-check-of-the-critic-before-it-replies (@ac-4)

Consumes: the six `- Check ...` lines under `Mode `plan`:` in `critic.md`, unchanged by Tasks 1 and 3. Produces:
the same six lines in the planner, under an instruction to run them before replying.

Test first, in `packages/core/test/agents.test.ts`:
- `it('ac-4 the planner runs every plan check of the critic before it replies')`: `critic` and `planner` are the
  rendered `.claude/agents/accord-critic.md` and `.claude/agents/accord-planner.md`, split on `\n` (not
  whitespace-collapsed). `from` is the index of the line `Mode `plan`:` in `critic`, at least 0; `run` is the lines
  after it up to the first empty line, and `checks` is `run` filtered to those starting `- Check`. `checks` has
  length 6 and equals `run` (no other line in that block). `intro` is the index of the planner line `Before you
  reply, run these checks of the critic's plan mode on your plan and fix what fails:`, at least 0. Each check is a
  whole line of `planner` at an index above `intro`.

Text: in `packages/core/agents/planner.md`, before the line starting `When you finish, reply`, insert the intro line,
then the six check lines copied byte for byte from `critic.md` (copy them, never retype), then one blank line.

The rendered planner body must stay at most 60 lines (the `stays short` case); with Tasks 1, 4 and 5 it is about
49.

Must not change: every rule line of the planner already there; `critic.md`.

## Task 5: An API a finding relies on carries a citation the planner confirms before applying
covers: @ac-5, D-03, D-04
files: packages/core/agents/critic.md, packages/core/agents/planner.md, packages/core/src/generated/agents.ts, .claude/agents/accord-critic.md, .claude/agents/accord-planner.md, packages/core/test/agents.test.ts
verify: packages/core/test/agents.test.ts#ac-5-an-api-a-finding-relies-on-carries-a-citation-the-planner-confirms (@ac-5)

Consumes: the critic's findings and proposed fixes; step 3 of `critique.md` (Task 1), where the main session sends
a URL-only citation to the owner at once and passes an "apply" to the planner as `open, owner: "<words>"`.
Produces: a citation rule in the critic, and in the planner an apply-only-when-confirmed rule. The planner has no
web tool (D-04), so a URL it is given is a citation it cannot read, and it applies such a fix only on the owner's
words.

Test first, in `packages/core/test/agents.test.ts`:
- `it('ac-5 an api a finding relies on carries a citation the planner confirms')`: `critic` and `planner` are the
  rendered agents from `agentTargets(config())`, `loop` the rendered `.claude/skills/accord-plan/critique.md` from
  `skillTargets(config())` (add `skillTargets` to the import from `../src/index.js`), each whitespace-collapsed.
  - `critic` contains `A finding, or a fix you propose, that relies on a host or library API cites where that API is
    defined: a file and line in the working tree, `node_modules` included, as `path:line`, or the URL of the document
    outside it.`
  - `planner` contains `A fix the critic proposes that relies on a host or library API is applied only when reading
    the cited place confirms that API.`, `A fix with no citation, a citation you cannot read, or a citation that does
    not confirm the API is reported as `unverified: <reason>`, not applied.` and `A fix whose API is cited only by a
    URL is applied only when you are given the owner's words saying to apply it.`
  - `loop` contains `goes to the owner at once` and `` On apply its state becomes `open, owner: "<the owner's
    words>"` ``.
  - The planner frontmatter `tools` is still `Read, Grep, Glob, Write, Edit` and the critic's still
    `Read, Grep, Glob`.

Text:
- `critic.md`, in the `Findings:` list, after its first bullet (`Numbered, each with a severity ...`): `- A finding,
  or a fix you propose, that relies on a host or library API cites where that API is defined: a file and line in
  the working tree, `node_modules` included, as `path:line`, or the URL of the document outside it.`
- `planner.md`, directly after the revision bullet Task 1 rewrote, one bullet: `- A fix the critic proposes that
  relies on a host or library API is applied only when reading the cited place confirms that API. A fix with no
  citation, a citation you cannot read, or a citation that does not confirm the API is reported as
  `unverified: <reason>`, not applied. A fix whose API is cited only by a URL is applied only when you are given
  the owner's words saying to apply it.`

Must not change: the critic's six plan checks, its lens bullet and its `Mode `diff`:` block; the planner's check
block from Task 4; both agents' `tools:`; the critic's `No failing case, no finding.` and `No findings` lines;
`critique.md`.
