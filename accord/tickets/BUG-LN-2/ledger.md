# Ledger

## Tasks

## Rulings
- Ruling: on the claim branch itself the working tree is read, not the branch tip — the claimant must see uncommitted work, and the spec reads the active ticket from the current branch — cost if wrong: the claimant's own dashboard lags its last commit.
- Ruling: when a ticket has both a local and a pushed claim branch, its state is read from the ref that already wins the claim (pushed over local, then the newest tip, `packages/cli/src/load/fs.ts:118-120`) — one rule for who holds it and where it stands, the one teammates see — cost if wrong: a claimant's unpushed commits are not reflected on another branch's dashboard.

## Deferred
