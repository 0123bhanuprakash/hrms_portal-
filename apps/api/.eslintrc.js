/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...require('@hrms/config/eslint-nest'),
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
