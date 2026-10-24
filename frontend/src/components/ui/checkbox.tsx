import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native checkbox, so labels, forms and keyboard behaviour stay the browser's. */
function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "tw:size-4 tw:shrink-0 tw:cursor-pointer tw:align-middle tw:accent-brand tw:disabled:cursor-default tw:disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
