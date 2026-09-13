/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  // jose and @digitalbazaar/vc-bitstring-status-list (plus its ESM-only
  // dependencies @digitalbazaar/* and base64url-universal) ship ESM-only;
  // Jest's module system can't load raw `export` syntax from node_modules
  // by default, so let babel-jest transpile these.
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(jose|@digitalbazaar|base64url-universal)/)'],
}
