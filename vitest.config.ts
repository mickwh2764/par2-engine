import { defineConfig } from "vitest/config";
import path from "path";

// vite.config.ts roots the client app in client/, so tests get their own root.
export default defineConfig({
  test: {
    root: __dirname,
    include: [
      "server/**/*.test.ts",
      "script/**/*.test.ts",
      "shared/**/*.test.ts",
      "client/src/**/*.test.ts",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
