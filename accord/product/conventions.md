# Conventions

<!-- One rule per line, followed by every commit and every agent in this repository. Record an option that was tried and refused as `Rejected: <option> — <reason>`. accord brief appends this file to every executor brief. -->

- Never add a commit trailer: no `Co-Authored-By:` line, no other line whose first word ends in `-by:` (such as `Signed-off-by:`), and no line containing "Generated with", in any commit by the main session or any agent.
- A test that makes a commit writes the message to a file and commits with `git commit -F <file> --cleanup=verbatim`, never `-m`, so emoji, blank lines and exact bodies reach git unchanged on Windows.
- Every `git log` and `git show` the code runs passes `-c log.showSignature=false --no-show-signature` and a 64 MiB `maxBuffer`, so the output never depends on the user's git config or the repository's size.
