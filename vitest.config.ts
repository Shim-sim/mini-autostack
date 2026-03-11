import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@mini-autostack/core": path.resolve(__dirname, "packages/core/src"),
      "@mini-autostack/agents": path.resolve(__dirname, "packages/agents/src"),
      "@mini-autostack/compilers": path.resolve(__dirname, "packages/compilers/src"),
    },
  },
});
