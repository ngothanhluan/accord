---
kind: reference
---

# Ticket ids, people, and dropping

Read this when config.yml has `people`. Register only when `people` exists, never create it.

## Assigning

Fetch first with
`git -c credential.interactive=never -c core.sshCommand="ssh -o BatchMode=yes" fetch`;
on failure say so and continue, since only refs already in the clone are read.
Then run `accord new ticket --type <story|bug> --lane <lane>` with no id, and use the id it prints.
Never retry with an id.

## When your email is not registered

Look for it on other branches with
`git -c credential.interactive=never -c core.sshCommand="ssh -o BatchMode=yes" log --all -S "<email>" --oneline -- accord/config.yml`
and `git show <commit>:accord/config.yml` (the same prefix, since reading blobs can fetch in a partial clone),
and reuse those initials. If that lookup fails or finds nothing, ask the owner for initials, 2 to 4 capital
letters, suggested from `git config user.name`. Add `"<email>": <INITIALS>` under `people`; when the file has
`people: {}`, write `people:` with the entry on the next line, indented two spaces, in its place.
Recognition names tickets and is never a gate. When the command says the initials belong to someone else,
ask for other initials.

## Merge conflicts under `people`

Keep each email once, comparing emails without regard to case. When the two sides give one email different
initials, or two different emails the same initials, ask the owner which to keep.

## Dropping instead of renaming

A ticket's type never changes and its id is never renamed. To change the type:

1. Set `status: dropped` with a `## Dropped` reason, commit and merge that. Never delete a claim branch to drop a ticket.
2. Create the new ticket with `accord new ticket --type <the other type> --lane <lane>`, always passing
   `--lane`: the dropped ticket's lane, except `L` for a new epic and `M` for a story or bug made from an epic.
3. Copy into it the dropped ticket's frontmatter keys `title`, `ui`, `design`, `parent`, `depends_on` and
   `tracker`, where present, and every section below its frontmatter except `## Dropped`; the copied sections
   replace the template's sections.
4. Never copy `id`, `type`, `status`, `lane`, `approved_hash`, `ac_hash`, `verified`, `verified_hash` or
   `verified_commit`. When the change is between an epic and a story or bug, do not copy `parent` either.
5. In the copied sections, remove every `@test:<id>` tag from the scenarios and change the gherkin
   `Feature: <old id>` line to the new id.
6. The owner approves the new ticket again.
