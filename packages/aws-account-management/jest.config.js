module.exports = {
    testEnvironment: 'node',
    collectCoverage: true,
    collectCoverageFrom: [
        '**/*.{js,jsx}',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/tests/**',
        '!jest.config.js',
        '!jest-setup.js',
        '!jest-teardown.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: [
        '**/test/**/*.js',
        '**/tests/**/*.js',
        '**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
    globalTeardown: '<rootDir>/jest-teardown.js'
};
