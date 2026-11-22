---
name: accord-debug
description: Use when a lane M ticket's work behaves unexpectedly, a test fails for a reason nobody has shown, or a fix did not work, or on an issue no ticket holds, where it finds the root cause and fixes nothing. Finds the root cause with a debugger before any fix, fixes it once through a fresh executor test first, and keeps its state in debug.md.
license: MIT
argument-hint: "[ticket id] [failure]"
kind: skill
loads: [accord/ids.md, accord/worktree.md, debug/debug-comment.md, debug/debug-free.md, shared/ask.md, shared/failure.md, shared/resume.md]
---

This stage finds a root cause before anything is fixed. You run it in the
main session and orchestrate: debuggers investigate, executors fix.

## Steps

1. Run `accord anchor`. When it prints nothing and no ticket id was given, no ticket holds the issue: follow `./debug-free.md` instead of the steps below. For a failure found after verify, read `./failure.md`.
   When `./failure.md` runs `accord worktree open`, follow `./worktree.md`.
   A run `/accord-resolve-pr` starts for a comment on its pull request follows
   `./debug-comment.md` at steps 3 and 4.

2. **State.** Everything this stage learns lives in
   `accord/tickets/<id>/debug.md`: the symptom, the hypotheses, the
   probes and what they showed, and each fix tried with its count. It
   survives compaction; after one, read it before anything else. Start
   each episode by appending `## Episode <n>` to it; an episode is open while
   no `## Resolved` heading follows its `## Episode <n>` heading.

3. **Root cause.** No fix before a root cause. On a `debug.md: resume the debugger` line (no other `Unfinished:` line counts), resume per `./resume.md`; else dispatch a fresh
   `accord-debugger` with the path of the ticket file and the failing
   command and its output, or the report alone when it gives neither. It writes `debug.md`:
   - competing hypotheses, each with evidence for and against, ranked
     before any is tested;
   - one hypothesis is always that the test or measurement itself is
     wrong;
   - the first test is the cheapest probe that separates the top two.

   It returns the root cause with evidence, the failing reproduction
   test it proposes, and the hypotheses ruled out. Commit `debug.md`.
   A root cause without evidence is a hypothesis: dispatch once more with
   the path of `debug.md`. A second return without evidence (flaky,
   timing, cannot reproduce): stop and ask the owner with the ranked
   hypotheses and what was ruled out.

4. **Fix.** The main session never edits product code: the fix goes
   through the executor path of the build stage of `/accord`. Note the HEAD sha. Write the root cause, its evidence and the reproduction test to a findings file outside the working tree and build the brief with `accord brief <id> --fix <findings file> --out fix-brief.md`. The executor starts with that failing
   reproduction test, greps every caller of what it changes, and fixes
   the root cause once in shared code, never at each caller. Dispatch a fresh `accord-executor` with the path its `file:` line prints. `BLOCKED` on a test that is
   not a criterion test: ask the owner, as there is no plan task to
   re-plan. Route every other stop as the build stage of `/accord` does.

5. **Check.** Run the `tests.affected` command over the files changed
   since the noted sha. Copy every Ruling in the executor's report into
   `accord/tickets/<id>/ledger.md` under `## Rulings`. Record the fix and
   its result in `debug.md`, then commit `debug.md` with the ledger. The episode's
   commits before the first review round recorded after it opened are reviewed in a
   round headed `(added code round 1)`. A commit made after that round while the
   episode stays open is that round's fix: its files need a finding of that round or
   a Ruling.

6. **Failed fix.** A fix that leaves the symptom, or the reproduction
   test failing, counts one in `debug.md`. After one failed fix, dispatch
   one `accord-debugger` per remaining hypothesis, in parallel, each
   with the paths of the ticket file and `debug.md` and its one
   hypothesis. In a parallel round they write nothing and return
   evidence; you merge every result into `debug.md` and commit it. Then
   back to step 4 with the root cause the evidence supports. No
   hypothesis left: back to step 3.

7. **Three.** After three failed fixes, stop: never a fourth. Each fix
   uncovering a new problem elsewhere means the architecture is wrong,
   not the hypothesis. Write the architectural question in `debug.md`
   and ask the owner, with what was tried. An answer at step 7 that changes
   the ticket's type follows `./ids.md`. This count is this stage's
   own; an executor's three attempts at one problem inside a task also
   end at the owner.

8. **Resolved.** Append `## Resolved` to `debug.md`, one line: the root
   cause and the fix commit, or the owner's decision. Commit it.

9. Next: run `accord anchor` again and go to the stage it prints now. When that is
   the build stage of `/accord`, start at its step 3 for the task that entered debug:
   run the affected tests and `accord task-done` before dispatching
   anything.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary:
  an executor gets it inside its brief.
- The main session orchestrates and never edits product code.
- A winning hypothesis that a criterion test is wrong is the owner's
  call: ask. Never edit the test yourself.
- "It's probably X", "just try X", and "one more attempt" mean back to
  step 3, except after three failed fixes: step 7.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
  Read `./ask.md` before any question to the owner.
