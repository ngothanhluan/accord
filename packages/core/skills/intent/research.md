---
kind: reference
---

# Research records

A research record is a file `accord/research/<YYYY-MM-DD>-<topic>.md` that keeps a discussion, a measure or a study
made before or beside a ticket. It is evidence, never a contract. A ticket names its records under its frontmatter
key `research:`, one repository path per entry. The key is optional: make a record only when there is research or
replaced evidence to keep.

## Before the first question

At step 2, before any question to the owner, read every record `accord anchor` lists under `## Research`. A record
holds at the commit it names, so check a claim against the code before you rely on it.

## Evidence a rewrite replaces

At step 6, before you rewrite a queued Intent, first move every line of evidence it replaces, verbatim, into a new
record under `accord/research/` with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines, and list
that record under the ticket's `research:` key. Never delete such a line. Start the record as below, with today's date
and the sha that `git rev-parse --short HEAD` prints:

```
# <topic>

Date: <YYYY-MM-DD>. Repository at `<sha>`.
```

Commit the record with the ticket at steps 8 and 9.

## The ticket's own files

A `.md` record under `accord/research/` that the ticket lists under `research:` and that origin's default branch does
not hold counts as one of the ticket's own files, beside `accord/tickets/<id>.md` and the paths under
`accord/tickets/<id>/`: the `git diff` and `git status` checks of the lane S rule accept it, and so does step 2 of
`## Moving to lane S` in `./ids.md`. A change to a record the default branch already holds does not count. Step 3
there first moves the evidence of the sections it replaces into a record, as `## Evidence a rewrite replaces` says.
