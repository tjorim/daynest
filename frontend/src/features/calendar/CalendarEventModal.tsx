import { useEffect, useRef } from "react";
import type { UnifiedDayItem } from "@/lib/api/today";
import * as m from "@/paraglide/messages";
import { useFocusTrap } from "@/lib/useFocusTrap";

export function CalendarEventModal({
  item,
  isRunning,
  onClose,
  onStartRoutine,
  onCompleteRoutine,
  onSkipRoutine,
  onCompleteChore,
  onSkipChore,
  onRescheduleChore,
  onEditPlanned,
}: {
  item: UnifiedDayItem | null;
  isRunning: boolean;
  onClose: () => void;
  onStartRoutine: (itemId: number) => void;
  onCompleteRoutine: (itemId: number) => void;
  onSkipRoutine: (itemId: number) => void;
  onCompleteChore: (itemId: number) => void;
  onSkipChore: (itemId: number) => void;
  onRescheduleChore: (itemId: number, scheduledDate: string) => void;
  onEditPlanned: (itemId: number) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useFocusTrap(modalRef, Boolean(item));

  useEffect(() => {
    if (!item) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [item]);

  if (!item) return null;

  return (
    <div
      className="calendar-event-modal modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-modal-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div ref={modalRef} className="modal-content shadow">
          <div className="modal-header">
            <div>
              <span
                className={`badge text-bg-${item.item_type === "planned" ? "secondary" : item.item_type === "chore" ? "warning" : item.item_type === "medication" ? "info" : "primary"} mb-2`}
              >
                {item.item_type}
              </span>
              <h2 id="calendar-event-modal-title" className="h5 mb-0">
                {item.title}
              </h2>
            </div>
            <button ref={closeButtonRef} type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body d-grid gap-2">
            <div>
              <strong>{m.calendar_status_label()}:</strong>{" "}
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </div>
            {item.detail ? <div>{item.detail}</div> : null}
            {item.scheduled_date ? (
              <div className="text-muted small">{item.scheduled_date}</div>
            ) : null}
          </div>
          <div className="modal-footer justify-content-start">
            {item.item_type === "routine" ? (
              <>
                {item.status === "pending" ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isRunning}
                    onClick={() => onStartRoutine(item.item_id)}
                  >
                    {m.action_start()}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={isRunning}
                  onClick={() => onCompleteRoutine(item.item_id)}
                >
                  {m.action_done()}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={isRunning}
                  onClick={() => onSkipRoutine(item.item_id)}
                >
                  {m.action_skip()}
                </button>
              </>
            ) : null}
            {item.item_type === "chore" ? (
              <>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={isRunning}
                  onClick={() => onCompleteChore(item.item_id)}
                >
                  {m.action_done()}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={isRunning}
                  onClick={() => onSkipChore(item.item_id)}
                >
                  {m.action_skip()}
                </button>
                {item.scheduled_date ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={isRunning}
                    onClick={() => onRescheduleChore(item.item_id, item.scheduled_date!)}
                  >
                    {m.action_reschedule_1_day()}
                  </button>
                ) : null}
              </>
            ) : null}
            {item.item_type === "planned" ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isRunning}
                onClick={() => onEditPlanned(item.item_id)}
              >
                {m.action_edit()}
              </button>
            ) : null}
            <button type="button" className="btn btn-outline-secondary ms-auto" onClick={onClose}>
              {m.action_cancel()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
