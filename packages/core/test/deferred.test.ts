// ST-LN-12 7-ac-7 (D-12): the ledger's deferred items the owner is asked about at verify, Must then Should, Nice never.
import { expect, it } from 'vitest';
import { ownerDeferred, ratingOf } from '../src/index.js';

const LEDGER = [
  '## Rulings',
  '- Ruling: keep it small — fewer files — one more command',
  '',
  '## Deferred',
  '- review 1.1: the retry stays at three (Nice)',
  '- review 1.2: the export drops a trailing comma (Should)',
  '- review 1.3: the lock is not released on a crash (Must)',
  '- plan-review 1.4 the error text names no file',
  '- review 1.5: old name kept (Nice) but a later mark (Must)',
  '',
].join('\n');

it('risk:parsing the deferred lister shows Must then Should items and skips Nice (ST-LN-12 7-ac-7)', () => {
  // the Must line first, then the Should and the unmarked lines in ledger order; both Nice-first lines are skipped
  expect(ownerDeferred(LEDGER)).toEqual([
    { rating: 'Must', text: 'review 1.3: the lock is not released on a crash (Must)' },
    { rating: 'Should', text: 'review 1.2: the export drops a trailing comma (Should)' },
    { rating: 'Should', text: 'plan-review 1.4 the error text names no file' },
  ]);

  // the rating is the first of the three marks by position, matched exactly; no mark counts as Should
  expect(ratingOf('a (Must) and (Nice)')).toBe('Must');
  expect(ratingOf('a (Nice) and (Must)')).toBe('Nice');
  expect(ratingOf('(Should) then (Must)')).toBe('Should');
  expect(ratingOf('no mark at all')).toBe('Should');
  expect(ratingOf('a (must) and a [Nice] and Nice:')).toBe('Should');

  // a line longer than 160 characters is cut with an ellipsis; one of 160 is kept whole
  const long = 'x'.repeat(200) + ' (Must)';
  const [cut] = ownerDeferred('## Deferred\n- ' + long + '\n');
  expect(cut.text.length).toBe(160);
  expect(cut.text.endsWith('…')).toBe(true);
  expect(cut.text).toBe('x'.repeat(159) + '…');
  const exact = 'y'.repeat(150) + ' (Should)';
  expect(exact.length).toBeLessThanOrEqual(160);
  expect(ownerDeferred('## Deferred\n- ' + exact + '\n')[0].text).toBe(exact);

  // no text, no section, an empty section, and a section of Nice items only give nothing
  expect(ownerDeferred('')).toEqual([]);
  expect(ownerDeferred('## Rulings\n- Ruling: a — b — c\n')).toEqual([]);
  expect(ownerDeferred('## Deferred\n')).toEqual([]);
  expect(ownerDeferred('## Deferred\n- a (Nice)\n- b (Nice)\n')).toEqual([]);

  // every `## Deferred` section is read in order; a comment and a fenced block are not items; CRLF and a BOM change nothing
  const many = ['\u{FEFF}## Deferred', '<!-- - hidden (Must) -->', '- first (Should)', '```', '- fenced (Must)', '```', '', '## Notes', '- not deferred (Must)', '', '## Deferred', '* second (Must)', ''].join('\r\n');
  expect(ownerDeferred(many)).toEqual([
    { rating: 'Must', text: 'second (Must)' },
    { rating: 'Should', text: 'first (Should)' },
  ]);

  // the heading is matched as the ledger parser matches it: case and spacing do not matter; a line that is no list item is skipped
  expect(ownerDeferred('##  deferred\nplain prose (Must)\n- kept (Must)\n')).toEqual([{ rating: 'Must', text: 'kept (Must)' }]);
});
