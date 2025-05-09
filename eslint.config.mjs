import json from '@eslint/json';
import markdown from '@eslint/markdown';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // Ignore built files and non-source JS
  {
    ignores: ['**/*.js', '**/*.cjs', '**/*.mjs', 'out/**'],
  },

  // TypeScript support using @typescript-eslint
  ...tseslint.config(
    {
      files: ['**/*.ts'],
      rules: {
        indent: ['error', 2], // Enforce 2-space indentation
        '@typescript-eslint/no-unused-vars': ['warn'],
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    }
  ),

  // JSON files
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },

  // JSONC files
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },

  // Markdown files
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
  },
]);