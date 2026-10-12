// Records approved_hash the way `accord approve` does, so a test can start from an approved lane ticket.
import { loadSnapshot, setFrontmatterKey } from '../../src/index.js';
import { approvedHash } from '../../src/gate/hash.js';

export function approved(files: Record<string, string>, id: string): Record<string, string> {
  const path = 'accord/tickets/' + id + '.md';
  const ticket = loadSnapshot({ files, tree: [] }).tickets[id];
  return { ...files, [path]: setFrontmatterKey(files[path], 'approved_hash', approvedHash(ticket)) };
}
