import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type TableSize = "default" | "sm";

const TableContext = createContext<TableSize>("default");

/** Data table in a horizontally scrolling wrapper. Use `size="sm"` for compact cells. */
function Table({
  size = "default",
  className,
  ...props
}: ComponentProps<"table"> & { size?: TableSize }) {
  return (
    <TableContext value={size}>
      <div className="tw:overflow-x-auto">
        <table
          className={cn(
            "tw:w-full tw:border-collapse tw:border-border tw:align-top tw:text-emphasis",
            className,
          )}
          {...props}
        />
      </div>
    </TableContext>
  );
}

function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("tw:align-bottom", className)} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("tw:align-inherit", className)} {...props} />;
}

function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("tw:border-border", className)} {...props} />;
}

function TableHead({ className, ...props }: ComponentProps<"th">) {
  const size = useContext(TableContext);
  return (
    <th
      className={cn(
        "tw:border-b tw:border-border tw:text-start",
        size === "sm" ? "tw:p-1" : "tw:p-2",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: ComponentProps<"td">) {
  const size = useContext(TableContext);
  return (
    <td
      className={cn("tw:border-b tw:border-border", size === "sm" ? "tw:p-1" : "tw:p-2", className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
