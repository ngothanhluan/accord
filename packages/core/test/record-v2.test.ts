// ST-LN-57 Task 2: finding lines, marks and Deferred lines of a version 2 record.
import { expect, it } from 'vitest';
import { parseRounds } from '../src/index.js';
import { parseLedger } from '../src/load/work.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const review = (text: string) => parseRounds(REVIEW, text, 'review');
const one = (line: string) => review('Round record: 2\n\n## Round 1 head abc1234\n\nNice 9: z — none — open\n' + line + '\n');

it('risk:parsing a version 2 finding line keeps dashes in its text and reads location state and marks from the end', () => {
  const r = review(
    [
      'Round record: 2',
      '',
      '## Round 1 head abc1234',
      '',
      'Must 1 [patch]: the writer — drops the header — src/a.ts:3 — open — test: export#writes-csv — risk: security',
      '- Should 2: a cell is wrong — `src/b c.ts`:9-12 — fixed in abc1234 — rests on: Veto "no new — dependency here"',
      '',
      '## Round 2 head abc1235',
      '',
      'Nice 1: rename w — none — deferred — carried from 1.1',
      '',
    ].join('\n'),
  );
  expect(r.unreadable).toEqual([]);
  const [a, b] = r.cycles[0].rounds[0].findings;
  expect(a).toMatchObject({ severity: 'Must', n: 1, file: 'src/a.ts', state: 'open', test: 'export#writes-csv', risk: 'security' });
  expect(b).toMatchObject({ severity: 'Should', n: 2, file: 'src/b c.ts', state: 'fixed', restsOn: { kind: 'Veto', ref: 'no new — dependency here' } });
  const c = r.cycles[0].rounds[1].findings[0];
  expect(c.file).toBeUndefined();
  expect(c).toMatchObject({ n: 1, state: 'deferred', carried: { round: 1, n: 1 } });

  const bad = [
    'Must 4: x — src/a.ts',
    'Must 4: x — src/a.ts — maybe',
    'Must 4: x — src/a.ts — open — risk: security — risk: data-loss',
    'Must 4: x — src/a.ts — open — rests on: Veto unquoted words',
    'Must 4: x — src/a.ts — open — carried from 1.1',
  ];
  for (const line of bad) {
    const d = one(line);
    expect(d.unreadable, line).toHaveLength(1);
    expect(d.unreadable[0].reason, line).toContain(line);
  }
  const noEarlier = one('Nice 1: y — none — open — carried from 1.1');
  expect(noEarlier.unreadable).toHaveLength(1);
  const twice = one('Must 1: x — src/a.ts — open\nNice 1: y — none — open');
  expect(twice.unreadable).toHaveLength(1);

  // Version 1 keeps the baseline reading: no new fields.
  const v1 = review('Round record: 1\n\n## Round 1\n\nMust 1: x — src/a.ts — open — risk: security\n');
  expect(v1.unreadable).toEqual([]);
  const f = v1.cycles[0].rounds[0].findings[0];
  expect(f.n).toBeUndefined();
  expect(f.risk).toBeUndefined();
  expect(f.state).toBeUndefined();
  const v1plain = review('Round record: 1\n\n## Round 1\n\nMust 4: x — src/a.ts\n');
  expect(v1plain.unreadable).toEqual([]);
});

it('risk:parsing a version 2 heading and a ledger deferred line are read or refused by their form', () => {
  const heads = (h: string) => review(`Round record: 2\n\n## ${h}\n\nNo findings\n`);
  const added = heads('Round 2 head ABC1234 (added code round 1)');
  expect(added.unreadable).toEqual([]);
  expect(added.cycles[0].rounds[0]).toMatchObject({ head: 'abc1234', added: true });
  const final = heads('Round 3 head abc1234def (final review)');
  expect(final.unreadable).toEqual([]);
  expect(final.cycles[0].rounds[0]).toMatchObject({ head: 'abc1234def', final: true });
  for (const h of ['Round 4', 'Round 4 head xyz', 'Round 4 head abc1234 (final review) (added code round 1)']) {
    expect(heads(h).unreadable.length, h).toBeGreaterThan(0);
  }

  const ledger = parseLedger('l.md', '## Deferred\n- review 3.1: x\n- review 2.4 cycle 2: y\n- review x.1: z\n');
  expect(ledger.deferred).toEqual([
    { round: 3, n: 1, cycle: 1 },
    { round: 2, n: 4, cycle: 2 },
  ]);
  expect('deferred' in parseLedger('l.md', '## Deferred\n- nothing yet\n')).toBe(false);
  expect('deferred' in parseLedger('l.md', '## Rulings\n- review 3.1: x\n')).toBe(false);
});
