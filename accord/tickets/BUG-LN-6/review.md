# Review: BUG-LN-6

## Round 1

1. Should — intent — `packages/cli/test/worktree.test.ts:1975`, `packages/cli/vitest.config.ts:6`: the silent-fetch test now gets the 90 s win32 default, under twice its slowest observed Windows time (65 s with the fixed wait, about 34 s without it); a slow runner plus the up-to-10 s finally wait can pass 90 s.
2. Should — quality — `packages/cli/test/worktree.test.ts:1975`: the silent-fetch test lost its explicit `60_000` and now gets 30 s on POSIX, a budget cut the ticket did not ask for.
