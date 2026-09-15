// Phase 4 gate goldens. Gate results are ticket-scoped, so the case table is explicit rather than a
// directory scan. Regenerate one with `npm test -- --project core gate -u -t "<case name>"`.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { Finding, LintResult, RepoSnapshot } from '../src/index.js';
import { gateDone, gateReady } from '../src/gate/index.js';
import type { GateResult } from '../src/gate/index.js';
import { isSha, shaEqual } from '../src/gate/done.js';
import { downgradeMaintain, DONE_RULES, MAINTAIN_DOWNGRADE, READY_PROMOTE, READY_RULES } from '../src/gate/rules.js';
import { RULES } from '../src/lint/rules.js';
import { renderText } from '../src/lint/render.js';
import { readFixture, stableJson } from './helpers/fixture.js';

type Git = { commit: string; authors: Record<string, string> };

interface Case {
  name: string;
  fixture: string;
  ticket: string;
  gate: 'ready' | 'done';
  // D-78 host facts. A fixture on disk cannot carry them: readFixture derives `tree` from the files it
  // finds, so `git` is spread onto the SnapshotInput here instead.
  git?: Git;
}

const COMMIT = '1234567890abcdef1234567890abcdef12345678';
const DEV = 'dev@example.test';
const REVIEWER = 'reviewer@example.test';

/**
 * The gated commit every Done case uses; `1234567` is its abbreviation. `authors` must cover every
 * review file on disk in every fixture a `GIT`-carrying row drives, not only `gate-done`: in a real
 * repository `gitFacts` walks `git log --name-only -- accord/tickets` and yields an author for every
 * tracked review file, so a path missing here would make `gate.author-skipped` fire on a hole in the
 * test data rather than on a fact about the ticket. The deliberate skipped case is `PASS.noauthors`.
 */
const GIT: Git = {
  commit: COMMIT,
  // D-78: the gated commit's author rides under a key equal to `commit`; a sha can never collide with
  // a repo-relative path, so one flat record serves both key sets.
  authors: {
    [COMMIT]: DEV,
    // SOLO is the one ticket whose review carries the commit author, so GATE-05 fires on it alone.
    'accord/tickets/SOLO/verification.md': DEV,
    'accord/tickets/BLOCKED/verification.md': REVIEWER,
    'accord/tickets/COMMIT/verification.md': REVIEWER,
    'accord/tickets/EVIDENCE/verification.md': REVIEWER,
    'accord/tickets/MACHINE/verification.md': REVIEWER,
    'accord/tickets/NOTES/verification.md': REVIEWER,
    'accord/tickets/PASS/verification.md': REVIEWER,
    'accord/tickets/REVIEW/verification.md': REVIEWER,
    'accord/tickets/SETS/verification.md': REVIEWER,
    'accord/tickets/STALE/verification.md': REVIEWER,
    'accord/tickets/TICKS/verification.md': REVIEWER,
    'accord/tickets/UINOTE/verification.md': REVIEWER,
    // The two review files outside `gate-done` that a GIT-carrying row drives.
    'accord/tickets/A/verification.md': REVIEWER,
    'accord/tickets/GONE/verification.md': REVIEWER,
  },
};

const CASES: Case[] = [
  { name: 'valid-build.LOGIN-1.ready', fixture: 'valid-build', ticket: 'LOGIN-1', gate: 'ready' },
  { name: 'gate-ready.CLEAN.ready', fixture: 'gate-ready', ticket: 'CLEAN', gate: 'ready' },
  { name: 'gate-ready.HYGIENE.ready', fixture: 'gate-ready', ticket: 'HYGIENE', gate: 'ready' },
  { name: 'gate-ready.NOUI.ready', fixture: 'gate-ready', ticket: 'NOUI', gate: 'ready' },
  { name: 'gate-ready.UINOREF.ready', fixture: 'gate-ready', ticket: 'UINOREF', gate: 'ready' },
  { name: 'gate-ready.SCHEMA.ready', fixture: 'gate-ready', ticket: 'SCHEMA', gate: 'ready' },
  { name: 'gate-ready.THIN.ready', fixture: 'gate-ready', ticket: 'THIN', gate: 'ready' },
  { name: 'gate-maintain.UIPROTO.ready', fixture: 'gate-maintain', ticket: 'UIPROTO', gate: 'ready' },
  { name: 'gate-maintain.UILINK.ready', fixture: 'gate-maintain', ticket: 'UILINK', gate: 'ready' },
  { name: 'gate-done.PASS.ready', fixture: 'gate-done', ticket: 'PASS', gate: 'ready', git: GIT },
  { name: 'gate-done.PASS.done', fixture: 'gate-done', ticket: 'PASS', gate: 'done', git: GIT },
  { name: 'gate-done.SETS.done', fixture: 'gate-done', ticket: 'SETS', gate: 'done', git: GIT },
  { name: 'gate-done.BLOCKED.done', fixture: 'gate-done', ticket: 'BLOCKED', gate: 'done', git: GIT },
  { name: 'gate-done.NOVERIF.done', fixture: 'gate-done', ticket: 'NOVERIF', gate: 'done', git: GIT },
  { name: 'gate-done.EMPTY.done', fixture: 'gate-done', ticket: 'EMPTY', gate: 'done', git: GIT },
  { name: 'gate-done.STALE.done', fixture: 'gate-done', ticket: 'STALE', gate: 'done', git: GIT },
  { name: 'gate-done.TICKS.done', fixture: 'gate-done', ticket: 'TICKS', gate: 'done', git: GIT },
  { name: 'gate-done.COMMIT.done', fixture: 'gate-done', ticket: 'COMMIT', gate: 'done', git: GIT },
  { name: 'gate-done.REVIEW.done', fixture: 'gate-done', ticket: 'REVIEW', gate: 'done', git: GIT },
  { name: 'gate-done.EVIDENCE.done', fixture: 'gate-done', ticket: 'EVIDENCE', gate: 'done', git: GIT },
  { name: 'gate-done.NOTES.done', fixture: 'gate-done', ticket: 'NOTES', gate: 'done', git: GIT },
  { name: 'gate-done.UINOTE.done', fixture: 'gate-done', ticket: 'UINOTE', gate: 'done', git: GIT },
  { name: 'gate-done.MACHINE.done', fixture: 'gate-done', ticket: 'MACHINE', gate: 'done', git: GIT },
  { name: 'gate-done.SOLO.done', fixture: 'gate-done', ticket: 'SOLO', gate: 'done', git: GIT },
  // GATE-05's other branch: the same ticket with a host that supplied no author at all.
  {
    name: 'gate-done.PASS.noauthors.done',
    fixture: 'gate-done',
    ticket: 'PASS',
    gate: 'done',
    git: { commit: COMMIT, authors: {} },
  },
  // D-80's two configuration branches: the report declared but absent, and no `tests:` key at all. The
  // second reuses the 04-01 fixture, whose config declares none, so no fixture of its own is needed.
  { name: 'gate-no-report.GONE.done', fixture: 'gate-no-report', ticket: 'GONE', gate: 'done', git: GIT },
  { name: 'gate-ready.CLEAN.done', fixture: 'gate-ready', ticket: 'CLEAN', gate: 'done', git: GIT },
  { name: 'verification-edges.A.done', fixture: 'verification-edges', ticket: 'A', gate: 'done', git: GIT },
];

const HASH = /^fnv1a64:[0-9a-f]{16}$/;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const order = (a: Finding, b: Finding) =>
  cmp(a.file, b.file) ||
  (a.line ?? 0) - (b.line ?? 0) ||
  cmp(a.rule, b.rule) ||
  cmp(a.reason, b.reason) ||
  cmp(a.pointer ?? '', b.pointer ?? '');

/** readFixture cannot carry `git`; every caller that needs host facts spreads them on afterwards. */
const input = (fixture: string, git?: Git) => ({ ...readFixture(fixture), ...(git === undefined ? {} : { git }) });
const runCase = (row: Case) =>
  (row.gate === 'done' ? gateDone : gateReady)(loadSnapshot(input(row.fixture, row.git)), row.ticket);

for (const row of CASES) {
  describe('gate case ' + row.name, () => {
    let result: GateResult;
    // Read inside the hook, never at collection time, so a `-t` filter never touches a sibling fixture.
    beforeAll(() => {
      result = runCase(row);
    });

    it('matches its golden', async () => {
      await expect(stableJson(result)).toMatchFileSnapshot('./__golden__/' + row.name + '.json');
    });

    it('is sorted, and the verdict is read off findings and nothing else (D-87)', () => {
      expect([...result.findings].sort(order)).toEqual(result.findings);
      expect(result.verdict).toBe(result.findings.some((f) => f.level === 'error') ? 'fail' : 'pass');
    });
  });
}

describe('gate ready valid-build/LOGIN-1: pinned values', () => {
  let snapshot: RepoSnapshot;
  let result: GateResult;
  beforeAll(() => {
    snapshot = loadSnapshot(readFixture('valid-build'));
    result = gateReady(snapshot, 'LOGIN-1');
  });

  it('passes with an ac_hash and exactly the three ticket-scoped lint warnings (D-86, D-89)', () => {
    expect(result.gate).toBe('ready');
    expect(result.ticket).toBe('LOGIN-1');
    expect(result.verdict).toBe('pass');
    expect(result.acHash).toMatch(HASH);
    expect(result.findings.map((f) => [f.file, f.line, f.rule, f.level])).toEqual([
      ['accord/tickets/LOGIN-1.md', 37, 'lint.test-tag-missing', 'warning'],
      ['accord/tickets/LOGIN-1.md', 42, 'lint.test-tag-missing', 'warning'],
      ['accord/tickets/LOGIN-1.md', 50, 'lint.plan-empty', 'warning'],
    ]);
  });

  it('is pure: two calls agree and the snapshot is untouched (D-87, T-03-12)', () => {
    const before = structuredClone(snapshot);
    const first = stableJson(gateReady(snapshot, 'LOGIN-1'));
    expect(stableJson(gateReady(snapshot, 'LOGIN-1'))).toBe(first);
    expect(snapshot).toEqual(before);
  });

  it('renders through the existing renderer with no adapter (D-60, D-87)', () => {
    const text = renderText(result);
    expect(text).toBe(
      'accord/tickets/LOGIN-1.md:37: warning lint.test-tag-missing scenario "Đăng nhập thành công" has no @test:<id> tag and is not @ui\n' +
        'accord/tickets/LOGIN-1.md:42: warning lint.test-tag-missing scenario "Mật khẩu sai" has no @test:<id> tag and is not @ui\n' +
        'accord/tickets/LOGIN-1.md:50: warning lint.plan-empty ticket has scenarios but ## Plan has no step\n' +
        '0 errors, 3 warnings\n',
    );
    // The same findings wrapped in a LintResult render byte-identically: the counts are derived.
    const asLint: LintResult = { findings: result.findings, errors: 0, warnings: 3 };
    expect(renderText(asLint)).toBe(text);
  });

  // Both gates, not Ready alone: every Done check is silent without a ticket, so a Done table missing
  // gate.ticket-unknown reads its verdict off an empty list and passes an id that does not exist.
  it.each([
    ['ready', gateReady],
    ['done', gateDone],
  ] as const)('gate %s: gate.ticket-unknown is the whole result for an id the snapshot does not carry', (_gate, run) => {
    const unknown = run(snapshot, 'NOPE');
    expect(unknown.verdict).toBe('fail');
    expect(unknown.findings).toEqual([
      {
        file: 'accord/tickets/NOPE.md',
        rule: 'gate.ticket-unknown',
        reason: 'no ticket NOPE in the snapshot',
        level: 'error',
      },
    ]);
    expect('acHash' in unknown).toBe(false);
  });
});

describe('gate ready gate-ready: the Ready reason set (D-89)', () => {
  let ready: Record<string, GateResult>;
  beforeAll(() => {
    const snapshot = loadSnapshot(readFixture('gate-ready'));
    ready = Object.fromEntries(
      ['CLEAN', 'HYGIENE', 'NOUI', 'UINOREF', 'SCHEMA', 'THIN'].map((id) => [id, gateReady(snapshot, id)]),
    );
  });

  it('promotes the three LINT-06 hygiene rules to error and leaves lint.vague-wording a warning', () => {
    const levels = new Map(ready.HYGIENE.findings.map((f) => [f.rule, f.level]));
    for (const rule of READY_PROMOTE) expect(levels.get(rule), rule).toBe('error');
    expect(levels.get('lint.vague-wording')).toBe('warning');
    expect(ready.HYGIENE.verdict).toBe('fail');
  });

  it('gate.design-missing fires on ui: true without a reference and is silent on ui: false', () => {
    const designMissing = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.design-missing');
    expect(designMissing(ready.NOUI)).toEqual([]);
    expect(designMissing(ready.CLEAN)).toEqual([]);
    expect(designMissing(ready.UINOREF)).toHaveLength(1);
    expect(designMissing(ready.UINOREF)[0].level).toBe('error');
    expect(ready.UINOREF.verdict).toBe('fail');
    expect(ready.NOUI.verdict).toBe('pass');
  });

  it('a schema-invalid ticket fails through the ticket-scoped loader findings alone', () => {
    expect(ready.SCHEMA.verdict).toBe('fail');
    expect(ready.SCHEMA.findings.some((f) => f.rule.startsWith('schema.') && f.level === 'error')).toBe(true);
    // Every finding stays inside the gated ticket, and no gate rule of its own is needed (D-89, D-58).
    for (const f of ready.SCHEMA.findings) expect(f.file).toBe('accord/tickets/SCHEMA.md');
    expect(ready.SCHEMA.findings.some((f) => f.rule === 'gate.design-missing')).toBe(false);
  });

  it('scope isolates one ticket from its neighbours (T-04-01)', () => {
    for (const f of ready.CLEAN.findings) expect(f.file).toBe('accord/tickets/CLEAN.md');
    expect(ready.CLEAN.findings.some((f) => f.file.includes('HYGIENE'))).toBe(false);
    expect(ready.CLEAN.verdict).toBe('pass');
  });

  it('acHash is present on a fail as well as a pass (D-86)', () => {
    for (const id of Object.keys(ready)) expect(ready[id].acHash, id).toMatch(HASH);
    expect(ready.HYGIENE.verdict).toBe('fail');
    expect(ready.CLEAN.verdict).toBe('pass');
  });
});

describe('gate ready gate-maintain: the design reference on profile maintain (docs/design.md §5)', () => {
  let ready: Record<string, GateResult>;
  beforeAll(() => {
    const snapshot = loadSnapshot(readFixture('gate-maintain'));
    ready = Object.fromEntries(['UIPROTO', 'UILINK'].map((id) => [id, gateReady(snapshot, id)]));
  });

  it('a prototype satisfies it and a design: URL does not', () => {
    expect(ready.UIPROTO.findings.filter((f) => f.rule === 'gate.design-missing')).toEqual([]);
    expect(ready.UIPROTO.verdict).toBe('pass');
    const missing = ready.UILINK.findings.filter((f) => f.rule === 'gate.design-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].level).toBe('error');
    expect(ready.UILINK.verdict).toBe('fail');
  });
});

describe('gate done gate-done: the three-set match and the evidence layer (GATE-02)', () => {
  let done: Record<string, GateResult>;
  let snapshot: RepoSnapshot;
  beforeAll(() => {
    snapshot = loadSnapshot(input('gate-done', GIT));
    done = Object.fromEntries(
      ['PASS', 'SETS', 'BLOCKED', 'NOVERIF', 'EMPTY'].map((id) => [id, gateDone(snapshot, id)]),
    );
  });

  it('PASS goes through Done end to end with no error finding (the phase end-to-end proof)', () => {
    expect(done.PASS.gate).toBe('done');
    expect(done.PASS.ticket).toBe('PASS');
    expect(done.PASS.findings.filter((f) => f.level === 'error')).toEqual([]);
    expect(done.PASS.verdict).toBe('pass');
    expect(done.PASS.acHash).toMatch(HASH);
    expect(done.PASS.acHash).toBe(snapshot.tickets.PASS.frontmatter?.ac_hash);
  });

  it('PASS also passes Ready, so it is a ticket that reached Done rather than one that skipped it', () => {
    expect(gateReady(snapshot, 'PASS').verdict).toBe('pass');
  });

  it('SETS: one gate.tags-differ naming each set gap in the fixed order, "nothing" where none', () => {
    const hits = done.SETS.findings.filter((f) => f.rule === 'gate.tags-differ');
    expect(hits).toHaveLength(1);
    expect(hits[0].level).toBe('error');
    // scenarios {ac-1, ac-2}, evidence {ac-1}, verified {ac-1, ac-3}; union {ac-1, ac-2, ac-3}.
    expect(hits[0].reason).toBe('scenarios lack @ac-3; evidence lacks @ac-2 @ac-3; verified lacks @ac-2');
    expect(done.SETS.verdict).toBe('fail');
  });

  it('three equal sets raise nothing, and the order of verified changes no byte of the result', () => {
    expect(done.PASS.findings.filter((f) => f.rule === 'gate.tags-differ')).toEqual([]);
    const flipped = input('gate-done', GIT);
    flipped.files['accord/tickets/PASS.md'] = flipped.files['accord/tickets/PASS.md'].replace(
      '  - ac-1\n  - ac-2\n',
      '  - ac-2\n  - ac-1\n',
    );
    expect(stableJson(gateDone(loadSnapshot(flipped), 'PASS'))).toBe(stableJson(done.PASS));
  });

  it('EMPTY: an epic with no tagged scenario fails on gate.no-scenarios, so three empty sets never agree', () => {
    const hits = done.EMPTY.findings.filter((f) => f.rule === 'gate.no-scenarios');
    expect(hits).toHaveLength(1);
    expect(hits[0].level).toBe('error');
    expect(done.EMPTY.findings.filter((f) => f.rule === 'gate.tags-differ')).toEqual([]);
    expect(done.EMPTY.verdict).toBe('fail');
  });

  it('BLOCKED: gate.result-not-pass names the tag and the recorded value, and fail reads the same way', () => {
    const hits = done.BLOCKED.findings.filter((f) => f.rule === 'gate.result-not-pass');
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe('evidence block "@ac-2" records Result: blocked');
    expect(hits[0].level).toBe('error');
    expect(done.BLOCKED.verdict).toBe('fail');

    const failed = input('gate-done', GIT);
    const key = 'accord/tickets/BLOCKED/verification.md';
    failed.files[key] = failed.files[key].replace('Result: blocked', 'Result: fail');
    const again = gateDone(loadSnapshot(failed), 'BLOCKED').findings.filter((f) => f.rule === 'gate.result-not-pass');
    expect(again.map((f) => f.reason)).toEqual(['evidence block "@ac-2" records Result: fail']);
  });

  it('NOVERIF: a ticket with no verification folder fails on gate.verification-missing', () => {
    const hits = done.NOVERIF.findings.filter((f) => f.rule === 'gate.verification-missing');
    expect(hits).toHaveLength(1);
    expect(hits[0].level).toBe('error');
    expect(hits[0].file).toBe('accord/tickets/NOVERIF/verification.md');
    expect(done.NOVERIF.verdict).toBe('fail');
  });

  it('is pure, deterministic, and already sorted (D-87, T-03-12)', () => {
    const before = structuredClone(snapshot);
    const first = stableJson(gateDone(snapshot, 'PASS'));
    expect(stableJson(gateDone(snapshot, 'PASS'))).toBe(first);
    expect(snapshot).toEqual(before);
    for (const id of Object.keys(done)) {
      expect([...done[id].findings].sort(order), id).toEqual(done[id].findings);
    }
  });
});

describe('shaEqual and isSha: the D-81 prefix rule, pinned in both directions', () => {
  const full = '1234567890abcdef1234567890abcdef12345678';

  it('a 7-character abbreviation matches the full sha, in either argument order', () => {
    expect(shaEqual('1234567', full)).toBe(true);
    expect(shaEqual(full, '1234567')).toBe(true);
    expect(shaEqual(full, full)).toBe(true);
  });

  it('a difference at the seventh character is not a match', () => {
    expect(shaEqual('1234568', full)).toBe(false);
    expect(shaEqual(full, '1234568')).toBe(false);
  });

  it('comparison is case-insensitive', () => {
    expect(shaEqual('ABCDEF0', 'abcdef0123')).toBe(true);
    expect(shaEqual('abcdef0123', 'ABCDEF0')).toBe(true);
  });

  it('anything shorter than 7 characters, or not hexadecimal, is not a sha and never compares equal', () => {
    expect(isSha('123456')).toBe(false);
    expect(isSha('123456g')).toBe(false);
    expect(isSha('1234567')).toBe(true);
    expect(isSha(full)).toBe(true);
    for (const bad of ['123456', '123456g', '']) {
      expect(shaEqual(bad, full), bad).toBe(false);
      expect(shaEqual(full, bad), bad).toBe(false);
    }
  });
});

describe('gate done gate-done: the identity layer (GATE-03, GATE-11, D-81)', () => {
  let done: Record<string, GateResult>;
  const rules = (id: string, prefix: string) => done[id].findings.filter((f) => f.rule.startsWith(prefix));
  beforeAll(() => {
    const snapshot = loadSnapshot(input('gate-done', GIT));
    done = Object.fromEntries(['PASS', 'STALE', 'TICKS', 'COMMIT', 'REVIEW'].map((id) => [id, gateDone(snapshot, id)]));
  });

  it('STALE: an acceptance-criteria edit after Ready fails on ac-changed, and drags the tick with it', () => {
    const changed = rules('STALE', 'gate.ac-changed');
    expect(changed).toHaveLength(1);
    expect(changed[0].level).toBe('error');
    expect(changed[0].reason).toContain('fnv1a64:deadbeefdeadbeef');
    expect(changed[0].reason).toContain('fnv1a64:0e84e174c4cdc76b');
    expect(rules('STALE', 'gate.tick-stale-hash')).toHaveLength(1);
    expect(done.STALE.verdict).toBe('fail');
  });

  it('TICKS: verified with neither binding key is exactly one tick-unbound naming both', () => {
    const unbound = rules('TICKS', 'gate.tick-unbound');
    expect(unbound).toHaveLength(1);
    expect(unbound[0].reason).toBe('verified is set but verified_hash and verified_commit are not recorded');
    expect(rules('TICKS', 'gate.tick-stale')).toEqual([]);
    expect(done.TICKS.verdict).toBe('fail');
  });

  it('an empty verified with both keys absent raises no tick-binding finding at all', () => {
    // NOVERIF carries no `verified`; the set mismatch is what fails it, not the binding.
    const noverif = gateDone(loadSnapshot(input('gate-done', GIT)), 'NOVERIF');
    expect(noverif.findings.filter((f) => f.rule.startsWith('gate.tick-'))).toEqual([]);
  });

  it('COMMIT: a valid sha that is not the gated commit fails, naming both values', () => {
    const stale = rules('COMMIT', 'gate.tick-stale-commit');
    expect(stale).toHaveLength(1);
    expect(stale[0].reason).toContain('9999999');
    expect(stale[0].reason).toContain(GIT.commit);
    expect(done.COMMIT.verdict).toBe('fail');
  });

  it('REVIEW: a review of another commit fails on the verification file, and matches when it agrees', () => {
    const stale = rules('REVIEW', 'gate.stale-review');
    expect(stale).toHaveLength(1);
    expect(stale[0].file).toBe('accord/tickets/REVIEW/verification.md');
    expect(stale[0].pointer).toBe('/commit');
    expect(done.REVIEW.verdict).toBe('fail');
    // The same ticket against the commit its review names raises nothing.
    const agreeing = { ...GIT, commit: '9999999999abcdef9999999999abcdef99999999' };
    const ok = gateDone(loadSnapshot(input('gate-done', agreeing)), 'REVIEW');
    expect(ok.findings.filter((f) => f.rule === 'gate.stale-review')).toEqual([]);
    expect(done.PASS.findings.filter((f) => f.rule === 'gate.stale-review')).toEqual([]);
  });

  it('a missing host commit fails Done rather than reporting the check skipped (D-80 reasoning)', () => {
    const noGit = gateDone(loadSnapshot(input('gate-done')), 'PASS');
    const missing = noGit.findings.filter((f) => f.rule === 'gate.commit-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].level).toBe('error');
    expect(noGit.verdict).toBe('fail');
    // GATE-05 is the one sanctioned skipped form (D-79) and it is a warning either way, so it cannot
    // stand in for a failure; no commit, evidence, note, or machine check has one.
    expect(noGit.findings.filter((f) => f.rule.endsWith('-skipped')).map((f) => [f.rule, f.level])).toEqual([
      ['gate.author-skipped', 'warning'],
    ]);
    expect(done.PASS.findings.filter((f) => f.rule === 'gate.commit-missing')).toEqual([]);
  });

  it('a too-short host commit is one sha-too-short and never also a mismatch (D-81)', () => {
    const short = gateDone(loadSnapshot(input('gate-done', { commit: 'abc123', authors: {} })), 'PASS');
    const tooShort = short.findings.filter((f) => f.rule === 'gate.sha-too-short');
    expect(tooShort).toHaveLength(1);
    expect(tooShort[0].reason).toContain('abc123');
    expect(short.findings.filter((f) => f.rule === 'gate.tick-stale-commit')).toEqual([]);
    expect(short.findings.filter((f) => f.rule === 'gate.stale-review')).toEqual([]);
    expect(short.verdict).toBe('fail');
  });

  it('NOVERIF: no recorded hash at all is gate.ac-hash-missing beside the missing review', () => {
    const noverif = gateDone(loadSnapshot(input('gate-done', GIT)), 'NOVERIF');
    for (const rule of ['gate.ac-hash-missing', 'gate.verification-missing']) {
      const hits = noverif.findings.filter((f) => f.rule === rule);
      expect(hits, rule).toHaveLength(1);
      expect(hits[0].level, rule).toBe('error');
    }
    expect(noverif.verdict).toBe('fail');
  });
});

describe('gate done verification-edges/A: the loader owns the block edges, not Done (D-40, D-42)', () => {
  let result: GateResult;
  let snapshot: RepoSnapshot;
  beforeAll(() => {
    snapshot = loadSnapshot(input('verification-edges', GIT));
    result = gateDone(snapshot, 'A');
  });

  it('reads the four distinct tags the loader kept from the duplicated headings', () => {
    expect(snapshot.verifications.A.blocks.map((b) => b.acTag)).toEqual(['ac-1', 'ac-2', 'ac-3', 'ac-4']);
  });

  it('a missing or invalid Result: is the loader rule; only blocked and fail are a gate rule', () => {
    expect(result.findings.filter((f) => f.rule === 'load.result-invalid').length).toBe(2);
    const notPass = result.findings.filter((f) => f.rule === 'gate.result-not-pass');
    expect(notPass.map((f) => f.reason)).toEqual(['evidence block "@ac-4" records Result: blocked']);
    expect(result.verdict).toBe('fail');
  });
});

// GATE-01 lets Ready pass only with valid frontmatter, intent, at least one EARS line, at least one
// tagged scenario, no LINT-06 findings, and a design reference when the profile requires it. Each clause
// names the rule ids that enforce it, so dropping a row fails a test rather than quietly re-opening the gate.
const GATE01: Record<string, string[]> = {
  'valid frontmatter': ['schema.required', 'schema.additionalProperties', 'schema.enum', 'schema.pattern'],
  intent: ['gate.intent-empty'],
  'at least one EARS line': ['gate.ears-missing'],
  'at least one tagged scenario': ['lint.no-scenarios', 'lint.ac-tag-missing'],
  'no LINT-06 findings': [...READY_PROMOTE],
  'a design reference when the profile requires it': ['gate.design-missing'],
  'the ticket exists at all': ['gate.ticket-unknown'],
};

describe('GATE-01: every clause is enforced by a rule the Ready path evaluates', () => {
  it('the gate.* ids the clauses name are exactly READY_RULES, every row at level error', () => {
    const rows = new Map<string, (typeof READY_RULES)[number]>(READY_RULES.map((r) => [r.id, r]));
    const named = Object.values(GATE01)
      .flat()
      .filter((id) => id.startsWith('gate.'));
    expect([...named].sort()).toEqual([...rows.keys()].sort());
    for (const id of named) expect(rows.get(id)?.level, id).toBe('error');
  });

  it('every lint.* and schema.* id a clause names is a rule that exists', () => {
    const lintIds = new Set<string>(RULES.map((r) => r.id));
    for (const id of Object.values(GATE01).flat()) {
      if (id.startsWith('lint.')) expect(lintIds.has(id), id).toBe(true);
    }
  });

  it('THIN fails on exactly one gate.intent-empty and one gate.ears-missing', () => {
    const thin = gateReady(loadSnapshot(readFixture('gate-ready')), 'THIN');
    for (const rule of ['gate.intent-empty', 'gate.ears-missing']) {
      const hits = thin.findings.filter((f) => f.rule === rule);
      expect(hits, rule).toHaveLength(1);
      expect(hits[0].level, rule).toBe('error');
    }
    expect(thin.verdict).toBe('fail');
  });

  it('the two rules fire on the ticket built for them and nowhere else', () => {
    const both = ['gate.intent-empty', 'gate.ears-missing'];
    const elsewhere: [string, string][] = [
      ...['CLEAN', 'HYGIENE', 'NOUI', 'UINOREF', 'SCHEMA'].map((id): [string, string] => ['gate-ready', id]),
      ...['UIPROTO', 'UILINK'].map((id): [string, string] => ['gate-maintain', id]),
      ['valid-build', 'LOGIN-1'],
    ];
    for (const [fixture, id] of elsewhere) {
      const result = gateReady(loadSnapshot(readFixture(fixture)), id);
      expect(result.findings.filter((f) => both.includes(f.rule)), fixture + '/' + id).toEqual([]);
    }
  });
});

// 04-02 extends this describe with the same synthetic rows driven through gateDone once the shared body
// exists: GATE-07 is written about the profile matrix as a whole, and a second call site is how one gate
// silently falls out of that matrix when GATE-12 flips a level.
describe('the maintain downgrade is the whole GATE-07 matrix, applied from one call site (D-88)', () => {
  const synthetic = (rule: string): Finding => ({ file: 'accord/tickets/X.md', rule, reason: 'r', level: 'error' });
  const rows = [...MAINTAIN_DOWNGRADE, 'lint.id-mismatch'].map(synthetic);

  it('forces the four listed ids to warning on maintain and leaves the control alone', () => {
    expect(downgradeMaintain(rows, 'maintain').map((f) => [f.rule, f.level])).toEqual([
      ...MAINTAIN_DOWNGRADE.map((r) => [r, 'warning']),
      ['lint.id-mismatch', 'error'],
    ]);
  });

  it('returns the input untouched on build and never mutates it', () => {
    const before = structuredClone(rows);
    expect(downgradeMaintain(rows, 'build')).toEqual(before);
    downgradeMaintain(rows, 'maintain');
    expect(rows).toEqual(before);
  });

  // The shared-body placement is observable nowhere else: every MAINTAIN_DOWNGRADE id is already a
  // warning in the real lint table, so no fixture and no golden can catch a missing call on Done.
  // Loader findings are stamped `error` by lintSnapshot (D-58), which is how a synthetic error row
  // reaches the downgrade through the ordinary path.
  it('the maintain downgrade reaches Done from the same call site Ready uses (GATE-07, D-88)', () => {
    const injected = (profile: 'build' | 'maintain'): RepoSnapshot => {
      const base = loadSnapshot(input('gate-done', GIT));
      return {
        ...base,
        config: base.config === undefined ? undefined : { ...base.config, profile },
        errors: [...base.errors, ...rows.map((f) => ({ file: 'accord/tickets/PASS.md', rule: f.rule, reason: f.reason }))],
      };
    };
    const levels = (profile: 'build' | 'maintain') =>
      new Map(
        gateDone(injected(profile), 'PASS')
          .findings.filter((f) => rows.some((r) => r.rule === f.rule))
          .map((f) => [f.rule, f.level]),
      );
    for (const id of MAINTAIN_DOWNGRADE) {
      expect(levels('maintain').get(id), id).toBe('warning');
      expect(levels('build').get(id), id).toBe('error');
    }
    expect(levels('maintain').get('lint.id-mismatch')).toBe('error');
    expect(levels('build').get('lint.id-mismatch')).toBe('error');
  });

  it('every downgraded id is a real lint rule already levelled warning, so no v0.1 fixture differs', () => {
    for (const id of MAINTAIN_DOWNGRADE) {
      const row = RULES.find((r) => r.id === id);
      expect(row, id).toBeDefined();
      expect(row?.level, id).toBe('warning');
    }
    // Disjoint from the promotion list, so the order of the two passes in gateReady cannot matter.
    expect(MAINTAIN_DOWNGRADE.filter((id) => READY_PROMOTE.includes(id))).toEqual([]);
  });
});

describe('the gate rule tables (D-57, D-59)', () => {
  it('every id is gate.<kebab-name> and unique within its table', () => {
    for (const table of [READY_RULES, DONE_RULES]) {
      const ids = table.map((r) => r.id);
      for (const id of ids) expect(id, id).toMatch(/^gate\.[a-z-]+$/);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  // Reference identity, not a shape compare: a rule both gates run must be ONE row, so a level or
  // profile change can never reach one gate and miss the other (GATE-06).
  it('a rule both tables carry is the same row object', () => {
    for (const r of READY_RULES) {
      const shared = DONE_RULES.find((d) => d.id === r.id);
      if (shared !== undefined) expect(shared, r.id).toBe(r);
    }
  });

  it('READY_PROMOTE names only real lint rule ids', () => {
    for (const id of READY_PROMOTE) expect(RULES.some((r) => r.id === id), id).toBe(true);
  });
});

// --- The Human layer (GATE-04, GATE-09, GATE-10; D-82 to D-85, D-90) ---

describe('gate done: the Human layer', () => {
  const done = (ticket: string) => gateDone(loadSnapshot(input('gate-done', GIT)), ticket);
  const pick = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);

  it('EVIDENCE: a block citing nothing real fails; a mistyped path only warns (GATE-04, D-83)', () => {
    const r = done('EVIDENCE');
    expect(pick(r, 'gate.evidence-unresolved').map((f) => [f.file, f.level])).toEqual([
      ['accord/tickets/EVIDENCE/verification.md', 'error'],
    ]);
    const warned = pick(r, 'gate.reference-unknown');
    expect(warned).toHaveLength(1);
    expect(warned[0].level).toBe('warning');
    expect(warned[0].reason).toContain('src/nope.ts');
    // @ac-2 cites a real file too, so the stray token never stands in for the error (D-83).
    expect(warned[0].line).not.toBe(pick(r, 'gate.evidence-unresolved')[0].line);
  });

  it('gate.reference-unknown can never stand in for gate.evidence-unresolved (D-83)', () => {
    expect(DONE_RULES.find((r) => r.id === 'gate.reference-unknown')?.level).toBe('warning');
    expect(DONE_RULES.find((r) => r.id === 'gate.evidence-unresolved')?.level).toBe('error');
    // @ac-2 cited a real file and mistyped one path: every finding on that block is a warning, so the
    // block passes GATE-04 and the stray token leaves the verdict alone.
    const r = done('EVIDENCE');
    const block = pick(r, 'gate.reference-unknown')[0].line;
    expect(r.findings.filter((f) => f.line === block).every((f) => f.level === 'warning')).toBe(true);
  });

  it('NOTES: one missing note, one pasted note, one note naming only an identifier (GATE-10)', () => {
    const r = done('NOTES');
    expect(pick(r, 'gate.note-missing').map((f) => f.reason)).toEqual([
      'verified lists @ac-1 but "## Verification notes" has no "### @ac-1" block',
    ]);
    expect(pick(r, 'gate.note-pasted')).toHaveLength(1);
    // D-84: core holds no source text, so a capitalised word is never accepted as a symbol.
    expect(pick(r, 'gate.note-unresolved')).toHaveLength(1);
    // Two failing notes carry distinct lines, before and after the engine sort (GATE-10 ordering).
    const lines = r.findings.filter((f) => f.rule.startsWith('gate.note-')).map((f) => f.line);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('UINOTE: a @ui scenario gets exactly the same note rule, no stricter variant (D-90, GATE-09)', () => {
    const r = done('UINOTE');
    const pasted = pick(r, 'gate.note-pasted');
    expect(pasted).toHaveLength(1);
    // @ac-1's note names a file and says something of its own, so only @ac-2 fails.
    expect(pasted[0].reason).toContain('"@ac-2"');
    expect(pick(r, 'gate.note-missing')).toEqual([]);
    expect(pick(r, 'gate.note-unresolved')).toEqual([]);
    // No @ui-specific rule exists to be exempted or tightened. `profiles: ['build', ...]` contains the
    // letters `ui`, so the match is anchored on the id and nothing else.
    expect(DONE_RULES.filter((row) => row.id.includes('ui'))).toEqual([]);
  });

  it('PASS still goes through Done with no error finding after the Human layer lands', () => {
    const r = done('PASS');
    expect(r.findings.filter((f) => f.level === 'error')).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('interleaved Done and Ready calls are byte-identical and leave the snapshot untouched', () => {
    const snapshot = loadSnapshot(input('gate-done', GIT));
    const before = structuredClone(snapshot);
    const done1 = stableJson(gateDone(snapshot, 'PASS'));
    const ready1 = stableJson(gateReady(snapshot, 'PASS'));
    const done2 = stableJson(gateDone(snapshot, 'PASS'));
    const ready2 = stableJson(gateReady(snapshot, 'PASS'));
    expect(done2).toBe(done1);
    expect(ready2).toBe(ready1);
    expect(snapshot).toEqual(before);
  });
});

// --- The Machine layer (GATE-08, D-80) ---

describe('gate done: the Machine layer', () => {
  const done = (fixture: string, ticket: string) => gateDone(loadSnapshot(input(fixture, GIT)), ticket);
  const pick = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);
  /** gate-done with one edit applied to the PASS ticket and one to the report, run through Done. */
  const patched = (ticket: (md: string) => string, report: (xml: string) => string = (x) => x) => {
    const raw = input('gate-done', GIT);
    raw.files['accord/tickets/PASS.md'] = ticket(raw.files['accord/tickets/PASS.md']);
    raw.files['reports/junit.xml'] = report(raw.files['reports/junit.xml']);
    return gateDone(loadSnapshot(raw), 'PASS');
  };

  it('MACHINE: skipped and failed both fail, an unknown id fails, an untagged scenario fails', () => {
    const r = done('gate-done', 'MACHINE');
    const notPassed = pick(r, 'gate.test-not-passed');
    expect(notPassed).toHaveLength(2);
    // The status is named verbatim, so a muted test and a broken one stay distinguishable in the output.
    expect(notPassed[0].reason).toContain('skip1');
    expect(notPassed[0].reason).toContain('skipped');
    expect(notPassed[1].reason).toContain('fail1');
    expect(notPassed[1].reason).toContain('failed');
    for (const f of notPassed) expect(f.level).toBe('error');
    expect(pick(r, 'gate.test-unknown').map((f) => f.level)).toEqual(['error']);
    expect(pick(r, 'gate.test-tag-missing').map((f) => f.level)).toEqual(['error']);
    // GATE-08 ordering: one finding per failing scenario, each on its own Scenario line.
    const lines = pick(r, 'gate.test-not-passed')
      .concat(pick(r, 'gate.test-unknown'), pick(r, 'gate.test-tag-missing'))
      .map((f) => f.line);
    expect(new Set(lines).size).toBe(4);
    expect(r.verdict).toBe('fail');
  });

  it('UINOTE: a @ui scenario is exempt from the whole machine layer (GATE-09, D-90)', () => {
    const r = done('gate-done', 'UINOTE');
    expect(r.findings.filter((f) => f.rule.startsWith('gate.test-'))).toEqual([]);
    expect(pick(r, 'gate.tests-unconfigured')).toEqual([]);
    expect(pick(r, 'gate.report-missing')).toEqual([]);
  });

  it('GONE: a declared report absent from the snapshot is one reason, not one per scenario (D-80)', () => {
    const r = done('gate-no-report', 'GONE');
    const missing = pick(r, 'gate.report-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].level).toBe('error');
    expect(missing[0].file).toBe('accord/config.yml');
    expect(missing[0].pointer).toBe('/tests/report');
    expect(missing[0].reason).toContain('reports/gone.xml');
    expect(pick(r, 'gate.test-unknown')).toEqual([]);
    expect(pick(r, 'gate.test-not-passed')).toEqual([]);
    expect(pick(r, 'gate.tests-unconfigured')).toEqual([]);
    expect(r.verdict).toBe('fail');
  });

  it('CLEAN: no tests key at all fails Done once, and never reports the check skipped (D-80)', () => {
    const r = done('gate-ready', 'CLEAN');
    const unconfigured = pick(r, 'gate.tests-unconfigured');
    expect(unconfigured).toHaveLength(1);
    expect(unconfigured[0].level).toBe('error');
    expect(unconfigured[0].file).toBe('accord/config.yml');
    expect(unconfigured[0].pointer).toBe('/tests');
    expect(unconfigured[0].reason.toLowerCase()).not.toContain('skip');
    expect(pick(r, 'gate.test-unknown')).toEqual([]);
    expect(pick(r, 'gate.test-not-passed')).toEqual([]);
    expect(pick(r, 'gate.report-missing')).toEqual([]);
    // The ticket-level rule is a property of the ticket, so the configuration reason never suppresses it.
    expect(pick(r, 'gate.test-tag-missing')).toHaveLength(1);
    expect(r.findings.some((f) => f.rule.endsWith('-skipped'))).toBe(false);
    expect(r.verdict).toBe('fail');
  });

  it('the id lookup is exact code points: no case folding, no prototype chain, no whitespace guess', () => {
    const unknown = (r: GateResult) => pick(r, 'gate.test-unknown').map((f) => f.reason);
    // Case: the report declares `#ok1`, so `#OK1` names nothing.
    expect(unknown(patched((md) => md.replace('#ok1', '#OK1')))).toEqual([
      "@test:test/login.spec.ts#OK1 not found in reports/junit.xml; ids are classname#name with spaces as '-'",
    ]);
    // Prototype chain: `toString` is a member of Object.prototype and not of the report.
    expect(unknown(patched((md) => md.replace('@test:test/login.spec.ts#ok1', '@test:toString')))).toEqual([
      "@test:toString not found in reports/junit.xml; ids are classname#name with spaces as '-'",
    ]);
    // Whitespace: the scanner writes `two-words`; the un-hyphenated spelling is a different id.
    const spaced = (xml: string) => xml.replace('name="ok1"', 'name="two words"');
    expect(unknown(patched((md) => md.replace('#ok1', '#two-words'), spaced))).toEqual([]);
    expect(unknown(patched((md) => md.replace('#ok1', '#two_words'), spaced))).toEqual([
      "@test:test/login.spec.ts#two_words not found in reports/junit.xml; ids are classname#name with spaces as '-'",
    ]);
  });

  it('PASS still goes through Done with no error finding after the Machine layer lands', () => {
    const r = done('gate-done', 'PASS');
    expect(r.findings.filter((f) => f.level === 'error')).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('every machine rule is an error on both profiles, so no flag can soften one (GATE-06)', () => {
    const ids = [
      'gate.test-tag-missing',
      'gate.tests-unconfigured',
      'gate.report-missing',
      'gate.test-unknown',
      'gate.test-not-passed',
    ];
    for (const id of ids) {
      const row = DONE_RULES.find((r) => r.id === id);
      expect(row, id).toBeDefined();
      expect(row?.level, id).toBe('error');
      expect([...(row?.profiles ?? [])].sort(), id).toEqual(['build', 'maintain']);
      expect(MAINTAIN_DOWNGRADE.includes(id), id).toBe(false);
    }
  });
});

// --- GATE-05: the author warning (D-79) ---

describe('gate done: the author check', () => {
  const done = (ticket: string, git: Git = GIT) => gateDone(loadSnapshot(input('gate-done', git)), ticket);
  const pick = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);

  it('SOLO: one warning naming the shared identity, and the verdict stays pass', () => {
    const r = done('SOLO');
    const hits = pick(r, 'gate.author-match');
    expect(hits).toHaveLength(1);
    expect(hits[0].level).toBe('warning');
    expect(hits[0].file).toBe('accord/tickets/SOLO/verification.md');
    expect(hits[0].line).toBeUndefined();
    expect(hits[0].reason).toContain(DEV);
    expect(pick(r, 'gate.author-skipped')).toEqual([]);
    // D-79: the warning never changes the verdict, or every solo ticket would be blocked.
    expect(r.findings.filter((f) => f.level === 'error')).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('PASS: a review author that differs from the commit author raises neither rule', () => {
    const r = done('PASS');
    expect(pick(r, 'gate.author-match')).toEqual([]);
    expect(pick(r, 'gate.author-skipped')).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('PASS.noauthors: a host that supplied no identity is one warning, not a silent pass', () => {
    const r = done('PASS', { commit: COMMIT, authors: {} });
    const hits = pick(r, 'gate.author-skipped');
    expect(hits).toHaveLength(1);
    expect(hits[0].level).toBe('warning');
    expect(hits[0].file).toBe('accord/tickets/PASS/verification.md');
    expect(hits[0].reason).toContain('the gated commit');
    expect(hits[0].reason).toContain('the review file');
    expect(pick(r, 'gate.author-match')).toEqual([]);
    expect(r.findings.filter((f) => f.level === 'error')).toEqual([]);
  });

  it('NOVERIF: a missing review is gate.verification-missing alone, never also an author reason', () => {
    const r = done('NOVERIF');
    expect(pick(r, 'gate.verification-missing')).toHaveLength(1);
    expect(r.findings.filter((f) => f.rule.startsWith('gate.author-'))).toEqual([]);
  });

  it('the comparison lower-cases both sides, so a difference in letter case still matches', () => {
    const shouty = { commit: COMMIT, authors: { [COMMIT]: DEV, 'accord/tickets/PASS/verification.md': 'DEV@Example.TEST' } };
    expect(pick(done('PASS', shouty), 'gate.author-match')).toHaveLength(1);
  });

  it('both rows are warnings on both profiles and can never change a verdict (D-79)', () => {
    for (const id of ['gate.author-match', 'gate.author-skipped']) {
      const row = DONE_RULES.find((r) => r.id === id);
      expect(row, id).toBeDefined();
      expect(row?.level, id).toBe('warning');
      expect([...(row?.profiles ?? [])].sort(), id).toEqual(['build', 'maintain']);
    }
  });
});
