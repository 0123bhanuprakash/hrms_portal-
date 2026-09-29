/** @type {import("eslint").Linter.Config} */
const base = require('./eslint-base');

module.exports = {
  ...base,
  extends: [
    ...base.extends,
    'next/core-web-vitals',
  ],
  rules: {
    ...base.rules,
    // Next.js specific
    '@next/next/no-html-link-for-pages': 'error',
    'react/display-name': 'off',
    'react/prop-types': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  env: {
    ...base.env,
    browser: true,
  },
  settings: {
    react: { version: 'detect' },
  },
};
