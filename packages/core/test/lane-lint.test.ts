// Spec §4 lane headings and §5 dependencies.
import { describe, expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot } from '../src/index.js';
import { CONFIG, LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';

const load = (files: Record<string, string>) => loadSnapshot({ files, tree: Object.keys(files).sort() });
const rules = (files: Record<string, string>, rule: string) =>
  lintSnapshot(load(files)).findings.filter((f) => f.rule === rule);
const repo = (tickets: Record<string, string>) => ({
  'accord/config.yml': CONFIG,
  ...Object.fromEntries(Object.entries(tickets).map(([id, text]) => ['accord/tickets/' + id + '.md', text])),
});

describe('lane ticket headings (spec §4)', () => {
  it('a lane story needs the lane headings and neither Requirements nor Plan', () => {
    expect(rules(repo({ 'T-1': laneTicket('T-1') }), 'lint.heading-missing')).toEqual([]);
  });

  it('names each missing lane heading', () => {
    const body = LANE_BODY.replace('## Vetoes\n- No new dependency.\n\n', '').replace(/## Approach\n.*\n/, '');
    expect(rules(repo({ 'T-1': laneTicket('T-1', { body }) }), 'lint.heading-missing').map((f) => f.reason)).toEqual([
      'missing "## Approach"',
      'missing "## Vetoes"',
    ]);
  });

  it('a ticket without lane keeps the 0.1.0 headings', () => {
    expect(
      rules(repo({ 'T-1': laneTicket('T-1', { lane: '' }) }), 'lint.heading-missing').map((f) => f.reason),
    ).toEqual(['missing "## Plan"', 'missing "## Requirements"']);
  });

  it('a duplicate lane heading is load.heading-duplicate', () => {
    const s = load(repo({ 'T-1': laneTicket('T-1', { body: LANE_BODY + '## Approach\nagain\n' }) }));
    expect(s.errors.map((e) => e.rule)).toContain('load.heading-duplicate');
  });

  it('a ticket without lane may repeat a lane heading, as in 0.1.0', () => {
    const s = load(repo({ 'T-1': laneTicket('T-1', { lane: '', body: LANE_BODY + '## Approach\nagain\n' }) }));
    expect(s.errors.map((e) => e.rule)).not.toContain('load.heading-duplicate');
  });
});

describe('EARS lint is off for lane tickets (spec §4, §15)', () => {
  const requirements = ['## Requirements', 'Owners like exports.', ...Array.from({ length: 15 }, () => 'The system shall export.'), ''];
  const body = LANE_BODY + requirements.join('\n');
  const both = (lane: string) => {
    const files = repo({ 'T-1': laneTicket('T-1', { lane, body }) });
    return [...rules(files, 'lint.ears-unclassified'), ...rules(files, 'lint.requirements-oversize')].map((f) => f.rule);
  };

  it('a lane ticket gets neither finding', () => {
    expect(both('M')).toEqual([]);
  });

  it('a ticket without lane still gets both', () => {
    expect(both('')).toEqual(['lint.ears-unclassified', 'lint.requirements-oversize']);
  });
});

describe('depends_on (spec §5)', () => {
  const t = (id: string, deps: string[]) =>
    laneTicket(id, { frontmatter: [`depends_on: [${deps.map((d) => `"${d}"`).join(', ')}]`] });

  it('names an unknown id by pointer', () => {
    expect(rules(repo({ A: t('A', ['B', 'NOPE']), B: t('B', []) }), 'lint.depends-unknown')).toEqual([
      {
        file: 'accord/tickets/A.md',
        pointer: '/depends_on/1',
        rule: 'lint.depends-unknown',
        level: 'error',
        reason: 'depends_on names "NOPE", which is not a ticket in accord/tickets/',
      },
    ]);
  });

  it('reports a cycle once, on its smallest member', () => {
    const files = repo({ A: t('A', ['B']), B: t('B', ['C']), C: t('C', ['A']), D: t('D', ['A']) });
    expect(rules(files, 'lint.depends-cycle')).toEqual([
      {
        file: 'accord/tickets/A.md',
        pointer: '/depends_on',
        rule: 'lint.depends-cycle',
        level: 'error',
        reason: 'depends_on forms a cycle among A, B, C',
      },
    ]);
  });

  it('a self-dependency is a cycle', () => {
    expect(rules(repo({ A: t('A', ['A']) }), 'lint.depends-cycle').map((f) => f.reason)).toEqual([
      'depends_on forms a cycle among A',
    ]);
  });

  it('an acyclic graph is silent', () => {
    const files = repo({ A: t('A', ['B', 'C']), B: t('B', ['C']), C: t('C', []) });
    expect(rules(files, 'lint.depends-cycle')).toEqual([]);
    expect(rules(files, 'lint.depends-unknown')).toEqual([]);
  });
});
