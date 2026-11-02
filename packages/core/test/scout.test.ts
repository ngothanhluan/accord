// ST-LN-81: the scout report parser.
import { expect, it } from 'vitest';
import { parseScoutReport } from '../src/index.js';

const REPORT = [
  '## Files',
  '- `src/a.ts` — the writer, src/a.ts:3-5',
  '',
  '## Absent',
  '| Claim | Pattern | Folders | Allowed hits |',
  '|---|---|---|---|',
  '| no csv or tsv writer | `csv\\|tsv` | `src/`, lib | src/a.ts |',
  '',
  'See src/b.ts:1,4 and docs/c.md:2-3,9 and https://example.com:443/x and localhost:3000 and /abs/d.ts:2.',
  '',
].join('\n');

it('risk:parsing table cells unescape pipes and strip one pair of backticks and citations read ranges and lists', () => {
  const parsed = parseScoutReport(REPORT);
  expect(parsed.files).toEqual(['src/a.ts']);
  expect(parsed.absent).toEqual([{ line: 7, claim: 'no csv or tsv writer', pattern: 'csv|tsv', folders: ['src/', 'lib'], allowed: ['src/a.ts'] }]);
  expect(parsed.faults).toEqual([]);
  expect(parsed.citations.map((c) => [c.path, c.numbers])).toEqual([
    ['src/a.ts', [3, 5]],
    ['src/b.ts', [1, 4]],
    ['docs/c.md', [2, 3, 9]],
  ]);

  const bad = parseScoutReport(REPORT.replace(/^\| no csv.*$/m, '| a | b | c |'));
  expect(bad.faults).toEqual(['## Absent row at line 7 has 3 cells, not 4: escape a pipe inside a cell']);
  expect(bad.absent).toEqual([]);
});
