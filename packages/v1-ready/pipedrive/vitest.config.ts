import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 13,
        branches: 0,
        functions: 1,
        lines: 13,
      },
    },
    globalSetup: './jest-setup.js',
    globalTeardown: './jest-teardown.js',
  },
});
