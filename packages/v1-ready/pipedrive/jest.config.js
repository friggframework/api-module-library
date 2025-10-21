/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test', '<rootDir>/src'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    coverageThreshold: {
        global: {
            statements: 13,
            branches: 0,
            functions: 1,
            lines: 13,
        },
    },
    // A path to a module which exports an async function that is triggered once before all test suites
    globalSetup: './jest-setup.js',

    // A path to a module which exports an async function that is triggered once after all test suites
    globalTeardown: './jest-teardown.js',
};
