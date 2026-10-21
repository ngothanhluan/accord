# Ledger

## Rulings
- Ruling: the verify report's "try this" steps include the D-06 comparison — the same read-only request in a fresh session on main and on the ticket branch, then the branch's benchmark with both transcript folders — and the owner approves only after it — D-06 is not a criterion, so this Ruling and `accord anchor` are what bring it to verify — cost if wrong: high, the owner approves without the comparison D-06 asks for
- Ruling: a session's branch is its first record that carries a gitBranch, as readRun does — the first records of a main transcript carry none — cost if wrong: low, a session that changes worktree shows its first branch
- Ruling: a word holds a letter or digit by the Unicode classes \p{L} and \p{N} — Vietnamese letters such as "ở" are not ASCII — cost if wrong: medium, Vietnamese sentences would be undercounted
- Ruling: the @ac-2 test fills the rules with the cli package's own name and version — the hook injects that invocation — cost if wrong: low, the byte limit would be measured on a string the hook never sends
- Ruling: the benchmark prints its report when a folder holds main sessions but no subagent run — reading main sessions makes that case real — cost if wrong: low, the script would throw on such a folder
