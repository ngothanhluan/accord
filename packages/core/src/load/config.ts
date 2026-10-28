// D-31 config.yml: parsed and validated by the loader; missing or invalid means `config` is undefined.
import type { LoadFinding } from '../model/finding.js';
import type { AccordConfig } from '../model/snapshot.js';
import { validate } from '../validate/index.js';
import { normaliseText } from './frontmatter.js';
import { parseYamlMap, schemaFindings } from './yaml.js';

export function loadConfig(file: string, text: string): { config?: AccordConfig; findings: LoadFinding[] } {
  // No --- block: YAML line equals file line, so the offset is 0.
  const { map, doc, lines, findings } = parseYamlMap(file, normaliseText(text), 0);
  if (map === undefined) return { config: undefined, findings };
  const found = validate('config', map);
  findings.push(...schemaFindings(file, doc, lines, 0, found));
  return { config: findings.length === 0 ? (map as unknown as AccordConfig) : undefined, findings };
}

/**
 * ST-LN-62: the `generated:` and `sensitive:` lists of a config text, read without validating it, so a config
 * that fails the schema still gives the lists that parse. Never throws; no text, or text that is not a mapping, gives two empty lists.
 */
export function configLists(text: string | undefined): { generated: string[]; sensitive: { area: string; path: string }[] } {
  const none = { generated: [] as string[], sensitive: [] as { area: string; path: string }[] };
  if (text === undefined) return none;
  const { map } = parseYamlMap('accord/config.yml', normaliseText(text), 0);
  if (map === undefined) return none;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const s = map.sensitive;
  const sensitive =
    typeof s === 'object' && s !== null && !Array.isArray(s)
      ? Object.keys(s).flatMap((area) => strings((s as Record<string, unknown>)[area]).map((path) => ({ area, path })))
      : [];
  return { generated: strings(map.generated), sensitive };
}
