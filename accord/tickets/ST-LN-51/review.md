# Review: ST-LN-51

## Round 1

1. Should: README section 5 "Other runtimes" tells the reader to add `cursor` and `copilot` and run `skills sync`, but the default `runtimes: [claude, codex]` already writes `.claude/skills` and `.agents/skills`, which Cursor and Copilot read, so the sync changes nothing; it never says what `runtimes` controls (README.md, section 5).
2. Should: "It skips every path that already exists" is wrong for skill, agent and plugin copies, which `init` rewrites, and settings hooks, which it merges; the status list omits `overwrote local edits` (README.md, section 2).
3. Nice: `npm i -g @accord-dev/accord` takes no version, so after a later release the global install no longer matches a 0.2.0 pin (README.md, section 1).
4. Nice: "set `tests.report`" omits that the generated config ships the `tests:` block commented out (README.md, section 2).
5. Nice: section 3 uses `git add -A`, which stages unrelated uncommitted work into the init commit (README.md, section 3).
