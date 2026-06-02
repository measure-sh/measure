import ErrorsOverviewPlot from "@/app/components/errors_overview_plot";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let lastLineProps: any = null;

jest.mock("@nivo/line", () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props;
    return <div data-testid="line-mock" />;
  },
}));

jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div>,
}));

const mockUseErrorsOverviewPlotQuery = jest.fn(
  (): { data: any; status: string; error: Error | null } => ({
    data: undefined,
    status: "pending",
    error: null,
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorsOverviewPlotQuery: () => mockUseErrorsOverviewPlotQuery(),
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: {
      ready: false,
      serialisedFilters: "",
      startDate: "",
      endDate: "",
    },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

const { useFiltersStore } = require("@/app/stores/provider") as any;

const filters = {
  ready: true,
  serialisedFilters: "test",
  startDate: "2026-02-01T00:00:00Z",
  endDate: "2026-02-01T06:00:00Z",
};

describe("ErrorsOverviewPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
    useFiltersStore.setState({
      filters: {
        ready: false,
        serialisedFilters: "",
        startDate: "",
        endDate: "",
      },
    });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
  });

  it("renders loading state when query is pending", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorsOverviewPlot />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state when query errors", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new Error("boom"),
    });
    render(<ErrorsOverviewPlot />);
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders No Data state when query returns null", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
    });
    render(<ErrorsOverviewPlot />);
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("renders chart with provided data on success", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: [
        { id: "3.1.0", data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 5 }] },
      ],
      status: "success",
      error: null,
    });
    render(<ErrorsOverviewPlot />);
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    expect(lastLineProps.data[0].id).toBe("3.1.0");
    expect(lastLineProps.data[0].data[0].y).toBe(5);
    expect(lastLineProps.axisLeft.legend).toBe("Error instances");
  });

  it("uses minute axis precision for short ranges", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: [{ id: "v", data: [{ id: "p", x: "2026-02-01T01:00:00", y: 1 }] }],
      status: "success",
      error: null,
    });
    render(<ErrorsOverviewPlot />);
    expect(lastLineProps.xScale.precision).toBe("minute");
  });

  it("uses hour axis precision for week-long ranges", () => {
    const hourFilters = {
      ...filters,
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-06T00:00:00Z",
    };
    useFiltersStore.setState({ filters: hourFilters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: [{ id: "v", data: [{ id: "p", x: "2026-02-01T01:00:00", y: 1 }] }],
      status: "success",
      error: null,
    });
    render(<ErrorsOverviewPlot />);
    expect(lastLineProps.xScale.precision).toBe("hour");
  });

  it("uses day axis precision for multi-month ranges", () => {
    const dayFilters = {
      ...filters,
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-03-15T00:00:00Z",
    };
    useFiltersStore.setState({ filters: dayFilters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: [{ id: "v", data: [{ id: "p", x: "2026-02-01", y: 1 }] }],
      status: "success",
      error: null,
    });
    render(<ErrorsOverviewPlot />);
    expect(lastLineProps.xScale.precision).toBe("day");
  });

  it("renders tooltip with instances/instance pluralization", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsOverviewPlotQuery.mockReturnValue({
      data: [
        { id: "3.1.0", data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 5 }] },
      ],
      status: "success",
      error: null,
    });
    render(<ErrorsOverviewPlot />);

    const many = lastLineProps.sliceTooltip({
      slice: {
        points: [
          {
            id: "p1",
            seriesColor: "#111",
            seriesId: "3.1.0",
            data: { xFormatted: "2026-02-01T01:00:00", y: 5, yFormatted: 5 },
          },
        ],
      },
    });
    const one = lastLineProps.sliceTooltip({
      slice: {
        points: [
          {
            id: "p2",
            seriesColor: "#111",
            seriesId: "3.1.0",
            data: { xFormatted: "2026-02-01T01:00:00", y: 1, yFormatted: 1 },
          },
        ],
      },
    });

    const manyRendered = render(many);
    const oneRendered = render(one);
    expect(manyRendered.container.textContent).toContain("instances");
    expect(oneRendered.container.textContent).toContain("instance");
  });
});
