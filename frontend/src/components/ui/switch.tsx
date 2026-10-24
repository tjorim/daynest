import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** On/off toggle on a native checkbox, drawn like Bootstrap's `.form-switch`. */
function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "tw:switch-box tw:shrink-0 tw:cursor-pointer tw:appearance-none tw:rounded-full tw:border tw:border-border tw:bg-background tw:bg-contain tw:bg-left tw:bg-no-repeat tw:align-top tw:switch-knob tw:checked:border-primary tw:checked:bg-primary tw:checked:bg-right tw:checked:switch-knob-on tw:focus-visible:border-primary/50 tw:focus-visible:ring-4 tw:focus-visible:ring-primary/25 tw:focus-visible:outline-none tw:disabled:pointer-events-none tw:disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Switch };
