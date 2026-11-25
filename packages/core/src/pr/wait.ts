// Phase 15 D-22: the verdict of one poll of `accord pr wait`, judged over what `gh pr view --json` returned. Pure: the host runs `gh` and prints; this reads JSON and imports no Node built-in module.

/** The part of `gh pr view --json ...` the verdict reads. */
export interface PrView {
  number?: number;
  state?: string; // OPEN | CLOSED | MERGED
  mergedAt?: string | null;
}

/** What one poll found. `pending` means: nothing ends the wait yet. */
export type WaitVerdict = { kind: 'merged'; number: number } | { kind: 'pending' };

/** The verdict of one poll. A merged state is reported before anything else; every other state is pending until the rules that follow it are in force. */
export function prWaitVerdict(view: PrView): WaitVerdict {
  if (view.state === 'MERGED') return { kind: 'merged', number: view.number ?? 0 };
  return { kind: 'pending' };
}
