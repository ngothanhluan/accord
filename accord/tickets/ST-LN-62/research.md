# Research: ST-LN-62, how gate done can count a lane S ticket's files

Read-only research, 2026-10-25. Nothing was edited.

## Options

1. Declared and confirmed. The gate counts every hand-written changed file. The session declares wording-only files, and the lane S reviewer confirms each one.
2. No exception. The gate counts every hand-written changed file.
3. Automatic guess, by changed-line count or comment/whitespace detection.

## Cost

Common to all three options:
- A branch diff from `git merge-base <default ref> HEAD` with `--name-status -z -M`. The per-commit lists `gitAfterReview`/`gitReviewFact` (packages/cli/src/load/fs.ts:312-411) are not enough. packages/cli/src/commands/review-package.ts:100 already builds a branch diff.
- A snapshot field and a rule in `DONE_S_RULES` (packages/core/src/gate/rules.ts:200).
- A generated-file classifier in core.
- An exact number in place of "about five" (packages/core/skills/accord/SKILL.md:68-71, asserted by packages/core/test/stage-skills.test.ts:691-704). The rendered SKILL.md has 192 bytes left under the 5120 cap.

Rough size of each option:
- Option 2: about 9-11 files, 250-300 lines.
- Option 1: option 2 plus 4-5 files, about 450-550 lines. It adds a declaration parser, a reviewer-confirmation parser, and text in the reviewer, lane-s.md and review-package.
- Option 3: option 2 plus 150-300 lines of heuristic.

What can be detected reliably:
- Whitespace-only changes, with `git diff -w --ignore-blank-lines` (git t/t4015-diff-whitespace.sh).
- Comment-only changes in TypeScript need a tokenizer. TypeScript is not a runtime dependency.
- Line counts cannot tell the cases apart:
  - ST-LN-61 run.ts: 1 line of `--help` text, which users see.
  - ST-LN-61 dashboard.ts: 1 comment line.
  - BUG-LN-10 init.ts: 2 lines that change behaviour.

## Failure modes to design for

- **Generated files carry no single marker.**
  - render.ts:26 puts its marker after the frontmatter, for example on line 6 of .claude/skills/accord/SKILL.md.
  - packages/core/src/generated/skills.ts:1 has its own header.
  - packages/cli/README.md:1 has its own header.
  - A marker in the content can be pasted into a hand-written file. A path list in core, or attributes read from the base commit, cannot be gamed that way.
- **The default ref may be missing or stale.** `gitDefaultRef` (fs.ts:754) never fetches. With no origin, the gate has to choose between exit 2 and skipping, and skipping leaves a hole.
- **Renames and deletions.** Count a rename as one file (`-M`). Count deletions and binary files too.
- **Own records.**
  - `ownRecordsOnly` (packages/core/src/gate/done.ts:203) also exempts accord/product/conventions.md.
  - accord/config.yml counts.
- **The check fires only at done**, after the work is built. A lift found there means a full lane M restart. An earlier warning, for example in review-package, would soften this.
- **Tests count.** A lane S bug needs a test, so a limit of five leaves about four source files.

## Prior art (accessed 2026-10-25)

- **Prow size plugin** (kubernetes-sigs/prow pkg/plugins/size/size.go).
  - It counts lines per file and skips `.generated_files` and `linguist-generated` paths.
  - It reads both from the base commit, so a pull request cannot exempt its own files.
- **GitHub `linguist-generated`** is path-pattern based. It says nothing about wording.
- **difftastic** has `--ignore-comments` and `--exit-code` (difft(1)). It is a Rust binary, and string-literal edits still count.
- **semantic-release `docs:` and Changesets `--empty`** are declarations, not detection. These sources are third-party mirrors, so confidence is low.
- **Markdown is not wording in accord**, because skill files instruct agents. No tool found detects "no behaviour change" in prose.

## History

Counts below are first-parent diffs of each merge.

| Ticket (merge) | Hand-written files | Option 2 (>5) | Option 1 |
|---|---|---|---|
| ST-LN-61 (f8e4f81) | 7, of which 2 real and 5 wording | fail | pass |
| BUG-LN-10 (ed8fc79) | 4 | pass | pass |
| BUG-LN-9 (18c1f1a) | 2 | pass | pass |
| ST-LN-54 (#89, #90) | 5, all skill text | pass, at the limit | pass |
| ST-LN-51 (64e4e47) | 1 | pass | pass |
| ST-LN-47 (526142e) | 1 | pass | pass |
| BUG-LN-6 (47c3707) | 2 | pass | pass |

## Recommendation

Option 1, with mechanical bounds:
- Whitespace-only changes are excluded automatically.
- A declared file is capped at N changed lines under `-w`, and is never new or deleted.
- The reviewer's confirmation names every declared path in the last round.

Biggest risk: "wording-only" remains a judgement by two agents.

## Size at lane choice: areas instead of files (2026-10-25)

This section measures every merged ticket pull request on origin/main. It uses the first-parent diff of each merge, and a ticket with two pull requests (ST-LN-54) counts as one.

- Excluded: the ticket's own records, other tickets' records, and accord/product/conventions.md.
- Also excluded: rendered and generated copies, which are .claude/, .agents/, .cursor/, .codex/, .github/skills, packages/core/src/generated/ and packages/cli/README.md.
- An area is one of these:
  - `<package>/src/<first folder>`, or `<package>/src/.` for files directly under src;
  - `<package>/skills/<skill>`;
  - `<package>/<other top folder>`;
  - `docs`, which covers README.md and docs/;
  - any other top-level folder.
- Test files count as files but belong to no area of their own.

Lane S tickets, which all passed review with the owner's yes:

| Ticket | Files | Of which tests | Areas |
|---|---|---|---|
| ST-LN-47 | 1 | 0 | 1 |
| ST-LN-51 | 1 | 0 | 1 |
| BUG-LN-6 | 2 | 1 | 1 |
| BUG-LN-9 | 2 | 1 | 1 |
| BUG-LN-10 | 4 | 1 | 2 |
| ST-LN-54 | 5 | 1 | 3 (three skills, all behaviour) |
| ST-LN-61 | 7 | 1 | 5, but 1 area once the 5 wording-only files are left out |

Lane M tickets, 30 merged:
- Areas range from 0 to 20.
- Six touched 2 areas or fewer: ST-LN-21, BUG-LN-3, REFS-1, ST-LN-14, ST-LN-20, ST-LN-5.
- ST-LN-14 changed 20 files, 15 of them tests, in 2 areas (docs and scripts). ST-LN-48 changed 146 files, 142 of them tests, in 4 areas.

What this shows:
- The areas count alone would have proposed lane S for a 20-file change (ST-LN-14).
- The file count alone treats ST-LN-54's 5 files in 3 skills the same as 5 files in one folder.
- With wording-only files left out, every lane S ticket stayed within 5 files and 3 areas.
