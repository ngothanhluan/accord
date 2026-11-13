// ST-LN-91 91p-ac-1 and 91p-ac-2: `accord gate plan` on real git reads the ticket's claim pin (D-15) for the plan format rules: the after: line,
// fenced blocks other than interfaces, and the task cap. The plan baseline pin never decides them.
import { expect, it } from 'vitest';
import { PLAN_FORMAT_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

interface Found { rule: string; level: string; reason?: string; file?: string }
const NEW_RULES = ['gate.task-after-missing', 'gate.task-after-unknown', 'gate.task-code-block', 'gate.task-too-long'];
const gate = async (repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out).findings as Found[]).filter((f) => NEW_RULES.includes(f.rule)) };
};
// The pin the rule reads is the one at the claim commit, so the CONFIG pin of the running CLI (the running version) never decides.
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

/** An approved ticket claimed under `claimPin`, then HEAD restored to CONFIG, the plan baselined under `baselinePin` and committed. */
async function planned(claimPin: string, baselinePin: string, plan: string): Promise<string> {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  await run(['approve', 'T-1'], repo);
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': pinned(baselinePin), 'notes.txt': 'work after the claim\n' });
  const baseline = commitAll(repo);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': plan.replace('abc1234', baseline), 'accord/config.yml': CONFIG });
  commitAll(repo);
  return repo;
}

it('risk:complex-branching accord gate plan reads the claim pin and refuses a task with no after: line (ST-LN-91 91p-ac-2)', async () => {
  // (a) claimed at the cut-off, the plan baselined under 0.4.0: the claim pin decides.
  const a = await planned(PLAN_FORMAT_FROM, '0.4.0', PLAN);
  try {
    const got = await gate(a);
    expect(got.code).toBe(1);
    const missing = got.found.filter((f) => f.rule === 'gate.task-after-missing');
    expect(missing).toHaveLength(2);
    expect(missing[0].reason).toContain('task 1');
    expect(missing[1].reason).toContain('task 2');
    expect(missing[0].file).toBe('accord/tickets/T-1/plan.md');
  } finally {
    cleanup(a);
  }

  // (b) claimed under 0.4.0, the plan written after the upgrade and baselined at the cut-off: no format finding (D-15).
  const b = await planned('0.4.0', PLAN_FORMAT_FROM, PLAN);
  try {
    expect((await gate(b)).found).toEqual([]);
  } finally {
    cleanup(b);
  }

  // (c) an unknown task is named; `after: none` and a known task pass.
  const lines = PLAN.split('\n');
  const withAfter = lines.flatMap((l) => (l.startsWith('covers: @ac-1') ? ['after: none', l] : l.startsWith('covers: @ac-2') ? ['after: 1, 4', l] : [l])).join('\n');
  const c = await planned(PLAN_FORMAT_FROM, '0.4.0', withAfter);
  try {
    const got = await gate(c);
    expect(got.found.map((f) => f.rule)).toEqual(['gate.task-after-unknown']);
    expect(got.found[0].reason).toContain('task 2');
    expect(got.found[0].reason).toContain('4');
  } finally {
    cleanup(c);
  }
});

it('risk:complex-branching accord gate plan reads a ticket with no claim commit through the working-tree pin and a git error as new rules (ST-LN-91 91p-ac-2, D-15)', async () => {
  // No `claim:` commit: HEAD pins 0.4.0 (CONFIG), so the older rules hold.
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    await run(['approve', 'T-1'], repo);
    const baseline = commitAll(repo);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline) });
    commitAll(repo);
    expect((await gate(repo)).found).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching accord gate plan names the over-long task and its length on real git (ST-LN-91 91p-ac-1)', async () => {
  const body = (n: number): string => Array.from({ length: n }, (_, i) => `Step ${i + 1}.`).join('\n');
  // Task 2 holds 4 field lines (covers, files, verify, after) and the filler.
  const plan = (filler: number): string =>
    PLAN.replace('covers: @ac-1, D-01', 'after: none\ncovers: @ac-1, D-01').replace('covers: @ac-2', 'after: 1\ncovers: @ac-2').replace('Quote cells that contain a comma.', body(filler));
  const over = await planned(PLAN_FORMAT_FROM, '0.4.0', plan(121 - 4));
  try {
    const got = await gate(over);
    expect(got.code).toBe(1);
    expect(got.found.map((f) => f.rule)).toEqual(['gate.task-too-long']);
    expect(got.found[0].reason).toContain('task 2');
    expect(got.found[0].reason).toContain('121');
  } finally {
    cleanup(over);
  }
  const exact = await planned(PLAN_FORMAT_FROM, '0.4.0', plan(120 - 4));
  try {
    expect((await gate(exact)).found).toEqual([]);
  } finally {
    cleanup(exact);
  }
  // The same task under a claim at 0.4.0 passes.
  const old = await planned('0.4.0', '0.4.0', plan(121 - 4));
  try {
    expect((await gate(old)).found).toEqual([]);
  } finally {
    cleanup(old);
  }
});

it('risk:complex-branching accord gate plan refuses a fenced block other than interfaces on real git (ST-LN-91 91p-ac-1)', async () => {
  const fenced = PLAN.replace('Add a csv branch to the writer.', '```ts\nwriter.csv = true;\n```').replace('covers: @ac-1, D-01', 'after: none\ncovers: @ac-1, D-01').replace('covers: @ac-2', 'after: 1\ncovers: @ac-2');
  const repo = await planned(PLAN_FORMAT_FROM, '0.4.0', fenced);
  try {
    const got = await gate(repo);
    expect(got.found.map((f) => f.rule)).toEqual(['gate.task-code-block']);
    expect(got.found[0].reason).toContain('task 1');
    expect(got.found[0].reason).toContain('(ts)');
  } finally {
    cleanup(repo);
  }
});
