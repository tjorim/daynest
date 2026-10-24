import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  default: "px-3 py-1.5 text-base leading-normal rounded-md",
  sm: "px-2 py-1 text-sm leading-normal rounded-sm",
} as const;

type InputSize = keyof typeof sizes;

const fieldClasses = cn(
  "block w-full border border-border bg-background leading-normal font-normal text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none disabled:bg-secondary-subtle aria-invalid:border-danger aria-invalid:focus:ring-danger/25",
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

/** A field with attached `InputGroupText` add-ons before or after it. */
function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("input-group", className)} {...props} />;
}

/** Static label attached to an input, such as "every" or "days". */
function InputGroupText({
  size = "default",
  className,
  ...props
}: ComponentProps<"span"> & { size?: InputSize }) {
  return (
    <span
      className={cn(
        "flex items-center border border-border bg-tertiary text-center leading-normal font-normal whitespace-nowrap text-foreground",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export { Input, InputGroup, InputGroupText, Textarea, fieldClasses, sizes as inputSizes };
export type { InputSize };
