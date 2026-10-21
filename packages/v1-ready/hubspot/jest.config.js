/*
 * Default suite is offline unit tests (no live HubSpot OAuth, no MongoDB).
 * Live integration coverage lives in tests/api.test.js and is opted into with:
 *   npm test -- --config jest.live.config.js
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        // Live / Mongo-backed suites (opt in via jest.live.config.js)
        '/tests/api\\.test\\.js$',
        '/tests/auther\\.test\\.js$',
    ],
    coverageThreshold: {
        global: {
            statements: 13,
            branches: 0,
            functions: 1,
            lines: 13,
        },
    },
};
