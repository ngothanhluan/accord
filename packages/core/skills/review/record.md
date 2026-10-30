---
kind: reference
---

# The review record

`accord/tickets/<id>/review.md` holds one section per review round, in
order, and ends with the verdict.

Its first line is `Round record: 1`, above every heading, and its only headings are `## Round <n>` and `## Return from verify <sha>`.

```
## Round <n>

Must|Should|Nice <n> [patch|plan-gap|intent-gap]: <finding> — <file:line> — fixed in <sha> | deferred | open
```

- One `## Round <n>` section per round, the final review included, each
  listing that round's findings after merging and de-duplication, numbered
  within the round.
- Each finding carries its severity, its class, what it is, where it is,
  and what became of it: `fixed in <sha>` with the fix commit, `deferred`
  for a Nice finding written to the ledger under `## Deferred`, or `open`.
- A finding line starts with its severity word, `Must`, `Should` or `Nice`, never two of them or a question mark: accord refuses a round record whose severity it cannot read.
- Each round is written as it ends, the final review included, with every finding `open`, and committed before any fix executor is dispatched; each state then becomes `fixed in <sha>` or `deferred`.
- A round with no findings says `No findings`.
- Every `Confirmed wording-only: <path>` and `Not an interface: <path> — <reason>` line a reviewer reports is copied verbatim, one per line, into that round's section. Only the last `## Round` is read for them, so the last round, the final review, carries every one that still holds.

`accord round <id>` reads this record. A round at or after `escalation.fix_round_tier_up` in `accord/config.yml` (default 4) dispatches a fresh executor one model tier above the executor's configured model, passed as `model` on the dispatch itself: `haiku`, then `sonnet`, then `opus`; `opus` stays `opus`. `accord round` prints that model as `Fix executor model: <model>`; pass it on every fix executor dispatch of the round. On `refused:`, fix what it names and run `accord round <id>` again.

On `stop: report to owner`, printed from round 3 for a round that still reports a Should or a Must, and at the cap, show the owner what it prints: the open findings and the Approach. Say whether the open findings trace to the ticket or the plan, and ask whether to change course, accept the open findings, or allow more rounds; never report the work finished. Write the owner's answer in one of three forms:

- accepting the open findings: the last line of `review.md` is `verdict: accepted-by-owner "<the owner's sentence>"`;
- allowing more rounds: under `## Rulings` in the ledger, `Ruling: the owner allows <n> more review rounds after round <r> of cycle <k> — "<the owner's sentence>" — <cost if wrong>`, with r and k as the stop printed them;
- changing course: that same Ruling, with n the number of review rounds the owner names for the reworked code, written before a re-plan through `accord-plan`; after the rework the review goes on in the same cycle.

After a stop, `verdict: converged` needs a round after it, allowed by the owner, that reports no findings.

Before writing the verdict, run `accord round <id>`. Exit 0, or a stop whose only `Reason:` is that the cap is reached and no owner Ruling allows more, lets the verdict be written; any other stop goes to the owner as above first.

The single last line of the file is the verdict:

- `verdict: converged` when, after the final review, no Must is open and
  every Should is fixed with that command passing: `tests.affected` over
  the files the fix touched, or `tests.full` when `tests.affected` is not
  configured or finds no test file;
- `verdict: accepted-by-owner "<the owner's sentence>"` when the run
  stopped with findings still open, at the cap or after the final
  re-review, and the owner accepted them, quoting what the owner said.

Nothing follows the verdict line until a return from verify.

Back from verify, or back at review for any change made after the verdict, `accord anchor` prints `Review base: <sha>` while `review.md` ends with its verdict. Then, before the next round, run `git log -1 --format=%H -- accord/tickets/<id>/review.md` and append `## Return from verify <sha>` with the sha it prints; accord confirms from git that `review.md` ended with its verdict at that commit. The rounds after it are a new cycle counted from 1; a model tier once raised stays raised.
