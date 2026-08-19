/*
 * Offline unit tests only — no live API calls, no database.
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
};
