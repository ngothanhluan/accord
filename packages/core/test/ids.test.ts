import { expect, it } from 'vitest';
import { compilePattern, initialsHolder, lintSnapshot, loadSnapshot, nextTicketId, peopleOf, trackerKeyOk } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

it('risk:complex-branching the default branch decides who holds initials before any other ref', () => {
  const def = 'refs/remotes/origin/main';
  const other = 'refs/remotes/origin/t/x';
  expect(initialsHolder('AN', 'an@example.com', { [def]: { 'An@Example.com': 'AN' }, [other]: { 'bo@example.com': 'AN' } }, def)).toBeUndefined();
  expect(initialsHolder('AN', 'an@example.com', { [def]: { 'old@example.com': 'AN' }, [other]: { 'an@example.com': 'AN' } }, def)).toBe('old@example.com');
  expect(initialsHolder('AN', 'an@example.com', { [def]: { 'cy@example.com': 'CY' }, [other]: { 'bo@example.com': 'AN' } }, def)).toBe('bo@example.com');
  expect(initialsHolder('AN', 'an@example.com', { [other]: { 'bo@example.com': 'AN' } }, undefined)).toBe('bo@example.com');
  expect(initialsHolder('AN', 'an@example.com', { [other]: { 'an@example.com': 'AN' } }, undefined)).toBeUndefined();
  expect(initialsHolder('AN', 'an@example.com', {}, undefined)).toBeUndefined();
});

it('risk:parsing peopleOf reads only people and never throws', () => {
  expect(peopleOf('people: [\n  bad')).toBeUndefined();
  expect(peopleOf('profile: build\nunknown_key: 1\npeople: { "an@example.com": AN }\n')).toEqual({ 'an@example.com': 'AN' });
  expect(peopleOf('people: [AN]')).toBeUndefined();
  expect(peopleOf('people: { "an@example.com": true }')).toBeUndefined();
  expect(peopleOf('')).toBeUndefined();
});

it('risk:complex-branching a team id pattern is compiled and assigns the next number (ST-LN-50 t2-ac-1)', () => {
  const feat = compilePattern('FEAT-{n}', 'ST');
  for (const ok of ['FEAT-1', 'FEAT-120', 'FEAT-999999999']) expect(feat.regex.test(ok), ok).toBe(true);
  for (const bad of ['FEAT-0', 'FEAT-01', 'xFEAT-1', 'FEAT-1x', 'FEAT-', 'FEAT-1234567890', 'FEAT-1\n']) expect(feat.regex.test(bad), bad).toBe(false);
  expect(nextTicketId('story', undefined, ['FEAT-1', 'FEAT-12', 'OTHER-99'], { pattern: 'FEAT-{n}' })).toBe('FEAT-13');
  expect(nextTicketId('story', undefined, [], { pattern: 'FEAT-{n}' })).toBe('FEAT-1');
  // adjacency: FEAT-12 and FEAT-120 are different ids, and ST-LN-1 never counts as ST-LN-10
  expect(nextTicketId('story', undefined, ['FEAT-120'], { pattern: 'FEAT-{n}' })).toBe('FEAT-121');
  expect(nextTicketId('story', 'LN', ['ST-LN-1', 'ST-LN-10x', 'ST-LN-100-2'], undefined)).toBe('ST-LN-2');
  expect(nextTicketId('story', 'LN', ['ST-LN-9'], { pattern: '{type}-{initials}-{n}', types: { story: 'FEAT' } })).toBe('FEAT-LN-1');
  expect(nextTicketId('story', 'LN', ['FEAT-LN-4', 'FEAT-AN-9'], { pattern: '{type}-{initials}-{n}', types: { story: 'FEAT' } })).toBe('FEAT-LN-5');
  expect(nextTicketId('bug', undefined, ['BUG1', 'BUG7'], { pattern: '{type}{n}' })).toBe('BUG8');
  expect(nextTicketId('story', 'LN', ['ST-LN-3'])).toBe('ST-LN-4'); // no ids: today's
  expect(nextTicketId('epic', 'LN', ['EP-LN-3'], {})).toBe('EP-LN-4'); // ids without a pattern: today's
  // a regex special character in the pattern is a literal
  expect(compilePattern('A.B-{n}', 'ST').regex.test('AxB-1')).toBe(false);
  expect(compilePattern('A.B-{n}', 'ST').regex.test('A.B-1')).toBe(true);
  // a hostile id is answered in bounded time
  const hostile = 'FEAT-' + '1'.repeat(200_000);
  const started = Date.now();
  expect(feat.regex.test(hostile)).toBe(false);
  expect(compilePattern('{type}-{initials}-{n}', 'ST').regex.test('ST-' + 'A'.repeat(200_000) + '-1')).toBe(false);
  expect(nextTicketId('story', undefined, [hostile, 'FEAT-2'], { pattern: 'FEAT-{n}' })).toBe('FEAT-3');
  expect(Date.now() - started).toBeLessThan(2000);
});

const load = (files: Record<string, string>) => loadSnapshot({ files, tree: Object.keys(files).sort() });
const convention = (config: string, tickets: Record<string, string>) =>
  lintSnapshot(
    load({
      'accord/config.yml': config,
      ...Object.fromEntries(Object.entries(tickets).map(([id, text]) => ['accord/tickets/' + id + '.md', text])),
    }),
  ).findings.filter((f) => f.rule === 'lint.id-convention');
const asBug = (id: string) => laneTicket(id).replace('type: story', 'type: bug');

it('risk:complex-branching lint.id-convention reads the team pattern (ST-LN-50 t2-ac-1)', () => {
  const config = CONFIG + 'ids:\n  pattern: "FEAT-{n}"\nlegacy_ids: [SHOW-1]\n';
  const found = convention(config, { 'FEAT-3': laneTicket('FEAT-3'), 'ST-LN-3': laneTicket('ST-LN-3'), 'SHOW-1': laneTicket('SHOW-1') });
  expect(found.map((f) => f.file)).toEqual(['accord/tickets/ST-LN-3.md']);
  expect(found[0]?.reason).toContain('FEAT-{n}');
  expect(found[0]?.reason).toContain('legacy_ids');
  // with {type} in the pattern, a bug whose id carries the story prefix fails
  const typed = CONFIG + 'ids:\n  pattern: "{type}-{n}"\n  types: { story: FEAT, bug: DEFECT }\n';
  const both = convention(typed, { 'FEAT-1': laneTicket('FEAT-1'), 'DEFECT-1': asBug('DEFECT-1'), 'FEAT-2': asBug('FEAT-2') });
  expect(both.map((f) => f.file)).toEqual(['accord/tickets/FEAT-2.md']);
  // ids alone with no people turns the convention on with today's pattern
  const onlyIds = convention(CONFIG + 'ids:\n  types: { story: FEAT }\n', { 'FEAT-LN-1': laneTicket('FEAT-LN-1'), 'ST-LN-1': laneTicket('ST-LN-1') });
  expect(onlyIds.map((f) => f.file)).toEqual(['accord/tickets/ST-LN-1.md']);
  // neither ids nor people: no convention
  expect(convention(CONFIG, { 'FOO-1': laneTicket('FOO-1') })).toEqual([]);
});

it('risk:complex-branching a tracker key is checked for form and project (ST-LN-50 t2-ac-1)', () => {
  const tracker = { mode: 'tracker' as const };
  for (const ok of ['ENG-123', 'A-1', 'PROJ_2-9', 'ENG-999999999']) expect(trackerKeyOk(ok, tracker), ok).toBe(true);
  for (const bad of ['eng-123', 'ENG-0', 'ENG-', '123', 'ENG-1-2', 'ENG-01', '-1', 'ENG-1234567890', 'ENG_-', 'E NG-1', 'ENG-1\n', 'A'.repeat(21) + '-1']) expect(trackerKeyOk(bad, tracker), bad).toBe(false);
  expect(trackerKeyOk('OPS-4', { mode: 'tracker', projects: ['ENG'] })).toBe(false);
  expect(trackerKeyOk('ENG-4', { mode: 'tracker', projects: ['ENG', 'OPS'] })).toBe(true);
  expect(trackerKeyOk('ENG-4')).toBe(true); // no ids: the form alone
  const started = Date.now();
  expect(trackerKeyOk('A'.repeat(200_000) + '-1', tracker)).toBe(false);
  expect(Date.now() - started).toBeLessThan(2000);
  // lint in tracker mode checks the key form and the project list, and spares legacy_ids
  const config = CONFIG + 'ids:\n  mode: tracker\n  projects: [ENG]\nlegacy_ids: [SHOW-1]\n';
  const found = convention(config, {
    'ENG-123': laneTicket('ENG-123'),
    'ST-LN-1': laneTicket('ST-LN-1'),
    'OPS-4': asBug('OPS-4'),
    'SHOW-1': laneTicket('SHOW-1'),
  });
  expect(found.map((f) => f.file)).toEqual(['accord/tickets/OPS-4.md', 'accord/tickets/ST-LN-1.md']);
  expect(found[1]?.reason).toContain('tracker key');
  expect(found[1]?.reason).toContain('legacy_ids');
  // a tracker key has no type, so a bug may carry any project key of the list
  expect(convention(CONFIG + 'ids:\n  mode: tracker\n', { 'ENG-5': asBug('ENG-5') })).toEqual([]);
});
