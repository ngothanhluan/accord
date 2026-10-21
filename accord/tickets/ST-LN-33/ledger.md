# Ledger

## Rulings
- Ruling: the verify report's "try this" steps include the D-06 comparison — the same read-only request in a fresh session on main and on the ticket branch, each session's <session>.jsonl copied into its own empty folder, then the branch's benchmark with those two folders — and the owner approves only after it — D-06 is not a criterion, so this Ruling and `accord anchor` are what bring it to verify — cost if wrong: high, the owner approves without the comparison D-06 asks for
- Ruling: a session's branch is its first record that carries a gitBranch, as readRun does — the first records of a main transcript carry none — cost if wrong: low, a session that changes worktree shows its first branch
- Ruling: a word holds a letter or digit by the Unicode classes \p{L} and \p{N} — Vietnamese letters such as "ở" are not ASCII — cost if wrong: medium, Vietnamese sentences would be undercounted
- Ruling: the @ac-2 test fills the rules with the cli package's own name and version — the hook injects that invocation — cost if wrong: low, the byte limit would be measured on a string the hook never sends
- Ruling: the benchmark prints its report when a folder holds main sessions but no subagent run — reading main sessions makes that case real — cost if wrong: low, the script would throw on such a folder
- Ruling: the pointer line gains only " or report" — the smallest edit; the rendered accord SKILL.md is 5106 of its 5120 bytes before it — cost if wrong: low, the yes lines and findings reach ask.md only through "report" and rule 8
- Ruling: an approval view with no closing `---` is skipped to the end of its text block — the scenario leaves this case open — cost if wrong: low, a stray "## Intent" heading hides the rest of that block from the count
- Ruling: the D-06 comparison runs the benchmark once with several folder arguments, sessions told apart by the branch column — one report the owner reads side by side — cost if wrong: medium, the owner needs two runs to compare

## Deferred
- Plan round 1.3 (Nice): Task 4 says "Date.parse(o.timestamp) is a number"; the intended test is not NaN, as readRun does at scripts/benchmark.mjs:50 — deferred
