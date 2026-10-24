import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native checkbox drawn with the shared theme, so labels, forms and keyboard behaviour stay the browser's. */
function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "checkbox-box shrink-0 cursor-pointer appearance-none rounded-sm border border-border bg-background bg-contain bg-center bg-no-repeat align-top checked:border-primary checked:bg-primary checked:checkbox-check focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
