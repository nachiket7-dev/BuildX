module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',

    // Covered at compile time by tsconfig's `noUnusedLocals` / `noUnusedParameters`,
    // which understand type-only imports and JSX usage better than ESLint does.
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off',

    // Correct to disable for TypeScript: tsc resolves identifiers properly, while
    // this rule reports false positives on types, enums and ambient globals.
    'no-undef': 'off',

    // 'warn', not 'error': there is pre-existing debt here, and stale-closure bugs
    // are exactly what this rule catches (it was masking a real one in App.tsx).
    // Surfacing them keeps `npm run lint` green while making the debt visible.
    'react-hooks/exhaustive-deps': 'warn',
  },
};
