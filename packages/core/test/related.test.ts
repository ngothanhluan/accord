// ST-LN-22 D-09: the Vetoes and Decisions of the tickets related to one ticket, built by the CLI for the scout at intent
// and the critic at approach. The ticket's own `related:` ids come first, then the tickets the similarity search finds for
// its title and Intent; never the ticket itself; at most five.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, relatedIds, relatedText } from '../src/index.js';
import { CONFIG } from '../../../test/helpers/lane.js';

/** A lane M ticket file: title, status, optional `related:` ids, then the given body. */
const tk = (id: string, title: string, status: string, body: string, related: string[] = []): string =>
  [
    '---',
    `id: "${id}"`,
    `title: "${title}"`,
    'type: story',
    `status: ${status}`,
    'lane: M',
    'ui: false',
    ...(related.length === 0 ? [] : ['related:', ...related.map((r) => `  - "${r}"`)]),
    '---',
    '',
    body,
  ].join('\n');

const intent = (text: string): string => `## Intent\n<!-- guidance -->\n${text}\n`;
const sections = (vetoes: string, decisions: string): string => `\n## Vetoes\n${vetoes}\n\n## Decisions\n${decisions}\n\n## Corrections\n- never read here\n`;
const tree = (files: Record<string, string>) => loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [] });

describe('relatedText', () => {
  it('risk:parsing related tickets bring their vetoes and decisions (ST-LN-22 7-ac-5)', () => {
    const snap = tree({
      'accord/tickets/N-1.md': tk('N-1', 'Export reports to CSV', 'open', intent('Owners export csv files.'), ['R-1']),
      // linked, with no word in common with N-1: listed first because it is written in `related:`
      'accord/tickets/R-1.md': tk('R-1', 'Zebra paint', 'archived', intent('Paint stripes.') + sections('- No new dependency.', '- D-01 Use the existing writer')),
      // found by the search: Vetoes holds only a comment, Decisions holds two lines
      'accord/tickets/R-2.md': tk('R-2', 'Reports as CSV export', 'open', intent('Plain.') + sections('<!-- none yet -->', '- D-01 Quote every cell\n- D-02 Comma delimiter')),
      // found by the search, with a section missing altogether
      'accord/tickets/R-3.md': tk('R-3', 'CSV', 'dropped', intent('Plain.')),
      // shares no word with N-1 and is not linked: never printed
      'accord/tickets/R-4.md': tk('R-4', 'Print the page', 'open', intent('Printer.') + sections('- Never print', '- D-01 Printer')),
    });
    expect(relatedText(snap, 'N-1')).toBe(
      [
        '# Related tickets of N-1',
        '',
        '## R-1 "Zebra paint" (archived)',
        '### Vetoes',
        '- No new dependency.',
        '### Decisions',
        '- D-01 Use the existing writer',
        '',
        '## R-2 "Reports as CSV export" (open)',
        '### Vetoes',
        '(none)',
        '### Decisions',
        '- D-01 Quote every cell',
        '- D-02 Comma delimiter',
        '',
        '## R-3 "CSV" (dropped)',
        '### Vetoes',
        '(none)',
        '### Decisions',
        '(none)',
        '',
        '## Rejected',
        '(none)',
        '',
      ].join('\n'),
    );
  });

  it('risk:complex-branching related tickets are the linked ones first then the search hits and at most five (ST-LN-22 7-ac-5)', () => {
    const files: Record<string, string> = {
      // N-1 links R-9 and R-8 in that order; R-1 to R-7 all share words with it, R-1 the most
      'accord/tickets/N-1.md': tk('N-1', 'Export reports to CSV', 'open', intent('Owners export csv files.'), ['R-9', 'R-8', 'N-1', 'GONE-1']),
      'accord/tickets/R-9.md': tk('R-9', 'Zebra', 'open', intent('x')),
      'accord/tickets/R-8.md': tk('R-8', 'Paint', 'open', intent('x')),
      'accord/tickets/R-1.md': tk('R-1', 'Export reports to CSV files', 'open', intent('x')),
      'accord/tickets/R-2.md': tk('R-2', 'Export reports', 'open', intent('x')),
      'accord/tickets/R-3.md': tk('R-3', 'Export csv', 'open', intent('x')),
      'accord/tickets/R-4.md': tk('R-4', 'Export', 'open', intent('x')),
      'accord/tickets/R-5.md': tk('R-5', 'Reports', 'open', intent('x')),
    };
    const snap = tree(files);
    // the ticket itself and an id that names no ticket are never listed; the cut is at five
    expect(relatedIds(snap, 'N-1')).toEqual(['R-9', 'R-8', 'R-1', 'R-2', 'R-3']);
    expect(relatedIds(snap, 'N-1', 2)).toEqual(['R-9', 'R-8']);
    expect(relatedIds(snap, 'N-1', 20)).toEqual(['R-9', 'R-8', 'R-1', 'R-2', 'R-3', 'R-4', 'R-5']);
    const text = relatedText(snap, 'N-1') as string;
    expect(text.split('\n').filter((l) => l.startsWith('## '))).toEqual([
      '## R-9 "Zebra" (open)',
      '## R-8 "Paint" (open)',
      '## R-1 "Export reports to CSV files" (open)',
      '## R-2 "Export reports" (open)',
      '## R-3 "Export csv" (open)',
      '## Rejected',
    ]);
    expect(text).not.toContain('"Export reports to CSV" (open)'); // N-1 itself
  });

  it('risk:regression a ticket with nothing related prints none and an unknown id prints nothing (ST-LN-22 7-ac-5)', () => {
    const snap = tree({ 'accord/tickets/N-1.md': tk('N-1', 'Zebra crossing paint', 'open', intent('Stripes.')), 'accord/tickets/R-1.md': tk('R-1', 'Print the page', 'open', intent('Printer.')) });
    expect(relatedText(snap, 'N-1')).toBe('# Related tickets of N-1\n\n(none)\n\n## Rejected\n(none)\n');
    expect(relatedText(snap, 'NOPE')).toBeUndefined();
    expect(relatedIds(snap, 'NOPE')).toEqual([]);
  });

  it('risk:complex-branching a related ticket that only the default branch holds is read from there (ST-LN-22 7-ac-5)', () => {
    const working = tree({
      'accord/tickets/N-1.md': tk('N-1', 'Export reports to CSV', 'open', intent('Owners export csv files.'), ['D-1']),
      'accord/tickets/W-1.md': tk('W-1', 'Export csv', 'open', intent('x') + sections('- Working veto', '- D-01 Working decision')),
    });
    const onDefault = tree({
      // the working tree's copy of W-1 wins
      'accord/tickets/W-1.md': tk('W-1', 'Export csv', 'open', intent('x') + sections('- Stale veto', '- D-01 Stale decision')),
      'accord/tickets/D-1.md': tk('D-1', 'Old export', 'archived', intent('x') + sections('- No locale compare', '- D-01 Code-point order')),
    });
    const text = relatedText({ ...working, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: onDefault } }, 'N-1') as string;
    expect(text).toContain('## D-1 "Old export" (archived)\n### Vetoes\n- No locale compare\n### Decisions\n- D-01 Code-point order');
    expect(text).toContain('## W-1 "Export csv" (open)\n### Vetoes\n- Working veto\n### Decisions\n- D-01 Working decision');
    expect(text).not.toContain('Stale');
    expect(text.indexOf('## D-1 ')).toBeLessThan(text.indexOf('## W-1 '));
  });

  it('risk:parsing the text ends with the Rejected lines of the conventions file as written (ST-LN-84 7-ac-6)', () => {
    const snap = tree({
      'accord/tickets/N-1.md': tk('N-1', 'Export reports to CSV', 'open', intent('Owners export csv files.')),
      'accord/tickets/R-2.md': tk('R-2', 'Export csv', 'open', intent('x') + sections('- A veto', '- D-01 A decision')),
    });
    const conventions = [
      '﻿# Conventions',
      '',
      '<!-- Record an option that was tried and refused as `Rejected: <option> — <reason>`.',
      'Rejected: inside a comment is not a line -->',
      '',
      '- Never add a trailer.',
      '- Rejected: a queue table — too slow to read',
      'Rejected: a bare line — also kept',
      '  - Rejected: an indented item — kept as written',
      '- Not Rejected: this one is not a Rejected line',
      '',
    ].join('\r\n');
    const text = relatedText(snap, 'N-1', conventions) as string;
    const tail = '## Rejected\n- Rejected: a queue table — too slow to read\nRejected: a bare line — also kept\n  - Rejected: an indented item — kept as written\n';
    expect(text.endsWith('\n' + tail)).toBe(true);
    expect(text).not.toContain('\r');
    expect(text.indexOf('## R-2 ')).toBeLessThan(text.indexOf('## Rejected'));
    // none: no file, an empty file, a file with no such line
    for (const none of [undefined, '', '# Conventions\n\n- Never add a trailer.\n']) {
      expect((relatedText(snap, 'N-1', none) as string).endsWith('\n## Rejected\n(none)\n')).toBe(true);
    }
    // a ticket with nothing related still ends with the section; an unknown id prints nothing
    const alone = tree({ 'accord/tickets/N-1.md': tk('N-1', 'Zebra crossing paint', 'open', intent('Stripes.')) });
    expect(relatedText(alone, 'N-1', '- Rejected: x — y\n')).toBe('# Related tickets of N-1\n\n(none)\n\n## Rejected\n- Rejected: x — y\n');
    expect(relatedText(alone, 'NOPE', '- Rejected: x — y\n')).toBeUndefined();
  });
});
