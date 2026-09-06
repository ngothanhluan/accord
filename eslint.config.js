import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodeBuiltins = [
  'fs', 'fs/promises', 'path', 'child_process', 'os', 'url', 'crypto', 'process',
  'util', 'stream', 'events', 'buffer', 'module', 'worker_threads', 'net', 'http', 'https', 'tty',
  'readline', 'zlib', 'assert',
];
const purity = 'core is isomorphic: no Node built-ins (CORE-01)';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}', '**/scripts/**', '**/test/**'],
    languageOptions: { globals: globals.node },
  },
  // Guard layer A (CORE-01): no Node built-ins anywhere in core's shipped source.
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: nodeBuiltins.map((name) => ({ name, message: purity })),
        patterns: [{ group: ['node:*'], message: purity }],
      }],
    },
  },
  // D-20 seam: only src/validate/ajv.ts may import ajv. Uses the BASE rule id so it does not
  // replace the purity block's options for the same files.
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/validate/ajv.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'ajv', message: 'import ajv only in src/validate/ajv.ts (D-20)' }],
        patterns: ['ajv/*'],
      }],
    },
  },
);
