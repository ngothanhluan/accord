# Review: ST-LN-63

## Round 1

Should 1 [patch]: three unguarded `process.platform` reads in the new tests make core's OS-branch policy test (stage-skills ac-5) fail, so every full run is red — packages/cli/test/goldens.test.ts:25, packages/cli/test/helpers/runs.ts:88, packages/cli/test/git-count.test.ts:651 — fixed in f4256bc
Should 2 [patch]: the shared walk fails as a whole when one claimed ticket's start commit is missing locally, so every ticket falls back to its own reads and the count grows with the number of tickets, against the Intent's Success (D-02, D-11) — packages/cli/src/load/fs.ts:485-519 — fixed in 710e9ee
Nice 3 [patch]: the recording branch of goldens.test.ts can rewrite both golden files when they are deleted — packages/cli/test/goldens.test.ts:23-45 — fixed in f4256bc (removed with Should 1)
Nice 4 [patch]: `loadFromFs`'s and `loadWithBranch`'s `light` option and `loadFromFs`'s `from` have no caller — packages/cli/src/load/fs.ts:906, 911-913 — deferred
Nice 5 [patch]: drop builds its own ssh map while its `CommandContext` carries `ctx.ssh` — packages/cli/src/commands/drop.ts:33-34 — deferred
Nice 6 [patch]: `hasOpenTask`, `readsAfter` and `readsSubject` restate core stage.ts's read rule — packages/cli/src/load/fs.ts:458-475 — deferred
Nice 7 [patch]: the shared walk reads tickets that need no read, a time risk on long-lived branches — packages/cli/src/load/fs.ts:635-642, 864-878 — deferred
Nice 8 [patch]: `worktree merge` discards `fetchOrigin`'s full reload after a good fetch — packages/cli/src/commands/worktree.ts:503, 623 — deferred
Nice 9 [patch]: `headAuthorOf` takes the email after the last `<` where git takes the first — packages/cli/src/load/fs.ts ~2863-2872 — deferred
Nice 10 [patch]: no test fails when clean caches the default ref before its prune or reuses a worktree list read before the fetch — packages/cli/test/git-count.test.ts:654 — deferred
Nice 11 [patch]: ac-1 writes progress lines to stdout and items.ts keeps a build-process comment — packages/cli/test/git-count.test.ts, packages/cli/test/helpers/items.ts:7 — deferred
