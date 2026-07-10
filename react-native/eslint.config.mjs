import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(compat.extends('@react-native', 'prettier')),
    plugins: { prettier },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    // SDK code must write through internalConsole so LogCollector never
    // captures the SDK's own output.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      'src/__tests__/**',
      'src/events/logCollector.ts',
      'src/utils/internalConsole.ts',
    ],
    rules: {
      'no-console': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'lib/', 'example/', 'scripts/', 'plugin/'],
  },
]);
