# Ledger: BUG-LN-10

## Rulings
- Ruling: "older" is read as "differs" — the build's baked `pkg.version` against the package.json beside it, by exact string equality — D-94 forbids semver comparison in the pin — cost if wrong: a build newer than its package.json (a local downgrade) is also called stale, and `npm run build` still fixes it.
- Ruling: the stale message is chosen only inside a pin mismatch, and wins over the npx fix whatever the pin says — after `npm run build` the next refusal, if any, names npx as today — cost if wrong: one extra step when a clone is both stale and pinned to a third version.
- Ruling: the disk read is a separate `versionOnDisk()` in pin.ts, so `pinMessage` stays pure — both callers (run.ts preflight, init.ts) need it — cost if wrong: none beyond one exported helper.
- Ruling: the `show-approval.test.ts` ac-1 timeout (300 s) in the affected run is suite load, not this change — it passed alone in 131 s and never reaches the pin path — cost if wrong: a real regression there goes unseen until CI.
