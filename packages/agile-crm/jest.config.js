/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
    coverageThreshold: {
        global: {
            statements: 13,
            branches: 0,
            functions: 1,
            lines: 13,
        },
    },
    globalSetup: './jest-setup.js',
    globalTeardown: './jest-teardown.js',
};
