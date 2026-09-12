// D-32 frontmatter boundary and D-38 BOM/CRLF normalisation (promoted from templates.test.ts).
import type { Finding } from '../model/finding.js';
import { validate } from '../validate/index.js';
import { parseYamlMap, schemaFindings } from './yaml.js';

export { stringNumerics } from './yaml.js';

const BOM = String.fromCharCode(0xfeff);
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

/** Strip one leading BOM and turn CRLF into LF; neither is ever reported (D-38). */
export function normaliseText(text: string): string {
  return (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
}

export interface SplitResult {
  yaml: string | null; // text between the --- lines; null when there is no block
  body: string; // everything after the closing --- line
  bodyOffset: number; // lines consumed by the block including both --- lines; 0 when none
}

export function splitFrontmatter(text: string): SplitResult {
  const norm = normaliseText(text);
  const m = FRONTMATTER.exec(norm);
  if (!m) return { yaml: null, body: norm, bodyOffset: 0 };
  return { yaml: m[1], body: norm.slice(m[0].length), bodyOffset: (m[0].match(/\n/g) ?? []).length };
}

export interface LoadedFrontmatter<T> {
  value?: T; // the typed object only when there are zero findings (D-32)
  body: string;
  bodyOffset: number;
  findings: Finding[];
}

export function loadFrontmatter<T>(
  file: string,
  text: string,
  schemaId: 'ticket' | 'verification',
): LoadedFrontmatter<T> {
  const { yaml, body, bodyOffset } = splitFrontmatter(text);
  if (yaml === null) {
    const finding: Finding = {
      file,
      line: 1,
      rule: 'load.frontmatter-missing',
      reason: 'no frontmatter block (---) at the top of the file',
    };
    return { value: undefined, body, bodyOffset, findings: [finding] };
  }
  // YAML line 1 is Markdown line 2 (after the opening ---).
  const parsed = parseYamlMap(file, yaml, 1);
  const findings = [...parsed.findings];
  if (parsed.map === undefined) return { value: undefined, body, bodyOffset, findings };
  const found = validate(schemaId, parsed.map);
  findings.push(...schemaFindings(file, parsed.doc, parsed.lines, 1, found));
  const value = findings.length === 0 ? (parsed.map as T) : undefined;
  return { value, body, bodyOffset, findings };
}
