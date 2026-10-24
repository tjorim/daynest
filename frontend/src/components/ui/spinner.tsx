import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Indeterminate activity indicator. Decorative: pair it with visible or screen-reader text. */
function Spinner({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "tw:inline-block tw:size-4 tw:animate-spinner tw:rounded-full tw:border-3 tw:border-current tw:border-r-transparent tw:align-spinner",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
