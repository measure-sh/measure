import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let lastLineProps: any = null;
let lastTabSelectProps: any = null;

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

jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div>,
}));

jest.mock("@/app/components/tab_select", () => ({
  __esModule: true,
  default: ({ items, selected, onChangeSelected }: any) => {
    lastTabSelectProps = { items, selected, onChangeSelected };
    return (
      <div>
        {items.map((item: string) => (
          <button
            key={item}
            data-testid={`quantile-${item}`}
            aria-pressed={selected === item}
            onClick={() => onChangeSelected(item)}
          >
            {item}
          </button>
        ))}
      </div>
    );
  },
}));

import SpanMetricsPlot from "@/app/components/span_metrics_plot";

const plotDates = {
  startDate: "2026-02-01T00:00:00Z",
  endDate: "2026-02-01T08:00:00Z",
};

function queryWith(overrides: any) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as any;
}

// One series with every quantile, as the server sends it. The component
// picks a quantile out of it.
const rawPlotData = [
  {
    id: "v1",
    data: [
      { datetime: "2026-02-01T01:00:00", p50: 30, p90: 35, p95: 38, p99: 40 },
    ],
  },
];

describe("SpanMetricsPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
    lastTabSelectProps = null;
  });

  it("renders no data state when the server sends a null plot", async () => {
    render(
      <SpanMetricsPlot
        {...plotDates}
        query={queryWith({ data: null, status: "success" })}
      />,
    );

    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    render(
      <SpanMetricsPlot
        {...plotDates}
        query={queryWith({ status: "error", error: new Error("test") })}
      />,
    );
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders loading state before the request resolves", async () => {
    render(<SpanMetricsPlot {...plotDates} query={queryWith({})} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("maps quantile and updates when tab changes", async () => {
    render(
      <SpanMetricsPlot
        {...plotDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.data[0].data[0].y).toBe(30);
    // Component initializes with p50 (from useState default)
    expect(lastLineProps.axisLeft.legend).toBe("Duration (p50)");
    expect(lastTabSelectProps.items).toEqual(["p50", "p90", "p95", "p99"]);
    expect(lastTabSelectProps.selected).toBe("p50");

    fireEvent.click(screen.getByTestId("quantile-p99"));
    await waitFor(() => expect(lastLineProps.data[0].data[0].y).toBe(40));
    expect(lastLineProps.axisLeft.legend).toBe("Duration (p99)");
  });

  it("renders tooltip with human readable millis", async () => {
    render(
      <SpanMetricsPlot
        {...plotDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    const tooltip = lastLineProps.tooltip({
      point: {
        data: {
          xFormatted: "2026-02-01T01:00:00",
          siblings: [{ id: "v1", y: 30, color: "#111" }],
        },
      },
    });
    const { container } = render(tooltip);
    expect(container.textContent).toContain("Date:");
    expect(container.textContent).toContain("(p50)");
  });

  it("uses hour axis configuration for multi-day ranges", async () => {
    const hoursDates = {
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-06T00:00:00Z",
    };

    render(
      <SpanMetricsPlot
        {...hoursDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.xScale.precision).toBe("hour");
  });

  it("uses day axis configuration for medium ranges", async () => {
    const daysDates = {
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-03-15T00:00:00Z",
    };

    render(
      <SpanMetricsPlot
        {...daysDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.xScale.precision).toBe("day");
  });

  it("uses month axis configuration for large ranges", async () => {
    const monthsDates = {
      startDate: "2025-01-01T00:00:00Z",
      endDate: "2026-01-01T00:00:00Z",
    };

    render(
      <SpanMetricsPlot
        {...monthsDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.axisBottom.format).toBe("%d %b, %Y");
  });

  it("throws for invalid quantile selection", async () => {
    render(
      <SpanMetricsPlot
        {...plotDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    let thrown: any = null;
    try {
      lastTabSelectProps.onChangeSelected("p75");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBe("Invalid quantile selected");
  });

  it("hides stale chart while new range data is loading", async () => {
    const { rerender } = render(
      <SpanMetricsPlot
        {...plotDates}
        query={queryWith({ data: rawPlotData, status: "success" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    rerender(<SpanMetricsPlot {...plotDates} query={queryWith({})} />);

    await waitFor(() => {
      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByTestId("line-mock")).not.toBeInTheDocument();
    });
  });
});
