import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { defineConfig } from "oxlint";

// Bootstrap and the app's own stylesheets still provide most classes while the migration is in
// progress. Generate the allow-list from the CSS itself so it never drifts by hand, and delete
// the entries as the stylesheets go. Tailwind classes themselves are validated by the rule.
const require = createRequire(import.meta.url);
const legacyStylesheets = [
  require.resolve("bootstrap/dist/css/bootstrap.min.css"),
  require.resolve("bootstrap-icons/font/bootstrap-icons.min.css"),
  require.resolve("@schedule-x/theme-default/dist/index.css"),
  new URL("./src/app.css", import.meta.url).pathname,
  new URL("./src/components/ui/dialog.css", import.meta.url).pathname,
  new URL("./src/features/calendar/calendar.css", import.meta.url).pathname,
];
const legacyClasses = [
  ...new Set(
    legacyStylesheets.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]!),
    ),
  ),
];

export default defineConfig({
  ignorePatterns: ["src/paraglide/**"],
  jsPlugins: ["@shadcn/lint"],
  rules: {
    "shadcn/no-arbitrary-values": "error",
    "shadcn/no-raw-colors": "error",
    "shadcn/no-inline-styles": "error",
    "shadcn/no-unknown-classes": ["error", { allow: legacyClasses }],
  },
});
