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
| verify | short report in chat | AC report, try-steps, Rulings | as M plus epic summary | as L, per milestone |
| CLI gates | affected tests pass | `ready`, `plan`, `done` | as M, plus epic gate | as L |

**Classification.** The agent proposes a lane with its reason, out loud, and the owner may override.
Signals that lift S to M: new user-visible behaviour; a public interface or schema changes; auth, money, or
data deletion is touched; more than one plausible reading; more than about three files expected.

**Ratchet.** Hidden complexity found mid-task lifts the lane: stop, say so, re-enter at the new lane's
first incomplete stage. A lane never drops mid-task.

**S proceeds without waiting** when the request has a concrete anchor (file, symbol, error message, or
expected behaviour) and one plausible reading. Otherwise the agent asks exactly one question and waits.

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
2. **Score ambiguity** on four dimensions (goal, scope boundary, constraints, acceptance), shown to the
   owner after each round.
3. **One question per message, aimed at the weakest dimension**, multiple choice where possible, the
   recommended option first with its reason.
4. **Stop** when the score is at or below 0.2 and no dimension is below its floor, or when the owner says
   "enough" (recorded in the ledger as a warning).
5. **Write back** the understanding, separating what the owner said from what the agent assumed.
6. **Audit once.** `accord-auditor`, in a fresh context reading only the ticket, tries to find two
   different readings of each acceptance criterion. A criterion with two readings goes back to the owner.

### Keeping intent binding

- Every downstream agent receives the ticket verbatim, never a summary.
- `approved_hash` (new) covers Intent, Acceptance criteria, Vetoes, Decisions, Corrections, and Approach,
  recorded by `accord approve <id>` after the owner's explicit yes. Ready fails when the hash no longer
  matches. The existing `ac_hash` keeps failing Done when acceptance criteria change after Ready.
- A decision the ticket does not cover is a **Ruling** in the ledger:
  `Ruling: <what> — <why> — <cost if wrong>`. A decision that touches intent, a veto, an acceptance
  criterion, or a public interface is not a Ruling: the run stops and asks.
- The intent-axis reviewer quotes the acceptance criterion, veto, or correction each finding violates.

## 5. Team coordination

- **Dependencies.** `depends_on: [T-12]`. Lint fails on unknown ids and cycles. A ticket counts as done
  when it passed Done and is merged into the default branch, both read from git.
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
- `/accord <request>` goes straight to lane classification and the intent stage.
- `accord next` lists tickets that passed Ready, are unblocked, and are unclaimed.
- Session start prints one line ("1 in progress, 1 ready · type /accord"), not the dashboard.

### Re-anchoring after compaction

A summary loses detail, and an orchestrator that continues from a summary drifts from the owner's intent.
The intent therefore never has to be remembered; it is re-read.

- The active ticket is the current branch `t/<id>`, read from git, never from memory.
- `accord anchor [<id>]` (new) prints, verbatim, the active ticket's Intent, Vetoes, Decisions, and
  Corrections, then its stage, its position from the ledger ("build 3/5, next: task 4"), and its Rulings.
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
   exports the change must reach), and proposes two or three options.
2. The first option is always the lightest that works (principle 6). Each added layer of complexity names
   the acceptance criterion or constraint that requires it, or is dropped.
3. `accord-critic`, in a fresh context, argues the strongest case against the chosen option and checks it
   against Vetoes, Decisions, and Corrections. This runs for every lane M and above.
4. The owner receives a brief of about 15 lines under `## Approach`: chosen option and why, rejected
   options and why, affected areas, risks, and test strategy (which criterion is tested at which layer).
   Approval runs `accord approve`; `accord gate ready` then requires intent, criteria, and approach.

### Plan (machine-facing; the owner does not need to read it)

`accord-planner` writes `tickets/<id>/plan.md`, one `## Task <n>: <title>` section per task. Each task
carries a `covers:` line (criteria and decisions), a `files:` line, a `verify:` line naming the test report
case ids that prove it, then prose for the executor: interface (consumes, produces) and the test written
first. A task fits in about half of an executor's context; the planner splits anything larger, and the
critic flags a task that does not.

`accord gate plan <id>` (new) checks mechanically: every `@ac-n` is covered by a task; every `D-nn` is
cited; every task has `covers:` and `verify:`; nothing in `covers:` is foreign to the ticket; no "TODO",
"TBD", "placeholder", "v1", "for now", "later" in task text.
`accord-critic` checks meaning: no veto violated, nothing beyond the criteria, the approved approach
followed. At most three revision rounds, then the owner is told; the run does not continue on a failing
plan.

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
- Report: at most 15 lines. `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, commits, test evidence,
  files touched, Rulings.
- `accord task-done <id> <task>` (new) writes the ledger line only when every case the task's `verify:`
  line names is recorded `passed` in the test report, and the report was written after the current commit.
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
commit list, stat, diff with context), and the ledger. The executor's report is context, never evidence.

**Two axes, reported separately.**
- *Intent*: each finding quotes the criterion, veto, or correction it violates. A category "Extra" covers
  anything nobody asked for. A spec's silence is not permission.
- *Quality*: correctness, safety, simplicity (delete, reuse, standard library, not needed), and the test
  policy of section 9.

**Findings.** `Must | Should | Nice`, numbered. No concrete failing case, no finding.

**Split by diff size and risk** (thresholds in config, tuned by the benchmark):

| Review unit diff | Reviewers |
|---|---|
| up to about 500 lines | one reviewer, both axes |
| about 500 to 1500 | split by lens, in parallel: intent reviewer and quality reviewer on the whole diff |
| over about 1500, or an epic | split by area (module or story) times lens, plus one integration reviewer reading only interfaces and the links between areas |
| risk flag (auth, money, migration, data deletion) | add a security reviewer in parallel, at any size |

The review unit is the slice under `review: human` (usually one reviewer, since slices are at most 400
lines) or the ticket under `review: outcome`. Independent slices are reviewed in parallel. The orchestrator
merges and de-duplicates findings before the fix loop.

**Loop to convergence.**
- Fix every Must and Should, then re-review only the fix diff, with one reviewer.
- Converged means zero Must and zero Should. Nice findings go to the ledger as deferred, not fixed.
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
- every task in `plan.md` has a ledger completion line.

`accord-verifier`, in a fresh context, writes `verification.md`. It distrusts summaries and checks four
levels per criterion: exists, substantive (not a stub), wired (reachable from its entry point), and data
flows (not hard-coded). What it cannot prove is recorded as `Result: blocked` (needs a human), never pass.

The owner's report:
- one line per criterion: pass or fail, with evidence (test and output, or a screenshot for UI);
- three to five "try this" steps that take about two minutes;
- all Rulings;
- deferred items;
- what was not checked;
- slow tests.

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
replaces it. Fable is a candidate for the critic and the final reviewer.

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
skills-as-data rendering.

**Debugging** (`accord-debug`, run by `accord-debugger`): no fix before a root cause; competing hypotheses,
each with evidence for and against; session state written to a file so it survives compaction; grep every
caller and fix the root cause once in shared code; the fix starts with a failing reproduction test; after
three failed fixes, stop, question the architecture, and ask the owner.

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
  what was not checked, and any risk.
- **Anchor**: the same SessionStart hook runs `accord anchor` on `compact`, `resume`, and `clear` (section 6).
- **Hooks are minimal.** No completion-claim Stop hook in this version: regex detection is brittle, and
  enforcement lives in `task-done`, the gates, and CI. Add one only with evidence it is needed.
- `accord init` writes hooks into the project's `.claude/settings.json`, so teammates get them by cloning.
- On the owner's machine, overlapping workflow plugins are disabled in accord repositories and the
  workflow-enforcement block is removed from the project `CLAUDE.md`.

## 15. Changes to accord 0.1.0

| Keep | Change | Add |
|---|---|---|
| `accord/` folder; frontmatter schema; Gherkin parsing; `@test:<id>`; `ac_hash`; JUnit scan; skills rendered from data; version pin; CI workflow | EARS optional, lint off by default; role skills replaced by stage skills; ticket headings per section 4; `## Plan` moves to `plan.md`; `## Verification notes` required only under `review: human`; constraint "identical behaviour in four runtimes" becomes "gates identical everywhere, orchestration Claude Code first" | frontmatter `lane`, `depends_on`, `approved_hash`; config `review.mode` (phase 1), `review.max_pr_lines` (phase 4), `models`, `escalation`, `tests.affected`, `tests.full` (phase 2); commands `approve`, `gate plan`, `task-done`, `brief`, `review-package`, `tests baseline`, `anchor`, `next`, extended `status`; rules `lint.test-untraced`, `lint.depends-*`, lane Ready, plan, and Done rules; per-ticket `plan.md`, `ledger.md`, `review.md`; `accord/tests-baseline.txt`; agents `accord-*`; hooks; benchmark harness |

**Compatibility.** The `lane` key opts a ticket into this contract. A ticket without `lane` keeps every
0.1.0 rule (EARS, `## Plan`, Verification notes), so existing tickets need no migration. Each config key is
added in the phase that first reads it.

The `.planning/` directory of the previous planning process is archived when phase 2 below starts.

## 16. Build order

1. **Contract.** Ticket format, schema keys, and the new gates and commands. CLI only, fully testable.
2. **Skills and agents v1.** `/accord`, intent, approach, plan, build, review, verify, debug, plus the
   ruleset hooks. Dogfood: run one lane M ticket of accord through accord.
3. **Benchmark.** Reviewer and executor fixtures; replace the default routing.
4. **Lanes L and P.** Waves, worktrees, slicing for `review: human`, epic gate.
5. **Test diet**, and benchmark fixtures for critic and auditor.

The benchmark follows phase 2 because it measures prompts that must exist first.

## 17. To verify during implementation

These are assumptions, not established facts. Each is checked at the start of the phase that needs it.

- Claude Code agent frontmatter accepts an `effort` field alongside `model` (phase 2).
- Project-level `.claude/settings.json` can disable user-level plugins; if not, the owner disables them at
  user level (phase 2).
- Headless `claude -p` accepts model and effort selection and a clean settings file (phase 3).
- `git for-each-ref` over `refs/heads/t/` and `refs/remotes/` gives a reliable claim author on both Windows
  and POSIX (phase 1).
- Whether Claude Code compacts a subagent's context on its own, and whether a SessionStart `compact` hook
  fires inside a subagent. The design does not depend on either (section 8 hands off instead of compacting),
  but the answer decides whether the anchor also needs a SubagentStart path (phase 2).
- Whether a PreCompact hook can add instructions to the compaction summary itself (phase 2).

## 18. Out of scope for this design

Orchestration on runtimes other than Claude Code. A completion-claim Stop hook. Cross-model review panels.
A server or hub. Automatic deletion of existing tests.
