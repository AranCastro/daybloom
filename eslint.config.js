// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Tests put jest.mock() above their imports so the mocks read first; babel-jest hoists them anyway.
    files: ['__tests__/**'],
    rules: { 'import/first': 'off' },
  },
]);
