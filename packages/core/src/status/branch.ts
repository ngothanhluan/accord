// Claim branch naming (ST-LN-1). Pure: the CLI loader does the git work.
import { normaliseText } from '../load/frontmatter.js';
import { parseYamlMap } from '../load/yaml.js';
import { validate } from '../validate/index.js';
/** The template of a claim branch when config.yml sets none. */
export const DEFAULT_BRANCH_TEMPLATE = 't/{id}';

/** D-07: only a valid `branch` is read from a config.yml text; any problem gives undefined, never a throw. */
export function branchTemplateOf(text: string): string | undefined {
  try {
    const map = parseYamlMap('accord/config.yml', normaliseText(text), 0).map;
    const branch = map?.branch;
    if (typeof branch !== 'string') return undefined;
    return validate('config', map).some((f) => f.pointer === '/branch') ? undefined : branch;
  } catch {
    return undefined;
  }
}
