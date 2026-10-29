# Ledger

## Rulings
- Ruling: a fix made for a pull request comment after verify takes the path `failure.md` already gives a failure reported after verify (a review round on the fix, then verify again), not a new path — `gate done` already fails on a commit that changes code after the verified commit (packages/core/src/gate/done.ts:218-245), so a second route would only duplicate it — cost if wrong: the owner wanted a lighter path for small comments; shown at approval
