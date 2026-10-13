# Phase 2 dogfood: STALE-1

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

1. **No step writes the `@test:` tags (note 13).** The template says "add it during build"; executors never
   edit the ticket; build and verify say nothing. Every lane M ticket fails `gate done`. Workaround used:
   the main session wrote each tag after `task-done`. Fix: `accord-build` step 3 writes the scenario's tag
   from the task's `verify:` id once `task-done` passes.
2. **No step creates `accord/tests-baseline.txt` (note 14).** A repository adopting phase 2 without it gets
   `gate.test-untraced` on every pre-existing test at Done. Workaround: ran `accord tests baseline` at the
   plan baseline (1137 ids). Fix: `accord-plan` runs it when the file is absent.
3. **A test name starting with `@` breaks the tag (note 16).** A name like `@test:ac-1 …` puts a second `@`
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
