// Phase 8.1 G3b (D-08 group 2, "keys new in this version"): the config keys each release added, and the ones a repository has not set yet. Pure: the data is a JSON file
// beside the schemas (a version literal in a source file would be a cut-off offence, and ajv's strict mode refuses a custom schema keyword), the caller passes the pin and the running version.
import keyRows from '../../schemas/config-keys.json' with { type: 'json' };

/** One key a release added: its dotted path in accord/config.yml, the release that added it, and what it does while unset. */
export interface ConfigKeyRow {
  key: string;
  since: string;
  default: string;
}

export const CONFIG_KEYS: readonly ConfigKeyRow[] = keyRows;

const PLAIN = /^\d+\.\d+\.\d+$/;

/** True when plain version `a` is later than plain version `b`; anything else is not a version, so false. */
function later(a: string, b: string): boolean {
  if (!PLAIN.test(a) || !PLAIN.test(b)) return false;
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] as number) > (y[i] as number);
  return false;
}

/**
 * The rows of keys added after the pin, or by the running version itself, that the config does not set. A pin that is not a plain version gives none: with nothing to compare against,
 * listing every key would call the whole config new.
 */
export function newKeys(rows: readonly ConfigKeyRow[], pinned: string | undefined, running: string, setKeys: readonly string[]): ConfigKeyRow[] {
  if (pinned === undefined || !PLAIN.test(pinned)) return [];
  return rows.filter((r) => (later(r.since, pinned) || r.since === running) && !setKeys.includes(r.key));
}

/** Every dotted path `config` sets, an object's own path as well as each key below it; a list is a leaf. */
export function setKeysOf(config: unknown, prefix = ''): string[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || value === null) continue;
    const path = prefix === '' ? key : prefix + '.' + key;
    out.push(path, ...setKeysOf(value, path));
  }
  return out;
}
