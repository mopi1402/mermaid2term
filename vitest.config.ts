import { defineConfig } from "vitest/config";

// The library's own suite, and nothing under `packages/`: the playground runs its own from its own directory.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
