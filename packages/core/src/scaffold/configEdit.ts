// ST-LN-50 D-11: the writers `accord config` goes through, in the model of repin.ts. Pure text in, text out; a text they
// cannot edit safely gives undefined. yaml's document model finds and changes the key, then only the lines that
// changed are spliced into the original text, so every comment, quote and flow style elsewhere survives byte for byte
// (re-serialising the whole document would pad every flow list or every flow map, one of the two, never neither).
import { Document, Scalar, isMap, isScalar, isSeq, parse, parseDocument } from 'yaml';
import type { Node } from 'yaml';
import configSchema from '../../schemas/config.schema.json' with { type: 'json' };
import { breaksConvention, conventionKey, LEGACY_ID } from '../lint/ids.js';
import { normaliseText } from '../load/frontmatter.js';
import { stringNumerics } from '../load/yaml.js';
import type { AccordConfig } from '../model/snapshot.js';

const BOM = String.fromCharCode(0xfeff);
const READ = { schema: 'core', customTags: stringNumerics } as const;
const WRITE = { lineWidth: 0, flowCollectionPadding: false } as const;

interface Schema {
  $ref?: string;
  properties?: Record<string, Schema>;
  patternProperties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
}
const ROOT = configSchema as unknown as Schema;
const DEFS = (configSchema as unknown as { $defs?: Record<string, Schema> }).$defs ?? {};

/** A `{ "$ref": "#/$defs/name" }` node is the definition it names, so a key under a shared definition (the stage switches of each lane) resolves like any other. */
function deref(schema: Schema): Schema {
  const name = schema.$ref?.startsWith('#/$defs/') === true ? schema.$ref.slice('#/$defs/'.length) : undefined;
  return name !== undefined && Object.hasOwn(DEFS, name) ? DEFS[name] : schema;
}

function walk(node: Schema, segs: string[]): string[] | undefined {
  const schema = deref(node);
  if (segs.length === 0) return [];
  const [head, ...rest] = segs;
  if (schema.properties !== undefined && Object.hasOwn(schema.properties, head)) {
    const sub = walk(schema.properties[head], rest);
    return sub === undefined ? undefined : [head, ...sub];
  }
  if (schema.patternProperties !== undefined) {
    // the longest run of segments that is a valid key: `reviewer.final` is one key, `executor` then `effort` two
    for (let k = segs.length; k >= 1; k--) {
      const key = segs.slice(0, k).join('.');
      const hit = Object.entries(schema.patternProperties).find(([pattern]) => new RegExp(pattern).test(key));
      if (hit === undefined) continue;
      const sub = walk(hit[1], segs.slice(k));
      if (sub !== undefined) return [key, ...sub];
    }
    return undefined;
  }
  // a map keyed by anything (`people`, `sensitive`): the rest of the path is one key, dots and all
  if (typeof schema.additionalProperties === 'object') return [segs.join('.')];
  return undefined;
}

/**
 * `git.merge` -> ['git', 'merge'], resolved against config.schema.json: a fixed property descends one segment; under
 * a map keyed by a pattern or by anything, the rest of the path is one key (`people.dev@example.com`). A key the
 * schema does not have, an empty segment, or a path below a scalar or a list gives undefined.
 */
export function resolveKeyPath(dotted: string): string[] | undefined {
  const segs = dotted.split('.');
  if (segs.some((s) => s === '')) return undefined;
  const path = walk(ROOT, segs);
  return path === undefined || path.length === 0 ? undefined : path;
}

/** A value that starts with `[` or `{` is a YAML flow collection (JSON included); any other value is a plain string, so numerics stay strings. Throws on a flow collection that does not parse. */
export function parseValue(raw: string): unknown {
  if (!raw.startsWith('[') && !raw.startsWith('{')) return raw;
  try {
    return parse(raw, READ);
  } catch (err) {
    throw new Error('not a YAML flow collection: ' + String((err as Error).message).split('\n')[0], { cause: err });
  }
}

// A string a YAML 1.2 reader, or the .NET hub's, would take for a number, a boolean or null is written quoted.
const AMBIGUOUS = /^(?:[-+]?(?:\.?[0-9]|\.inf\b|\.nan\b)|(?:true|false|null|yes|no|on|off|y|n|~)$)/i;

function shape(node: unknown): void {
  if (isScalar(node)) {
    if (typeof node.value === 'string' && AMBIGUOUS.test(node.value)) node.type = Scalar.QUOTE_DOUBLE;
  } else if (isSeq(node)) {
    node.flow = true;
    node.items.forEach(shape);
  } else if (isMap(node)) {
    node.flow = true;
    node.items.forEach((pair) => shape(pair.value));
  }
}

interface Edit {
  /** the text as an LF document, no BOM */
  src: string;
  doc: Document;
  crlf: boolean;
  bom: boolean;
}

function open(text: string): Edit | undefined {
  const src = normaliseText(text);
  const doc = parseDocument(src, READ);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return undefined;
  return { src, doc, crlf: text.includes('\r\n'), bom: text.startsWith(BOM) };
}

interface Line {
  /** index among all the lines */
  i: number;
  /** the line without whitespace: yaml re-pads flow collections and re-indents, which is not a difference of content */
  k: string;
  text: string;
}
const content = (lines: string[]): Line[] => lines.flatMap((text, i) => (text.trim() === '' ? [] : [{ i, k: text.replace(/\s+/g, ''), text }]));

/**
 * The original with only the lines `next` changed from `base` swapped in. `base` is the unedited document written by
 * yaml, so it differs from the original in whitespace alone (padding, indentation, a blank line before a closing
 * comment); the content lines of the two line up one for one, and the change is found between `base` and `next`.
 * Undefined when they do not line up.
 */
function splice(src: string, base: string, next: string): string | undefined {
  const a = src.split('\n');
  const c = next.split('\n');
  const A = content(a);
  const B = content(base.split('\n'));
  const N = content(c);
  if (A.length !== B.length || A.some((l, j) => l.k !== B[j].k)) return undefined;
  let p = 0;
  while (p < B.length && p < N.length && B[p].text === N[p].text) p++;
  let s = 0;
  while (s < B.length - p && s < N.length - p && B[B.length - 1 - s].text === N[N.length - 1 - s].text) s++;
  // the changed lines, as the span between the last unchanged content line before and the first one after
  const from = p === 0 ? 0 : A[p - 1].i + 1;
  const to = p === A.length - s ? from : A[A.length - s - 1].i + 1;
  const nFrom = p === 0 ? 0 : N[p - 1].i + 1;
  const nTo = p === N.length - s ? nFrom : N[N.length - s - 1].i + 1;
  return [...a.slice(0, from), ...c.slice(nFrom, nTo), ...a.slice(to)].join('\n');
}

/** The edited text: the original with only the changed lines replaced, in the line ending and BOM it came with. */
function finish(e: Edit, before: string, edited: Document): string {
  const next = edited.toString(WRITE);
  let out = splice(e.src, before, next);
  // the splice must parse to exactly what the edited document holds; otherwise take the document's own text
  if (out !== undefined) {
    const check = parseDocument(out, READ);
    if (check.errors.length > 0 || JSON.stringify(check.toJS()) !== JSON.stringify(edited.toJS())) out = undefined;
  }
  const text = out ?? next;
  return (e.bom ? BOM : '') + (e.crlf ? text.replace(/\n/g, '\r\n') : text);
}

/** `text` with the value at `path` set; a string value keeps the quoting of the scalar it replaces, a collection is written in flow style. Undefined when the text does not parse as a mapping, or a parent of the key is not one. */
export function setConfigValue(text: string, path: string[], value: unknown): string | undefined {
  const e = open(text);
  if (e === undefined) return undefined;
  const before = e.doc.toString(WRITE);
  try {
    const prev = e.doc.getIn(path, true);
    if (isScalar(prev) && typeof value === 'string') {
      prev.value = value;
      if (AMBIGUOUS.test(value)) prev.type = Scalar.QUOTE_DOUBLE;
    } else {
      const node = e.doc.createNode(value) as Node;
      shape(node);
      if (prev !== undefined && prev !== null && typeof prev === 'object') {
        const old = prev as { comment?: string | null; commentBefore?: string | null };
        if (old.comment) (node as Node).comment = old.comment;
        if (old.commentBefore) (node as Node).commentBefore = old.commentBefore;
      }
      e.doc.setIn(path, node);
    }
  } catch {
    return undefined;
  }
  return finish(e, before, e.doc);
}

/** `text` without the key at `path`, and without any parent mapping that leaves empty; a key that is not there leaves the text exactly as it was. */
export function unsetConfigValue(text: string, path: string[]): string | undefined {
  const e = open(text);
  if (e === undefined) return undefined;
  if (!e.doc.hasIn(path)) return text;
  const before = e.doc.toString(WRITE);
  e.doc.deleteIn(path);
  for (let i = path.length - 1; i >= 1; i--) {
    const parent = e.doc.getIn(path.slice(0, i), true);
    if (!isMap(parent) || parent.items.length > 0) break;
    e.doc.deleteIn(path.slice(0, i));
  }
  return finish(e, before, e.doc);
}

/** `text` with each of `items` that the list at `path` lacks added at its end, in order, never twice; a missing list is created in flow style. Undefined for a text that does not parse or a key that holds something else. */
export function appendConfigList(text: string, path: string[], items: string[]): string | undefined {
  const e = open(text);
  if (e === undefined) return undefined;
  const before = e.doc.toString(WRITE);
  try {
    const list = e.doc.getIn(path, true);
    if (list === undefined) {
      const node = e.doc.createNode([...new Set(items)]) as Node;
      shape(node);
      e.doc.setIn(path, node);
    } else if (isSeq(list)) {
      const have = new Set(list.items.map((i) => (isScalar(i) ? String(i.value) : undefined)));
      for (const item of items) {
        if (have.has(item)) continue;
        have.add(item);
        const node = e.doc.createNode(item) as Node;
        shape(node);
        list.add(node);
      }
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return e.doc.toString(WRITE) === before ? text : finish(e, before, e.doc);
}

/**
 * ST-LN-50 D-05: the ids a changed id convention strands, in code-point order: every known id that breaks the new
 * convention and is not in its legacy_ids. Nothing when the convention is off afterwards or means the same as before.
 * `known` is every id the clone knows (tickets with their type, records, claims, ids in history; a type is optional);
 * an id the ticket schema would refuse is never listed, and an id given twice counts once.
 */
export function idConsequences(oldConfig: AccordConfig | undefined, newConfig: AccordConfig | undefined, known: readonly { id: string; type?: 'story' | 'bug' | 'epic' }[]): string[] {
  const after = conventionKey(newConfig);
  if (newConfig === undefined || after === undefined || after === conventionKey(oldConfig)) return [];
  const legacy = new Set(newConfig.legacy_ids ?? []);
  const types = new Map<string, 'story' | 'bug' | 'epic' | undefined>();
  for (const { id, type } of known) {
    if (LEGACY_ID.test(id) && (!types.has(id) || types.get(id) === undefined)) types.set(id, type);
  }
  // ids are ASCII (LEGACY_ID), so the code-unit order of `<` is the code-point order
  return [...types]
    .filter(([id, type]) => !legacy.has(id) && breaksConvention(id, type, newConfig))
    .map(([id]) => id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The value at `path` as plain data, or undefined when the key is not set or the text does not parse as a mapping. */
export function getConfigValue(text: string, path: string[]): unknown {
  const e = open(text);
  if (e === undefined) return undefined;
  const node = e.doc.getIn(path, true);
  if (node === undefined || node === null) return undefined;
  return isScalar(node) ? node.value : (node as Node).toJS(e.doc);
}

/** A value as one line of YAML flow: `rebase`, `[ba, dev]`, `{model: opus}`; what `accord config` prints. */
export function flowValue(value: unknown): string {
  const doc = new Document(value);
  shape(doc.contents);
  return doc.toString(WRITE).trimEnd();
}
