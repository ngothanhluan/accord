// ST-LN-22 D-09: `accord related <id>` prints the Vetoes and Decisions of the tickets related to <id>, for the scout at
// intent and the critic at approach. Real files in a tmp sandbox; nothing here reaches the real origin.
import { afterEach, expect, it } from 'vitest';
import { cleanup, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

const tk = (id: string, title: string, status: string, intent: string, extra: string[] = [], tail = ''): string =>
  ['---', `id: "${id}"`, `title: "${title}"`, 'type: story', `status: ${status}`, 'lane: M', 'ui: false', ...extra, '---', '', '## Intent', intent, tail].join('\n');

function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/N-1.md': tk('N-1', 'Export reports to CSV', 'open', 'Owners export csv files.', ['related:', '  - "R-1"']),
    'accord/tickets/R-1.md': tk('R-1', 'Zebra paint', 'archived', 'Stripes.', [], '\n## Vetoes\n- No new dependency.\n\n## Decisions\n- D-01 Use the existing writer\n'),
    'accord/tickets/R-2.md': tk('R-2', 'Reports as CSV export', 'open', 'Plain.', [], '\n## Vetoes\n<!-- none yet -->\n\n## Decisions\n- D-01 Quote every cell\n'),
    'accord/tickets/R-3.md': tk('R-3', 'Print the page', 'open', 'Printer.'),
  });
  return repo;
}

it('ac-5 accord related prints the block for a lane ticket (ST-LN-22 7-ac-5)', async () => {
  const repo = sandbox();
  const r = await run(['related', 'N-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(r.out).toBe(
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
      '',
      '## Rejected',
      '(none)',
      '',
    ].join('\n'),
  );
  // a ticket with nothing related prints the header and none
  const alone = await run(['related', 'R-3'], repo);
  expect(alone.code, alone.err).toBe(0);
  expect(alone.out).toBe('# Related tickets of R-3\n\n(none)\n\n## Rejected\n(none)\n');
});

it('ac-5 accord related refuses an id that is no ticket (ST-LN-22 7-ac-5)', async () => {
  const repo = sandbox();
  for (const bad of ['NOPE-9', '../x']) {
    const r = await run(['related', bad], repo);
    expect(r.code, bad).toBe(2);
    expect(r.out, bad).toBe('');
    expect(r.err, bad).toContain('no ticket');
  }
});

it('ac-6 accord related ends with the Rejected lines of conventions.md read from disk (ST-LN-84 7-ac-6)', async () => {
  const repo = sandbox();
  // no file: the section says none
  let r = await run(['related', 'N-1'], repo);
  expect(r.code, r.err).toBe(0);
  expect(r.out.endsWith('\n## Rejected\n(none)\n')).toBe(true);
  // a file with a byte order mark and CRLF: the two Rejected lines come as written, the rule line does not
  writeFiles(repo, {
    'accord/product/conventions.md': '﻿# Conventions\r\n\r\n- Never add a trailer.\r\n- Rejected: a queue table — too slow to read\r\n- Rejected: shared state — two branches race\r\n',
  });
  r = await run(['related', 'N-1'], repo);
  expect(r.code, r.err).toBe(0);
  expect(r.out.endsWith('\n## Rejected\n- Rejected: a queue table — too slow to read\n- Rejected: shared state — two branches race\n')).toBe(true);
  expect(r.out).not.toContain('Never add a trailer');
  expect(r.out.split('\n').filter((l) => l === '## Rejected')).toHaveLength(1);
  // a ticket with nothing related still carries the section
  const alone = await run(['related', 'R-3'], repo);
  expect(alone.out).toBe('# Related tickets of R-3\n\n(none)\n\n## Rejected\n- Rejected: a queue table — too slow to read\n- Rejected: shared state — two branches race\n');
});
