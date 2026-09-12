---
name: accord-debug
description: Use when encountering any bug, test failure, or unexpected behaviour, before proposing a fix. Finds the root cause first; a symptom fix is a failure.
---

<!-- Draft copy. Source of truth: docs/skills/debug.md in this repo.
     Phase 6 turns that source into core data and renders this file with a
     generated marker and hash; until then this copy is maintained by hand and
     can drift. Edit the source, not this file.
     The method below applies to any codebase. The bindings to ticket files and
     `accord status` activate once `accord init` has run in the repo. -->


A technique, not a role. The `dev` workflow loads it whenever a ticket has
`type: bug`, or whenever anything behaves unexpectedly mid-implementation.
It adds no artifact of its own: a bug is a ticket, and the ticket is the session.

Adapted from the `systematic-debugging` skill in the Superpowers plugin
(claude-plugins-official, 6.3.0), whose four-phase method and rationalization
table are kept. Removed: its cross-references to other Superpowers skills, and
every piece of session plumbing, which accord already gets from the ticket file.

## The iron law

```
NO FIX WITHOUT A ROOT CAUSE FIRST
```

A symptom fix is a failure, even when the symptom goes away. Following the
letter of this process while violating its spirit is also a failure.

## Where this sits in the ticket

A bug is a ticket with `type: bug`. Its acceptance criteria are Gherkin in the
form *Given the situation, When the action, Then the correct result* — which
makes the reproduction and the regression test the same artifact. Ready still
blocks until at least one scenario exists, so the first real work on a bug is
writing the scenario that reproduces it, not reading code.

Debugging state lives in `## Plan` in the ticket. There is no session file and
no resume command: `accord status` plus the ticket is the whole picture. When a
context is lost, re-read the ticket.

## Phase 1 — Root cause

Complete this before proposing any fix.

1. **Read the error completely.** Full stack trace, line numbers, error codes.
   The answer is in there more often than not.
2. **Reproduce reliably.** Exact steps. Every time, or intermittently? Not
   reproducible means gather more data — never guess.
3. **Check what changed.** `git diff`, recent commits, new dependencies,
   config, environment differences.
4. **Instrument every boundary in a multi-component system.** For each
   component boundary log what enters, what exits, and whether config and
   environment propagated. Run once to find *where* it breaks, then investigate
   only that component. Do not propose a fix during this step.
5. **Trace backward to the source.** When the error is deep in the stack: where
   did the bad value originate, what passed it, what called that. Keep going up
   until you reach the original trigger. Fix there, not where it surfaced —
   the guard belongs in the one function every caller routes through, not in
   each caller.

## Phase 2 — Pattern

1. Find similar code in this repo that works.
2. Read the reference implementation completely. Not skimmed — every line.
3. List every difference between working and broken, however small. "That
   can't matter" is how this phase fails.
4. Name the dependencies, settings, and assumptions the broken path needs.

## Phase 3 — Hypothesis

1. **One hypothesis, written down:** "X is the root cause because Y." Specific.
2. **Test it with the smallest possible change.** One variable.
3. Confirmed → Phase 4. Not confirmed → a *new* hypothesis, never another fix
   stacked on the last one.
4. When you do not know, say "I do not understand X". Do not narrate a guess
   as an explanation.

## Phase 4 — Fix

1. **Write the failing test first.** For a bug ticket this is the `@ac-n`
   scenario's test, tagged `@test:<id>` — the same test the Done gate will
   require. Confirm it fails for the right reason before touching the fix.
2. **One fix, at the root cause.** No "while I'm here", no bundled refactor.
3. **Verify.** The new test passes, nothing else broke, the reported symptom
   is actually gone.
4. **If the fix did not work:** stop and count attempts. Under three, return to
   Phase 1 with what you learned. Three or more, go to step 5 — do not attempt
   a fourth fix.
5. **Three failed fixes means the architecture is wrong, not the hypothesis.**
   The tell: each fix uncovers a new problem somewhere else, or the next fix
   needs "a big refactor". Stop and put the architectural question to the
   developer. This is not a failed hypothesis; do not treat it as one.

## Stop signals

Catching yourself mid-sentence on any of these means return to Phase 1:

- "Quick fix now, investigate later"
- "Just try changing X and see"
- "It's probably X"
- "I don't fully understand it but this might work"
- "Here are the main problems:" — a list of fixes, no investigation
- "One more attempt" after two failures
- Each fix revealing a new problem elsewhere

From the developer, these mean the same thing: *"Is that actually happening?"*
(assumed without verifying), *"Stop guessing"*, *"Are we stuck?"*.

## Rationalizations

| Excuse | Reality |
|---|---|
| Simple issue, process is overkill | Simple bugs have root causes too, and the process is fast on them |
| Emergency, no time | Systematic is faster than guess-and-check thrashing. Thrashing only feels faster |
| Try one fix first, then investigate | The first fix sets the pattern for the rest |
| Test after confirming the fix | Untested fixes do not stick, and the Done gate will ask for the test anyway |
| Several fixes at once saves time | You cannot tell which one worked, and you have added new bugs |
| Reference is long, I'll adapt the pattern | Partial understanding guarantees a bug |
| I can see the problem | Seeing a symptom is not understanding a cause |
| One more attempt (after two) | Three failures is an architecture problem. Stop fixing |

## When there really is no root cause

Genuinely environmental, timing-dependent, or external causes exist. If the
investigation lands there: document what was ruled out, implement the
appropriate handling (retry, timeout, a clear error), and add enough logging
that the next occurrence is diagnosable. Then say so plainly in
`verification.md`.

Note that most "no root cause" conclusions are incomplete investigations. Treat
your own as suspect until Phase 1 is genuinely complete.
