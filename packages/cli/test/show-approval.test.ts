// ST-LN-19 `accord show <id> --approval`: the compact approval view, in-process through runCli.
import { expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';

const GIVEN = 'Given a report of the month with three hundred rows';
const FOUR = [
  '## Intent',
  'Why: owners export reports by hand.',
  'For whom: every owner.',
  '',
  '## Acceptance criteria',
  '```gherkin',
  'Feature: Export',
  '',
  '  @ac-1 @test:export#case-1',
  '  Scenario: one',
  `    ${GIVEN}`,
  '    When the owner exports it as csv',
  '    Then the first file is written',
  '',
  '  @ac-2 @test:export#case-2',
  '  Scenario: two',
  `    ${GIVEN}`,
  '    When the owner exports it as csv',
  '    Then the second file is written',
  '    And it has a header',
  '',
  '  @ac-3 @test:export#case-3',
  '  Scenario: three',
  `    ${GIVEN}`,
  '    When the owner exports it as csv',
  '    Then the file is named `report.csv`',
  '',
  '  @ac-4 @test:export#case-4',
  '  Scenario: four',
  `    ${GIVEN}`,
  '    When the owner prints it',
  '    Then a page is printed',
  '```',
  '',
  '## Vetoes',
  '(none)',
  '',
  '## Decisions',
  '- D-01 first',
  '- D-02 second',
  '',
  '## Corrections',
  '- a correction',
  '',
  '## Open questions',
  '- [x] Delimiter? Comma.',
  '',
  '## Approach',
  'Chosen: a.',
  'Rejected: b.',
  '',
].join('\n');

it('ac-2 a step several scenarios repeat is printed once naming them', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body: FOUR }) });
  try {
    const { code, out } = await run(['show', 'T-1', '--approval'], repo);
    expect(code).toBe(0);
    const lines = out.split('\n');
    const from = lines.indexOf('## Acceptance criteria') + 2;
    const block = lines.slice(from, lines.indexOf('## Vetoes'));
    expect(block).toEqual([
      `- ${GIVEN} (ac-1, ac-2, ac-3, ac-4)`,
      '- When the owner exports it as csv (ac-1, ac-2, ac-3)',
      '',
      '**ac-1 one**',
      '- Then the first file is written',
      '',
      '**ac-2 two**',
      '- Then the second file is written',
      '- And it has a header',
      '',
      '**ac-3 three**',
      '- Then the file is named `report.csv`',
      '',
      '**ac-4 four**',
      '- When the owner prints it',
      '- Then a page is printed',
      '',
    ]);
    expect(out.split(GIVEN).length).toBe(2);
    expect(out).not.toContain('@test:');
  } finally {
    cleanup(repo);
  }
});
