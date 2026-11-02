---
kind: reference
---

# The scout's report

A reply of `accord-scout` that a lane, an answer or an approval rests on is checked by the CLI and saved in the
ticket, so no agent after it searches again.

1. **Check.** Write a new reply, verbatim, to a file outside the working tree. Below it add a `## New files`
   section, one `- <path>` line per file the change creates that you name, since the scout reports only files
   that exist. Run `accord scout check "<file>"` on that file, and use the lane numbers it prints when you
   propose a lane. Once the ticket exists, add `--ticket <id>`, for example at intent step 2 and approach
   step 5, so the search leaves out the ticket's own files and listed research records, as it does for the
   saved report; the lane scout runs before any id exists, so it has none.
2. **Exit 1.** Dispatch a fresh `accord-scout` once with the reply and everything the check printed, asking for
   the same reply corrected in the same form; put the corrected reply in place of the old one in the file you
   checked, keep its `## New files`, and run the check again with the `--ticket <id>` of step 1, when it gave
   one. When it exits 1 again, show the owner what it
   prints and ask whether to accept the report as it is.
3. **Skipped.** Write a line `skipped: <reason>` into `scout.md` only when no scout ran, or when the owner
   accepts a failing report, the reason then quoting the owner's words. Never write it to get past the check.
4. **Save.** A checked report is copied to `accord/tickets/<id>/scout.md` only while that file does not exist:
   the reply to another question never replaces a saved report or its `## New files`. For a new request in
   lane S or M, after `accord new ticket` and before you follow the `enter:` or `stop:` line it printed, copy
   the checked file to `<path>/accord/tickets/<id>/scout.md`, run
   `git -C "<path>" add -- accord/tickets/<id>/scout.md`, then
   `git -C "<path>" commit -m "scout: <id> report" -- accord/tickets/<id>/scout.md` and
   `git -C "<path>" push -u origin <branch>`. At intent step 2, when `accord/tickets/<id>/scout.md` does not
   exist, copy the checked reply there, add and commit it the same way and run `accord worktree push <id>`;
   when it exists, use the checked reply for your questions and leave `scout.md` as it is.
5. **Approval.** Before the owner's yes at approach step 5, run
   `accord scout check "accord/tickets/<id>/scout.md"`; when that file does not exist, dispatch `accord-scout`
   with the path of `accord/tickets/<id>.md`, asking for the existing files the approach touches, then check its
   reply as steps 1 to 3 say, copy it to `accord/tickets/<id>/scout.md`, run
   `git add -- accord/tickets/<id>/scout.md` and `git commit -m "scout: <id> report" -- accord/tickets/<id>/scout.md`,
   then `accord worktree push <id>`, all before the owner's yes; check that reply with `--ticket <id>`. A saved report that fails is corrected in place
   as step 2 says, then committed and pushed the same way before the owner's yes.
   `accord approve <id>` runs the same check on `scout.md` as of the commit that last changed it, or on the
   working tree while the file has uncommitted changes. When `accord approve <id>` exits 1 naming `scout.md`,
   correct the report as steps 2 and 3 say, commit it and run `accord approve <id>` again: the owner's yes
   still holds, since `scout.md` is not among the approved sections.
6. **Read.** The planner, and every agent after it that needs the ticket's files, starts from
   `accord/tickets/<id>/scout.md`.
