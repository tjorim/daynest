import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../custom_components/daynest/frontend",
    emptyOutDir: false,
    lib: {
      entry: "src/daynest-card.ts",
      formats: ["es"],
      fileName: () => "daynest-card.js",
    },
  },
});
