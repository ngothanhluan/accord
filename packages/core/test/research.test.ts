// ST-LN-13: a ticket's `research:` key reaches the snapshot, lint refuses a missing or undated record.
import { expect, it } from 'vitest';
import {
  gateReady,
  isResearchPath,
  isResearchRecord,
  lintSnapshot,
  loadSnapshot,
  recordHeaderFaults,
  validate,
} from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const REC = (topic: string) => '# ' + topic + '\n\nDate: 2026-10-30. Repository at `5c083d3`. Feeds the ticket.\n';
const R = 'accord/research/2026-10-30-x.md';
const BOM = String.fromCharCode(0xfeff);

const build = (frontmatter: string[], extra: Record<string, string>) => {
  const files = approved(
    {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter }),
      ...extra,
    },
    'T-1',
  );
  return loadSnapshot({ files, tree: Object.keys(files).sort() });
};
const refFindings = (s: ReturnType<typeof build>) =>
  lintSnapshot(s).findings.filter((f) => f.rule === 'lint.research-reference');

it('ac-1 lint refuses a ticket whose research reference is not a dated record', () => {
  const cases: [string, Record<string, string>][] = [
    ['accord/research/2026-10-30-none.md', {}],
    [R, { [R]: '# X\n\nRepository at `5c083d3`.\n' }],
    [R, { [R]: '# X\n\nDate: 2026-10-30.\n' }],
    ['docs/notes.md', { 'docs/notes.md': REC('X') }],
  ];
  for (const [reference, extra] of cases) {
    const s = build(['research: ["' + reference + '"]'], extra);
    const found = refFindings(s);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      level: 'error',
      file: 'accord/tickets/T-1.md',
      pointer: '/research/0',
    });
    expect(found[0].reason).toContain(reference);
    const ready = gateReady(s, 'T-1');
    expect(ready.verdict).toBe('fail');
    expect(ready.findings.some((f) => f.rule === 'lint.research-reference')).toBe(true);
  }
  const ok = build(['research: ["' + R + '"]'], { [R]: REC('X') });
  expect(refFindings(ok)).toEqual([]);
  expect(gateReady(ok, 'T-1').verdict).toBe('pass');
});

it('risk:parsing a record header counts in its first five lines after a bom and crlf with the sha bare or in backticks', () => {
  const crlf = BOM + '# T\r\n\r\nDate: 2026-10-30. Repository at `5c083d3`. Feeds T-1.\r\n';
  expect(recordHeaderFaults(crlf)).toEqual([]);
  expect(recordHeaderFaults('# T\n\nDate: 2026-10-30\nRepository at ' + 'a'.repeat(40) + '\n')).toEqual([]);
  expect(recordHeaderFaults('Date: 2026-10-30\nRepository at ' + 'a'.repeat(41) + '\n')).toEqual(['commit']);
  expect(recordHeaderFaults('Date: 2026-10-30\nRepository at 123456\n')).toEqual(['commit']);
  expect(recordHeaderFaults('Date: 2026-1-30\nRepository at 5c083d3\n')).toEqual(['date']);
  expect(recordHeaderFaults('1\n2\n3\n4\n5\nDate: 2026-10-30. Repository at 5c083d3\n')).toEqual(['date', 'commit']);
  expect(recordHeaderFaults('')).toEqual(['date', 'commit']);

  const s = build(['research: ["' + R + '"]'], { [R]: crlf });
  expect(refFindings(s)).toEqual([]);
  expect(s.files[R]).toBe(crlf.slice(1).replace(/\r\n/g, '\n'));
});

it('risk:parsing a research entry with a backslash a dot segment or a leading slash is outside the research folder only an md entry is a record and only listed records are loaded', () => {
  for (const bad of [
    'accord\\research\\a.md',
    'accord/research/../tickets/T-1.md',
    'accord/research/./a.md',
    '/accord/research/a.md',
    './accord/research/a.md',
    'accord/research/',
    'accord/research//a.md',
    'accord/researcher/a.md',
    'docs/a.md',
  ]) {
    expect(isResearchPath(bad), bad).toBe(false);
  }
  expect(isResearchPath('accord/research/2026-10-30-a.md')).toBe(true);
  expect(isResearchPath('accord/research/sub/a.md')).toBe(true);

  expect(isResearchRecord('accord/research/2026-10-30-a.md')).toBe(true);
  expect(isResearchRecord('accord/research/sub/a.md')).toBe(true);
  for (const notRecord of [
    'accord/research/2026-10-30-x.test.ts',
    'accord/research/2026-10-25-x.findings.jsonl',
    'accord/research/a.MD',
    'accord/research/a.md.ts',
    'accord/research/../a.md',
    'docs/a.md',
  ]) {
    expect(isResearchRecord(notRecord), notRecord).toBe(false);
  }
  expect(isResearchPath('accord/research/2026-10-30-x.test.ts')).toBe(true);

  const bad = build(
    ["research: ['accord\\research\\a.md', 'accord/research/../tickets/T-1.md', '/accord/research/a.md']"],
    { 'accord/research/a.md': REC('A') },
  );
  const found = refFindings(bad);
  // lint orders findings by file, rule and reason, so compare the pointers sorted.
  expect(found.map((f) => f.pointer).sort()).toEqual(['/research/0', '/research/1', '/research/2']);
  for (const f of found) expect(f.reason.endsWith('which is not a path under accord/research/')).toBe(true);

  const base = { id: 'T-1', title: 'x', type: 'story', status: 'draft' };
  const at = (research: unknown) => validate('ticket', { ...base, research });
  expect(at(['a', 'a'])).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'schema.uniqueItems', pointer: '/research' })]));
  expect(at('a')).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'schema.type', pointer: '/research' })]));
  expect(at([1])).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'schema.type', pointer: '/research/0' })]));
  expect(at([])).toEqual([]);
  expect(at(['docs/a.md'])).toEqual([]);

  const unlisted = build([], {
    'accord/research/2026-10-25-x.findings.jsonl': '{}\n',
    'accord/research/2026-10-29-y.md': REC('Y'),
  });
  expect(Object.keys(unlisted.files).filter((k) => k.startsWith('accord/research/'))).toEqual([]);
  expect(refFindings(unlisted)).toEqual([]);
});
