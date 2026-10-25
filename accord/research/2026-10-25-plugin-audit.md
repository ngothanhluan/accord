# Plugin audit: what accord can still take from superpowers, ponytail and Anthropic's skill guide

Date: 2026-10-25. Repository at `f417f46`. Feeds ST-LN-10, ST-LN-43, ST-LN-56 and the three tickets queued with this record.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement.

## Question

The owner runs two user-level Claude Code plugins beside accord, and both inject rules at every session start and into every subagent: superpowers 7.0.0 (commit `bb92a77`) and ponytail 5.1.0 (commit `9b58c1f`). The owner wants to remove both, because accord was meant to hold their rules. Owner, 2026-10-25: "audit it and see whether anything can still be improved from those 2 repos", then "what do you think? read Anthropic's best practices carefully", then, to the recommendation below: "agreed. remember to save the research and have the related tickets reference it."

## Method

- Read in full: every accord skill and agent as rendered in `.claude/skills` and `.claude/agents` (sources in `packages/core/skills`, checked for the references below), the session-start rules, and the 41 draft tickets.
- superpowers: every `SKILL.md`, the subagent-driven-development prompts (`implementer-prompt.md`, `task-reviewer-prompt.md`, `re-review-prompt.md`), `requesting-code-review/code-reviewer.md`, `test-driven-development/writing-good-tests.md`, the systematic-debugging references, and `writing-skills/anthropic-best-practices.md` (Anthropic's skill authoring guide, 1,151 lines). Scripts and `testing-skills-with-subagents.md` were only skimmed.
- ponytail: the five skills (`ponytail`, `-audit`, `-review`, `-debt`, `-gain`) and the hooks, `ponytail-map.js` included.
- Filter, from Anthropic's guide ("Build evaluations first"): take guidance only for a failure accord has already shown, or for a path accord lacks entirely. Every claim is a reading of files; nothing was benchmarked.

## 1. What accord already covers

| Plugin part | accord |
|---|---|
| ponytail scope, the lightest-change ladder, "never cut", the closing one or two lines | rules 3, 4 and 7, almost word for word |
| ponytail "small test or assert-based self-check" | rule 6 is stricter: one behaviour test per criterion, other tests named `risk:<kind>` |
| superpowers brainstorming | `accord-intent` and `accord-approach` |
| writing-plans, executing-plans, subagent-driven-development | `accord-plan` and `accord-build`, one fresh executor per task, `accord brief`, `accord task-done` |
| test-driven-development | rule 6 and the executor's failing test first |
| systematic-debugging | `accord-debug` and `accord-debugger`: ranked competing hypotheses, three failed fixes stop at the owner |
| requesting-code-review, verification-before-completion | `accord-review`, `accord-verify`, rule 5 |
| using-git-worktrees, finishing-a-development-branch | `accord worktree`, `finish.md`, `ci.md` |
| The Ruling format | identical in both: `Ruling: <what> — <why> — <cost if wrong>` |

The two plugins also conflict with accord: ponytail allows an assert-based self-check where rule 6 does not, and superpowers' session-start skill tells the agent to load a skill before any reply, which competes with `/accord` routing (`brainstorming` against `accord-intent`, `systematic-debugging` against `accord-debug`).

## 2. Accord against Anthropic's skill authoring checklist

| Check | accord |
|---|---|
| `SKILL.md` body under 500 lines | holds: the longest is 99 lines |
| Description in the third person, saying what the skill does and when to use it | holds. superpowers' `writing-skills` says the opposite (triggers only, never what it does, from one observed run); Anthropic's guide asks for both, so accord's descriptions stay as they are |
| Consistent terms, no time-sensitive text | holds |
| Feedback loops; plan, validate, execute | holds: `accord gate ready`, `accord gate plan`, `accord task-done` |
| Reference files one level deep from `SKILL.md` | **fails**, see below |
| "Solve, don't punt": scripts handle their errors rather than leave them to the agent | partly: `worktree.md` (87 lines) maps about fifteen kinds of CLI output line to actions the agent must take |
| Evaluations with a baseline, tested on each model used | partly: a benchmark exists (`docs/benchmark/round-1.md`, ST-LN-46), with no rule that a wording change runs against a baseline |

Nested references, counted on the rendered skills: Anthropic's guide says an agent may read a file it reached through another reference file only partly (for example with `head -100`), so every reference file should be linked from `SKILL.md` itself.

- `accord-debug`: `SKILL.md` links `failure.md`; `worktree.md` is reached only through `failure.md`, and `ids.md` only through `worktree.md` (three levels).
- `accord-verify`: `worktree.md` is reached only through `failure.md`, and `ids.md` only through `worktree.md`.
- `accord`: `finish.md` is reached only through `lane-s.md`.

## 3. Gaps found, and what became of each

| # | Source | Gap in accord | Evidence in accord | Decision |
|---|---|---|---|---|
| 1 | superpowers `re-review-prompt.md` | The reviewer of a fix diff gets the ticket, the package and the ledger, never the findings it re-checks (accord-review steps 3 and 4, lane-s step 4); the main session writes `fixed in <sha>`. Plan critique already closes a finding only when a critic lists it after `fixed:`. superpowers' re-reviewer gives each finding ADDRESSED or NOT ADDRESSED and sends anything outside the fix diff to the ledger | 64% of late findings were caused by the previous fix (`2026-10-25-review-convergence.md`) | merged into ST-LN-56 |
| 2 | Anthropic guide | Reference files nested two or three levels deep, listed in section 2 | Anthropic's documented partial-read failure | new ticket ST-LN-58 |
| 3 | superpowers `writing-plans` "Review Focus" | The planner lists no failure modes the ticket implies but no test exercises. superpowers names the five most likely to bite a user and adds a test for each to the task that owns the code | BUG-LN-3: YAML spellings found only in review rounds 4 and 5 | merged into ST-LN-10 |
| 4 | superpowers `writing-good-tests.md` | No rule stops a new hollow test: name the production change that would make the test fail before writing it; never compute the expected value with the code under test; no change detector (a test only an intended change can fail); a mental mutation check before finishing | ST-LN-43 A0, a test made hollow by a later commit | merged into ST-LN-43 |
| 5 | superpowers `implementer-prompt.md`, `test-driven-development` | The executor shows its test failing, but not that it fails for the expected reason (a missing feature, not a typo or import error); it never re-reads its own diff before `DONE`; warnings in test output pass unremarked | the fix-induced late findings above | new ticket ST-LN-59 |
| 6 | superpowers `receiving-code-review` | Nothing says what to do with a teammate's review comments on a ticket's pull request (searched `packages/core`: no match) | none yet; accord targets teams | new ticket ST-LN-60 |

Rejected, with the reason:

- ponytail's `shortcut: <limit>, <upgrade>` comment and `/ponytail-debt` ledger: a Ruling already records the same decision with its cost if wrong.
- ponytail's codebase map (top-level names per folder, by regex, injected at session start): `accord-scout` and the architect's impact list already find what exists, with `path:line`; the map is approximate and costs context in every session.
- ponytail's "holds under the expected load" review lens: no accord record shows a load finding; revisit when one does.
- superpowers' "Declined to judge" list for the final reviewer: belongs with ST-LN-57's fixed review scope if that ticket wants it, not a ticket of its own.
- superpowers' extra debugging techniques (compare with similar working code, wait on a condition instead of a sleep, bisect a polluting test): no flaky case in the records yet.
- superpowers' review after every task, and resuming the same implementer for fix rounds 1 to 3: the first is a large change the convergence study does not support (late findings came from fixes, not misses); the second gives up accord's fresh context per dispatch.
- superpowers' defense in depth (validate at every layer): works against rule 4's lightest change.
- Moving `worktree.md`'s output handling into the CLI, so it prints the next action: right direction under "solve, don't punt", but large; to be discussed on its own.

## Limits

Readings of files by one session; no plugin rule was run against accord's benchmark. The superpowers scripts were skimmed. The nested-reference counts come from the rendered skills; the sources in `packages/core/skills` were checked for `accord/SKILL.md`, `lane-s.md`, `verify/SKILL.md` and `shared/failure.md` only.
