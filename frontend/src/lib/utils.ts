import { createCn } from "cn/config";

// Tailwind utilities carry the `tw:` prefix while Bootstrap is loaded; see tailwind.css. The
// extra font sizes are the `--text-*` tokens and `@utility` sizes declared there, so `cn` keeps a
// `tw:text-h5` next to a `tw:text-muted-foreground` instead of treating both as colours.
export const cn = createCn({
  prefix: "tw",
  extend: {
    classGroups: {
      "font-size": [
        { text: ["h3", "h4", "h5", "h6", "small", "badge", "fluid-3", "fluid-4", "fluid-5"] },
      ],
    },
  },
});
