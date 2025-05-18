import { globalIgnores } from 'eslint/config';
import prettierPlugin from 'eslint-plugin-prettier';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended, // Used by FlatCompat
});

export default (async () => [
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', '**/.wrangler/']),
  js.configs.recommended, // ESLint's own recommended flat config
  ...(await compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  )),
  {
    // Customizations and overrides
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.cjs'],
    plugins: {
      prettier: prettierPlugin, // Ensure prettier plugin is available for the rule below
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          trailingComma: 'es5',
          singleQuote: true,
        },
      ],
    },
  },
  {
    // Specific settings for TypeScript files, especially parser and project linkage
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname, // Directory containing tsconfig.json (project root)
      },
    },
  },
])();
