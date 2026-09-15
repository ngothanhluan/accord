// CLI-05 `accord gate ready|done <id>`: the verdict comes off the pure core gate and from nothing else
// — the CLI adds no rule, no filter, and no level change (D-87). A passing Ready then performs the one
// write accord makes to a file a human owns: `ac_hash` into the ticket (D-86, D-96). The result reaches
// stdout before the write is attempted, so a write failure is reported after the true verdict rather
// than instead of it (D-97). Under `--json` stdout carries the GateResult verbatim and every notice
// goes to stderr, so `jq '.findings[]'` works with no unwrapping (D-98).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gateDone, gateReady, renderText, setFrontmatterKey } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import { colourFindings } from '../render/color.js';
import type { CommandContext } from '../run.js';

export function gate(
  ctx: CommandContext,
  which: 'ready' | 'done',
  id: string,
  options: { json?: boolean },
): number {
  const result = which === 'ready' ? gateReady(ctx.snapshot, id) : gateDone(ctx.snapshot, id);
  ctx.stdout.write(
    options.json ? JSON.stringify(result, null, 2) + '\n' : colourFindings(renderText(result), ctx.stdout),
  );

  // D-96: no flag, option, or environment variable enables or suppresses this. `acHash` is absent when
  // the ticket is unknown or carries no `@ac-n` scenario, and there is then nothing to record.
  if (which === 'ready' && result.verdict === 'pass' && result.acHash !== undefined) {
    // T-05-07: the path is the loader's own record for a ticket that exists, joined to the resolved
    // root — the raw `<id>` argument is a key lookup that misses, never a path segment.
    const rel = ctx.snapshot.tickets[id].file;
    const file = join(ctx.root, rel);
    try {
      const text = readFileSync(file, 'utf8');
      // Core normalises to LF and strips the BOM (D-38/FMT-08) — correct for a consumer with no
      // filesystem, wrong for the one write we make to a document a human owns. Restoring the
      // file's own shape keeps a CRLF ticket a one-line diff instead of a whole-file rewrite.
      const bom = text.startsWith('﻿') ? '﻿' : '';
      const crlf = text.includes('\r\n');
      const body = setFrontmatterKey(text, 'ac_hash', result.acHash);
      const next = bom + (crlf ? body.replace(/\r?\n/g, '\r\n') : body);
      // T-05-08, D-96: writing only on a difference is what makes a second consecutive `gate ready`
      // leave the bytes and the mtime alone. Restoring the shape first is what keeps that true for
      // a CRLF or BOM file, which would otherwise differ on every run.
      if (next !== text) {
        writeFileSync(file, next);
        // T-05-09, D-98: stderr, so a `--json` consumer's stdout stays one clean document.
        // Replacing a differing hash is a distinct event from recording an absent one: the
        // acceptance criteria moved, which also staled `verified_hash` and will fail the next
        // `gate done`. One line, so that is not silent.
        const prev = ctx.snapshot.tickets[id].frontmatter?.ac_hash;
        ctx.stderr.write(
          prev === undefined
            ? 'wrote ac_hash ' + result.acHash + ' to ' + rel + '\n'
            : 'updated ac_hash ' + prev + ' -> ' + result.acHash + ' in ' + rel + '\n',
        );
      }
    } catch (err) {
      // D-97: an environment failure, not a verdict. The result is already on stdout, so the caller
      // sees the true verdict and the real failure; exit 2 keeps CI from going green with no hash.
      throw new UsageError(
        'cannot write ac_hash to ' + rel + ': ' + (err instanceof Error ? err.message : String(err)),
      );
    }
  }
  return result.verdict === 'fail' ? 1 : 0;
}
