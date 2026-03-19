import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.spec.ts'],
  },
});
