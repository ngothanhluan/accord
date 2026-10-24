# Review: ST-LN-51

## Round 1

1. Should: README section 5 "Other runtimes" tells the reader to add `cursor` and `copilot` and run `skills sync`, but the default `runtimes: [claude, codex]` already writes `.claude/skills` and `.agents/skills`, which Cursor and Copilot read, so the sync changes nothing; it never says what `runtimes` controls (README.md, section 5).
2. Should: "It skips every path that already exists" is wrong for skill, agent and plugin copies, which `init` rewrites, and settings hooks, which it merges; the status list omits `overwrote local edits` (README.md, section 2).
3. Nice: `npm i -g @accord-dev/accord` takes no version, so after a later release the global install no longer matches a 0.2.0 pin (README.md, section 1).
4. Nice: "set `tests.report`" omits that the generated config ships the `tests:` block commented out (README.md, section 2).
5. Nice: section 3 uses `git add -A`, which stages unrelated uncommitted work into the init commit (README.md, section 3).

## Round 2

1. Should: "Only `--version` and `--help` run regardless" is false: `upgrade` also skips the pin check (run.ts), and the same section tells a 0.1.0 repository to run `upgrade` by hand (README.md, section 7).
2. Nice: `git add accord .github .claude .agents AGENTS.md CLAUDE.md` fails with "pathspec did not match" when init did not write one of those folders, for example `.agents` under `runtimes: [claude]` (README.md, section 3).
3. Nice: "write the copies again and commit what it prints" omits that `skills sync` never deletes copies of a removed runtime; it only reports them (README.md, section 5).

## Round 3

1. Should: "Nothing else needs installing per person beyond Node" is false: the skills run a bare `accord`, and only Claude Code's session hook tells the agent to fall back to npx, so a Codex, Cursor or Copilot teammate without a global install at the pinned version fails every command (README.md, sections 1, 3 and 5).
2. Nice: section 8 says `npm rebuild` links the `accord` command "that the hooks call", but the hooks run npx; the skills call `accord` (README.md, section 8).
3. Nice: the skills list omits `accord-designer`, which the default `roles: [ba, dev, designer]` writes (README.md, section 2).
4. Nice: "Every command that reads the repository refuses with exit 2" is not true of `hook prompt-expansion`, which warns and exits 0 (README.md, section 7).

## Round 4

1. Nice: upgrading, a step of the Understood line, has no heading of its own; it sits inside "7. Version pin" (README.md, section 7).
2. Nice: sections 1 and 6 show bare `accord …` commands without saying they need the global install, or the npx prefix otherwise (README.md, sections 1 and 6).
3. Nice: "the `prompt-expansion` hook only warns, so a prompt is never blocked" reads as general, but that hook does block `/accord` prompts in a session that holds another ticket (README.md, section 7).

## Round 5

1. Nice: section 1 says npx means "nothing needs installing", but the skills call a bare `accord` and only Claude Code's hook adds the npx fallback; that limit is stated only in section 3 (README.md, section 1).
2. Nice: the "Gates" bullet says Done passes only after a fresh verifier checks the acceptance criteria, which is not what `gate done` checks for a lane S ticket (README.md, "What it is").

verdict: converged
