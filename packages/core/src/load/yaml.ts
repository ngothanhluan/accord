// D-33 YAML parse with line tracking and the JSON-pointer-to-line rule for schema findings.
import { LineCounter, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Document, Tags } from 'yaml';
import type { Finding, SchemaFinding } from '../model/finding.js';

// STACK Decision 2: core schema, numerics stay strings so `1e3` and `0123` survive as written.
export const stringNumerics = (tags: Tags): Tags =>
  tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag));

export interface ParsedYaml {
  map?: Record<string, unknown>;
  doc: Document;
  lines: LineCounter;
  findings: Finding[];
}

/** Parse YAML text; `lineOffset` is added to every YAML line to reach the file line. */
export function parseYamlMap(file: string, yamlText: string, lineOffset: number): ParsedYaml {
  const lines = new LineCounter();
  const doc = parseDocument(yamlText, { schema: 'core', customTags: stringNumerics, lineCounter: lines });
  const findings: Finding[] = [];
  if (doc.errors.length > 0) {
    for (const err of doc.errors) {
      findings.push({
        file,
        line: lineOffset + (err.linePos?.[0].line ?? 1),
        rule: 'load.yaml-syntax',
        reason: err.message.split('\n')[0],
      });
    }
    return { map: undefined, doc, lines, findings };
  }
  if (!isMap(doc.contents)) {
    findings.push({ file, line: lineOffset + 1, rule: 'load.yaml-not-map', reason: 'frontmatter must be a YAML mapping' });
    return { map: undefined, doc, lines, findings };
  }
  return { map: doc.toJS() as Record<string, unknown>, doc, lines, findings };
}

type Segment = string | number;

/** '/verified/2' -> ['verified', 2]; '' -> []. */
function pointerPath(pointer: string): Segment[] {
  if (pointer === '') return [];
  return pointer
    .split('/')
    .slice(1)
    .map((seg) => {
      const s = seg.replace(/~1/g, '/').replace(/~0/g, '~');
      return /^(0|[1-9][0-9]*)$/.test(s) ? Number(s) : s;
    });
}

const startOf = (n: unknown): number | undefined =>
  (n as { range?: [number, number, number] } | null | undefined)?.range?.[0];

/** Stamp `file` and the D-33 line on each schema finding: the offending key or value. */
export function schemaFindings(
  file: string,
  doc: Document,
  lines: LineCounter,
  lineOffset: number,
  found: SchemaFinding[],
): Finding[] {
  const nodeAt = (path: Segment[]): unknown => (path.length === 0 ? doc.contents : doc.getIn(path, true));

  // Offset of the key (in a map) or item (in a seq) that `path` names; undefined at the root.
  const keyOffset = (path: Segment[]): number | undefined => {
    if (path.length === 0) return undefined;
    const parent = nodeAt(path.slice(0, -1));
    const last = path[path.length - 1];
    if (isMap(parent)) {
      const pair = parent.items.find((p) => isScalar(p.key) && String(p.key.value) === String(last));
      return startOf(pair?.key);
    }
    if (isSeq(parent)) return startOf(parent.items[Number(last)]);
    return undefined;
  };

  const lineOf = (offset: number | undefined): number =>
    offset === undefined ? lineOffset + 1 : lines.linePos(offset).line + lineOffset;

  return found.map(({ pointer, rule, reason, param }) => {
    const path = pointerPath(pointer);
    const node = nodeAt(path);
    let offset: number | undefined;
    if (rule === 'schema.additionalProperties' && isMap(node)) {
      // (i) the unknown key itself
      const pair = node.items.find((p) => isScalar(p.key) && String(p.key.value) === param);
      offset = startOf(pair?.key);
    } else if (rule === 'schema.required') {
      // (ii) the key naming the map that lacks the property; root -> first YAML line
      offset = keyOffset(path);
    } else if (isScalar(node)) {
      // (iii) the offending value
      offset = startOf(node);
    } else if (isMap(node) || isSeq(node)) {
      // (iii) a block collection's own range starts at its first child, so use the naming key
      offset = keyOffset(path);
    }
    return { file, line: lineOf(offset), rule, reason, pointer };
  });
}
