import BugReportsOverviewPlot from "@/app/components/bug_reports_overview_plot";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

let lastLineProps: any = null;

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

const plotDates = {
  startDate: "2025-01-01T00:00:00Z",
  endDate: "2025-12-31T00:00:00Z",
};

function queryWith(overrides: any) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as any;
}

describe("BugReportsOverviewPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("renders error state", async () => {
    render(
      <BugReportsOverviewPlot
        {...plotDates}
        query={queryWith({ status: "error", error: new Error("test") })}
      />,
    );
    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders no data state", async () => {
    render(
      <BugReportsOverviewPlot
        {...plotDates}
        query={queryWith({ data: null, status: "success" })}
      />,
    );
    expect(await screen.findByText("No Data")).toBeInTheDocument();
    expect(screen.getByTestId("bug-reports-plot-no-data")).toBeInTheDocument();
  });

  it("renders loading state before data is available", async () => {
    render(<BugReportsOverviewPlot {...plotDates} query={queryWith({})} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("maps API result shape to nivo data", async () => {
    render(
      <BugReportsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [{ id: "v1", data: [{ id: "v1.0", x: "2025-02-01", y: 2 }] }],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("bug-reports-plot-data")).toBeInTheDocument();
    expect(lastLineProps.data[0].id).toBe("v1");
    expect(lastLineProps.data[0].data[0].y).toBe(2);
    expect(lastLineProps.axisLeft.legend).toBe("Bug Reports");
  });

  it("uses month-style axis formatting for long range", async () => {
    render(
      <BugReportsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [{ id: "v", data: [{ id: "v.0", x: "2025-02-01", y: 1 }] }],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.axisBottom.format).toBe("%d %b, %Y");
  });

  it("uses minute/day configs for shorter ranges", async () => {
    const minuteDates = {
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-01T06:00:00Z",
    };
    const { unmount } = render(
      <BugReportsOverviewPlot
        {...minuteDates}
        query={queryWith({
          data: [
            { id: "v", data: [{ id: "v.0", x: "2026-02-01T01:00:00", y: 1 }] },
          ],
          status: "success",
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.xScale.precision).toBe("minute");

    unmount();
    lastLineProps = null;

    const dayDates = {
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-03-30T00:00:00Z",
    };
    render(
      <BugReportsOverviewPlot
        {...dayDates}
        query={queryWith({
          data: [{ id: "v", data: [{ id: "v.0", x: "2026-02-01", y: 1 }] }],
          status: "success",
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.xScale.precision).toBe("day");
  });

  it("pluralizes tooltip labels for singular and plural", async () => {
    render(
      <BugReportsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [{ id: "v1", data: [{ id: "v1.0", x: "2025-02-01", y: 2 }] }],
          status: "success",
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    const one = lastLineProps.tooltip({
      point: {
        data: {
          xFormatted: "2025-02-01",
          siblings: [{ id: "v1", y: 1, color: "#111" }],
        },
      },
    });
    const many = lastLineProps.tooltip({
      point: {
        data: {
          xFormatted: "2025-02-01",
          siblings: [{ id: "v1", y: 3, color: "#111" }],
        },
      },
    });
    const r1 = render(one);
    const r2 = render(many);
    expect(r1.container.textContent).toContain("Bug Report");
    expect(r2.container.textContent).toContain("Bug Reports");
  });

  it("hides stale chart while new range data is loading", async () => {
    const { rerender } = render(
      <BugReportsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [{ id: "v1", data: [{ id: "v1.0", x: "2025-02-01", y: 2 }] }],
          status: "success",
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    rerender(
      <BugReportsOverviewPlot
        startDate="2026-02-01T00:00:00Z"
        endDate="2026-02-01T06:00:00Z"
        query={queryWith({})}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByTestId("line-mock")).not.toBeInTheDocument();
    });
  });
});
