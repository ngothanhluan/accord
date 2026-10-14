# Phase 2 dogfood: STALE-1 and TAGS-1

Task 16 of `docs/plans/2026-10-12-phase-2-skills.md`. One real lane M ticket, STALE-1 ("Idle tickets show
in status"), taken through every stage with the phase 2 skills and agents on this repository.

## How it ran

- The owner asked the main session to run it. The main session orchestrated; every `accord-*` agent ran
  in a fresh context with its model and effort from `.claude/agents/*.md`, told to read its own body and
  the ruleset.
- Stages: intent (3 interview rounds, 1 audit, 1 owner-approved revision) → approach (architect, critic,
  owner's yes, `accord approve`) → plan (3 critic rounds) → build (4 tasks, 1 retry) → review (2 rounds,
  1 Should kept by the owner) → verify (5 of 5 pass, owner approved) → `gate done` 0 errors.
- Result: `accord status` shows `idle <n>d` after the stage, and `--json` carries `idleDays`, for a live
  ticket whose last commit on any branch is older than `stale_days`. Suite 1137 → 1144 tests, all passing.
- `t/STALE-1` stayed local by the owner's choice and is merged into `phase-2-skills`.

## Fix before the next ticket (load-bearing)

Each of these made `gate done` or `task-done` unreachable on the documented path, or would have.

1. **No step writes the `@test:` tags (note 13).** Fixed by TAGS-1 (PR #4): `task-done` writes them. The template says "add it during build"; executors never
   edit the ticket; build and verify say nothing. Every lane M ticket fails `gate done`. Workaround used:
   the main session wrote each tag after `task-done`. Fix: `accord-build` step 3 writes the scenario's tag
   from the task's `verify:` id once `task-done` passes.
2. **No step creates `accord/tests-baseline.txt` (note 14).** Fixed by BASE-1 (PR #6): `gate plan` warns and the plan stage asks. A repository adopting phase 2 without it gets
   `gate.test-untraced` on every pre-existing test at Done. Workaround: ran `accord tests baseline` at the
   plan baseline (1137 ids). Fix: `accord-plan` runs it when the file is absent.
3. **A test name starting with `@` breaks the tag (note 16).** Fixed by VID-1 (PR #8): `gate plan` rejects `@` and an in-id comma. A name like `@test:ac-1 …` puts a second `@`
   in the report id, so the scenario tag splits into two Gherkin tags and `gate done` can never pass. The
   planner invented the convention from the policy wording. Fix: lint rejects a `verify:` id containing
   `@`; the planner and executor say a test name never begins with `@`.
4. **Phase 2 config keys are not set up (note 1).** This repository had no `tests.report`, `tests.affected`,
   `tests.full`, `review.mode`, or `stale_days`; plan and build stop at the first one. Fix: `/accord` first
   run, or `accord init` for an existing folder, offers the keys.
4a. **The generated CI workflow never runs `tests.full` (found on PR #3).** `gate done` for a lane ticket
   needs the report, so the pull request gate fails `gate.report-missing` on every lane M ticket. Fix: the
   workflow `init` writes runs `tests.full` before the gate when the config names it. This repository's
   own workflow was fixed by hand, along with a missing `npm rebuild` that had kept its gate job from ever
   running (`accord: not found` since the workspace package took the published name).
4b. **A ticket goes stale inside a larger pull request (found on PR #3).** STALE-1 was verified at its own
   head, then merged into the phase branch with later commits; the PR gate correctly read its ticks and
   review as stale. A ticket ships in its own pull request, or is re-verified at the head it ships with.

## Should fix

5. **Executor over-scope (note 19).** Task 1's executor also built Tasks 2 and 3, so their tests passed on
   arrival and the "show it failing" rule collided; executors disabled the code to see red. Fix: the
   executor implements only what its task's `verify:` cases need, even when the Approach mentions more.
6. **`review-package` includes generated modules (note 23).** 248 KB for a ~190-line product diff, almost
   all of it `packages/core/src/generated/skills.ts`. Fix: list generated files by stat only.
7. **Critic and reviewer use different rubrics (notes 25, 26).** The plan critic demanded a test that the
   reviewer then flagged as a non-allowed risk kind (`risk:drift`). Lint checks only that `risk:` is
   present, not the kind, so the gate cannot enforce the list. `record.md` has no "owner kept it" status,
   so a kept Should forces `verdict: accepted-by-owner` with nothing broken. Fix: lint checks the kind;
   the critic checks new test names against it; add a `kept` status.
8. **`gate done` warns on prose in evidence (new).** `gate.reference-unknown` read twelve path-like strings
   in `verification.md` evidence (`refs/heads/t/`, `1/2`, `Math.floor(Date.now()/1000`) as file references.
   0 errors, but the noise hides a real warning. Fix: only backticked tokens that look like repository
   paths count, or the verifier quotes code differently.
9. **"Three revision rounds" is ambiguous (note 18).** Plan step 6 caps revisions; commit subjects count
   critic rounds. Round 3 found a Must after two revisions. Fix: say "at most three critic rounds".
10. **Rebuild order is repository knowledge (notes 12, 17, new).** Skill sources render through `npm run
    gen`, then `npm run build`, then `accord skills sync`; CLI tests consume core from `dist`. `build` alone
    leaves the generated module stale and sync reports everything unchanged. The plan critic caught the
    missing build; nothing caught the missing gen. Fix: one config key for the render command, or a check
    that the generated module matches its sources.

## Smaller

11. `accord anchor` on a blank ticket says "next: the owner approves" before intent is written (note 2).
12. A question about existing code must cite the file that prompted it. The rule sits in intent step 2;
    steps 3 to 5 do not repeat it, and the owner had to ask for the path (note 4).
13. The owner's yes step shows options but no line says to state the recommendation and why it has the
    least impact; the owner had to ask (note 10).
14. The approach skill has no place for the architect's Rulings before `ledger.md` exists (note 9).
15. A skill-text change (the dashboard) has no criterion form; no AC can test a skill sentence (note 8).
16. `tests.affected` on a shared test helper pulls in nearly the whole suite, 60 s (note 21).
17. The controller composed a dispatch with a placeholder baseline sha instead of running
    `git rev-parse HEAD` first (note 11).
18. `status: draft` did not block Ready (note 10). Decide whether draft should block it.

## What worked

- The interview converged in three rounds; the auditor found three two-way criteria and the day-counting
  and default-window gaps, all folded into one revision.
- The architect surfaced an intent gap the interview missed (the dashboard readers, D-08).
- The plan critic caught real defects in all three rounds, including the `@` tag that would have blocked
  Done.
- `task-done` refused a task whose tests were wrapped in `describe` and so not in the report: the gate did
  exactly its job.
- The verifier checked each criterion against code and report, and recorded the one gap (`--all` listing
  has no CLI test) instead of passing it.

## Changed during the dogfood

- **Verified is approved in a question (c0acb60).** Under `review: outcome` the owner no longer edits the
  ticket by hand. After the report the orchestrator asks one approve-or-not-yet question naming the
  criteria, the commit, and the values, and writes them only on an explicit approve; the commit quotes the
  answer. Owner's decision: hand-editing three YAML lines was friction with no added safety over an
  explicit question.
- **Config (377a06e).** This repository's `accord/config.yml` gained the phase 2 keys, `review.mode:
  outcome`, and `stale_days: "14"`.

## Not checked

- STALE-1 in a shallow clone (accepted risk: nothing is flagged there).
- The `--all` listing of @ac-4 through the CLI (deferred in the ticket's ledger).
- Why the suite grew by 7 tests where the plan named 6.

# Second ticket: TAGS-1

TAGS-1 ("task-done writes the `@test:` tags") fixed item 1 above, through `/accord` on this repository, in
its own branch and pull request (item 4b).

## How it ran

- Stages: intent (3 interview rounds, 1 audit, 6 Decisions) → approach (architect, critic, owner's yes) →
  plan (4 critic rounds, 3 revisions) → build (4 tasks, 1 retry) → review (1 Should fixed, 1 clean
  re-review, final review with 2 Nice) → verify (5 of 5 pass, owner approved) → `gate done` 0 errors.
- First lane M ticket to reach `gate done` with no hand edit of the ticket: `task-done` wrote all five
  `@test:` tags. Suite 1144 → 1157 tests, all passing. Merged as PR #4.

## Recurred

- **Item 11.** `accord anchor` on the blank ticket again said "next: the owner approves" before intent.
- **Item 9.** The critic needed three revisions and a fourth round; the cap was read as revisions, by Ruling.
- **Item 6.** The review package was 183 KB, mostly generated modules.
- **Item 7.** The `risk:<kind>` list was known only to the reviewer. TAGS-1 added it to the planner and
  executor text; lint still checks only that `risk:` is present.

## New findings

19. **`(new)` resolves against the baseline.** A task modifying a file an earlier task creates must still
    mark it `(new)`. The `gate plan` message was clear; the planner did not know. Fix: `planner.md` says so.
20. **A verify id with a comma cannot be listed.** `verify:` tokens split on commas, with no escape. Fix:
    lint rejects a comma in a verify id, alongside the `@` of item 3.
21. **The executor wraps tests in `describe()` again (as in STALE-1).** `task-done` refused, as it should,
    and cost a retry. The executor also left a background test run going when it reported. Fix: the
    executor agent body says the report id is the top-level test name, and the executor stops every
    process it started before reporting.
22. **Deferred items have no reader after verify.** Review writes Nice findings under the ledger's
    `## Deferred` and verify lists them, then nothing reads them again; `status`, `next`, and the dashboard
    read only `## Tasks`, although spec section 8 says the dashboard reads the ledger. Fix: at verify the
    owner decides each deferred item, a draft ticket or dropped with a reason, and `gate done` refuses an
    undecided one. Draft tickets already show in the dashboard and `accord next`.
23. **No external research step.** The architect relies on memory for library and API facts; the spec
    never mentions research. Owner approved a researcher agent at the approach stage, writing
    `tickets/<id>/research.md` with a source and date per fact: a library documentation tool when one is
    installed, official documentation next, web search last.
24. **UI skills by role.** Owner chose to map a design skill to each of three roles in `config.yml`
    instead of one `ui.skill`; spec section 11 updated in the same pull request as this note.

## Smaller

25. Executor edits left three working-tree files with CRLF line endings; the index is LF and the commits
    are correct, so the cost is a noisy `git status` only.

## Deferred from TAGS-1

The three Nice findings in `accord/tickets/TAGS-1/ledger.md` under `## Deferred`, carried here until
item 22 gives them a home:

- A tag conflict on an already-recorded task prints "task N of ID is not done:" although the ledger records
  it done (`packages/cli/src/commands/task-done.ts:57-59,64-66`).
- The build skill's re-run line for tickets recorded before the tag writer does nothing when the plan has
  no `(@ac-n)` markers, and does not say to commit a ticket a re-run changed
  (`packages/core/skills/build/SKILL.md:50-51`).
- The drift test is named `risk:drift`, a kind outside the reviewer's list
  (`packages/cli/test/skills-sync.test.ts:909`); same root as item 7.

## What worked

- `task-done` refused the `describe`-wrapped tests and, after review round 1, a recorded task whose mapped
  test fails while its tag is unwritten.
- Plan critic round 1 caught a shared test fixture whose ticket tags and plan maps had to agree.
- Six owner decisions during intent (D-01 to D-06) settled the gate rules before planning; one reading of
  D-05 came back to the owner during review, and the owner ruled on it.

# Third ticket: BASE-1

BASE-1 ("The plan stage asks for the tests baseline") fixed item 2 above, through `/accord` on this
repository, in its own branch and pull request.

## How it ran

- Stages: intent (9 Decisions, 1 owner correction) → approach (architect, critic with 1 Must, owner's yes,
  then a re-approve after the planner found @ac-4 contradicting D-08) → plan (3 critic rounds, 2 revisions)
  → build (3 tasks, no retry) → review (round 1 no findings, final review no findings) → verify (5 of 5
  pass, owner approved) → `gate done` 0 errors after one fix to the verifier's citations.
- `gate plan` now warns while `accord/tests-baseline.txt` is absent; the plan skill asks the owner before
  `accord tests baseline`, which refuses a stale report. Suite 1157 → 1163 tests. Merged as PR #6.

## Recurred

- **Item 11, third time.** `accord anchor` on the blank ticket said "next: the owner approves".
- **Item 8.** `gate done` misread citation text; see item 27, which is a real error, not only noise.
- **Item 25.** An executor wrote CRLF into skill sources; the render invariant caught it this time.

## New findings

26. **A warning that names a command reads as an order.** The approach critic's Must: a `gate plan`
    warning saying "run `accord tests baseline`" would have the agent create the file at step 4, unasked.
    Fixed in BASE-1 by wording the warning as a question for step 7. Any future rule message that names a
    command needs the same care.
27. **`gate done` strips a leading `.` from a citation.** `packages/core/src/gate/refs.ts` trims punctuation,
    `.` included, from both ends of each token, so `.claude/skills/x.md` resolves as `claude/skills/x.md`
    and `./baseline.md` as `/baseline.md`; a `path:312-313` range is not removed as a position. The verifier
    wrote citations that way, the @ac-3 block resolved to nothing, and `gate done` failed with
    `gate.evidence-unresolved`. Fix: keep a leading `.` that starts a path segment, accept `:n-m`, and have
    the verifier cite source paths.
28. **Executors add a commit trailer.** Task 1's commit carried a co-author trailer against the repository
    rule; it was reworded before `task-done`, and later briefs carried a one-line rule. Fix: the executor
    body states the repository's commit-message rule, or the brief carries it from config.
29. **A file the orchestrator creates on the ticket branch shows as undeclared.** Plan critic round 1: a
    baseline created at step 7 is in no task's `files:` line, so review lists it as Extra. Fixed in BASE-1
    by a ledger Ruling that `baseline.md` tells the orchestrator to write.
30. **The plan skill is near its size cap.** The rendered `accord-plan/SKILL.md` is 5047 of 5120 bytes. The
    next addition to the plan stage must go into a loaded reference file, as `baseline.md` did.

## Deferred from BASE-1

The two Nice findings in `accord/tickets/BASE-1/ledger.md` under `## Deferred`, carried here until item 22
gives them a home:

- A run that stops after the baseline commit and before its ledger Ruling never adds the Ruling on resume;
  step 8 fires only while the file is new (`packages/core/skills/plan/baseline.md`).
- The stale check runs before the `wx` write, so with a commit, an existing baseline plus a stale report
  says "run the tests again" before "already exists" (`packages/cli/src/commands/tests-baseline.ts`).

## What worked

- The owner's correction (accord serves teams) turned an accepted risk into D-08: the baseline ships alone
  and a conflict keeps only the lines both sides hold.
- The planner caught a contradiction between @ac-4 and D-08 before any code; the owner re-approved.
- Every task passed `task-done` on the first try; review found nothing to fix.

# Fourth ticket: VID-1

VID-1 ("Gate plan rejects verify ids holding an at sign or a comma") fixed items 3 and 20 above, through
`/accord` on this repository, in its own branch and pull request.

## How it ran

- Stages: intent (4 owner answers, 1 audit with 2 two-way criteria, 6 Decisions) → approach (architect,
  critic with 1 Should, owner's yes) → plan (2 critic rounds, 1 revision) → build (3 tasks, no retry) →
  review (round 1 no Must or Should, final review none) → verify (5 of 5 pass, owner approved) → `gate done`
  0 errors on the first run. Suite 1163 → 1169 tests. Merged as PR #8.
- The plan stage's new baseline step (BASE-1) ran for the first time: the file existed, so nothing was asked.

## Recurred

- **Item 27.** The verifier, told to avoid them, still cited `.claude/` paths; `gate done` passed with nine
  `gate.reference-unknown` warnings. Item 27 is the next ticket.
- **Item 25.** Executors again left CRLF in the working tree; the commits are LF.

## New findings

31. **The ticket title stays the template placeholder.** No intent step writes `title:` and nothing flags
    "Short title in business language"; the final review noticed it after verify was dispatched. It was set
    by a Ruling, since `approved_hash` covers sections only. Fix: the intent skill writes the title with the
    Intent, and lint warns on the template's placeholder title.
32. **Fan-out inside a ticket was weighed and rejected.** Asked whether tasks can run in parallel, the four
    dogfood plans showed overlapping `files:` lines on shared tests and the spec, and executors with no
    capability retries. The owner chose to measure first: spec sections 8, 9, 13 and 16 now hold the reasons,
    the risk kinds with their triggers, and the benchmark question of whether the executor's model matters
    per kind.

## Deferred from VID-1

The five Nice findings in `accord/tickets/VID-1/ledger.md` under `## Deferred`:

- The comma error's advice is wrong for a missing space after a separating comma (`(@ac-1),b#y`): the fix is
  a space, not a rename.
- A mistyped marker such as `(@ac-01)` gets the at-sign error's advice to rename a test.
- Nothing fails when `skills sync` is skipped after gen and build; the committed agent copies were checked by
  hand.
- `verifyAt` recomputes `fieldLines` per flagged id (`packages/core/src/gate/plan.ts`).
- An import out of alphabetical order (`packages/core/src/gate/rules.ts`).

## What worked

- The auditor found the two criteria a test could read two ways (what the comma error names, what "says"
  means for the agents); both became Decisions before any code.
- The approach critic's Should moved three criterion tests to the CLI layer, where exit code 1 is observable.
- The plan critic caught a variable named like the ticket id that would have filed findings under the wrong
  path with every test still green.

# Fifth ticket: REFS-1

REFS-1 ("Gate done reads dot-led paths and line ranges in citations") fixed item 27 above, through `/accord`
on this repository, in its own branch and pull request.

## How it ran

- Stages: intent (4 owner answers, 1 audit with 4 two-way criteria, 7 Decisions) → approach (architect, two
  critic rounds; round 1's Should narrowed D-01 by an owner answer, D-08; round 2's two Shoulds fixed in the
  option) → plan (critic no findings) → build (3 tasks, task 1 retried once) → review (round 1 none, final
  review 1 Nice) → verify (5 of 5 pass, owner approved) → `gate done` 0 errors on the first run. Suite
  1169 → 1178 tests. Merged as PR #10.
- The verifier was not told how to cite, for the first time since item 27: with the new sentence it cited
  `path:n-m`, and every such citation resolved.

## Recurred

- **Item 11.** `accord anchor` on the blank ticket said "next: the owner approves the ticket", a fourth time.
- **Item 25.** An executor reported CRLF in the working tree again; the commits are LF.
- **VID-1's deferred `skills sync` gap.** The approach critic found that a stale `dist` leaves the installed
  verifier without the new sentence while its test passes; the approach fixed the order gen, build, sync and
  checked the installed copy by hand.

## New findings

33. **An executor claimed its verify cases passed when no junit case matched.** Task 1's tests sat inside a
    `describe`, so the junit names carried its title and never equalled the verify ids; `task-done` refused
    all seven. Later briefs said to write cases at the top level and to read the junit report. Fix: the
    executor body says a verify id matches the full junit name, and to check the report before `DONE`.
34. **The retry executor ran `task-done` itself, with the published CLI.** It recorded task 1 at the commit
    before its own fix and committed the ticket and the ledger. The orchestrator replaced the line with a
    local `task-done` and a Ruling. Fix: the executor body says it never runs `accord task-done` and never
    edits `accord/`; the brief already forbids the ticket.
35. **`gate done` warns on tokens that are only `./` or `/`, and on paths that live only in test inputs.**
    REFS-1's own verification drew 11 `gate.reference-unknown` warnings, none a mistyped citation: fixture
    paths quoted in prose and bare separators. Fix: a token of only dots and slashes is not a candidate; the
    verifier quotes a test input in a code span the reader can skip, or the warning counts are accepted.
36. **A question to the owner arrives without its context.** The question dialog shows only the question and
    its options, so text written above it is hidden, and internal ids (`ac-4`, `D-07`, rule ids) mean nothing
    there. The owner chose a ticket of its own, next in the queue: every owner question states in one or two
    sentences what is decided and why now, what each option does for the user, and glosses any internal id.

## Deferred from REFS-1

- The `:12-14` assertion added to the existing `:line`/`:line:col` unit test repeats what @ac-3's test
  covers (`packages/core/test/refs.test.ts`); drop it or move it into a `risk:parsing` case.

## What worked

- The auditor's four splits (backticks or bare, line count or not, one warning or any, which render) became
  three Decisions in one owner answer, and each fixed a test before any code.
- The approach critic caught that never trimming a leading dot would warn on every `.md` in prose and break
  `...path`; the owner narrowed D-01 rather than accept the noise.
- Review converged in one round; the final review's only finding was a duplicated assertion.

# Sixth ticket: ASK-1

ASK-1 ("Every question to the owner stands alone") fixed item 36 above, through `/accord` on this repository,
in its own branch and pull request.

## How it ran

- Stages: intent (4 owner answers, 1 audit with 4 two-way readings settled in one answer, 7 Decisions) →
  approach (architect, two critic rounds; round 1's Must changed the option) → plan (critic 1 Nice) → build
  (2 tasks, no retry) → review (round 1 none, final review 1 Should fixed, scoped re-review none) → verify
  (2 of 2 pass, owner approved) → `gate done` 0 errors. Suite 1178 → 1180 tests. Merged as PR #12.
- Every owner question in the run carried its context in the question itself, ahead of the rule it ships.

## Recurred

- **Item 11.** The session anchor on the blank ticket said "next: the owner approves the ticket", a fifth time.
- **Item 30.** The rendered plan skill is now 5099 of 5120 bytes; ASK-1 had to measure every added byte.
- **Item 35.** `gate done` warned three times on `gate.reference-unknown`, none a mistyped path (item 37).

## New findings

37. **The verifier cites globs and directories that are not in the tree.** `.claude/skills/*/ask.md`,
    `packages/core/skills/*/SKILL.md` and `.agents/skills` each drew `gate.reference-unknown`. Fix: the
    verifier cites one concrete file, never a glob; or the citation reader skips a token holding `*`.
38. **The owner approved a summary of the criteria, not their text.** The approach yes covers Intent and the
    acceptance criteria, but no step shows them verbatim, so the owner approved the orchestrator's summary
    while `accord approve` hashed the file. The owner chose a ticket of its own, next in the queue: at the end
    of the intent stage, after the audit and before the architect, the owner sees Intent and the criteria
    block verbatim and says yes.
39. **A floor the plan named was dropped, and only the final review saw it.** The plan said each criterion
    test asserts the exact stage and directory lists; the tests looped over the code's own lists and could
    pass checking nothing. The round 1 reviewer, which reads the ticket, the package and the ledger but not
    `plan.md`, passed it. Fix: the reviewer reads each task's plan prose against the tests it produced.

## Decided during ASK-1

Asked what accord records, whether it needs pattern mapping, and whether it needs project knowledge, the
owner set this order for the tickets after ASK-1:

1. The intent review of item 38.
2. Items 33 and 34, together with `accord/product/conventions.md`: the repository's engineering rules, one
   per line with `Rejected:` lines, which `accord brief` appends to every brief; the planner and the
   executor read `product/`; the verify stage offers to promote a Ruling or Correction that holds beyond
   its ticket. This replaces the notes the orchestrator has pasted into every brief by hand.
3. A run log: the plan critic's findings recorded per round as `review.md` records review, and one line per
   agent run (agent, model, effort, outcome; tokens and time blank where the runtime gives none), so the
   phase 3 benchmark starts with data.
4. The planner names an existing file to copy the shape from for each `(new)` file; no separate agent.
5. Items 4 and 4a, plus one verify step: `git fetch`, then `git merge origin/main` when the branch is
   behind, then `tests.full`, so the commit verified is the one that merges; never a rebase.

Then the deferred-to-backlog ticket (item 22), the researcher ticket, and phase 3.

## Deferred from ASK-1

(none)

## What worked

- The scout's byte counts showed, before any criterion was written, that copying the rule into eight
  skills would break the size cap; the owner chose the shared file with that number in view.
- The approach critic's Must caught that a pointer tied to the intent clause would leave most questions,
  the approach yes and the verify approve among them, without the rule; both criteria would still have passed.
- The final review's mutation reasoning (drop a stage, stay green) found the one gap three earlier readers missed.

# Seventh ticket: SHOW-1

SHOW-1 ("The owner approves the ticket's text, not a summary") fixed item 38 above, through `/accord` on this
repository, in its own branch and pull request.

## How it ran

- Stages: intent (3 Decisions; 1 audit, its readings settled in one answer as D-04 to D-06; the owner saw
  Intent and the criteria verbatim and said yes before the architect) → approach (architect, five critic
  rounds, stopped by the owner; D-07 widened the approach yes to every approved section) → plan (critic, no
  findings) → build (2 tasks, no retry) → review (round 1 four Nice, final review one Nice, all deferred) →
  verify (2 of 2 pass, owner approved) → `gate done` 0 errors. Suite 1180 → 1182 tests. Merged as PR #14.
- Both owner yeses in the run were given on the ticket's text shown verbatim, ahead of the rule it ships.

## Recurred

- **Item 11.** The session anchor on the blank ticket said "next: the owner approves the ticket", a sixth time.
- **Item 37.** Told never to cite a glob, the verifier cited directories instead: `.agents/skills`,
  `.claude/skills` and `packages/core` each drew `gate.reference-unknown`. The fix must cover directories too.

## New findings

40. **A task's prose pointed to another task's text, and the brief dropped it.** The plan's Task 2 said "the
    shared setup above" and "the normalisation above", both written in Task 1; `accord brief` copies one
    task, so each executor met a reference to nothing. Task 1's executor guessed right; Task 2's brief was
    patched by hand. Fix: the planner writes each task to stand alone, never pointing to another task.
41. **The approach critic has no round cap.** The plan stage stops after three revision rounds and asks the
    owner; the approach stage loops until the critic is satisfied. SHOW-1 ran five rounds, each fix to how
    "the sections changed since the intent yes" was found through commit subjects opening a new hole, until
    the owner stopped it and chose to show every section. Fix: the approach stage takes the plan stage's
    cap of three rounds, then asks the owner.

## Deferred from SHOW-1

- The new ac-1 and ac-2 tests repeat the eight-stage `STAGES` assertion; adding a stage turns them red.
- §7 item 4 of the spec still says the owner receives a brief, above the clause SHOW-1 added.
- Intent step 9 wraps at about 110 columns, and approach step 5 has a short line, "yes, run".
- Sentence B's "any section changed" may be followed over the next line's "Treat every approved section as
  changed" (accepted by D-07).
- Any no at the approach yes returns to the audit without saying to rewrite the touched sections first, so
  the owner may repeat the no at intent step 9.
- Not checked: a session that compacts after the intent yes but before `## Approach` is written re-enters the
  intent stage (accepted in the Approach's risks).

## What worked

- Showing the text verbatim found what summaries had hidden: at the approach yes the owner read every locked
  section, so `accord approve` hashed exactly what was read.
- The plan critic's round 1 found nothing, and the review's reader, told to check the plan's prose against
  the tests, confirmed every named assertion; item 39 did not recur.

# Eighth ticket: IDS-1

IDS-1 ("Ticket ids follow a per-type, per-person convention") came out of a dashboard brainstorm: `/accord`
showed "0 in progress, 0 ready" while the approved queue lived only outside `accord/tickets/`. The owner split
the work into IDS-1 (ids), a branch-name ticket, a dashboard ticket, and a panel ticket, in that order.

## Run log

Kept live, one row per agent run, as evidence for the Phase 3 benchmark. Model is the agent definition's `model, effort`
frontmatter (no dispatch override; `opus` is Opus 5.5); the runtime reports neither per run. Tokens, tool calls and time come from each agent's
completion notice.

| # | Stage | Agent | Model | Tokens | Tool calls | Time | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | intent | scout | haiku, low | 62,924 | 20 | 56s | 10 questions answered with file:line; flagged `fs.ts:145` claim-author order |
| 2 | intent | auditor | opus, medium | 20,191 | 2 | 32s | 3 of 5 criteria read two ways → 4 owner questions (D-10..D-13) |
| 3 | approach | architect | opus, high | 76,809 | 40 | 180s | 2 options, Option 1 recommended; 3 public-interface points to the owner (D-14..D-16) |
| 4 | approach | critic (round 1) | opus, high | 67,121 | 24 | 220s | 2 Must (number reuse after prune, D-11; shared initials across branches, D-04), 3 Should, 2 Nice → owner chose D-17 |
| 5 | approach | critic (round 2) | opus, high | 65,973 | 18 | 231s | no Must; 7 Should, 3 Nice → 1 owner question (D-18), the rest Rulings |
| 6 | plan | planner | opus, medium | 133,625 | 56 | 360s | 6 tasks, all ac and D-01..D-18 covered; 4 Rulings; `gate plan` passed first time |
| 7 | plan | critic (round 1) | opus, high | 149,281 | 55 | 462s | no Must; 4 Should (invalid-config message, no-table behaviour, git output size and lazy fetch, skill byte limit) |
| 8 | plan | planner (resumed, fixes) | opus, medium | 143,383 cumulative | 7 | 66s | 4 Should fixed; 2 Rulings; gate plan passed |
| 9 | plan | critic (round 2) | opus, high | 127,974 | 61 | 418s | no Must; 1 Should (no-commit `git log --all` untested; main session ran it on git 2.56: exit 0), 3 Nice |
| 10 | plan | planner (resumed, fixes) | opus, medium | 150,785 cumulative | 11 | 58s | Should and 3 Nice fixed; 2 Rulings; gate plan passed |
| 11 | plan | critic (round 3) | opus, high | 113,696 | 54 | 376s | no Must; 1 Should (refusal order: invalid `people` before "id required"), 1 Nice (GIT_NO_LAZY_FETCH needs git 2.44, recorded as a limit) |
| 12 | plan | planner (resumed, fixes) | opus, medium | 152,336 cumulative | 3 | 16s | round 3 Should fixed (third and last revision); gate plan passed |
| 13 | plan | critic (round 4) | opus, high | 127,967 | 70 | 453s | no Must; 1 Should (`git log --all` without `--no-renames` likely dies in a blobless clone), 2 Nice (init header says every key is required; `ids.md` append onto `people: {}`); round limit reached, owner asked |
| 14 | plan | planner (resumed, fixes) | opus, medium | 157,739 cumulative | 8 | 35s | round 4 Should and 2 Nice fixed in a fourth round the owner allowed; 1 Ruling (treeless clone limit); gate plan passed |
| 15 | plan | critic (round 5) | opus, high | 169,372 | 72 | 669s | no Must; 1 Should (D-02 "clone" read as a blank new ticket in `ids.md`), 3 Nice (`--full-history` for never-reuse, lazy fetch in the `-S` registration lookup, `people` merge conflict); owner asked |
| 16 | plan | planner (resumed, fixes) | opus, medium | 161,502 cumulative | 5 | 35s | round 5 Should (D-02 clone copies sections, owner answered) and 3 Nice fixed in a fifth round the owner allowed; gate plan passed |
| 17 | plan | critic (round 6, diff only) | opus, high | 65,416 | 27 | 263s | no Must; 2 Should (keep-every-entry duplicates a key and breaks config.yml; clone drops frontmatter such as `ui`, `parent`, `depends_on`), 2 Nice (`## Dropped` copied; no test pins `--full-history`); owner asked |
| 18 | plan | planner (resumed, fixes) | opus, medium | 167,158 cumulative | 6 | 39s | round 6 two Should and two Nice fixed in a sixth round the owner allowed; gate plan passed |
| 19 | plan | critic (round 7, diff only) | opus, high | 64,151 | 24 | 161s | no Must; 1 Should (`title` missing from the type-change carry-over list), 5 Nice (epic lane/parent copy, copied `@test:` tags and Feature line, case-insensitive emails and shared initials in a conflict, two test-setup details); owner asked |
| 20 | plan | planner (resumed, fixes) | opus, medium | 171,867 cumulative | 7 | 29s | round 7 Should (`title`) and 5 Nice fixed; owner set the stop rule: one last diff-only critic; gate plan passed |
| 21 | plan | critic (round 8, diff only, last) | opus, high | 57,113 | 24 | 140s | no Must; 1 Should, one sentence (`new ticket` without `--lane` on a type change writes a non-lane template); fixed under the owner's stop rule, no further critic |
| 22 | plan | planner (resumed, fixes) | opus, medium | 173,128 cumulative | 2 | 16s | round 8 Should fixed (`--lane` always passed on a type change); gate plan passed; `plan: IDS-1 ready`. Plan stage total: 8 critic rounds (5 full, 3 diff-only), 9 planner runs |
| 23 | build | executor (task 1) | sonnet, medium | 109,949 | 34 | 429s | task 1 built (32707dd), full suite 1188 pass; `task-done` refused: verify cases inside a `describe`, so their JUnit ids carry the describe prefix |
| 24 | build | executor (task 1 retry) | sonnet, medium | 71,574 | 13 | 249s | verify cases moved to top level (501be00); suite 1188 pass; task 1 recorded |
| 25 | build | executor (task 2) | sonnet, medium | 81,879 | 10 | 129s | ab0aa8a; suite 1190 pass; task 2 recorded first time |
| 26 | build | executor (task 3) | sonnet, medium | 105,390 | 29 | 451s | 3e324dd; suite 1193 pass; task 3 recorded first time |
| 27 | build | executor (task 4) | sonnet, medium | 78,430 | 9 | 161s | bb53cb9; suite 1196 pass; task 4 recorded first time |
| 28 | build | executor (task 5) | sonnet, medium | 73,301 | 10 | 156s | 34d8842; suite 1197 pass; guard test red shown by mutation; task 5 recorded first time |
| 29 | build | executor (task 6) | sonnet, medium | 78,327 | 8 | 121s | 01455d0; suite 1197 pass; SKILL.md 5035 of 5120 bytes; task 6 recorded first time. Build total: 7 executor runs for 6 tasks, one retry (describe-prefixed verify ids) |
| 30 | review | reviewer (round 1, intent) | sonnet, high | 62,963 | 16 | 210s | no Must or Should; 2 Nice (tag strip had no Ruling; cat-file tree header) |
| 31 | review | reviewer (round 1, quality) | sonnet, high | 91,064 | 14 | 171s | no Must; 1 Should (shallow clone reuses a number, D-11), 7 Nice deferred |
| 32 | review | executor (round 1 fix) | sonnet, medium | 80,030 | 11 | 207s | 1 try; shallow-clone refusal, test failed first; 1198 tests pass; commit carried a Co-Authored-By trailer, removed before push |
| 33 | review | reviewer (round 2, both, fix diff only) | sonnet, high | 36,475 | 7 | 56s | no findings; converged after 2 rounds |
| 34 | review | final reviewer (both, whole ticket) | opus, high | 104,512 | 22 | 160s | no Must or Should; 1 Nice deferred (case-sensitive registration search); verdict converged |
| 35 | verify | verifier | sonnet, medium | 47,174 | 10 | 48s | 5/5 criteria pass at 669aa48; skill text ids.md not checked as behaviour |

Baseline suite at 3be1c05: 55 files, 1182 tests pass, 62s.

Owner side so far: 13 interview answers, 7 approach answers (D-14..D-18), 1 correction (prefixes fixed, not configured), 2 scope splits
(branch names, epic grouping to the dashboard ticket).

## Run log: ST-LN-1 (branch name template)

First ticket created under the id convention: `accord new ticket --type story --lane M` assigned ST-LN-1.

| # | Stage | Agent | Model | Tokens | Tool calls | Time | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | intent | scout | haiku, low | 61,511 | 25 | 53s | `t/` hardcoded in anchor.ts:28, fs.ts:130/143, /accord skill text; CI and commit messages never read it |
| 2 | intent | auditor | opus, medium | 19,570 | 2 | 32s | 4 of 5 criteria read two ways (author vs committer email, lint finding vs load refusal, local t/ claim, per-step skill text); 3 settled from code, 1 back to the owner |
| 3 | approach | architect | opus, high | 61,875 | 24 | 145s | 2 options; recommended: template regex in the CLI loader reading every ref, D-06 fallback free from the loader; 3 Rulings |
| 4 | approach | critic (round 1) | opus, high | 59,867 | 20 | 197s | 2 Must (stale working-tree template hides new claims; t/ not reserved), 5 Should, 2 Nice; option amended: templates read from every ref, narrow scan |
| 5 | approach | critic (round 2) | opus, high | — | — | — | 1 Must (templates from every ref: a stray branch sets a template, breaks ac-4), 5 Should, 2 Nice; owner asked which refs set the template |
