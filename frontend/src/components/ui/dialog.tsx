import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { closeButtonClass } from "@/components/ui/close-button";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import "./dialog.css";

/**
 * Shared modal dialog. Base UI owns the focus trap, focus return, inert background, scroll lock
 * and Escape/outside-press dismissal; this file only adds shared theme styling.
 * Consumers render `<Dialog open onOpenChange>` and decide what a dismissal means.
 */
const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogContent({
  className,
  position = "center",
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Popup> & {
  /** `top` anchors the popup near the top of the viewport, for the search overlay. */
  position?: "center" | "top";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-1050 bg-black/50" />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          "fixed z-1050 flex flex-col overflow-y-auto border border-dialog-border bg-popover text-popover-foreground shadow-dialog",
          position === "center"
            ? "inset-4 m-auto h-fit max-h-dialog max-w-lg rounded-lg"
            : "inset-x-0 top-search-offset mx-auto w-search max-h-search rounded-lg",
          className,
        )}
        aria-modal="true"
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-dialog-border p-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-dialog-border p-6",
        className,
      )}
      {...props}
    />
  );
}

/** The corner "x" button. Pass `label` for a more specific accessible name. */
function DialogCloseButton({
  label = m.ui_close(),
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Close>, "aria-label"> & {
  label?: string;
}) {
  return <DialogPrimitive.Close className={closeButtonClass} aria-label={label} {...props} />;
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
