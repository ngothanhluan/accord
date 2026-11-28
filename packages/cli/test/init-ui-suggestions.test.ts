// Phase 11 G3 (D-12, 11-ac-12): `accord init` and `accord config areas` suggest UI evidence by project type. A browser test tool in package.json is a `proposal: ui.screenshots`
// (tier a, written only by `accord config set`); a web project with none, and an Electron app, get a `suggestion:` line; nothing is installed and no file is written for a suggestion.
// Real git, real init, one sandbox per case; the package.json is tracked, as the detector reads tracked files only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, commitAll, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

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
