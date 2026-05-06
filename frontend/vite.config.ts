/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          include: [
            "tests/features/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "tests/components/**/*.{test,spec}.?(c|m)[jt]s?(x)",
          ],
          environment: "jsdom",
          env: {
            TZ: "UTC",
          },
          setupFiles: ["./tests/setup.ts"],
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
    ],
    coverage: {
      provider: "v8",
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
