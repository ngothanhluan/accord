import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { cli: 'src/index.ts' }, // first line of src/index.ts is `#!/usr/bin/env node`
  format: ['esm'],
  platform: 'node',
  dts: false,
  fixedExtension: false, // emit dist/cli.js, not cli.mjs
});
