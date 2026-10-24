import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  default: "tw:px-3 tw:py-1.5 tw:text-base tw:leading-normal tw:rounded-md",
  sm: "tw:px-2 tw:py-1 tw:text-sm tw:leading-normal tw:rounded-sm",
} as const;

type InputSize = keyof typeof sizes;

const fieldClasses = cn(
  "tw:block tw:w-full tw:border tw:border-border tw:bg-background tw:leading-normal tw:font-normal tw:text-foreground tw:placeholder:text-muted-foreground tw:focus:border-brand tw:focus:ring-4 tw:focus:ring-brand/25 tw:focus:outline-none tw:disabled:bg-secondary-subtle",
);

/** Single-line text-like input. Pass `type`, `value` and handlers as for a native input. */
function Input({
  size = "default",
  className,
  ...props
}: Omit<ComponentProps<"input">, "size"> & { size?: InputSize }) {
  return <input className={cn(fieldClasses, sizes[size], className)} {...props} />;
}

function Textarea({
  size = "default",
  className,
  ...props
}: Omit<ComponentProps<"textarea">, "size"> & { size?: InputSize }) {
  return <textarea className={cn(fieldClasses, sizes[size], className)} {...props} />;
}

export { Input, Textarea, fieldClasses, sizes as inputSizes };
export type { InputSize };
