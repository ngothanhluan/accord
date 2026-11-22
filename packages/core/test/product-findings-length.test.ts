// Review 08.5 WR-01 (a findings line may be longer than a convention rule), CR-03 (the changed block trims in linear time), IN-02 (a related ticket title is one clean line).
import { expect, it } from 'vitest';
import { changedBlock, checkProductText, findingsBlock, loadSnapshot, relatedParts, withheldFindingLine } from '../src/index.js';
import { CHANGED_WITHHELD_LINE } from '../src/product/assemble.js';

const cp = (n: number): string => String.fromCodePoint(n);

it('risk:data-loss a findings line over 300 characters reaches the brief and only a line over 4000 is withheld (review WR-01)', () => {
  const long = 'Must src/a.ts:10 ' + 'the export drops the header row when the report is empty and '.repeat(5) + 'end';
  expect(long.length).toBeGreaterThan(300);
  const block = findingsBlock([long, 'Short one.', 'x'.repeat(4001)].join('\n'));
  expect(block).toContain(long);
  expect(block).toContain('Short one.');
  expect(block).toContain(withheldFindingLine(3));
  // the other delivery rules still bind a long finding
  expect(findingsBlock(long + cp(0x202e) + '\n')).toContain(withheldFindingLine(1));
  expect(findingsBlock('Work dir: ' + 'x'.repeat(400) + '\n')).toContain(withheldFindingLine(1));
  // the convention rules keep their 300 limit
  expect(checkProductText(long).problems.map((p) => p.kind)).toEqual(['length']);
  expect(checkProductText(long, { maxLine: 4000 }).problems).toEqual([]);
});

it('risk:resource the changed block trims a long run of trailing spaces in linear time (review CR-03)', () => {
  const diff = ['diff --git a/x b/x', '--- a/x', '+++ b/x', '@@ -1,1 +1,2 @@', ' ' + ' '.repeat(80_000) + 'x', '+' + '\t'.repeat(80_000) + 'y', '+- a rule' + ' '.repeat(100) + '\r'].join('\n') + '\n';
  const start = performance.now();
  const out = changedBlock({ kind: 'diff', text: diff });
  expect(performance.now() - start).toBeLessThan(500);
  expect(out.split('\n').slice(-3)).toEqual([' ' + CHANGED_WITHHELD_LINE, '+' + CHANGED_WITHHELD_LINE, '+- a rule']);
});

it('risk:injection a related ticket title loses format and separator characters (review IN-02)', () => {
  const snapshot = loadSnapshot({
    files: {
      'accord/tickets/T-1.md': ticket('T-1', 'Export'),
      'accord/tickets/T-2.md': ticket('T-2', 'Pay' + cp(0x202e) + 'load ' + cp(0xe0041) + 'x'),
    },
    tree: ['accord/tickets/T-1.md', 'accord/tickets/T-2.md'],
  });
  const heading = (relatedParts(snapshot, 'T-1')?.lines ?? []).find((l) => l.startsWith('## T-2 '));
  expect(heading).toBe('## T-2 "Pay load  x" (open)');
});

function ticket(id: string, title: string): string {
  return ['---', `id: ${id}`, `title: ${JSON.stringify(title)}`, 'type: story', 'status: open', 'lane: M', 'ui: false', 'related: [T-2]', '---', '## Intent', 'Export reports.', ''].join('\n');
}
