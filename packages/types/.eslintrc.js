/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...require('@hrms/config/eslint-base'),
  root: true,
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
