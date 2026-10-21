/*
 * Live OAuth / MongoMemoryServer suite (tests/api.test.js).
 * Requires HubSpot credentials and a working mongodb-memory-server binary.
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/api.test.js', '**/tests/auther.test.js'],
    globalSetup: './jest-setup.js',
    globalTeardown: './jest-teardown.js',
};
