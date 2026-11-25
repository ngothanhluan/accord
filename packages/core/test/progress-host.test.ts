// Phase 15 D-12, D-13, D-33 (15-09): which hosts a progress ref may be pushed to. `PROGRESS_REF_PROVEN` ships empty, so `auto` pushes nothing anywhere until a recorded live test fills it.
import { expect, it } from 'vitest';
import areasFile from '../schemas/config-areas.json' with { type: 'json' };
import keysFile from '../schemas/config-keys.json' with { type: 'json' };
import schema from '../schemas/config.schema.json' with { type: 'json' };
import { initFiles, loadConfig, PROGRESS_REF_PROVEN, progressPushTarget } from '../src/index.js';

const auto = { progress: { push: 'auto' as const } };
const GITHUB = ['github'] as const;

it('risk:security PROGRESS_REF_PROVEN is empty and auto pushes nothing to github.com with the shipped list (D-12, D-33)', () => {
  expect(PROGRESS_REF_PROVEN).toEqual([]);
  expect(progressPushTarget(auto, 'git@github.com:o/r.git')).toBe('none');
  expect(progressPushTarget(auto, 'https://github.com/o/r')).toBe('none');
});

it('risk:regression off and an absent setting push nothing, ref pushes on any URL (D-13, D-33)', () => {
  for (const url of ['git@github.com:o/r.git', 'https://gitlab.com/o/r', 'git@ghe.corp:o/r', '/tmp/bare.git', undefined]) {
    expect(progressPushTarget({ progress: { push: 'off' } }, url, GITHUB)).toBe('none');
    expect(progressPushTarget({ progress: {} }, url, GITHUB)).toBe('none');
    expect(progressPushTarget({}, url, GITHUB)).toBe('none');
    expect(progressPushTarget(undefined, url, GITHUB)).toBe('none');
    expect(progressPushTarget({ progress: { push: 'ref' } }, url)).toBe('ref');
  }
});

it('risk:parsing auto with github proven reads every github.com form of origin (D-12)', () => {
  for (const url of ['git@github.com:o/r.git', 'https://github.com/o/r', 'ssh://git@ssh.github.com:443/o/r', 'git@github.com-work:o/r']) {
    expect(progressPushTarget(auto, url, GITHUB), url).toBe('ref');
  }
});

it('risk:security auto with github proven refuses a lookalike host, another host kind and a URL it cannot read (T-15-22)', () => {
  for (const url of [
    'https://github.com.evil.example/o/r',
    'https://evil.example/github.com/o/r',
    'https://gitlab.com/o/r',
    'https://dev.azure.com/o/p/_git/r',
    'git@ghe.corp:o/r',
    'C:/work/bare.git',
    '/tmp/bare.git',
    'not a url',
    '',
    undefined,
  ]) {
    expect(progressPushTarget(auto, url, GITHUB), String(url)).toBe('none');
  }
});

it('risk:regression auto with an empty proven list pushes nothing even to github.com (D-33)', () => {
  expect(progressPushTarget(auto, 'git@github.com:o/r.git', [])).toBe('none');
});

it('risk:regression progress.push is declared in the schema, the key table and the git area, and a bad value is a finding (D-33)', () => {
  expect((schema.properties as Record<string, unknown>).progress).toEqual({ type: 'object', additionalProperties: false, properties: { push: { type: 'string', enum: ['auto', 'ref', 'off'] } } });
  expect(keysFile.find((r) => r.key === 'progress.push')?.default).toMatch(/^off:/);
  expect(areasFile.areas.find((a) => a.id === 'git')?.keys.map((k) => k.key)).toContain('progress');

  const text = initFiles({ name: '@accord-dev/accord', version: '0.19.0' }).find((f) => f.path === 'accord/config.yml')?.text ?? '';
  expect(text).not.toMatch(/^progress:/m); // absent means off: init writes no progress line
  for (const push of ['auto', 'ref', 'off']) {
    const loaded = loadConfig('accord/config.yml', text + `progress:\n  push: ${push}\n`);
    expect(loaded.findings).toEqual([]);
    expect(loaded.config?.progress?.push).toBe(push);
  }
  const bad = loadConfig('accord/config.yml', text + 'progress:\n  push: branch\n');
  expect(bad.findings.length).toBeGreaterThan(0);
  expect(bad.config).toBeUndefined();
});
