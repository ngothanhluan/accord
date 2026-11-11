// ST-LN-93: `accord gate plan` on real git holds a plan to twice the size its Intent expects.
import { expect, it } from 'vitest';
import { cleanup, commitAll, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket, PLAN, sized } from '../../../test/helpers/lane.js';

interface Found { rule: string; level: string; reason?: string }
const findings = async (repo: string): Promise<Found[]> => JSON.parse((await run(['gate', 'plan', 'T-1', '--json'], repo)).out).findings as Found[];
const THIRD = '\n## Task 3: Extra\ncovers: @ac-1\nfiles: src/export.ts\nverify: export#writes-csv\nA third task.\n';

it('risk:complex-branching accord gate plan refuses a plan over its expected size on real git (ST-LN-93 ac-1)', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body: sized(1) }) });
  try {
    await run(['approve', 'T-1'], repo);
    const first = commitAll(repo);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', first) + THIRD });
    commitAll(repo);
    const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
    expect(r.code).toBe(1);
    const size = (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.plan-size');
    expect(size).toHaveLength(1);
    expect(size[0].reason).toContain('3 tasks');
    expect(size[0].reason).toContain('2 × 1');
    expect(size[0].reason).toContain('Expected size: 1 tasks');

    writeFiles(repo, {
      'accord/tickets/T-1/ledger.md':
        '## Rulings\n- Ruling: the owner allows 3 plan tasks against an expected size of 1 tasks — "three is fine" — cost if wrong: a bigger plan\n',
    });
    commitAll(repo);
    expect((await findings(repo)).filter((f) => f.rule === 'gate.plan-size')).toEqual([]);
  } finally {
    cleanup(repo);
  }
});
