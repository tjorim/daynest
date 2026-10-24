import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode, type RefObject } from "react";
import * as m from "@/paraglide/messages";
import "./dialog.css";
import { Button } from "@/components/ui/button";
import { closeButtonClass } from "@/components/ui/close-button";

/** Shared record editor shell. Base UI owns focus, scroll locking and dismissal. */
export function EditorDialog({
  title,
  dirty,
  busy,
  returnFocus,
  onClose,
  children,
}: {
  title: string;
  dirty: boolean;
  busy: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="editor-dialog-backdrop" />
        <Dialog.Popup className="editor-dialog-popup" finalFocus={returnFocus}>
          <div className="tw:flex tw:justify-between tw:items-center tw:gap-4 tw:mb-4">
            <Dialog.Title className="tw:text-h5 tw:font-medium tw:mb-0">{title}</Dialog.Title>
            <Dialog.Close className={closeButtonClass} aria-label={m.ui_close()} disabled={busy} />
          </div>
          {children}
          <Dialog.Close
            render={<Button variant="outline-secondary" className="tw:mt-4" />}
            disabled={busy}
          >
            {m.action_cancel()}
          </Dialog.Close>
          <Dialog.Root open={confirmDiscard} onOpenChange={setConfirmDiscard}>
            <Dialog.Portal>
              <Dialog.Backdrop className="editor-dialog-backdrop" />
              <Dialog.Popup className="editor-dialog-popup">
                <Dialog.Title className="tw:text-h5 tw:font-medium tw:mb-2">
                  {m.editor_discard_title()}
                </Dialog.Title>
                <Dialog.Description>{m.editor_discard_description()}</Dialog.Description>
                <div className="tw:flex tw:flex-wrap tw:gap-2">
                  <Dialog.Close render={<Button />}>{m.editor_continue_editing()}</Dialog.Close>
                  <Button variant="outline-danger" onClick={onClose}>
                    {m.editor_discard_changes()}
                  </Button>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
