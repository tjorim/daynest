import { useRender } from "@base-ui/react/use-render";
import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const ListGroupContext = createContext({ flush: false });

/** Vertical list of rows. `flush` drops the outer border and rounding for use inside a card. */
function ListGroup({
  flush = false,
  className,
  ...props
}: ComponentProps<"div"> & { flush?: boolean }) {
  return (
    <ListGroupContext value={{ flush }}>
      <div
        className={cn("tw:flex tw:flex-col", flush ? "" : "tw:rounded-md", className)}
        {...props}
      />
    </ListGroupContext>
  );
}

const rowBase = cn(
  "tw:relative tw:block tw:border tw:border-border tw:bg-background tw:px-4 tw:py-2 tw:text-foreground",
);
const rowGrouped = "tw:not-first:border-t-0 tw:first:rounded-t-md tw:last:rounded-b-md";
const rowFlush =
  "tw:border-x-0 tw:rounded-none tw:not-first:border-t-0 tw:last:border-b-0 tw:first:border-t-0";
const rowAction =
  "tw:w-full tw:cursor-pointer tw:text-start tw:hover:bg-tertiary tw:focus-visible:bg-tertiary tw:focus-visible:outline-none";
const rowActive =
  "tw:border-brand tw:bg-brand tw:text-white tw:hover:bg-brand tw:focus-visible:bg-brand";

/**
 * One row. Pass `action` for a clickable row and `active` to mark it selected. It renders a div;
 * use `render={<button type="button" />}` or a link for interactive rows.
 */
function ListGroupItem({
  action = false,
  active = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & { action?: boolean; active?: boolean }) {
  const { flush } = useContext(ListGroupContext);
  return useRender({
    render: render ?? <div />,
    props: {
      className: cn(
        rowBase,
        flush ? rowFlush : rowGrouped,
        action && rowAction,
        active && rowActive,
        className,
      ),
      ...props,
    },
  });
}

export { ListGroup, ListGroupItem };
