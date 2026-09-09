import SessionReplayOverviewPlot from "@/app/components/session_replay_overview_plot";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

let lastLineProps: any = null;

jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    lastLineProps = props;
    return <div data-testid="line-mock" />;
  },
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock" />,
}));

const plotDates = {
  startDate: "2026-02-23T00:00:00Z",
  endDate: "2026-02-23T06:00:00Z",
};

function queryWith(overrides: any) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as any;
}

describe("SessionReplayOverviewPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("renders no data state", async () => {
    render(
      <SessionReplayOverviewPlot
        {...plotDates}
        query={queryWith({ data: null, status: "success" })}
      />,
    );

    expect(await screen.findByText("No Data")).toBeInTheDocument();
    expect(screen.getByTestId("sessions-plot-no-data")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    render(
      <SessionReplayOverviewPlot
        {...plotDates}
        query={queryWith({ status: "error", error: new Error("test") })}
      />,
    );

    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders loading spinner before data is available", async () => {
    render(<SessionReplayOverviewPlot {...plotDates} query={queryWith({})} />);
    expect(screen.getByTestId("skeleton-mock")).toBeInTheDocument();
  });

  it("maps data and uses minute x-axis for short ranges", async () => {
    render(
      <SessionReplayOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "1.0.0",
              data: [{ id: "1.0.0.0", x: "2026-02-23T01:00:00", y: 2 }],
            },
          ],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("sessions-plot-data")).toBeInTheDocument();
    expect(lastLineProps.xScale.precision).toBe("minute");
    expect(lastLineProps.axisBottom.format).toBe("%b %d, %H:%M");
    expect(lastLineProps.axisLeft.legend).toBe("Session Replay");
    expect(lastLineProps.data[0].data[0].y).toBe(2);
  });

  it("uses hour precision for medium range", async () => {
    render(
      <SessionReplayOverviewPlot
        startDate="2026-02-01T00:00:00Z"
        endDate="2026-02-06T00:00:00Z"
        query={queryWith({
          data: [
            {
              id: "1.0.0",
              data: [{ id: "1.0.0.0", x: "2026-02-10T01:00:00", y: 2 }],
            },
          ],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.xScale.precision).toBe("hour");
  });

  it("uses day precision for multi-month range", async () => {
    render(
      <SessionReplayOverviewPlot
        startDate="2026-01-01T00:00:00Z"
        endDate="2026-03-15T00:00:00Z"
        query={queryWith({
          data: [
            { id: "1.0.0", data: [{ id: "1.0.0.0", x: "2026-03-01", y: 2 }] },
          ],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.xScale.precision).toBe("day");
    expect(lastLineProps.axisBottom.format).toBe("%b %d, %Y");
  });

  it("uses month formatting for long range", async () => {
    render(
      <SessionReplayOverviewPlot
        startDate="2025-01-01T00:00:00Z"
        endDate="2026-01-01T00:00:00Z"
        query={queryWith({
          data: [
            { id: "1.0.0", data: [{ id: "1.0.0.0", x: "2026-01-01", y: 2 }] },
          ],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );
    expect(lastLineProps.axisBottom.format).toBe("%d %b, %Y");
  });

  it("renders tooltip with expected labels", async () => {
    render(
      <SessionReplayOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "1.0.0",
              data: [{ id: "1.0.0.0", x: "2026-02-23T01:00:00", y: 2 }],
            },
          ],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    const tooltip = lastLineProps.tooltip({
      point: {
        data: {
          xFormatted: "2026-02-23T01:00:00",
          siblings: [{ id: "1.0.0", y: 2, color: "#111" }],
        },
      },
    });
    const { container } = render(tooltip);
    expect(container.textContent).toContain("Date:");
    expect(container.textContent).toContain("session replays");
  });

  it("hides stale chart while new range data is loading", async () => {
    const { rerender } = render(
      <SessionReplayOverviewPlot
        startDate="2026-01-01T00:00:00Z"
        endDate="2026-03-15T00:00:00Z"
        query={queryWith({
          data: [
            { id: "1.0.0", data: [{ id: "1.0.0.0", x: "2026-03-01", y: 2 }] },
          ],
          status: "success",
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    rerender(
      <SessionReplayOverviewPlot {...plotDates} query={queryWith({})} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("skeleton-mock")).toBeInTheDocument();
      expect(screen.queryByTestId("line-mock")).not.toBeInTheDocument();
    });
  });
});
