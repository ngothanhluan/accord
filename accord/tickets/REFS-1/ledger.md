# Ledger

## Tasks

## Rulings

- Ruling: (architect) @ac-3's "no line count is read" is proven by the cited path being in the tree but absent from `snapshot.files`, not by a spy — core never reads file text (D-84) — cost if wrong: one extra assert.
- Ruling: (architect) the criterion tests go in `packages/core/test/gate.test.ts` through an in-memory edit of the PASS fixture, not a new fixture with a golden — no criterion needs a golden — cost if wrong: one fixture added later.
- Ruling: (approach) the two critic round-2 Shoulds (punctuation after a dot run; `..\` as a parent) are fixed inside the chosen option rather than a third critic round — both follow D-02 and D-08 and change no criterion — cost if wrong: a gap the review stage catches.
- Ruling: (planner) the bare `.md`/`.ts` exclusion goes in `shaped()`, not `token()` — `token()` stays about trimming, same result — cost if wrong: a test id literally named `.md` stops matching.
- Ruling: (planner) the risk tests for `...packages/x.ts` and `."packages/x.ts"` are guards that pass before and after — today's code already strips those dots; they pin D-08 — cost if wrong: none.
- Ruling: (planner) @ac-3 is its own task, split from the dot rule — the `POSITION` change is independent — cost if wrong: one extra task record.
- Ruling: (plan) baseline suite at 982ad34 green, 1169 passed, before the first build commit — cost if wrong: none.

## Deferred
