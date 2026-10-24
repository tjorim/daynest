import type { UnifiedDayItem } from "@/lib/api/today";
import * as m from "@/paraglide/messages";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BADGE_VARIANT: Partial<Record<string, BadgeVariant>> = {
  planned: "secondary",
  chore: "warning",
  medication: "info",
};

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
  if (!item) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <Badge variant={BADGE_VARIANT[item.item_type] ?? "primary"} className="tw:mb-2">
              {item.item_type}
            </Badge>
            <DialogTitle className="tw:text-h5 tw:font-medium tw:mb-0">{item.title}</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody className="tw:grid tw:gap-2">
          <div>
            <strong>{m.calendar_status_label()}:</strong>{" "}
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </div>
          {item.detail ? <div>{item.detail}</div> : null}
          {item.scheduled_date ? (
            <div className="tw:text-muted-foreground tw:text-small">{item.scheduled_date}</div>
          ) : null}
        </DialogBody>
        <DialogFooter className="tw:justify-start">
          {item.item_type === "routine" ? (
            <>
              {item.status === "pending" ? (
                <Button disabled={isRunning} onClick={() => onStartRoutine(item.item_id)}>
                  {m.action_start()}
                </Button>
              ) : null}
              <Button
                variant="success"
                disabled={isRunning}
                onClick={() => onCompleteRoutine(item.item_id)}
              >
                {m.action_done()}
              </Button>
              <Button
                variant="outline-secondary"
                disabled={isRunning}
                onClick={() => onSkipRoutine(item.item_id)}
              >
                {m.action_skip()}
              </Button>
            </>
          ) : null}
          {item.item_type === "chore" ? (
            <>
              <Button
                variant="success"
                disabled={isRunning}
                onClick={() => onCompleteChore(item.item_id)}
              >
                {m.action_done()}
              </Button>
              <Button
                variant="outline-secondary"
                disabled={isRunning}
                onClick={() => onSkipChore(item.item_id)}
              >
                {m.action_skip()}
              </Button>
              {item.scheduled_date ? (
                <Button
                  variant="outline-primary"
                  disabled={isRunning}
                  onClick={() => onRescheduleChore(item.item_id, item.scheduled_date!)}
                >
                  {m.action_reschedule_1_day()}
                </Button>
              ) : null}
            </>
          ) : null}
          {item.item_type === "planned" ? (
            <Button disabled={isRunning} onClick={() => onEditPlanned(item.item_id)}>
              {m.action_edit()}
            </Button>
          ) : null}
          <DialogClose render={<Button variant="outline-secondary" className="tw:ms-auto" />}>
            {m.action_cancel()}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
