import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { cli: 'src/index.ts' }, // first line of src/index.ts is `#!/usr/bin/env node`
  format: ['esm'],
  platform: 'node',
  dts: false,
  fixedExtension: false, // emit dist/cli.js, not cli.mjs
  // D-150: core is private and never published, so it must not be an install-time dependency of the
  // one package that is — left external, every `npx --yes` install asks the registry for a name that
  // 404s. Its own tree (ajv, yaml, gherkin) follows it in, because those are core's dependencies and
  // not this package's. `deps.alwaysBundle`, not `noExternal`: tsdown 0.23.0 deprecates the latter
  // and throws if both are set.
  deps: { alwaysBundle: ['@accord-dev/accord-core'] },
});
