# Ledger

## Tasks

## Rulings

- Ruling: a lane ticket with no commit on its records and no claim branch has no idleDays — nothing to measure against — cost if wrong: a never-committed draft ticket is not flagged.
- Ruling: activity uses committer time (%ct, committerdate), not author time — a rebased or amended branch counts as recent — cost if wrong: a branch rebased without other work hides staleness.
- Ruling: a lane ticket at stage intent can be idle; the criteria exclude only done, dropped, and archived — cost if wrong: unapproved drafts get flagged.
- Ruling: when git log fails, lastActivity stays empty and nothing is idle, as gitFacts already treats that case — cost if wrong: a broken log silently hides staleness.
- Ruling: idle is computed in core, not by decorating rows in the CLI — --json stdout stays the core array verbatim and the CLI adds no column — cost if wrong: none known.
- Ruling: review.mode is outcome for this repository — solo owner reviews outcomes, not slices — cost if wrong: the owner wanted per-slice pull requests.
- Ruling: the claim branch t/STALE-1 stays local at the owner's word — the owner said "Giữ local" — cost if wrong: a teammate does not see the claim.

## Deferred
