# Ledger: BUG-LN-14

## Rulings

- Ruling: step 2's look-before-asking reuses the accord-scout report run for the lane proposal on 2026-10-28, which covered this request's files, hold liveness, the refusal text, skill wording and tests — the ticket file was still the empty template, so a second scout on it would see nothing new — a fact the interview needs and that report missed is asked of a new scout before the owner.
- Ruling: ac-1 says the hold record of ST-9 is removed, not merely ignored — D-02 says the old conversation's hold "is released", and a record left on disk would still count for the dashboard and clean — cost if wrong: one Then line reworded and its test changed.
- Ruling: ac-2 names the claim path, `accord worktree open ST-10` on a ticket nobody has claimed — a fresh claim is how a cleared window takes another ticket (on 2026-10-27 it took BUG-LN-12 as a new ticket, which claims through the same hold) — cost if wrong: the continue path and `accord new ticket --worktree` go untested for this case.
- Ruling: ac-3's second window is open in ST-9's own worktree folder — the stronger case, so a release keyed on the folder instead of the window fails it — cost if wrong: none, the weaker case is covered by it.
- Ruling: ac-4's folder is the one the holding session worked in when it took the hold, recorded with the hold — after a /clear or a move the worktree path alone may not be where the window is — cost if wrong: the hold record keeps one extra field.
