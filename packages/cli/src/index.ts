#!/usr/bin/env node
// Phase 1 placeholder entry: proves the workspace link, ESM, and shebang. Phase 5 replaces it with commander.
import { schemaIds, validate } from '@accord-dev/accord-core';
import pkg from '../package.json' with { type: 'json' };

if (process.argv[2] === '--version') {
  console.log(pkg.version);
} else {
  console.log(`accord ${pkg.version}`);
  console.log(`schemas: ${schemaIds.join(', ')}`);
  console.log(`validate('ticket', {}) -> ${validate('ticket', {}).length} findings`);
}
