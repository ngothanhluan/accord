// Phase 11 G3 (D-07, 11-ac-8): `accord brief` of a `ui: true` ticket names the second executor, `agent: accord-executor-ui`, when `ui.build` is set, so the session dispatches the executor
// that carries the repository's build skill; a `ui: false` ticket, and a repository with no `ui.build`, print no `agent:` line and the brief is what it is today.
// Skill-name form (11-A2-PROBE.md, `Use: both`): each case runs with the bare name and with the plugin name.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, makeLaneRepo, run } from './helpers/repo.js';

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
