# Ledger

## Rulings

- Ruling: cleaning up ST-LN-33 with the new mechanism is follow-up work after this ticket is done, not one of its criteria — the owner confirmed the four parts without it — cost if wrong: ST-LN-33 lingers until someone runs the cleanup.
- Ruling: `worktree clean` reads a ticket as dropped from its file on the same reference it already uses for "merged" (origin's default ref, else origin/main) — one reference for both rules — cost if wrong: a drop merged only into a local main is not cleaned until it is pushed.
- Ruling: the pull request `accord drop` prints waits for the owner like other ticket work; the repository's auto-merge convention for backlog pull requests is not extended to it — that convention covers only queuing drafts — cost if wrong: one more owner merge per drop.
