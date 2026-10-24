import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand text-white",
  secondary: "bg-secondary text-white",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
  warning: "bg-warning text-black",
  info: "bg-info text-black",
  light: "bg-light text-black",
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
        "inline-block rounded-md p-badge text-center text-badge leading-none font-bold whitespace-nowrap align-baseline",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeColors };
export type { BadgeVariant };
