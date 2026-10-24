import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The corner "x" of a dialog or banner, drawn with the shared theme close button. */
const closeButtonClass =
  "box-content size-4 rounded-md border-0 p-1 close-icon opacity-50 hover:opacity-75 focus:opacity-100 focus:ring-4 focus:ring-primary/25 focus:outline-none disabled:pointer-events-none disabled:opacity-25";

/** Plain close button. Dialogs pass `closeButtonClass` to their Base UI close part instead. */
function CloseButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn(closeButtonClass, className)} {...props} />;
}

export { CloseButton, closeButtonClass };
