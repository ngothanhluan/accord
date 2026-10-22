// ST-LN-34: mark a ticket file dropped. Status via setFrontmatterKey; the `## Dropped` section is spliced by line,
// fence-aware through scan(), and the file's BOM and CRLF come back byte for byte.
import { normaliseText, splitFrontmatter } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';
import { setFrontmatterKey } from './frontmatter.js';

/** The text with `status: dropped` and a `## Dropped` reason; undefined when no reason is given and none is written. */
export function markDropped(text: string, reason?: string): string | undefined {
  const bom = text.startsWith('﻿');
  const crlf = text.includes('\r\n');
  const lf = setFrontmatterKey(normaliseText(text), 'status', 'dropped');
  const { body, bodyOffset } = splitFrontmatter(lf);
  const { sections } = scan(body, bodyOffset);
  const at = sections.findIndex((s) => headingKey(s.heading) === 'dropped');
  const dropped = at < 0 ? undefined : sections[at];
  let out = lf;
  if (reason === undefined) {
    if (dropped === undefined || !stripHtmlComments(dropped.lines).some((l) => l.text.trim() !== '')) return undefined;
  } else if (dropped !== undefined) {
    const lines = lf.split('\n');
    const next = sections[at + 1];
    const end = next !== undefined ? next.line - 1 : lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    lines.splice(dropped.line, end - dropped.line, ...(next === undefined ? [reason] : [reason, '']));
    out = lines.join('\n');
  } else {
    const notes = sections.find((s) => headingKey(s.heading) === 'verification notes');
    if (notes !== undefined) {
      const lines = lf.split('\n');
      lines.splice(notes.line - 1, 0, '## Dropped', reason, '');
      out = lines.join('\n');
    } else {
      out = lf.replace(/\n*$/, '\n') + '\n## Dropped\n' + reason + '\n';
    }
  }
  if (crlf) out = out.replace(/\n/g, '\r\n');
  return (bom ? '﻿' : '') + out;
}
