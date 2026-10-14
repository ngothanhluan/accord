import { expect, it } from 'vitest';
import { ticketOfBranch } from '../src/load/fs.js';

it('risk:parsing ticketOfBranch matches a whole branch name against each template', () => {
  const none = () => false;
  const both = ['t/{id}', 'feature/{id}'];
  expect(ticketOfBranch('feature/ST-1', both, none)).toBe('ST-1');
  expect(ticketOfBranch('t/ST-1', both, none)).toBe('ST-1');
  for (const n of ['feature/ST-1/x', 'feature/', 'xfeature/ST-1', 'main']) expect(ticketOfBranch(n, both, none)).toBeUndefined();
  expect(ticketOfBranch('t/x-ST-1', ['t/{id}', 't/x-{id}'], none)).toBe('x-ST-1');
  const overlap = ['t/{id}', 'a-{id}', 'a-b-{id}'];
  expect(ticketOfBranch('a-b-ST-1', overlap, (id) => id === 'ST-1')).toBe('ST-1');
  expect(ticketOfBranch('a-b-ST-1', overlap, none)).toBe('b-ST-1');
  expect(ticketOfBranch('main', ['main'], none)).toBeUndefined();
  expect(ticketOfBranch('a-b', ['{id}-{id}'], none)).toBeUndefined();
});
