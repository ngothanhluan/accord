# accord workflow layer: design

Date: 2026-10-12. Status: draft for owner review. Working name during design: "superflow".

accord 0.1.0 is a contract (folder, formats, gates, CLI). This design adds the layer that was missing: a
complete development workflow, run through a coding agent, that captures intent thoroughly, picks the
lightest approach that works, builds with independent verification, and scales from a one-line fix to a
whole project. The product keeps the name accord; every skill and agent is prefixed `accord-`.

## 1. Intent

**Why.** The owner wants one workflow for daily development that stops the agent from working against
their intent. Observed failures, all of them occasional: the agent decides ambiguous points on its own or
reverses a settled decision; adds or changes things nobody asked for; reports done when work is partial or
unverified; argues with or routes around an explicit instruction. Generated unit tests are a named pain:
too many, many redundant, suites of 1000+ tests that slow development.

**For whom.** The owner first, on personal and company projects; a team of two or three people next.

**Success.**
- Intent is validated before code, and stays binding until Done.
- The chosen approach is the lightest one that meets the acceptance criteria.
- Tests are exactly enough: every test traces to an acceptance criterion or a named risk.
- Quality holds equally for a small fix and for a new project.
- The owner reviews an approach brief and a final evidence report, not plans or (on personal projects) diffs.
- Model and effort per agent role are chosen by measurement, not opinion.

**Non-goals.** Supporting every runtime identically for orchestration (gates stay runtime-neutral). A
ticket system. Calling a model from the accord CLI. Retroactively rewriting existing test suites without
the owner's approval.

## 2. Principles

1. **Enforce mechanically what matters; keep prose short.** A rule an agent can ignore will be ignored
   eventually. Gates, `task-done`, and CI enforce; skill text guides. Each skill targets under 5 KB.
2. **One ruleset.** Competing rule sources in context are themselves a cause of apparent disobedience.
   accord ships one compact ruleset and the owner disables overlapping plugins in accord repositories.
3. **Every size runs the same six stages**, compressed rather than skipped:
   `intent → approach → plan → build → review → verify`.
4. **Ask about intent, never guess it.** Anything touching intent, a veto, an acceptance criterion, or a
   public interface stops the run. Anything else the agent decides is recorded as a Ruling.
5. **Makers never grade their own work.** Executors report; the orchestrator re-runs verification;
   fresh-context reviewers and verifiers judge.
6. **Lightest working solution.** At design time and at code time, climb the ladder and stop at the first
   rung that fully works: does it need to exist; already in the repo; standard library or platform;
   installed dependency; minimum new code. Never cut validation at trust boundaries, data-loss handling,
   security, accessibility, or anything asked for.
7. **Files in git are the memory.** Ticket, plan, ledger, review record, and verification live in
   `accord/tickets/<id>/`, survive context compaction, and are readable by teammates.

## 3. Lanes

| | **S: small fix** | **M: feature** | **L: epic** | **P: project** |
|---|---|---|---|---|
| Example | bug, copy change, one flag | one story | 3 to 10 related stories | greenfield |
| intent | two-line write-back in chat: "Understood: … / Done when: …" | ticket `tickets/<id>.md` | epic ticket plus story list | `product/`: vision, business rules, stack decisions |
| approach | implied | brief in ticket; **owner approves** | brief plus story split; **owner approves** | roadmap of epics; **owner approves** |
| plan | none | planner writes, critic checks, CLI gate | one plan per story, waves from `depends_on` | rolling wave: only the next epic in detail |
| build | main session | one fresh executor per task, sequential | independent stories in parallel worktrees | each epic runs lane L |
| review | one reviewer pass | loop to convergence | per story, then epic integration | as L |
| verify | short report in chat | AC report, try-steps, Rulings | as M plus epic summary | as L, per epic |
| CLI gates | affected tests pass | `ready`, `plan`, `done` | as M, plus epic gate | as L |

**Classification.** The agent proposes a lane with its reason, out loud, and the owner may override.
Signals that lift S to M: new user-visible behaviour; a public interface or schema changes; auth, money, or
data deletion is touched; more than one plausible reading; more than about three files expected.

**Ratchet.** Hidden complexity found mid-task lifts the lane: stop, say so, re-enter at the new lane's
first incomplete stage. A lane never drops mid-task.

**S proceeds without waiting** when the request has a concrete anchor (file, symbol, error message, or
expected behaviour) and one plausible reading. Otherwise the agent asks exactly one question and waits.

**No milestones or phases.** Grouping is the epic (`parent:`), order is `depends_on`, and progress is
derived by `accord status`. A release mark, when one is wanted, is a git tag; accord does not read it.

**Lifecycle.**
- *Dropped.* `status: dropped` with a `## Dropped` section giving the reason in one line. `status` and
  `next` skip it, and a live ticket whose `depends_on` names a dropped ticket is a lint error: its plan is
  re-thought, not silently unblocked (phase 2).
- *Stale.* `config.yml` gains `stale_days` (default 14). `status` flags a ticket whose last commit on any
  of its records is older than that and whose stage is not done; a claim branch `t/<id>` with no commit in
  that window is flagged the same way (phase 2).
- *Retro.* When an epic's last story reaches done, `accord-verify` writes `tickets/<epic>/retro.md`: what
  the Corrections and Rulings across its stories have in common, and whether any belongs in `product/`
  rules. A correction that repeats across tickets is the only thing promoted; nothing else is kept as
  memory (phase 4).
- *Epic readiness.* `accord gate ready <epic>` additionally requires every story to exist, to name the
  epic in `parent:`, and to have a `depends_on` graph with no cycle (phase 4).

## 4. Intent stage

### Ticket format (lane M and above)

Frontmatter keeps the 0.1.0 schema and adds `lane` (`M | L | P`) and `depends_on` (list of ticket ids).
Body headings, in order:

| Heading | Content | Written by |
|---|---|---|
| `## Intent` | at most five lines: why, for whom, success measure, non-goals | agent drafts, owner approves |
| `## Acceptance criteria` | Gherkin, `@ac-1` … `@ac-n`, two to five scenarios | agent drafts, owner approves |
| `## Vetoes` | what the owner forbids, verbatim | owner's words, agent records |
| `## Decisions` | `D-01` …: settled answers, each with the owner's source sentence quoted | agent records |
| `## Corrections` | every "no, I meant…", verbatim, append-only | agent records |
| `## Open questions` | any unchecked item blocks Ready | |
| `## Approach` | see section 7 | agent drafts, owner approves |

`## Requirements` (EARS) becomes optional and its lint rules are off by default; acceptance criteria are
the contract that is tested and verified. `## Plan` moves out of the ticket into `tickets/<id>/plan.md`.

### Interview (`accord-intent`, main session)

1. **Look before asking.** `accord-scout` gathers facts from the code. Anything the code answers is not
   asked. A question about an existing project cites the file that prompted it.
2. **Confirm the parts.** Before the first score, the agent lists the request's top-level parts and the
   owner confirms them.
3. **Score ambiguity** on four dimensions (goal, scope boundary, constraints, acceptance), shown to the
   owner after each round.
4. **One question per message, aimed at the weakest dimension**, multiple choice where possible, the
   recommended option first with its reason.
5. **Stop** when the score (the mean, where 0 is unambiguous) is at or below 0.2 and no dimension is above
   0.4, or when the owner says "enough" (recorded in the ledger as `Ruling: interview stopped by the owner
   at <score>`). Before stopping, the agent asks once for the smallest version that still counts as done.
6. **Write back** the understanding, separating what the owner said from what the agent assumed.
7. **Audit once.** `accord-auditor`, in a fresh context reading only the ticket, tries to find two
   different readings of each acceptance criterion. A criterion with two readings goes back to the owner.

### Keeping intent binding

- Every downstream agent receives the ticket verbatim, never a summary.
- `approved_hash` (new) covers Intent, Acceptance criteria, Vetoes, Decisions, Corrections, and Approach,
  recorded by `accord approve <id>` after the owner's explicit yes. Ready, Plan, and Done fail when the hash
  is missing or no longer matches. The existing `ac_hash` keeps failing Done when acceptance criteria change after Ready.
- A decision the ticket does not cover is a **Ruling** in the ledger:
  `Ruling: <what> — <why> — <cost if wrong>`. A decision that touches intent, a veto, an acceptance
  criterion, or a public interface is not a Ruling: the run stops and asks.
- The intent-axis reviewer quotes the acceptance criterion, veto, or correction each finding violates.

## 5. Team coordination

- **Dependencies.** `depends_on: [T-12]`. Lint fails on unknown ids and cycles. A ticket counts as done
  when its records say done in the tree the command runs on; being merged is implied by its presence in
  that tree.
- **Claim.** Starting a ticket means pushing a branch `t/<id>`. `accord status` reads remote branches and
  their commit authors to show who holds what. Nothing is committed to the default branch to claim. When a
  tracker adapter is configured, its assignee is used instead.
- **Waves.** Within an epic, stories without unmet dependencies form a wave and may run in parallel.
- Shared rules live in the repository (`product/`, `config.yml`), so a teammate who clones gets the same
  workflow, routing, and test policy. Gates run in CI, so a teammate without the workflow cannot merge
  past them.

## 6. Entry point

`/accord` with no argument shows a dashboard built from `accord status --json`. The model formats it and
never infers state.

```
Hello an                                      (from git config)

YOURS IN PROGRESS
  T-12  Login API          build 3/5 · stopped at: review round 2

TEAM
  T-15  Session store      done
  T-19  Export CSV         in progress · binh
  T-18  Login UI           blocked by T-12

READY TO PICK UP
  T-21  Password reset     M · passed Ready

→ [Continue T-12]  [Pick up T-21]  [New request]  [Details…]
```

- "Stopped at" is read from the ledger, so **Continue** resumes at the exact step after compaction or in a
  new session, and never re-runs completed tasks.
- The anchored stage `intent` covers the approach too: Continue resumes at the owner's yes in
  `accord-approach` when `## Approach` is written, otherwise in `accord-intent`; at `done` it says so and
  offers the dashboard (phase 2).
- `/accord <request>` goes straight to lane classification and the intent stage.
- `accord next` lists tickets that passed Ready, are unblocked, and are unclaimed.
- Session start prints one line ("1 in progress, 1 ready · type /accord"), not the dashboard.

### Re-anchoring after compaction

A summary loses detail, and an orchestrator that continues from a summary drifts from the owner's intent.
The intent therefore never has to be remembered; it is re-read.

- The active ticket is the current branch `t/<id>`, read from git, never from memory.
- `accord anchor [<id>]` (new) prints the active ticket's stage and its position from the ledger ("build
  3/5, next: task 4"), then, verbatim, its Intent, Vetoes, Decisions, Corrections, and Rulings.
  Without an id it uses the current branch; on a branch that names no ticket it prints nothing and exits 0.
- The SessionStart hook on `compact`, `resume`, and `clear` runs `accord anchor`, so its output is in context
  immediately after every compaction.
- Every stage skill runs `accord anchor` as its first step, so every stage transition re-anchors.
- A correction is written to `## Corrections` before any other action. A correction that exists only in
  the conversation is lost at the next compaction.
- Stage skills (`accord-intent`, `accord-approach`, `accord-plan`, `accord-build`, `accord-review`,
  `accord-verify`, `accord-debug`, `accord-test-diet`, `accord-bench`) are callable directly; `/accord`
  routes to them so nobody has to remember the names. They replace the 0.1.0 role skills `accord-ba` and
  `accord-dev`.

## 7. Approach and plan

### Approach (owner-approved)

1. `accord-architect` reads the ticket, runs an impact analysis (callers, interfaces, tests, config,
   exports the change must reach), and proposes two or three options in ladder order.
2. The first option is the first rung of the ladder that fully works (principle 6). The second and third
   climb further only where a criterion or constraint needs it. Each added layer of complexity names the
   acceptance criterion or constraint that requires it, or is dropped.
3. `accord-critic`, in a fresh context, argues the strongest case against the chosen option and checks it
   against Vetoes, Decisions, and Corrections. This runs for every lane M and above. The chosen option is
   the one the architect recommends unless the owner picked another. The critic receives the chosen
   option's text only, never the architect's reasoning, risk line, or recommendation, so its review stays
   independent. Every finding the chosen option keeps goes into the brief's risks, Must findings first; a
   Must that breaks a Veto, Decision, or Correction rules the option out, and the critic runs again on the
   first option in the architect's ladder order that is not yet ruled out, or the owner is asked when none
   is left. When the ticket touches auth, money, migration, or data deletion, the critic adds three
   concrete failure scenarios.
4. The owner receives a brief of about 15 lines under `## Approach`: chosen option and why, rejected
   options and why, affected areas, risks, and test strategy (which criterion is tested at which layer).
   For a ticket that touches auth, money, migration, or data deletion, the risks include the critic's three
   failure scenarios and how each is undone. If the owner picks another option, the critic runs on it
   (step 3) and the brief is rewritten before the owner is asked again.
   Approval runs `accord approve`; `accord gate ready` then requires intent, criteria, and approach.

### Plan (machine-facing; the owner does not need to read it)

`accord-planner` writes `tickets/<id>/plan.md`, one `## Task <n>: <title>` section per task. Each task
carries a `covers:` line (criteria and decisions), a `files:` line, a `verify:` line naming the test report
case ids that prove it, then prose for the executor: interface (consumes, produces) and the test written
first. A path in `files:` that the task creates is followed by the token `(new)`. A task that edits an
existing file names the behaviour there that must not change. Tasks are ordered so the one that proves the
approach end to end (the wiring) comes first; polish comes last. A task fits in about half of an
executor's context; the planner splits anything larger, and the critic flags a task that does not.

`accord gate plan <id>` (new) checks mechanically: the approval still matches the ticket; every `@ac-n`
is covered by a task; every `D-nn` is cited; every task has `covers:` and `verify:`; nothing in `covers:`
is foreign to the ticket; no "TODO", "TBD", "placeholder", "v1", "for now", "later" in task text; every
path in `files:` exists at `baseline:` unless it is marked `(new)` (`gate.task-file-unknown`, phase 2).
On a pass it writes `plan_hash:`, the hash of the plan below its frontmatter, into `plan.md`, as
`gate ready` writes `ac_hash` (phase 2).
`accord-critic` checks meaning: no veto violated, nothing beyond the criteria, the approved approach
followed. It checks that an executor holding only the ticket and one task could finish that task without
asking; a task that fails this is a Should. It also argues goal-backward: assuming every task passes its
`verify:` line, does the `## Intent` hold for the person it names? A plan that covers each criterion on
paper but leaves the intent unmet (a step nobody wired, a state nobody reaches) is a Must (phase 2). At
most three revision rounds, then the owner is told, and is shown the revision with the fewest Must
findings and the round it came from; the run does not continue on a failing plan.

`plan.md` frontmatter carries `baseline:`, the commit the plan was written against. `accord gate plan`
checks that it names a commit that is an ancestor of `HEAD`, and `accord review-package <id>` diffs from
it when no base is given, so review always sees the whole ticket and nothing before it (phase 2).
Only the first plan sets `baseline:`. A re-plan, after a change of course or a review plan gap, keeps
`baseline:` and every task the ledger records with its number, numbers new or changed tasks after the
highest, keeps `(new)` relative to the baseline, and does not re-run the baseline tests; the critic and
`gate plan` run as usual (phase 2).

Before build, `tests.full` runs on the baseline. Any failing case is shown to the owner, who decides
whether it is fixed first or tracked as its own ticket; the agent never ignores it on its own. The plan
stage then ends with a commit whose subject is `plan: <id> ready`; build starts only when the last commit
touching `plan.md` carries it, and otherwise the plan stage resumes (phase 2).

### Slicing by review mode

`config.yml` gains `review: { mode: human | outcome }`. Absent means `human`, the 0.1.0 behaviour.

- `human` (company projects): the planner groups tasks into slices. Each slice becomes one pull request,
  at most `review.max_pr_lines` changed lines (default 400, added in phase 4), green on its own, covering a
  stated subset of criteria. Slicing is decided at plan time, not after the code exists.
- `outcome` (personal projects): one branch, no slicing; the owner reads the evidence report, not the diff.

## 8. Build

- In lane M and above the main session orchestrates and never edits code. In lane S it does the work.
- One fresh `accord-executor` per task (several small same-shaped edits may be one task). Its brief comes
  from `accord brief <id> <task>` (new): the ticket verbatim plus that task. It never receives chat history.
- Executor rules:
  - Write the task's criterion test first. Show it failing, then passing. Both outputs go in the report.
  - Fix small bugs and blockers it meets, and log them.
  - Stop and return `BLOCKED` with a question when the work would change architecture or a public
    interface, or would cross a veto.
  - At most three attempts per problem.
  - No new package without asking.
  - Any file outside the plan's list is declared with a reason.
  - Never edit the ticket or `plan.md`, and never weaken a criterion test after showing it fail. A test
    that seems wrong is `BLOCKED` with the reason.
- Report: at most 15 lines. `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, commits, test evidence,
  files touched, Rulings.
- Where a stop goes: `BLOCKED` on an architecture change is a change of course (below); `BLOCKED` after
  the third failed attempt on one problem, or for a new package, goes to the owner, never to a fresh
  executor for more tries.
- **Change of course.** When the approved approach cannot work, the run stops. The orchestrator writes a
  change note under `## Approach`: what failed, which finished tasks still hold, and the proposed new
  approach. Because `approved_hash` covers `## Approach`, the owner's new yes and a new `accord approve`
  are required; then only the tasks the change touches are re-planned. The approach is never re-planned
  quietly.
- `accord task-done <id> <task>` (new) writes the ledger line only when every case the task's `verify:`
  line names is recorded `passed` in the test report, the report was written after the current commit, and
  the plan below its frontmatter still matches the `plan_hash:` that `gate plan` wrote when it last passed.
  The orchestrator runs the tests (`tests.affected`) and then `task-done`; the executor's claim alone records
  nothing. The CLI never runs a test command itself: it spawns only `git`, so the check is the report, the
  same evidence the Done gate reads.
- **Context budget.** An executor never relies on compaction. One that nears its context limit stops,
  commits what is finished, and returns `BLOCKED: context` with what remains. The orchestrator dispatches a
  fresh executor with the verbatim brief plus the diff and ledger so far. A fresh context that re-reads the
  brief is more faithful than a compacted one.
- Lane M runs one executor at a time. Lane L runs independent stories in parallel worktrees.
- `tickets/<id>/ledger.md` (committed) holds task lines, Rulings, and deferred items. The dashboard and
  Continue read it.

## 9. Test policy

| | |
|---|---|
| **Required** | each acceptance criterion has exactly one behaviour test, named by the scenario's existing `@test:<id>` tag, written before the code, at the cheapest layer that observes the behaviour |
| **Allowed** | extra tests whose name carries `risk:<kind>`, where kind is one of: parsing, money or calculation, security or permission, concurrency, data loss, complex branching, regression of a real bug |
| **Forbidden** | tests that restate the implementation, getter or setter tests, tests that only assert on mocks, a second test of behaviour a criterion test already covers at another layer |
| **Speed** | during build only `tests.affected` runs (a command template in config, for example `vitest related {files}` or `dotnet test --filter …`, added in phase 2 with its consumer); `tests.full` runs at Done and writes the report `tests.report` names; the verify report lists slow tests |
| **Enforced** | a test case in the report that is not named by any scenario's `@test:<id>`, does not carry `risk:` in its name, and is not listed in `accord/tests-baseline.txt` is `lint.test-untraced` (a warning in `accord lint`, once any lane ticket exists) and `gate.test-untraced` (an error at Done for lane tickets). Any failed case in the report is `gate.suite-not-passed` |
| **Baseline** | `accord tests baseline` (new) writes `accord/tests-baseline.txt` once, listing the untraced cases that exist when a project adopts the policy. It refuses when the file exists: the baseline only shrinks, by hand or through the test diet, so it cannot become a way past the gate. A legacy case that is edited keeps its id and stays in the baseline; that is the known limit of a report-based check |
| **Legacy** | not retroactive. `accord-test-diet` maps an existing suite to behaviours, finds duplicates, restating tests, and trivial tests, and **proposes** deletions backed by a mutation check showing the reduced suite catches the same injected faults. The owner approves before anything is deleted |

A bug ticket's criterion is the reproduction, so a bug fix starts with a failing reproduction test under
the same rules.

## 10. Review

**Input.** The ticket verbatim, the approach, a review package from `accord review-package <id>` (new:
commit list, stat, the changed files no task's `files:` names under `## Undeclared files`, and the diff
with context), and the ledger. The executor's report is context, never evidence. The reviewer accepts an
undeclared file only against a reason the ledger records as a Ruling; any other is an Extra finding.

**Two axes, reported separately.**
- *Intent*: each finding quotes the criterion, veto, or correction it violates. A category "Extra" covers
  anything nobody asked for. A spec's silence is not permission.
- *Quality*: correctness, safety, simplicity (delete, reuse, standard library, not needed), the test
  policy of section 9, and the repository's written conventions and `product/` rules. Anything a configured
  linter or type check already enforces is skipped.

**Findings.** `Must | Should | Nice`, numbered. No concrete failing case, no finding.

**Split by diff size and risk** (thresholds in config, tuned by the benchmark):

| Review unit diff | Reviewers |
|---|---|
| up to about 500 lines | one reviewer, both axes |
| about 500 to 1500 | split by lens, in parallel: intent reviewer and quality reviewer on the whole diff |
| over about 1500, or an epic | split by area (module or story) times lens, plus one integration reviewer reading only interfaces and the links between areas |
| risk flag (auth, money, migration, data deletion) | add a security reviewer in parallel, at any size |

The review unit is the slice under `review: human` (usually one reviewer, since slices are at most 400
lines) or the ticket under `review: outcome`. Independent slices are reviewed in parallel. In phase 2 the
review unit is the ticket under both modes: `review-package` has no `--head`, so a slice cannot be isolated
yet; per-slice review arrives with that option (phase 4). The orchestrator
merges and de-duplicates findings before the fix loop.

**Loop to convergence.**
- Before fixing, each finding is marked `patch`, `plan-gap`, or `intent-gap`. Only patches enter the fix
  loop. A plan gap goes back to the plan stage, where the critic runs again. An intent gap stops the run
  and asks the owner.
- Fix every Must and Should marked `patch`, then re-review only the fix diff, with one reviewer.
- Converged means zero Must and zero Should. Nice findings go to the ledger as deferred, not fixed.
- If round three still finds a new Must, the orchestrator says whether it traces to the ticket or the
  plan; if it does, the owner is asked before round four.
- At most five rounds. Rounds four and five use a fresh executor one model tier higher.
- At the cap the run stops and reports the open findings to the owner. It never reports done.
- After convergence, one fresh final reviewer on the strongest configured model reads the whole diff once
  (for diffs over about 1500 lines the integration reviewer takes this role). One fix and one scoped
  re-review follow if needed, then stop.
- `tickets/<id>/review.md` records each round and ends with `verdict: converged` or, after the cap,
  `verdict: accepted-by-owner` with the owner's sentence quoted.

## 11. Verify and Done

`accord gate done <id>` keeps the 0.1.0 checks (scenario tags, JUnit results, skipped is not passed,
`verification.md` commit match, `ac_hash`) and adds:
- no untraced test case in the report (`gate.test-untraced`, section 9);
- no failed case in the report (`gate.suite-not-passed`); the report is the output of `tests.full`;
- `review.md` ends with `verdict: converged` or `verdict: accepted-by-owner`;
- every task in `plan.md` has a ledger completion line;
- the approval exists and still matches the ticket (`gate.approval-missing`, `gate.approval-stale`, section 4).

The commit match (`commit:` in `verification.md`, `verified_commit:` in the ticket) passes when the recorded
commit equals the gated commit, or when it is an ancestor of the gated commit and every file changed since
is the ticket's own record (`accord/tickets/<id>.md` or a file under `accord/tickets/<id>/`). A commit
cannot hold its own sha, so without this the records could never be committed and still pass on the branch
(phase 2).

`accord-verifier`, in a fresh context, writes `verification.md`. It distrusts summaries and checks four
levels per criterion: exists, substantive (not a stub), wired (reachable from its entry point), and data
flows (not hard-coded). What it cannot prove is recorded as `Result: blocked` (needs a human), never pass.

The owner's report:
- one line per criterion: pass or fail, with evidence (test and output, or a screenshot for UI);
- three to five "try this" steps that take about two minutes;
- all Rulings, ordered by their cost if wrong, highest first;
- deferred items;
- what was not checked;
- slow tests.

**UI tickets** (`ui: true` in frontmatter, phase 4).
- *Intent.* Each screen the ticket touches gets `@ui` scenarios for its states, not only the happy path:
  empty, loading, error, overflow (long text, many rows), and narrow width. The design reference, when
  there is one, is linked from the ticket as in 0.1.0; none is required.
- *Review.* `accord-reviewer` gains a `ui` lens: the states above, accessibility (keyboard, focus, contrast,
  labels), the project's own components and tokens before new ones, and fidelity to the design reference.
  `config.yml` may name a design skill installed in the repository (`ui: { skill: <name> }`); the lens then
  delegates the craft judgement to it and keeps the contract checks itself. The named skill only builds or
  reviews inside a stage; it never runs its own intent, planning, or done steps, because two orchestrators
  on one ticket is how intent drifts.
- *Verify.* Each `@ui` scenario's evidence is a screenshot per state under `tickets/<id>/evidence/`, named
  by scenario, at the commit `verification.md` records. Without a browser available the result is
  `blocked`, never pass.

**Human layer by review mode.** Under `outcome`, the owner reads the report, tries the steps, and ticks
`verified:` (still bound to commit and `ac_hash`); `## Verification notes` is not required. Under `human`,
the 0.1.0 human layer stays, and each slice's pull request is reviewed by a person.

## 12. Agents and model routing

| Agent | Job | Access | Starting hypothesis |
|---|---|---|---|
| main session | intent interview, orchestration | full | owner's session model |
| `accord-scout` | facts from code, impact analysis | read | Haiku, low |
| `accord-auditor` | two readings per criterion | read | Opus, medium |
| `accord-architect` | options, lightest first | read | Opus, high |
| `accord-critic` | approach and plan critique | read | Opus, high |
| `accord-planner` | `plan.md` | writes plan only | Opus, medium |
| `accord-executor` | one task, test first | writes code | Sonnet, medium; one tier up in fix rounds 4 and 5 |
| `accord-reviewer` | one agent, parameter lens: intent, quality, security, integration | read | Sonnet, high; final review Opus, high |
| `accord-verifier` | `verification.md` | writes verification only | Sonnet, medium |
| `accord-debugger` | root cause with competing hypotheses | read, runs commands | Opus, high |

The roster is design. **The model and effort column is a hypothesis** until the benchmark (section 13)
replaces it.

Routing is configuration:

```yaml
models:
  executor:       { model: sonnet, effort: medium }
  reviewer:       { model: sonnet, effort: high }
  reviewer.final: { model: opus,   effort: high }
escalation:
  fix_round_tier_up: 4
```

`accord skills sync` renders these values into each agent file's frontmatter, extending the existing
skills-as-data rendering. Agents install for the `claude` runtime only, at `.claude/agents/accord-<role>.md`.
The final reviewer is a second render of the reviewer, `accord-final-reviewer`, routed by `reviewer.final`.
A fix round at or after `fix_round_tier_up` passes a one-tier-higher model on the dispatch itself, in the
order `haiku`, `sonnet`, `opus`; an executor already on `opus` stays there.

**Debugging** (`accord-debug`, run by `accord-debugger`): no fix before a root cause; competing hypotheses,
each with evidence for and against, ranked before any is tested; one hypothesis is always that the test or
measurement itself is wrong; the first test is the cheapest probe that separates the top two; after one
failed fix, one debugger per remaining hypothesis runs in parallel; session state written to a file so it
survives compaction (each episode in `debug.md` opens with `## Episode <n>` and stays open while the
file's last `## ` heading is not `## Resolved`); grep every caller and fix the root cause once in shared code; the fix starts with a
failing reproduction test; after three failed fixes, stop, question the architecture, and ask the owner.

## 13. Benchmark harness

Purpose: replace the hypothesis column of section 12 and the review thresholds of section 10 with
measurements, and re-run when new models ship.

- **Fixtures.** Small repositories with known answers, varied deliberately: TypeScript and .NET,
  greenfield and brownfield, small and large diffs, bug kinds (logic, boundary, concurrency, security,
  intent drift). Start with 20 to 30 scenarios per role and add scenarios, rather than repeats, while
  results stay close.
- **Roles first measured.** Reviewer: planted defects caught, false findings, at several diff sizes.
  Executor: hidden tests passed, lines of code, tests written, test-policy compliance, and quality against
  task size, which sets the "half an executor's context" budget of section 7 from measurement. Then critic
  (plans with planted gaps) and auditor (deliberately ambiguous criteria).
- **Matrix.** Each role tries only plausible cells. Cells for xhigh are included for the critic, final and
  security reviewers, architect in lane P, and debugger; the hypothesis is that longer reasoning pays there
  and may hurt executors (more code and tests) and ordinary reviewers (more false findings). Three runs per
  cell.
- **Selection rule.** Per role, take the best-quality cell as reference and choose the cheapest cell (tokens
  times wall time) whose quality is within 5 % of it. The critic and the final reviewer always take the
  best cell. Results report confidence intervals; differences inside the noise count as ties and go to the
  cheaper cell.
- **Runner.** Headless `claude -p` with clean settings so no other plugin's rules interfere. The runner is a
  development script outside the core CLI, so the CLI still never calls a model.
- **Output.** `bench/results/<date>.md` with a proposed `models:` diff. The owner approves before config
  changes.

## 14. Rules, hooks, installation

- **Ruleset**, about 1 to 2 KB, injected on SessionStart (startup, resume, clear, compact) and SubagentStart
  (for `accord-*` agents): ask on intent, vetoes, and interfaces; the ladder and the never-cut list; scope is
  impact; evidence before claims; the test policy; the Ruling format; end each reply with what was skipped,
  what was not checked, and any risk. The main session writes Rulings to the ledger, while an accord agent
  lists them in its report and keeps the closing lines inside its own report format (phase 2).
- **Anchor**: the same SessionStart hook runs `accord anchor` on `compact`, `resume`, and `clear` (section 6).
- **Hooks are minimal.** No completion-claim Stop hook in this version: regex detection is brittle, and
  enforcement lives in `task-done`, the gates, and CI. Add one only with evidence it is needed.
- `accord init` and `accord skills sync` write hooks into the project's `.claude/settings.json`, so teammates
  get them by cloning, and keep every setting and hook accord did not write. Each hook is one command with no
  shell syntax, `npx --yes <package>@<version> hook <event>`: `session-start` on `startup` (ruleset and the
  one-line summary), `session-resume` on `resume|clear|compact` (ruleset and `accord anchor`), and
  `subagent-start` for agents named `accord-*` (the ruleset as added context). The ruleset is a shipped
  template.
- On the owner's machine, overlapping workflow plugins are disabled in accord repositories and the
  workflow-enforcement block is removed from the project `CLAUDE.md`.

## 15. Changes to accord 0.1.0

| Keep | Change | Add |
|---|---|---|
| `accord/` folder; frontmatter schema; Gherkin parsing; `@test:<id>`; `ac_hash`; JUnit scan; skills rendered from data; version pin; CI workflow | EARS optional, lint off by default; role skills replaced by stage skills; ticket headings per section 4; `## Plan` moves to `plan.md`; `## Verification notes` required only under `review: human`; constraint "identical behaviour in four runtimes" becomes "gates identical everywhere, orchestration Claude Code first" | frontmatter `lane`, `depends_on`, `approved_hash`, `status: dropped` (phase 2), `ui` (phase 4); `plan.md` `baseline:` and `plan_hash:`, `files:` marker `(new)` (phase 2); config `review.mode` (phase 1), `stale_days` (phase 2), `review.max_pr_lines` and `ui.skill` (phase 4), `models`, `escalation`, `tests.affected`, `tests.full` (phase 2); commands `approve`, `gate plan`, `task-done`, `brief`, `review-package`, `tests baseline`, `anchor`, `next`, extended `status`; rules `lint.test-untraced`, `lint.depends-*`, lane Ready, plan, and Done rules, `gate.task-file-unknown` (phase 2); undeclared files in `review-package` (phase 2); per-ticket `plan.md`, `ledger.md`, `review.md`; `accord/tests-baseline.txt`; agents `accord-*`; hooks; benchmark harness |

**Skills.** `roles:` stays in the config schema so no config breaks. `skills sync` always installs `/accord`
(source `skills/accord/`, installed as `accord`) and the stage skills (`accord-<stage>`); `designer` installs
only when listed. A leftover `accord-ba` or `accord-dev` directory is reported as an orphan, never deleted.

**Compatibility.** The `lane` key opts a ticket into this contract. A ticket without `lane` keeps every
0.1.0 rule (EARS, `## Plan`, Verification notes), so existing tickets need no migration. Each config key is
added in the phase that first reads it.

The `.planning/` directory of the previous planning process is archived when phase 2 below starts.

## 16. Build order

1. **Contract.** Ticket format, schema keys, and the new gates and commands. CLI only, fully testable.
2. **Skills and agents v1.** `/accord`, intent, approach, plan, build, review, verify, debug, plus the
   ruleset hooks; `status: dropped`, `stale_days`, the plan `baseline:`, the critic's goal-backward
   question, the plan's file and hash checks, and the review package's undeclared files (sections 3, 7,
   8, and 10). Dogfood: run one lane M ticket of accord through accord.
3. **Benchmark.** Reviewer and executor fixtures; replace the default routing.
4. **Lanes L and P.** Waves, worktrees, slicing for `review: human`, epic gate, epic readiness, retro, and
   UI tickets (sections 3 and 11).
   The plan for a story reads the Corrections and Rulings of its finished sibling stories, and two stories
   whose plans name the same file never share a wave.
5. **Test diet**, and benchmark fixtures for critic and auditor.

The benchmark follows phase 2 because it measures prompts that must exist first.

## 17. To verify during implementation

These are assumptions, not established facts. Each is checked at the start of the phase that needs it.

- Headless `claude -p` accepts model and effort selection and a clean settings file (phase 3).

Checked at the start of phase 2, against the runtime's published documentation on 2026-10-12:

- Agent frontmatter accepts `effort` (`low | medium | high | xhigh | max`) beside `model` (an alias or a full
  model id), plus `tools` as an allowlist.
- `enabledPlugins` is per key, and local settings override project settings, which override user settings.
  The owner turns overlapping plugins off in the uncommitted local settings file of an accord repository;
  accord ships nothing that names them.
- SessionStart matches `startup`, `resume`, `clear`, and `compact`, and its standard output enters context.
  SubagentStart matches on the agent's `name` and adds context through
  `hookSpecificOutput.additionalContext`. A hook command runs in bash, or in PowerShell on Windows without
  bash, so accord writes commands with no shell syntax at all.
- A subagent compacts by the same rule as the main session. Whether SessionStart fires inside a subagent is
  not documented; the design does not need it, because a subagent gets the ruleset from SubagentStart and
  its ticket from a verbatim brief.
- A PreCompact hook can only block or observe; it cannot add to the summary. Re-anchoring therefore stays on
  SessionStart `compact`, and accord installs no PreCompact hook.
- `git for-each-ref` over `refs/heads/t/` and `refs/remotes/` gives the claim author on Windows and POSIX
  (phase 1).

## 18. Out of scope for this design

Orchestration on runtimes other than Claude Code. A completion-claim Stop hook. Cross-model review panels.
A server or hub. Automatic deletion of existing tests.
