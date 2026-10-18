// ST-LN-19 `accord show <id> --approval`: the compact approval view, in-process through runCli.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadSnapshot } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { cleanup, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

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

interface Rebuilt { acTag: string; name: string; steps: string[]; shared: number }

// Reads the criteria part back into scenarios: the shared lines first, then each bold line with its own steps.
function rebuild(out: string): Rebuilt[] {
  const lines = out.split('\n');
  const from = lines.indexOf('## Acceptance criteria') + 1;
  let to = lines.findIndex((l, i) => i > from && l.startsWith('## '));
  if (to < 0) to = lines.length;
  const shared: { step: string; ids: string[] }[] = [];
  const res: { acTag: string; name: string; own: string[] }[] = [];
  for (const l of lines.slice(from, to)) {
    const head = /^\*\*(ac-\d+) (.*)\*\*$/.exec(l);
    if (head) res.push({ acTag: head[1], name: head[2], own: [] });
    else if (l.startsWith('- ') && res.length === 0) {
      const m = /^- (.*) \((ac-\d+(?:, ac-\d+)*)\)$/.exec(l);
      if (m) shared.push({ step: m[1], ids: m[2].split(', ') });
    } else if (l.startsWith('- ') && res.length > 0) res[res.length - 1].own.push(l.slice(2));
  }
  return res.map((r) => {
    const mine = shared.filter((x) => x.ids.includes(r.acTag)).map((x) => x.step);
    return { acTag: r.acTag, name: r.name, steps: [...mine, ...r.own], shared: mine.length };
  });
}

it('ac-1 every scenario of every real ticket is rebuilt exactly from the approval view', async () => {
  const dir = fileURLToPath(new URL('../../../accord/tickets/', import.meta.url));
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  for (const f of readdirSync(dir)) if (f.endsWith('.md')) files[`accord/tickets/${f}`] = readFileSync(dir + f, 'utf8');
  const snap = loadSnapshot({ files, tree: [] });
  const ids = Object.keys(snap.tickets).filter((id) =>
    snap.tickets[id].sections.some((x) => x.heading.toLowerCase().includes('acceptance criteria') && x.lines.some((l) => l.text.startsWith('```gherkin'))),
  );
  expect(ids.length).toBeGreaterThanOrEqual(10);
  const repo = makeEmptyRepo();
  const bad: string[] = [];
  try {
    writeFiles(repo, files);
    for (const id of ids) {
      const { code, out, err } = await run(['show', id, '--approval'], repo);
      if (code !== 0) {
        bad.push(`${id} exit ${code} ${err.trim().split('\n')[0]}`);
        continue;
      }
      const want = snap.tickets[id].scenarios.map((s) => ({ acTag: s.acTag, name: s.name, steps: s.steps }));
      const got = rebuild(out);
      if (JSON.stringify(got.map(({ acTag, name, steps }) => ({ acTag, name, steps }))) !== JSON.stringify(want)) bad.push(`${id} rebuild differs`);
      snap.tickets[id].scenarios.forEach((s, i) => {
        const then = s.steps.findIndex((t) => t.startsWith('Then '));
        if (got[i] !== undefined && got[i].shared > (then < 0 ? s.steps.length : then)) bad.push(`${id} ${s.acTag} shares past its first Then`);
      });
    }
  } finally {
    cleanup(repo);
  }
  expect(bad).toEqual([]);
}, 300_000);

async function viewOf(fence: string[]): Promise<string[]> {
  const body = ['## Acceptance criteria', '```gherkin', ...fence, '```', ''].join('\n');
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body }) });
  try {
    const { code, out } = await run(['show', 'T-1', '--approval'], repo);
    expect(code).toBe(0);
    const lines = out.split('\n');
    return lines.slice(lines.indexOf('## Acceptance criteria') + 2, lines.indexOf('## Vetoes'));
  } finally {
    cleanup(repo);
  }
}

it('risk:parsing approval shares only steps before the first then in a language vi fence', async () => {
  const sc = (n: number, then: string): string[] => [
    '', `  @ac-${n}`, '  Tình huống: t' + n, '    Cho một báo cáo', '    Khi chủ xuất nó', '    Và chọn csv', `    Thì ${then}`, '    Và tệp được lưu',
  ];
  const block = await viewOf(['# language: vi', 'Tính năng: X', ...sc(1, 'a'), ...sc(2, 'b')]);
  expect(block).toEqual([
    '- Cho một báo cáo (ac-1, ac-2)',
    '- Khi chủ xuất nó (ac-1, ac-2)',
    '- Và chọn csv (ac-1, ac-2)',
    '',
    '**ac-1 t1**',
    '- Thì a',
    '- Và tệp được lưu',
    '',
    '**ac-2 t2**',
    '- Thì b',
    '- Và tệp được lưu',
    '',
  ]);
});

it('risk:parsing approval gives a star step the phase of the step before it', async () => {
  const sc = (n: number, then: string): string[] => [
    '', `  @ac-${n}`, '  Scenario: s' + n, '    * a report', '    When the owner exports it', '    * the owner confirms', `    Then ${then}`, '    * the file is kept',
  ];
  const block = await viewOf(['Feature: X', ...sc(1, 'a'), ...sc(2, 'b')]);
  expect(block).toEqual([
    '- * a report (ac-1, ac-2)',
    '- When the owner exports it (ac-1, ac-2)',
    '- * the owner confirms (ac-1, ac-2)',
    '',
    '**ac-1 s1**',
    '- Then a',
    '- * the file is kept',
    '',
    '**ac-2 s2**',
    '- Then b',
    '- * the file is kept',
    '',
  ]);
});
