import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Tests run outside the react-server condition; resolve the marker to its no-op build.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Loads .env.local (never overriding real env vars) for integration tests against local Supabase.
    setupFiles: ['scripts/lib/env.ts'],
    passWithNoTests: true,
  },
})
