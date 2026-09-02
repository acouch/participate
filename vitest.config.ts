import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
