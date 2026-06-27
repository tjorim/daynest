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
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  if (!message || dismissedMessage === message) {
    return null;
  }

  const dismiss = () => {
    setDismissedMessage(message);
    onDismiss?.();
  };

  return (
    <div
      className={`alert alert-${tone} py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className={`btn btn-${tone === "danger" ? "danger" : "outline-secondary"} btn-sm`}
          onClick={dismiss}
        >
          {dismissLabel}
        </button>
      ) : null}
    </div>
  );
}
