# Ledger: ST-LN-54

## Rulings

Ruling: the report format lives in a new `shared/finish.md` loaded by accord-verify and accord, and both steps point to it — `verify/SKILL.md` is 70 bytes under its 5120-byte cap — cost if wrong: one more reference file to read at the finish
Ruling: with no pull request open the verdict reads `✅ <id> DONE — branch <branch> pushed, open its pull request` — `gh` can be missing, and the line must never claim a merge — cost if wrong: the owner sees a second verdict wording
Ruling: `Next:` leaves out a dashboard action on the ticket just finished (round 1 Nice) — recommending to continue a ticket that is done waiting for merge is no next step — cost if wrong: the owner loses a reminder that the PR still waits
