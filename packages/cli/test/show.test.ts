// ST-LN-6 task 2: `accord show <id> [--json]`, in-process through runCli on a fixture repository.
import { expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';
import { LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';

const LONG = 'Export every report of the month as one CSV file with quoted cells';
const STEP = 'And the file name is the report name followed by the month and the extension csv';
const ticket = (title: string): string =>
  laneTicket('T-1', { body: LANE_BODY.replace('    Then a csv file is written\n', '    Then a csv file is written\n    ' + STEP + '\n') }).replace(
    'title: "Export"',
    'title: "' + title + '"',
  );

it('ac-1 accord show prints the full detail as text', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket(LONG) });
  try {
    const { code, out } = await run(['show', 'T-1'], repo);
    expect(code).toBe(0);
    expect(out).toBe(
      [
        'T-1 ' + LONG,
        'Stage: intent',
        'Lane: M',
        'Tasks: 0/2',
        'Branch: t/T-1',
        'Holder: none',
        'Blocked by: none',
        '',
        'Intent:',
        'Owners can export their report as CSV.',
        '',
        'ac-1 export writes a csv',
        '  Given a report',
        '  When the owner exports it',
        '  Then a csv file is written',
        '  ' + STEP,
        '  State: passing',
        '  Test: export#writes-csv',
        '  Test result: passed',
        '  Ticked: no',
        '  Verification: none',
        '',
        'ac-2 commas are escaped',
        '  Given a cell with a comma',
        '  When the owner exports it',
        '  Then the cell is quoted',
        '  State: passing',
        '  Test: export#escapes-commas',
        '  Test result: passed',
        '  Ticked: no',
        '  Verification: none',
        '',
      ].join('\n'),
    );
    expect(out).not.toContain('...');
    expect(out).not.toContain('…');
  } finally {
    cleanup(repo);
  }
});

it('ac-2 accord show json gives the same detail as data', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket(LONG) });
  try {
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      id: 'T-1', title: LONG, stage: 'intent', lane: 'M', tasksDone: 0, tasksTotal: 2, branch: 't/T-1', holder: null, blockedBy: [],
      intent: ['Owners can export their report as CSV.'],
      criteria: [
        { id: 'ac-1', title: 'export writes a csv', steps: ['Given a report', 'When the owner exports it', 'Then a csv file is written', STEP],
          label: 'passing', test: 'export#writes-csv', testResult: 'passed', ticked: false, verification: null },
        { id: 'ac-2', title: 'commas are escaped', steps: ['Given a cell with a comma', 'When the owner exports it', 'Then the cell is quoted'],
          label: 'passing', test: 'export#escapes-commas', testResult: 'passed', ticked: false, verification: null },
      ],
    });
  } finally {
    cleanup(repo);
  }
});

it('risk:security show text turns control and bidi characters into spaces', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket('Bad\u001b[31m x\u202ey') });
  const noLane = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { lane: '' }) });
  try {
    expect((await run(['show', 'T-1'], repo)).out.split('\n')[0]).toBe('T-1 Bad [31m x y');
    expect(JSON.parse((await run(['show', 'T-1', '--json'], repo)).out).title).toBe('Bad\u001b[31m x\u202ey');
    const missing = await run(['show', 'NOPE'], repo);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('no ticket NOPE in accord/tickets/');
    expect((await run(['show', 'T-1'], noLane)).code).toBe(2);
  } finally {
    cleanup(repo);
    cleanup(noLane);
  }
});
