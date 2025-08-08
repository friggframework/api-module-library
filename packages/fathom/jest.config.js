module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        '**/*.js',
        '!jest.config.js',
        '!coverage/**',
        '!node_modules/**',
        '!tests/**',
        '!jest-setup.js',
        '!jest-teardown.js',
    ],
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['./jest-setup.js'],
    globalTeardown: './jest-teardown.js',
    testMatch: ['**/tests/**/*.test.js'],
    testTimeout: 30000,
};