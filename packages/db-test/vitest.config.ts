import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // subir o Postgres em WASM e aplicar 32 migrations leva alguns segundos
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
