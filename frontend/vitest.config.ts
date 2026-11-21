import path from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [
    react(),
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- paraglide plugin types don't match vitest's plugin type
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["globalVariable", "baseLocale"],
      emitTsDeclarations: true,
    }) as any,
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          include: [
            "tests/features/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "tests/components/**/*.{test,spec}.?(c|m)[jt]s?(x)",
          ],
          environment: "happy-dom",
          env: {
            TZ: "UTC",
          },
          setupFiles: ["./tests/setup.ts", "./tests/setup.msw.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          include: ["tests/lib/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          environment: "node",
          env: {
            TZ: "UTC",
          },
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "scripts",
          include: ["scripts/**/*.test.mjs"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "msw",
          include: ["tests/msw/**/*.test.?(c|m)[jt]s?(x)"],
          environment: "happy-dom",
          env: {
            TZ: "UTC",
          },
          setupFiles: ["./tests/setup.ts", "./tests/setup.msw.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/paraglide/**", "src/main.tsx", "src/assets/**", "src/**/*.md"],
      reporter: ["text", "lcov"],
      // Floors just below the measured totals (statements 49.10, branches 44.35, functions 42.98, lines 49.73), so
      // coverage cannot regress unnoticed. Raise them as tests are added; never lower them to land a change.
      thresholds: {
        statements: 49,
        branches: 44,
        functions: 42,
        lines: 49,
        // The Today actions and sections keep their own, higher floor (measured together: 84.5% lines).
        "src/features/today/{useTodayActions.ts,TodaySections.tsx}": { lines: 80 },
      },
    },
  },
});
