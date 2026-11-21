---
kind: reference
---

# A bug claimed in a pull request comment

`/accord-resolve-pr` starts this stage for one comment that claims a bug in a
lane M ticket, after its judge answered `unclear` with a `reproduce:` line.
The judge, never this stage, decides whether the comment holds, and it rules
before any fix: this stage first gives it a failing test and fixes nothing.
Every other run of this stage skips this file.

**Report.** Step 3 runs as written, with the comment verbatim and the judge's
`reproduce:` line as the report. A second return without evidence stops at the
owner, as step 3 says: no test is written and no fix starts.

**Test only.** At step 4, note the HEAD sha and write the brief as step 4 says,
with
`Test only: commit the reproduction test alone, then stop.`
as the last line of the brief, then dispatch a fresh `accord-executor` with
its path. It writes and runs the reproduction test, commits that test alone,
with any fixture it reads, when it fails on the reported behaviour, commits
nothing when it passes, leaving it uncommitted, and fixes nothing.

**Hand back.** Its report lists one commit or none, and no file but the test
and its fixtures; any other file means a fix came before the judge: stop and
ask the owner. Write the output its report shows, failing or passing, to a
file outside the working tree. Record under `## Fixes` in `debug.md` the line
`- test only: <commit or none> <test id>`, which counts no fix, and commit
`debug.md`. Leave the episode open, run none of steps 5 to 9, and give
`/accord-resolve-pr` the test id, the test's file and that output file for
its judge.

**Holds.** When `/accord-resolve-pr` starts this stage again for that comment
with the judge's `holds`, the open episode already holds the root cause and
the committed test: skip step 3, and at step 4 write the brief with no
`Test only:` line, naming that test and its commit. The executor shows it
failing, then fixes; steps 5 to 9 run as written.
