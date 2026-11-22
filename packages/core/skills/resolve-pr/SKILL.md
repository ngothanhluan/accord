---
name: accord-resolve-pr
description: Use when someone asks to handle the feedback on a pull request. A fresh read-only judge checks every comment before any fix, fixes what holds through the ticket's stages, and replies are posted only after the owner's yes.
license: MIT
argument-hint: "<PR | ticket id>"
kind: skill
loads: [accord/ids.md, accord/worktree.md, shared/ask.md, shared/failure.md, shared/judge.md]
---

# Comments on a ticket's pull request

`/accord-resolve-pr <PR or ticket id>` handles the feedback on a ticket's pull request and resolves its threads; it takes a number, a link or a ticket id; with nothing, ask for it in one question and run nothing.

This applies when someone asks you to handle the comments on ticket <id>'s
pull request while it is open and not merged (`gh pr view <branch> --json
state` prints `OPEN`): lane M from verify on, lane S from its step 6. Never
read a pull request's comments unasked. Given a number or a link, <id> is the
ticket whose `branch` in `accord status --json` is the pull request's
branch (`gh pr view <link> --json headRefName`). Work in the ticket's worktree: when
this session is not in it, first run `accord worktree open <id> --continue`
and follow `./worktree.md`, then step 2 of the Continue steps of `/accord` only (`accord anchor`); after a `stop:`
line, ask the owner to type, in the session opened there, `/accord-resolve-pr <id> `
followed by the request, in place of the line it prints, and stop here.

1. **Read.** Take each review thread, each top-level comment and each
   review's summary as one comment, a reply inside a thread being part of
   that thread, by a person whoever it is, the owner included; a failed
   check follows `./failure.md` instead.
2. **Judge.** Before fixing any comment, dispatch a fresh `accord-judge` for
   each comment, as `./judge.md` says, given the ticket file
   `accord/tickets/<id>.md` and the path the `file:` line of
   `accord related <id> --for judge --out judge-input.md` printed; it marks each comment holds, does not hold, or
   unclear, with evidence, and you route each comment by its verdict as
   `./judge.md` says, never judging one yourself while that agent is
   available to you. With no comment, there is nothing to judge or fix; say
   so and stop. A bug claim holds only on a failing test, which `./judge.md`
   says how to get. A comment from the
   owner takes the same steps, and goes under `## Corrections` only when
   it changes the intent or a criterion and the owner confirms it.
3. **Unclear first.** When any comment is unclear (its verdict is `unclear`
   with neither a `reproduce:` nor a `to owner:` line), draft a question to its
   author for its thread, show those drafts to the owner and post them
   only after the owner's yes. Fix no comment until every unclear comment
   is answered, in its thread by its author or in the chat by the owner,
   since comments may be related.
4. **Conflicts.** When a comment asks for something a Veto, Decision or
   Correction of the ticket forbids or settles otherwise, or the judge's
   `to owner:` line says it touches the intent, a Veto, a Decision or a
   Correction, stop handling every comment and ask the owner about that
   one, naming the Veto, Decision or Correction. Fix no comment until the owner answers. This
   comes before step 3: post no question while a conflict is open.
5. **Fix.** Only once steps 3 and 4 are clear: a comment that holds and
   reports a failure in the work follows `./failure.md` from its step 1,
   through `accord-debug`, in lane M only; in lane S it is fixed as the
   lane S steps say, a bug getting a failing test first, then the fix and
   another review round. Classify each other comment that holds `patch`, `plan-gap` or
   `intent-gap` and handle them as the review stage of `/accord` handles one round's
   findings, the patch ones fixed together through a fresh executor in
   lane M, and by you yourself in lane S, which has no executor. The lane M executor's brief is
   `accord brief <id> --fix <findings file>`, built from those comments'
   findings as the review stage builds it. The fix
   then takes the path `./failure.md` gives a failure reported after
   verify: one new review round and then verify again for lane M, the
   lane S steps for lane S.
6. **Reply.** Before a reply says a comment was fixed in a commit, dispatch
   a fresh `accord-judge` to re-check that comment against the new code, as
   `./judge.md` says, given `accord related <id> --for judge --out judge-input.md`
   run again: the reproducing test now passes, or the file and line
   it cited no longer show the claim. A comment that fails the re-check gets no fixed
   reply and goes back to step 5. Once every comment is fixed, declined or
   answered, draft one reply per comment: the commit that fixed it, the
   reason it was not changed, or the answer it took. A declined reply
   carries the judge's evidence. Show every draft to the owner together,
   apply the owner's changes to any of them, and post them to their
   threads only after the owner's yes. Post no reply, comment or review to
   the pull request before that yes; the fix commits are pushed as the
   stages of `/accord` already push them.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public interface stops the run and asks the owner. Read `./ask.md` before any question to the owner.
- `./ids.md` applies only where the `./worktree.md` lines name it.
