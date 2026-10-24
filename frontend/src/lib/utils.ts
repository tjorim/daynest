import { createCn } from "cn/config";

// Preserve custom font-size utilities alongside text colours when merging classes.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["h3", "h4", "h5", "h6", "small", "badge", "fluid-3", "fluid-4", "fluid-5"] },
      ],
    },
  },
});
