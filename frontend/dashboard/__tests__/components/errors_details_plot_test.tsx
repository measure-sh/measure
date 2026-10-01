import ErrorsDetailsPlot from "@/app/components/errors_details_plot";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

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
  startDate: "2026-02-01T00:00:00Z",
  endDate: "2026-02-01T06:00:00Z",
};

function queryWith(overrides: any) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as any;
}

describe("ErrorsDetailsPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("renders loading state when query is pending", () => {
    render(<ErrorsDetailsPlot {...plotDates} query={queryWith({})} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state when query errors", () => {
    render(
      <ErrorsDetailsPlot
        {...plotDates}
        query={queryWith({ status: "error", error: new Error("boom") })}
      />,
    );
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders empty state when query returns null", () => {
    render(
      <ErrorsDetailsPlot
        {...plotDates}
        query={queryWith({ data: null, status: "success" })}
      />,
    );
    expect(screen.getByText("No instances found")).toBeInTheDocument();
  });

  it("renders chart with provided data on success", () => {
    render(
      <ErrorsDetailsPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "3.1.0",
              data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 8 }],
            },
          ],
          status: "success",
        })}
      />,
    );
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    expect(lastLineProps.data[0].id).toBe("3.1.0");
    expect(lastLineProps.data[0].data[0].y).toBe(8);
    expect(lastLineProps.axisLeft.legend).toBe("Error instances");
  });

  it("uses demo data and bypasses query in demo mode", () => {
    // Even if the query reports pending, demo mode shows the chart.
    render(
      <ErrorsDetailsPlot startDate="" endDate="" query={queryWith({})} demo />,
    );
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    // Demo dataset has two series with version-build labels
    const seriesIds = lastLineProps.data.map((d: any) => d.id);
    expect(seriesIds).toContain("1.0.0 (100)");
    expect(seriesIds).toContain("2.0.0 (200)");
  });

  it("selects axis precision from the given range", () => {
    render(
      <ErrorsDetailsPlot
        startDate="2026-01-01T00:00:00Z"
        endDate="2026-03-15T00:00:00Z"
        query={queryWith({
          data: [{ id: "v", data: [{ id: "p", x: "2026-02-01", y: 1 }] }],
          status: "success",
        })}
      />,
    );
    expect(lastLineProps.xScale.precision).toBe("day");
  });

  it("renders tooltip with instances/instance pluralization", () => {
    render(
      <ErrorsDetailsPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "3.1.0",
              data: [{ id: "3.1.0.p", x: "2026-02-01T01:00:00", y: 5 }],
            },
            {
              id: "3.0.0",
              data: [{ id: "3.0.0.p", x: "2026-02-01T01:00:00", y: 1 }],
            },
          ],
          status: "success",
        })}
      />,
    );

    const datum = lastLineProps.data[0].data[0];
    const { getByText } = render(
      lastLineProps.tooltip({
        point: {
          seriesId: lastLineProps.data[0].id,
          seriesColor: "#111",
          data: { ...datum, xFormatted: "2026-02-01T01:00:00" },
        },
      }),
    );
    expect(getByText("3.1.0 - 5 instances")).toBeInTheDocument();
    expect(getByText("3.0.0 - 1 instance")).toBeInTheDocument();
  });
});
