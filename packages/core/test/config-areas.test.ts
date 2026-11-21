// Phase 8.3 D-13: the settings areas are data beside the schema (packages/core/schemas/config-areas.json), never skill text. The trip wire is the first test: a top-level
// key a later release adds to config.schema.json fails it until it has an area, so `/accord-config` can never skip a key it should show.
import { describe, expect, it } from 'vitest';
import areasFile from '../schemas/config-areas.json' with { type: 'json' };
import schema from '../schemas/config.schema.json' with { type: 'json' };
import { CONFIG_AREAS, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

interface Area {
  id: string;
  title: string;
  walk?: boolean;
  keys: readonly { key: string; text: string }[];
}

/** One line per problem: a key in two areas, a schema key with no area, an area key the schema lacks, an empty text. */
function placement(areas: readonly Area[], top: readonly string[]): string[] {
  const placed = areas.flatMap((a) => a.keys.map((k) => k.key));
  return [
    ...placed.filter((k, i) => placed.indexOf(k) !== i).map((k) => `${k}: sits in two areas`),
    ...top.filter((k) => !placed.includes(k)).map((k) => `${k}: a schema key with no area`),
    ...placed.filter((k) => !top.includes(k)).map((k) => `${k}: an area names a key the schema lacks`),
    ...areas.flatMap((a) => a.keys.filter((k) => k.text.trim() === '').map((k) => `${k.key}: empty text`)),
  ];
}

const TOP = Object.keys(schema.properties);
const config = (): AccordConfig => ({
  accord: '0.10.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev', 'designer'],
  runtimes: ['claude', 'codex', 'cursor', 'copilot'],
});

describe('config areas hold every top-level key once', () => {
  it('risk:regression every top-level config key belongs to exactly one area (D-13)', () => {
    expect(TOP.length).toBeGreaterThanOrEqual(30);
    expect(placement(areasFile.areas, TOP)).toEqual([]);
    // guard the guard: a copy of the areas with one key removed reports that key
    const without = areasFile.areas.map((a) => ({ ...a, keys: a.keys.filter((k) => k.key !== 'slop') }));
    expect(placement(without, TOP)).toEqual(['slop: a schema key with no area']);
    // and a key placed twice, a made-up key and an empty text are each reported
    const twice = [...areasFile.areas, { id: 'extra', title: 'Extra', keys: [{ key: 'git', text: ' ' }, { key: 'nosuch', text: 'x' }] }];
    expect(placement(twice, TOP)).toEqual(['git: sits in two areas', 'nosuch: an area names a key the schema lacks', 'git: empty text']);
  });

  it('risk:regression the areas are data the skills never restate (D-13)', () => {
    const ids = areasFile.areas.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['team', 'git', 'tests', 'review', 'integrations', 'hygiene', 'templates', 'managed']);
    for (const a of areasFile.areas as Area[]) {
      if (a.id === 'managed') expect(a.walk, 'managed is shown, never walked').toBe(false);
      else expect(a.walk === undefined || a.walk === true, a.id).toBe(true);
      expect(a.title.trim(), a.id).not.toBe('');
    }
    // the typed accessor core exports is the file itself
    expect(CONFIG_AREAS).toEqual(areasFile.areas);
    // no rendered file of any roster (every runtime, designer included) holds an area title or the managed marker line
    const files = skillTargets(config());
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      for (const a of areasFile.areas) expect(f.text.includes(a.title), `${f.path} restates the area title ${a.title}`).toBe(false);
    }
  });
});
