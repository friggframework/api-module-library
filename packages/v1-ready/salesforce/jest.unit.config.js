/**
 * Unit test config — no database setup required.
 * Use for tests that mock all external dependencies (API, jsforce, etc.)
 * Run with: npm run test:unit
 */
module.exports = {
    testMatch: ['**/test/api.test.js', '**/test/definition.test.js'],
};
