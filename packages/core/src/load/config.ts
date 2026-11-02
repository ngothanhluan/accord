// D-31 config.yml: parsed and validated by the loader; missing or invalid means `config` is undefined.
import { isScalar, isSeq } from 'yaml';
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
export function configLists(text: string | undefined): { generated: string[]; sensitive: { area: string; path: string; line: number }[] } {
  const none = { generated: [] as string[], sensitive: [] as { area: string; path: string; line: number }[] };
  if (text === undefined) return none;
  const { map, doc, lines } = parseYamlMap('accord/config.yml', normaliseText(text), 0);
  if (map === undefined) return none;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const s = map.sensitive;
  // ST-LN-81: `line` is the 1-based config line of the list item; the config has no frontmatter, so no offset.
  const sensitive =
    typeof s === 'object' && s !== null && !Array.isArray(s)
      ? Object.keys(s).flatMap((area) => {
          const seq = doc.getIn(['sensitive', area], true);
          if (!isSeq(seq)) return [];
          return seq.items.flatMap((item) =>
            isScalar(item) && typeof item.value === 'string' && item.range ? [{ area, path: item.value, line: lines.linePos(item.range[0]).line }] : [],
          );
        })
      : [];
  return { generated: strings(map.generated), sensitive };
}
