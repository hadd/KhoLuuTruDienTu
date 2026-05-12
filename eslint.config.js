//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import reactPlugin from 'eslint-plugin-react'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default [
  ...tanstackConfig,
  {
    ignores: [
      '**/*.md',
      '**/*.mdc',
      '.cursor/**/*',
      'eslint.config.js',
      'prettier.config.js',
      'eslint-rules/**/*',
      'public/**',
      'scripts/**',
      'src/features/auth/types.d.ts',
    ],
  },
  // Use simple-import-sort only; disable TanStack import rules to avoid circular fixes
  {
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      'import/order': 'off',
      'import/first': 'off',
      'import/newline-after-import': 'off',
      'sort-imports': 'off',
    },
  },
  // React: catch missing key in list children (e.g. .map() without key)
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { react: reactPlugin },
    rules: {
      'react/jsx-key': 'error',
    },
  },
  // Workaround: no-unnecessary-condition triggers TS internal error in this file
  {
    files: ['src/features/assignments/components/grading/QuestionCard.tsx'],
    rules: { '@typescript-eslint/no-unnecessary-condition': 'off' },
  },
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      // Import order
      'simple-import-sort/imports': 'warn',
      // Detect hardcoded common UI strings in JSX
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'JSXText[value=/^(Actions|Close|ID:|ID|Cancel|Confirm|Delete|Edit|Save|Submit|Loading\\.\\.\\.|Error|Success)$/]',
          message:
            'Hardcoded UI string "{{value}}" should use i18n translation. Use t() function instead.',
        },
        {
          selector:
            'Literal[value=/^(Actions|Close|ID:|ID|Cancel|Confirm|Delete|Edit|Save|Submit|Loading\\.\\.\\.|Error|Success)$/]',
          message:
            'Hardcoded UI string "{{value}}" should use i18n translation. Use t() function instead.',
        },
      ],
    },
  },
]
