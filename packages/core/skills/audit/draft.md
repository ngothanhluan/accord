---
kind: reference
---

# Drafting conventions: `/accord-audit`

Run this only when the owner says yes to a draft. The draft is yours; the owner decides every line. You never edit code or linter configuration, and you never merge the pull request.

1. Run `accord audit` and read its `fact:` lines. `layout` and `languages` say where the code is and what it is written in; `linter-rules` lists the rules the linter config turns on.
2. Read sample code from the folders `layout` names, in the languages `languages` names: enough files to see how names, errors, helpers, imports and tests are written. Do not read what the facts already settle.
3. Propose 10-20 convention lines on naming, error handling, where helpers live, imports and test style. Each line has evidence: how many tracked files follow it and how many break it, counted with a search, and one `file:line` of each. Do not propose a line you cannot count.
4. Give each line an `enforced by:` value. When the linter config turns on a rule from the `linter-rules` fact that enforces the line, name that rule id. Otherwise write `prose`, and offer to queue a draft ticket through `/accord-queue` that turns the rule on, because the old code may break it in many places. Never turn a rule on here.
5. Ask the owner one line at a time, as `./ask.md` says: show the line, its evidence and its `enforced by:` value, then take yes, no, or an edited line. A no drops the line and keeps no trace. Never ask about two lines at once.
6. Write only the accepted lines to a file outside the repository, each as `- <convention> — enforced by: <rule id or prose>` on one line of at most 300 characters, and run `accord conventions write <file>`. On exit 2 show the message, fix the line it names with the owner, and run it again. It prints `branch:`, `base:` and `title:` and pushes a branch of its own; nothing else changes.
7. Open the pull request when `gh` is available with `gh pr create --head <branch> --base <base> --title "<title>" --body "Convention lines the owner accepted in /accord-audit."`, using the lines it printed; otherwise show the `branch:` line and ask the owner to open it.
8. Say the pull request waits for the owner. Do not merge it, with or without admin rights: once merged these lines reach every executor brief.
