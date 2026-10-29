# Ledger

## Tasks

## Rulings

- Ruling: the rules cover lane S and lane M review alike — ST-LN-17, which this ticket waits on, counts rounds for both lanes, and the measured late findings came from both — if wrong, lane S review text changes for nothing and is reverted.
- Ruling: whether the round cap and tier-up count restart after a return from verify stays with ST-LN-17, which holds that question; this ticket's "own round 1" covers only code added by a debug episode or a merge of main — if wrong, post-verify rework is reviewed under the old count until a follow-up.
- Ruling: after the audit, a round's "fix" means the commits its findings name as `fixed in`; debug and merge commits are not fix commits, they are covered by the added code's own round 1 — the record already names fix commits, and treating a merge as a fix would ask a Ruling for every file main changed — if wrong, files a debug episode changed escape the fix-file check.
- Ruling: a merge of main is reviewed without what it brought in from main, as the review package already does (ST-LN-26) — main's code was reviewed on main — if wrong, a conflict resolution inside main's files goes unreviewed.
- Ruling: carried forward, data loss or security, and the Deferred link are explicit marks on the finding line that the gate reads, not text the gate compares — D-04 has the CLI check the form only — if wrong, a reviewer can mark a new finding as carried forward to dodge the evidence rule.
- Ruling: a ticket line is a reference to an acceptance criterion, Decision, Veto or Intent line, and the gate checks it exists in the ticket; a Ruling naming a file gives its repository path and a reason, as the reviewer's undeclared-file rule already asks — if wrong, the form is looser or stricter than the owner wants and changes at review.
- Ruling: after the second audit — a merge's conflict resolutions are reviewed as added code and main's own files are not; a finding is placed by its location field, and one with no file counts as outside the last fix; the grounds rule for a Should uses the same count and carried-forward exemption as the evidence rule; a fix file is explained only by a finding located in it — each follows D-03 and D-05 and the record's one location per finding — if wrong, the check is stricter or looser at the edges and changes at review.
- Ruling: the exact form of each mark on a finding line (carried forward, deferred link, data loss or security, test or command, ticket reference) and the round record's head commit is left to the approach, kept compatible with ST-LN-56's finding statement — the criteria fix what the gate decides, not the syntax — if wrong, the approach picks a form the owner dislikes and it changes at approach review.

## Deferred
