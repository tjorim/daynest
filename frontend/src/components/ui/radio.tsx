import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native radio button drawn with the shared theme, so grouping and arrow-key behaviour stay the browser's. */
function Radio({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="radio"
      className={cn(
        "checkbox-box shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-background bg-contain bg-center bg-no-repeat align-top checked:border-primary checked:bg-primary checked:radio-dot focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Radio };
