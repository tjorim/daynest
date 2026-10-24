import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base = cn(
  "tw:inline-block tw:cursor-pointer tw:rounded-md tw:border tw:border-transparent tw:bg-transparent tw:px-3 tw:py-1.5 tw:text-center tw:align-middle tw:text-base tw:leading-normal tw:font-normal tw:no-underline tw:transition-colors tw:select-none tw:focus-visible:ring-4 tw:focus-visible:outline-none tw:disabled:pointer-events-none tw:disabled:opacity-65 tw:aria-disabled:pointer-events-none tw:aria-disabled:opacity-65",
);

const variants = {
  primary:
    "tw:border-primary tw:bg-primary tw:text-white tw:hover:border-primary-hover tw:hover:bg-primary-hover tw:focus-visible:ring-primary/50",
  secondary:
    "tw:border-secondary tw:bg-secondary tw:text-white tw:hover:border-secondary-hover tw:hover:bg-secondary-hover tw:focus-visible:ring-secondary/50",
  success:
    "tw:border-success tw:bg-success tw:text-white tw:hover:border-success-hover tw:hover:bg-success-hover tw:focus-visible:ring-success/50",
  danger:
    "tw:border-danger tw:bg-danger tw:text-white tw:hover:border-danger-hover tw:hover:bg-danger-hover tw:focus-visible:ring-danger/50",
  "outline-primary":
    "tw:border-primary tw:text-primary tw:hover:bg-primary tw:hover:text-white tw:focus-visible:ring-primary/50",
  "outline-secondary":
    "tw:border-secondary tw:text-secondary-text tw:hover:bg-secondary tw:hover:text-white tw:focus-visible:ring-secondary/50",
  "outline-success":
    "tw:border-success tw:text-success tw:hover:bg-success tw:hover:text-white tw:focus-visible:ring-success/50",
  "outline-danger":
    "tw:border-danger tw:text-danger-text tw:hover:bg-danger tw:hover:text-white tw:focus-visible:ring-danger/50",
  light:
    "tw:border-light tw:bg-light tw:text-black tw:hover:border-light-hover tw:hover:bg-light-hover tw:focus-visible:ring-light/50",
  link: cn("tw:text-link tw:underline tw:hover:text-link-hover tw:focus-visible:ring-brand/50"),
} as const;

const sizes = {
  default: "",
  sm: "tw:rounded-sm tw:px-2 tw:py-1 tw:text-sm tw:leading-normal",
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

/** Bootstrap-equivalent button. Base UI supplies the native-button semantics and disabled handling. */
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

export { Button, buttonVariants };
export type { ButtonSize, ButtonVariant };
