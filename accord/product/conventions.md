# Conventions

<!-- One rule per line, followed by every commit and every agent in this repository. Record an option that was tried and refused as `Rejected: <option> — <reason>`. accord brief appends this file to every executor brief. -->

- Never add a commit trailer: no `Co-Authored-By:` line, no other line whose first word ends in `-by:` (such as `Signed-off-by:`), and no line containing "Generated with", in any commit by the main session or any agent.
- A test that makes a commit writes the message to a file and commits with `git commit -F <file> --cleanup=verbatim`, never `-m`, so emoji, blank lines and exact bodies reach git unchanged on Windows.
- After changing a skill or agent source under `packages/core/`, re-render with `npm run gen`, then `npm run build`, then `node packages/cli/dist/cli.js skills sync`, in that order; a build before `gen` embeds the old text.
- Every `git log` and `git show` the code runs passes `-c log.showSignature=false --no-show-signature` and a 64 MiB `maxBuffer`, so the output never depends on the user's git config or the repository's size.
- Paths read from git output are read NUL-separated (`-z`, split on `\0`), never by line, and a path handed back to git as a pathspec carries `:(literal)`, so a non-ASCII, quoted or glob-like file name is never misread.
- Never put an unbounded list of paths on one command line: filter it first (for example to the paths present on disk) or batch it, since Windows caps a command line at about 32 767 characters.
- A test with a time bound sets it wide enough to pass with the whole suite running in parallel, and below the stall it guards, so it still fails without the fix.
- vitest run with the JUnit reporter always passes `--outputFile.junit=` a path under `node_modules/.cache/`, and nothing under `.vitest/` is ever committed, since without it vitest writes `.vitest/junit/output.xml` into the working tree.
- Code that deletes a local branch uses `git update-ref -d refs/heads/<b> <sha it checked>`, never `git branch -D`, so a commit made after the check makes git refuse the delete instead of losing it.
- Run `npm run build` before the full suite whenever a merge brought in source changes, since tests that run `packages/*/dist` otherwise test the build from before the merge.
- Owner quotes in a ticket's Decisions and Corrections, in ledger Rulings, and in approval commit messages are written as a faithful English translation that keeps the owner's meaning and drops nothing, whatever language the owner used.
- On Windows, every test run (plan baseline, affected, verify) sets `ACCORD_BASH` to Git Bash after `npm run build`, or runs from Git Bash, since from PowerShell `bash` is the WSL shim and the executed CI-script cases are recorded skipped.
