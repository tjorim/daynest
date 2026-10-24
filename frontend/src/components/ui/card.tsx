import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Bordered surface. Compose it with `CardHeader`, `CardContent` and `CardFooter`. */
function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-md border border-card-border bg-background bg-clip-border wrap-break-word",
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
        "mb-0 rounded-t-inner border-b border-card-border bg-card-header px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex-auto p-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-b-inner border-t border-card-border bg-card-header px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardContent, CardFooter, CardHeader };
