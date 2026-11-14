// CLI-05 status goldens (D-91, D-92, D-93). Rows cover the whole repository, so the case table is one
// row per fixture. Regenerate one with `npm test -- --project core status -u -t "<case name>"`.
import { beforeAll, describe, expect, it } from 'vitest';
import { anchorText, checkFixDispatch, laneRHash, loadSnapshot, statusRows } from '../src/index.js';
import { doneOnDefault, isDone } from '../src/status/stage.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import type { RepoSnapshot, SnapshotInput, StatusRow } from '../src/index.js';
import { readFixture, stableJson } from './helpers/fixture.js';

interface Case {
  name: string;
  input: () => SnapshotInput;
}

/**
 * No fixture on disk carries `status: archived`, and adding one would move every Phase 1 to 4 golden
 * that pins `valid-build`. The archived ticket is spread onto the SnapshotInput here instead.
 */
const ARCHIVED_PATH = 'accord/tickets/OLD-1.md';
const ARCHIVED_TICKET = `---
id: OLD-1
title: Social sign-in
type: story
status: archived
parent: EPIC-1
ui: false
---

## Intent
Dropped; kept for reference.

## Requirements
- WHEN the user picks social sign-in the system SHALL open the provider

## Acceptance criteria
\`\`\`gherkin
Feature: OLD-1

  @ac-1
  Scenario: Sign in with Google
    When they pick Google
    Then they see the dashboard
\`\`\`

## Open questions
- [x] Restore it? No.

## Plan
- [x] Removed
`;

function withArchived(): SnapshotInput {
  const base = readFixture('valid-build');
  return {
    files: { ...base.files, [ARCHIVED_PATH]: ARCHIVED_TICKET },
    tree: [...base.tree, ARCHIVED_PATH].sort(),
  };
}

const CASES: Case[] = [
  { name: 'valid-build', input: () => readFixture('valid-build') },
  { name: 'gate-ready', input: () => readFixture('gate-ready') },
  { name: 'gate-done', input: () => readFixture('gate-done') },
  { name: 'frontmatter-errors', input: () => readFixture('frontmatter-errors') },
  { name: 'archived', input: withArchived },
];

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
// Outline order: a parentless row keys on its own id, so a parent sorts with its children.
const order = (a: StatusRow, b: StatusRow) => cmp(a.parent ?? a.id, b.parent ?? b.id) || cmp(a.id, b.id);

for (const row of CASES) {
  describe('status case ' + row.name, () => {
    let rows: StatusRow[];
    // Read inside the hook, never at collection time, so a `-t` filter never touches a sibling fixture.
    beforeAll(() => {
      rows = statusRows(loadSnapshot(row.input()));
    });

    it('matches its golden', async () => {
      await expect(stableJson(rows)).toMatchFileSnapshot('./__golden__/' + row.name + '.status.json');
    });

    it('is sorted by parent then id (D-92) and carries no undefined or null value (D-54)', () => {
      expect([...rows].sort(order)).toEqual(rows);
      expect(JSON.stringify(rows)).not.toContain('null');
      for (const r of rows) for (const v of Object.values(r)) expect(v).not.toBeUndefined();
    });
  });
}

describe('status valid-build: pinned values', () => {
  let rows: StatusRow[];
  beforeAll(() => {
    rows = statusRows(loadSnapshot(readFixture('valid-build')));
  });

  it('places the parentless epic before its child (D-92)', () => {
    expect(rows.map((r) => r.id)).toEqual(['EPIC-1', 'LOGIN-1']);
  });

  it('reports no recorded hash as none, not as a verdict (D-91)', () => {
    const login = rows[1];
    expect(login).toMatchObject({ ready: 'none', ticksBinding: 'none', ticksVerified: 1, ticksTagged: 2 });
    expect(login.tracker).toEqual({ shortcut: '1234', jira: '1e3' });
  });

  it('gives an epic none in both derived columns and no tick counts', () => {
    expect(rows[0]).toMatchObject({ ready: 'none', ticksBinding: 'none', ticksVerified: 0, ticksTagged: 0 });
  });

  it('is pure: two calls agree and the snapshot is untouched', () => {
    const snapshot = loadSnapshot(readFixture('valid-build'));
    const before = structuredClone(snapshot);
    const first = stableJson(statusRows(snapshot));
    expect(stableJson(statusRows(snapshot))).toBe(first);
    expect(snapshot).toEqual(before);
  });
});

describe('status gate-done: the recorded hashes drive the derived columns (D-91, D-76)', () => {
  let byId: Record<string, StatusRow>;
  beforeAll(() => {
    byId = Object.fromEntries(statusRows(loadSnapshot(readFixture('gate-done'))).map((r) => [r.id, r]));
  });

  it('reads ok/bound when the recorded hash equals the computed one', () => {
    expect(byId.PASS).toMatchObject({ ready: 'ok', ticksBinding: 'bound' });
  });

  it('reads stale when the recorded hash differs', () => {
    expect(byId.STALE).toMatchObject({ ready: 'stale', ticksBinding: 'stale' });
  });

  it('reads none for a verified_hash that was never written', () => {
    expect(byId.TICKS).toMatchObject({ ready: 'ok', ticksBinding: 'none', ticksVerified: 2 });
  });
});

describe('status edge cases a golden cannot express', () => {
  it('keeps an archived ticket in the result; filtering is the caller (D-93)', () => {
    const old = statusRows(loadSnapshot(withArchived())).find((r) => r.id === 'OLD-1');
    expect(old?.status).toBe('archived');
  });

  /**
   * No fixture distinguishes the two sort rules: every fixture's only parentless row is `EPIC-1`,
   * which leads under `parent ?? ''` and under `parent ?? id` alike. A second parentless ticket
   * whose id sorts after the epic is what separates them — under `parent ?? ''` it would join the
   * epic in a block above `LOGIN-1`; outline order leaves it after the group it is not part of.
   */
  it('sorts a parentless ticket by its own id, not into a block above every child (D-92)', () => {
    const base = readFixture('valid-build');
    const path = 'accord/tickets/ZZZ-9.md';
    const orphan = ARCHIVED_TICKET.replace('id: OLD-1', 'id: ZZZ-9')
      .replace('Feature: OLD-1', 'Feature: ZZZ-9')
      .replace('status: archived', 'status: draft')
      .replace('parent: EPIC-1\n', '');
    const rows = statusRows(
      loadSnapshot({ files: { ...base.files, [path]: orphan }, tree: [...base.tree, path].sort() }),
    );
    expect(rows.map((r) => r.id)).toEqual(['EPIC-1', 'LOGIN-1', 'ZZZ-9']);
  });

  it('gives a ticket whose frontmatter failed the schema a row with its id, its errors, and no type key', () => {
    const rows = statusRows(loadSnapshot(readFixture('frontmatter-errors')));
    const broken = rows.find((r) => r.id === 'NOFM');
    expect(broken).toBeDefined();
    // Object.hasOwn, not a truthiness test: a legitimately falsy value must not pass this.
    expect(Object.hasOwn(broken as object, 'type')).toBe(false);
    expect(Object.hasOwn(broken as object, 'status')).toBe(false);
    expect(broken?.errors).toBeGreaterThan(0);
  });
});

// ST-LN-94 94-ac-5, D-10: a lane R ticket has its own stages, read from ac_hash and from the records its research: lists.
describe('lane R stages', () => {
  const REC_PATH = 'accord/research/2026-11-14-critic.md';
  const REC = '# Critic rounds\n\nDate: 2026-11-14. Repository at `1c5704e`.\nOwner: write now — "enough"\n';
  const R_BODY = ['## Question', 'Does the critic need a second round?', '', '## Timebox', '4 hours', '', '## Token budget', '800k weighted tokens', '', '## Decisions', '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "fine"', ''].join('\n');
  const rTicket = (fm: string[] = []) => laneTicket('R-1', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${REC_PATH}"]`, ...fm] });
  const hash = laneRHash(loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/R-1.md': rTicket() }, tree: [] }).tickets['R-1']);
  const load = (fm: string[], record: boolean) =>
    loadSnapshot({
      files: {
        'accord/config.yml': CONFIG,
        'accord/tickets/R-1.md': rTicket(fm),
        'accord/tickets/T-2.md': laneTicket('T-2', { frontmatter: ['depends_on: ["R-1"]'] }),
        ...(record ? { [REC_PATH]: REC } : {}),
      },
      tree: [],
    });
  const row = (s: RepoSnapshot, id = 'R-1') => statusRows(s).find((r) => r.id === id);

  it("risk:regression the anchor prints a lane R ticket's own facts (ST-LN-94 94-ac-5)", () => {
    expect(anchorText(load([`ac_hash: "${hash}"`], false), 'R-1')).toBe(
      [
        '# Anchor: R-1 "Export"',
        '',
        'Lane: R',
        'Stage: research, next: the research, accord budget <id> between steps, and the record under accord/research/ listed in research: (lane-r.md)',
        '',
        '## Question',
        'Does the critic need a second round?',
        '',
        '## Timebox',
        '4 hours',
        '',
        '## Token budget',
        '800k weighted tokens',
        '',
        '## Decisions',
        '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "fine"',
        '',
        '## Research',
        REC_PATH,
        '',
        '## Rulings',
        '(none)',
        '',
      ].join('\n'),
    );
    // At intent the anchor names what Ready needs; Vetoes and Corrections print when the ticket has them.
    const text = anchorText(loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/R-1.md': rTicket() + '\n## Vetoes\n- No new package.\n' }, tree: [] }), 'R-1') ?? '';
    expect(text).toContain('Lane: R\nStage: intent, next: write ## Question, ask the owner to set ## Timebox and ## Token budget');
    expect(text).toContain('## Vetoes\n- No new package.');
    expect(text).not.toContain('## Intent');
    expect(text).not.toContain('## Corrections');
  });

  it('risk:complex-branching a lane R ticket moves from intent to research to done on its records (ST-LN-94 94-ac-5)', () => {
    const intent = load([], false);
    expect(row(intent)).toMatchObject({ lane: 'R', stage: 'intent', ready: 'none', tasksDone: 0, tasksTotal: 0 });
    for (const s of ['## Question', '## Timebox', '## Token budget', '## Decisions', 'accord gate ready']) expect(row(intent)?.next).toContain(s);
    // A stale ac_hash (the question changed after gate ready) is intent again.
    expect(row(load(['ac_hash: "fnv1a64:0000000000000000"'], true))?.stage).toBe('intent');
    const research = load([`ac_hash: "${hash}"`], false);
    expect(row(research)).toMatchObject({ lane: 'R', stage: 'research', ready: 'ok', tasksDone: 0 });
    expect(row(research)?.next).toContain('accord budget <id>');
    expect(row(research)?.next).toContain('accord/research/');
    // A listed path that is not a Markdown record under accord/research/ never makes it done.
    const odd = loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/R-1.md': rTicket([`ac_hash: "${hash}"`]).replace(REC_PATH, 'accord/research/notes.txt'), 'accord/research/notes.txt': 'x\n' }, tree: [] });
    expect(row(odd)?.stage).toBe('research');
    const finished = load([`ac_hash: "${hash}"`], true);
    expect(row(finished)).toMatchObject({ stage: 'done', next: 'the pull request; run accord gate done (lane-r.md)' });
    expect([intent, research, finished].map((s) => isDone(s, 'R-1'))).toEqual([false, false, true]);
    // Dependants: done on the default ref the host read, else in the checkout.
    expect(row(research, 'T-2')?.blockedBy).toEqual(['R-1']);
    expect(row(finished, 'T-2')?.blockedBy).toEqual([]);
    const ref = (s: RepoSnapshot) => ({ ...finished, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: s } });
    expect(row(ref(research), 'T-2')?.blockedBy).toEqual(['R-1']);
    expect(row(ref(finished), 'T-2')?.blockedBy).toEqual([]);
    expect(doneOnDefault(ref(research), 'R-1')).toBe(false);
    expect(doneOnDefault(ref(finished), 'R-1')).toBe(true);
    // An R ticket never reaches review, so the fix-dispatch check never acts on it.
    for (const s of [intent, research, finished]) {
      expect(['intent', 'research', 'done']).toContain(row(s)?.stage);
      expect(checkFixDispatch(s, 'R-1', 'opus')).toBeUndefined();
    }
  });
});
