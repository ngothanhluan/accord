// ST-LN-22 D-08: the pure judge behind the duplicate check of `accord new ticket`. Plain word overlap between a
// request and each ticket's title and Intent, English stop words removed, top five, ties in the dashboard's id order.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, requestWords, similarTickets, ticketFacts } from '../src/index.js';
import type { SimilarFact } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const fact = (id: string, title: string, status: string, ...text: string[]): SimilarFact => ({ id, title, status, text });

// seven tickets share one to three non-stop words with the request below, an eighth shares only stop words
const FACTS: SimilarFact[] = [
  fact('T-10', 'Export reports to CSV with commas', 'draft'),
  fact('T-2', 'Reports as CSV export', 'archived'),
  fact('T-4', 'Dropped CSV export of reports', 'dropped'),
  fact('T-7', 'Export csv', 'draft'),
  fact('T-6', 'Reports export', 'open'),
  fact('T-3', 'Export data', 'open'),
  fact('T-5', 'Weekly summary', 'open', 'Show the reports weekly'),
  fact('T-8', 'Print the page to PDF', 'open', 'To the printer'),
];

describe('requestWords', () => {
  it('risk:parsing lowercases, drops stop words and single characters, and keeps each word once (ST-LN-22 7-ac-5)', () => {
    expect(requestWords('The CSV, the csv!')).toEqual(new Set(['csv']));
    expect(requestWords('A b Export-to_csv 2nd')).toEqual(new Set(['export', 'csv', '2nd']));
    expect(requestWords('Ticket accord should when')).toEqual(new Set());
  });
});

describe('similarTickets', () => {
  it('risk:complex-branching the similarity judge ranks by shared words with stop words removed (ST-LN-22 7-ac-5)', () => {
    const found = similarTickets('Export reports to CSV', FACTS);
    expect(found).toHaveLength(5);
    // three shared: T-2 before T-4 before T-10 (digit runs by value, as the dashboard orders ids); then two shared: T-6, T-7
    expect(found.map((t) => t.id)).toEqual(['T-2', 'T-4', 'T-10', 'T-6', 'T-7']);
    expect(found.map((t) => t.shared)).toEqual([3, 3, 3, 2, 2]);
    // closed tickets are candidates when they score
    expect(found.find((t) => t.id === 'T-2')?.status).toBe('archived');
    expect(found.find((t) => t.id === 'T-4')?.status).toBe('dropped');
    // a ticket sharing only stop words is not returned, with any limit
    expect(similarTickets('Export reports to CSV', FACTS, 20).map((t) => t.id)).not.toContain('T-8');
    expect(similarTickets('Export reports to CSV', FACTS, 20).map((t) => t.id)).toEqual(['T-2', 'T-4', 'T-10', 'T-6', 'T-7', 'T-3', 'T-5']);
  });

  it('risk:regression the same request over the same tickets returns equal results in any input order (ST-LN-22 7-ac-5)', () => {
    const a = similarTickets('Export reports to CSV', FACTS);
    expect(similarTickets('Export reports to CSV', FACTS)).toEqual(a);
    expect(similarTickets('Export reports to CSV', [...FACTS].reverse())).toEqual(a);
  });

  it('risk:regression the text of a ticket counts as well as its title (ST-LN-22 7-ac-5)', () => {
    expect(similarTickets('weekly', FACTS).map((t) => t.id)).toEqual(['T-5']);
    expect(similarTickets('printer', FACTS).map((t) => t.id)).toEqual(['T-8']);
    expect(similarTickets('nothing alike here', FACTS)).toEqual([]);
  });
});

describe('ticketFacts', () => {
  const S_BODY = '## Understood\n<!-- guidance -->\nThe export button writes a csv file.\n';
  const R_BODY = '## Question\nWhich csv library is smallest?\n';
  const M_BODY = '## Intent\n<!-- guidance -->\nOwners can export their report.\n\n## Acceptance criteria\nNever compared.\n';
  const tree = (files: Record<string, string>) => loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [] });

  it('risk:parsing reads Intent, else Understood, else Question, with comments stripped, and the default branch too (ST-LN-22 7-ac-5)', () => {
    const working = tree({
      'accord/tickets/W-1.md': laneTicket('W-1', { body: M_BODY }),
      'accord/tickets/W-2.md': laneTicket('W-2', { lane: 'S', body: S_BODY }),
      'accord/tickets/W-3.md': laneTicket('W-3', { lane: '', body: R_BODY }),
    });
    const onDefault = tree({
      // the working tree's copy of W-1 wins; D-1 exists only on the default branch and is archived
      'accord/tickets/W-1.md': laneTicket('W-1', { body: '## Intent\nStale copy about invoices.\n' }),
      'accord/tickets/D-1.md': laneTicket('D-1', { frontmatter: ['status: archived'], body: '## Intent\nInvoices as PDF.\n' }),
    });
    const facts = ticketFacts({ ...working, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: onDefault } });
    expect(facts.map((f) => f.id)).toEqual(['D-1', 'W-1', 'W-2', 'W-3']);
    const text = (id: string) => facts.find((f) => f.id === id)?.text.join('\n');
    expect(text('W-1')).toContain('Owners can export their report.');
    expect(text('W-1')).not.toContain('invoices');
    expect(text('W-1')).not.toContain('Never compared');
    expect(text('W-1')).not.toContain('guidance');
    expect(text('W-2')).toContain('The export button writes a csv file.');
    expect(text('W-2')).not.toContain('guidance');
    expect(text('W-3')).toContain('Which csv library is smallest?');
    expect(facts.find((f) => f.id === 'D-1')).toMatchObject({ title: 'Export', status: 'archived' });
  });
});
