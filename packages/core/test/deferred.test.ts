// ST-LN-12 7-ac-7 (D-12): the ledger's deferred items the owner is asked about at verify, Must then Should, Nice never.
import { expect, it } from 'vitest';
import { deferredMark, ownerDeferred, ratingOf } from '../src/index.js';

// Phase 08.8 D-07: a mark counts only when its id is a known ticket; these are the ids the cases below treat as tickets.
const knows = (...ids: string[]) => (id: string): boolean => ids.includes(id);
const KNOWN = knows('ST-LN-101', 'ST-7', 'ST-2', 'ST-1', 'BUG-LN-9', 'PROJ-123', 'T-9', 'T-2');

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
  expect(ownerDeferred(LEDGER, KNOWN)).toEqual([
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
  const [cut] = ownerDeferred('## Deferred\n- ' + long + '\n', KNOWN);
  expect(cut.text.length).toBe(160);
  expect(cut.text.endsWith('…')).toBe(true);
  expect(cut.text).toBe('x'.repeat(159) + '…');
  const exact = 'y'.repeat(150) + ' (Should)';
  expect(exact.length).toBeLessThanOrEqual(160);
  expect(ownerDeferred('## Deferred\n- ' + exact + '\n', KNOWN)[0].text).toBe(exact);

  // no text, no section, an empty section, and a section of Nice items only give nothing
  expect(ownerDeferred('', KNOWN)).toEqual([]);
  expect(ownerDeferred('## Rulings\n- Ruling: a — b — c\n', KNOWN)).toEqual([]);
  expect(ownerDeferred('## Deferred\n', KNOWN)).toEqual([]);
  expect(ownerDeferred('## Deferred\n- a (Nice)\n- b (Nice)\n', KNOWN)).toEqual([]);

  // every `## Deferred` section is read in order; a comment and a fenced block are not items; CRLF and a BOM change nothing
  const many = ['\u{FEFF}## Deferred', '<!-- - hidden (Must) -->', '- first (Should)', '```', '- fenced (Must)', '```', '', '## Notes', '- not deferred (Must)', '', '## Deferred', '* second (Must)', ''].join('\r\n');
  expect(ownerDeferred(many, KNOWN)).toEqual([
    { rating: 'Must', text: 'second (Must)' },
    { rating: 'Should', text: 'first (Should)' },
  ]);

  // the heading is matched as the ledger parser matches it: case and spacing do not matter; a line that is no list item is skipped
  expect(ownerDeferred('##  deferred\nplain prose (Must)\n- kept (Must)\n', KNOWN)).toEqual([{ rating: 'Must', text: 'kept (Must)' }]);
});

// Phase 8.2 D-04: the owner's answer on a deferred item is a mark at the end of its ledger line, read on the full line before the short form.
it('risk:parsing a deferred mark is the arrow and an id or declined at the end of the full line (8.2-ac-5)', () => {
  expect(deferredMark('- review 1.3: a lock (Must) → declined', KNOWN)).toEqual({ kind: 'declined' });
  expect(deferredMark('- review 1.2: a comma (Should) → ST-LN-101', KNOWN)).toEqual({ kind: 'queued', id: 'ST-LN-101' });
  // ASCII -> is not a mark, an id must name a known ticket (Phase 08.8 D-07), declined is the whole last word, and the arrow sits at the end
  expect(deferredMark('- a (Must) -> ST-1', KNOWN)).toBeUndefined();
  expect(deferredMark('- a (Must) → foo', KNOWN)).toBeUndefined();
  expect(deferredMark('- a (Must) → declined but more', KNOWN)).toBeUndefined();
  expect(deferredMark('- a (Must) → declinedx', KNOWN)).toBeUndefined();
  expect(deferredMark('- a (Must) →declined', KNOWN)).toBeUndefined();
  expect(deferredMark('- a (Must)', KNOWN)).toBeUndefined();
  expect(deferredMark('- a → ST-1 (Must)', KNOWN)).toBeUndefined();
  // trailing spaces and a CRLF read the same
  expect(deferredMark('- a (Must) → declined   ', KNOWN)).toEqual({ kind: 'declined' });
  expect(deferredMark('- a (Must) → ST-7\r', KNOWN)).toEqual({ kind: 'queued', id: 'ST-7' });
  // the last mark of a line counts
  expect(deferredMark('- a (Must) → ST-1 → declined', KNOWN)).toEqual({ kind: 'declined' });
  expect(deferredMark('- a (Must) → declined → ST-2', KNOWN)).toEqual({ kind: 'queued', id: 'ST-2' });
  // read before the 160-character short form: a 200-character item still reads its mark
  const long = '- ' + 'x'.repeat(200) + ' (Must) → declined';
  expect(deferredMark(long, KNOWN)).toEqual({ kind: 'declined' });
  expect(ownerDeferred('## Deferred\n' + long + '\n', KNOWN)).toEqual([]);
  // a CRLF ledger reads the same
  expect(ownerDeferred('## Deferred\r\n- a (Must) → declined\r\n- b (Must)\r\n', KNOWN)).toEqual([{ rating: 'Must', text: 'b (Must)' }]);
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
  expect(ownerDeferred(ledger, KNOWN)).toEqual([
    { rating: 'Must', text: 'review 1.2: open must (Must)' },
    { rating: 'Must', text: 'review 1.6: note ending in an ASCII arrow (Must) -> ST-1' },
    { rating: 'Should', text: 'review 1.4: open should (Should)' },
  ]);
  // every item marked: nothing is left to ask
  expect(ownerDeferred('## Deferred\n- a (Must) → declined\n- b (Should) → T-2\n', KNOWN)).toEqual([]);
});

// Review WR-01: a prose arrow at the end of a line is not the owner's mark unless it names `declined` or a ticket id shape.
it('risk:regression a deferred line ending in a version arrow stays listed and is no mark (8.2-ac-5)', () => {
  expect(deferredMark('- review 2.3: the migration must run in order, 0.9 → 0.10', KNOWN)).toBeUndefined();
  expect(deferredMark('- (Must) rename the flag v1 → v2', KNOWN)).toBeUndefined();
  expect(deferredMark('- keep the old name → x2', KNOWN)).toBeUndefined();
  expect(deferredMark('- a (Must) → 42', KNOWN)).toBeUndefined();
  // real id shapes still read: the default pattern, a tracker key and a short team prefix
  expect(deferredMark('- a (Must) → BUG-LN-9', KNOWN)).toEqual({ kind: 'queued', id: 'BUG-LN-9' });
  expect(deferredMark('- a (Must) → PROJ-123', KNOWN)).toEqual({ kind: 'queued', id: 'PROJ-123' });
  expect(deferredMark('- a (Must) → T-9', KNOWN)).toEqual({ kind: 'queued', id: 'T-9' });
  // the unrated and the Must items with an arrow in their prose are still shown to the owner
  const ledger = ['## Deferred', '- review 2.3: the migration must run in order, 0.9 → 0.10', '- (Must) rename the flag v1 → v2', ''].join('\n');
  expect(ownerDeferred(ledger, KNOWN)).toEqual([
    { rating: 'Must', text: '(Must) rename the flag v1 → v2' },
    { rating: 'Should', text: 'review 2.3: the migration must run in order, 0.9 → 0.10' },
  ]);
});

// Phase 08.8 D-07, 08.9.1 D-03: a mark counts for an id that names a known ticket; a bare number only as `#<n>`; a prose arrow that names no ticket stays listed, and ASCII -> is still never read.
it('risk:parsing a deferred mark counts for a known ticket id, a bare number only as #<n> (D-07, 08.9.1 D-03)', () => {
  const known = knows('42', 'ST-LN-9', 'web.login_7');
  expect(deferredMark('- (Must) x → #42', known)).toEqual({ kind: 'queued', id: '42' });
  expect(deferredMark('- (Must) x → 42', known)).toBeUndefined();
  expect(deferredMark('- (Must) x → ST-LN-9', known)).toEqual({ kind: 'queued', id: 'ST-LN-9' });
  expect(deferredMark('- (Must) x → web.login_7', known)).toEqual({ kind: 'queued', id: 'web.login_7' });
  // prose arrows and an unknown id are no mark: 0.10 and v2 name no ticket here, and 43 is not a ticket
  expect(deferredMark('- (Must) moved 0.9 → 0.10', known)).toBeUndefined();
  expect(deferredMark('- (Must) from v1 → v2', known)).toBeUndefined();
  expect(deferredMark('- (Must) x → 43', known)).toBeUndefined();
  // declined is a mark whatever is known, and ASCII -> is never read, even for a known id
  expect(deferredMark('- (Must) x → declined', knows())).toEqual({ kind: 'declined' });
  expect(deferredMark('- (Must) x -> 42', known)).toBeUndefined();
  expect(deferredMark('- (Must) x -> #42', known)).toBeUndefined();
  // the lister hides only the item marked to a known ticket
  const ledger = ['## Deferred', '- (Must) hidden → #42', '- (Must) moved 0.9 → 0.10', ''].join('\n');
  expect(ownerDeferred(ledger, known)).toEqual([{ rating: 'Must', text: '(Must) moved 0.9 → 0.10' }]);
});
