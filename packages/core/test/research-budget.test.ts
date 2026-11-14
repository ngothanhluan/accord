// ST-LN-94 94-ac-4, D-11: the pure budget verdict of a lane R ticket. Strictly over the timebox or the token budget is a stop; at exactly
// either it is still within budget (plan 03-20 Ruling). A token figure that was not measured is printed as `not measured`, never a number.
import { expect, it } from 'vitest';
import { budgetVerdict, parseSpent, spentLine } from '../src/index.js';

const base = { id: 'R-1', elapsedMinutes: 240, timeboxMinutes: 240, timebox: '4 hours', tokens: undefined, budgetTokens: 800000, budget: '800k weighted tokens' };

it('risk:complex-branching the budget verdict stops once time or tokens pass the budget (ST-LN-94 94-ac-4)', () => {
  const at = budgetVerdict(base);
  expect(at.stop).toBe(false);
  expect(at.lines[0]).toBe('within budget');
  expect(at.lines).toContain('Tokens: not measured of 800k weighted tokens');
  const spent = 'Spent: 4h 0m of 4 hours; not measured of 800k weighted tokens';
  expect(at.lines).toContain(spent);
  expect(at.lines.some((l) => l.includes('Owner: write now'))).toBe(false);
  expect(parseSpent(spent)).toMatchObject({ minutes: 240, tokens: undefined });
  expect(spentLine({ elapsedMinutes: 240, timebox: '4 hours', tokens: undefined, budget: '800k weighted tokens' })).toBe(spent);

  const late = budgetVerdict({ ...base, elapsedMinutes: 241 });
  expect(late.stop).toBe(true);
  expect(late.lines[0]).toBe('stop: ask owner');
  expect(late.lines).toContain('Spent: 4h 1m of 4 hours; not measured of 800k weighted tokens');
  expect(late.lines.some((l) => l.includes('write the record from what the research has') && l.includes('## Timebox') && l.includes('## Token budget'))).toBe(true);
  expect(late.lines.some((l) => l.includes('Owner: write now — "') && l.includes('## Decisions') && l.includes('accord gate ready R-1'))).toBe(true);

  const spend = budgetVerdict({ ...base, elapsedMinutes: 10, tokens: 800001 });
  expect(spend.stop).toBe(true);
  expect(spend.lines[0]).toBe('stop: ask owner');
  const over = 'Spent: 0h 10m of 4 hours; 800001 of 800k weighted tokens';
  expect(spend.lines).toContain(over);
  expect(spend.lines).toContain('Tokens: 800001 of 800k weighted tokens');
  expect(parseSpent(over)).toMatchObject({ minutes: 10, tokens: 800001 });

  const full = budgetVerdict({ ...base, elapsedMinutes: 10, tokens: 800000 });
  expect(full.stop).toBe(false);
  expect(full.lines[0]).toBe('within budget');
  expect(full.lines.join('\n')).not.toContain('not measured');
});
