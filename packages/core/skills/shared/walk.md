---
kind: reference
---

# Walking one setting

Every skill that changes a setting follows this file for one key at a time: `/accord-config` for any key, `/accord-onboard` for the keys accord has a proposal for.
The skill names the key. This file writes only through `accord config set`, and only after the user's yes. An agent never answers a question for the user.
Read `./ask.md` before the first question.

1. Say in plain words what the key controls, from the text `accord config areas` printed for it. Run `accord config get <key>` to say what accord uses now
   (`unset` means accord's own default: say what that does). When a `proposal:` line names the key, show the proposed value and its evidence as a
   recommendation: it is accord's suggestion from reading the repository, never a value to set without a yes.
2. Ask one question that stands alone, with what happens on yes and what happens on no:
   - **Take the proposed value.** Offered only when there is a proposal. The file changes; say what changes for the team.
   - **Keep** what accord uses now. Nothing is written, and the key is not asked again in this run.
   - **Give another value.** The user types it.
3. Run `accord config set <key> '<value>'` only after the user's yes, or with a value the user gives. `config set` stores
   the text it is given, quotes included, so pass the bare value in single quotes (so the shell keeps it as one
   argument). A printed value that is a JSON string is passed without its outer double quotes (the printed
   `proposal: git.merge = "squash"` is run as `accord config set git.merge 'squash'`); a printed `[` or `{` collection is
   passed as printed. A value the user types is passed as typed, never wrapped in quotes of its own. Show its `changed:` line and every line
   after it verbatim, and say in one sentence what each added line keeps working. When it exits 2, show its reason and
   ask again or skip. On a no, write nothing; never edit `accord/config.yml` by hand, never set a value the user did
   not confirm, and never take silence or "whatever" for a yes.
4. `git.sync` and `tracker.command` (under `tracker.adapter: script`) are scripts from the repository, so accord does
   not run them until the person allows them once with `accord trust`: a local record inside `.git`, never committed,
   bound to the command and the files it reaches, so a change to either asks again; `accord trust --revoke` withdraws
   it. `accord trust` shows each script with a digest, the files an allow covers and the ones that changed, and allows
   nothing; `accord trust git.sync@<digest>` or `accord trust tracker.command@<digest>`, with the digest exactly as
   shown, allows that one, and refuses if the files changed since. accord checks only the files `accord trust` lists;
   anything else the command loads is not checked, so whoever allows a script must review the pull request that
   changed it. Three more keys declare a script the same way and run only after `accord trust <kind>@<digest>`:
   `commits.message.command` (builds a commit message), `pr.command` (builds a pull request title and body) and
   `audit.command` (adds the team's own checks to `accord audit`). After setting one, say so and name the command. Run `accord trust` only when the user asks you to, never on your
   own. The built-in trackers (`none`, `github-issues`, `jira`, `linear`) run no repository script; a Jira
   `tracker.url` is sent the credential only when the default branch's `accord/config.yml` holds the same url, so
   after setting it say it must be committed to the default branch first.
5. `accord config unset <key>` takes a key back to accord's default, asked the same way, and `accord config check` lists every problem in the
   file. The command, not this file, applies what a change keeps working (`legacy_ids`, `commits.legacy_subjects`) and refuses a value the schema or the
   floor does not allow.
6. A request to add or remove a security trigger edits `accord/product/security.md` directly, not through `accord config set`. A new pattern is a line with a new id, written after the user's yes as for any key. Removing a default pattern writes `- Removed: <id> — <reason>` under `## Removed`, only after the owner's explicit yes to one standalone question that names the pattern, says which changes would no longer get a security reviewer, and says a `risk: security` finding still blocks. This skill writes nothing without the yes and never deletes a default's line.
7. When the last key is answered, run `git diff -- accord/config.yml` and show it. Say that this skill does not
   commit: the user commits the file in the team's usual way.
