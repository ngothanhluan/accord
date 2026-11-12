// ST-LN-91 91d-ac-1: gate ready asks a lane M ticket claimed from DISCUSS_FROM on for accord/tickets/<id>/discuss.md.
import { describe, expect, it } from 'vitest';
import { gateReady, loadSnapshot } from '../src/index.js';
import type { GateResult, RepoSnapshot } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, REPORT } from '../../../test/helpers/lane.js';

const DISCUSS = 'accord/tickets/T-1/discuss.md';
const GRAY = '## Gray areas\n- behaviour — what export prints for an empty report — D-01\n';

interface Opts {
  discuss?: string; // text of discuss.md; absent: no file
  pin?: string; // claim pin; absent: no claim fact
  basePin?: string;
  fact?: { error: string }; // a failed claim read
  config?: string;
  lane?: string;
}
const check = ({ discuss, pin, basePin, fact, config = CONFIG, lane }: Opts = {}): GateResult => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', lane === undefined ? {} : { lane }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    },
    'T-1',
  );
  if (discuss !== undefined) files[DISCUSS] = discuss;
  const snapshot: RepoSnapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  const claimed = fact ?? (pin === undefined ? undefined : { pin, ...(basePin === undefined ? {} : { basePin }) });
  return gateReady(claimed === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claimed } }, 'T-1');
};
const missing = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.discuss-missing');

describe('discuss record at gate ready', () => {
  it('risk:complex-branching a lane M ticket claimed at the cut-off with no discuss.md fails gate ready (ST-LN-91 91d-ac-1)', () => {
    const r = check({ pin: '0.4.1' });
    expect(r.verdict).toBe('fail');
    const f = missing(r);
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].file).toBe(DISCUSS);
    expect(f[0].reason).toContain(DISCUSS);
    expect(f[0].reason).toContain('0.4.1');
    expect(missing(check({ pin: '0.4.1', discuss: GRAY }))).toEqual([]);
  });
});
