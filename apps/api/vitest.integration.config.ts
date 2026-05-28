import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    globalTeardown: ['./src/test/integration-teardown.ts'],
    restoreMocks: true,
    testTimeout: 30_000
  }
});
