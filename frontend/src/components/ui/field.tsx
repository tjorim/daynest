import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Groups a label, a control and its help or error text. */
function Field({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4", className)} {...props} />;
}

function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-2 inline-block", className)} {...props} />;
}

function FieldDescription({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-1 text-small text-muted-foreground", className)} {...props} />;
}

/** Validation message under a control. Link it with `aria-describedby` from the control. */
function FieldError({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-1 text-small text-danger", className)} {...props} />;
}

export { Field, FieldDescription, FieldError, Label };
