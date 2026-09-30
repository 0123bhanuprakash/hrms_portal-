import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
    exclude: ['dist', 'node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{spec,test}.ts', 'src/main.ts'],
    },
  },
  resolve: {
    alias: {
      '@hrms/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
});
