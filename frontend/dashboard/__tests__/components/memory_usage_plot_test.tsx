import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

let lastLineProps: any = null;

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));
jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    lastLineProps = props;
    return <div data-testid="line-mock" />;
  },
}));
jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock" />,
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/app/components/tab_select", () => ({
  __esModule: true,
  default: ({ items, onChangeSelected }: any) => (
    <div>
      {items.map((item: string) => (
        <button key={item} onClick={() => onChangeSelected(item)}>
          {item}
        </button>
      ))}
    </div>
  ),
}));

import MemoryUsagePlot from "@/app/components/memory_usage_plot";

const plotDates = {
  startDate: "2026-02-01T00:00:00Z",
  endDate: "2026-02-01T08:00:00Z",
};
const mockPlotPoint = {
  version: "1.2.3 (10)",
  datetime: "2026-02-01T01:00:00",
  p50: 100 * 1024,
  p90: 200 * 1024,
  p95: 300 * 1024,
  p99: 400 * 1024,
  sample_count: 10,
};

type Query = ComponentProps<typeof MemoryUsagePlot>["query"];

function queryWith(overrides: Partial<Query> = {}) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as Query;
}

const rawPlotData = [
  mockPlotPoint,
  { ...mockPlotPoint, version: "1.2.3 (11)", p90: 500 * 1024 },
  { ...mockPlotPoint, datetime: "2026-02-01T02:00:00" },
];

describe("MemoryUsagePlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("groups samples by app version and build", () => {
    render(
      <MemoryUsagePlot
        {...plotDates}
        query={queryWith({ status: "success", data: rawPlotData })}
      />,
    );
    expect(
      lastLineProps.data.map((series: { id: string }) => series.id),
    ).toEqual(["1.2.3 (10)", "1.2.3 (11)"]);
    expect(lastLineProps.data[0].data).toHaveLength(2);
  });

  it("defaults to p90 and updates when the quantile tab changes", () => {
    render(
      <MemoryUsagePlot
        {...plotDates}
        query={queryWith({ status: "success", data: rawPlotData })}
      />,
    );
    expect(lastLineProps.data[0].data[0].y).toBe(200 * 1024);
    fireEvent.click(screen.getByRole("button", { name: "p50" }));
    expect(lastLineProps.data[0].data[0].y).toBe(100 * 1024);
  });

  it("renders tooltip values for every build at the hovered time", () => {
    render(
      <MemoryUsagePlot
        {...plotDates}
        query={queryWith({ status: "success", data: rawPlotData })}
      />,
    );
    render(
      lastLineProps.tooltip({
        point: {
          data: {
            ...lastLineProps.data[0].data[0],
            xFormatted: mockPlotPoint.datetime,
          },
        },
      }),
    );
    expect(screen.getByText("1.2.3 (10) - 200.0 MB")).toBeInTheDocument();
    expect(screen.getByText("1.2.3 (11) - 500.0 MB")).toBeInTheDocument();
  });

  it.each([null, []])("renders no data state for %p", (data) => {
    render(
      <MemoryUsagePlot
        {...plotDates}
        query={queryWith({ status: "success", data })}
      />,
    );
    expect(screen.getByText("No memory usage found")).toBeInTheDocument();
  });

  it("renders loading state before the request resolves", () => {
    render(<MemoryUsagePlot {...plotDates} query={queryWith()} />);
    expect(screen.getByTestId("skeleton-mock")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(
      <MemoryUsagePlot
        {...plotDates}
        query={queryWith({ status: "error", error: new Error("test") })}
      />,
    );
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });
});
