// Phase 11 G3 (D-07, 11-ac-8): `accord brief` of a `ui: true` ticket names the second executor, `agent: accord-executor-ui`, when `ui.build` is set, so the session dispatches the executor
// that carries the repository's build skill; a `ui: false` ticket, and a repository with no `ui.build`, print no `agent:` line and the brief is what it is today.
// Skill-name form (11-A2-PROBE.md, `Use: both`): each case runs with the bare name and with the plugin name.
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { parse } from 'yaml';
import { claimedUnder, cleanup, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const FORMS = ['impeccable', 'impeccable:impeccable'] as const;
const FINDINGS = ['1. src/export.ts:3 - the header row is dropped.'];

const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) cleanup(folders.pop() as string);
});

const uiTicket = (): string => laneTicket('T-1').replace('ui: false', 'ui: true');

/** A lane M sandbox with a plan task; `ui` is the text of the `ui:` block of config.yml (none when empty), `ticket` the text of T-1. */
function sandbox(ui: string, ticket = uiTicket()): string {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + ui, 'accord/tickets/T-1.md': ticket });
  folders.push(repo);
  claimedUnder(repo, CONFIG.match(/accord: "([^"]*)"/)?.[1] as string);
  return repo;
}

/** A brief with the sandbox's own folder (the `Work dir:` it prints) replaced by a token, so two sandboxes compare equal. */
const neutral = (text: string): string => {
  const dir = /^Work dir: (.+)$/m.exec(text)?.[1];
  return dir === undefined ? text : text.split(dir).join('<repo>');
};

const buildBlock = (form: string): string => `ui:\n  build: ${form}\n`;
const AGENT_LINE = /^agent: (.+)$/m;

/** A findings file outside the sandbox, as a skill writes it. */
function findingsFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'accord-ui-findings-'));
  folders.push(dir);
  const file = join(dir, 'findings.md');
  writeFileSync(file, FINDINGS.join('\n') + '\n');
  return file;
}

describe('accord brief names accord-executor-ui for a ui: true ticket (11-ac-8, D-07)', () => {
  for (const form of FORMS) {
    it(`risk:regression ui.build ${form} makes the brief of a ui: true task print agent: accord-executor-ui after its file: line (11-ac-8, D-07)`, async () => {
      const repo = sandbox(buildBlock(form));
      const r = await run(['brief', 'T-1', '1', '--out', 'brief-1.md'], repo);
      expect(r.code, r.err).toBe(0);
      expect(r.out).toMatch(/^file: .+\/\.accord-reports\/T-1\/brief-1\.md\nagent: accord-executor-ui\n$/);

      // the brief file's text is what it is without the ui: config
      const plainRepo = sandbox('');
      const plain = await run(['brief', 'T-1', '1', '--out', 'brief-1.md'], plainRepo);
      expect(plain.code, plain.err).toBe(0);
      const text = (repoPath: string): string => readFileSync(join(repoPath, '.accord-reports', 'T-1', 'brief-1.md'), 'utf8');
      expect(neutral(text(repo))).toBe(neutral(text(plainRepo)));
    }, 120_000);
  }

  it('risk:regression the agent line follows the brief text when no --out is given, and the brief before it is unchanged (11-ac-8, D-07)', async () => {
    const repo = sandbox(buildBlock('impeccable'));
    const withAgent = await run(['brief', 'T-1', '1'], repo);
    expect(withAgent.code, withAgent.err).toBe(0);
    expect(withAgent.out.endsWith('\nagent: accord-executor-ui\n')).toBe(true);
    const plainRepo = sandbox('');
    const plain = await run(['brief', 'T-1', '1'], plainRepo);
    expect(neutral(withAgent.out.replace(/agent: accord-executor-ui\n$/, ''))).toBe(neutral(plain.out));
  }, 120_000);

  it('risk:regression a --fix brief of a ui: true ticket names the same agent (11-ac-8, D-07)', async () => {
    const repo = sandbox(buildBlock('impeccable'));
    const r = await run(['brief', 'T-1', '--fix', findingsFile(), '--out', 'fix-brief.md'], repo);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toMatch(/^file: .+\/\.accord-reports\/T-1\/fix-brief\.md\nagent: accord-executor-ui\n$/);
  }, 120_000);

  it('risk:regression a ui: false ticket prints no agent line, and nor does a ui: true ticket with no ui.build (11-ac-8, D-07)', async () => {
    const notUi = sandbox(buildBlock('impeccable'), laneTicket('T-1'));
    for (const args of [['brief', 'T-1', '1'], ['brief', 'T-1', '1', '--out', 'b.md']]) {
      const r = await run(args, notUi);
      expect(r.code, r.err).toBe(0);
      expect(r.out).not.toMatch(AGENT_LINE);
    }
    const fix = await run(['brief', 'T-1', '--fix', findingsFile()], notUi);
    expect(fix.code, fix.err).toBe(0);
    expect(fix.out).not.toMatch(AGENT_LINE);

    // no ui.build: ui.review, ui.direction and ui.screenshots alone name no executor
    for (const block of ['', 'ui:\n  review: impeccable\n', 'ui:\n  direction: ui-ux-pro-max\n  screenshots: npx playwright test\n']) {
      const repo = sandbox(block);
      const r = await run(['brief', 'T-1', '1'], repo);
      expect(r.code, r.err).toBe(0);
      expect(r.out).not.toMatch(AGENT_LINE);
      const out = await run(['brief', 'T-1', '1', '--out', 'b.md'], repo);
      expect(out.out).toMatch(/^file: [^\n]+\n$/);
    }
  }, 120_000);
});

const EXECUTOR_UI = '.claude/agents/accord-executor-ui.md';
const REVIEWER_UI = '.claude/agents/accord-reviewer-ui.md';
const at = (repo: string, path: string): string => join(repo, ...path.split('/'));
const frontmatter = (text: string): Record<string, unknown> => parse(text.split('---\n')[1] as string) as Record<string, unknown>;

/** A bare repository holding only accord/config.yml, for the sync and config set cases. */
function configOnly(config = CONFIG): string {
  const repo = makeEmptyRepo();
  folders.push(repo);
  writeFiles(repo, { 'accord/config.yml': config });
  return repo;
}

describe('accord skills sync renders the UI agents and drops them with their keys (11-ac-8, D-07, R17)', () => {
  for (const form of FORMS) {
    it(`risk:regression ui.build and ui.review ${form} render accord-executor-ui and accord-reviewer-ui, and a second sync changes nothing (11-ac-8, D-07)`, async () => {
      const repo = configOnly(CONFIG + `ui:\n  build: ${form}\n  review: ${form}\n`);
      const first = await run(['skills', 'sync'], repo);
      expect(first.code, first.err).toBe(0);
      expect(first.out).toContain('created ' + EXECUTOR_UI);
      expect(first.out).toContain('created ' + REVIEWER_UI);
      expect(frontmatter(readFileSync(at(repo, EXECUTOR_UI), 'utf8')).skills).toEqual([form]);
      expect(frontmatter(readFileSync(at(repo, REVIEWER_UI), 'utf8')).skills).toEqual([form]);
      expect(frontmatter(readFileSync(at(repo, '.claude/agents/accord-executor.md'), 'utf8')).skills).toBeUndefined();
      expect(frontmatter(readFileSync(at(repo, '.claude/agents/accord-reviewer.md'), 'utf8')).skills).toBeUndefined();
      for (const judge of ['accord-judge', 'accord-foreign-reviewer']) {
        expect(frontmatter(readFileSync(at(repo, `.claude/agents/${judge}.md`), 'utf8')).skills, judge).toBeUndefined();
      }
      const before = [EXECUTOR_UI, REVIEWER_UI].map((f) => statSync(at(repo, f)).mtimeMs);
      const second = await run(['skills', 'sync'], repo);
      expect(second.code, second.err).toBe(0);
      expect(second.out).toContain('unchanged ' + EXECUTOR_UI);
      expect(second.out).toContain('unchanged ' + REVIEWER_UI);
      expect([EXECUTOR_UI, REVIEWER_UI].map((f) => statSync(at(repo, f)).mtimeMs)).toEqual(before);
    }, 120_000);
  }

  it('risk:regression with no ui key no variant file is written (11-ac-8, D-07)', async () => {
    const repo = configOnly();
    const r = await run(['skills', 'sync'], repo);
    expect(r.code, r.err).toBe(0);
    expect(existsSync(at(repo, EXECUTOR_UI))).toBe(false);
    expect(existsSync(at(repo, REVIEWER_UI))).toBe(false);
    expect(r.out).not.toContain('-ui.md');
  }, 120_000);

  it('risk:regression a dropped ui.build leaves no variant rendered and the next sync lists the old file as no longer rendered (11-ac-8, D-07, R17)', async () => {
    const repo = configOnly(CONFIG + 'ui:\n  build: impeccable\n  review: impeccable\n');
    expect((await run(['skills', 'sync'], repo)).code).toBe(0);
    const kept = readFileSync(at(repo, EXECUTOR_UI), 'utf8');
    writeFiles(repo, { 'accord/config.yml': CONFIG + 'ui:\n  review: impeccable\n' });
    const second = await run(['skills', 'sync'], repo);
    expect(second.code, second.err).toBe(0);
    // the executor variant is not rendered, so no row is written for it; accord deletes no orphan and says so on stderr
    expect(second.out).not.toContain(EXECUTOR_UI);
    expect(second.err).toContain('orphan ' + EXECUTOR_UI);
    expect(second.err).not.toContain(REVIEWER_UI);
    expect(readFileSync(at(repo, EXECUTOR_UI), 'utf8')).toBe(kept);
    expect(second.out).toContain('unchanged ' + REVIEWER_UI);
  }, 120_000);
});

describe('accord config set writes the ui keys and refuses a bad value (11-ac-8, D-07)', () => {
  const text = (repo: string): string => readFileSync(join(repo, 'accord', 'config.yml'), 'utf8');

  for (const form of FORMS) {
    it(`risk:regression config set ui.build and ui.review ${form} write a config that lints (11-ac-8, D-07)`, async () => {
      const repo = configOnly();
      for (const key of ['ui.build', 'ui.review']) {
        const r = await run(['config', 'set', key, form], repo);
        expect(r.code, r.err).toBe(0);
        expect(r.out).toBe(`changed: ${key} unset -> ${form}\n`);
      }
      const config = parse(text(repo)) as { ui: Record<string, string> };
      expect(config.ui).toEqual({ build: form, review: form });
      expect((await run(['lint'], repo)).code).toBe(0);
    }, 120_000);
  }

  it('risk:regression config set ui.direction and ui.screenshots write a config that lints (11-ac-8, D-07)', async () => {
    const repo = configOnly();
    expect((await run(['config', 'set', 'ui.direction', 'ui-direction-skill'], repo)).code).toBe(0);
    const shot = await run(['config', 'set', 'ui.screenshots', 'npx playwright test --grep @ui'], repo);
    expect(shot.code, shot.err).toBe(0);
    expect((parse(text(repo)) as { ui: Record<string, string> }).ui).toEqual({ direction: 'ui-direction-skill', screenshots: 'npx playwright test --grep @ui' });
    expect((await run(['lint'], repo)).code).toBe(0);
    // {dir} is a placeholder the command may hold
    const dir = await run(['config', 'set', 'ui.screenshots', 'npx playwright test --output {dir}'], repo);
    expect(dir.code, dir.err).toBe(0);
    expect((await run(['lint'], repo)).code).toBe(0);
  }, 120_000);

  it('risk:parsing a skill name with a space, a capital, a slash or a line break, and a screenshots command with a line break, are refused and the file is untouched (11-ac-8, D-07)', async () => {
    const repo = configOnly();
    const before = text(repo);
    for (const [key, value] of [
      ['ui.build', 'two words'],
      ['ui.build', 'Impeccable'],
      ['ui.review', 'a/b'],
      ['ui.direction', '../x'],
      ['ui.build', 'x'.repeat(65)],
      ['ui.screenshots', 'first\nsecond'],
      ['ui.screenshots', 'first\r\nsecond'],
    ] as const) {
      const r = await run(['config', 'set', key, value], repo);
      expect(r.code, `${key} ${JSON.stringify(value)}`).toBe(2);
      expect(r.err).toContain('accord/config.yml was not changed');
      expect(text(repo)).toBe(before);
    }
    // a hand-written config with a line break in the command is a schema finding, not a config
    writeFiles(repo, { 'accord/config.yml': CONFIG + 'ui:\n  screenshots: "first\\nsecond"\n' });
    const lint = await run(['lint'], repo);
    expect(lint.code).not.toBe(0);
    expect(lint.out + lint.err).toContain('accord/config.yml:14: error schema.pattern');
  }, 120_000);
});
