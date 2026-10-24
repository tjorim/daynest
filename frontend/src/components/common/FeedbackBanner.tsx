import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export type FeedbackTone = "info" | "success" | "warning" | "danger" | "secondary";

type FeedbackBannerProps = {
  message: string | null;
  tone?: FeedbackTone;
  dismissLabel?: string;
  onDismiss?: () => void;
};

export function FeedbackBanner({
  message,
  tone = "info",
  dismissLabel = "Dismiss",
  onDismiss,
}: FeedbackBannerProps) {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissal when the message changes so the same message can re-trigger.
  if (message !== lastMessage) {
    setLastMessage(message);
    setIsDismissed(false);
  }

  if (!message || isDismissed) {
    return null;
  }

  const dismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <Alert
      variant={tone}
      className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:py-2"
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      {onDismiss ? (
        <Button
          variant={tone === "danger" ? "danger" : "outline-secondary"}
          size="sm"
          onClick={dismiss}
        >
          {dismissLabel}
        </Button>
      ) : null}
    </Alert>
  );
}
