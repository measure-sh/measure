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

    expect(await screen.findByText("No sessions found")).toBeInTheDocument();
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
  });

  it("renders tooltip with expected labels", async () => {
    render(
      <SessionReplayOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "1.0.0",
              data: [{ id: "1.0.0.p", x: "2026-02-23T01:00:00", y: 2 }],
            },
            {
              id: "2.0.0",
              data: [{ id: "2.0.0.p", x: "2026-02-23T01:00:00", y: 1 }],
            },
          ],
          status: "success",
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("line-mock")).toBeInTheDocument(),
    );

    const datum = lastLineProps.data[0].data[0];
    const { container, getByText } = render(
      lastLineProps.tooltip({
        point: {
          seriesId: lastLineProps.data[0].id,
          seriesColor: "#111",
          data: { ...datum, xFormatted: "2026-02-23T01:00:00" },
        },
      }),
    );
    expect(getByText("1.0.0 - 2 session replays")).toBeInTheDocument();
    expect(getByText("2.0.0 - 1 session replay")).toBeInTheDocument();
    expect(container.textContent).toContain("Date:");
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
