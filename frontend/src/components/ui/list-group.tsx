import { useRender } from "@base-ui/react/use-render";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

const ListGroupContext = createContext({ flush: false });

/** Vertical list of rows. `flush` drops the outer border and rounding for use inside a card. */
function ListGroup({
  flush = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & { flush?: boolean }) {
  const element = useRender({
    render: render ?? <div />,
    props: {
      className: cn("mb-0 flex list-none flex-col ps-0", flush ? "" : "rounded-md", className),
      ...props,
    },
  });
  return <ListGroupContext value={{ flush }}>{element}</ListGroupContext>;
}

const rowBase = cn(
  "relative block row-buttons border border-border bg-background px-4 py-2 text-foreground",
);
const rowGrouped = "not-first:border-t-0 first:rounded-t-md last:rounded-b-md";
const rowFlush =
  "border-x-0 rounded-none last:rounded-b-inner not-first:border-t-0 last:border-b-0 first:border-t-0";
const rowAction =
  "w-full cursor-pointer text-start hover:bg-tertiary focus-visible:bg-tertiary focus-visible:outline-none";
const rowActive = "border-brand bg-brand text-white hover:bg-brand focus-visible:bg-brand";

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
