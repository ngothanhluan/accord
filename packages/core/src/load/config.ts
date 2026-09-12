// D-31 config.yml: parsed and validated by the loader; missing or invalid means `config` is undefined.
import type { Finding } from '../model/finding.js';
import type { AccordConfig } from '../model/snapshot.js';
import { validate } from '../validate/index.js';
import { normaliseText } from './frontmatter.js';
import { parseYamlMap, schemaFindings } from './yaml.js';

export function loadConfig(file: string, text: string): { config?: AccordConfig; findings: Finding[] } {
  // No --- block: YAML line equals file line, so the offset is 0.
  const { map, doc, lines, findings } = parseYamlMap(file, normaliseText(text), 0);
  if (map === undefined) return { config: undefined, findings };
  const found = validate('config', map);
  findings.push(...schemaFindings(file, doc, lines, 0, found));
  return { config: findings.length === 0 ? (map as unknown as AccordConfig) : undefined, findings };
}
