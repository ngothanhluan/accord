// ST-LN-25 `accord upgrade`: the pushed branch moves every pin, and the checkout it ran in is left alone.
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { contentHash, hookEntries, initFiles, mergeHooks, RETIRED_SKILL_FOLDERS, RULESET_FROM, setFrontmatterKey } from '@accord-dev/accord-core';
import pkg from '../package.json' with { type: 'json' };
import { done as doneFiles, laneTicket, P, pinned as pinnedConfig } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copyClone, makeTemplate } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

// BUG-LN-15: every git call stays real; the hash-object calls are only recorded, so a test can count them.
const spawned = vi.hoisted(() => ({ hashObject: 0 }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: (file: string, args: string[], opts: unknown) => {
      if (file === 'git' && args[0] === 'hash-object') spawned.hashObject++;
      return (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(file, args, opts);
    },
  };
});

// ST-LN-96 rel-ac-1: a test of the backfill sets the running version; every other test reads the real one.
const running = vi.hoisted(() => ({ v: undefined as string | undefined }));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  const mocked = { ...m.default };
  Object.defineProperty(mocked, 'version', { get: () => running.v ?? m.default.version, enumerable: true });
  return { default: mocked };
});

const clones: Clone[] = [];
afterEach(() => {
  running.v = undefined;
  for (const c of clones.splice(0)) c.cleanupAll();
});

const v = pkg.version;
const name = pkg.name;

// Templates (H1, rule 5): built once, copied with their own origin (copyClone asserts it); none holds a linked worktree.
let plain: Clone;
let plainOther: string;
let pinned: Clone;
let pinnedOther: string;
let nextSha: string;
const copy = (tpl: Clone, other: string) => {
  const c = copyClone(tpl, [other]);
  clones.push(c);
  return c;
};

beforeAll(() => {
  plain = makeTemplate();
  plainOther = plain.otherClone();
  gitRun(plainOther, 'config', 'gc.auto', '0');

  // #12's remote at the old-pin `next` commit.
  pinned = makeTemplate();
  pinnedOther = pinned.otherClone();
  gitRun(pinnedOther, 'config', 'gc.auto', '0');
  const old = { name, version: '0.0.9' };
  const cfg = readFileSync(join(pinnedOther, 'accord/config.yml'), 'utf8');
  writeFiles(pinnedOther, {
    'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.0.9"'),
    '.github/workflows/accord.yml': initFiles(old).find((f) => f.path === '.github/workflows/accord.yml')!.text,
    '.claude/settings.json': JSON.stringify(mergeHooks({}, hookEntries(old)), null, 2) + '\n',
  });
  commitMsg(pinnedOther, 'pin 0.0.9');
  writeFiles(pinnedOther, { 'next.txt': 'next\n' });
  nextSha = commitMsg(pinnedOther, 'next');
  gitRun(pinnedOther, 'push', '-q', 'origin', 'main');
}, 120_000);

afterAll(() => {
  for (const t of [plain, pinned]) t.cleanupAll();
});

it('ac-3 upgrade pushes a branch from the latest origin main whose one commit moves every pin and the checkout is unchanged', async () => {
  const c = copy(pinned, pinnedOther);
  const base = nextSha;

  writeFileSync(join(c.root, 'scratch.txt'), 'scratch\n');
  const head = c.git('rev-parse', 'HEAD');
  const branch = c.git('branch', '--show-current');
  const status = c.git('status', '--porcelain');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe(`branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`);
  expect(c.git('rev-parse', 'HEAD')).toBe(head);
  expect(c.git('branch', '--show-current')).toBe(branch);
  expect(c.git('status', '--porcelain')).toBe(status);
  expect(readFileSync(join(c.root, 'scratch.txt'), 'utf8')).toBe('scratch\n');
  expect(c.git('diff', '--cached')).toBe('');
  expect(existsSync(join(c.root, '.claude'))).toBe(false);

  const U = gitRun(c.remote, 'rev-parse', `upgrade/${v}`).trim();
  expect(gitRun(c.remote, 'rev-parse', U + '^').trim()).toBe(base);
  expect(gitRun(c.remote, 'rev-list', '--count', `${base}..upgrade/${v}`).trim()).toBe('1');

  const p = c.otherClone();
  gitRun(p, 'switch', '-q', `upgrade/${v}`);
  expect(readFileSync(join(p, 'accord/config.yml'), 'utf8')).toContain(`accord: "${v}"`);
  const wf = readFileSync(join(p, '.github/workflows/accord.yml'), 'utf8');
  expect(wf).toContain(`${name}@${v} `);
  expect(wf).not.toContain('@0.0.9');
  const settings = JSON.parse(readFileSync(join(p, '.claude/settings.json'), 'utf8')) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
  const commands = Object.values(settings.hooks).flatMap((es) => es.flatMap((e) => e.hooks.map((h) => h.command)));
  expect(commands.length).toBeGreaterThan(0);
  for (const cmd of commands) expect(cmd).toMatch(new RegExp(`^npx --yes ${name}@${v.replace(/\./g, '\\.')} hook [a-z-]+$`));

  const s = await run(['skills', 'sync'], p);
  expect(s.code, s.err).toBe(0);
  expect(gitRun(p, 'status', '--porcelain')).toBe('');
});

/** A copy of the plain template with the helpers every refusal test uses; the old pin helpers, unchanged. */
function refusing() {
  const c = copy(plain, plainOther);
  const o = c.others[0];
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  const pin = (x: string) => {
    writeFiles(o, { 'accord/config.yml': cfg.replace(/^accord: .*$/m, `accord: "${x}"`) });
    commitMsg(o, 'pin ' + x);
    gitRun(o, 'push', '-q', 'origin', 'main');
  };
  const head = c.git('rev-parse', 'HEAD');
  const refused = async (text: string) => {
    const r = await run(['upgrade'], c.root);
    expect(r.code, r.err).toBe(2);
    expect(r.err).toContain(text);
    expect(c.git('rev-parse', 'HEAD')).toBe(head);
    return r;
  };
  const noBranch = () => expect(gitRun(c.remote, 'for-each-ref', 'refs/heads/upgrade')).toBe('');
  return { c, o, pin, refused, noBranch };
}

it('risk:data-loss upgrade refuses and pushes nothing when the pin is not older', async () => {
  const { pin, refused, noBranch } = refusing();
  await refused(`which is not older than ${v}`);
  noBranch();
  pin('9.9.9');
  await refused(`which is not older than ${v}`);
  noBranch();
});

it('risk:data-loss upgrade refuses and pushes nothing when the upgrade branch exists on origin', async () => {
  const { c, o, pin, refused } = refusing();
  pin('0.0.9');
  gitRun(o, 'push', '-q', 'origin', `HEAD:refs/heads/upgrade/${v}`);
  const before = gitRun(c.remote, 'rev-parse', `upgrade/${v}`);
  await refused('already exists on origin');
  expect(gitRun(c.remote, 'rev-parse', `upgrade/${v}`)).toBe(before);
  gitRun(o, 'push', '-q', 'origin', '--delete', `upgrade/${v}`);
});

it('risk:data-loss upgrade refuses and pushes nothing when the settings are not a JSON object', async () => {
  const { o, pin, refused, noBranch } = refusing();
  pin('0.0.9');
  writeFiles(o, { '.claude/settings.json': '[]\n' });
  commitMsg(o, 'bad settings');
  gitRun(o, 'push', '-q', 'origin', 'main');
  await refused('is not a JSON object');
  noBranch();
});

it('risk:data-loss upgrade refuses and pushes nothing when the default branch would fail lint', async () => {
  const { o, pin, refused, noBranch } = refusing();
  pin('0.0.9');
  writeFiles(o, { 'accord/tickets/ST-9.md': '---\nid: "ST-9"\ntype: nonsense\n---\n' });
  commitMsg(o, 'bad ticket');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await refused('would fail lint');
  expect(r.err).toContain('accord/tickets/ST-9.md');
  noBranch();
});

it('ac-1 upgrade replaces the lint and gate step of a 0.1.0 workflow with the step accord init writes now', async () => {
  const c = copy(plain, plainOther);
  const o = c.others[0];
  const fixture = readFileSync(fileURLToPath(new URL('./fixtures/workflow-0.1.0.yml', import.meta.url)), 'utf8');
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  writeFiles(o, { 'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.1.0"'), '.github/workflows/accord.yml': fixture });
  commitMsg(o, 'pin 0.1.0');
  gitRun(o, 'push', '-q', 'origin', 'main');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe(`branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`);
  expect(r.err).not.toContain('was not refreshed');

  const fresh = initFiles({ name, version: v }).find((f) => f.path === '.github/workflows/accord.yml')!.text;
  const cut = '      - name: lint and gate\n';
  expect(fixture.indexOf(cut)).not.toBe(-1);
  expect(fresh.indexOf(cut)).not.toBe(-1);
  const oldHead = fixture.slice(0, fixture.indexOf(cut)).replace(/@0\.1\.0(?![0-9A-Za-z.+-])/g, `@${v}`);
  const expected = oldHead + fresh.slice(fresh.indexOf(cut));
  if (oldHead === fresh.slice(0, fresh.indexOf(cut))) expect(expected).toBe(fresh);
  const got = gitRun(c.remote, 'show', `upgrade/${v}:.github/workflows/accord.yml`);
  expect(got).toBe(expected);
  const doc = parse(got) as { jobs: Record<string, { steps: { name?: string }[] }> };
  const steps = Object.values(doc.jobs).flatMap((j) => j.steps).filter((s) => s.name === 'lint and gate');
  expect(steps).toHaveLength(1);
});

it('ac-2 upgrade replaces only the lint and gate step and keeps every other line of the workflow', async () => {
  const init09 = initFiles({ name, version: '0.0.9' }).find((f) => f.path === '.github/workflows/accord.yml')!.text;
  const edit = '        working-directory: app\n';
  const shell = '        shell: bash\n';
  expect(init09).toContain(shell);
  const tail = `      # team note about the step\n\n      - name: team check\n        run: echo team\n  extra:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npx --yes ${name}@0.0.9 lint\n`;
  const team = init09.replace(shell, shell + edit) + tail;
  const expectedTeam = team.replace(edit, '').split(`${name}@0.0.9`).join(`${name}@${v}`);

  const crlf = (s: string) => s.replace(/\n/g, '\r\n');

  // The plain and shallow-indent cases live in packages/core/test/scaffold.test.ts (ST-LN-63); this one keeps CRLF end to end.
  const c = copy(plain, plainOther);
  const o = c.others[0];
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  writeFiles(o, {
    'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.0.9"'),
    '.github/workflows/accord.yml': crlf(team),
    '.gitattributes': '* -text\n',
  });
  commitMsg(o, 'pin 0.0.9 crlf');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await run(['upgrade'], c.root);
  expect(r.code, `crlf: ${r.err}`).toBe(0);
  expect(r.out).toBe(`branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`);
  expect(r.err).not.toContain('was not refreshed');
  expect(gitRun(c.remote, 'show', `upgrade/${v}:.github/workflows/accord.yml`), 'crlf').toBe(crlf(expectedTeam));
});

const STEP = '      - name: lint and gate\n';
const init09 = () => initFiles({ name, version: '0.0.9' }).find((f) => f.path === '.github/workflows/accord.yml')!.text;
const repinned = (s: string) => s.split(`${name}@0.0.9`).join(`${name}@${v}`);
async function upgradeOf(input: string) {
  const c = copy(plain, plainOther);
  const o = c.others[0];
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  writeFiles(o, { 'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.0.9"'), '.github/workflows/accord.yml': input });
  commitMsg(o, 'pin 0.0.9');
  gitRun(o, 'push', '-q', 'origin', 'main');
  return { c, r: await run(['upgrade'], c.root) };
}
async function onlyRepinned(input: string, label: string) {
  const { c, r } = await upgradeOf(input);
  expect(r.code, `${label}: ${r.err}`).toBe(0);
  expect(r.out, label).toBe(`branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`);
  expect(gitRun(c.remote, 'show', `upgrade/${v}:.github/workflows/accord.yml`), label).toBe(repinned(input));
  return r;
}

it('risk:performance upgrade stores every file it writes with one git hash-object process', async () => {
  const c = copy(pinned, pinnedOther);
  spawned.hashObject = 0;
  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  const written = gitRun(c.remote, 'diff-tree', '-r', '--name-only', `upgrade/${v}^`, `upgrade/${v}`).trim().split('\n');
  expect(written.length).toBeGreaterThan(10);
  expect(spawned.hashObject).toBe(1);
});

it('ac-3 a workflow with no or two lint and gate steps is only repinned and upgrade warns on stderr', async () => {
  const base = init09();
  const twoJobs = base + '  extra:\n    runs-on: ubuntu-latest\n    steps:\n' + base.slice(base.indexOf(STEP));
  const cases = [
    { label: 'none', input: base.replace('- name: lint and gate', '- name: lint') },
    { label: 'two', input: twoJobs },
  ];
  for (const k of cases) {
    const r = await onlyRepinned(k.input, k.label);
    for (const t of ['.github/workflows/accord.yml', 'lint-and-gate script', 'was not refreshed', 'leave exactly one step named lint and gate and run accord upgrade again']) {
      expect(r.err, k.label).toContain(t);
    }
  }
});

it('risk:complex-branching an anchored lint and gate step is only repinned and the warning says it must be a block list item', async () => {
  const base = init09();
  const k = { label: 'anchored', input: base.replace(STEP, '      - &lint\n        name: lint and gate\n'), shape: true };
  const r = await onlyRepinned(k.input, k.label);
  expect(r.err, k.label).toContain('was not refreshed');
  if (k.shape) {
    expect(r.err, k.label).toContain('.github/workflows/accord.yml');
    expect(r.err, k.label).toContain('must be a block list item without an anchor');
  }
});

it('risk:complex-branching a flow lint and gate step is only repinned and the warning says it must be a block list item', async () => {
  const base = init09();
  const flow = base.slice(0, base.indexOf(STEP)) + `      - { name: lint and gate, run: npx --yes ${name}@0.0.9 lint }\n`;
  const k = { label: 'flow', input: flow, shape: true };
  const r = await onlyRepinned(k.input, k.label);
  expect(r.err, k.label).toContain('was not refreshed');
  if (k.shape) {
    expect(r.err, k.label).toContain('.github/workflows/accord.yml');
    expect(r.err, k.label).toContain('must be a block list item without an anchor');
  }
});

it('risk:complex-branching a lint and gate step whose env another step aliases is only repinned and warns it was not refreshed', async () => {
  const base = init09();
  const env = '        env:\n';
  expect(base).toContain(env);
  const k = { label: 'alias', input: base.replace(env, '        env: &base\n') + '      - name: team step\n        env: *base\n        run: echo team\n', shape: false };
  const r = await onlyRepinned(k.input, k.label);
  expect(r.err, k.label).toContain('was not refreshed');
});

it('risk:complex-branching a step that was not refreshed still gets its warning when the push fails', async () => {
  const c = copy(plain, plainOther);
  const o = c.others[0];
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  writeFiles(o, { 'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.0.9"'), '.github/workflows/accord.yml': init09().replace('- name: lint and gate', '- name: lint') });
  commitMsg(o, 'pin 0.0.9');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const hook = `${c.remote}/hooks/pre-receive`;
  writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  chmodSync(hook, 0o755);
  try {
    const r = await run(['upgrade'], c.root);
    expect(r.code).toBe(2);
    expect(r.out).toBe('');
    for (const t of ['the push failed', 'was not refreshed', 'leave exactly one step named lint and gate']) expect(r.err).toContain(t);
    expect(gitRun(c.remote, 'for-each-ref', 'refs/heads/upgrade')).toBe('');
  } finally {
    rmSync(hook);
  }
});

/** An intact old render of the architect agent: its marker hash is the hash of the text around it. */
function renderedArchitect(): string {
  const head = '---\nname: "accord-architect"\ntools: "Read, Grep, Glob"\nmodel: "opus"\neffort: "high"\n---\n';
  const body = '\nYou propose how a ticket could be built, lightest first.\n';
  return head + '<!-- generated by accord skills sync - do not edit - ' + contentHash(head + body) + ' -->\n' + body;
}

it('risk:data-loss upgrade deletes the retired architect agent only when its marker shows no edit', async () => {
  for (const [text, kept] of [[renderedArchitect(), ''], [renderedArchitect() + 'a hand edit\n', '.claude/agents/accord-architect.md']] as const) {
    const c = copy(pinned, pinnedOther);
    writeFiles(c.others[0], { '.claude/agents/accord-architect.md': text });
    commitMsg(c.others[0], 'architect agent');
    gitRun(c.others[0], 'push', '-q', 'origin', 'main');
    const r = await run(['upgrade'], c.root);
    expect(r.code, r.err).toBe(0);
    expect(gitRun(c.remote, 'ls-tree', '-r', '--name-only', 'upgrade/' + v, '--', '.claude/agents/accord-architect.md').trim()).toBe(kept);
  }
}, 120_000);

// Phase 8.3 D-01: a folded command's folder leaves the upgrade commit's tree file by file, while each file's marker shows no edit; an edited file stays.
it('risk:data-loss accord upgrade removes the intact files of a folded command folder from the tree (D-01)', async () => {
  const held = RETIRED_SKILL_FOLDERS['accord-queue'] ?? [];
  expect(held.length, 'accord-queue has no retire entry').toBeGreaterThan(1);
  const body = '\n# An old queue copy\n';
  const intact = '<!-- generated by accord skills sync - do not edit - ' + contentHash(body) + ' -->\n' + body;
  const paths = ['.claude/skills', '.agents/skills'].flatMap((dir) => held.map((f) => dir + '/accord-queue/' + f));
  const edited = '.claude/skills/accord-queue/SKILL.md';
  for (const [hand, kept] of [[undefined, []], [edited, [edited]]] as const) {
    const c = copy(pinned, pinnedOther);
    writeFiles(c.others[0], Object.fromEntries(paths.map((p) => [p, p === hand ? intact + 'a hand edit\n' : intact])));
    commitMsg(c.others[0], 'old queue folder');
    gitRun(c.others[0], 'push', '-q', 'origin', 'main');
    const r = await run(['upgrade'], c.root);
    expect(r.code, r.err).toBe(0);
    const left = gitRun(c.remote, 'ls-tree', '-r', '--name-only', 'upgrade/' + v, '--', '.claude/skills/accord-queue', '.agents/skills/accord-queue').trim();
    expect(left === '' ? [] : left.split('\n'), String(hand)).toEqual(kept);
  }
}, 120_000);

// ST-LN-96 rel-ac-1, CR-03, WR-08: `accord upgrade` writes `ruleset` into no ticket; the claim fact and the first sync give the rules and the field. The running version is mocked to RULESET_FROM
// and every history pins its own versions, so the cases do not move when a release moves CONFIG's pin.
const OLD = '0.4.1';
const OLDER = '0.4.0';
const APPROVED = 'approved_hash: "fnv1a64:0123456789abcdef"';

/**
 * A clone whose origin/main (pin OLD) holds T-1 (claimed on origin/t/T-1), T-2 (done, with a claim branch), T-3 (no claim branch), T-4 (claimed, already has
 * ruleset), ST-9 (no claim branch), T-6 (a draft on main with a claim branch) and T-5, claimed only on a LOCAL branch made when main still pinned OLDER.
 */
function inFlight(): Clone & { others: string[] } {
  const c = copy(plain, plainOther);
  running.v = RULESET_FROM;
  const o = c.others[0];
  const files: Record<string, string> = { 'accord/config.yml': pinnedConfig(OLDER) };
  // T-1 and T-5 are approved on main (the hash is the approval); T-3 and T-6 are drafts there
  for (const id of ['T-1', 'T-5']) files[P(id)] = laneTicket(id, { frontmatter: [APPROVED] });
  for (const id of ['T-3', 'T-6']) files[P(id)] = laneTicket(id);
  files[P('T-4')] = laneTicket('T-4', { frontmatter: [`ruleset: "${OLD}"`] });
  doneFiles(files, 'T-2');
  writeFiles(o, files);
  const first = commitMsg(o, 'tickets at ' + OLDER);
  writeFiles(o, { 'accord/config.yml': pinnedConfig(OLD) });
  commitMsg(o, 'pin ' + OLD);
  for (const id of ['T-1', 'T-2', 'T-4', 'T-6']) {
    gitRun(o, 'switch', '-q', '-c', 't/' + id, 'main');
    commitMsg(o, 'claim: ' + id, undefined, true);
    gitRun(o, 'push', '-q', 'origin', 't/' + id);
    gitRun(o, 'switch', '-q', 'main');
  }
  gitRun(o, 'push', '-q', 'origin', 'main');
  c.git('pull', '-q', '--ff-only', 'origin', 'main');
  c.git('switch', '-q', '-c', 't/T-5', first);
  commitMsg(c.root, 'claim: T-5', undefined, true);
  c.git('switch', '-q', 'main');
  return c;
}

const onUpgrade = (c: Clone, path: string): string => gitRun(c.remote, 'show', `upgrade/${RULESET_FROM}:${path}`);
const onMain = (c: Clone, path: string): string => gitRun(c.remote, 'show', 'main:' + path);

it('risk:complex-branching accord upgrade writes no ruleset into any ticket, in flight or not (ST-LN-96 rel-ac-1, CR-03, WR-08)', async () => {
  const c = inFlight();
  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe(`branch: upgrade/${RULESET_FROM}
base: main
title: upgrade: accord ${RULESET_FROM}
`);
  expect(r.err).toBe('');
  // every ticket is byte-identical to main's: approved in-flight (T-1, T-5), done, unclaimed, already written, an unapproved draft; the claim fact and the first sync give the rules and the field instead
  for (const id of ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'ST-9']) expect(onUpgrade(c, P(id)), id).toBe(onMain(c, P(id)));
  expect(onUpgrade(c, P('T-4'))).toContain(`ruleset: "${OLD}"`);
  // the same commit moved the pin, and nothing else about the tickets
  expect(onUpgrade(c, 'accord/config.yml')).toContain(`accord: "${RULESET_FROM}"`);
  expect(gitRun(c.remote, 'rev-list', '--count', `main..upgrade/${RULESET_FROM}`).trim()).toBe('1');
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', `upgrade/${RULESET_FROM}`, '--', 'accord/tickets').trim()).toBe('');
});

// CR-03, WR-08 (round 2): a ticket approved on the default branch that is still in flight is on its claim branch too, and that branch keeps appending to the same end of the
// frontmatter (`ac_hash`, `plan_hash`). An upgrade that wrote `ruleset` there conflicted with the branch's next write when the branch took the upgrade in, and put a ticket that is not
// done into the upgrade pull request, where the workflow's gate fails it. The upgrade leaves such a ticket alone; its first sync writes the field into the branch.
it('risk:complex-branching accord upgrade does not touch an approved in-flight ticket, so the branch that took the upgrade in merges without a conflict (CR-03, WR-08)', async () => {
  const c = inFlight();
  c.git('fetch', '-q', 'origin');
  c.git('switch', '-q', '-c', 't/T-1', 'origin/t/T-1');
  const file = join(c.root, P('T-1'));
  writeFileSync(file, setFrontmatterKey(readFileSync(file, 'utf8'), 'ac_hash', 'fnv1a64:fedcba9876543210'));
  commitMsg(c.root, 'gate ready: T-1');
  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  // the branch takes the upgrade in without a conflict on the ticket (git merge-file reported one: base approved_hash, main +ruleset, branch +ac_hash)
  c.git('fetch', '-q', 'origin');
  let merged = true;
  try {
    c.git('merge', '--no-edit', `origin/upgrade/${RULESET_FROM}`);
  } catch {
    merged = false;
    c.git('merge', '--abort');
  }
  expect(merged).toBe(true);
  // and the upgrade pull request carries no ticket that is not done
  const changed = gitRun(c.remote, 'diff', '--name-only', 'main', `upgrade/${RULESET_FROM}`, '--', 'accord/tickets').trim();
  expect(changed).toBe('');
});

// Phase 8.5 D-11, D-01: the upgrade pull request is where old conventions lines are fixed, so the command names each line the default branch holds that accord now withholds, and never the line itself.
const CONVENTIONS = 'accord/product/conventions.md';
const THREE = `branch: upgrade/${v}\nbase: main\ntitle: upgrade: accord ${v}\n`;

it('risk:regression accord upgrade lists each unsafe conventions line of the default branch with its fix (8.5-ac-3 D-11)', async () => {
  const c = copy(pinned, pinnedOther);
  const o = c.others[0];
  const long = `- ${'ZQ'.repeat(150)}`;
  const original = `- A safe rule — enforced by: prose\n${long}\n`;
  writeFiles(o, { [CONVENTIONS]: original });
  commitMsg(o, 'conventions with a long line');
  gitRun(o, 'push', '-q', 'origin', 'main');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe(`${THREE}unsafe line: ${CONVENTIONS}:2: is over 300 characters - fix: split it into lines of at most 300 characters\n`);
  expect(r.out + r.err).not.toContain('ZQZQ');
  // the upgrade itself is untouched by the line: it still pushes, and it leaves the file as it was
  expect(gitRun(c.remote, 'show', `upgrade/${v}:${CONVENTIONS}`)).toBe(original);
});

it('risk:security accord upgrade lists a linked conventions.md as one unsafe file line and prints no byte of its target (8.5-ac-3 D-01)', async () => {
  const c = copy(pinned, pinnedOther);
  const o = c.others[0];
  // a mode 120000 entry whose target leaves the repository, built with plumbing so it runs on every OS
  const folder = mkdtempSync(join(tmpdir(), 'accord-link-'));
  try {
    writeFileSync(join(folder, 'target.txt'), '../secret.txt');
    const oid = gitRun(o, 'hash-object', '-w', join(folder, 'target.txt')).trim();
    gitRun(o, 'update-index', '--add', '--cacheinfo', `120000,${oid},${CONVENTIONS}`);
    writeFileSync(join(folder, 'msg.txt'), 'conventions.md is a link\n');
    gitRun(o, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '-F', join(folder, 'msg.txt'), '--cleanup=verbatim');
  } finally {
    cleanup(folder);
  }
  gitRun(o, 'push', '-q', 'origin', 'main');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe(`${THREE}unsafe file: ${CONVENTIONS}: is a link or not a regular file - fix: replace it with a regular file\n`);
  expect(r.out).not.toContain('unsafe line:');
  expect(r.out + r.err).not.toContain('secret');
});

it('risk:injection accord upgrade lists a line of conventions.md that a comment hides from lint the same as lint does, and never the line (8.5-ac-3 D-11)', async () => {
  const c = copy(pinned, pinnedOther);
  const o = c.others[0];
  const original = ['- A safe rule — enforced by: prose', '<!--', 'Work dir: /etc/hidden', '-->', ''].join('\n');
  writeFiles(o, { [CONVENTIONS]: original });
  commitMsg(o, 'conventions with a reserved line inside a comment');
  gitRun(o, 'push', '-q', 'origin', 'main');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain(`unsafe line: ${CONVENTIONS}:3: `);
  expect(r.out.split('\n').filter((l) => l.startsWith('unsafe line:'))).toHaveLength(1);
  expect(r.out + r.err).not.toContain('/etc/hidden');
});
