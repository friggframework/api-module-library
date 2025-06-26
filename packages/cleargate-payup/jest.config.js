module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/jest.config.js',
        '!**/jest-*.js'
    ],
    setupFilesAfterEnv: ['./jest-setup.js'],
    globalTeardown: './jest-teardown.js'
};
