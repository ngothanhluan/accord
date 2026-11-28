// Phase 11 G3 (D-12, 11-ac-12): `accord init` and `accord config areas` suggest UI evidence by project type. A browser test tool in package.json is a `proposal: ui.screenshots`
// (tier a, written only by `accord config set`); a web project with none, and an Electron app, get a `suggestion:` line; nothing is installed and no file is written for a suggestion.
// Real git, real init, one sandbox per case; the package.json is tracked, as the detector reads tracked files only.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, commitAll, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

// Every process accord starts through node:child_process is logged by its command, so a case can say that none was npm or npx. The real function still runs.
const spawned = vi.hoisted(() => [] as string[]);
vi.mock('node:child_process', async (orig) => {
  const actual = await orig<typeof import('node:child_process')>();
  const logged =
    <F extends (...a: never[]) => unknown>(fn: F) =>
    (...args: Parameters<F>): ReturnType<F> => {
      spawned.push(String(args[0]));
      return fn(...args) as ReturnType<F>;
    };
  return { ...actual, execFileSync: logged(actual.execFileSync), execSync: logged(actual.execSync), spawnSync: logged(actual.spawnSync), spawn: logged(actual.spawn), execFile: logged(actual.execFile), exec: logged(actual.exec) };
});

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

/** A sandbox git repository holding `files`, committed so `git ls-files` lists them. */
function repoWith(files: Record<string, string>): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, files);
  commitAll(repo);
  return repo;
}

const pkg = (deps: Record<string, string>, kind: 'devDependencies' | 'dependencies' = 'devDependencies'): string => JSON.stringify({ name: 'fixture', [kind]: deps }) + '\n';
const lines = (out: string, prefix: string): string[] => out.split('\n').filter((l) => l.startsWith(prefix));

const PLAYWRIGHT = 'proposal: ui.screenshots = "ACCORD_EVIDENCE={dir} npx playwright test --grep @ui"  (evidence: package.json lists @playwright/test)';

describe('accord init proposes ui.screenshots from a browser test tool', () => {
  it('risk:regression init proposes ui.screenshots where @playwright/test is listed and writes nothing (11-ac-12, D-12)', async () => {
    const repo = repoWith({ 'package.json': pkg({ '@playwright/test': '1.50.0' }) });
    const { code, out, err } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
    const rows = out.split('\n');
    const at = rows.indexOf(PLAYWRIGHT);
    expect(at, 'the proposal line is printed').toBeGreaterThan(-1);
    const closing = rows.findIndex((l) => l.startsWith('proposals:'));
    expect(closing, 'the proposal comes before the closing line').toBeGreaterThan(at);
    expect(readFileSync(join(repo, 'accord', 'config.yml'), 'utf8')).not.toMatch(/^ui:/m);
  });

  it('risk:regression config areas integrations lists that proposal under key ui (11-ac-12, D-12)', async () => {
    const repo = repoWith({ 'package.json': pkg({ '@playwright/test': '1.50.0' }) });
    await run(['init'], repo);
    const { code, out } = await run(['config', 'areas', 'integrations'], repo);
    expect(code).toBe(0);
    const rows = out.split('\n');
    const key = rows.findIndex((l) => l.startsWith('  ui = '));
    expect(key, 'the ui key is listed').toBeGreaterThan(-1);
    expect(rows[key + 1]).toBe('  ' + PLAYWRIGHT);
  });

  it('risk:regression cypress and webdriverio each propose their own command (11-ac-12, D-12)', async () => {
    const cypress = repoWith({ 'package.json': pkg({ cypress: '13.0.0' }) });
    const c = await run(['init'], cypress);
    expect(lines(c.out, 'proposal: ui.screenshots')).toEqual(['proposal: ui.screenshots = "ACCORD_EVIDENCE={dir} npx cypress run"  (evidence: package.json lists cypress)']);

    const wdio = repoWith({ 'package.json': pkg({ '@wdio/cli': '9.0.0' }), 'wdio.conf.ts': 'export const config = {};\n' });
    const w = await run(['init'], wdio);
    expect(lines(w.out, 'proposal: ui.screenshots')).toEqual(['proposal: ui.screenshots = "ACCORD_EVIDENCE={dir} npx wdio run ./wdio.conf.ts"  (evidence: package.json lists @wdio/cli)']);

    const bare = repoWith({ 'package.json': pkg({ webdriverio: '9.0.0' }) });
    const b = await run(['init'], bare);
    expect(lines(b.out, 'proposal: ui.screenshots'), 'a wdio package with no tracked wdio.conf file gets no command to guess').toEqual([]);
  });

  it('risk:regression a repository with ui.screenshots already set gets no proposal (11-ac-12, D-12)', async () => {
    const repo = repoWith({ 'package.json': pkg({ '@playwright/test': '1.50.0' }) });
    await run(['init'], repo);
    const set = await run(['config', 'set', 'ui.screenshots', 'npm run shots'], repo);
    expect(set.code).toBe(0);
    const again = await run(['init'], repo);
    expect(lines(again.out, 'proposal: ui.screenshots')).toEqual([]);
  });

  it('risk:parsing a package.json that is not JSON gives no proposal and no failure (11-ac-12, D-12)', async () => {
    const repo = repoWith({ 'package.json': '{ "devDependencies": { "@playwright/test": ' });
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out, 'proposal: ui.screenshots')).toEqual([]);
  });
});

const SUGGEST = 'suggestion: ui: ';
const WEB = { 'package.json': pkg({ react: '19.0.0' }, 'dependencies') };
const ELECTRON = { 'package.json': pkg({ electron: '33.0.0' }) };
const FALLBACK_WORDS = ["a person's screenshots (tier manual)", "the owner's check"];
const everyFile = (root: string): string[] =>
  readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => f !== '.git' && !f.startsWith('.git/'))
    .sort();

describe('accord init suggests a UI evidence tool by project type', () => {
  it('risk:regression a web project with no browser test tool gets one browser-tool suggestion and the manual fallback, between the proposals and the closing line (11-ac-12, D-12)', async () => {
    // the README link gives init a real proposal line, so the order against it can be asserted
    const repo = repoWith({ ...WEB, 'README.md': 'tracked in https://linear.app/team\n' });
    const { code, out, err } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
    const rows = out.split('\n');
    const proposal = rows.findIndex((l) => l.startsWith('proposal: tracker'));
    const closing = rows.findIndex((l) => l.startsWith('proposals:'));
    const suggestions = lines(out, 'suggestion:');
    expect(suggestions).toHaveLength(2);
    const [browser, fallback] = suggestions;
    expect(browser.startsWith(SUGGEST)).toBe(true);
    for (const word of ['@playwright/cli', 'agent-browser', 'the verifier', 'ui.build', 'ui.review', 'no MCP setup', "installs nothing without the owner's yes", '(evidence: package.json lists react)']) {
      expect(browser, `the browser line says ${word}`).toContain(word);
    }
    expect(browser).not.toMatch(/ npx | npm |--/); // no command of either candidate is printed: agent-browser's flags are unverified
    for (const word of [...FALLBACK_WORDS, '(evidence: package.json lists react)']) expect(fallback, `the fallback line says ${word}`).toContain(word);
    const at = (line: string): number => rows.indexOf(line);
    expect(proposal, 'the README link gives a tracker proposal').toBeGreaterThan(-1);
    expect(at(browser), 'after the proposal line').toBeGreaterThan(proposal);
    expect(at(fallback)).toBeGreaterThan(at(browser));
    expect(closing, 'before the closing line').toBeGreaterThan(at(fallback));
    expect(rows.filter((l) => l.startsWith('proposal:') && l.includes('suggestion')), 'a suggestion is never a proposal line').toEqual([]);
  });

  it('risk:regression an Electron project gets the desktop tool with its warning and the manual fallback (11-ac-12, D-12)', async () => {
    const repo = repoWith(ELECTRON);
    const { out } = await run(['init'], repo);
    const [desktop, fallback, ...rest] = lines(out, 'suggestion:');
    expect(rest).toEqual([]);
    expect(desktop.startsWith(SUGGEST)).toBe(true);
    for (const word of ['agent-desktop', 'Vercel Labs', 'controls the whole machine', 'does not suit CI', "installs nothing without the owner's yes", '(evidence: package.json lists electron)']) {
      expect(desktop, `the desktop line says ${word}`).toContain(word);
    }
    expect(desktop).not.toContain('@playwright/cli');
    for (const word of FALLBACK_WORDS) expect(fallback).toContain(word);
  });

  it('risk:regression a tier a proposal, no package.json, or a webdriverio project with no config file change the suggestions as D-12 says (11-ac-12, D-12)', async () => {
    const tierA = repoWith({ 'package.json': pkg({ react: '19.0.0', '@playwright/test': '1.50.0' }) });
    expect(lines((await run(['init'], tierA)).out, 'suggestion:'), 'a tier a proposal needs neither the browser line nor the fallback').toEqual([]);

    const none = repoWith({ 'README.md': 'no package.json here\n' });
    expect(lines((await run(['init'], none)).out, 'suggestion:'), 'no package.json, no suggestion').toEqual([]);

    const plain = repoWith({ 'package.json': pkg({ lodash: '4.0.0' }) });
    expect(lines((await run(['init'], plain)).out, 'suggestion:'), 'a project that is neither web nor desktop gets none').toEqual([]);

    const wdio = repoWith({ 'package.json': pkg({ react: '19.0.0', webdriverio: '9.0.0' }) });
    const w = lines((await run(['init'], wdio)).out, 'suggestion:');
    expect(w, 'a browser test tool is there but no command can be proposed: only the fallback').toHaveLength(1);
    for (const word of FALLBACK_WORDS) expect(w[0]).toContain(word);
  });

  it('risk:regression accord config areas integrations prints the same suggestion lines under the ui key, and the json form lists them (11-ac-12, D-12)', async () => {
    const repo = repoWith(WEB);
    const init = lines((await run(['init'], repo)).out, 'suggestion:');
    expect(init.length).toBeGreaterThan(0);
    const text = await run(['config', 'areas', 'integrations'], repo);
    expect(text.code).toBe(0);
    const rows = text.out.split('\n');
    const ui = rows.findIndex((l) => l.startsWith('  ui = '));
    expect(ui).toBeGreaterThan(-1);
    expect(rows.slice(ui + 1, ui + 1 + init.length)).toEqual(init.map((l) => '  ' + l));
    const json = JSON.parse((await run(['config', 'areas', 'integrations', '--json'], repo)).out) as { areas: { keys: { key: string; suggestions?: { text: string; evidence: string }[] }[] }[] };
    const key = json.areas[0].keys.find((k) => k.key === 'ui');
    expect(key?.suggestions).toHaveLength(init.length);
    const other = await run(['config', 'areas', 'git'], repo);
    expect(other.out, 'other areas print no suggestion').not.toContain('suggestion:');
  });

  it('risk:security nothing is installed without a yes: init and config areas start no npm or npx process and write no file for a suggestion (11-ac-12, D-12)', async () => {
    for (const files of [WEB, ELECTRON]) {
      const repo = repoWith(files);
      const control = repoWith({ 'package.json': pkg({ lodash: '4.0.0' }) });
      spawned.length = 0;
      await run(['init'], repo);
      await run(['config', 'areas'], repo);
      const commands = spawned.map((c) => basename(c).toLowerCase().replace(/\.(cmd|exe|bat|ps1)$/, ''));
      expect(commands.filter((c) => ['npm', 'npx', 'node', 'pnpm', 'yarn', 'bun'].includes(c)), 'no package manager is started').toEqual([]);
      expect(commands, 'the command log is live: git ran').toContain('git');
      await run(['init'], control);
      expect(everyFile(repo), 'the files init writes are the same with or without a suggestion').toEqual(everyFile(control));
      expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(files['package.json']);
    }
  });

  it('risk:security a package.json over 1 MiB is read bounded and gives no suggestion and no failure (11-ac-12, D-12)', async () => {
    const huge = '{ "dependencies": { "react": "19.0.0" }, "pad": "' + 'x'.repeat(1024 * 1024 + 10) + '" }\n';
    const repo = repoWith({ 'package.json': huge });
    const { code, out, err } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(lines(out, 'suggestion:')).toEqual([]);
  });

  it('risk:regression the onboarding skill shows suggestion lines verbatim, walks no setting for them, and stays inside its caps (11-ac-12, D-12)', () => {
    const source = readFileSync(new URL('../../core/skills/onboard/SKILL.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const rendered = readFileSync(new URL('../../../.claude/skills/accord-onboard/SKILL.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    for (const text of [source, rendered]) {
      const flat = text.replace(/\s+/g, ' ');
      expect(flat).toContain('`suggestion:`');
      expect(flat).toContain('verbatim');
      expect(flat).toMatch(/no `proposal:`/);
      expect(flat).toMatch(/walk(s)? no setting for (it|them)/);
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(6000);
      expect(text.split('\n').length).toBeLessThanOrEqual(120);
    }
  });
});
