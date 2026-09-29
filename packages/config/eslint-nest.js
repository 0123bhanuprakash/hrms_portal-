/** @type {import("eslint").Linter.Config} */
const base = require('./eslint-base');

module.exports = {
  ...base,
  extends: [
    ...base.extends,
  ],
  rules: {
    ...base.rules,
    // NestJS specific
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    // Decorators are heavily used in NestJS
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
  },
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
};
