// The one kind of write accord makes to a document a human owns: one frontmatter key, every other byte
// kept. Shared by `gate ready` (ac_hash, D-96) and `approve` (approved_hash, spec §4). Core normalises to
// LF and strips the BOM (D-38); restoring the file's own shape keeps a CRLF ticket a one-line diff.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';

const BOM = '﻿';

/** Writes `key: "value"` into `root/rel` and returns true, or returns false when the bytes would not change. */
export function writeKey(root: string, rel: string, key: string, value: string): boolean {
  const file = join(root, rel);
  const text = readFileSync(file, 'utf8');
  const bom = text.startsWith(BOM) ? BOM : '';
  const crlf = text.includes('\r\n');
  const body = setFrontmatterKey(text, key, value);
  const next = bom + (crlf ? body.replace(/\r?\n/g, '\r\n') : body);
  // T-05-08: writing only on a difference keeps a second run's bytes and mtime unchanged.
  if (next === text) return false;
  writeFileSync(file, next);
  return true;
}
