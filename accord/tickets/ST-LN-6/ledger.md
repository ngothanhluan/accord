# Ledger

## Rulings
- Ruling: `accord show` with an id that names no ticket exits 2 with a message naming the id — the CLI's exit-code table gives 2 to usage errors, and the lane commands already throw `UsageError` "no ticket <id> in accord/tickets/" (`packages/cli/src/commands/lane-args.ts:18`) — cost if wrong: one exit code and message change.
- Ruling: the dashboard bug (a ticket only on its claim branch is invisible; the stage reads build before `plan: <id> ready`) stays its own bug ticket, not part of ST-LN-6 — the owner chose "Ticket bug riêng (Khuyên)" on 2026-10-16 — cost if wrong: `accord show` of a ticket only on its claim branch fails until that bug is fixed.
