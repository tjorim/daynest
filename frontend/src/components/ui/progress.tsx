import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Determinate progress bar. `value` is a percentage from 0 to 100; pass an `aria-label`. */
function Progress({
  value,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("flex h-4 overflow-hidden rounded-md bg-secondary-bg text-xs", className)}
      {...props}
    >
      <div
        className="flex w-(--completion-percent) flex-col justify-center overflow-hidden bg-primary text-center whitespace-nowrap text-white transition-all duration-600"
        style={{ "--completion-percent": `${value}%` } as CSSProperties}
      />
    </div>
  );
}

export { Progress };
