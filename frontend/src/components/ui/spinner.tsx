import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Indeterminate activity indicator. Decorative: pair it with visible or screen-reader text. */
function Spinner({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 animate-spinner rounded-full border-3 border-current border-r-transparent align-spinner",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
