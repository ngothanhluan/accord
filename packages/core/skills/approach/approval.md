---
kind: reference
---

# The owner's yes

The owner approves once, here, from the short view of the ticket. The view
shortens what the yes covers; it never narrows it.

1. Run `accord scout check "accord/tickets/<id>/scout.md"`, and follow `./scout.md` when
   it does not exit 0 and when `accord approve` exits 1 below.

2. Run `accord show <id> --approval --short`; if it fails, stop and tell the
   owner. Paste its output unchanged, as Markdown, not inside a code block.
   Below it put a horizontal rule, a heading "In plain words" written in the
   chat language, and one line per scenario that begins with its ac-n and says
   in plain words what it means, and ask for an explicit yes. The risks the
   view lists are the approach findings still open; the owner accepts them
   with the yes.

3. The question names the text above it and `accord/tickets/<id>.md`, and
   says that the yes approves the ticket's Intent, acceptance criteria, Vetoes,
   Decisions, Corrections and Approach as written there, which the view
   shortens and the file holds in full.

4. On yes, run `accord approve <id>`, then `accord gate ready <id>` and work
   from what it prints. When it says a `depends_on` ticket is not done on the
   default branch, never remove that entry from `depends_on`: tell the owner
   this ticket waits for that ticket's merge, then after the merge run
   `git fetch` and `accord gate ready <id>` again. Then commit the ticket, with
   `approved_hash:` and `ac_hash:` in it, and the ledger if it changed. Then run
   `accord worktree push <id>`; go on even if it fails.

5. If the owner picks another option, append
   `## Closed <option>: the owner picked <other option>` to
   `accord/tickets/<id>/approach-review.md`, write that option into
   `## Approach` as step 2 of the skill says, go back to step 3 with that
   option, and ask again. On any other no, write the owner's words under
   `## Corrections` first, append `## Closed <option>: the owner's no` to
   `approach-review.md`, empty `## Approach` below its heading, go back to
   `accord-intent` step 8, and restart this stage at step 2.

`accord approve` runs only on a yes to the sections as shown. Never run
`accord approve` without the owner's yes in this conversation.
