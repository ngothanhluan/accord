---
baseline: d364a6dafa215f460f16775abe71d30073d15464
plan_hash: "fnv1a64:b109103e360de284"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<file>#<name>` with each whitespace run turned into `-`. Every new test
below is a top-level `it(...)` with no `describe` wrapper; its name starts with its criterion (`ac-n`, no leading
`@`) when its verify id maps a scenario, and otherwise with `risk:<kind>`, the kind from the reviewer's list in
`packages/core/agents/reviewer.md`. No test name begins with `@`, holds `(@ac-n)`, or holds a comma. CLI tests
import core from `packages/core/dist`, so run `npm run build -w packages/core` after a core change and before
any CLI test; every task that changes source ends with `npm run build`, because `accord task-done` is run as
`node packages/cli/dist/cli.js`.

## Task 1: Wiring: gate plan asks about the tests baseline while the file is absent
covers: @ac-1, @ac-2, @ac-3, D-03, D-04, D-05, D-06
files: packages/core/src/gate/plan.ts, packages/core/src/gate/rules.ts, packages/core/test/lane-plan.test.ts, packages/cli/test/lane-commands.test.ts, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/lane-plan.test.ts#ac-1-gate-plan-asks-about-the-tests-baseline-while-the-file-is-absent (@ac-1), packages/core/test/lane-plan.test.ts#ac-2-gate-plan-is-silent-once-the-tests-baseline-exists (@ac-2), packages/core/test/lane-plan.test.ts#ac-3-gate-plan-is-silent-when-no-report-is-configured (@ac-3)

Tests first, top-level in `packages/core/test/lane-plan.test.ts`, using its `base`, `plan` and `reasons` helpers
and the fixture `PLAN` (which passes every plan rule; `CONFIG` from `test/helpers/lane.ts` sets `tests.report`,
and `base()` writes no `accord/tests-baseline.txt`):
- `ac-1 gate plan asks about the tests baseline while the file is absent`: `r = plan(base(), PLAN)`. The
  findings of rule `gate.tests-baseline-missing` are exactly one; its `level` is `'warning'`, its `file` is
  `accord/tests-baseline.txt`, and its reason contains `ask the owner` and `accord tests baseline`.
  `r.verdict` is `'pass'`.
- `ac-2 gate plan is silent once the tests baseline exists`: `plan({ ...base(), 'accord/tests-baseline.txt': '' }, PLAN)`
  (the loader reads an empty file as a baseline with no case ids); `reasons(r, 'gate.tests-baseline-missing')`
  is `[]`.
- `ac-3 gate plan is silent when no report is configured`:
  `plan({ ...base(), 'accord/config.yml': CONFIG.replace(/tests:\n {2}report: .*\n/, '') }, PLAN)` (the same edit
  the `refuses a repository with no tests.report` CLI test makes; the approval hashes the ticket, not the config)
  and no baseline file; `reasons(r, 'gate.tests-baseline-missing')` is `[]`.

Existing tests this task keeps green, with no change to what they assert:
- `lane-plan.test.ts`, `a plan without a baseline fails on gate.plan-baseline-missing, saying what to write`
  reads `r.findings[0]`; the new warning sorts first (its file `accord/tests-baseline.txt` sorts before
  `accord/tickets/...`), so read `reasons(r, 'gate.plan-baseline-missing')[0]` instead.
- `lane-plan.test.ts`, `checks the baseline against the host ancestry facts only when they are supplied` reads
  `bad.findings[0].reason`; read `reasons(bad, 'gate.plan-baseline-unknown')[0]` instead.
- `packages/cli/test/lane-commands.test.ts`, `plan baseline` describe, `gate plan passes with the first commit as
  baseline and fails closed on an unknown one`: its repository has no `accord/tests-baseline.txt`. Keep the
  first `gate plan` result in a variable, keep its `code` asserted `0`, and add
  `expect(result.out).toContain('gate.tests-baseline-missing')`: this is @ac-1's exit code 0 seen through the CLI.
  It is not on the verify line because its name carries neither a marker nor `risk:`; it must pass.

Interface, in `packages/core/src/gate/plan.ts`:
- `export const testsBaselineMissing: GateRule['check']`. It returns `[]` when `laneTicket(snapshot, id)` is
  undefined, when `snapshot.config?.tests?.report === undefined` (D-05: the key's presence alone counts,
  whatever its value), or when `snapshot.testsBaseline !== undefined`. Otherwise one draft:
  `{ file: 'accord/tests-baseline.txt', reason }`, where the reason asks rather than orders (D-06), naming the
  plan stage's baseline tests step as the only place it is answered:
  `accord/tests-baseline.txt does not exist, so every test case already in the suite counts as untraced at the Done gate; ask the owner, at the plan stage's baseline tests step and never before it, whether to run accord tests baseline`.
  It does not read a plan, so it fires whether or not `plan.md` exists.
- In `packages/core/src/gate/rules.ts`, import it and append the row
  `{ id: 'gate.tests-baseline-missing', level: 'warning', profiles: ['build', 'maintain'], check: testsBaselineMissing }`
  as the last row of `PLAN_RULES`. Update the `PLAN_RULES` doc comment, which says every row is an error, to say
  every row is an error except this one, which only asks. D-04: no config key or flag silences it; it stays on
  every run while the file is absent.

Spec: in `docs/specs/2026-10-12-workflow-layer-design.md` §7, after the sentence listing what
`accord gate plan` checks, add one sentence: for a lane ticket, while `tests.report` is set in
`accord/config.yml` and `accord/tests-baseline.txt` does not exist, it adds `gate.tests-baseline-missing`, a
warning that asks the owner whether to run `accord tests baseline`, answered at the plan stage's baseline step.

Must not change: every existing rule, level and reason in `gate/plan.ts` and `gate/rules.ts`; `READY_RULES` and
`DONE_RULES`; the verdict of every existing `lane-plan.test.ts`, `lane-flow.test.ts`, `gate.test.ts` and
`lane-commands.test.ts` case (each `gate plan` that exits 0 today still exits 0, since a warning never fails the
gate); `planHash` and the `plan_hash` write, which happen on every pass.

End by running `npm run build`.

## Task 2: tests baseline refuses a report older than the last commit
covers: @ac-5, D-07
files: packages/cli/src/commands/task-done.ts, packages/cli/src/commands/tests-baseline.ts, packages/cli/test/lane-commands.test.ts, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/cli/test/lane-commands.test.ts#ac-5-tests-baseline-refuses-a-report-older-than-the-last-commit (@ac-5), packages/cli/test/lane-commands.test.ts#risk:complex-branching-tests-baseline-writes-from-a-report-newer-than-the-last-commit

Tests first, top-level at the end of `packages/cli/test/lane-commands.test.ts`, each with a `30000` timeout like
the other git-backed top-level cases, using the module-level `REPORT_PATH`, `OLD` and `freshen`:
- `ac-5 tests baseline refuses a report older than the last commit`: `makeLaneRepo({ [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'util#formats-dates': 'passed' }) })`,
  `commitAll(repo)`, then `utimesSync(REPORT_PATH(repo), OLD, OLD)`. `run(['tests', 'baseline'], repo)` exits
  `2`, its `err` contains `run the tests again`, and `existsSync(join(repo, 'accord', 'tests-baseline.txt'))` is
  `false`.
- `risk:complex-branching tests baseline writes from a report newer than the last commit`: the same repository
  and report, `commitAll(repo)`, then `freshen(repo)`. `run(['tests', 'baseline'], repo)` exits `0`, its `out` is
  `wrote 1 case id to accord/tests-baseline.txt\n`, and the file exists. This guards the direction of the
  comparison: an inverted check passes the `ac-5` test and refuses every committed repository.

Interface:
- `packages/cli/src/commands/task-done.ts`: `staleReport` becomes `export function staleReport(ctx: CommandContext): string | undefined`.
  Its body, its `shortcut:` comment and its message
  (`<report> was written before the last commit; run the tests again`) are unchanged. It is shared, not copied.
- `packages/cli/src/commands/tests-baseline.ts`: import `staleReport` from `./task-done.js`. After the existing
  check that the report exists (`ctx.snapshot.tests === undefined`) and before the `writeFileSync`, when
  `ctx.snapshot.git?.commit !== undefined`, call `staleReport(ctx)`; a returned message is thrown as
  `new UsageError(message)` (exit 2), so nothing is written. With no commit there is nothing to compare against
  and no check runs (D-07). Add one line to the file's header comment saying it refuses a report older than HEAD,
  as `accord task-done` does.

Spec: in §9 of `docs/specs/2026-10-12-workflow-layer-design.md`, the **Baseline** row gains one sentence: it also
refuses, writing nothing, a report written before the HEAD commit, as `accord task-done` does.

Must not change: every `accord task-done` output and exit code (the `accord task-done` describe and the
top-level tag cases pass untouched); the existing `accord tests baseline` describe, whose repositories have no
commit and so reach no stale check, including `writes the untraced cases once and refuses a second time` and
`round-trips a case id that starts with # and skips empty-named cases with a notice`; the refusal order for no
`tests.report` and a missing report file, which still come first with their messages; the `wx` write and its
`already exists` refusal; the `tests baseline (refusal)` entry in `packages/cli/test/spawn-surface.test.ts`.

End by running `npm run build`.

## Task 3: The plan skill asks the owner before it creates the baseline
covers: @ac-4, D-01, D-02, D-03, D-06, D-08, D-09
files: packages/core/skills/plan/SKILL.md, packages/core/skills/plan/baseline.md (new), packages/core/skills/build/SKILL.md, packages/core/agents/planner.md, packages/core/test/stage-skills.test.ts, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/src/generated/skills.ts, packages/core/src/generated/agents.ts, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-plan/baseline.md (new), .claude/skills/accord-build/SKILL.md, .claude/agents/accord-planner.md
verify: packages/core/test/stage-skills.test.ts#ac-4-the-plan-skill-asks-the-owner-before-it-creates-the-tests-baseline (@ac-4)

Test first, top-level in `packages/core/test/stage-skills.test.ts`, below the existing describe, over its
`files` (the render output of `skillTargets(config)`):
`it('ac-4 the plan skill asks the owner before it creates the tests baseline')`.
- `skill` is the text of `.claude/skills/accord-plan/SKILL.md`; `ref` is the text of
  `.claude/skills/accord-plan/baseline.md`; assert both are non-empty, with a message naming the missing file.
- `step7` is `skill` from the index of `7. **Baseline tests.**` to the index of `8. **Finish.**`; assert both
  indexes are found, and that `step7` contains `./baseline.md` and `` `accord/tests-baseline.txt` ``.
- `ref` contains each of these phrases, collected into one list compared to `[]` so a failure names them all:
  `` ask the owner before running `accord tests baseline` ``,
  `` `accord/tests-baseline.txt` is absent ``,
  `after the owner has decided every failing case`,
  `in a commit of its own`,
  `Ruling: accord/tests-baseline.txt`,
  `` `tests.full` wrote no report ``.
- The line of `ref` holding `` `tests.full` wrote no report `` (found with `ref.split('\n').find(...)`, asserted
  defined) also contains `stop and tell the owner`, so the stop belongs to the missing-report case.
- `ref.indexOf('after the owner has decided every failing case')` is less than
  `` ref.indexOf('ask the owner before running `accord tests baseline`') ``: the failing cases are decided first.
It fails until `baseline.md` exists and step 7 points to it.

Interface (text; it names no other tool, and none of it holds the word for a finding level, a rule id,
`Ready` or `Done` as a word, `packages/`, a backslash, or a deferral word, which the
`render output invariants` cases in `packages/core/test/skills.test.ts` reject):
- `packages/core/skills/plan/baseline.md` (new), frontmatter `kind: reference` as `skills/review/record.md` has,
  heading `# The tests baseline`. Content, in this order:
  1. When `accord/config.yml` has no `tests.report`, skip this file: no question (D-02).
  2. When `` `accord/tests-baseline.txt` is absent ``, ask the owner before running `accord tests baseline`, and
     only after the owner has decided every failing case at the baseline, as step 7 says; the baseline then
     lists the failing cases too (D-01, D-02). Write the sentence so it carries the phrases
     `` ask the owner before running `accord tests baseline` `` and
     `after the owner has decided every failing case` verbatim, the second appearing first.
  3. What to show: the number of test cases no scenario names, and up to five of them, read from the lines
     `accord lint` prints for them, never a hand count. The owner chooses one of: create it, do not create it,
     or stop. Not creating it is allowed: `accord gate plan` keeps asking on every run and nothing records the
     choice (D-04).
  4. When `` `tests.full` wrote no report ``, stop and tell the owner; never write a report or run
     `accord tests baseline` against an old one. Write this sentence on one line, unwrapped, so the test
     finds both phrases on the same line.
  5. When `accord tests baseline` refuses because the report is older than the last commit: if
     `git diff --stat <baseline> HEAD` shows no change outside `accord/`, run `tests.full` once more and retry
     once; otherwise stop and tell the owner.
  6. On a yes, run `accord tests baseline` and commit `accord/tests-baseline.txt` in a commit of its own,
     holding that file alone, never with the `plan: <id> ready` commit of step 8, so it can be picked onto its
     own pull request (D-09). Write the phrase `in a commit of its own` verbatim. Then write into
     `accord/tickets/<id>/ledger.md`, under `## Rulings`, the line
     `Ruling: accord/tests-baseline.txt created at the plan baseline on the owner's yes — no task's files: line names it, so review would otherwise list it as undeclared — cost if wrong: review reports it as Extra`.
     The ledger is committed with the `plan: <id> ready` commit, which step 8 already makes when the ledger
     changed, so the baseline commit still holds that file alone. Write the phrase
     `Ruling: accord/tests-baseline.txt` verbatim. A resumed run that finds the file written but not committed
     does both here at step 8: commit the file alone, then add the Ruling when the ledger lacks it, before the
     `plan: <id> ready` commit.
  7. Teams (D-08): the file reaches the main branch in its own small pull request, holding that file alone,
     before other tickets plan. On a merge conflict in it, keep only the lines both sides hold, never the
     union: a dropped case then fails loudly at the gate instead of being exempted silently.
  8. Never create the file in any other step, stage, or agent.
- `packages/core/skills/plan/SKILL.md`:
  - frontmatter gains `loads: [plan/baseline.md]` after `kind: skill`, as `skills/review/SKILL.md` declares
    `loads: [review/record.md]`.
  - step 4 gains one sentence: when `accord gate plan` asks about the tests baseline, it is answered at step 7;
    never create `accord/tests-baseline.txt` earlier (D-06).
  - step 7 gains one sentence at its end: when `tests.report` is set and `` `accord/tests-baseline.txt` `` is
    absent, follow `./baseline.md` once the failing cases are decided.
  - step 8 gains one short sentence before its commit: when `git status` shows `accord/tests-baseline.txt` new,
    commit it in a commit of its own and add its Ruling to the ledger if absent, as `./baseline.md` says, before
    the `plan: <id> ready` commit (D-09). This covers a run that stopped between `accord tests baseline` and
    its commit; the detail lives in `baseline.md`.
  The rendered file stays at or under 5120 bytes (`MAX_SKILL_BYTES`; it is 4699 today, so the additions get
  about 420 bytes) and 120 lines; shorten the new sentences, never the existing ones, to fit. Keep every phrase
  the `plan` row of `REQUIRED` in `stage-skills.test.ts` asserts, `tests.full`, `step 7 does not re-run` and
  `plan: <id> ready` among them. A re-plan still skips step 7, so it asks nothing about the baseline.
- `packages/core/skills/build/SKILL.md` step 7, **Plan changed**: one sentence, `accord tests baseline` is never
  run in this stage; only the plan stage asks the owner about it. It stays under 5120 bytes (4540 today).
- `packages/core/agents/planner.md`: one rule line, the planner never creates `accord/tests-baseline.txt` and
  never plans a task that runs `accord tests baseline`; the plan stage asks the owner about it (D-06).
- Spec §7, the paragraph beginning `Before build, tests.full runs on the baseline`: add that, when
  `tests.report` is set and `accord/tests-baseline.txt` is absent, the plan stage asks the owner, after every
  failing case is decided, whether to run `accord tests baseline`, commits the file in a commit of its own on a
  yes, never with `plan: <id> ready` (D-09), stops when `tests.full` wrote no report, and ships the file to the main branch in its own pull request,
  resolving a conflict in it by keeping only the lines both sides hold.

Then run, in order: `npm run gen` (rewrites `packages/core/src/generated/skills.ts` and `agents.ts`),
`npm run build`, and `node packages/cli/dist/cli.js skills sync`, which writes the four `.claude/` copies,
`.claude/skills/accord-plan/baseline.md` among them. Then run the full core suite: the cases
`every SKILL.md is at most MAX_SKILL_BYTES bytes (spec §2)`, `every relative reference resolves inside the same render, for more than one roster (D-110)`,
the `no rendered text restates a rule the CLI enforces` case, `generated module matches skills/ (drift)`,
`generated module matches agents/ (drift)`, and every row of `stage skills name what the spec requires` and
`agents name what the spec requires` must pass. They are not on the verify line because their names carry no
`risk:` and no marker.

Must not change: every other step and rule of the plan, build and planner definitions; the `review` skill and
its `record.md`; every other rendered skill and agent byte for byte; `skills sync` output for the other files,
which report `unchanged`.
