import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "tw:border-primary-border-subtle tw:bg-primary-subtle tw:text-primary-emphasis",
  secondary: "tw:border-secondary-border-subtle tw:bg-secondary-subtle tw:text-secondary-emphasis",
  success: "tw:border-success-border-subtle tw:bg-success-subtle tw:text-success-emphasis",
  danger: "tw:border-danger-border-subtle tw:bg-danger-subtle tw:text-danger-emphasis",
  warning: "tw:border-warning-border-subtle tw:bg-warning-subtle tw:text-warning-emphasis",
  info: "tw:border-info-border-subtle tw:bg-info-subtle tw:text-info-emphasis",
} as const;

type AlertVariant = keyof typeof variants;

/** Inline status message. Pass `role="alert"` for errors and `role="status"` for progress. */
function Alert({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      className={cn(
        "tw:relative tw:mb-4 tw:rounded-md tw:border tw:p-4",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
export type { AlertVariant };
