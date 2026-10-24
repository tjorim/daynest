import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import "./dialog.css";

/**
 * Shared modal dialog. Base UI owns the focus trap, focus return, inert background, scroll lock
 * and Escape/outside-press dismissal; this file only adds Bootstrap-compatible theme styling.
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
      <DialogPrimitive.Backdrop className="tw:fixed tw:inset-0 tw:z-1050 tw:bg-black/50" />
      <DialogPrimitive.Popup
        className={cn(
          "dialog-popup tw:fixed tw:z-1050 tw:flex tw:flex-col tw:overflow-y-auto tw:border tw:border-dialog-border tw:bg-popover tw:text-popover-foreground tw:shadow-dialog",
          position === "center"
            ? "tw:inset-4 tw:m-auto tw:h-fit tw:max-h-dialog tw:max-w-lg tw:rounded-lg"
            : "tw:inset-x-0 tw:top-search-offset tw:mx-auto tw:w-search tw:max-h-search tw:rounded-lg",
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
        "tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-dialog-border tw:p-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("tw:p-6", className)} {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2 tw:border-t tw:border-dialog-border tw:p-6",
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
  return <DialogPrimitive.Close className="btn-close" aria-label={label} {...props} />;
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
