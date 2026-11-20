// Phase 8 D-26 (8-ac-18, T-08-27): a file name or a config value is a key of the loader's maps, so `__proto__` and `constructor` must reach own keys only, never an object's prototype.
import { expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot } from '../src/index.js';
import { CONFIG, laneTicket, REPORT } from '../../../test/helpers/lane.js';

it('risk:security a ticket file named __proto__ loads as an own ticket and is linted (8-ac-18)', () => {
  const file = 'accord/tickets/__proto__.md';
  const snapshot = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [file]: laneTicket('__proto__', { body: 'No sections here.\n' }) }, tree: [file] });
  expect(Object.keys(snapshot.tickets)).toContain('__proto__');
  expect(Object.hasOwn(snapshot.tickets, '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(snapshot.tickets)).toBeNull();
  expect(Object.getOwnPropertyDescriptor(snapshot.tickets, '__proto__')?.value.frontmatter?.id).toBe('__proto__');
  // linted like any ticket: the same ticket under an ordinary id gives the same findings, by file name
  const ordinary = loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1', { body: 'No sections here.\n' }) }, tree: ['accord/tickets/T-1.md'] });
  const own = lintSnapshot(snapshot).findings.filter((f) => f.file === file);
  expect(own.length).toBeGreaterThan(0);
  expect(own.map((f) => f.rule).sort()).toEqual(lintSnapshot(ordinary).findings.filter((f) => f.file === 'accord/tickets/T-1.md').map((f) => f.rule).sort());
  // a verification record under that name is an own key too
  const withRecord = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [file]: laneTicket('__proto__'), 'accord/tickets/__proto__/verification.md': '---\nverdict: pass\n---\n' }, tree: [] });
  expect(Object.keys(withRecord.verifications)).toContain('__proto__');
  expect(Object.getPrototypeOf(withRecord.verifications)).toBeNull();
});

it('risk:security tests.report and design.tokens named constructor load without a crash and read as missing files (8-ac-18)', () => {
  const config = CONFIG.replace(`report: ${REPORT}`, 'report: constructor').replace('tokens: ""', 'tokens: constructor');
  expect(config).toContain('report: constructor');
  expect(config).toContain('tokens: constructor');
  const snapshot = loadSnapshot({ files: { 'accord/config.yml': config }, tree: [] });
  expect(Object.getPrototypeOf(snapshot.files)).toBeNull();
  expect(Object.hasOwn(snapshot.files, 'constructor')).toBe(false);
  expect(snapshot.tests).toBeUndefined();
  const reasons = lintSnapshot(snapshot).findings.map((f) => f.reason);
  expect(reasons).toContain('tests.report "constructor" is not in the snapshot');
  expect(reasons.some((r) => r.startsWith('design.tokens "constructor" is not in the snapshot'))).toBe(true);
});
