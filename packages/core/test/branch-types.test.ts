// Issue #341 D-05, D-11: a `{type}` branch template needs a change: word the team lists (gate.change-type), and a branch_types word that is one of
// accord's own branch prefixes is warned about (lint.branch-type-root), never refused.
import { describe, expect, it } from 'vitest';
import { ACCORD_BRANCH_ROOTS, changeProblem, CONFIG_KEYS, gateReady, lintSnapshot, loadSnapshot, newKeys, OVERRIDABLE } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const TYPED = 'branch: "{type}/{id}-{slug}"\n';
const WORDS = 'feat, fix, refactor, perf, docs, test, build, ci, chore, revert, hotfix';

function snapshotOf(config: string, ticket = laneTicket('T-1'), extra?: Partial<RepoSnapshot>): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config, 'accord/tickets/T-1.md': ticket };
  return { ...loadSnapshot({ files, tree: Object.keys(files).sort() }), ...extra };
}
const lint = (config: string) => lintSnapshot(snapshotOf(config)).findings.filter((f) => f.rule === 'lint.branch-type-root');
const gate = (snapshot: RepoSnapshot) => gateReady(snapshot, 'T-1').findings.filter((f) => f.rule === 'gate.change-type');
const change = (word: string) => laneTicket('T-1', { frontmatter: [`change: ${word}`] });

describe('lint.branch-type-root (D-11, R-10)', () => {
  it('risk:regression a branch_types word that is an accord branch prefix is warned about, whatever the branch template says', () => {
    const found = lint(CONFIG + 'branch_types: [fix, drop, t]\n');
    expect(found.map((f) => [f.level, f.file, f.pointer])).toEqual([
      ['warning', 'accord/config.yml', '/branch_types/1'],
      ['warning', 'accord/config.yml', '/branch_types/2'],
    ]);
    expect(found[0].reason).toContain('drop');
    expect(found[1].reason).toContain('"t"');
    expect(lint(CONFIG + 'branch_types: [fix, feat]\n')).toEqual([]);
    expect(lint(CONFIG)).toEqual([]);
    // R-10: no {type} in branch, the listed word still warns
    expect(lint(CONFIG + 'branch: "feature/{id}"\nbranch_types: [drop]\n')).toHaveLength(1);
    expect([...ACCORD_BRANCH_ROOTS]).toEqual(['t', 'backlog', 'drop', 'conventions', 'upgrade', 'accord-task']);
  });
});

describe('gate.change-type (D-05, R-5, R-8, R-9)', () => {
  it('risk:regression a ticket with no change word, or one not listed, fails and names the words; a listed word passes', () => {
    const missing = gate(snapshotOf(CONFIG + TYPED));
    expect(missing).toHaveLength(1);
    expect(missing[0].level).toBe('error');
    expect(missing[0].pointer).toBe('/change');
    expect(missing[0].file).toBe('accord/tickets/T-1.md');
    expect(missing[0].reason).toContain('change:');
    expect(missing[0].reason).toContain(WORDS);
    const unlisted = gate(snapshotOf(CONFIG + TYPED, change('wip')));
    expect(unlisted).toHaveLength(1);
    expect(unlisted[0].reason).toContain('wip');
    expect(unlisted[0].reason).toContain(WORDS);
    expect(gate(snapshotOf(CONFIG + TYPED, change('fix')))).toEqual([]);
  });

  it("risk:regression the team's branch_types decide which words pass, and the reason names them", () => {
    const own = CONFIG + TYPED + 'branch_types: [feature, bugfix]\n';
    const fix = gate(snapshotOf(own, change('fix')));
    expect(fix).toHaveLength(1);
    expect(fix[0].reason).toContain('feature, bugfix');
    expect(fix[0].reason).not.toContain('refactor');
    expect(gate(snapshotOf(own, change('bugfix')))).toEqual([]);
  });

  it('risk:regression the rule never fires without {type} in the claim template, and skips an epic', () => {
    expect(gate(snapshotOf(CONFIG))).toEqual([]);
    expect(gate(snapshotOf(CONFIG + 'branch: "feature/{id}-{slug}"\n'))).toEqual([]);
    expect(gate(snapshotOf(CONFIG + TYPED, laneTicket('T-1').replace('type: story', 'type: epic')))).toEqual([]);
    // R-8: the claim template a claim would use decides, else the checkout's branch
    expect(gate(snapshotOf(CONFIG, laneTicket('T-1'), { claimTemplate: '{type}/{id}' }))).toHaveLength(1);
  });

  it('risk:regression both new rules may be lowered by a team (R-6)', () => {
    expect(OVERRIDABLE).toContain('gate.change-type');
    expect(OVERRIDABLE).toContain('lint.branch-type-root');
  });
});

describe('changeProblem', () => {
  it('risk:parsing changeProblem is undefined for a listed word and names the word and the list otherwise', () => {
    expect(changeProblem('fix', undefined)).toBeUndefined();
    expect(changeProblem('fix', { branch_types: ['feature'] })).toContain('fix');
    expect(changeProblem(undefined, undefined)).toContain(WORDS);
  });
});

// WR-05: 0.18.0 shipped without the two keys, so their rows say the next minor; a repository pinned to 0.18.0 that upgrades is told about both.
describe('config-keys rows of the issue #341 keys (WR-05)', () => {
  it('risk:regression a repository pinned to the released 0.18.0 hears of branch_types and branch_slug_length on upgrading to 0.19.0', () => {
    const rows = CONFIG_KEYS.filter((r) => r.key === 'branch_types' || r.key === 'branch_slug_length');
    expect(rows.map((r) => [r.key, r.since])).toEqual([
      ['branch_types', '0.19.0'],
      ['branch_slug_length', '0.19.0'],
    ]);
    expect(newKeys(CONFIG_KEYS, '0.18.0', '0.19.0', []).map((r) => r.key)).toEqual(expect.arrayContaining(['branch_types', 'branch_slug_length']));
  });
});
