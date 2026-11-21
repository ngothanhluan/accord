// Phase 8.3 D-13: the settings areas `/accord-config` walks, as data beside the schemas (a custom schema keyword is refused by ajv's strict mode, and config-keys.json lists keys added per release, not an inventory).
// Pure: the JSON file is the whole of it. Every top-level key of config.schema.json sits in exactly one area and carries a plain-words text (packages/core/test/config-areas.test.ts), so a key a later release adds
// fails the suite until it has an area. No skill text restates an area or a key: `accord config areas` prints them.
import areaRows from '../../schemas/config-areas.json' with { type: 'json' };

/** One top-level config key of an area: its name and what it controls, in plain words. */
export interface ConfigAreaKey {
  key: string;
  text: string;
}

/** One area of settings: a stable id a person types after `/accord-config`, a title, and its keys. `walk: false` marks an area accord writes itself: it is shown and never walked. */
export interface ConfigArea {
  id: string;
  title: string;
  walk?: boolean;
  keys: readonly ConfigAreaKey[];
}

export const CONFIG_AREAS: readonly ConfigArea[] = areaRows.areas;
