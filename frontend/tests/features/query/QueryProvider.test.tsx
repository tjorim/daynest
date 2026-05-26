// @vitest-environment jsdom
import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryProvider } from "@/app/providers/QueryProvider";

function Probe() {
  const queryClient = useQueryClient();
  return <div>{queryClient ? "query-ready" : "query-missing"}</div>;
}

describe("QueryProvider", () => {
  it("provides a shared query client", () => {
    render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );

    expect(screen.getByText("query-ready")).toBeInTheDocument();
  });
});
