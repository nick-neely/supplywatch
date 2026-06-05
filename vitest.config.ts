import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./packages/dashboard/src", import.meta.url).pathname,
    },
  },
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
