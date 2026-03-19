import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      'apps/server',
      'apps/web',
      'packages/db',
      'packages/adapter-utils',
      'packages/shared',
      'packages/adapters/opencode-local',
      'packages/adapters/pi-local',
    ],
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx', 'src/__tests__/**/*.spec.ts', 'src/__tests__/**/*.spec.tsx'],
  },
});
