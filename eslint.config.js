import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Complexity rules are warnings on purpose: they map the refactoring hotspots without blocking CI.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'public', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] } },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'warn',
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 3],
    },
  },
);
