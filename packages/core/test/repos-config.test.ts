// Phase 08.9.3 D-01, D-06: `repos:` declares another repository by name with its remote URL (never a path) and its test commands. The schema accepts only the remote forms
// `parseRepoUrl` reads, so a configured remote can never fail the origin comparison later for being a form nobody reads; one key is settable at a time (`accord config set`);
// and the audit keys list and the config areas know the new key.
import { expect, it } from 'vitest';
import { CONFIG_AREAS, CONFIG_KEYS, loadConfig, parseRepoUrl, setConfigValue } from '../src/index.js';

const BASE = ['accord: "1.0.0"', 'profile: build', 'tracker:', '  adapter: none', 'design:', '  tokens: ""', 'roles: [ba, dev]', 'runtimes: [claude]', ''].join('\n');
const TOOLS = 'https://github.com/acme/tools.git';

/** The findings of BASE plus a `repos:` value written as JSON flow, so no YAML quoting rule changes what the test means. */
const findings = (repos: unknown): string[] => loadConfig('accord/config.yml', BASE + 'repos: ' + JSON.stringify(repos) + '\n').findings.map((f) => `${f.pointer ?? ''} ${f.reason}`);
const entry = (over: Record<string, unknown> = {}) => ({ remote: TOOLS, ...over });

const ACCEPTED = [
  'https://github.com/acme/tools.git',
  'https://github.com/acme/tools',
  'ssh://git@github.com/acme/tools.git',
  'git@github.com:acme/tools.git',
  'git@github.com-work:acme/tools',
];

it('risk:parsing every remote form the schema accepts is a form parseRepoUrl reads (D-01)', () => {
  for (const remote of ACCEPTED) {
    expect(findings({ tools: entry({ remote }) }), remote).toEqual([]);
    expect(parseRepoUrl(remote), remote).toBeDefined();
  }
});

it('risk:security a remote that is a path, an option, a transport or too long is refused by the schema (D-01)', () => {
  const refused = [
    '-oProxyCommand=x@host:a/b',
    'ext::sh -c x',
    'file:///tmp/tools',
    'C:/Work/tools',
    '../tools',
    'https://github.com/acme/tools.git x',
    ' https://github.com/acme/tools.git',
    'https://github.com/acme/tools.git\n',
    'gh-work:acme/tools',
    // W-3: a user part that starts with `-` is refused in every form with a user, as the scp form already did
    'ssh://-oProxyCommand=sh@host.com/a/b',
    'ssh://-o@github.com/acme/tools.git',
    'https://-user@github.com/acme/tools.git',
    '-o@github.com:acme/tools.git',
    'https://github.com/acme/' + 'a'.repeat(300 - 'https://github.com/acme/'.length + 1),
  ];
  expect(refused[refused.length - 1].length).toBe(301);
  for (const remote of refused) expect(findings({ tools: entry({ remote }) }).length, JSON.stringify(remote)).toBeGreaterThan(0);
  // the origin of a clone is read by the same rules, so a user that starts with `-` is no remote there either
  for (const remote of refused.filter((r) => r.includes('@'))) expect(parseRepoUrl(remote), JSON.stringify(remote)).toBeUndefined();
  // the longest accepted value is 300 characters
  expect(findings({ tools: entry({ remote: 'https://github.com/acme/' + 'a'.repeat(300 - 'https://github.com/acme/'.length) }) })).toEqual([]);
});

it('risk:security a repository name is two characters or more of a-z, 0-9 and -, starting with a letter (D-01)', () => {
  for (const name of ['c', 'Tools', '-x', 'tools_a', '1tools', 'to ols', '']) expect(findings({ [name]: entry() }).length, JSON.stringify(name)).toBeGreaterThan(0);
  for (const name of ['to', 'tools', 'tools-2', 'a1']) expect(findings({ [name]: entry() }), name).toEqual([]);
});

it('risk:parsing an entry needs its remote, takes no path, and keeps each command and the report one safe line (D-01, D-06)', () => {
  expect(findings({ tools: {} }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ path: '../tools' }) }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ tests: 'dotnet test\nrm -rf /' }) }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ affected: 'dotnet test {files}\r\nx' }) }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ tests: '' }) }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ report: '../x.xml' }) }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ report: '/etc/x.xml' }) }).length).toBeGreaterThan(0);
  expect(findings({ tools: entry({ tests: 'dotnet test', affected: 'dotnet test --filter {files}', report: 'TestResults/junit.xml' }) })).toEqual([]);
});

it('risk:parsing repos.<name>.remote then repos.<name>.tests set one key at a time, each a valid document (D-01, D-06)', () => {
  const one = setConfigValue(BASE, ['repos', 'tools', 'remote'], TOOLS);
  expect(one).toBeDefined();
  const first = loadConfig('accord/config.yml', one as string);
  expect(first.findings).toEqual([]);
  expect(first.config?.repos).toEqual({ tools: { remote: TOOLS } });
  const two = setConfigValue(one as string, ['repos', 'tools', 'tests'], 'dotnet test');
  expect(two).toBeDefined();
  const second = loadConfig('accord/config.yml', two as string);
  expect(second.findings).toEqual([]);
  expect(second.config?.repos).toEqual({ tools: { remote: TOOLS, tests: 'dotnet test' } });
});

it('risk:regression config-keys.json holds a repos row since 0.22.0, and config-areas.json lists repos once, in area git (D-01)', () => {
  const rows = CONFIG_KEYS.filter((r) => r.key === 'repos');
  expect(rows).toHaveLength(1);
  expect(rows[0].since).toBe('0.22.0');
  expect(rows[0].default.trim()).not.toBe('');
  const holders = CONFIG_AREAS.filter((a) => a.keys.some((k) => k.key === 'repos'));
  expect(holders.map((a) => a.id)).toEqual(['git']);
  expect(holders[0].keys.filter((k) => k.key === 'repos')).toHaveLength(1);
});
