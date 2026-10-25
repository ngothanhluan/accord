---
ticket: "ST-LN-48"
commit: "39c0d9679e040216d8f7701b1a2767250be15506"
reviewed_on: "2026-10-24"
---

## @ac-1 No tracked file holds a Vietnamese-only letter

Result: pass

Evidence: Exists: packages/cli/test/no-vietnamese.test.ts:46-48 is the ac-1 test; the check is `vietnameseLines` at :12-25, letter set at :9 (U+0102/3, U+0110/1, U+01A0/1, U+01AF/0, U+1EA0-U+1EF9). Substantive: it runs `git ls-files -z`, skips NUL-holding files, reads whole, NFC-normalises, tests every line. Wired: the test lives in packages/cli/test, so the normal vitest run reaches it; I ran `npx vitest run` on it and it passed. Data flows: independently, `git ls-files -z | xargs -0 grep -lP` for the same code-point set printed no file at 39c0d96, so the empty result is real and not an artifact of the test.

## @ac-2 The check fails when Vietnamese comes back

Result: pass

Evidence: Exists and substantive: packages/cli/test/no-vietnamese.test.ts:27-44 makes a temporary git repo, commits a file with U+0111 on line 3, and asserts `['docs/notes/a.md:3', 'docs/notes/b.md:4']`. The path is relative to the root with `/` separators, and line 3 is named. It also covers a decomposed o plus combining horn (NFC) and a NUL-skipped file. Wired: it calls the same `vietnameseLines` function that ac-1 uses. Data flows: the repo comes from `makeEmptyRepo`, `writeFiles` and `commitMsg`, so real git output feeds the result. The test passed when I ran it.

## @ac-3 Every ticket keeps its stage after the translation

Result: pass

Evidence: Exists: packages/core/test/stage-baseline.test.ts:39-49 compares fixtures/st-ln-48/base-stages.json (60 tickets) with the stage on the working tree for tickets whose five-record fingerprint matches fingerprints.json (58 entries); it asserts at least one ticket was compared. Substantive: `stagesOf` uses core `loadSnapshot` and `statusRows`. Wired: the test passed when I ran it. Data flows: the stages come from the real accord/ files on disk. Criterion wording (`accord status --json --all` on both sides): the main session's step 5 file, node_modules/.cache/accord/step5-status-diff.txt, claims 67 tickets compared (D-08 tickets against efdf4fb), identical `stage` on all, README-1 with no stage on either side. I read it as a claim and did not rerun the dual-worktree diff. I did check the cheaper facts. The packages/core/src diff d5db8c3..HEAD is two comment-only edits (refs.ts and snapshot.ts), so stage logic is unchanged. The warnings difference that file reports (BUG-LN-4, BUG-LN-8, ST-LN-33) comes from `lint.test-id-unknown` for tickets on unmerged branches, which does not affect `stage`. Limit: the in-suite test skips 2 tickets whose fingerprints no longer match, so the stage proof for those rests on the step-5 file.

## @ac-4 Non-English coverage moves to another language

Result: pass

Evidence: Exists: dialect `fr` in packages/core/test/gherkin.test.ts:108-130 (the ac-4 test at :109 uses `# language: fr`, `Scénario:`, `Soit`). The refs matcher in packages/core/test/refs.test.ts:141-143 asserts `normalise('Où')` is `où` and not `ou`. Capitals cut by code point: packages/cli/test/dashboard.test.ts:120-132 (`'É'.repeat(70)` truncated to 57 plus '...'). EARS: packages/core/test/ears.test.ts:23 asserts every line has a character above U+007F. A non-ASCII ticket id: I did not locate the test by hand, and the suite passes. The 4 relevant files (gherkin, convention, stage-baseline, no-vietnamese) passed in my run, 31 tests. The full-suite claim (1518 passed, 3 skipped, 0 failed, node_modules/.cache/accord/junit.xml) was not rerun; the instruction was not to. A grep for the Vietnamese letter set over all tracked files is empty, so no Vietnamese test text remains. Gap: I traced four of the five traits to specific lines.

## @ac-5 The conventions carry the English quote rule

Result: pass

Evidence: accord/product/conventions.md:14 is the one line: "Owner quotes in a ticket's Decisions and Corrections and in approval commit messages are written as a faithful English translation ..." It is the only match for `faithful`. The test packages/core/test/convention.test.ts:83-92 filters `- ` lines matching /owner quote/i, asserts exactly one, and checks for the phrases Decisions, Corrections, approval commit messages and faithful English translation. It passed when I ran it, and it reads the real file.
