// ST-LN-93: `accord gate plan` on real git holds a plan to twice the size its Intent expects.
import { expect, it } from 'vitest';
import { PLAN_SIZE_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, PLAN, sized } from '../../../test/helpers/lane.js';

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

// The pin the cut-off reads is the one at the plan's baseline: commit, so the CONFIG pin of the running CLI (the running version) never decides.
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const missing = (all: Found[]): Found[] => all.filter((f) => f.rule === 'gate.plan-size-missing');

it('risk:complex-branching gate plan reads the pin at the plan baseline from git (ST-LN-93 ac-3)', async () => {
  // (a) the baseline commit holds the cut-off pin; HEAD holds the running version's pin, so the CLI's own pin check passes.
  const a = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body: sized() }) });
  try {
    await run(['approve', 'T-1'], a);
    writeFiles(a, { 'accord/config.yml': pinned(PLAN_SIZE_FROM) });
    const baseline = commitAll(a);
    writeFiles(a, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline), 'accord/config.yml': CONFIG });
    commitAll(a);
    const got = missing(await findings(a));
    expect(got).toHaveLength(1);
    expect(got[0].reason).toContain('Expected size: <N> tasks');
    expect(got[0].reason).toContain(PLAN_SIZE_FROM);
  } finally {
    cleanup(a);
  }

  // (b) the baseline commit holds 0.4.0: the ticket was planned under the old rules, whatever the working tree pins now.
  const b = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body: sized() }) });
  try {
    await run(['approve', 'T-1'], b);
    writeFiles(b, { 'accord/config.yml': pinned('0.4.0') });
    const baseline = commitAll(b);
    writeFiles(b, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline), 'accord/config.yml': CONFIG });
    commitAll(b);
    expect(missing(await findings(b))).toEqual([]);
  } finally {
    cleanup(b);
  }

  // (c) main's tip holds the cut-off pin; a branch from it lowers the pin and takes that commit as baseline: caught through the merge base.
  const c = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body: sized() }) });
  try {
    await run(['approve', 'T-1'], c);
    writeFiles(c, { 'accord/config.yml': pinned(PLAN_SIZE_FROM) });
    commitAll(c);
    gitRun(c, 'branch', '-M', 'main');
    gitRun(c, 'switch', '-q', '-c', 't/T-1');
    writeFiles(c, { 'accord/config.yml': pinned('0.4.0') });
    const baseline = commitAll(c);
    writeFiles(c, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline), 'accord/config.yml': CONFIG });
    commitAll(c);
    expect(missing(await findings(c))).toHaveLength(1);
  } finally {
    cleanup(c);
  }
});
