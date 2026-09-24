import MemoryUsageBreakdown from "@/app/components/memory_usage_breakdown";
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";

type Query = ComponentProps<typeof MemoryUsageBreakdown>["query"];

function queryWith(overrides: Partial<Query> = {}) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as Query;
}

describe("MemoryUsageBreakdown", () => {
  it("renders tier percentiles and session counts, including unknown memory", () => {
    render(
      <MemoryUsageBreakdown
        query={queryWith({
          status: "success",
          data: [
            {
              device_total_memory_tier: "5-6gb",
              p50: 100 * 1024,
              p90: 200 * 1024,
              p95: 2 * 1024 * 1024,
              session_count: 2,
              sample_count: 1200,
            },
            {
              device_total_memory_tier: "unknown",
              p50: null,
              p90: null,
              p95: null,
              session_count: 1,
              sample_count: 1,
            },
          ],
        })}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "p50" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "p90" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "p95" }),
    ).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /5-6gb/ });
    expect(within(row).getByText("100.0 MB")).toBeInTheDocument();
    expect(within(row).getByText("200.0 MB")).toBeInTheDocument();
    expect(within(row).getByText("2.0 GB")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Samples" }),
    ).not.toBeInTheDocument();
    const unknown = screen.getByRole("row", { name: /unknown/ });
    expect(within(unknown).getAllByText("—")).toHaveLength(3);
  });

  it.each([null, []])("renders no data state for %p", (data) => {
    render(
      <MemoryUsageBreakdown query={queryWith({ status: "success", data })} />,
    );
    expect(screen.getByText("No memory samples found.")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(
      <MemoryUsageBreakdown
        query={queryWith({ status: "error", error: new Error("test") })}
      />,
    );
    expect(
      screen.getByText("Unable to load memory breakdown."),
    ).toBeInTheDocument();
  });
});
