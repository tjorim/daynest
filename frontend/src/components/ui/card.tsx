import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Bordered surface. Compose it with `CardHeader`, `CardContent` and `CardFooter`. */
function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "tw:relative tw:flex tw:min-w-0 tw:flex-col tw:rounded-md tw:border tw:border-card-border tw:bg-background tw:bg-clip-border tw:wrap-break-word",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "tw:mb-0 tw:rounded-t-inner tw:border-b tw:border-card-border tw:bg-card-header tw:px-4 tw:py-2",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("tw:flex-auto tw:p-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "tw:rounded-b-inner tw:border-t tw:border-card-border tw:bg-card-header tw:px-4 tw:py-2",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardContent, CardFooter, CardHeader };
