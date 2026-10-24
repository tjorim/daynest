import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

const sizes = {
  default: "py-1.5 pe-9 ps-3 text-base leading-normal rounded-md",
  sm: "py-1 pe-8 ps-2 text-sm leading-normal rounded-sm",
} as const;

/** Native select with the shared field look. Pass `<option>` children as usual. */
function Select({
  size = "default",
  className,
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: keyof typeof sizes }) {
  return (
    <select
      className={cn(fieldClasses, "appearance-none select-chevron", sizes[size], className)}
      {...props}
    />
  );
}

export { Select };
