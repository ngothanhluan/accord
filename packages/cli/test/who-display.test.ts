// Phase 8.2 D-07, D-08 (8.2-ac-7): `git config accord.who initials` shows each person as the initials the `people` map holds, in every view that prints a person, while the JSON identity
// fields (`claimedBy`, `holder`) stay the email. The setting is per person and uncommitted; any other value shows the email and never stops a command.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

/** A moment `days` whole days and one hour ago: the hour keeps `Math.floor` of the age at `days` however slowly the test runs. */
const ago = (days: number): Date => new Date(Date.now() - (days * 24 + 1) * 3600 * 1000);
const CONVENTIONS = '# Conventions\n\n<!-- One rule per line. -->\n';
const CONFIG_WHO = CONFIG + "stale_days: '14'\npeople:\n  a@x.io: AX\n";

/** An empty claim commit on a new branch t/<id>, authored by `author` (the repository's own identity stays the viewer's), `age` days old; the checkout goes back to main. */
function claimAs(repo: string, id: string, author: string, age: number): void {
  gitRun(repo, 'switch', '-q', '-c', `t/${id}`);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, `claim: ${id}\n`);
    const stamp = `@${Math.floor(ago(age).getTime() / 1000)} +0000`;
    const env = { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp };
    delete env.GIT_AUTHOR_EMAIL;
    delete env.GIT_AUTHOR_NAME;
    delete env.GIT_COMMITTER_NAME;
    delete env.GIT_COMMITTER_EMAIL;
    // the author and the committer are both `author`, as `git -c user.email=<author> commit` makes them; the cwd is the sandbox the caller made
    execFileSync('git', ['-c', `user.email=${author}`, '-c', 'user.name=who', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-F', file, '--cleanup=verbatim'], {
      cwd: repo,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    cleanup(folder);
  }
  gitRun(repo, 'switch', '-q', 'main');
}

/** T-1 claimed 20 days ago by a@x.io (mapped to AX), T-2 claimed 3 days ago by b@x.io (not in the map); the viewer is `viewer`. */
function repoFor(viewer: string): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', viewer);
  gitRun(repo, 'config', 'user.name', 'viewer');
  writeFiles(repo, {
    'accord/config.yml': CONFIG_WHO,
    'accord/product/conventions.md': CONVENTIONS,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'accord/tickets/T-2.md': laneTicket('T-2'),
  });
  commitMsg(repo, 'add tickets', ago(30));
  claimAs(repo, 'T-1', 'a@x.io', 20);
  claimAs(repo, 'T-2', 'b@x.io', 3);
  return repo;
}

const rowOf = (text: string, id: string): string => text.split('\n').find((l) => l.includes(id + ' ') || l.startsWith(id)) ?? '';
type Row = { id: string; claimedBy?: string; claimedByShown?: string };
const sections = (json: string): Record<string, { rows: Row[] }> => JSON.parse(json) as Record<string, { rows: Row[] }>;
const unset = (repo: string): void => {
  gitRun(repo, 'config', '--unset', 'accord.who');
};

it('risk:regression every text view shows AX for a mapped person and the email for one the map lacks under accord.who initials (8.2-ac-7)', async () => {
  const repo = repoFor('v@x.io');
  gitRun(repo, 'config', 'accord.who', 'initials');

  const board = await run(['dashboard'], repo);
  expect(board.code, board.out + board.err).toBe(0);
  expect(rowOf(board.out, 'T-1'), board.out).toContain('AX');
  expect(rowOf(board.out, 'T-1'), board.out).not.toContain('a@x.io');
  expect(rowOf(board.out, 'T-2'), board.out).toContain('b@x.io');

  const table = await run(['status'], repo);
  expect(table.code, table.out + table.err).toBe(0);
  expect(rowOf(table.out, 'T-1'), table.out).toContain('AX');
  expect(rowOf(table.out, 'T-1'), table.out).not.toContain('a@x.io');
  expect(rowOf(table.out, 'T-2'), table.out).toContain('b@x.io');

  const shown = await run(['show', 'T-1'], repo);
  expect(shown.code, shown.out + shown.err).toBe(0);
  expect(shown.out.split('\n')).toContain('Holder: AX');
  const other = await run(['show', 'T-2'], repo);
  expect(other.out.split('\n')).toContain('Holder: b@x.io');

  const audit = await run(['audit'], repo);
  expect(audit.code, audit.out + audit.err).toBe(0);
  const idle = audit.out.split('\n').filter((l) => l.startsWith('gap: ticket-idle:') && l.includes('T-1'));
  expect(idle, audit.out).toHaveLength(1);
  expect(idle[0]).toContain('claimed by AX');
  expect(audit.out.split('\n')).toContain('fact: who: initials');

  // D-08: `accord next` lists only unclaimed tickets, so its rows pass the same function and show no person
  const next = await run(['next'], repo);
  expect(next.code, next.out + next.err).toBe(0);
  expect(next.out).not.toContain('a@x.io');
  expect(next.out).not.toContain('b@x.io');
});

it('risk:regression the viewer own tickets stay under YOURS when accord.who is initials (8.2-ac-7, D-08)', async () => {
  const repo = repoFor('a@x.io');
  gitRun(repo, 'config', 'accord.who', 'initials');
  const board = await run(['dashboard', '--json'], repo);
  expect(board.code, board.err).toBe(0);
  const d = sections(board.out);
  expect(d.yours?.rows.map((r) => r.id)).toEqual(['T-1']);
  expect(d.team?.rows.map((r) => r.id)).toEqual(['T-2']);
  // the display mapping ran after the data: the identity field is still the email
  expect(d.yours?.rows[0]?.claimedBy).toBe('a@x.io');
  const text = await run(['dashboard'], repo);
  expect(text.code, text.out + text.err).toBe(0);
  expect(rowOf(text.out, 'T-2'), text.out).toContain('b@x.io');
});

it('risk:regression with accord.who unset every view shows the email and the JSON keeps claimedBy (8.2-ac-7)', async () => {
  const repo = repoFor('v@x.io');
  gitRun(repo, 'config', 'accord.who', 'initials');
  unset(repo);

  for (const cmd of [['dashboard'], ['status'], ['show', 'T-1']]) {
    const r = await run(cmd, repo);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out, cmd.join(' ')).toContain('a@x.io');
    expect(r.out, cmd.join(' ')).not.toContain('AX');
  }
  const audit = await run(['audit'], repo);
  expect(audit.out.split('\n')).toContain('fact: who: email');

  const json = await run(['dashboard', '--json'], repo);
  expect(json.code, json.err).toBe(0);
  expect(json.out).not.toContain('claimedByShown');
  expect(sections(json.out).team?.rows.find((r) => r.id === 'T-1')?.claimedBy).toBe('a@x.io');
  const detail = await run(['show', 'T-1', '--json'], repo);
  expect(detail.out).not.toContain('holderShown');
  expect((JSON.parse(detail.out) as { holder: string }).holder).toBe('a@x.io');
  // `status --json` is the bare StatusRow array and never carries a display field
  const rows = await run(['status', '--json'], repo);
  expect(rows.out).not.toContain('Shown');

  gitRun(repo, 'config', 'accord.who', 'initials');
  const shownJson = await run(['dashboard', '--json'], repo);
  expect(shownJson.code, shownJson.err).toBe(0);
  const team = sections(shownJson.out).team?.rows ?? [];
  const t1 = team.find((r) => r.id === 'T-1');
  const t2 = team.find((r) => r.id === 'T-2');
  expect([t1?.claimedBy, t1?.claimedByShown]).toEqual(['a@x.io', 'AX']);
  expect([t2?.claimedBy, t2?.claimedByShown]).toEqual(['b@x.io', 'b@x.io']);
  const detailShown = await run(['show', 'T-1', '--json'], repo);
  const parsed = JSON.parse(detailShown.out) as { holder: string; holderShown: string };
  expect([parsed.holder, parsed.holderShown]).toEqual(['a@x.io', 'AX']);
  const rowsShown = await run(['status', '--json'], repo);
  expect(rowsShown.out).not.toContain('Shown');
  expect(rowsShown.out).toContain('"claimedBy": "a@x.io"');
});

it('risk:parsing an unknown accord.who value shows the email and the audit names it (D-07)', async () => {
  const repo = repoFor('v@x.io');
  gitRun(repo, 'config', 'accord.who', 'Initials');
  const board = await run(['dashboard'], repo);
  expect(board.code, board.out + board.err).toBe(0);
  expect(rowOf(board.out, 'T-1'), board.out).toContain('a@x.io');
  for (const cmd of [['status'], ['show', 'T-1'], ['next']]) expect((await run(cmd, repo)).code, cmd.join(' ')).toBe(0);
  const json = await run(['dashboard', '--json'], repo);
  expect(json.out).not.toContain('claimedByShown');
  const audit = await run(['audit'], repo);
  expect(audit.code, audit.out + audit.err).toBe(0);
  expect(audit.out.split('\n')).toContain('fact: who: email (git config accord.who is "Initials", which is neither email nor initials)');
});
