// ST-LN-57: the accord release that cut over to version 2 review records, and the pin reads that decide which version a record may be.
import { normaliseText } from '../load/frontmatter.js';
import { parseYamlMap } from '../load/yaml.js';

/** The release that ships version 2 records: a version 1 record is allowed only while its pin is below it. */
export const RECORD_V2_FROM = '0.3.1';

const PLAIN = /^(\d+)\.(\d+)\.(\d+)$/;

/** The top-level `accord:` string of a config.yml text, read even when the config fails its schema; undefined when there is none. */
export function pinOf(configText: string): string | undefined {
  const pin = parseYamlMap('accord/config.yml', normaliseText(configText), 0).map?.accord;
  return typeof pin === 'string' ? pin : undefined;
}

/** -1, 0 or 1; both arguments are plain x.y.z. */
function compare(a: string, b: string): number {
  const x = PLAIN.exec(a)!.slice(1).map(Number);
  const y = PLAIN.exec(b)!.slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** True only when `pin` is a plain x.y.z below RECORD_V2_FROM and, when `basePin` is a plain x.y.z, not below `basePin`. */
export function pinAllowsV1(pin: string | undefined, basePin?: string): boolean {
  if (pin === undefined || !PLAIN.test(pin) || compare(pin, RECORD_V2_FROM) >= 0) return false;
  return basePin === undefined || !PLAIN.test(basePin) || compare(pin, basePin) >= 0;
}
