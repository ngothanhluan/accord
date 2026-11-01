# Scout coverage: how fully accord-scout answers the questions it is given

Date: 2026-10-30. Repository at `5c083d3`. Feeds ST-LN-13.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement.

## Question

How fully does `accord-scout` (`packages/core/agents/scout.md`: every fact with `path:line`, "not found" plus where it looked, never proposes, answer at most 30 lines; tools Read, Grep, Glob) answer the questions it is given? Two weaknesses were suspected but not measured: the 30-line cap makes the scout drop questions or mark them "not checked" when it is asked many, and the scout skips files that a ticket names only in its free text (seen once, ST-LN-60).

## Method

- **Transcripts.** Every `<session>/subagents/agent-*.meta.json` with `agentType: accord-scout` under the 32 Claude Code project folders `C--Work-accord` and `C--Work-accord-*`. There were 68 scout runs, all `spawnDepth: 1`. Each run's own `agent-*.jsonl` supplied the prompt (first user message), the tool calls, and the report (the `SubagentHandback` message, or the last assistant text). The parent `<session>.jsonl` supplied the dispatch (matched by `toolUseId`; 68 of 68 found), the last skill loaded before it, and the main session's tool calls after the report arrived. The scripts are in the scratchpad (`scout-measure/extract.mjs`, `analyze.mjs`, `summary.mjs`, `split.mjs`, `sample.mjs`, `named.mjs`).
- **Set measured.** 56 dispatches. Excluded: 10 benchmark replays from 2026-10-22 (five real intent prompts, each run at low and at medium effort in `accord-bench` worktrees), 1 effort probe with no question, and the current session's ST-LN-13 dispatch (reported separately below). Dates are local (UTC+7).
- **Context.** A prompt that asks for "the existing files the change is expected to touch" and `sensitive:` matches follows `packages/core/skills/accord/lane.md` step 1 and is counted as **lane classification** (9 dispatches; one of them scoped ST-LN-60's move to lane S from inside the intent skill). Every other prompt names a ticket and numbered questions and is counted as **intent interview** (47 dispatches; 44 ran under `accord-intent`, 3 under another skill or after a context compaction).
- **Question.** One top-level numbered item of the prompt (`1.` to `n.` at the start of a line). Every measured prompt numbered its questions. Sub-bullets inside an item count as part of it.
- **Answer.** The report section headed by the same number (`1.`, `Q1`, `**Q1.**`). Text after a closing "Not checked:", "Skipped:", "Limits:" or "Risk:" line counts as a tail note, not as an answer. A question is **answered with a fact** when its section holds at least one `file.ext:n` or `:n` location. A question carries a **gap** when its section says, in the scout's own words, that something was not checked, not traced, not verified, not measured, not run, or not read. These words were found by regular expression (text inside backticks and quotes skipped). All 72 hits were then read by hand; 8 described the code, not the scout's own reach (for example "the marker is not checked" about `isLive`), and were removed, leaving 64.
- **Not found.** Counted by regular expression only ("not found", "none found", "does not exist", …), not read by hand.
- **Length.** Non-empty lines of the report, against 30 or against the cap the prompt itself stated ("Keep the report under 60 lines").
- **Follow-up.** The main session's tool calls after the report arrived and before its next question to the owner (an `AskUserQuestion` call or the owner's next message), read by hand and classed as: a second scout; the main session checking something the report said it had not checked; or the main session re-reading a file the report cited.
- **Fact sample.** The 56 dispatches in time order, every 7th one (1st, 8th, …, 50th: TAGS-1, ST-LN-1, BUG-LN-3, ST-LN-27, ST-LN-34, BUG-LN-8, BUG-LN-13, ST-LN-64). From each report, the first and the last `path:line` fact that quotes a token in backticks: 16 facts. Each was read with `git show <sha>:<path>` at the last first-parent `origin/main` commit before the dispatch, because the claim branches are deleted. A bare file name (`worktree.ts:620`) was resolved to the file the report's context names.
- **Named files.** Paths under `accord/research/`, `docs/` or `.planning/` that appear in the prompt, or in the ticket text the scout read with Read (37 of the 56 scouts read a ticket file; the rest got a blank template or a lane request). Each was checked for a Read call on it, a Grep or Glob aimed at it or its folder, and its file name appearing in the report.

Limits: each report section is matched to a question by its number, so a section that answers two questions, or a gap noted in a report's preamble (16 reports) or tail (47 reports), is not attributed to a question. The gap count therefore misses some gaps; its hand check removed false hits but did not search the sections without a hit. "Answered with a fact" means that at least one location appears, not that the question is fully answered. The fact sample reads `origin/main`, not the ticket worktree, so a fact about a file the ticket branch changed would look wrong; none did. The follow-up window ends at the next owner question, so later checks are not seen.

## Results

### Dispatches

| Context | Dispatches | Questions | Median questions | Median non-empty lines | Median tool calls |
|---|---:|---:|---:|---:|---:|
| Intent interview | 47 | 338 | 7 | 41 | 25 |
| Lane classification | 9 | 38 | 4 | 21 | 13 |
| All | 56 | 376 | 7 (min 3, max 10) | 37.5 | 24 |

By date: 10-13: 2, 10-14: 6, 10-15: 3, 10-16: 3, 10-17: 2, 10-18: 4, 10-19: 3, 10-21: 8, 10-22: 1, 10-23: 2, 10-24: 2, 10-25: 3, 10-26: 1, 10-27: 1, 10-28: 7, 10-29: 7, 10-30: 1. Lane classification dispatches start on 2026-10-27; `lane.md` was first committed on 2026-10-26.

### Questions answered

| Outcome over 376 questions | Count |
|---|---:|
| Section present with at least one `path:line` | 365 (97%) |
| Section present, only "not found" | 3 |
| Section present, only a gap note | 6 |
| Section present, neither | 2 |
| No section (question left out) | 0 |
| Section carries a gap in the scout's words (hand-checked) | 64 (17%), in 36 of 56 reports |
| Section carries "not found" (regex, unchecked) | 86 |

Causes of the 64 gaps, classed by hand:

| Cause | Gaps |
|---|---:|
| Needs a shell: git history, byte sizes, running a test or the CLI | 20 |
| Data outside the repository (ST-LN-14's questions on Claude Code transcripts) | 7 |
| A file in the repository the scout says it did not read, open or search | 37 |

ST-LN-14 alone holds 9 of the 64 (all 9 of its questions, mostly about transcripts the scout could not find). Without it: 55 gaps over 367 questions (15%). In that report the scout also stated "No C--Work-accord* folder exists"; such folders existed.

Gap rate by split (same hand-checked 64):

| Split | Dispatches | Questions | Questions with a gap |
|---|---:|---:|---:|
| 3 to 5 questions | 10 | 40 | 11 (28%) |
| 6 to 7 questions | 26 | 169 | 26 (15%) |
| 8 to 10 questions | 20 | 167 | 27 (16%) |
| Cap left at 30 | 32 | 211 | 39 (18%) |
| Cap raised by the prompt | 24 | 165 | 25 (15%) |
| Report of 30 non-empty lines or fewer | 23 | 140 | 31 (22%) |
| Report over 30 non-empty lines | 33 | 236 | 33 (14%) |
| Intent interview | 47 | 338 | 54 (16%) |
| Lane classification | 9 | 38 | 10 (26%) |

No report says it cut or left out anything to keep within a line cap; a search of all 68 reports for "brevity", "line limit", "30-line", "for space" and similar found none.

### Length against the cap

- 24 of 56 prompts raised the cap (to 40, 50, 60, 80 or 120 lines); 2 restated 30; 30 stated none.
- With the cap at 30 (32 dispatches): median 31.5 non-empty lines, maximum 92; 16 reports exceeded 30.
- With a raised cap (24 dispatches): median 43.5, maximum 81; 2 exceeded their own cap.
- Lines understate length: many reports put a whole answer on one line. Median report length is 5,813 characters (maximum 11,427), with a median of 36 `path:line` facts (1,948 in total).
- Lane classification reports were shorter (median 21 lines, none over its cap); intent reports had a median of 41, and 18 of 47 exceeded their cap.

### Follow-up by the main session

- A second scout right after a report: 0 of 56. Two tickets had more than one scout later in the same session: ST-LN-58 (2, the second about a rule the owner changed after the first) and ST-LN-60 (3: intent, the lane S scope, and a new request).
- The main session checked something the report said it had not: 12 of 56 dispatches (SHOW-1, ST-LN-2, ST-LN-19, ST-LN-26, ST-LN-34, ST-LN-31, ST-LN-14, BUG-LN-8, ST-LN-62, ST-LN-58, the test-lock request, ST-LN-60 lane S). All 12 used the shell: `wc -c` for byte sizes (5), `git log`/`git show`/`git grep` on other refs or history (6), a JUnit file or the transcripts (2; one dispatch did both git and JUnit).
- The main session re-read a file the report had cited: 2 (BUG-LN-1, BUG-LN-4).
- In 2 lane classifications (BUG-LN-15, ST-LN-66) the main session went on to build in the same turn; those reads are build work and are not counted.

### Fact sample

16 facts from 8 dispatches, checked at the commit of each session: 16 hold, each at the line given (for example `packages/cli/src/commands/anchor.ts:28` holds `/^t\/([^/]+)$/` at `9b4479b`; `worktree.ts:620` is the only `'push'` in `packages/cli/src` at `996a55e`). 0 wrong of 16; with so small a sample, the wrong-fact rate is only bounded at roughly 19% or less (estimate, rule of three). The sample favours facts that quote code in backticks and sit first or last in a report.

### Files named in the ticket or prompt

28 mentions of a document in 23 dispatches:

| Where it was named | Mentions | Read | Grep or Glob aimed at it only | Neither | File name in the report |
|---|---:|---:|---:|---:|---:|
| In the scout's prompt | 21 | 5 | 9 | 7 | 16 |
| Only in the ticket text | 7 | 0 | 0 | 7 | 2 |

For `accord/research/` files: 6 mentions in 6 dispatches (ST-LN-58 twice, ST-LN-60 twice, ST-LN-17, ST-LN-57). One was read (ST-LN-17), one grepped (ST-LN-57), and none appears in its report. `2026-10-25-plugin-audit.md` was named in the ST-LN-60 prompt, grepped and not read; in the ST-LN-58 ticket text twice and the ST-LN-60 ticket text once, it was neither read nor grepped. Several `docs/` mentions were background ("dogfood item 27") that no question asked about.

### Per dispatch

"Gap noted" is the hand-checked count of questions whose section carries a gap; gaps in preambles and tails are not in it. "Lane" row 52 is ST-LN-60's lane S scope.

| # | Date | Ticket | Context | Questions | With path:line | Gap noted | Lines / cap | Main session after |
|---:|---|---|---|---:|---:|---:|---|---|
| 1 | 2026-10-13 | TAGS-1 | intent | 6 | 6 | 1 | 7 / 60 (raised) |  |
| 2 | 2026-10-13 | BASE-1 | intent | 7 | 6 | 1 | 48 / 30 |  |
| 3 | 2026-10-14 | VID-1 | intent | 7 | 7 | 2 | 9 / 30 |  |
| 4 | 2026-10-14 | REFS-1 | intent | 7 | 7 | 0 | 47 / 30 |  |
| 5 | 2026-10-14 | ASK-1 | intent | 6 | 5 | 0 | 21 / 30 |  |
| 6 | 2026-10-14 | SHOW-1 | intent | 7 | 7 | 1 | 30 / 30 | checked a gap itself |
| 7 | 2026-10-14 | IDS-1 | intent | 8 | 8 | 0 | 53 / 30 |  |
| 8 | 2026-10-14 | ST-LN-1 | intent | 6 | 6 | 1 | 37 / 30 |  |
| 9 | 2026-10-15 | BUG-LN-1 | intent | 3 | 3 | 0 | 30 / 30 | re-read a cited file |
| 10 | 2026-10-15 | ST-LN-2 | intent | 9 | 9 | 1 | 66 / 80 (raised) | checked a gap itself |
| 11 | 2026-10-15 | ST-LN-3 | intent | 7 | 7 | 0 | 46 / 60 (raised) |  |
| 12 | 2026-10-16 | ST-LN-4 | intent | 6 | 5 | 2 | 62 / 60 (raised) |  |
| 13 | 2026-10-16 | ST-LN-6 | intent | 8 | 8 | 0 | 44 / 30 |  |
| 14 | 2026-10-16 | BUG-LN-2 | intent | 7 | 7 | 1 | 33 / 30 |  |
| 15 | 2026-10-17 | BUG-LN-3 | intent | 8 | 8 | 2 | 21 / 30 |  |
| 16 | 2026-10-17 | ST-LN-18 | intent | 8 | 8 | 0 | 62 / 60 (raised) |  |
| 17 | 2026-10-18 | ST-LN-5 | intent | 6 | 6 | 0 | 34 / 30 |  |
| 18 | 2026-10-18 | ST-LN-21 | intent | 7 | 7 | 0 | 40 / 30 |  |
| 19 | 2026-10-18 | ST-LN-7 | intent | 10 | 10 | 2 | 48 / 80 (raised) |  |
| 20 | 2026-10-18 | ST-LN-19 | intent | 8 | 6 | 3 | 14 / 30 | checked a gap itself |
| 21 | 2026-10-19 | ST-LN-20 | intent | 8 | 8 | 1 | 38 / 60 (raised) |  |
| 22 | 2026-10-19 | ST-LN-27 | intent | 8 | 8 | 1 | 19 / 30 |  |
| 23 | 2026-10-19 | ST-LN-12 | intent | 8 | 8 | 0 | 41 / 60 (raised) |  |
| 24 | 2026-10-21 | ST-LN-24 | intent | 7 | 7 | 0 | 15 / 30 |  |
| 25 | 2026-10-21 | ST-LN-26 | intent | 7 | 7 | 2 | 55 / 60 (raised) | checked a gap itself |
| 26 | 2026-10-21 | ST-LN-8 | intent | 8 | 8 | 0 | 29 / 80 (raised) |  |
| 27 | 2026-10-21 | ST-LN-30 | intent | 8 | 8 | 0 | 12 / 60 (raised) |  |
| 28 | 2026-10-21 | ST-LN-33 | intent | 6 | 6 | 2 | 48 / 60 (raised) |  |
| 29 | 2026-10-21 | ST-LN-34 | intent | 8 | 8 | 1 | 50 / 60 (raised) | checked a gap itself |
| 30 | 2026-10-21 | ST-LN-31 | intent | 8 | 7 | 3 | 38 / 30 | checked a gap itself |
| 31 | 2026-10-21 | ST-LN-14 | intent | 9 | 7 | 9 | 19 / 30 | checked a gap itself |
| 32 | 2026-10-22 | ST-LN-25 | intent | 9 | 9 | 1 | 43 / 30 |  |
| 33 | 2026-10-23 | ST-LN-45 | intent | 6 | 6 | 0 | 26 / 30 |  |
| 34 | 2026-10-23 | ST-LN-48 | intent | 7 | 6 | 0 | 81 / 120 (raised) |  |
| 35 | 2026-10-24 | BUG-LN-4 | intent | 6 | 6 | 2 | 61 / 30 | re-read a cited file |
| 36 | 2026-10-24 | BUG-LN-8 | intent | 7 | 7 | 0 | 62 / 30 | checked a gap itself |
| 37 | 2026-10-25 | ST-LN-44 | intent | 5 | 5 | 2 | 59 / 60 (raised) |  |
| 38 | 2026-10-25 | BUG-LN-7 | intent | 7 | 7 | 3 | 9 / 30 |  |
| 39 | 2026-10-25 | ST-LN-62 | intent | 8 | 8 | 1 | 65 / 30 | checked a gap itself |
| 40 | 2026-10-26 | BUG-LN-11 | intent | 6 | 6 | 1 | 24 / 30 |  |
| 41 | 2026-10-27 | (new request) | lane | 3 | 3 | 0 | 8 / 30 |  |
| 42 | 2026-10-28 | (new request) | lane | 6 | 6 | 1 | 34 / 60 (raised) |  |
| 43 | 2026-10-28 | BUG-LN-13 | lane | 5 | 5 | 1 | 28 / 30 |  |
| 44 | 2026-10-28 | ST-LN-58 | intent | 6 | 5 | 3 | 43 / 30 | checked a gap itself |
| 45 | 2026-10-28 | (new request) | lane | 4 | 4 | 2 | 34 / 40 (raised) |  |
| 46 | 2026-10-28 | ST-LN-58 | intent | 6 | 6 | 0 | 92 / 30 |  |
| 47 | 2026-10-28 | (new request) | lane | 4 | 4 | 1 | 17 / 30 |  |
| 48 | 2026-10-28 | (new request) | lane | 4 | 4 | 1 | 21 / 40 (raised) | checked a gap itself |
| 49 | 2026-10-29 | ST-LN-63 | intent | 6 | 6 | 1 | 76 / 80 (raised) |  |
| 50 | 2026-10-29 | ST-LN-64 | intent | 8 | 8 | 1 | 10 / 60 (raised) |  |
| 51 | 2026-10-29 | ST-LN-60 | intent | 9 | 9 | 1 | 50 / 80 (raised) |  |
| 52 | 2026-10-29 | ST-LN-60 | lane | 5 | 5 | 3 | 21 / 50 (raised) | checked a gap itself |
| 53 | 2026-10-29 | (new request) | lane | 4 | 3 | 0 | 24 / 30 |  |
| 54 | 2026-10-29 | ST-LN-17 | intent | 9 | 9 | 0 | 39 / 80 (raised) |  |
| 55 | 2026-10-29 | ST-LN-57 | intent | 7 | 7 | 2 | 53 / 30 |  |
| 56 | 2026-10-30 | (new request) | lane | 3 | 3 | 1 | 13 / 60 (raised) |  |

### Benchmark replays and the current dispatch

- The 10 benchmark replays (not counted above): 74 questions, 71 with a `path:line`, none left out; regex gap hits in 14 questions, not hand-checked.
- ST-LN-13 (2026-10-30, intent): 8 questions, all with a `path:line`; 2 regex gap hits ("not traced", "did not open a show command"); 31 non-empty lines against a cap of 80. It read both research files the ticket names.

## What the numbers show and do not show

Show:
- The scout left no question out in 56 dispatches, and 97% of questions got at least one `path:line`. About one question in six (17%, hand-checked) carries a gap in the scout's own words.
- The gap rate does not rise with more questions or with longer reports: 15 to 16% at 6 to 10 questions against 28% at 3 to 5, and 14% over 30 lines against 22% at 30 or fewer. No report gives the line cap as a reason for leaving something out. Half the reports under the default cap ran past 30 lines.
- The largest named cause of gaps is a file in reach that the scout says it did not read (37 of 64). The next is work that needs a shell (20 of 64). Every gap the main session closed itself, before asking the owner, was shell work.
- Files named only in a ticket's text were never read (0 of 7). Files named in the prompt were read in 5 of 21 cases and appeared in the report in 16.
- All 16 sampled facts held at the session's commit.

Do not show:
- Whether an answer that cites a location is complete or correct beyond the sample: completeness was not judged, and 16 facts bound the wrong-fact rate only loosely.
- Gaps the scout did not report: the count holds only the gaps it admitted, and misses those noted in preambles and tails.
- Cause and effect between prompt size, cap and gaps: the splits overlap, prompts raised the cap when they expected long answers, and ST-LN-14 alone weighs on the smaller groups.
- Whether an unread named file mattered: several were background no question asked about.
- Anything about effort or model: all 56 dispatches ran the configuration of their day, and the replays at two efforts were not compared here.
