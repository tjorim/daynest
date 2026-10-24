import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "border-primary-border-subtle bg-primary-subtle text-primary-emphasis",
  secondary: "border-secondary-border-subtle bg-secondary-subtle text-secondary-emphasis",
  success: "border-success-border-subtle bg-success-subtle text-success-emphasis",
  danger: "border-danger-border-subtle bg-danger-subtle text-danger-emphasis",
  warning: "border-warning-border-subtle bg-warning-subtle text-warning-emphasis",
  info: "border-info-border-subtle bg-info-subtle text-info-emphasis",
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
      className={cn("relative mb-4 rounded-md border p-4", variants[variant], className)}
      {...props}
    />
  );
}

export { Alert };
export type { AlertVariant };
