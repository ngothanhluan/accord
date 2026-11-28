// Phase 11 G3 (D-10, D-11, D-16, 11-ac-11): `accord gate done` refuses a `ui: true` ticket whose `@ui` scenario has a `Result: pass` block at a screenshot tier (command, verifier, manual) and no file
// `accord/tickets/<id>/evidence/ac-<n>-<state>.<png|jpg|jpeg|webp>`, naming the scenario and the folder. From the cut-off release (0.23.0, mocked below). Real git in a temporary sandbox.
import { afterEach, expect, it, vi } from 'vitest';
import { LANE_BODY, laneTicket, pinned } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.23.0' } };
});

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const EVIDENCE = 'accord/tickets/T-1/evidence/';
const BODY = LANE_BODY.replace('@ac-1 @test:export#writes-csv', '@ac-1 @ui');
const verification = (sha: string, ...block: string[]): string =>
  ['---', 'ticket: "T-1"', `commit: "${sha}"`, 'reviewed_on: "2026-11-28"', '---', '', '## @ac-1 export writes a csv', '', 'Result: pass', ...block, ''].join('\n');

/** main holds the config (with `ui.screenshots`) and the ui: true ticket T-1 whose @ac-1 is `@ui`; the branch has the verification record at that commit and `more` files. */
function sandbox(block: (sha: string) => string[], more: Record<string, string> = {}): { repo: string; sha: string } {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, {
    'accord/config.yml': pinned('0.23.0') + 'ui:\n  screenshots: "npm run shots -- {dir}"\n',
    'accord/tickets/T-1.md': laneTicket('T-1', { body: BODY }).replace('ui: false', 'ui: true'),
    'src/export.ts': 'export const write = 1;\n',
  });
  const sha = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(repo, { 'accord/tickets/T-1/verification.md': verification(sha.slice(0, 12), ...block(sha.slice(0, 12))), ...more });
  return { repo, sha: sha.slice(0, 12) };
}

interface Found { rule: string; level: string; file?: string; line?: number; reason: string }
async function findings(repo: string): Promise<{ code: number; found: Found[] }> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.ui-evidence-missing') };
}

it('risk:regression gate done refuses a ui pass recorded at tier command with no screenshot, naming the scenario and the folder (11-ac-11, D-10)', async () => {
  const box = sandbox((sha) => ['Tier: command', `Evidence commit: ${sha}`, 'Evidence: src/export.ts']);
  const refused = await findings(box.repo);
  expect(refused.code).toBe(1);
  expect(refused.found).toHaveLength(1);
  expect(refused.found[0]).toMatchObject({ level: 'error', file: 'accord/tickets/T-1/verification.md' });
  expect(refused.found[0].reason).toContain('@ac-1');
  expect(refused.found[0].reason).toContain('accord/tickets/T-1/evidence/ac-1-<state>.png');
  expect(refused.found[0].reason).not.toContain('\\');

  // the same record with the screenshot present (untracked) passes this rule
  writeFiles(box.repo, { [`${EVIDENCE}ac-1-empty.png`]: 'png' });
  expect((await findings(box.repo)).found).toEqual([]);
}, 180_000);
