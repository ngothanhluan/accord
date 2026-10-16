// Counts plan rounds from accord/tickets/<id>/plan-review.md: only sections after the last `## Closed` line.
export function parsePlanReview(text) {
  const closed = [...text.matchAll(/^## Closed\b.*$/gm)].at(-1);
  const body = closed ? text.slice(closed.index + closed[0].length) : text;
  const out = { rounds: 0, whole: 0, diff: 0, wholeAfterFirst: 0, must: 0, should: 0 };
  for (const sec of body.split(/^(?=## Round )/m)) {
    const h = sec.match(/^## Round (\d+) \((whole|diff)\)/);
    if (!h) continue;
    out.rounds++;
    out[h[2]]++;
    if (h[2] === 'whole' && h[1] !== '1') out.wholeAfterFirst++;
    // a finding that starts `repeats <round>.<n>:` carries an earlier one on, so it is not new
    out.must += (sec.match(/^\d+\. Must — (?!repeats )/gm) ?? []).length;
    out.should += (sec.match(/^\d+\. Should — (?!repeats )/gm) ?? []).length;
  }
  return out;
}
