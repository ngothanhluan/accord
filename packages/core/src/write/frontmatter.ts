// D-43 write primitive: change one frontmatter key and leave every other byte alone.
// yaml's parseDocument validates the block and locates the key; only the new pair is serialised and
// spliced into the original text, so comments, alignment, quoting, and the body survive byte-for-byte.
// D-44 block lists ([] when empty), D-45 double-quoted strings, FMT-08 LF and no BOM.
import { Document, Scalar, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Node, Pair } from 'yaml';
import { splitFrontmatter, stringNumerics } from '../load/frontmatter.js';

export type FrontmatterValue = string | boolean | string[];

const options = { schema: 'core', customTags: stringNumerics } as const;
const isKey = (p: Pair, key: string): boolean => isScalar(p.key) && p.key.value === key;
const startOf = (p: Pair): number => (p.key as Node).range?.[0] ?? 0;
// A pair's source ends where its value (or its key, when there is no value) ends: the trailing comment
// and newline are inside; comments on the following lines belong to the next key (verified on yaml 2.9).
const endOf = (p: Pair): number => ((p.value ?? p.key) as Node).range?.[2] ?? 0;

export function setFrontmatterKey(text: string, key: string, value: FrontmatterValue): string {
  const { yaml, body } = splitFrontmatter(text); // strips a leading BOM and CRLF first (D-38)
  if (yaml === null) throw new Error('setFrontmatterKey: no frontmatter block');
  const doc = parseDocument(yaml, options);
  if (doc.errors.length > 0) {
    throw new Error('setFrontmatterKey: invalid YAML: ' + doc.errors[0].message.split('\n')[0]);
  }
  if (!isMap(doc.contents)) throw new Error('setFrontmatterKey: frontmatter is not a mapping');

  // D-45: every string core writes is double-quoted; booleans stay plain. D-44: block list, [] when empty.
  const out = new Document({}, options);
  const node = out.createNode(value);
  if (isScalar(node) && typeof value === 'string') node.type = Scalar.QUOTE_DOUBLE;
  if (isSeq(node)) {
    node.flow = node.items.length === 0;
    for (const item of node.items) if (isScalar(item)) item.type = Scalar.QUOTE_DOUBLE;
  }

  const items = doc.contents.items;
  const existing = items.find((p) => isKey(p, key));
  if (existing) {
    // The trailing `# comment` on the key line is inside the replaced span, so carry it over.
    const old = existing.value as Node | null;
    if (old?.comment) node.comment = old.comment;
    if (old?.commentBefore) node.commentBefore = old.commentBefore;
  }
  out.set(key, node);
  const pair = out.toString({ lineWidth: 0 }); // ends with one newline

  let next: string;
  if (existing) {
    const start = startOf(existing);
    const end = endOf(existing);
    const withNewline = yaml[end - 1] === '\n'; // false only for the last pair of the block
    next = yaml.slice(0, start) + (withNewline ? pair : pair.slice(0, -1)) + yaml.slice(end);
  } else {
    const vi = items.findIndex((p) => isKey(p, 'verified'));
    if (vi >= 0 && key !== 'verified') {
      // D-43: a new key goes right after the pair before `verified`, so verified's own comments stay with it.
      const at = vi === 0 ? 0 : endOf(items[vi - 1]);
      next = yaml.slice(0, at) + pair + yaml.slice(at);
    } else {
      // `verified` itself, or any key when `verified` is absent, becomes the last line of the block.
      next = yaml + '\n' + pair.slice(0, -1);
    }
  }
  return '---\n' + next + '\n---\n' + body;
}
