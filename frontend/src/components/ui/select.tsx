import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

const sizes = {
  default: "tw:py-1.5 tw:pe-9 tw:ps-3 tw:text-base tw:leading-normal tw:rounded-md",
  sm: "tw:py-1 tw:pe-8 tw:ps-2 tw:text-sm tw:leading-normal tw:rounded-sm",
} as const;

/** Native select with the shared field look. Pass `<option>` children as usual. */
function Select({
  size = "default",
  className,
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: keyof typeof sizes }) {
  return (
    <select
      className={cn(fieldClasses, "tw:appearance-none tw:select-chevron", sizes[size], className)}
      {...props}
    />
  );
}

export { Select };
