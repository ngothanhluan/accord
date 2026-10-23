# Ledger

## Tasks

## Rulings

- Ruling: the check's letter set is U+0102, U+0103, U+0110, U+0111, U+01A0, U+01A1, U+01AF, U+01B0 plus U+1EA0–U+1EF9, written as escapes in the test so the test file passes itself; a, e and o with circumflex are left out — they are also French and Portuguese letters, and almost every Vietnamese sentence holds a letter of the set — cost if wrong: a Vietnamese line whose only marked letters are circumflex vowels slips past the check.
- Ruling: the replacement language for non-English test coverage is chosen at the approach — it needs a Gherkin dialect with non-ASCII keywords in @cucumber/gherkin 42 and a diacritic letter whose bare form is another word — cost if wrong: one fixture and golden set redone.
- Ruling: the product skills keep their "in the owner's words" wording; the English rule lives in this repository's conventions.md only (D-02, D-06), since accord users may record quotes in their own language — cost if wrong: agents here read "verbatim" and "English translation" side by side; conventions.md is appended to every executor brief, so the narrower rule wins.
- Ruling: a renamed test's id is replaced in place in accord/tests-baseline.txt — it is the same test under an English name, so the list does not grow — cost if wrong: the plan or done gate reports the renamed tests as untraced.
- Ruling: (audit) HTML character references are not decoded by the check — none is tracked today (0 in docs/plans/aidlc-vs-accord.html), and no tracked file is binary or holds a combining mark (771 files read on d5db8c3) — cost if wrong: Vietnamese written as `&#...;` slips past the check.
- Ruling: (audit) the auditor ran twice; both rounds' splits were settled by wording with the stricter reading (working tree via `git ls-files`, whole-file NUL test, committed file in a temporary repository, the branch's base commit as the baseline, the matcher's normalising, exactly one rule line), and no third round ran — the splits were about how to test, not what the owner wants — cost if wrong: a criterion the verifier reads a third way, caught at verify.
- Ruling: translated owner quotes keep the meaning and drop nothing (see sentence-rule lesson from ST-LN-33); an existing English gloss beside a quote becomes the quote — cost if wrong: a Decision reads differently from what the owner meant, caught at review.
