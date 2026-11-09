/*
 * Jest config for the Binding C item 4a receipt job.
 *
 * Omits the package's MongoMemoryServer globalSetup/Teardown: the 4a tests
 * exercise Definition.requiredAuthMethods and Api against nock, and do not
 * need a database. Full `npm test` (jest.config.js) still uses mongo and is
 * excluded from this command (see the receipt exclusions).
 */
module.exports = {
    testMatch: [
        '<rootDir>/tests/auth-api-synthetic.test.js',
        '<rootDir>/tests/definition.test.js',
        '<rootDir>/tests/listContacts.test.js',
        '<rootDir>/tests/oauth.test.js',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/tests/api.test.js',
        '/tests/auther.test.js',
        '/tests/extensions/',
    ],
};
