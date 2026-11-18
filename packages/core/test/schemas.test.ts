import { describe, expect, it } from 'vitest';
import { loadConfig, schemaIds, validate } from '../src/index.js';
import type { SchemaFinding } from '../src/index.js';
import configSchema from '../schemas/config.schema.json' with { type: 'json' };
import verificationSchema from '../schemas/verification.schema.json' with { type: 'json' };

const minimal = {
  ticket: { id: 'TICKET-ID', title: 'Short title', type: 'story', status: 'draft' },
  verification: { ticket: 'TICKET-ID', commit: '0000000', reviewed_on: '2026-01-01' },
  // D-16 default config.yml
  config: {
    accord: '0.1.0',
    profile: 'build',
    tracker: { adapter: 'none' },
    design: { tokens: '' },
    roles: ['ba', 'dev'],
    runtimes: ['claude', 'codex', 'cursor', 'copilot'],
  },
} as const;

describe('schemas compile and accept a minimal valid document', () => {
  for (const id of schemaIds) {
    it(`${id}.schema.json accepts its minimal document`, () => {
      expect(validate(id, minimal[id])).toEqual([]);
    });
  }
});

describe('ticket schema', () => {
  it('a full D-04 ticket document is valid', () => {
    const full = {
      ...minimal.ticket,
      parent: 'EPIC-ID',
      tracker: { shortcut: '1234' },
      ui: true,
      design: 'https://www.figma.com/file/x',
      assumptions: [{ text: 'a', confirmed: false }],
      ac_hash: 'abc',
      verified: ['ac-1', 'ac-2'],
    };
    expect(validate('ticket', full)).toEqual([]);
  });

  it('an invalid ticket produces findings naming the path', async () => {
    const bad = {
      owner: 'x',
      id: '',
      title: '',
      type: 'feature',
      status: 'todo',
      tracker: { Shortcut: 1234 },
      verified: ['ac-1', 'ac-1', 'x'],
    };
    await expect(JSON.stringify(validate('ticket', bad), null, 2)).toMatchFileSnapshot(
      './__golden__/ticket.invalid.json',
    );
  });

  it('empty input yields one required finding per missing key and never throws', () => {
    const empty = validate('ticket', {});
    expect(empty).toHaveLength(4);
    for (const f of empty) {
      expect(f.rule).toBe('schema.required');
      expect(f.pointer).toBe('');
    }
    const nul = validate('ticket', null);
    expect(nul).toHaveLength(1);
    expect(nul[0]).toMatchObject({ rule: 'schema.type', pointer: '' });
  });
});

// ---------------------------------------------------------------------------
// Plan 01-03: config.yml, verification.md, and ordering acceptance criteria
// ---------------------------------------------------------------------------

/** True when some finding has exactly this (pointer, rule) pair. */
const has = (findings: SchemaFinding[], pointer: string, rule: string): boolean =>
  findings.some((f) => f.pointer === pointer && f.rule === rule);

// RESEARCH Code Example 9 probe: extra key, github-issues without repo, lonely role.
const configProbe = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'github-issues' },
  design: { tokens: '' },
  roles: ['ba'],
  runtimes: ['claude'],
  sprint: 3,
};

describe('config.schema.json', () => {
  it('the D-16 default document is valid', () => {
    expect(validate('config', { ...minimal.config, profile: 'maintain' })).toEqual([]);
    expect(validate('config', { ...minimal.config, runtimes: ['claude'] })).toEqual([]);
    expect(validate('config', { ...minimal.config, roles: ['ba', 'dev', 'designer'] })).toEqual([]);
  });

  it('github-issues requires repo; extra keys and a lonely role are named by path (golden)', async () => {
    await expect(JSON.stringify(validate('config', configProbe), null, 2)).toMatchFileSnapshot(
      './__golden__/config.invalid.json',
    );
  });

  it('github-issues with repo is valid; repo shape is checked', () => {
    const withRepo = (repo: string) => ({
      ...minimal.config,
      tracker: { adapter: 'github-issues', repo },
    });
    expect(validate('config', withRepo('owner/name'))).toEqual([]);
    expect(has(validate('config', withRepo('owner name')), '/tracker/repo', 'schema.pattern')).toBe(true);
    expect(has(validate('config', withRepo('owner/name/extra')), '/tracker/repo', 'schema.pattern')).toBe(true);
  });

  it('risk:complex-branching tracker.adapter accepts linear and refuses an unknown adapter (ST-LN-97 t3-ac-1)', () => {
    const adapter = (a: string) => validate('config', { ...minimal.config, tracker: { adapter: a } });
    expect(adapter('linear')).toEqual([]);
    expect(has(adapter('jira2'), '/tracker/adapter', 'schema.enum')).toBe(true);
  });

  it('risk:complex-branching tracker.adapter accepts exactly none, github-issues, jira, linear and script, each with its required key (ST-LN-97 t3-ac-1)', () => {
    const tracker = (t: unknown) => validate('config', { ...minimal.config, tracker: t });
    expect(tracker({ adapter: 'none' })).toEqual([]);
    expect(tracker({ adapter: 'linear' })).toEqual([]);
    expect(tracker({ adapter: 'github-issues', repo: 'o/n' })).toEqual([]);
    expect(tracker({ adapter: 'jira', url: 'https://example.atlassian.net' })).toEqual([]);
    expect(tracker({ adapter: 'script', command: 'node tracker.mjs' })).toEqual([]);
    expect(has(tracker({ adapter: 'github-issues' }), '/tracker', 'schema.required')).toBe(true);
    expect(has(tracker({ adapter: 'jira' }), '/tracker', 'schema.required')).toBe(true);
    expect(has(tracker({ adapter: 'script' }), '/tracker', 'schema.required')).toBe(true);
    expect(has(tracker({ adapter: 'jira2' }), '/tracker/adapter', 'schema.enum')).toBe(true);
    expect(has(tracker({ adapter: 'script', command: '' }), '/tracker/command', 'schema.minLength')).toBe(true);
    expect(has(tracker({ adapter: 'script', command: 'a\nb' }), '/tracker/command', 'schema.pattern')).toBe(true);
  });

  it('risk:security tracker.url is https only: http, a bare host, userinfo, a query and a space fail; a context path passes (ST-LN-97 t3-ac-2)', () => {
    const jira = (url: string) => validate('config', { ...minimal.config, tracker: { adapter: 'jira', url } });
    expect(jira('https://jira.example.com/jira')).toEqual([]);
    expect(jira('https://jira.example.com/jira/')).toEqual([]);
    expect(jira('https://example.atlassian.net')).toEqual([]);
    for (const bad of ['http://example.com', 'http://localhost:8080', 'HTTP://example.com', 'example.com', 'ftp://example.com', 'https://example.com?x=1', 'https://example.com#f', 'https://good.atlassian.net@attacker.example', 'https://user:pw@jira.example.com', 'https://exa mple.com', 'https://']) {
      expect(has(jira(bad), '/tracker/url', 'schema.pattern'), bad).toBe(true);
    }
  });

  it('design accepts only tokens', () => {
    const withSource = { ...minimal.config, design: { tokens: '', source: 'figma' } };
    expect(has(validate('config', withSource), '/design', 'schema.additionalProperties')).toBe(true);
    expect(has(validate('config', { ...minimal.config, design: {} }), '/design', 'schema.required')).toBe(true);
  });

  it('roles are ba|dev|designer, ba and dev required, no duplicates', () => {
    const roles = (r: string[]) => validate('config', { ...minimal.config, roles: r });
    expect(has(roles(['ba', 'dev', 'qa']), '/roles/2', 'schema.enum')).toBe(true);
    expect(has(roles(['dev', 'designer']), '/roles', 'schema.contains')).toBe(true);
    expect(has(roles(['ba', 'dev', 'dev']), '/roles', 'schema.uniqueItems')).toBe(true);
  });

  it('tests.report is optional; when present it is a non-empty string and the only key (D-72)', () => {
    const tests = (t: unknown) => validate('config', { ...minimal.config, tests: t });
    expect(tests({ report: 'reports/junit.xml' })).toEqual([]);
    expect(has(tests({}), '/tests', 'schema.required')).toBe(true);
    expect(has(tests({ report: '' }), '/tests/report', 'schema.minLength')).toBe(true);
    expect(has(tests({ report: 'x', extra: 1 }), '/tests', 'schema.additionalProperties')).toBe(true);
  });

  it('review.mode is human or outcome and the only key (spec §7)', () => {
    const review = (r: unknown) => validate('config', { ...minimal.config, review: r });
    expect(review({ mode: 'outcome' })).toEqual([]);
    expect(review({ mode: 'human' })).toEqual([]);
    expect(has(review({}), '/review', 'schema.required')).toBe(true);
    expect(has(review({ mode: 'both' }), '/review/mode', 'schema.enum')).toBe(true);
    expect(has(review({ mode: 'human', max_pr_lines: 400 }), '/review', 'schema.additionalProperties')).toBe(true);
  });

  it('queue.merge is owner or at-once and the only key (ST-LN-83 D-03)', () => {
    const queue = (q: unknown) => validate('config', { ...minimal.config, queue: q });
    expect(queue({})).toEqual([]);
    expect(queue({ merge: 'owner' })).toEqual([]);
    expect(queue({ merge: 'at-once' })).toEqual([]);
    expect(has(queue({ merge: 'later' }), '/queue/merge', 'schema.enum')).toBe(true);
    expect(has(queue({ merge: 'owner', extra: 1 }), '/queue', 'schema.additionalProperties')).toBe(true);
  });

  it('top-level properties are the six D-16 keys plus optional tests (D-72) review (spec §7), models, escalation, and stale_days', () => {
    const keys = ['accord', 'profile', 'tracker', 'design', 'roles', 'runtimes'];
    expect(Object.keys(configSchema.properties)).toEqual([...keys, 'tests', 'build', 'review', 'models', 'escalation', 'stale_days', 'people', 'legacy_ids', 'branch', 'setup', 'commits', 'generated', 'sensitive', 'disposable', 'queue', 'git', 'ids', 'strictness', 'template', 'titles']);
    expect(configSchema.required).toEqual(keys);
    for (const key of Object.keys(configSchema.properties)) {
      expect(key).not.toMatch(/key|token|secret|password/i);
    }
  });

  it('accord is a quoted semver string', () => {
    expect(validate('config', { ...minimal.config, accord: '0.1.0-rc.1' })).toEqual([]);
    expect(has(validate('config', { ...minimal.config, accord: 1 }), '/accord', 'schema.type')).toBe(true);
    expect(has(validate('config', { ...minimal.config, accord: 'v0.1.0' }), '/accord', 'schema.pattern')).toBe(true);
  });
});

it('risk:parsing setup is a list of non-empty command strings', () => {
  expect(validate('config', { ...minimal.config, setup: ['npm ci', 'npm run build'] })).toEqual([]);
  expect(validate('config', { ...minimal.config, setup: [] })).toEqual([]);
  expect(has(validate('config', { ...minimal.config, setup: 'npm ci' }), '/setup', 'schema.type')).toBe(true);
  expect(has(validate('config', { ...minimal.config, setup: [''] }), '/setup/0', 'schema.minLength')).toBe(true);
});

describe('verification.schema.json', () => {
  it('a minimal D-09 record is valid; full SHA and short SHA both pass', () => {
    expect(validate('verification', { ...minimal.verification, commit: '0000000' })).toEqual([]);
    expect(validate('verification', { ...minimal.verification, commit: 'a'.repeat(40) })).toEqual([]);
  });

  it('bad commit, bad date, extra reviewer are named by path (golden)', async () => {
    const bad = { ticket: 'TICKET-ID', commit: 'g', reviewed_on: '2026-9-5', reviewer: 'x' };
    await expect(JSON.stringify(validate('verification', bad), null, 2)).toMatchFileSnapshot(
      './__golden__/verification.invalid.json',
    );
  });

  it('reviewer is not a field; the git author is the proof', () => {
    expect(Object.keys(verificationSchema.properties)).toEqual(['ticket', 'commit', 'reviewed_on']);
  });
});

describe('finding order is deterministic', () => {
  it('two consecutive runs on the config probe produce identical output', () => {
    const first = JSON.stringify(validate('config', configProbe));
    const second = JSON.stringify(validate('config', configProbe));
    expect(second).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Plan 01-03 Task 2: ticket edges — tracker map (FMT-03) and D-01..D-05, D-21..D-25
// ---------------------------------------------------------------------------

const base = { id: 'TICKET-ID', title: 'Short title', type: 'story', status: 'open' };
const ticket = (extra: Record<string, unknown>) => validate('ticket', { ...base, ...extra });

describe('ticket.schema.json tracker map (FMT-03)', () => {
  it('a map keyed by adapter name with string values is valid', () => {
    expect(ticket({ tracker: { shortcut: '1234' } })).toEqual([]);
    expect(ticket({ tracker: { 'github-issues': '42' } })).toEqual([]);
    expect(ticket({ tracker: { shortcut: '1234', 'github-issues': '42' } })).toEqual([]);
  });

  it('an empty map is allowed (D-22)', () => {
    expect(ticket({ tracker: {} })).toEqual([]);
  });

  it('capitalised key, numeric value, empty value are named by path (golden)', async () => {
    const bad = ticket({ tracker: { Shortcut: '1234', shortcut: 1234, jira: '' } });
    await expect(JSON.stringify(bad, null, 2)).toMatchFileSnapshot(
      './__golden__/ticket.tracker.invalid.json',
    );
  });

  it('keys are ASCII lowercase kebab, case-sensitive; values are measured in code points', () => {
    expect(has(ticket({ tracker: { SHORTCUT: '1' } }), '/tracker', 'schema.additionalProperties')).toBe(true);
    expect(has(ticket({ tracker: { short_cut: '1' } }), '/tracker', 'schema.additionalProperties')).toBe(true);
    expect(ticket({ tracker: { 'a1-b2': '1' } })).toEqual([]);
    // 'é' is one code point (two UTF-8 bytes); minLength: 1 counts code points
    expect(ticket({ tracker: { shortcut: 'é' } })).toEqual([]);
  });
});

describe('ticket.schema.json decisions D-01..D-05, D-21..D-25', () => {
  it('D-01/D-02: type is epic|story|bug and status is draft|open|archived', () => {
    expect(has(ticket({ type: 'feature' }), '/type', 'schema.enum')).toBe(true);
    expect(has(ticket({ status: 'todo' }), '/status', 'schema.enum')).toBe(true);
    for (const type of ['epic', 'story', 'bug']) {
      for (const status of ['draft', 'open', 'archived']) {
        expect(ticket({ type, status })).toEqual([]);
      }
    }
  });

  it('D-21: type and status are required; ui is optional', () => {
    const { id, title, type, status } = base;
    expect(has(validate('ticket', { id, title, status }), '', 'schema.required')).toBe(true);
    expect(has(validate('ticket', { id, title, type }), '', 'schema.required')).toBe(true);
    expect(validate('ticket', base)).toEqual([]); // no ui key
  });

  it('D-23: design is accepted on an epic and must be an https URL', () => {
    expect(ticket({ type: 'epic', design: 'https://www.figma.com/file/abc' })).toEqual([]);
    expect(has(ticket({ design: 'figma.com/abc' }), '/design', 'schema.pattern')).toBe(true);
  });

  it('D-25: ac_hash is a non-empty string', () => {
    expect(ticket({ ac_hash: 'a' })).toEqual([]);
    expect(has(ticket({ ac_hash: '' }), '/ac_hash', 'schema.minLength')).toBe(true);
    expect(has(ticket({ ac_hash: 123 }), '/ac_hash', 'schema.type')).toBe(true);
  });

  it('lane tickets: lane, depends_on, approved_hash (spec §4, §5)', () => {
    expect(ticket({ lane: 'M', depends_on: ['T-1', 'T-2'], approved_hash: 'fnv1a64:0123456789abcdef' })).toEqual([]);
    expect(ticket({ lane: 'L' })).toEqual([]);
    expect(ticket({ lane: 'P', depends_on: [] })).toEqual([]);
    expect(ticket({ lane: 'S' })).toEqual([]);
    expect(has(ticket({ lane: 'X' }), '/lane', 'schema.enum')).toBe(true);
    expect(has(ticket({ depends_on: ['T-1', 'T-1'] }), '/depends_on', 'schema.uniqueItems')).toBe(true);
    expect(has(ticket({ depends_on: ['-bad'] }), '/depends_on/0', 'schema.pattern')).toBe(true);
    expect(has(ticket({ depends_on: 'T-1' }), '/depends_on', 'schema.type')).toBe(true);
    expect(has(ticket({ approved_hash: 'abc' }), '/approved_hash', 'schema.pattern')).toBe(true);
  });

  it('D-76: verified_hash and verified_commit are optional, lowercase-hashed, and at least 7 hex characters', () => {
    expect(ticket({})).toEqual([]); // a ticket carrying neither key still validates
    expect(ticket({ verified_hash: 'fnv1a64:0123456789abcdef' })).toEqual([]);
    expect(has(ticket({ verified_hash: 'abc' }), '/verified_hash', 'schema.pattern')).toBe(true);
    // The algorithm prefix and the digits are both lowercase (D-75).
    expect(has(ticket({ verified_hash: 'FNV1A64:0123456789ABCDEF' }), '/verified_hash', 'schema.pattern')).toBe(true);
    expect(ticket({ verified_commit: '1234567' })).toEqual([]);
    expect(ticket({ verified_commit: 'a'.repeat(40) })).toEqual([]);
    expect(has(ticket({ verified_commit: '123456' }), '/verified_commit', 'schema.minLength')).toBe(true);
    expect(has(ticket({ verified_commit: 'zzzzzzz' }), '/verified_commit', 'schema.pattern')).toBe(true);
    // additionalProperties: false still closes the object around the two new keys.
    expect(has(ticket({ verified_sha: '1234567' }), '', 'schema.additionalProperties')).toBe(true);
  });

  it('D-03: verified is a unique list of ac-n tags', () => {
    expect(ticket({ verified: ['ac-1', 'ac-12'] })).toEqual([]);
    expect(has(ticket({ verified: ['ac-0'] }), '/verified/0', 'schema.pattern')).toBe(true);
    expect(has(ticket({ verified: ['ac-1', 'ac-1'] }), '/verified', 'schema.uniqueItems')).toBe(true);
    expect(has(ticket({ verified: 'ac-1' }), '/verified', 'schema.type')).toBe(true);
  });

  it('D-04/D-05: dropped and tracker-owned keys are rejected; assumptions are shaped', () => {
    for (const extra of [{ owner: 'x' }, { qa: { ticks: [] } }, { feature: 'x' }, { sprint: 3 }]) {
      expect(has(ticket(extra), '', 'schema.additionalProperties')).toBe(true);
    }
    expect(ticket({ priority: 'high' })).toEqual([]);
    expect(has(ticket({ priority: 'urgent' }), '/priority', 'schema.enum')).toBe(true);
    expect(has(ticket({ assumptions: [{ text: 'a' }] }), '/assumptions/0', 'schema.required')).toBe(true);
    expect(
      has(ticket({ assumptions: [{ text: 'a', confirmed: 'yes' }] }), '/assumptions/0/confirmed', 'schema.type'),
    ).toBe(true);
  });

  it('id and parent follow the id pattern', () => {
    expect(has(ticket({ id: '-bad' }), '/id', 'schema.pattern')).toBe(true);
    expect(ticket({ id: 'EPIC-1.2_a' })).toEqual([]);
    expect(ticket({ parent: 'EPIC-1' })).toEqual([]);
    expect(has(ticket({ parent: '' }), '/parent', 'schema.pattern')).toBe(true);
  });
});

describe('phase 2 config keys', () => {
  const base = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] };
  it('accepts routing, escalation, test commands, and stale_days', () => {
    expect(validate('config', {
      ...base,
      models: { executor: { model: 'sonnet', effort: 'medium' }, 'reviewer.final': { model: 'claude-opus-5-5', effort: 'high' }, scout: { model: 'haiku' } },
      escalation: { fix_round_tier_up: '4' },
      tests: { report: 'reports/junit.xml', affected: 'npx vitest related {files} --run', full: 'npx vitest run' },
      stale_days: '14',
    })).toEqual([]);
  });
  it('refuses an unknown route, an unknown effort, and a malformed model', () => {
    expect(validate('config', { ...base, models: { tester: { model: 'sonnet' } } }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, models: { executor: { model: 'sonnet', effort: 'huge' } } }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, models: { executor: { model: 'Sonnet 5' } } }).length).toBeGreaterThan(0);
  });
  it('refuses a non-numeric stale_days and a tier-up outside 1..5', () => {
    expect(validate('config', { ...base, stale_days: 'soon' }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, escalation: { fix_round_tier_up: '9' } }).length).toBeGreaterThan(0);
  });
  it('risk:parsing build.parallel is a string 1 to 99 and build.regenerate a non-empty string (ST-LN-92 92-ac-2)', () => {
    expect(validate('config', { ...base, build: { parallel: '3', regenerate: 'npm run gen' } })).toEqual([]);
    expect(validate('config', { ...base, build: { parallel: '1' } })).toEqual([]);
    expect(validate('config', { ...base, build: { parallel: '99' } })).toEqual([]);
    for (const parallel of ['0', '100', '03', 'x', '', 3]) expect(validate('config', { ...base, build: { parallel } }).length, String(parallel)).toBeGreaterThan(0);
    expect(validate('config', { ...base, build: { regenerate: '' } }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, build: { cap: '3' } }).length).toBeGreaterThan(0);
  });

  // review round 2 finding 8: the build skill runs the printed command exactly, so it is one line with no control character, printed raw
  it('risk:security build.regenerate is one line with no control character (ST-LN-92 92-ac-4)', () => {
    for (const ok of ['npm run gen', 'node "my scripts/regen.mjs" --all', 'pnpm -r gen && git status', 'génère ünïcode']) {
      expect(validate('config', { ...base, build: { regenerate: ok } }), ok).toEqual([]);
    }
    for (const bad of ['npm run gen\nrm -rf x', 'a\rb', 'a\tb', 'a\u001bb', 'a\u007fb', 'a\u0085b', 'a\u2028b', 'a\u2029b']) {
      expect(validate('config', { ...base, build: { regenerate: bad } }).map((f) => f.rule), JSON.stringify(bad)).toContain('schema.pattern');
    }
    // the loader reads such a config as no config, as for any schema refusal
    const text = (regenerate: string): string => JSON.stringify({ ...base, build: { regenerate } });
    expect(loadConfig('accord/config.yml', text('npm run gen')).config?.build?.regenerate).toBe('npm run gen');
    expect(loadConfig('accord/config.yml', text('npm run gen\nrm -rf x')).config).toBeUndefined();
  });

  // review round 3 finding 3: an invisible format character (\p{Cf}: zero-width space, a bidi override or isolate, the byte order mark) would hide part of the command
  it('risk:security build.regenerate holds no format character (ST-LN-92 92-ac-4)', () => {
    const text = (regenerate: string): string => JSON.stringify({ ...base, build: { regenerate } });
    for (const cp of [0x200b, 0x202e, 0x2066, 0x2069, 0xfeff, 0x00ad]) {
      const bad = 'npm run' + String.fromCodePoint(cp) + ' gen';
      expect(validate('config', { ...base, build: { regenerate: bad } }).map((f) => f.rule), cp.toString(16)).toContain('schema.pattern');
      expect(loadConfig('accord/config.yml', text(bad)).config, cp.toString(16)).toBeUndefined();
    }
  });
});

const idsBase = { ...minimal.config };
const at = (cfg: object) => validate('config', cfg).map((f) => `${f.rule}@${f.pointer}`);
it('risk:parsing people maps an email to 2 to 4 capital letters', () => {
  for (const ok of [{ 'an@example.com': 'AN' }, { 'an@example.com': 'ABCD' }, {}]) expect(validate('config', { ...idsBase, people: ok })).toEqual([]);
  for (const bad of ['A', 'ABCDE', 'an', 'A1']) {
    expect(at({ ...idsBase, people: { 'an@example.com': bad } })).toContain('schema.pattern@/people/an@example.com');
  }
  expect(at({ ...idsBase, people: { 'not-an-email': 'AN' } }).some((s) => s.endsWith('@/people'))).toBe(true);
});
it('risk:parsing legacy_ids is a list of distinct ticket ids', () => {
  expect(validate('config', { ...idsBase, legacy_ids: ['SHOW-1', 'ASK-1'] })).toEqual([]);
  expect(at({ ...idsBase, legacy_ids: ['SHOW-1', 'SHOW-1'] })).toContain('schema.uniqueItems@/legacy_ids');
  expect(at({ ...idsBase, legacy_ids: ['a b'] })).toContain('schema.pattern@/legacy_ids/0');
});

it('risk:parsing branch refuses a template that breaks any one rule', () => {
  for (const ok of ['feature/{id}', 't/{id}', 'team.x/{id}-wip']) expect(validate('config', { ...idsBase, branch: ok })).toEqual([]);
  for (const bad of ['{id}', 'a/x', 'a/{id}/{id}', 'a {id}', 'a/{name}/{id}', '-a/{id}', '/a/{id}', 'a/{id}/', 'a/{id}.', 'a/..{id}', 'a//{id}', '.a/{id}', 'a/.x/{id}', 'a.lock/{id}', 't/x/{id}', 't/{id}-x'])
    expect(at({ ...idsBase, branch: bad }), bad).toContain('schema.pattern@/branch');
});
it('risk:parsing sensitive and generated entries are repository paths without globs backslashes or parent segments', () => {
  const cfg = (extra: Record<string, unknown>) => validate('config', { ...minimal.config, ...extra });
  expect(
    cfg({
      sensitive: { interface: ['packages/cli/src/run.ts', 'packages/core/schemas/', 'src/a b.ts'], 'data-deletion': ['.github/x.yml'] },
      generated: ['packages/core/src/generated/', 'packages/cli/README.md', 'docs/a b/'],
    }),
  ).toEqual([]);
  expect(cfg({ sensitive: { Interface: ['a.ts'] } }).length).toBeGreaterThan(0);
  expect(has(cfg({ sensitive: { interface: 'a.ts' } }), '/sensitive/interface', 'schema.type')).toBe(true);
  expect(has(cfg({ sensitive: { interface: ['a.ts', 'a.ts'] } }), '/sensitive/interface', 'schema.uniqueItems')).toBe(true);
  const bad = ['src/*.ts', 'src\\a.ts', '../a.ts', 'a/../b.ts', '/abs.ts', 'a//b.ts', ' a.ts', 'a.ts ', '', './a.ts', 'a/./b.ts', 'a/.', '.'];
  for (const path of bad) {
    expect(cfg({ sensitive: { interface: [path] } }).some((f) => f.pointer === '/sensitive/interface/0'), 'sensitive ' + JSON.stringify(path)).toBe(true);
  }
  for (const path of ['src/*.ts', 'src\\a.ts', '../a.ts', '/abs.ts', ' a.ts', './a.ts', 'a/./b.ts', 'a/.', '.']) {
    expect(cfg({ generated: [path] }).some((f) => f.pointer === '/generated/0'), 'generated ' + JSON.stringify(path)).toBe(true);
  }
});
it('risk:parsing disposable is a list of file or folder names', () => {
  const cfg = (v: unknown) => validate('config', { ...minimal.config, disposable: v });
  for (const ok of [['node_modules', 'dist', '.DS_Store', 'Thumbs.db'], [], ['.claude']]) expect(cfg(ok), JSON.stringify(ok)).toEqual([]);
  expect(has(cfg('dist'), '/disposable', 'schema.type')).toBe(true);
  expect(has(cfg(['']), '/disposable/0', 'schema.minLength')).toBe(true);
  for (const bad of ['a/b', 'a\\b', '.', '..']) expect(has(cfg([bad]), '/disposable/0', 'schema.pattern'), bad).toBe(true);
  expect(has(cfg(['dist', 'dist']), '/disposable', 'schema.uniqueItems')).toBe(true);
});

it('risk:parsing git.merge is merge, rebase or squash and git.sync a one-line command (ST-LN-96 t1-ac-3)', () => {
  const cfg = (v: unknown) => validate('config', { ...minimal.config, git: v });
  expect(cfg({ merge: 'rebase', sync: 'node scripts/sync.mjs' })).toEqual([]);
  for (const m of ['merge', 'rebase', 'squash']) expect(cfg({ merge: m }), m).toEqual([]);
  expect(has(cfg({ merge: 'fast' }), '/git/merge', 'schema.enum')).toBe(true);
  expect(has(cfg({ sync: '' }), '/git/sync', 'schema.minLength')).toBe(true);
  expect(has(cfg({ sync: 'a\nb' }), '/git/sync', 'schema.pattern')).toBe(true);
  expect(has(cfg({ merge: 'merge', other: 1 }), '/git', 'schema.additionalProperties')).toBe(true);
});

it('risk:parsing ids.pattern accepts the three tokens and refuses everything else (ST-LN-50 t2-ac-1)', () => {
  const cfg = (ids: unknown) => at({ ...idsBase, ids });
  for (const ok of ['FEAT-{n}', '{type}-{initials}-{n}', '{type}{n}', 'FEAT-{initials}-{n}', '{initials}.{n}', 'a_b-{n}-x'])
    expect(validate('config', { ...idsBase, ids: { pattern: ok } }), ok).toEqual([]);
  for (const bad of ['FEAT', '{n}-{n}', '{id}-{n}', '-{n}', 'FE AT-{n}', '{n}', '{type}-{type}-{n}', '{initials}{initials}{n}', 'A/{n}', 'A-{n', 'a{n}}', 'A-{N}', ''])
    expect(cfg({ pattern: bad }), bad).toContain('schema.pattern@/ids/pattern');
  expect(cfg({ pattern: 'F-' + 'x'.repeat(80) + '-{n}' })).toContain('schema.maxLength@/ids/pattern');
});

it('risk:data-loss ids.pattern refuses shapes that render an id git refuses as a branch name (WR-01)', () => {
  const cfg = (ids: unknown) => at({ ...idsBase, ids });
  // `t/FEAT..1`, `t/FEAT-1.` and `t/FEAT-1.lock` fail git check-ref-format, so the claim branch of every such ticket would be refused
  for (const bad of ['FEAT..{n}', 'FEAT-{n}.', 'FEAT-{n}.lock', '{type}..{n}', '{initials}.{n}.lock', 'FEAT.{n}..'])
    expect(cfg({ pattern: bad }), bad).toContain('schema.pattern@/ids/pattern');
  // single dots and a `.lock` that does not end the id are valid ref names
  for (const ok of ['FEAT.{n}', 'a.lock-{n}', 'FEAT-{n}.x', '{initials}.{n}', 'a.b.{n}'])
    expect(validate('config', { ...idsBase, ids: { pattern: ok } }), ok).toEqual([]);
});

it('risk:parsing ids holds a mode, prefixes per type and a non-empty list of tracker projects (ST-LN-50 t2-ac-1)', () => {
  expect(validate('config', { ...idsBase, ids: { mode: 'tracker', projects: ['ENG', 'OPS_1'] } })).toEqual([]);
  expect(validate('config', { ...idsBase, ids: { types: { story: 'FEAT', bug: 'DEFECT', epic: 'EPIC' } } })).toEqual([]);
  expect(validate('config', { ...idsBase, ids: {} })).toEqual([]);
  expect(at({ ...idsBase, ids: { projects: [] } })).toContain('schema.minItems@/ids/projects');
  expect(at({ ...idsBase, ids: { projects: ['ENG', 'ENG'] } })).toContain('schema.uniqueItems@/ids/projects');
  expect(at({ ...idsBase, ids: { projects: ['eng'] } })).toContain('schema.pattern@/ids/projects/0');
  expect(at({ ...idsBase, ids: { mode: 'both' } })).toContain('schema.enum@/ids/mode');
  expect(at({ ...idsBase, ids: { types: { story: 'feat' } } })).toContain('schema.pattern@/ids/types/story');
  expect(at({ ...idsBase, ids: { types: { task: 'TSK' } } })).toContain('schema.additionalProperties@/ids/types');
  expect(at({ ...idsBase, ids: { regex: '.*' } })).toContain('schema.additionalProperties@/ids');
});

it('risk:parsing strictness.rounds takes a round cap of 1 to 99 as a string and refuses 0, a negative, a non-number and 100 (ST-LN-50 t2-ac-4)', () => {
  for (const ok of ['1', '9', '42', '99']) {
    for (const key of ['approach', 'plan', 'review']) expect(validate('config', { ...idsBase, strictness: { rounds: { [key]: ok } } }), `${key} ${ok}`).toEqual([]);
  }
  expect(validate('config', { ...idsBase, strictness: { rounds: { approach: '2', plan: '3', review: '5' } } })).toEqual([]);
  expect(validate('config', { ...idsBase, strictness: {} })).toEqual([]);
  expect(validate('config', { ...idsBase, strictness: { rounds: {} } })).toEqual([]);
  for (const bad of ['0', '-1', '100', 'two', '01', '', '1.5', ' 2']) {
    expect(at({ ...idsBase, strictness: { rounds: { plan: bad } } }), JSON.stringify(bad)).toEqual(['schema.pattern@/strictness/rounds/plan']);
  }
  // YAML numerics stay strings: a number is refused as the wrong type, like every other numeric key
  expect(at({ ...idsBase, strictness: { rounds: { plan: 2 } } })).toEqual(['schema.type@/strictness/rounds/plan']);
  // an unknown stage and an unknown strictness key are refused by name
  expect(at({ ...idsBase, strictness: { rounds: { critic: '2' } } })).toEqual(['schema.additionalProperties@/strictness/rounds']);
  expect(at({ ...idsBase, strictness: { depth: '2' } })).toEqual(['schema.additionalProperties@/strictness']);
});
