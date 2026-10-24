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
      className={cn(
        "tw:flex tw:h-4 tw:overflow-hidden tw:rounded-md tw:bg-secondary-bg tw:text-xs",
        className,
      )}
      {...props}
    >
      <div
        className="tw:flex tw:w-(--completion-percent) tw:flex-col tw:justify-center tw:overflow-hidden tw:bg-primary tw:text-center tw:whitespace-nowrap tw:text-white tw:transition-all tw:duration-600"
        style={{ "--completion-percent": `${value}%` } as CSSProperties}
      />
    </div>
  );
}

export { Progress };
