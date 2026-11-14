// ST-LN-94 94-ac-4, D-11, D-20: `accord budget <id>` on real git. The clock runs from the author time of the ticket's `claim: <id>` commit;
// the tokens are the weighted sum of the checkout's own Claude Code transcripts since the claim, or `not measured` when the checkout has no
// transcript folder or the earliest transcript left in it starts after the claim. CLAUDE_CONFIG_DIR always points at a temporary folder, so no
// test reads the real ~/.claude.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseSpent } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, P } from '../../../test/helpers/lane.js';

const rBody = (budget: string) =>
  [
    '## Question', 'Does the critic need a second round?', '',
    '## Timebox', '1 hours', '',
    '## Token budget', budget, '',
    '## Decisions', `- D-01 Timebox 1 hours, token budget ${budget} — "one hour and ${budget} is enough"`, '',
  ].join('\n');

/** A repository on main whose base commit holds the config and the R ticket, and whose `claim: R-1` commit is dated `minutesAgo` back. */
function claimed(minutesAgo: number, budget = '800k weighted tokens'): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG, [P('R-1')]: laneTicket('R-1', { lane: 'R', body: rBody(budget) }) });
  const at = new Date(Date.now() - minutesAgo * 60_000);
  commitMsg(repo, 'base', new Date(at.getTime() - 60_000));
  gitRun(repo, 'branch', '-M', 'main');
  writeFiles(repo, { 'notes.txt': 'claimed\n' });
  commitMsg(repo, 'claim: R-1', at);
  return repo;
}

/** The claim commit's author time, in seconds (REVIEW2 WR-03). */
const claimAt = (repo: string) => Number(gitRun(repo, 'log', '-1', '--format=%at').trim());

/** Claude Code's folder name for the checkout: its path with every character outside A-Z, a-z, 0-9 as `-`, here in the other letter case. */
function folderOf(repo: string): string {
  const name = gitRun(repo, 'rev-parse', '--show-toplevel').trim().replace(/[^A-Za-z0-9]/g, '-');
  return [...name].map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');
}

const at = (seconds: number, ms = 0) => new Date(seconds * 1000 + ms).toISOString();
const MARKER = 'MARKER-transcript-text-5f1c';
const BIG = { input_tokens: 1000, cache_creation_input_tokens: 400, cache_read_input_tokens: 10000, output_tokens: 200 }; // 3500 weighted
const SMALL = { input_tokens: 10, output_tokens: 10 }; // 60 weighted
const HUGE = { input_tokens: 900_000, output_tokens: 900_000 };
const assistant = (id: string, when: string, usage: object, text = 'ok') =>
  JSON.stringify({ type: 'assistant', timestamp: when, message: { id, role: 'assistant', model: 'm', content: [{ type: 'text', text }], usage } });
const user = (when: string, text: string) => JSON.stringify({ type: 'user', timestamp: when, message: { role: 'user', content: text } });

/** Runs `accord budget` with CLAUDE_CONFIG_DIR at a new folder whose projects/ holds `projects` (folder name to file path to lines). */
async function budget(repo: string, projects: Record<string, Record<string, string[]>> = {}, id = 'R-1') {
  const claude = mkdtempSync(join(tmpdir(), 'accord-claude-'));
  try {
    for (const [folder, files] of Object.entries(projects)) {
      for (const [file, lines] of Object.entries(files)) {
        const path = join(claude, 'projects', folder, file);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, lines.join('\n') + '\n');
      }
    }
    return await run(['budget', id], repo, { CLAUDE_CONFIG_DIR: claude });
  } finally {
    cleanup(claude);
  }
}

it('risk:complex-branching accord budget answers from the claim commit\'s time (ST-LN-94 94-ac-4)', async () => {
  const fresh = claimed(10);
  const late = claimed(120);
  try {
    const within = await budget(fresh);
    expect(within.err).toBe('');
    expect(within.code).toBe(0);
    const lines = within.out.trimEnd().split('\n');
    expect(lines[0]).toBe('within budget');
    expect(lines).toContain('Tokens not measured: no Claude Code transcript folder for this checkout');
    expect(lines.some((l) => /^Spent: 0h 1[01]m of 1 hours; not measured of 800k weighted tokens$/.test(l))).toBe(true);
    expect(within.out).not.toContain('Owner: write now');

    const stop = await budget(late);
    expect(stop.code).toBe(1);
    const said = stop.out.trimEnd().split('\n');
    expect(said[0]).toBe('stop: ask owner');
    expect(said.some((l) => /^Spent: 2h [01]m of 1 hours; not measured of 800k weighted tokens$/.test(l))).toBe(true);
    expect(said.some((l) => l.includes('write the record from what the research has') && l.includes('extend ## Timebox or ## Token budget'))).toBe(true);
    expect(said.some((l) => l.includes('Owner: write now') && l.includes('## Decisions') && l.includes('accord gate ready R-1'))).toBe(true);
  } finally {
    cleanup(fresh);
    cleanup(late);
  }
}, 120_000);

it('risk:complex-branching accord budget refuses a ticket it cannot clock (ST-LN-94 94-ac-4)', async () => {
  const lane = makeEmptyRepo();
  const never = makeEmptyRepo();
  const unclaimed = makeEmptyRepo();
  try {
    writeFiles(lane, { 'accord/config.yml': CONFIG, [P('M-1')]: laneTicket('M-1') });
    commitMsg(lane, 'claim: M-1');
    const m = await budget(lane, {}, 'M-1');
    expect(m.code).toBe(2);
    expect(m.out).toBe('');
    expect(m.err).toContain('lane M');

    const files = { 'accord/config.yml': CONFIG, [P('R-1')]: laneTicket('R-1', { lane: 'R', body: rBody('800k weighted tokens') }) };
    writeFiles(never, files);
    const none = await budget(never);
    expect(none.code).toBe(2);
    expect(none.err).toContain('no claim commit for R-1');

    writeFiles(unclaimed, files);
    commitMsg(unclaimed, 'add R-1');
    const bare = await budget(unclaimed);
    expect(bare.code).toBe(2);
    expect(bare.err).toContain('no claim commit for R-1');
    expect(bare.out).toBe('');
  } finally {
    cleanup(lane);
    cleanup(never);
    cleanup(unclaimed);
  }
}, 120_000);

it('risk:complex-branching accord budget sums the weighted tokens of the checkout\'s transcripts since the claim (ST-LN-94 94-ac-4)', async () => {
  const repo = claimed(10, '3k weighted tokens');
  try {
    const t = claimAt(repo);
    const folder = folderOf(repo);
    const r = await budget(repo, {
      [folder]: {
        's1.jsonl': [
          assistant('msg_early', at(t - 60), HUGE),
          assistant('msg_a', at(t + 5), BIG),
          assistant('msg_a', at(t + 6), BIG), // a streamed message repeats its usage: counted once
          assistant('msg_b', at(t + 10), SMALL),
          '{"type":"assistant","timestamp":', // malformed: skipped
        ],
      },
      // Another checkout's folder, whose name starts with this one's: neither counted nor read.
      [`${folder}--claude-worktrees-agent-1`]: { 's9.jsonl': [assistant('msg_other', at(t + 20), HUGE)] },
    });
    expect(r.err).toBe('');
    expect(r.code).toBe(1);
    const lines = r.out.trimEnd().split('\n');
    expect(lines[0]).toBe('stop: ask owner');
    expect(lines).toContain('Tokens: 3560 of 3k weighted tokens');
    expect(lines.some((l) => /^Spent: 0h 1[01]m of 1 hours; 3560 of 3k weighted tokens$/.test(l))).toBe(true);
    expect(r.out).not.toContain('not measured');
  } finally {
    cleanup(repo);
  }
}, 120_000);

const PARTIAL = 'Tokens not measured: the earliest transcript left starts after the claim, so part of the time since it may be missing (Claude Code deletes transcripts after 30 days by default)';

it('risk:complex-branching accord budget says not measured when the transcript folder starts after the claim (ST-LN-94 D-20)', async () => {
  const fresh = claimed(10, '3k weighted tokens');
  const late = claimed(120, '3k weighted tokens');
  try {
    // Usage that alone would stop the research (3560 of 3k), in a folder whose earliest line is after the claim.
    const partial = (repo: string) => ({
      [folderOf(repo)]: {
        's1.jsonl': [assistant('msg_a', at(claimAt(repo) + 5), BIG), assistant('msg_b', at(claimAt(repo) + 10), SMALL)],
      },
    });
    const within = await budget(fresh, partial(fresh));
    expect(within.code).toBe(0);
    const lines = within.out.trimEnd().split('\n');
    expect(lines[0]).toBe('within budget');
    expect(lines).toContain('Tokens: not measured of 3k weighted tokens');
    expect(lines.some((l) => /^Spent: 0h 1[01]m of 1 hours; not measured of 3k weighted tokens$/.test(l))).toBe(true);
    expect(lines).toContain(PARTIAL);
    expect(within.out).not.toContain('3560');

    const stop = await budget(late, partial(late));
    expect(stop.code).toBe(1);
    expect(stop.out.split('\n')[0]).toBe('stop: ask owner');
    expect(stop.out).toContain('Tokens: not measured of 3k weighted tokens');
    expect(stop.out).toContain(PARTIAL);

    // A first line in the claim's own second is not later than the claim: the figure is printed, subagent transcripts included.
    const t = claimAt(fresh);
    const same = await budget(fresh, {
      [folderOf(fresh)]: {
        's1.jsonl': [user(at(t, 900), 'go'), assistant('msg_b', at(t + 10), SMALL)],
        's1/subagents/agent-x1.jsonl': [assistant('msg_sub', at(t + 20), BIG)],
      },
    });
    expect(same.code).toBe(1);
    expect(same.out).toContain('Tokens: 3560 of 3k weighted tokens');
    expect(same.out).not.toContain('not measured');

    // A folder holding no timestamped line says not measured.
    const junk = await budget(fresh, { [folderOf(fresh)]: { 's1.jsonl': ['not json', '{"type":"assistant"', '{"type":"user"}'] } });
    expect(junk.code).toBe(0);
    expect(junk.out).toContain('Tokens: not measured of 3k weighted tokens');
    expect(junk.out).toMatch(/^Tokens not measured: no timestamped line in the Claude Code transcript folder for this checkout$/m);
  } finally {
    cleanup(fresh);
    cleanup(late);
  }
}, 120_000);

it('risk:complex-branching a not-measured Spent line is compared by time alone at gate done (ST-LN-94 D-20)', async () => {
  const repo = claimed(10, '3k weighted tokens');
  try {
    const t = claimAt(repo);
    const r = await budget(repo, { [folderOf(repo)]: { 's1.jsonl': [assistant('msg_a', at(t + 5), BIG)] } });
    expect(r.out).toContain(PARTIAL);
    const spent = r.out.split('\n').find((l) => l.startsWith('Spent: '));
    const printed = /^Spent: (\d+)h (\d+)m of /.exec(spent ?? '');
    expect(printed).not.toBeNull();
    const parsed = parseSpent(spent!);
    expect(parsed).toBeDefined();
    expect(parsed!.tokens).toBeUndefined();
    expect(parsed!.tokensText).toBe('not measured');
    expect(parsed!.minutes).toBe(Number(printed![1]) * 60 + Number(printed![2]));
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security the transcript reader reads only the checkout\'s own folder and prints no transcript text (ST-LN-94 94-ac-4)', async () => {
  const repo = claimed(10);
  try {
    const t = claimAt(repo);
    const folder = folderOf(repo);
    // Another checkout's folder with large usage and an earlier first line than this checkout's.
    const sibling = { [`${folder}--claude-worktrees-agent-1`]: { 's9.jsonl': [user(at(t - 3600), MARKER), assistant('msg_other', at(t - 3500), HUGE, MARKER)] } };
    const own = [user(at(t - 60), MARKER), assistant('msg_a', at(t + 5), BIG, MARKER)];
    const counted = await budget(repo, { [folder]: { 's1.jsonl': own }, ...sibling });
    expect(counted.code).toBe(0);
    expect(counted.out).toContain('Tokens: 3500 of 800k weighted tokens');
    expect(counted.out + counted.err).not.toContain(MARKER);

    const partial = await budget(repo, { [folder]: { 's1.jsonl': own.slice(1) }, ...sibling });
    expect(partial.out).toContain('Tokens: not measured of 800k weighted tokens');
    expect(partial.out).toContain(PARTIAL);
    expect(partial.out + partial.err).not.toContain(MARKER);
  } finally {
    cleanup(repo);
  }
}, 120_000);
