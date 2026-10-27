# Ledger: BUG-LN-12

## Rulings

Ruling: raise the attempt count from 12 to 40 and keep the 15s sleep — the request named the 3-minute budget, not the interval, and a short interval still ends the job soon after the version appears — cost if wrong: up to 40 npx calls against the registry on a slow release instead of fewer, longer waits
