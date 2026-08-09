/**
 * Node by default; `tests/client.spec.tsx` opts into jsdom with its own
 * `@vitest-environment` pragma, which keeps the environment choice next to
 * the test that needs it.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
