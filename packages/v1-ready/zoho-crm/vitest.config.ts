import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 240000,
    hookTimeout: 240000,
    globalSetup: './vitest-setup.js',
    globalTeardown: './vitest-teardown.js',
  },
});
