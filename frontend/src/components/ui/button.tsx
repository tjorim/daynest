import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base = cn(
  "inline-block btn-badge cursor-pointer rounded-md border border-transparent bg-transparent px-3 py-1.5 text-center align-middle text-base leading-normal font-normal no-underline transition-colors select-none focus-visible:ring-4 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65 aria-disabled:pointer-events-none aria-disabled:opacity-65",
);

const variants = {
  primary:
    "border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover focus-visible:ring-primary/50",
  secondary:
    "border-secondary bg-secondary text-white hover:border-secondary-hover hover:bg-secondary-hover focus-visible:ring-secondary/50",
  success:
    "border-success bg-success text-white hover:border-success-hover hover:bg-success-hover focus-visible:ring-success/50",
  danger:
    "border-danger bg-danger text-white hover:border-danger-hover hover:bg-danger-hover focus-visible:ring-danger/50",
  "outline-primary":
    "border-primary text-primary hover:bg-primary hover:text-white focus-visible:ring-primary/50",
  "outline-secondary":
    "border-secondary text-secondary-text hover:bg-secondary hover:text-white focus-visible:ring-secondary/50",
  "outline-success":
    "border-success text-success hover:bg-success hover:text-white focus-visible:ring-success/50",
  "outline-danger":
    "border-danger text-danger-text hover:bg-danger hover:text-white focus-visible:ring-danger/50",
  light:
    "border-light bg-light text-black hover:border-light-hover hover:bg-light-hover focus-visible:ring-light/50",
  link: cn("text-link underline hover:text-link-hover focus-visible:ring-brand/50"),
} as const;

const sizes = {
  default: "",
  sm: "rounded-sm px-2 py-1 text-sm leading-normal",
} as const;

type ButtonVariant = keyof typeof variants;
type ButtonSize = keyof typeof sizes;

/** Class names for a button look, for elements that are not a `Button` (a link, a dialog close). */
function buttonVariants({
  variant = "primary",
  size = "default",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

/** Shared button. Base UI supplies the native-button semantics and disabled handling. */
function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: Omit<ComponentProps<typeof ButtonPrimitive>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <ButtonPrimitive
      data-variant={variant}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

/** Joins `Button`s into one segmented control. */
function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      className={cn("relative inline-flex button-group align-middle", className)}
      {...props}
    />
  );
}

export { Button, ButtonGroup, buttonVariants };
export type { ButtonSize, ButtonVariant };
