import { createCn } from "cn/config";

// Tailwind utilities carry the `tw:` prefix while Bootstrap is loaded; see tailwind.css.
export const cn = createCn({ prefix: "tw" });
