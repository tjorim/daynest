import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode, type RefObject } from "react";
import * as m from "@/paraglide/messages";
import "./dialog.css";

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
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <Dialog.Title className="h5 mb-0">{title}</Dialog.Title>
            <Dialog.Close className="btn-close" aria-label={m.ui_close()} disabled={busy} />
          </div>
          {children}
          <Dialog.Close className="btn btn-outline-secondary mt-3" disabled={busy}>
            {m.action_cancel()}
          </Dialog.Close>
          <Dialog.Root open={confirmDiscard} onOpenChange={setConfirmDiscard}>
            <Dialog.Portal>
              <Dialog.Backdrop className="editor-dialog-backdrop" />
              <Dialog.Popup className="editor-dialog-popup">
                <Dialog.Title className="h5">{m.editor_discard_title()}</Dialog.Title>
                <Dialog.Description>{m.editor_discard_description()}</Dialog.Description>
                <div className="d-flex flex-wrap gap-2">
                  <Dialog.Close className="btn btn-primary">
                    {m.editor_continue_editing()}
                  </Dialog.Close>
                  <button type="button" className="btn btn-outline-danger" onClick={onClose}>
                    {m.editor_discard_changes()}
                  </button>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
