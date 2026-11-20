// ST-LN-12 7-ac-7 (D-12): the ledger's deferred items the owner is asked about at verify, Must then Should, Nice never.
import { expect, it } from 'vitest';
import { deferredMark, ownerDeferred, ratingOf } from '../src/index.js';

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

// Phase 8.2 D-04: the owner's answer on a deferred item is a mark at the end of its ledger line, read on the full line before the short form.
it('risk:parsing a deferred mark is the arrow and an id or declined at the end of the full line (8.2-ac-5)', () => {
  expect(deferredMark('- review 1.3: a lock (Must) → declined')).toEqual({ kind: 'declined' });
  expect(deferredMark('- review 1.2: a comma (Should) → ST-LN-101')).toEqual({ kind: 'queued', id: 'ST-LN-101' });
  // ASCII -> is not a mark, an id holds a digit, declined is the whole last word, and the arrow sits at the end
  expect(deferredMark('- a (Must) -> ST-1')).toBeUndefined();
  expect(deferredMark('- a (Must) → foo')).toBeUndefined();
  expect(deferredMark('- a (Must) → declined but more')).toBeUndefined();
  expect(deferredMark('- a (Must) → declinedx')).toBeUndefined();
  expect(deferredMark('- a (Must) →declined')).toBeUndefined();
  expect(deferredMark('- a (Must)')).toBeUndefined();
  expect(deferredMark('- a → ST-1 (Must)')).toBeUndefined();
  // trailing spaces and a CRLF read the same
  expect(deferredMark('- a (Must) → declined   ')).toEqual({ kind: 'declined' });
  expect(deferredMark('- a (Must) → ST-7\r')).toEqual({ kind: 'queued', id: 'ST-7' });
  // the last mark of a line counts
  expect(deferredMark('- a (Must) → ST-1 → declined')).toEqual({ kind: 'declined' });
  expect(deferredMark('- a (Must) → declined → ST-2')).toEqual({ kind: 'queued', id: 'ST-2' });
  // read before the 160-character short form: a 200-character item still reads its mark
  const long = '- ' + 'x'.repeat(200) + ' (Must) → declined';
  expect(deferredMark(long)).toEqual({ kind: 'declined' });
  expect(ownerDeferred('## Deferred\n' + long + '\n')).toEqual([]);
  // a CRLF ledger reads the same
  expect(ownerDeferred('## Deferred\r\n- a (Must) → declined\r\n- b (Must)\r\n')).toEqual([{ rating: 'Must', text: 'b (Must)' }]);
});

it('risk:regression ownerDeferred lists only unmarked Must and Should items (D-04)', () => {
  const ledger = [
    '## Deferred',
    '- review 1.1: marked must (Must) → declined',
    '- review 1.2: open must (Must)',
    '- review 1.3: queued should (Should) → T-9',
    '- review 1.4: open should (Should)',
    '- review 1.5: a nice thing (Nice)',
    '- review 1.6: note ending in an ASCII arrow (Must) -> ST-1',
    '',
  ].join('\n');
  expect(ownerDeferred(ledger)).toEqual([
    { rating: 'Must', text: 'review 1.2: open must (Must)' },
    { rating: 'Must', text: 'review 1.6: note ending in an ASCII arrow (Must) -> ST-1' },
    { rating: 'Should', text: 'review 1.4: open should (Should)' },
  ]);
  // every item marked: nothing is left to ask
  expect(ownerDeferred('## Deferred\n- a (Must) → declined\n- b (Should) → T-2\n')).toEqual([]);
});
