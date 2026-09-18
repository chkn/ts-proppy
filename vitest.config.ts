import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Match the build's `jsx: react-jsx`, so component files need no React import.
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
  },
})
