import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/daynest-card.ts",
  output: {
    file: "../custom_components/daynest/frontend/daynest-card.js",
    format: "es",
  },
  plugins: [nodeResolve(), typescript(), !process.env.ROLLUP_WATCH && terser()].filter(Boolean),
};
