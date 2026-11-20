// Phase 8.1 G2 (D-01, D-03): a pull request body is the team's template with every heading kept and what the ticket knows filled in. Pure core: no file is read here.
import { expect, it } from 'vitest';
import { fillTemplate, templateSections } from '../src/index.js';
import type { PrFacts } from '../src/index.js';

const FACTS: PrFacts = {
  id: 'T-1',
  title: 'Export',
  intent: ['Owners can export their report as CSV.'],
  criteria: ['- `@ac-1` export writes a csv', '- `@ac-2` commas are escaped'],
  evidence: [],
};

const headings = (text: string): string[] => templateSections(text).map((s) => `${s.level} ${s.heading}`);

const TEMPLATE = [
  '# Pull request',
  '<!-- keep this heading -->',
  '',
  '## Description',
  '<!-- What does this change? -->',
  '',
  '## Acceptance criteria',
  '',
  '### Notes',
  'Mention the migration, if any.',
  '',
  '```text',
  '## fake heading inside a fence',
  '```',
  '',
  '## Screenshots',
  '<!-- add screenshots -->',
  '',
].join('\n');

it('risk:parsing a filled template keeps every heading line unchanged and in order (8.1-ac-1)', () => {
  const { body, remaining } = fillTemplate(TEMPLATE, FACTS);
  // a heading inside a fence is no heading, so the template reads as five and the body as the same five
  expect(headings(TEMPLATE)).toEqual(['1 Pull request', '2 Description', '2 Acceptance criteria', '3 Notes', '2 Screenshots']);
  expect(headings(body)).toEqual(headings(TEMPLATE));

  const lines = body.split('\n');
  const under = (heading: string): string[] => lines.slice(lines.indexOf(heading) + 1, lines.indexOf(heading) + 3);
  expect(under('## Description')).toContain('Owners can export their report as CSV.');
  expect(under('## Acceptance criteria').join('\n')).toContain('`@ac-1` export writes a csv');
  expect(body.startsWith('**T-1: Export**\n')).toBe(true);
  // every line of the template is still there, in order: the fill only inserts
  let at = -1;
  for (const l of TEMPLATE.split('\n')) {
    const next = lines.indexOf(l, at + 1);
    expect(next, `template line "${l}" is kept in order`).toBeGreaterThan(at);
    at = next;
  }
  // the section no slot fills is left for the agent; a heading that only holds sub-headings is no section to write
  expect(remaining).toEqual(['Screenshots']);
});
