// ST-LN-17 D-03: `accord hook pre-tool-use` refuses an accord-executor dispatched on the wrong model while a ticket is at review.
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
    // The cycle holds rounds and no verdict, so an open debug record no longer lets the wrong model through.
    expect(JSON.parse((await hook(repo, input(repo, { model: 'sonnet' }))).out).hookSpecificOutput.permissionDecision).toBe('deny');
    appendFileSync(debug, '\n## Resolved\n\ny\n');
    const r = await hook(repo, input(repo, { model: 'sonnet' }));
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision).toBe('deny');
  } finally {
    cleanup(repo);
  }

  // A debug fix dispatched before the current cycle holds a recorded round is not a review fix.
  const fresh = build({ 'accord/tickets/T-1/review.md': 'Round record: 1\n' });
  try {
    writeFileSync(join(fresh, 'accord', 'tickets', 'T-1', 'debug.md'), '# Debug\n\n## Hypothesis\n\nx\n');
    expect((await run(['anchor', 'T-1'], fresh)).out).toContain('Stage: review');
    expect(await hook(fresh, input(fresh, { model: 'sonnet' }))).toEqual(allowed);
  } finally {
    cleanup(fresh);
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

it('risk:regression a fix executor on the wrong model is refused in a review cycle that keeps an open debug record', async () => {
  const repo = build();
  try {
    const review = join(repo, 'accord', 'tickets', 'T-1', 'review.md');
    appendFileSync(review, '\nverdict: accepted-by-owner "ship it"\n');
    const sha = commitMsg(repo, 'review: T-1 accepted');
    writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n' });
    commitMsg(repo, 'fix: T-1 after review');
    // failure.md step 3: the debug fix is committed and debug.md stays open across verify.
    writeFileSync(join(repo, 'accord', 'tickets', 'T-1', 'debug.md'), '# Debug\n\n## Hypothesis\n\nx\n');
    appendFileSync(review, '\n## Return from verify ' + sha + '\n\n## Round 1\n\nShould 1 [patch]: the header row is missing — src/export.ts:1 — open\n');
    commitMsg(repo, 'review: T-1 cycle 2 round 1');

    expect((await run(['anchor', 'T-1'], repo)).out).toContain('Stage: review');
    for (const o of [{ model: 'sonnet' }, {}]) {
      const r = await hook(repo, input(repo, o));
      expect(r.code).toBe(0);
      const reason: string = JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('round 1');
      expect(reason).toContain('model "opus"');
    }
    expect(await hook(repo, input(repo, { model: 'opus' }))).toEqual({ code: 0, out: '{}\n', err: '' });
  } finally {
    cleanup(repo);
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

// ST-LN-39 D-08: in Claude Code only an accord-verifier subagent writes accord/tickets/<id>/verification.md.
const RECORD = (root: string) => join(root, 'accord', 'tickets', 'T-1', 'verification.md');
const write = (cwd: string, tool: string, file: string, who: Record<string, unknown> = {}) =>
  JSON.stringify({
    session_id: 's-1',
    cwd,
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: { file_path: file, content: 'x' },
    ...who,
  });

it('risk:security in claude code only an accord-verifier subagent writes verification.md (ST-LN-39 39-ac-1)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'accord-ptu-'));
  try {
    const record = RECORD(dir);
    const main = await hook(dir, write(dir, 'Write', record));
    expect(main.code).toBe(0);
    expect(main.err).toBe('');
    const mainOut = JSON.parse(main.out);
    const mainReason: string = mainOut.hookSpecificOutput.permissionDecisionReason;
    expect(mainOut).toEqual(deny(mainReason));
    expect(mainReason).toContain('accord: only the accord-verifier subagent writes accord/tickets/<id>/verification.md');
    expect(mainReason).toContain('the main session');

    const other = await hook(dir, write(dir, 'Edit', record, { agent_type: 'accord-reviewer', agent_id: 'a1' }));
    expect(other.code).toBe(0);
    const otherReason: string = JSON.parse(other.out).hookSpecificOutput.permissionDecisionReason;
    expect(JSON.parse(other.out)).toEqual(deny(otherReason));
    expect(otherReason).toContain('agent "accord-reviewer"');

    const allowed = { code: 0, out: '{}\n', err: '' };
    expect(await hook(dir, write(dir, 'Write', record, { agent_type: 'accord-verifier', agent_id: 'a1' }))).toEqual(allowed);
    // Resume mode: a fresh dispatch of the same verifier carries another agent_id and the same type.
    expect(await hook(dir, write(dir, 'Edit', record, { agent_type: 'accord-verifier', agent_id: 'a2' }))).toEqual(allowed);
  } finally {
    cleanup(dir);
  }
}, 120_000);

it('risk:security every spelling of the verification record path is refused for a non-verifier writer (ST-LN-39 39-ac-1)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'accord-ptu-'));
  try {
    const spellings = [
      'C:\\Work\\repo\\accord\\tickets\\T-1\\verification.md',
      'C:/Work/repo/.claude/worktrees/w/accord/tickets/T-1/verification.md',
      '/repo/accord/tickets/T-1/../T-1/verification.md',
      '/repo//accord/tickets/T-1/./verification.md',
      '/repo/Accord/Tickets/T-1/Verification.md',
      'accord/tickets/T-1/verification.md',
      RECORD(dir),
    ];
    for (const file of spellings) {
      const r = await hook(dir, write(dir, 'Write', file));
      expect(r.code, file).toBe(0);
      expect(JSON.parse(r.out).hookSpecificOutput?.permissionDecision, file).toBe('deny');
    }
    for (const who of [{}, { agent_type: 'accord-reviewer', agent_id: 'a1' }, { agent_type: '' }, { agent_type: 7 }]) {
      const r = await hook(dir, write(dir, 'MultiEdit', RECORD(dir), who));
      expect(JSON.parse(r.out).hookSpecificOutput?.permissionDecision).toBe('deny');
    }
    // The verifier still writes every spelling.
    for (const file of spellings) {
      expect(await hook(dir, write(dir, 'Write', file, { agent_type: 'accord-verifier', agent_id: 'a1' }))).toEqual({ code: 0, out: '{}\n', err: '' });
    }
  } finally {
    cleanup(dir);
  }
}, 120_000);

it('risk:security the hook lets every other write and every unreadable input through (ST-LN-39 39-ac-1)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'accord-ptu-'));
  try {
    const allowed = { code: 0, out: '{}\n', err: '' };
    for (const file of [
      'accord/tickets/T-1/review.md',
      'accord/tickets/T-1.md',
      '/repo/verification.md',
      'accord/tickets/T-1/x/verification.md',
      'accord/tickets/verification.md',
      'C:\\repo\\accord\\tickets\\T-1\\notes\\verification.md',
    ]) {
      expect(await hook(dir, write(dir, 'Write', file)), file).toEqual(allowed);
    }
    for (const tool of ['Read', 'Bash']) {
      const r = await hook(dir, write(dir, tool, RECORD(dir)));
      expect(r.code).toBe(0);
      expect(r.out).toBe('{}\n');
    }
    const bad: string[] = [
      '',
      '[]',
      'not json',
      JSON.stringify({ tool_name: 'Write', tool_input: 'x' }),
      JSON.stringify({ tool_name: 'Write', tool_input: [] }),
      JSON.stringify({ tool_name: 'Write', tool_input: {} }),
      JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 7 } }),
      JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: null } }),
    ];
    for (const stdin of bad) {
      const r = await hook(dir, stdin);
      expect(r.code, stdin).toBe(0);
      expect(r.out, stdin).toBe('{}\n');
      expect(r.err.trimEnd().split('\n'), stdin).toHaveLength(1);
      expect(r.err.trimEnd(), stdin).toMatch(/; allowed$/);
    }
  } finally {
    cleanup(dir);
  }
}, 120_000);

it('risk:regression the write branch reads no repository (ST-LN-39 39-ac-1)', async () => {
  // No accord folder and no git here: a repository load would fail and allow, so a deny proves none was attempted.
  const dir = mkdtempSync(join(tmpdir(), 'accord-ptu-'));
  try {
    const r = await hook(dir, write(dir, 'Write', RECORD(dir)));
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision).toBe('deny');
    // The dispatch branch is unchanged: with no repository it fails open with one stderr line.
    const agent = await hook(dir, input(dir, { model: 'sonnet' }));
    expect(agent.code).toBe(0);
    expect(agent.out).toBe('{}\n');
    expect(agent.err).toMatch(/; allowed\n$/);
  } finally {
    cleanup(dir);
  }
}, 120_000);
