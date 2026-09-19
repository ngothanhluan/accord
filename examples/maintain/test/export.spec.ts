import { expect, test } from 'vitest';
import { exportCsv } from '../src/export.js';

test('writes one row per report line', () => {
  const csv = exportCsv([
    { day: '2026-09-08', member: 'Mai', hours: 6.5 },
    { day: '2026-09-09', member: 'Tuan', hours: 4.25 },
  ]);
  expect(csv).toBe('day,member,hours\n2026-09-08,Mai,6.50\n2026-09-09,Tuan,4.25\n');
});

test('quotes a name holding a comma', () => {
  const csv = exportCsv([{ day: '2026-09-08', member: 'Nguyen, Mai', hours: 6.5 }]);
  expect(csv).toBe('day,member,hours\n2026-09-08,"Nguyen, Mai",6.50\n');
});
