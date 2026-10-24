import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "tw:bg-brand tw:text-white",
  secondary: "tw:bg-secondary tw:text-white",
  success: "tw:bg-success tw:text-white",
  danger: "tw:bg-danger tw:text-white",
  warning: "tw:bg-warning tw:text-black",
  info: "tw:bg-info tw:text-black",
  light: "tw:bg-light tw:text-black",
} as const;

type BadgeVariant = keyof typeof variants;

/** The colours of a badge, for elements that carry their own shape (such as a summary pill). */
function badgeColors(variant: BadgeVariant) {
  return variants[variant];
}

/** Small status label. Its padding and size scale with the surrounding font size. */
function Badge({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "tw:inline-block tw:rounded-md tw:p-badge tw:text-center tw:text-badge tw:leading-none tw:font-bold tw:whitespace-nowrap tw:align-baseline",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeColors };
export type { BadgeVariant };
