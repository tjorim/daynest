import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** On/off toggle on a native checkbox, drawn with the shared theme. */
function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "switch-box shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-background bg-contain bg-left bg-no-repeat align-top switch-knob checked:border-primary checked:bg-primary checked:bg-right checked:switch-knob-on focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Switch };
