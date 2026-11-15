// ST-LN-50 t2-ac-5 (stage half), D-08: `strictness.stages.<lane>.<stage>: off` turns a whole stage off for that lane. The engines drop the stage's rules (STAGE_OF in
// floor.ts) from every gate and from the ticket's lint findings, and progressOf skips the stage. The floor stages (intent, build, verify) and every stage of lanes S and R
// never leave, and no LOCKED rule leaves with a stage.
import { describe, expect, it } from 'vitest';
import { gateDone, lintSnapshot, loadSnapshot, resolveStrictness, setFrontmatterKey, statusRows } from '../src/index.js';
import type { AccordConfig, RepoSnapshot } from '../src/index.js';
import { stageOff } from '../src/gate/floor.js';
import { acHash } from '../src/gate/hash.js';
import { approved } from './helpers/approve.js';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const T1 = 'accord/tickets/T-1.md';
const stagesConfig = (yaml: string): string => CONFIG + 'strictness:\n  stages:\n' + yaml;
const REVIEW_OFF_M = stagesConfig('    M:\n      review: off\n');

const BUILT = '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n';

/** An approved ticket of `lane` whose two tasks are done and which holds no review.md. */
function builtFiles(config: string, lane = 'M'): Record<string, string> {
  const base = { 'accord/config.yml': config, [T1]: laneTicket('T-1', { lane }) };
  return { ...approved(base, 'T-1'), 'accord/tickets/T-1/plan.md': PLAN, 'accord/tickets/T-1/ledger.md': BUILT };
}
const snap = (files: Record<string, string>): RepoSnapshot => loadSnapshot({ files, tree: Object.keys(files).sort() });
const stageOf = (files: Record<string, string>): string | undefined => statusRows(snap(files))[0].stage;
const bind = (files: Record<string, string>): Record<string, string> => {
  const hash = acHash(snap(files).tickets['T-1'].scenarios) as string;
  return { ...files, [T1]: setFrontmatterKey(setFrontmatterKey(files[T1], 'verified', ['ac-1', 'ac-2']), 'verified_hash', hash) };
};
const config = (yaml: string): AccordConfig => ({ strictness: { stages: yaml } }) as unknown as AccordConfig;

describe('review off for lane M (ST-LN-50 t2-ac-5)', () => {
  it('risk:complex-branching a stage turned off is skipped by the gates and the stage trace (ST-LN-50 t2-ac-5)', () => {
    // today: the last task goes to review, and gate done holds gate.review-missing
    const on = builtFiles(CONFIG);
    expect(stageOf(on)).toBe('review');
    expect(gateDone(snap(on), 'T-1').findings.map((f) => f.rule)).toContain('gate.review-missing');

    // review off for lane M: verify after the last task, done with bound ticks, and no review rule in gate done
    const off = builtFiles(REVIEW_OFF_M);
    expect(stageOf(off)).toBe('verify');
    expect(stageOf(bind(off))).toBe('done');
    const rules = gateDone(snap(off), 'T-1').findings.map((f) => f.rule);
    expect(rules).not.toContain('gate.review-missing');
    expect(rules.filter((r) => r.startsWith('gate.review-') || r === 'gate.finding-evidence' || r === 'gate.commit-after-review')).toEqual([]);

    // a lane L ticket with the same records is still at review: the key is per lane
    expect(stageOf(builtFiles(REVIEW_OFF_M, 'L'))).toBe('review');
    expect(gateDone(snap(builtFiles(REVIEW_OFF_M, 'L')), 'T-1').findings.map((f) => f.rule)).toContain('gate.review-missing');
  });

  it('risk:security a LOCKED rule never leaves with a stage: an unverified ticket still fails gate.verification-missing (ST-LN-50 t2-ac-5)', () => {
    const done = gateDone(snap(builtFiles(REVIEW_OFF_M)), 'T-1');
    expect(done.verdict).toBe('fail');
    expect(done.findings.find((f) => f.rule === 'gate.verification-missing')?.level).toBe('error');
  });

  it('risk:complex-branching a stage turned back on applies its rules again, nothing is cached (ST-LN-50 t2-ac-5)', () => {
    const off = builtFiles(REVIEW_OFF_M);
    expect(stageOf(off)).toBe('verify');
    const on = { ...off, 'accord/config.yml': CONFIG + 'strictness:\n  stages:\n    M:\n      review: on\n' };
    expect(stageOf(on)).toBe('review');
    expect(gateDone(snap(on), 'T-1').findings.map((f) => f.rule)).toContain('gate.review-missing');
  });

  it('risk:complex-branching a stage off drops that stage\'s lint findings of the ticket, for its lane only (ST-LN-50 t2-ac-5)', () => {
    // a review record without a plan.md is lint.review-without-plan, a rule of the plan stage
    const files = (cfg: string, lane = 'M'): Record<string, string> => ({
      'accord/config.yml': cfg,
      [T1]: laneTicket('T-1', { lane }),
      'accord/tickets/T-1/review.md': 'verdict: converged\n',
    });
    const rules = (f: Record<string, string>): string[] => lintSnapshot(snap(f)).findings.map((x) => x.rule);
    expect(rules(files(CONFIG))).toContain('lint.review-without-plan');
    expect(rules(files(stagesConfig('    M:\n      plan: off\n')))).not.toContain('lint.review-without-plan');
    expect(rules(files(stagesConfig('    M:\n      plan: off\n'), 'L'))).toContain('lint.review-without-plan');
    // a LOCKED lint rule of the same ticket stays whatever stage is off
    const noScenarios = { ...files(stagesConfig('    M:\n      plan: off\n      review: off\n')), [T1]: laneTicket('T-1', { body: '## Intent\nx\n' }) };
    expect(rules(noScenarios)).toContain('lint.no-scenarios');
  });
});

describe('the floor never leaves (ST-LN-50 t2-ac-5)', () => {
  it('risk:security lanes S and R and the floor stages never leave (ST-LN-50 t2-ac-5)', () => {
    const keys = '    M:\n      verify: off\n      intent: off\n      build: off\n      review: off\n    S:\n      review: off\n      intent: off\n      build: off\n    R:\n      research: off\n      intent: off\n';
    const cfg = stagesConfig(keys);
    const s = resolveStrictness(snap(builtFiles(cfg)).config);
    // only review of lane M is held: no floor stage, nothing of S or R
    expect([...s.stages.M]).toEqual(['review']);
    expect([...s.stages.L]).toEqual([]);
    expect([...s.stages.P]).toEqual([]);
    expect(Object.keys(s.stages).sort()).toEqual(['L', 'M', 'P']);

    // stageOff is false for each floor stage on a lane M ticket
    const m = snap(builtFiles(cfg));
    for (const stage of ['intent', 'build', 'verify'] as const) expect(stageOff(m, 'T-1', stage), stage).toBe(false);
    expect(stageOff(m, 'T-1', 'review')).toBe(true);

    // a lane S ticket: every stage stays, and without review.md it still fails gate.review-missing
    const sFiles: Record<string, string> = { 'accord/config.yml': cfg, [T1]: laneTicket('T-1', { lane: 'S', body: LANE_S_BODY }) };
    const sSnap = snap(sFiles);
    for (const stage of ['intent', 'build', 'review'] as const) expect(stageOff(sSnap, 'T-1', stage), `S ${stage}`).toBe(false);
    expect(gateDone(sSnap, 'T-1').findings.map((f) => f.rule)).toContain('gate.review-missing');

    // a lane R ticket: no stage leaves
    const rSnap = snap({ 'accord/config.yml': cfg, [T1]: laneTicket('T-1', { lane: 'R', body: LANE_S_BODY }) });
    for (const stage of ['intent', 'research'] as const) expect(stageOff(rSnap, 'T-1', stage as never), `R ${stage}`).toBe(false);
    // a ticket without a lane and an unknown id
    const bare = snap({ 'accord/config.yml': cfg, [T1]: laneTicket('T-1', { lane: '' }) });
    expect(stageOff(bare, 'T-1', 'review')).toBe(false);
    expect(stageOff(m, 'NOPE', 'review')).toBe(false);

    // a lane M ticket at verify stays at verify: no key moves a floor stage
    expect(stageOf(builtFiles(cfg))).toBe('verify');
    expect(stageOf(approved({ 'accord/config.yml': cfg, [T1]: laneTicket('T-1') }, 'T-1'))).toBe('plan');
    expect(stageOf({ 'accord/config.yml': cfg, [T1]: laneTicket('T-1') })).toBe('intent');
  });

  it('risk:parsing resolveStrictness reads stages from the team key only, and reads a hand-built value as unset (ST-LN-50 t2-ac-5)', () => {
    expect(resolveStrictness(undefined).stages).toEqual({ M: new Set(), L: new Set(), P: new Set() });
    expect(resolveStrictness({ profile: 'maintain' } as AccordConfig).stages).toEqual({ M: new Set(), L: new Set(), P: new Set() });
    const s = resolveStrictness(config({
      M: { discuss: 'off', plan: 'on', review: 'off', nosuch: 'off' },
      L: { approach: 'off', verify: 'off' },
      P: 'off',
      S: { review: 'off' },
      X: { review: 'off' },
    } as never));
    expect([...s.stages.M].sort()).toEqual(['discuss', 'review']);
    expect([...s.stages.L]).toEqual(['approach']);
    expect([...s.stages.P]).toEqual([]);
    // values that are not an object, or a stage value that is not on or off, leave nothing off
    expect(resolveStrictness(config('off' as never)).stages.M.size).toBe(0);
    expect(resolveStrictness(config({ M: { review: 'maybe' } } as never)).stages.M.size).toBe(0);
  });
});
