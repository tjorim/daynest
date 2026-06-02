import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import css from "rollup-plugin-import-css";

export default {
  input: "src/daynest-card.ts",
  output: {
    file: "../custom_components/daynest/frontend/daynest-card.js",
    format: "es",
  },
  plugins: [nodeResolve(), css(), typescript(), !process.env.ROLLUP_WATCH && terser()].filter(Boolean),
};
