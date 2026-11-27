// Phase 11 G1 (D-01, D-02, D-17): every write path of accord keeps and guards the `agents:` additions. `accord upgrade` keeps them and refuses
// a locked entry through its lint guard, `accord init` refuses one before its first byte, `accord config set` writes each key, and
// `accord skills sync` notes a skill that no skills folder holds (RESEARCH Pitfall 3).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { loadConfig } from '@accord-dev/accord-core';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, makeRepo, run, writeFiles } from './helpers/repo.js';
import { copyClone, makeTemplate } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';
import pkg from '../package.json' with { type: 'json' };

const v = pkg.version;
const EXECUTOR = '.claude/agents/accord-executor.md';
const REVIEWER = '.claude/agents/accord-reviewer.md';
const frontmatter = (text: string): Record<string, unknown> => parse(text.replace(/\r\n/g, '\n').split('---\n')[1] as string) as Record<string, unknown>;

const clones: Clone[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const c of clones.splice(0)) c.cleanupAll();
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

let plain: Clone;
let plainOther: string;
beforeAll(() => {
  plain = makeTemplate();
  plainOther = plain.otherClone();
  gitRun(plainOther, 'config', 'gc.auto', '0');
}, 120_000);
afterAll(() => plain.cleanupAll());

/** A clone whose default branch is pinned to an older accord and holds `agentsYaml` in its config; the checkout under test is the clone's own. */
function pinnedClone(agentsYaml: string) {
  const c = copyClone(plain, [plainOther]);
  clones.push(c);
  const o = c.others[0] as string;
  const cfg = readFileSync(join(o, 'accord/config.yml'), 'utf8');
  writeFiles(o, { 'accord/config.yml': cfg.replace(/^accord: .*$/m, 'accord: "0.0.9"') + agentsYaml });
  commitMsg(o, 'pin 0.0.9 with agents');
  gitRun(o, 'push', '-q', 'origin', 'main');
  return c;
}

/** Every file and folder under `repo` outside `.git`, with its bytes and mtime, so a write, a touch or a new file all show. */
function tree(repo: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(repo, { recursive: true, withFileTypes: true })) {
    const file = join(e.parentPath, e.name);
    const rel = file.slice(repo.length);
    if (rel.split(/[\\/]/)[1] === '.git') continue;
    out[rel] = e.isFile() ? String(statSync(file).mtimeMs) + ':' + readFileSync(file).toString('base64') : 'dir';
  }
  return out;
}

it('risk:regression accord upgrade keeps agents.executor.mcp and agents.reviewer.skills in the rendered agent files, and a sync right after reports no change (11-ac-1, D-01)', async () => {
  const c = pinnedClone('agents:\n  executor:\n    mcp: [playwright]\n  reviewer:\n    skills: [x]\n');
  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain(`branch: upgrade/${v}`);

  const p = c.otherClone();
  clones.push({ ...c, cleanupAll: () => cleanup(p) });
  gitRun(p, 'switch', '-q', `upgrade/${v}`);
  const config = readFileSync(join(p, 'accord/config.yml'), 'utf8');
  expect(config).toContain(`accord: "${v}"`);
  expect(config).toContain('mcp: [playwright]');
  const executor = frontmatter(readFileSync(join(p, EXECUTOR), 'utf8'));
  expect(executor.mcpServers).toEqual(['playwright']);
  expect(String(executor.tools).endsWith('mcp__playwright__*')).toBe(true);
  expect(frontmatter(readFileSync(join(p, REVIEWER), 'utf8')).skills).toEqual(['x']);

  const s = await run(['skills', 'sync'], p);
  expect(s.code, s.err).toBe(0);
  expect(s.out).toContain('unchanged ' + EXECUTOR);
  expect(s.out).toContain('unchanged ' + REVIEWER);
  expect(s.out.split('\n').filter((l) => /^(created|updated|overwrote local edits) /.test(l))).toEqual([]);
  expect(gitRun(p, 'status', '--porcelain')).toBe('');
});

it('risk:security accord upgrade refuses a locked tool through lint.agents-config and writes nothing: no branch, no commit, no file (D-02)', async () => {
  const c = pinnedClone('agents:\n  reviewer:\n    tools: [Write]\n');
  const head = c.git('rev-parse', 'HEAD');
  const status = c.git('status', '--porcelain');
  const before = tree(c.root);

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(2);
  expect(r.err).toContain('lint.agents-config');
  expect(r.err).toContain('agents.reviewer');
  expect(r.err).toContain('Write');
  expect(gitRun(c.remote, 'for-each-ref', 'refs/heads/upgrade')).toBe('');
  expect(c.git('rev-parse', 'HEAD')).toBe(head);
  expect(c.git('status', '--porcelain')).toBe(status);
  expect(tree(c.root)).toEqual(before);
});

it('risk:security accord upgrade refuses an inline stdio server the same way and writes nothing (D-17)', async () => {
  const c = pinnedClone('agents:\n  executor:\n    mcp:\n      - local: { type: stdio, command: node }\n');
  const before = tree(c.root);
  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(2);
  expect(r.err).toContain('lint.agents-config');
  expect(r.err).toContain('agents.executor');
  expect(r.err).toContain('local');
  expect(gitRun(c.remote, 'for-each-ref', 'refs/heads/upgrade')).toBe('');
  expect(tree(c.root)).toEqual(before);
});

it('risk:security accord init refuses an inline stdio server in an existing config, naming the role and the entry, and writes no byte (D-02, D-17)', async () => {
  const repo = makeRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'agents:\n  executor:\n    mcp:\n      - local: { type: stdio, command: node }\n' });
  const before = tree(repo);

  const r = await run(['init'], repo);
  expect(r.code, r.err).toBe(2);
  expect(r.err).toContain('agents.executor');
  expect(r.err).toContain('local');
  expect(r.err).toContain('nothing was written');
  expect(tree(repo)).toEqual(before);
});

it('risk:security accord init refuses a locked tool in an existing config and writes no byte (D-02)', async () => {
  const repo = makeRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'agents:\n  critic:\n    tools: [Bash]\n' });
  const before = tree(repo);
  const r = await run(['init'], repo);
  expect(r.code, r.err).toBe(2);
  expect(r.err).toContain('agents.critic');
  expect(r.err).toContain('Bash');
  expect(tree(repo)).toEqual(before);
});

it('risk:regression accord config set writes agents.reviewer.mcp, agents.reviewer.final.skills and agents.executor.tools one key at a time, each passing its schema, and refuses an unknown role (11-ac-1, D-01)', async () => {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  const file = join(repo, 'accord', 'config.yml');
  const read = (): Record<string, unknown> => parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

  for (const [key, value] of [
    ['agents.reviewer.mcp', '[docs]'],
    ['agents.reviewer.final.skills', '[y]'],
    ['agents.executor.tools', '[WebFetch]'],
  ] as const) {
    const r = await run(['config', 'set', key, value], repo);
    expect(r.code, key + ': ' + r.err).toBe(0);
    expect(loadConfig('accord/config.yml', readFileSync(file, 'utf8')).config, key).toBeDefined();
    expect((await run(['lint'], repo)).code, key).toBe(0);
  }
  // `reviewer.final` is one key of its own under `agents`, as under `models`, not a `final` key nested in `reviewer`
  expect(read().agents).toEqual({ reviewer: { mcp: ['docs'] }, 'reviewer.final': { skills: ['y'] }, executor: { tools: ['WebFetch'] } });

  const bytes = readFileSync(file, 'utf8');
  const unknown = await run(['config', 'set', 'agents.judge.mcp', '[docs]'], repo);
  expect(unknown.code).toBe(2);
  expect(readFileSync(file, 'utf8')).toBe(bytes);
});

/** A repository whose reviewer preloads `skills`, a fixture config folder standing for the person's `~/.claude`, and the sync run against both. */
async function syncWith(skills: string, layout: (repo: string, home: string) => void = () => undefined) {
  const repo = makeRepo();
  dirs.push(repo);
  const home = mkdtempSync(join(tmpdir(), 'accord-home-'));
  dirs.push(home);
  writeFiles(repo, { 'accord/config.yml': CONFIG + `agents:\n  reviewer:\n    skills: [${skills}]\n` });
  layout(repo, home);
  const r = await run(['skills', 'sync'], repo, { CLAUDE_CONFIG_DIR: home });
  return { ...r, notes: r.out.split('\n').filter((l) => l.startsWith('note: agents.')) };
}
const put = (path: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '---\nname: x\n---\n');
};

it('risk:regression skills sync prints one note for a skill name no skills folder holds, and still exits 0 (Pitfall 3)', async () => {
  const r = await syncWith('impecable');
  expect(r.code, r.err).toBe(0);
  expect(r.notes).toEqual(['note: agents.reviewer.skills: "impecable" is in no skills folder of this repository or user; Claude Code skips a missing skill without an error']);
  expect(r.out).toContain('created ' + REVIEWER);
});

it('risk:regression skills sync names agents.reviewer.final.skills for a missing skill of the final reviewer (Pitfall 3, R3)', async () => {
  const repo = makeRepo();
  dirs.push(repo);
  const home = mkdtempSync(join(tmpdir(), 'accord-home-'));
  dirs.push(home);
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'agents:\n  reviewer.final:\n    skills: [gone]\n' });
  const r = await run(['skills', 'sync'], repo, { CLAUDE_CONFIG_DIR: home });
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain('note: agents.reviewer.final.skills: "gone" is in no skills folder');
});

it('risk:regression a plugin-prefixed name is not checked, and neither is a real skill in the repository, the user folder or a plugin folder in the probe layout (Pitfall 3, 11-A2-PROBE)', async () => {
  expect((await syncWith('"impeccable:impeccable"')).notes).toEqual([]);
  expect((await syncWith('local', (repo) => put(join(repo, '.claude', 'skills', 'local', 'SKILL.md')))).notes).toEqual([]);
  expect((await syncWith('mine', (_repo, home) => put(join(home, 'skills', 'mine', 'SKILL.md')))).notes).toEqual([]);
  // the layout 11-A2-PROBE.md records: a plugin's own skills folder, and the `.claude/skills` folder of a plugin
  const cache = (home: string, ...rest: string[]): string => join(home, 'plugins', 'cache', ...rest);
  expect((await syncWith('impeccable', (_repo, home) => put(cache(home, 'impeccable', 'impeccable', '4.8.0', 'skills', 'impeccable', 'SKILL.md')))).notes).toEqual([]);
  expect(
    (await syncWith('ui-ux-pro-max', (_repo, home) => put(cache(home, 'ui-ux-pro-max-skill', 'ui-ux-pro-max', '2.15.0', '.claude', 'skills', 'ui-ux-pro-max', 'SKILL.md')))).notes,
  ).toEqual([]);
  expect((await syncWith('impeccable', (_repo, home) => put(join(home, 'plugins', 'marketplaces', 'impeccable', '.claude', 'skills', 'impeccable', 'SKILL.md')))).notes).toEqual([]);
  // a folder with no SKILL.md is not a skill
  expect((await syncWith('empty', (_repo, home) => mkdirSync(join(home, 'skills', 'empty'), { recursive: true }))).notes).toHaveLength(1);
});
