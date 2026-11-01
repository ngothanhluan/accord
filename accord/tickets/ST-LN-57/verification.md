---
ticket: "ST-LN-57"
commit: "993f6c76c0518aa3fafd63e8fa56b3c0ee0783b8"
reviewed_on: "2026-11-01"
---

## @ac-1 The next review round covers only code added after the last round

Result: pass

Evidence: Exists: packages/cli/test/review-scope-package.test.ts:9 (the @test tag's slug) and the implementation packages/cli/src/commands/review-package.ts, packages/cli/src/load/walk.ts, packages/core/src/round/scope.ts. Substantive: the test builds a real git repo with a round 1 head, a debug episode commit, and a conflicting merge of main with a hand resolution. It asserts that the package holds `Head: <merge>`, the debug fix, and `+resolved`, and that it omits `+export const main = 1;` (main's code) and `+export const a = 1;` (code from before the head). Wired: `review-package` is called through the CLI entry `run(['review-package','T-1'])`. packages/cli/src/commands/review-package.ts is changed in this branch. A loop-round `--base` is refused (exit 2, "--base is accepted only for the final review"), and lane S takes no `--base`. Data flows: the test reads review.md back with `parseRounds` and gets version 2 with `rounds[0].head` equal to the real commit sha, so heads come from git, not constants. I ran `npx vitest run` on this file and on review-scope-gate.test.ts; all 4 files and 11 tests passed.

## @ac-2 From round 3, a new finding outside the last fix's files blocks only with evidence

Result: pass

Evidence: Exists: packages/core/test/finding-evidence.test.ts:17 and packages/core/src/round/evidence.ts. Substantive: the test covers each Then clause. A Must outside the fix files in round 3 fails with a reason naming round 3, finding 1 and src/b.ts. It passes with `test:`, `command:`, `risk: data-loss` or `risk: security`, or when carried. A deferred finding passes only with a Ledger line `review 3.1` (wrong number or cycle still fails). Files changed by a code-and-records commit count as fix files; a file changed only by a records-only commit does not. D-08 is covered: a deferred finding with its line lets `nextRound` return `next` at round 4 and leaves no `gate.review-rounds` finding. Without the line it still stops. Wired: packages/core/src/gate/rules.ts:70 and :170 register `gate.finding-evidence` (FINDING_EVIDENCE) in the done gate, and the tests call `gateDone`. packages/cli/src/commands/gate.ts:54 loads the git facts with `withRoundFacts` for `gate done`; packages/cli/test/review-scope-gate.test.ts (real git) passed. Data flows: fix ranges come from round-facts.ts and walk.ts, not from typed values. I ran the file with vitest: it passed.

## @ac-3 Code added by a debug episode or a merge starts its own round 1 for the evidence rule

Result: pass

Evidence: Exists: packages/core/test/finding-evidence.test.ts:82. Substantive: with a ticket that reached round 4 and a round 5 marked `added`, the Must in src/z.ts is named as "round 5 of cycle 1, finding 2", and the Should in src/m.ts (a file the merge changed) is not asked. At round 7, which is the added code's own round 3, the finding in src/m.ts is asked, and round 6 is not. `roundText(nextRound(...))` still shows "round 5 of cycle 1", so ST-LN-17's count is unchanged. Wired: the same gateDone rule as ac-2 (packages/core/src/gate/rules.ts:170), with the added-code handling in packages/core/src/round/scope.ts. Data flows: the changed-file sets are the facts (`facts(...)`) that the real CLI loader supplies in round-facts.ts. I ran the file with vitest: it passed.

## @ac-4 From round 3, a Should rests on a ticket line or a failing case

Result: pass

Evidence: Exists: packages/core/test/finding-grounds.test.ts:18 and packages/core/src/round/grounds.ts. Substantive: a Should in round 3 without grounds fails and the reason names round 3 and finding 1. It passes with `rests on:` pointing to ac-1, D-01, a Veto quote or an Intent quote that exists, and with `test:`, `command:`, or risk data-loss or security. A Nice passes. Non-existent ac-9, D-07, a one-word quote and a changed Intent quote all fail. Rounds 1 and 2 ask nothing, and the final review is not counted (D-13). Lane S accepts Understood and Done when quotes (D-11). Wired: `gate.finding-grounds` is registered at packages/core/src/gate/rules.ts:172 and runs inside gateDone; the test calls gateDone. Data flows: the ticket lines are checked against the ticket text in the snapshot, not constants. I ran the file with vitest: it passed.

## @ac-5 A file a fix changed needs a finding or a Ruling

Result: pass

Evidence: Exists: packages/core/test/finding-grounds.test.ts:72 and `fixFileUnexplained` in packages/core/src/round/grounds.ts. Substantive: the test names src/c.ts (round 1) and src/d.ts (round 2). It leaves out the merge's, the episode's, the records-only commit's, the config `generated:` path and the synced skill path (D-09, D-14). A Ruling that gives the path and a reason clears each file. A Ruling that names only a longer path (src/c.tsx) does not clear it; a whole-token match does (`mentionsPath` risk test). A Wording-only line and a listed research record are also handled. D-10 and an error in the facts skip the check, as does a version 1 record. Wired: `gate.fix-file-unexplained` is registered at packages/core/src/gate/rules.ts:174 and runs inside gateDone. The facts come from packages/cli/src/commands/gate.ts:54 (`withRoundFacts`). Data flows: the ranges come from the git walk in packages/cli/src/load/round-facts.ts. A generated path still counts among the fix files for ac-2 (D-03). I ran the file with vitest: it passed.

Caveat across criteria: the vitest run was serialised behind another test run by the lock (about 375 s). That was fine here and did not affect the results. I did not run the full suite; the Linux full run was not mine to read, and junit.xml was only listed, not parsed.
