import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native checkbox drawn like Bootstrap's, so labels, forms and keyboard behaviour stay the browser's. */
function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "tw:mt-1 tw:size-4 tw:shrink-0 tw:cursor-pointer tw:appearance-none tw:rounded-sm tw:border tw:border-border tw:bg-background tw:bg-contain tw:bg-center tw:bg-no-repeat tw:align-top tw:checked:border-primary tw:checked:bg-primary tw:checked:checkbox-check tw:focus-visible:border-primary/50 tw:focus-visible:ring-4 tw:focus-visible:ring-primary/25 tw:focus-visible:outline-none tw:disabled:pointer-events-none tw:disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
