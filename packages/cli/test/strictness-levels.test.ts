// ST-LN-50 t2-ac-5 (level half), D-08, D-09: `strictness.levels.<rule id>` on real files and real git. A level lowers an overridable rule in `accord gate` and
// `accord lint`; a floor rule cannot be lowered: `accord config` refuses the key, `accord lint` reports lint.config-floor for a hand-edited one, and the gate
// still fails on the rule.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { loadSnapshot, resolveStrictness } from '@accord-dev/accord-core';
import { makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, discussFiles, laneTicket } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  // no retries: nothing here holds a handle on the folder, and one that did would be a bug to see
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

interface Found { rule: string; level: string; file?: string; pointer?: string; reason?: string }
const config = (repo: string): string => readFileSync(join(repo, 'accord', 'config.yml'), 'utf8');
const gate = async (which: 'ready' | 'done', repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['gate', which, 'T-1', '--json'], repo);
  return { code: r.code, found: JSON.parse(r.out).findings as Found[] };
};
const errors = (found: Found[]): string[] => found.filter((f) => f.level === 'error').map((f) => f.rule);

/** An approved lane M ticket that needs a design (`ui: true`, no design: URL), its discuss record and plan in place. */
async function needsDesign(): Promise<string> {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1').replace('ui: false', 'ui: true'), ...discussFiles('T-1') });
  repos.push(repo);
  const approved = await run(['approve', 'T-1'], repo);
  expect(approved.err).toBe('');
  expect(approved.code).toBe(0);
  return repo;
}

it('risk:security a floor rule cannot be lowered and an overridable one can (ST-LN-50 t2-ac-5)', async () => {
  const repo = await needsDesign();

  // before: the design rule is the only error at Ready
  const before = await gate('ready', repo);
  expect(before.code).toBe(1);
  expect(errors(before.found)).toEqual(['gate.design-missing']);

  // an overridable rule is lowered through accord config, and Ready passes
  const lowered = await run(['config', 'set', 'strictness.levels.gate.design-missing', 'off'], repo);
  expect(lowered.err).toBe('');
  expect(lowered.code).toBe(0);
  expect(lowered.out).toBe('changed: strictness.levels.gate.design-missing unset -> "off"\n');
  expect(config(repo)).toContain('gate.design-missing');
  const after = await gate('ready', repo);
  expect(after.code).toBe(0);
  expect(after.found.some((f) => f.rule === 'gate.design-missing')).toBe(false);
  expect((await run(['lint'], repo)).code).toBe(0);

  // a floor rule is refused by accord config, and the file stays as it was
  const kept = config(repo);
  const refused = await run(['config', 'set', 'strictness.levels.gate.verification-missing', 'off'], repo);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('strictness.levels.gate.verification-missing');
  expect(refused.err).toContain('on the floor: independent verification before done');
  expect(refused.err).toContain('accord/config.yml was not changed');
  expect(config(repo)).toBe(kept);

  // hand-edited into the file anyway: lint names it, and the gate still refuses
  const text = config(repo).replace('gate.design-missing: "off"', 'gate.design-missing: "off"\n    gate.verification-missing: "off"');
  writeFiles(repo, { 'accord/config.yml': text });
  const lint = await run(['lint', '--json'], repo);
  expect(lint.code).toBe(1);
  const lintFound = (JSON.parse(lint.out) as { findings: Found[] }).findings;
  const floor = lintFound.filter((f) => f.rule === 'lint.config-floor');
  expect(floor).toHaveLength(1);
  expect(floor[0]).toMatchObject({ file: 'accord/config.yml', level: 'error', pointer: '/strictness/levels/gate.verification-missing' });
  expect(floor[0].reason).toContain('gate.verification-missing');

  const done = await gate('done', repo);
  expect(done.code).toBe(1);
  expect(done.found.find((f) => f.rule === 'gate.verification-missing')?.level).toBe('error');
}, 120_000);

it('risk:security accord config refuses a stage-owned rule, an unknown rule, and off for a Ready-promoted rule, and check names them (ST-LN-50 t2-ac-5)', async () => {
  const repo = makeLaneRepo();
  repos.push(repo);
  const before = config(repo);
  for (const [key, value, why] of [
    ['strictness.levels.gate.review-missing', 'off', 'follows strictness.stages'],
    ['strictness.levels.gate.nosuch', 'warning', 'no such rule'],
    ['strictness.levels.lint.sentinel', 'off', 'error or warning'],
    ['strictness.levels.lint.config-floor', 'warning', 'on the floor'],
  ] as const) {
    const r = await run(['config', 'set', key, value], repo);
    expect(r.code, key).toBe(2);
    expect(r.err, key).toContain(key);
    expect(r.err, key).toContain(why);
    expect(config(repo), key).toBe(before);
  }
  // the levels that are allowed
  expect((await run(['config', 'set', 'strictness.levels.lint.sentinel', 'error'], repo)).code).toBe(0);
  expect((await run(['config', 'set', 'strictness.levels.lint.vague-wording', 'off'], repo)).code).toBe(0);
  expect((await run(['config', 'check'], repo)).code).toBe(0);

  // a level the schema does not know is a schema error, as every other bad value
  const bad = await run(['config', 'set', 'strictness.levels.gate.design-missing', 'silent'], repo);
  expect(bad.code).toBe(2);
  expect(bad.err).toContain('accord/config.yml was not changed');

  // check on a hand-edited floor key exits 2 and names the rule; the file is not touched
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'strictness:\n  levels:\n    gate.verification-missing: "off"\n' });
  const hand = config(repo);
  const check = await run(['config', 'check'], repo);
  expect(check.code).toBe(2);
  expect(check.out).toContain('gate.verification-missing');
  expect(check.out).toContain('accord/config.yml');
  expect(config(repo)).toBe(hand);
  const asJson = JSON.parse((await run(['config', 'check', '--json'], repo)).out) as { findings: Found[] };
  expect(asJson.findings.map((f) => `${f.rule}@${f.pointer}`)).toEqual(['lint.config-floor@/strictness/levels/gate.verification-missing']);
}, 120_000);

it('risk:regression a repository with today\'s config answers as before: its configs load to their profile\'s preset (ST-LN-50 t2-ac-6)', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const maintain = { rounds: {}, levels: Object.fromEntries(['lint.token-hardcoded', 'lint.intent-oversize', 'lint.requirements-oversize', 'lint.scenarios-oversize'].map((id) => [id, 'warning'])) };
  const build = { rounds: {}, levels: {} };
  for (const [file, profile, preset] of [
    ['accord/config.yml', 'maintain', maintain],
    ['examples/maintain/accord/config.yml', 'maintain', maintain],
    ['examples/build/accord/config.yml', 'build', build],
  ] as const) {
    const files = { 'accord/config.yml': readFileSync(join(root, file), 'utf8') };
    const loaded = loadSnapshot({ files, tree: Object.keys(files) });
    expect(loaded.config?.profile, file).toBe(profile);
    expect(loaded.config?.strictness, file).toBeUndefined();
    expect(resolveStrictness(loaded.config), file).toEqual(preset);
  }
});
