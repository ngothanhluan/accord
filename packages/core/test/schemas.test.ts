import { describe, expect, it } from 'vitest';
import { schemaIds, validate } from '../src/index.js';
import type { Finding } from '../src/index.js';
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
      expect(f.path).toBe('');
    }
    const nul = validate('ticket', null);
    expect(nul).toHaveLength(1);
    expect(nul[0]).toMatchObject({ rule: 'schema.type', path: '' });
  });
});

// ---------------------------------------------------------------------------
// Plan 01-03: config.yml, verification.md, and ordering acceptance criteria
// ---------------------------------------------------------------------------

/** True when some finding has exactly this (path, rule) pair. */
const has = (findings: Finding[], path: string, rule: string): boolean =>
  findings.some((f) => f.path === path && f.rule === rule);

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

  it('top-level properties are exactly the six D-16 keys', () => {
    const keys = ['accord', 'profile', 'tracker', 'design', 'roles', 'runtimes'];
    expect(Object.keys(configSchema.properties)).toEqual(keys);
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

  it('D-03: verified is a unique list of ac-n tags', () => {
    expect(ticket({ verified: ['ac-1', 'ac-12'] })).toEqual([]);
    expect(has(ticket({ verified: ['ac-0'] }), '/verified/0', 'schema.pattern')).toBe(true);
    expect(has(ticket({ verified: ['ac-1', 'ac-1'] }), '/verified', 'schema.uniqueItems')).toBe(true);
    expect(has(ticket({ verified: 'ac-1' }), '/verified', 'schema.type')).toBe(true);
  });

  it('D-04/D-05: dropped and tracker-owned keys are rejected; assumptions are shaped', () => {
    for (const extra of [{ owner: 'x' }, { qa: { ticks: [] } }, { feature: 'x' }, { sprint: 3 }, { priority: 'high' }]) {
      expect(has(ticket(extra), '', 'schema.additionalProperties')).toBe(true);
    }
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
