import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // PGlite WASM startup can take a moment on first run.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
