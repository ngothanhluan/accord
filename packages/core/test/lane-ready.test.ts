// Spec §4, §7: a lane ticket reaches Ready through the owner's approval, not through EARS lines.
import { describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import { gateReady } from '../src/gate/index.js';
import type { GateResult } from '../src/gate/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';

const files = (text = laneTicket('T-1')) => ({
  'accord/config.yml': CONFIG,
  'accord/tickets/T-1.md': text,
  [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
});
const ready = (f: Record<string, string>) => gateReady(loadSnapshot({ files: f, tree: Object.keys(f).sort() }), 'T-1');
const errors = (r: GateResult) => r.findings.filter((x) => x.level === 'error').map((x) => x.rule);

describe('Ready for lane tickets', () => {
  it('an approved lane ticket passes with no EARS line', () => {
    const r = ready(approved(files(), 'T-1'));
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('an unapproved lane ticket fails on gate.approval-missing', () => {
    expect(errors(ready(files()))).toEqual(['gate.approval-missing']);
  });

  it('an edit after approval fails on gate.approval-stale', () => {
    const f = approved(files(), 'T-1');
    f['accord/tickets/T-1.md'] = f['accord/tickets/T-1.md'].replace('csv mode', 'tsv mode');
    const r = ready(f);
    expect(errors(r)).toEqual(['gate.approval-stale']);
    expect(r.findings.find((x) => x.rule === 'gate.approval-stale')?.reason).toMatch(
      /^the approved sections changed since approval: approved_hash records fnv1a64:[0-9a-f]{16}, they hash to fnv1a64:[0-9a-f]{16} now; the owner must approve again$/,
    );
  });

  it('an empty Approach fails on gate.approach-empty', () => {
    const text = laneTicket('T-1').replace('Extend the existing report writer with a csv mode.', '<!-- empty -->');
    expect(errors(ready(approved(files(text), 'T-1')))).toEqual(['gate.approach-empty']);
  });

  it('a ticket without lane keeps gate.ears-missing and has no approval rule', () => {
    const r = ready(files(laneTicket('T-1', { lane: '', body: LANE_BODY + '## Requirements\n\n## Plan\n' })));
    expect(errors(r)).toContain('gate.ears-missing');
    expect(errors(r)).not.toContain('gate.approval-missing');
  });
});
