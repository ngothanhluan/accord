import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';
import type { Files } from '../../../test/helpers/lane.js';
import { approve, CONFIG, gateReadyIn, junit, LANE_S_BODY, laneTicket, P, PLAN, REPORT } from '../../../test/helpers/lane.js';

const files = (id: string, ticket: string): Record<string, string> => ({
  'accord/config.yml': CONFIG,
  [P(id)]: ticket,
  'src/export.ts': 'export const write = 1;\n',
  [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
});

it('risk:regression core approve and gateReadyIn write the hashes accord approve and gate ready write', async () => {
  // Lane M: approve then gate ready; lane S: gate ready only (no approval).
  const lm = makeLaneRepo();
  const ls = makeLaneRepo({ [P('S-1')]: laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }) });
  try {
    expect((await run(['approve', 'T-1'], lm)).code).toBe(0);
    expect((await run(['gate', 'ready', 'T-1'], lm)).code).toBe(0);
    const m: Files = { ...files('T-1', laneTicket('T-1')), 'accord/tickets/T-1/plan.md': PLAN };
    approve(m, 'T-1');
    expect(gateReadyIn(m, 'T-1')).toBe('pass');
    expect(m[P('T-1')]).toBe(readFileSync(join(lm, P('T-1')), 'utf8'));

    expect((await run(['gate', 'ready', 'S-1'], ls)).code).toBe(0);
    const s = files('S-1', laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }));
    expect(gateReadyIn(s, 'S-1')).toBe('pass');
    expect(s[P('S-1')]).toBe(readFileSync(join(ls, P('S-1')), 'utf8'));
  } finally {
    cleanup(lm);
    cleanup(ls);
  }
}, 60_000);
