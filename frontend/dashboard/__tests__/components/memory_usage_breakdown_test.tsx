import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import MemoryUsageBreakdown from "@/app/components/memory_usage_breakdown";

describe("MemoryUsageBreakdown", () => {
  it("shows tier percentiles and session counts, including unknown memory", () => {
    render(
      <MemoryUsageBreakdown
        query={
          {
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
          } as any
        }
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
    const row = screen.getByText("5–6 GB").closest("tr")!;
    expect(within(row).getByText("100 MB")).toBeInTheDocument();
    expect(within(row).getByText("200 MB")).toBeInTheDocument();
    expect(within(row).getByText("2.00 GB")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Samples" }),
    ).not.toBeInTheDocument();
    const unknown = screen.getByText("Unknown").closest("tr")!;
    expect(within(unknown).getAllByText("—")).toHaveLength(3);
  });

  it.each([null, []])("shows an empty state for %p", (data) => {
    render(<MemoryUsageBreakdown query={{ status: "success", data } as any} />);
    expect(screen.getByText("No memory samples found.")).toBeInTheDocument();
  });

  it("shows a fetch error", () => {
    render(<MemoryUsageBreakdown query={{ status: "error" } as any} />);
    expect(
      screen.getByText("Unable to load memory breakdown."),
    ).toBeInTheDocument();
  });
});
