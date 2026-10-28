# ST-LN-44 measurements

Every test over 8 s in the baseline full run (2026-10-24) or the second full run (2026-10-25), with its time when its file ran alone (2026-10-25). Times in seconds.
The second full run skipped the executed workflow-script cases (bash on PATH was the WSL one), so their "full 10-25" cell is 0.0; their alone run used Git Bash as ACCORD_BASH. show-approval timed out at 300 s in the second full run.

| # | baseline | full 10-25 | alone | file | test |
|---|---|---|---|---|---|
| 1 | 291.9 | 302.3 | 259.6 | cli/test/show-approval.test.ts | ac-1 every scenario of every real ticket is rebuilt exactly from the approval view |
| 2 | 105.2 | 0.0 | 135.3 | cli/test/workflow-script.test.ts | the emitted workflow script — executed > the workflow of this repository gates the same tickets with the same exit as the emitted one |
| 3 | 99.9 | 101.4 | 58.6 | cli/test/lane-s.test.ts | risk:complex-branching lane S gate done passes a reviewed change and fails on a commit after it an unclean review lines after the verdict a failed suite and edited sections |
| 4 | 87.3 | 90.6 | 100.5 | cli/test/after-verify.test.ts | risk:complex-branching the commits after verify come from the ticket tip without the default branch in graph order |
| 5 | 31.5 | 63.1 | 68.3 | cli/test/worktree.test.ts | risk:data-loss clean removes only a done ticket and keeps a branch with a commit after its verified commit |
| 6 | 58.1 | 0.0 | 35.0 | cli/test/workflow-script.test.ts | the emitted workflow script — executed > code in the diff or an approved ticket: gate done runs and its failure fails the job |
| 7 | 55.4 | 53.3 | 17.0 | cli/test/drop.test.ts | risk:complex-branching drop reads the claim tip that holds the other refuses diverged tips and falls back to the default branch |
| 8 | 47.1 | 48.6 | 14.5 | cli/test/trailers.test.ts | ac-3 task-done refuses a task whose commit carries a forbidden line when the repository forbids trailers |
| 9 | 44.9 | 0.0 | 19.0 | cli/test/workflow-script.test.ts | the emitted workflow script — executed > unapproved tickets in an accord-only diff: lint runs and no gate done runs and the exit follows lint |
| 10 | 43.8 | 44.2 | 15.1 | cli/test/lane-flow.test.ts | lane ticket flow > walks one ticket from unapproved to done |
| 11 | 43.0 | 43.1 | 19.4 | core/test/benchmark-worktree.test.ts | risk:regression a suite that fails once and passes on its re-run does not stop --plan and the re-run is recorded |
| 12 | 42.8 | 41.8 | 18.1 | cli/test/upgrade.test.ts | ac-3 upgrade pushes a branch from the latest origin main whose one commit moves every pin and the checkout is unchanged |
| 13 | 41.1 | 41.3 | 15.6 | cli/test/upgrade.test.ts | risk:data-loss upgrade refuses and pushes nothing when the branch exists the pin is not older the settings are not an object or lint fails |
| 14 | 24.7 | 38.4 | 48.1 | cli/test/worktree.test.ts | ac-5 clean pick up continue and a new worktree ticket remove the worktree and both branches of a done ticket |
| 15 | 34.5 | 31.0 | 25.5 | cli/test/worktree.test.ts | risk:complex-branching continue reaches a ticket whose file is only on its branch here or on origin |
| 16 | 32.1 | 30.1 | 18.9 | core/test/benchmark-worktree.test.ts | risk:regression --plan leaves the tests.report of tests.full in every verifier worktree, even from a red suite |
| 17 | 32.1 | 0.0 | 36.2 | cli/test/workflow-script.test.ts | the emitted workflow script — executed > risk:parsing BOM and CRLF frontmatter and unreadable blocks and large files read as approved |
| 18 | 20.3 | 31.8 | 32.6 | cli/test/worktree.test.ts | ac-4 in claude code a session that works a ticket refuses other tickets and new tickets and changes nothing |
| 19 | 29.5 | 31.0 | 7.1 | cli/test/hook.test.ts | risk:security the prompt expansion hook blocks every accord text but the dashboard and continue of the worked ticket |
| 20 | 30.4 | 27.5 | 46.1 | cli/test/after-verify.test.ts | risk:complex-branching status in the main checkout takes a claimed ticket back from done when its branch holds a fix after verify |
| 21 | 21.4 | 30.2 | 67.8 | cli/test/worktree.test.ts | risk:data-loss worktree merge never overwrites an ignored file and quotes the git error that stopped it |
| 22 | 26.7 | 29.2 | 29.2 | core/test/benchmark-worktree.test.ts | risk:regression --plan --rerun keeps and rebuilds the named tag alone, before it prepares its worktree |
| 23 | 27.1 | 24.2 | 18.8 | core/test/benchmark-worktree.test.ts | risk:regression --plan exits 2 naming the report file when tests.full leaves none in a verifier worktree |
| 24 | 15.5 | 26.3 | 28.2 | cli/test/worktree.test.ts | risk:complex-branching a session whose hold was cleaned or taken over still works its ticket when resumed in the main checkout |
| 25 | 21.8 | 26.2 | 10.2 | cli/test/gate.test.ts | ac-4 gate done refuses a ticket branch holding any forbidden line when the repository forbids trailers |
| 26 | 15.9 | 25.9 | 44.4 | cli/test/worktree.test.ts | risk:data-loss a continue merge that conflicts is aborted and a worktree with uncommitted changes or a live hold is not merged |
| 27 | 25.8 | 24.8 | 20.2 | cli/test/worktree.test.ts | risk:complex-branching the holding session re-enters its own hold and a partial table refuses |
| 28 | 25.7 | 23.5 | 11.7 | cli/test/dashboard.test.ts | ac-1 ready tickets are ranked by inherited priority then by id |
| 29 | 25.1 | 25.1 | 21.3 | core/test/benchmark-worktree.test.ts | risk:regression a suite that fails on its re-run too is red |
| 30 | 20.6 | 25.0 | 4.8 | cli/test/show.test.ts | risk:complex-branching show takes blockers from the checkout not the claim branch |
| 31 | 14.4 | 24.8 | 33.5 | cli/test/worktree.test.ts | risk:data-loss an origin branch is deleted only with a lease and only after a fetch that succeeded |
| 32 | 24.7 | 23.6 | 5.2 | cli/test/drop.test.ts | ac-1 dropping a ticket pushes a branch from the default branch whose only change is the ticket file set to dropped |
| 33 | 20.0 | 24.3 | 21.6 | core/test/benchmark-worktree.test.ts | risk:regression two --plan runs run tests.full once per verifier sample and its effort rows share the report |
| 34 | 21.5 | 24.2 | 29.9 | cli/test/worktree.test.ts | risk:complex-branching pick up refuses a branch another person claimed and reuses one claimed by the same email |
| 35 | 23.5 | 0.0 | 23.5 | cli/test/workflow-script.test.ts | risk:security a lane S ticket that passed gate ready is gated in an accord-only diff and a queued one is not |
| 36 | 23.5 | 22.4 | 19.1 | cli/test/worktree.test.ts | ac-1 pick up adds the ticket worktree from origin main runs setup in order and prints where to continue |
| 37 | 22.1 | 23.0 | 25.1 | core/test/benchmark-worktree.test.ts | risk:regression --plan exits 2 naming tests.report when a verifier sample base config has none |
| 38 | 12.9 | 21.8 | 28.3 | cli/test/worktree.test.ts | ac-5 a failed or silent fetch is one accord line at pick up new ticket continue and merge and the work goes on |
| 39 | 20.7 | 20.2 | 11.2 | cli/test/drop.test.ts | risk:complex-branching drop refuses a failed fetch an existing drop branch a ticket already dropped and names a failed push |
| 40 | 20.6 | 19.8 | 4.8 | cli/test/drop.test.ts | ac-2 dropping without a reason is refused and nothing is created committed or pushed |
| 41 | 18.6 | 20.5 | 4.0 | cli/test/drop.test.ts | risk:data-loss drop pushes a crlf ticket file with a bom byte for byte outside the status value and the dropped section |
| 42 | 16.5 | 20.3 | 12.5 | cli/test/worktree.test.ts | risk:security a ticket id cannot place a worktree outside its sibling folder |
| 43 | 19.8 | 20.1 | 5.1 | cli/test/status.test.ts | ac-2 a recent commit on the claim branch keeps the ticket active |
| 44 | 19.9 | 20.1 | 13.1 | cli/test/status.test.ts | ac-3 a plan reaches build only after its ready commit and while clean |
| 45 | 5.8 | 18.7 | 58.4 | cli/test/worktree.test.ts | risk:complex-branching pick up refuses a ticket the default branch holds as dropped |
| 46 | 18.6 | 16.1 | 7.1 | cli/test/status.test.ts | ac-1 a ticket filed only on its pushed claim branch shows at that branch stage without a fetch |
| 47 | 17.2 | 18.4 | 14.3 | cli/test/worktree.test.ts | risk:complex-branching a worktree whose setup never finished reruns setup in full |
| 48 | 18.1 | 18.2 | 9.8 | cli/test/worktree.test.ts | ac-4 a live holder refuses a second session and a dead holder is taken over |
| 49 | 18.2 | 15.9 | 13.2 | cli/test/worktree.test.ts | ac-2 a failing setup command exits 2 naming it and keeps the worktree |
| 50 | 17.7 | 17.8 | 14.2 | cli/test/worktree.test.ts | risk:data-loss clean keeps unpushed commits and new files that git status config would hide |
| 51 | 17.0 | 17.7 | 4.1 | cli/test/hook.test.ts | risk:complex-branching the prompt expansion hook allows with one stderr line when its input holds or git cannot be read |
| 52 | 13.2 | 17.7 | 34.6 | cli/test/worktree.test.ts | ac-5 outside claude code pick up continue and new ticket print the stop lines and nothing is refused |
| 53 | 17.6 | 14.0 | 4.3 | cli/test/hook.test.ts | ac-1 a newer release is announced by the session start hook and the dashboard and the registry is asked once in 24 hours |
| 54 | 16.0 | 17.5 | 4.3 | cli/test/dashboard.test.ts | risk:complex-branching a dependency done only on its claim branch still blocks its dependent |
| 55 | 12.1 | 17.4 | 33.0 | cli/test/worktree.test.ts | ac-4 continue merges the latest origin main into a ticket branch before verify runs setup on the merge and pushes it |
| 56 | 16.5 | 17.2 | 16.4 | cli/test/worktree.test.ts | ac-5 bare accord fetches then removes merged worktrees and names what it keeps |
| 57 | 16.0 | 0.0 | 20.4 | cli/test/workflow-script.test.ts | the emitted workflow script — against the real CLI > dropped ticket in an accord-only diff: no gate done on it and a missing Dropped reason fails through lint |
| 58 | 11.1 | 16.0 | 19.7 | cli/test/worktree.test.ts | risk:complex-branching in claude code a pick up whose setup failed and a new ticket whose push failed still hold their ticket and refuse a second one |
| 59 | 15.7 | 15.2 | 8.8 | cli/test/worktree.test.ts | risk:complex-branching pick up refuses a ticket that origin main lacks |
| 60 | 14.2 | 15.3 | 3.4 | cli/test/show.test.ts | risk:complex-branching show holds a plan at stage plan until its ready commit |
| 61 | 12.3 | 15.0 | 4.9 | core/test/benchmark-compliance.test.ts | ac-5 the compliance check scores every run against the other rules |
| 62 | 13.1 | 14.2 | 13.1 | cli/test/worktree.test.ts | risk:concurrency a locked hold file is never overwritten |
| 63 | 11.7 | 14.1 | 6.3 | cli/test/lane-s.test.ts | ac-2 a lane S ticket is written and passes gate ready without acceptance criteria |
| 64 | 14.0 | 14.0 | 3.7 | cli/test/show.test.ts | risk:regression show finds a ticket filed only on its claim branch at that branch stage |
| 65 | 6.1 | 13.9 | 43.9 | cli/test/worktree.test.ts | ac-1 pick up and a new worktree ticket cut the ticket branch from a main commit this clone had not fetched |
| 66 | 12.3 | 13.9 | 7.3 | cli/test/worktree.test.ts | ac-3 continue from another checkout reuses the worktree holding the branch |
| 67 | 7.6 | 13.9 | 10.1 | cli/test/worktree.test.ts | risk:data-loss a second clone deletes its local branch of a dropped ticket another clone cleaned |
| 68 | 13.5 | 12.5 | 5.2 | cli/test/hook.test.ts | risk:complex-branching the registry is asked again only after 24 hours and only a newer plain version is announced |
| 69 | 13.3 | 13.0 | 7.3 | cli/test/lane-s.test.ts | ac-3 the dashboard lists a queued and a claimed lane S ticket with a lane column |
| 70 | 9.7 | 12.9 | 23.9 | cli/test/worktree.test.ts | risk:complex-branching worktree merge refuses before verify on another branch and over tracked changes and merges nothing |
| 71 | 10.3 | 12.8 | 3.9 | cli/test/dashboard.test.ts | ac-2 rows carry titles and sections carry column headers |
| 72 | 9.3 | 12.5 | 12.6 | cli/test/worktree.test.ts | ac-1 bare accord deletes merged ticket branches with or without a worktree and names the checked out one it keeps |
| 73 | 9.1 | 12.2 | 3.4 | cli/test/lane-commands.test.ts | accord task-done > refuses a task number that is not one, and a repository with no commit, exit 2 |
| 74 | 9.4 | 11.8 | 2.5 | cli/test/hook.test.ts | risk:security the prompt expansion hook lets accord upgrade through in a session that works a ticket |
| 75 | 10.2 | 11.8 | 9.8 | cli/test/worktree.test.ts | risk:complex-branching a failed fetch is said and the refs in the clone are judged |
| 76 | 10.6 | 11.7 | 24.0 | cli/test/worktree.test.ts | ac-4 a merge conflict is aborted names the file exits 2 and the next merge tries again |
| 77 | 11.4 | 11.6 | 12.8 | cli/test/worktree.test.ts | risk:data-loss a stale holds lock keeps a merged clean worktree, names it, and clean exits 0 |
| 78 | 8.7 | 11.5 | 2.6 | cli/test/dashboard.test.ts | risk:complex-branching the viewer comes from git user.email without case and an empty one exits 2 |
| 79 | 10.4 | 11.4 | 4.8 | cli/test/drop.test.ts | risk:data-loss drop refuses an uncommitted ticket file in the worktree holding its branch |
| 80 | 5.9 | 11.3 | 11.3 | cli/test/worktree.test.ts | ac-2 in claude code continue from the main checkout enters a claimed worktree whose session ended with or without a worktree here |
| 81 | 10.9 | 11.3 | 3.0 | cli/test/dashboard.test.ts | ac-4 an unwritten intent points anchor and dashboard to the intent interview |
| 82 | 9.8 | 11.1 | 8.8 | cli/test/worktree.test.ts | risk:complex-branching outside claude code no hold is taken and one line says so |
| 83 | 10.9 | 11.0 | 15.4 | cli/test/after-verify.test.ts | risk:complex-branching review-package leaves out what a merge from the default branch brought in |
| 84 | 10.3 | 10.9 | 6.3 | cli/test/worktree.test.ts | risk:complex-branching continue never claims a ticket |
| 85 | 5.2 | 10.9 | 27.4 | cli/test/worktree.test.ts | ac-3 worktree merge at verify gives the ticket branch a merge commit of its head and the fetched main commit |
| 86 | 9.9 | 10.9 | 10.4 | cli/test/worktree.test.ts | risk:complex-branching in claude code a worktree pinned to another accord version refuses before setup and prints no enter |
| 87 | 10.5 | 10.4 | 4.4 | cli/test/new-ticket.test.ts | risk:complex-branching a ticket added and deleted on a merged and deleted branch keeps its number |
| 88 | 5.0 | 10.3 | 16.6 | cli/test/worktree.test.ts | risk:complex-branching a claude code session that sets no session variables keeps the main checkout flows and only the folder rule refuses it |
| 89 | 4.8 | 10.1 | 8.6 | cli/test/worktree.test.ts | risk:complex-branching a session started in a ticket worktree is recorded as working it when the start hook takes no hold |
| 90 | 8.2 | 10.1 | 2.2 | cli/test/dashboard.test.ts | risk:regression an idle ticket shows idle days in the dashboard text and the json keeps every key |
| 91 | 9.6 | 10.1 | 5.2 | cli/test/hook.test.ts | ac-2 an unreachable registry adds no line is given up after 3 seconds and is not asked again |
| 92 | 5.1 | 9.9 | 9.7 | cli/test/worktree.test.ts | risk:data-loss clean keeps everything of a dropped ticket that a guard keeps or whose worktree remove fails |
| 93 | 6.2 | 9.7 | 7.6 | cli/test/worktree.test.ts | risk:data-loss clean deletes a dropped ticket branch that exists on one side only when nothing is lost |
| 94 | 9.7 | 9.2 | 2.5 | cli/test/show.test.ts | risk:security show text turns control and bidi characters into spaces |
| 95 | 8.6 | 9.7 | 1.9 | cli/test/status.test.ts | ac-1 a ticket untouched past the window shows its idle days |
| 96 | 9.3 | 9.6 | 12.1 | cli/test/after-verify.test.ts | risk:regression of a real bug: a fix made at verify, before any verification.md, gets a review round |
| 97 | 9.5 | 7.9 | 8.0 | cli/test/worktree.test.ts | ac-1 in claude code pick up from the main checkout takes the hold and prints enter instead of stop |
| 98 | 4.4 | 9.4 | 6.5 | cli/test/worktree.test.ts | risk:data-loss clean keeps the local branch of a dropped ticket that moved after clean read it |
| 99 | 7.8 | 9.4 | 2.3 | cli/test/bin.test.ts | risk:parsing the built cli hands hook input on stdin to the prompt expansion hook |
| 100 | 7.7 | 9.3 | 2.5 | core/test/benchmark-samples.test.ts | risk:data-loss a sample snapshot keeps the dispatch and every named file and is never overwritten |
| 101 | 5.1 | 9.3 | 8.4 | cli/test/worktree.test.ts | risk:data-loss clean keeps a dropped ticket whose origin branch has commits not here or has diverged |
| 102 | 9.1 | 8.9 | 7.8 | cli/test/lane-s.test.ts | risk:complex-branching the review package of a lane S ticket starts at the fork point from the default branch |
| 103 | 4.4 | 9.0 | 8.1 | cli/test/worktree.test.ts | ac-4 clean keeps a dropped ticket whose local branch has commits not on origin |
| 104 | 6.4 | 8.7 | 7.6 | cli/test/lane-commands.test.ts | ac-3 lint rejects an invalid template and anchor still reads the t branch |
| 105 | 5.3 | 8.6 | 10.0 | cli/test/worktree.test.ts | ac-3 clean deletes the worktree and both branches of a ticket dropped on the default branch |
| 106 | 8.5 | 7.3 | 3.3 | cli/test/status.test.ts | risk:complex-branching a merged or checked out or ticketless claim branch keeps the checkout copy |
| 107 | 8.5 | 6.7 | 1.7 | cli/test/lane-commands.test.ts | accord review-package > prints commits, stat, and diff since the base |
| 108 | 8.4 | 7.6 | 2.0 | cli/test/skills-sync.test.ts | accord skills sync — the orphan report (D-113, D-123) > leaves no accord-* directory unreported, whichever runtime is dropped |
| 109 | 8.3 | 0.0 | 2.3 | cli/test/workflow-script.test.ts | the emitted workflow script — executed > ticket-adding diff: gates that ticket by the id in its file name (D-137) |
| 110 | 6.9 | 8.2 | 3.0 | cli/test/new-ticket.test.ts | ac-1 new ticket assigns the creators next number for its type |
| 111 | 7.7 | 8.2 | 3.5 | cli/test/worktree.test.ts | risk:complex-branching continue prunes a worktree whose folder was deleted by hand |
| 112 | 7.7 | 8.2 | 2.4 | cli/test/tracker.test.ts | the gates are blind to the tracker (D-99) > returns deeply equal results with a token and with the environment scrubbed |
| 113 | 6.6 | 8.2 | 6.8 | cli/test/worktree.test.ts | risk:data-loss a failed push keeps the claim commit and names the quoted push to run |

Rows 114-118 (D-12) are the tests BUG-LN-8 added to upgrade.test.ts after this ticket's baseline. They have no full-run time yet; "alone" is upgrade.test.ts run alone on main at 583a9e8 (2026-10-25, Git Bash).

| # | baseline | full 10-25 | alone | file | test |
|---|---|---|---|---|---|
| 114 | - | - | 24.6 | cli/test/upgrade.test.ts | ac-2 upgrade replaces only the lint and gate step and keeps every other line of the workflow |
| 115 | - | - | 25.6 | cli/test/upgrade.test.ts | risk:complex-branching an anchored or flow lint and gate step is only repinned and the warning says it must be a block list item |
| 116 | - | - | 16.5 | cli/test/upgrade.test.ts | ac-3 a workflow with no or two lint and gate steps is only repinned and upgrade warns on stderr |
| 117 | - | - | 8.5 | cli/test/upgrade.test.ts | risk:complex-branching a step that was not refreshed still gets its warning when the push fails |
| 118 | - | - | 7.6 | cli/test/upgrade.test.ts | ac-1 upgrade replaces the lint and gate step of a 0.1.0 workflow with the step accord init writes now |

In the same alone run on main, #12 took 12.76 s and #13 took 12.78 s. The table's 3.36 ratio for rows 114-118 is #12's larger full-run time over that: 42.8 / 12.76, rounded up.
