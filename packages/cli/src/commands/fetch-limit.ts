// ST-LN-30 D-08: the fetch's time limit lives here so a test can mock it.
export function fetchLimitMs(): number {
  return 30_000;
}
