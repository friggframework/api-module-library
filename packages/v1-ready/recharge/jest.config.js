module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.(ts|js)',
    '**/?(*.)+(spec|test).(ts|js)'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        allowJs: true,
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true
      }
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: [
    '**/*.{js,ts}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!jest.config.js',
    '!jest-setup.js',
    '!jest-teardown.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['./jest-setup.js'],
  globalTeardown: './jest-teardown.js'
};