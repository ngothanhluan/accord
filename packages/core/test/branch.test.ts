import { describe, expect, it } from 'vitest';
import { branchTemplateOf } from '../src/status/branch.js';
import {
  branchFieldsOf,
  branchIdCandidates,
  branchTypesOf,
  DEFAULT_BRANCH_TYPES,
  expandBranchTypes,
  loadConfig,
  loadSnapshot,
  pickBranchId,
  renderBranch,
  slugOf,
} from '../src/index.js';
import { CONFIG } from '../../../test/helpers/lane.js';

it('risk:parsing branchTemplateOf reads only branch and never throws', () => {
  expect(branchTemplateOf('')).toBeUndefined();
  expect(branchTemplateOf('branch: [\n')).toBeUndefined();
  expect(branchTemplateOf('branch: [a]\n')).toBeUndefined();
  expect(branchTemplateOf('profile: build\n')).toBeUndefined();
  expect(branchTemplateOf('branch: "feature/{id}"\nunknown: 1\n')).toBe('feature/{id}');
});

it('risk:parsing branchTemplateOf drops a template the schema refuses', () => {
  expect(branchTemplateOf('branch: "{id}"\n')).toBeUndefined();
  expect(branchTemplateOf('branch: "feature/..{id}"\n')).toBeUndefined();
});

// Issue #341: the {type} and {slug} tokens of the claim branch template.
describe('slugOf (D-03)', () => {
  it('risk:parsing slugOf gives ASCII kebab-case, drops what NFKD does not unmark, and cuts without a trailing hyphen', () => {
    expect(slugOf('Order total is null', 40)).toBe('order-total-is-null');
    expect(slugOf('Exportation des données', 40)).toBe('exportation-des-donnees');
    expect(slugOf('Đơn hàng mới', 40)).toBe('on-hang-moi');
    expect(slugOf('  --Hello,   World!--  ', 40)).toBe('hello-world');
    expect(slugOf('日本語', 40)).toBe('');
    expect(slugOf('Order total', 5)).toBe('order');
    expect(slugOf('Order total', 6)).toBe('order');
  });
});

describe('renderBranch (D-03, D-08, R-2, R-4)', () => {
  const T = '{type}/{id}-{slug}';
  it('risk:parsing renderBranch fills the three tokens and keeps {type} literal for an unlisted word', () => {
    expect(renderBranch(T, { id: 'ST-9', title: 'Export', change: 'fix' })).toBe('fix/ST-9-export');
    expect(renderBranch(T, { id: 'ST-9', title: 'Export', change: 'wip' })).toBe('{type}/ST-9-export');
    expect(renderBranch(T, { id: 'ST-9', title: 'Export' })).toBe('{type}/ST-9-export');
    expect(renderBranch(T, { id: 'ST-9', title: 'Export', change: 'feature' }, { branch_types: ['feature'] })).toBe('feature/ST-9-export');
    expect(renderBranch(T, { id: 'ST-9', title: 'Export', change: 'fix' }, { branch_slug_length: '3' })).toBe('fix/ST-9-exp');
    expect(renderBranch(T, { id: 'ST-9', title: '日本語', change: 'fix' })).toBe('fix/ST-9-ticket');
    expect(renderBranch('t/{id}', { id: 'ST-9', title: 'Export' })).toBe('t/ST-9');
    expect(branchTypesOf(undefined)).toEqual([...DEFAULT_BRANCH_TYPES]);
    expect(DEFAULT_BRANCH_TYPES).toEqual(['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'revert', 'hotfix']);
  });
});

describe('expandBranchTypes (D-11)', () => {
  it('risk:parsing expandBranchTypes writes one template per listed word, keeps templates without {type}, and collapses duplicates', () => {
    expect(expandBranchTypes(['t/{id}', '{type}/{id}-{slug}'], ['fix', 'feat'])).toEqual(['t/{id}', 'fix/{id}-{slug}', 'feat/{id}-{slug}']);
    expect(expandBranchTypes(['t/{id}', 't/{id}', 'feature/{id}'], ['fix'])).toEqual(['t/{id}', 'feature/{id}']);
  });
});

describe('branchIdCandidates (D-07, D-11, R-13)', () => {
  it('risk:parsing branchIdCandidates lists every id slice, shortest first, and nothing for a foreign name', () => {
    expect(branchIdCandidates('fix/ST-LN-13-add-retries', 'fix/{id}-{slug}')).toEqual(['ST', 'ST-LN', 'ST-LN-13', 'ST-LN-13-add']);
    expect(branchIdCandidates('wip/ST-9-x', 'fix/{id}-{slug}')).toEqual([]);
    expect(branchIdCandidates('drop/ST-9-x', 'fix/{id}-{slug}')).toEqual([]);
    expect(branchIdCandidates('t/ST-9', 'fix/{id}-{slug}')).toEqual([]);
    expect(branchIdCandidates('fix/ST-9-a/b', 'fix/{id}-{slug}')).toEqual([]);
    expect(branchIdCandidates('fix/ST-9-x', '{type}/{id}-{slug}')).toEqual([]);
    expect(branchIdCandidates('feature/ST-1', 'feature/{id}')).toEqual(['ST-1']);
    expect(branchIdCandidates('t/ST-1', 't/{id}')).toEqual(['ST-1']);
    expect(branchIdCandidates('fix/ST-' + 'a'.repeat(260), 'fix/{id}-{slug}')).toEqual([]);
  });
});

describe('pickBranchId (D-07a, R-12)', () => {
  const people = { people: { 'a@x.test': 'LN' } };
  const c1 = branchIdCandidates('fix/ST-AB-5-add-retries', 'fix/{id}-{slug}');
  it('risk:complex-branching pickBranchId prefers a known id, then the id shape of the repository, then the shortest', () => {
    expect(pickBranchId(c1, () => false, people)).toBe('ST-AB-5');
    expect(pickBranchId(c1, (id) => id === 'ST-AB', people)).toBe('ST-AB');
    expect(pickBranchId(c1, () => false, undefined)).toBe('ST');
    expect(pickBranchId([], () => false, people)).toBeUndefined();
    const tracker = { ids: { mode: 'tracker' as const, projects: ['CSA'] } };
    expect(pickBranchId(branchIdCandidates('fix/CSA-185-404-page', 'fix/{id}-{slug}'), () => false, tracker)).toBe('CSA-185');
    expect(pickBranchId(c1, () => false, { people: {}, legacy_ids: ['ST-AB'] })).toBe('ST-AB');
  });
});

describe('branchFieldsOf', () => {
  it('risk:parsing branchFieldsOf reads title and change from the frontmatter and never throws', () => {
    expect(branchFieldsOf('---\nid: A-1\ntitle: "Export it"\nchange: fix\n---\nbody')).toEqual({ title: 'Export it', change: 'fix' });
    expect(branchFieldsOf('no frontmatter')).toEqual({});
    expect(branchFieldsOf('---\n: [\n---\n')).toEqual({});
  });
});

describe('the new config keys and change: through the schema', () => {
  const ok = (extra: string) => expect(loadConfig('accord/config.yml', CONFIG + extra).findings).toEqual([]);
  const bad = (extra: string) => expect(loadConfig('accord/config.yml', CONFIG + extra).findings.length).toBeGreaterThan(0);
  it('risk:parsing branch_types and branch_slug_length accept what the plan lists and refuse the rest', () => {
    ok('branch_types: [feat, fix]\n');
    ok('branch_types: [t]\n');
    ok('branch_types: [drop]\n');
    bad('branch_types: []\n');
    bad('branch_types: [Feat]\n');
    bad('branch_types: [fix, fix]\n');
    ok('branch_slug_length: "40"\n');
    bad('branch_slug_length: "0"\n');
    bad('branch_slug_length: "100"\n');
    bad('branch_slug_length: "x"\n');
  });
  it('risk:parsing a ticket takes change: fix and refuses change: Fix', () => {
    const run = (change: string) => {
      const files = {
        'accord/config.yml': CONFIG,
        'accord/tickets/T-1.md': `---\nid: T-1\ntitle: "Export"\ntype: story\nstatus: draft\nchange: ${change}\n---\n`,
      };
      return loadSnapshot({ files, tree: Object.keys(files).sort() }).errors.filter((f) => f.file === 'accord/tickets/T-1.md');
    };
    expect(run('fix')).toEqual([]);
    expect(run('Fix').length).toBeGreaterThan(0);
  });
});
