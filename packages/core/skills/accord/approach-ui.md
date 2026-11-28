---
kind: reference
---

# Visual options of the approach stage

`./approach.md` step 2 reads this file for a `ui: true` ticket when `design.tokens` in `accord/config.yml` is empty or names no file of
the repository. A ticket whose project has a file at `design.tokens`, and a `ui: false` ticket, skip all of it: step 2 runs as written,
with no visual options.

You run it in the main session, inside step 2. It is no stage of its own: no intent, plan or done step of any skill runs here.

1. Draft two or three visual options for the screen the ticket's criteria describe. Take their direction from the skill the
   `ui.direction` key of `accord/config.yml` names, when it is set, else from `./direction.md`. A mapped skill only drafts the
   directions: it never runs its own intent, plan or done step, builds nothing and writes no file but the options below.
2. Write one small HTML file per option, `accord/assets/<id>/option-1.html` to `option-3.html`: one file, no build step, no assets
   folder, no remote script, font or image. Each opens with the comment block of `./prototype.md`, its `Derived from:` line included.
3. Show every option to the owner, one line each (palette, type, spacing) and its path, and ask which one to build, as `./ask.md`
   says. The owner picks, before `accord approve`; never pick for the owner.
4. Copy the picked file to `accord/assets/<id>/prototype.html`, the design reference `accord gate ready` reads. Keep the other option
   files. Name the pick on the `- Chosen:` line of step 4 of `./approach.md`, as `look: option-<k>`.
5. Commit the option files and `prototype.html` with the ticket in step 2.
