// Phase 08.9.2 D-02: `hook_mode` is a top-level key of accord/config.yml, `full` or `quiet`, declared in the schema, the key table, the settings areas, the loader's type and
// the template `accord init` writes. Absent means full; a value that is neither is a finding, never a silent repository.
import { expect, it } from 'vitest';
import areasFile from '../schemas/config-areas.json' with { type: 'json' };
import keysFile from '../schemas/config-keys.json' with { type: 'json' };
import schema from '../schemas/config.schema.json' with { type: 'json' };
import { initFiles, loadConfig } from '../src/index.js';

const initial = (): string => initFiles({ name: '@accord-dev/accord', version: '0.19.0' }).find((f) => f.path === 'accord/config.yml')?.text ?? '';
const withMode = (text: string, line: string): string => text.replace(/^hook_mode: full$/m, line);

// Phase 08.9.2 D-02: one key, five places; the tests that guard the three schema files (audit-keys, config-areas) pass beside this one.
it('risk:regression hook_mode is declared everywhere a key is and defaults to full (D-02)', () => {
  expect((schema.properties as Record<string, unknown>).hook_mode).toEqual({ type: 'string', enum: ['full', 'quiet'] });

  const row = keysFile.find((r) => r.key === 'hook_mode');
  expect(row?.since).toBe('0.20.0');
  expect(row?.default).toContain('full');

  const team = areasFile.areas.find((a) => a.id === 'team');
  expect(team?.keys.map((k) => k.key)).toContain('hook_mode');

  const text = initial();
  expect(text).toMatch(/^# .+\n# .+\nhook_mode: full$/m);
  expect((text.match(/^hook_mode:/gm) ?? []).length).toBe(1);

  const full = loadConfig('accord/config.yml', text);
  expect(full.findings).toEqual([]);
  expect(full.config?.hook_mode).toBe('full');
  const quiet = loadConfig('accord/config.yml', withMode(text, 'hook_mode: quiet'));
  expect(quiet.findings).toEqual([]);
  expect(quiet.config?.hook_mode).toBe('quiet');
  const absent = loadConfig('accord/config.yml', withMode(text, ''));
  expect(absent.findings).toEqual([]);
  expect(absent.config?.hook_mode).toBeUndefined();
  const loud = loadConfig('accord/config.yml', withMode(text, 'hook_mode: loud'));
  expect(loud.findings.length).toBeGreaterThan(0);
  expect(loud.config).toBeUndefined();
});
