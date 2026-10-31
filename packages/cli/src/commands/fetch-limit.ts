// ST-LN-30 D-08: the fetch's time limit lives here so a test can mock it.
export function fetchLimitMs(): number {
  return 30_000;
}

// ST-LN-55 fix 5: the hook clean starts no new branch, entry or folder after 300 s, well below the hook's 600 s timeout, so the one it started still finishes in time.
export function cleanBudgetMs(): number {
  return 300_000;
}
