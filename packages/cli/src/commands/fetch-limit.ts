// ST-LN-30 D-08: the fetch's time limit lives here so a test can mock it.
export function fetchLimitMs(): number {
  return 30_000;
}

// ST-LN-16 D-19 Ruling "Dashboard and the network": the dashboard and the panel wait for this one fetch, so it is bounded tighter than a ticket command's, and mockable apart from it.
export function dashboardFetchLimitMs(): number {
  return 10_000;
}

// ST-LN-55 fix 5: the hook clean starts no new branch, entry or folder after 300 s, well below the hook's 600 s timeout, so the one it started still finishes in time.
export function cleanBudgetMs(): number {
  return 300_000;
}
