// ST-LN-17 D-03: `accord hook pre-tool-use` refuses an accord-executor dispatched on the wrong model while a ticket is at review.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { building, P } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const REVIEW =
  'Round record: 1\n\n## Round 1\n\nMust 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234\n\n' +
  '## Round 2\n\nNice 1 [patch]: rename w — src/export.ts:1 — deferred\n\n' +
  '## Round 3\n\nNice 1 [patch]: a comment typo — src/export.ts:2 — deferred\n\n' +
  '## Round 4\n\nShould 1 [patch]: a comma is not quoted — src/export.ts:9 — open\n';

function build(extra: Record<string, string> = {}): string {
  const files: Record<string, string> = {};
  building(files, 'T-1');
  const repo = makeLaneRepo({
    [P('T-1')]: files[P('T-1')],
    'accord/tickets/T-1/ledger.md': LEDGER,
    'accord/tickets/T-1/review.md': REVIEW,
    ...extra,
  });
  gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  commitMsg(repo, 'fixture');
  return repo;
}

const input = (repo: string, o: Record<string, unknown> = {}, tool = 'Agent') =>
  JSON.stringify({
    session_id: 's-1',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: { subagent_type: 'accord-executor', description: 'fix round 4', prompt: 'Brief: b.md', ...o },
  });
const hook = (repo: string, stdin: string) => run(['hook', 'pre-tool-use'], repo, {}, stdin);
const deny = (reason: string) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });

it('ac-5 in claude code a fix executor dispatched on the wrong model is refused', async () => {
  const repo = build();
  try {
    for (const o of [{ model: 'sonnet' }, {}]) {
      const r = await hook(repo, input(repo, o));
      expect(r.code).toBe(0);
      expect(r.err).toBe('');
      const out = JSON.parse(r.out);
      const reason: string = out.hookSpecificOutput.permissionDecisionReason;
      expect(out).toEqual(deny(reason));
      expect(reason).toContain('round 4');
      expect(reason).toContain('model "opus"');
      expect(reason).toContain('write that round to review.md and commit it first');
    }
    expect(await hook(repo, input(repo, { model: 'opus' }))).toEqual({ code: 0, out: '{}\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security the pre tool use hook lets other agents an open debug record and every error through', async () => {
  const allowed = { code: 0, out: '{}\n', err: '' };
  const repo = build();
  try {
    expect(await hook(repo, input(repo, { subagent_type: 'accord-reviewer', model: 'sonnet' }))).toEqual(allowed);
    expect(await hook(repo, input(repo, { model: 'sonnet' }, 'Bash'))).toEqual(allowed);
    const bad = await hook(repo, 'not json');
    expect(bad.code).toBe(0);
    expect(bad.out).toBe('{}\n');
    expect(bad.err).toContain('allowed');

    const debug = join(repo, 'accord', 'tickets', 'T-1', 'debug.md');
    writeFileSync(debug, '# Debug\n\n## Hypothesis\n\nx\n');
    expect(await hook(repo, input(repo, { model: 'sonnet' }))).toEqual(allowed);
    appendFileSync(debug, '\n## Resolved\n\ny\n');
    const r = await hook(repo, input(repo, { model: 'sonnet' }));
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision).toBe('deny');
  } finally {
    cleanup(repo);
  }

  const atBuild = build({ 'accord/tickets/T-1/ledger.md': '## Rulings\n- task 1 done abc1234\n' });
  try {
    expect(await hook(atBuild, input(atBuild, { model: 'sonnet' }))).toEqual(allowed);
  } finally {
    cleanup(atBuild);
  }

  const pinned = build();
  try {
    const config = join(pinned, 'accord', 'config.yml');
    writeFileSync(config, readFileSync(config, 'utf8').replace(/accord: "[^"]*"/, 'accord: "0.0.1"'));
    const r = await hook(pinned, input(pinned, { model: 'sonnet' }));
    expect(r.code).toBe(0);
    expect(r.out).toBe('{}\n');
    expect(r.err).toContain('allowed');
  } finally {
    cleanup(pinned);
  }
}, 120_000);

it('risk:complex-branching a fix executor in a second review cycle is judged at review and accord anchor prints review mid cycle', async () => {
  const repo = build();
  try {
    const review = join(repo, 'accord', 'tickets', 'T-1', 'review.md');
    appendFileSync(review, '\nverdict: accepted-by-owner "ship it"\n');
    const sha = commitMsg(repo, 'review: T-1 accepted');
    writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n' });
    commitMsg(repo, 'fix: T-1 after review');
    appendFileSync(review, '\n## Return from verify ' + sha + '\n\n## Round 1\n\nShould 1 [patch]: the header row is missing — src/export.ts:1 — open\n');
    commitMsg(repo, 'review: T-1 cycle 2 round 1');

    const anchor = await run(['anchor', 'T-1'], repo);
    expect(anchor.code).toBe(0);
    expect(anchor.out).toContain('Stage: review');

    const r = await hook(repo, input(repo, { model: 'sonnet' }));
    expect(r.code).toBe(0);
    const reason: string = JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain('round 1');
    expect(reason).toContain('model "opus"');
    expect(await hook(repo, input(repo, { model: 'opus' }))).toEqual({ code: 0, out: '{}\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);
