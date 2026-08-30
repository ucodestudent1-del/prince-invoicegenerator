import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const srcDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "src");
const nextNavigation = fileURLToPath(new URL("./node_modules/next/navigation.js", import.meta.url));
const intlNavStub = fileURLToPath(new URL("./tests/__mocks__/next-intl-navigation.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": `${srcDir}/`,
      "next/navigation": nextNavigation,
      "next-intl/navigation": intlNavStub,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    setupFiles: ["tests/setup.ts"],
    fileParallelism: true,
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts", "src/middleware.ts"],
      exclude: [
        "src/lib/db.ts",
        "src/lib/stripe.ts",
        "src/lib/r2.ts",
        "src/lib/r2-storage.ts",
        "src/lib/pdf-generator.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 45,
        functions: 45,
        statements: 45,
        branches: 60,
      },
    },
  },
});
