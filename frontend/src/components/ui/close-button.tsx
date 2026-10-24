import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The corner "x" of a dialog or banner, drawn like Bootstrap's close button. */
const closeButtonClass =
  "tw:box-content tw:size-4 tw:rounded-md tw:border-0 tw:p-1 tw:close-icon tw:opacity-50 tw:hover:opacity-75 tw:focus:opacity-100 tw:focus:ring-4 tw:focus:ring-primary/25 tw:focus:outline-none tw:disabled:pointer-events-none tw:disabled:opacity-25";

/** Plain close button. Dialogs pass `closeButtonClass` to their Base UI close part instead. */
function CloseButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn(closeButtonClass, className)} {...props} />;
}

export { CloseButton, closeButtonClass };
