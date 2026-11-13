// ST-LN-91 RR-WR-05: the CLI here runs as the cut-off release (0.4.1), so HEAD's pin can be 0.4.1 while a ticket was claimed under 0.4.0.
// Only then does a test fail when the claim pin is not read: with HEAD at the running version's old pin the working-tree fallback gives the same answer.
import { chmodSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { APPROACH_CAP_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.4.1' } };
});

const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const HEAD_CONFIG = pinned(APPROACH_CAP_FROM);
const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const rec = (...rounds: string[]): string => 'Round record: 1\n\n' + rounds.join('');
const r = (n: number, mode: string, ...lines: string[]): string => '## Round ' + n + ' (' + mode + ')\n\n' + lines.join('\n') + '\n\n';
const LOSS = '1. Must — the export overwrites the old file — open — risk: data-loss';
const OPEN = '1. Should — the cache can go stale — open';
const RECORD = rec(r(1, 'whole', LOSS), r(2, 'diff', OPEN));

/** A ticket claimed under `claimPin`, its approach record committed after the claim, HEAD at the running version's pin. */
function claimed(claimPin: string, record: string): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': HEAD_CONFIG, [APPROACH]: record, 'notes.txt': 'work after the claim\n' });
  commitAll(repo, 'T-1 approach rounds');
  return repo;
}

/** Remove one loose object: a commit lost from the history, so `git log` cannot walk to it. */
const dropObject = (repo: string, sha: string): void => {
  const file = join(repo, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  chmodSync(file, 0o666);
  rmSync(file, { force: true });
};

it('risk:regression a ticket claimed under 0.4.0 is approved with an open risk finding, and one claimed at 0.4.1 is refused (ST-LN-91 D-12, RR-WR-05)', async () => {
  const old = claimed('0.4.0', RECORD);
  try {
    // HEAD pins 0.4.1: only a read of the claim commit's pin keeps the ticket on its old rules.
    const approved = await run(['approve', 'T-1'], old);
    expect(approved.err).toBe('');
    expect(approved.code).toBe(0);
    expect(approved.out).toMatch(/^approved /);
  } finally {
    cleanup(old);
  }
  const now = claimed(APPROACH_CAP_FROM, RECORD);
  try {
    const refused = await run(['approve', 'T-1'], now);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('blocks the approval');
  } finally {
    cleanup(now);
  }
}, 120_000);

it('risk:security a ticket with no claim commit gets the new rules, even when it was added on a branch under 0.4.0 (ST-LN-91 RR-CR-02)', async () => {
  const repo = makeLaneRepo();
  try {
    gitRun(repo, 'add', 'accord/config.yml');
    gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitAll(repo, 'add T-1'); // the ticket, under 0.4.0, no `claim:` subject
    writeFiles(repo, { 'accord/config.yml': HEAD_CONFIG, [APPROACH]: RECORD, 'notes.txt': 'work after the upgrade\n' });
    commitAll(repo, 'T-1 approach rounds');
    const refused = await run(['approve', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('blocks the approval');
    // gate ready asks for the discuss record too.
    const gate = await run(['gate', 'ready', 'T-1', '--json'], repo);
    const found = (JSON.parse(gate.out).findings as { rule: string }[]).filter((f) => f.rule === 'gate.discuss-missing');
    expect(found).toHaveLength(1);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security show --approval --short lists an open risk finding of a ticket claimed under 0.4.0 under Risks, never as absent (ST-LN-91 RR-WR-01)', async () => {
  const repo = claimed('0.4.0', RECORD);
  try {
    const { code, out, err } = await run(['show', 'T-1', '--approval', '--short'], repo);
    expect(err).toBe('');
    expect(code).toBe(0);
    const lines = out.split('\n');
    expect(lines).toContain('- round 1: ' + LOSS);
    expect(lines).toContain('- round 2: ' + OPEN);
    expect(lines.indexOf('- round 1: ' + LOSS)).toBeGreaterThan(lines.indexOf('## Risks'));
    expect(out).not.toContain('## Blocking findings');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it("risk:security an owner-dropped risk finding does not block the approval, and the short view lists it with the owner's words (ST-LN-91 RR-CR-01, D-22)", async () => {
  const DROPPED = '1. Must — the export overwrites the old file — owner: "ship it" — risk: data-loss';
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', DROPPED), r(2, 'diff', 'No findings')));
  try {
    const { code, out } = await run(['show', 'T-1', '--approval', '--short'], repo);
    expect(code).toBe(0);
    expect(out.split('\n')).toContain('- round 1: ' + DROPPED);
    expect(out).not.toContain('## Blocking findings');
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security approve and show name the git error where a failed claim read decides the rules (ST-LN-91 RR-WR-02)', async () => {
  const repo = makeLaneRepo();
  try {
    const base = commitAll(repo, 'base');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.0') + '# claimed\n' });
    commitMsg(repo, 'claim: T-1');
    writeFiles(repo, { 'accord/config.yml': HEAD_CONFIG, [APPROACH]: RECORD, 'notes.txt': 'work after the claim\n' });
    commitAll(repo, 'T-1 approach rounds');
    dropObject(repo, base); // the claim commit's parent: `git log` fails, everything else still reads
    const refused = await run(['approve', 'T-1'], repo);
    expect(refused.code).toBe(1);
    const noted = refused.out.split('\n').filter((l) => l.includes('git failed reading the claim pin of T-1'));
    expect(noted).toHaveLength(1);
    expect(noted[0]).toContain(base);
    const short = await run(['show', 'T-1', '--approval', '--short'], repo);
    expect(short.code).toBe(0);
    expect(short.out).toContain('## Blocking findings');
    const shown = short.out.split('\n').filter((l) => l.includes('git failed reading the claim pin of T-1'));
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain(base);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// ST-LN-91 CR-01 (round 3, owner decision 1; round 4, strict reading): every read form of a risk mark blocks, and a record accord cannot read, or a risk it cannot read, stops the approval.
const TICKET = join('accord', 'tickets', 'T-1.md');
const FORMS = [
  '1. Must — tokens reach the log — open — rests on: risk: security',
  '1. Must — tokens reach the log — open — risk: Security',
  '1. Must — an overwrite — risk: data-loss — open',
  '1. Must — tokens reach the log — open — RISK: SECURITY',
];

it('risk:security accord approve refuses every read form of a risk mark and the short view lists it as blocking (ST-LN-91 CR-01)', async () => {
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', FORMS[0]), r(2, 'diff', OPEN)));
  try {
    for (const form of FORMS) {
      writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', form), r(2, 'diff', OPEN)) });
      const refused = await run(['approve', 'T-1'], repo);
      expect(refused.code, form).toBe(1);
      expect(refused.out, form).toContain('Round 1:\n' + form + '\n');
      const short = await run(['show', 'T-1', '--approval', '--short'], repo);
      expect(short.code, form).toBe(0);
      const lines = short.out.split('\n');
      expect(lines.indexOf('- round 1: ' + form), form).toBeGreaterThan(lines.indexOf('## Blocking findings'));
      expect(lines.indexOf('## Risks') < lines.indexOf('## Blocking findings'), form).toBe(true);
    }
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security accord approve refuses while the approach record has a line accord cannot read, and names it (ST-LN-91 CR-01)', async () => {
  const bad = ['1. Must — tokens reach the log — open — `risk: security`', '1. Must/Should — tokens reach the log — open — risk: security', '1. Must — tokens reach the log — open — risks: security', '1. Must — tokens reach the log — open — risk: data_loss'];
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', bad[0]), r(2, 'diff', OPEN)));
  try {
    for (const line of bad) {
      writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', line), r(2, 'diff', OPEN)) });
      const refused = await run(['approve', 'T-1'], repo);
      expect(refused.code, line).toBe(1);
      expect(refused.err, line).toBe('');
      expect(refused.out, line).toContain('Record problems:\n');
      expect(refused.out, line).toContain('line 5: ');
      expect(refused.out, line).toContain('approach-review.md');
      const short = await run(['show', 'T-1', '--approval', '--short'], repo);
      expect(short.code, line).toBe(0);
      expect(short.out, line).toContain('## Blocking findings');
      expect(short.out, line).toContain('- record problem: ');
      expect(short.out, line).toContain('line 5: ');
    }
    // Corrected, the same approach is approved.
    writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', '1. Must — tokens reach the log — fixed — risk: security'), r(2, 'diff', OPEN)) });
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a ticket claimed under 0.4.0 is approved over a record with a line accord cannot read (ST-LN-91 CR-01)', async () => {
  const bad = rec(r(1, 'whole', '1. Must — tokens reach the log — open — risk: auth', '2. Must/Should — a name — open'), r(2, 'diff', OPEN));
  const repo = claimed('0.4.0', bad);
  try {
    const short = await run(['show', 'T-1', '--approval', '--short'], repo);
    expect(short.out).not.toContain('## Blocking findings');
    const approved = await run(['approve', 'T-1'], repo);
    expect(approved.code).toBe(0);
    expect(approved.out).toMatch(/^approved /);
    expect(readFileSync(join(repo, TICKET), 'utf8')).toContain('approved_hash');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security accord approve reads the critic block as printed and refuses a risk written in backticks, through the CLI (ST-LN-91 CR-02 round 4)', async () => {
  const block = ['1. Must — tokens reach the log — open', '   failing case: a login with a bad password → the token is written to app.log', '   rests on: risk: security'].join('\n');
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', block), r(2, 'diff', 'No findings')));
  try {
    const refused = await run(['approve', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('Round 1:\n1. Must — tokens reach the log — open\n');
    const short = await run(['show', 'T-1', '--approval', '--short'], repo);
    const lines = short.out.split('\n');
    expect(lines.indexOf('- round 1: 1. Must — tokens reach the log — open')).toBeGreaterThan(lines.indexOf('## Blocking findings'));
    // Fixed, the block closes the finding and the approval goes through.
    writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', block.replace('open', 'fixed')), r(2, 'diff', 'No findings')) });
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security accord approve never reads prose for a risk: an unmarked prose risk is listed under Risks and does not block; a mark slot that does not parse refuses (ST-LN-91 CR-02 round 5)', async () => {
  const prose = [
    '1. Must — tokens reach the log — open — security risk',
    '1. Must — tokens reach the log — open — data-loss risk',
    '1. Must - tokens reach the log - open - risk: security',
    '1. Must — a fetch prunes early; add a `risk:data-loss` test — open',
  ];
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', prose[0]), r(2, 'diff', 'No findings')));
  try {
    for (const line of prose) {
      writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', line), r(2, 'diff', 'No findings — 1.1 aside, risk: security remains in the log path')) });
      const short = await run(['show', 'T-1', '--approval', '--short'], repo);
      expect(short.code, line).toBe(0);
      expect(short.out, line).not.toContain('## Blocking findings');
      const lines = short.out.split('\n');
      expect(lines.indexOf('- round 1: ' + line), line).toBeGreaterThan(lines.indexOf('## Risks'));
    }
    // The same finding with the mark slot written in a form that does not parse: a record problem, so approve refuses.
    writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', '1. Must — tokens reach the log — open — risks: security'), r(2, 'diff', 'No findings')) });
    const refused = await run(['approve', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('Record problems:\n');
    expect(refused.out).toContain('a mark accord cannot read');
    // The prose forms are approved with the risks shown.
    writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', prose[0]), r(2, 'diff', 'No findings')) });
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);
