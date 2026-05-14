import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Block direct imports of core/db singletons from module-level code.
  // Only app/api/** routes and core/db/** internals may import client/migrate directly.
  {
    files: ['modules/**/*.{ts,tsx}', 'core/!(db)/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/core/db/client*', '*/core/db/migrate*'],
              message:
                'Import DB client/migrate only in app/api/** or core/db/**. Sub-modules use their own schema files.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
