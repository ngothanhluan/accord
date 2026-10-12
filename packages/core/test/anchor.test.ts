// Spec §6 re-anchoring: the owner's words, verbatim, and where the work stands.
import { describe, expect, it } from 'vitest';
import { anchorText, loadSnapshot } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const snap = (files: Record<string, string>) => loadSnapshot({ files, tree: [] });
const base = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };

describe('anchorText', () => {
  it('prints the four owner sections verbatim, the stage, the next task, and the Rulings', () => {
    const files = {
      ...approved(base, 'T-1'),
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md':
        '## Tasks\n- task 1 done abc1234\n\n## Rulings\n- Ruling: kept the old writer signature — callers depend on it — one extra branch if wrong\n',
    };
    expect(anchorText(snap(files), 'T-1')).toBe(
      [
        '# Anchor: T-1 "Export"',
        '',
        'Stage: build 1/2, next: task 2 "Escaping"',
        '',
        '## Intent',
        'Owners can export their report as CSV.',
        '',
        '## Vetoes',
        '- No new dependency.',
        '',
        '## Decisions',
        '- D-01 Use the existing writer — "reuse what we have"',
        '',
        '## Corrections',
        '(none)',
        '',
        '## Rulings',
        'Ruling: kept the old writer signature — callers depend on it — one extra branch if wrong',
        '',
      ].join('\n'),
    );
  });

  it('names the next step for a stage without tasks', () => {
    expect(anchorText(snap(base), 'T-1')).toContain('Stage: intent, next: the owner approves the ticket (accord approve)');
  });

  it('is undefined for an unknown ticket and for a ticket without lane', () => {
    expect(anchorText(snap(base), 'NOPE')).toBeUndefined();
    const legacy = { ...base, 'accord/tickets/T-1.md': laneTicket('T-1', { lane: '' }) };
    expect(anchorText(snap(legacy), 'T-1')).toBeUndefined();
  });
});
