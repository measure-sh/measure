import ErrorsOverviewPlot from "@/app/components/errors_overview_plot";
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

describe("ErrorsOverviewPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("renders loading state when query is pending", () => {
    render(<ErrorsOverviewPlot {...plotDates} query={queryWith({})} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state when query errors", () => {
    render(
      <ErrorsOverviewPlot
        {...plotDates}
        query={queryWith({ status: "error", error: new Error("boom") })}
      />,
    );
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders No Data state when query returns null", () => {
    render(
      <ErrorsOverviewPlot
        {...plotDates}
        query={queryWith({ data: null, status: "success" })}
      />,
    );
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("renders chart with provided data on success", () => {
    render(
      <ErrorsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "3.1.0",
              data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 5 }],
            },
          ],
          status: "success",
        })}
      />,
    );
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    expect(lastLineProps.data[0].id).toBe("3.1.0");
    expect(lastLineProps.data[0].data[0].y).toBe(5);
    expect(lastLineProps.axisLeft.legend).toBe("Error instances");
  });

  it("uses minute axis precision for short ranges", () => {
    render(
      <ErrorsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [
            { id: "v", data: [{ id: "p", x: "2026-02-01T01:00:00", y: 1 }] },
          ],
          status: "success",
        })}
      />,
    );
    expect(lastLineProps.xScale.precision).toBe("minute");
  });

  it("uses hour axis precision for week-long ranges", () => {
    render(
      <ErrorsOverviewPlot
        startDate="2026-02-01T00:00:00Z"
        endDate="2026-02-06T00:00:00Z"
        query={queryWith({
          data: [
            { id: "v", data: [{ id: "p", x: "2026-02-01T01:00:00", y: 1 }] },
          ],
          status: "success",
        })}
      />,
    );
    expect(lastLineProps.xScale.precision).toBe("hour");
  });

  it("uses day axis precision for multi-month ranges", () => {
    render(
      <ErrorsOverviewPlot
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
      <ErrorsOverviewPlot
        {...plotDates}
        query={queryWith({
          data: [
            {
              id: "3.1.0",
              data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 5 }],
            },
          ],
          status: "success",
        })}
      />,
    );

    const many = lastLineProps.tooltip({
      point: {
        data: {
          xFormatted: "2026-02-01T01:00:00",
          siblings: [{ id: "3.1.0", y: 5, color: "#111" }],
        },
      },
    });
    const one = lastLineProps.tooltip({
      point: {
        data: {
          xFormatted: "2026-02-01T01:00:00",
          siblings: [{ id: "3.1.0", y: 1, color: "#111" }],
        },
      },
    });

    const manyRendered = render(many);
    const oneRendered = render(one);
    expect(manyRendered.container.textContent).toContain("instances");
    expect(oneRendered.container.textContent).toContain("instance");
  });
});
