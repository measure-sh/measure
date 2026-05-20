import ErrorsDetailsPlot from "@/app/components/errors_details_plot";
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

const mockUseErrorsDetailsPlotQuery = jest.fn(
  (): { data: any; status: string; error: Error | null } => ({
    data: undefined,
    status: "pending",
    error: null,
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorsDetailsPlotQuery: () => mockUseErrorsDetailsPlotQuery(),
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

describe("ErrorsDetailsPlot", () => {
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
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
  });

  it("renders loading state when query is pending", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state when query errors", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new Error("boom"),
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" />);
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders No Data state when query returns null", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" />);
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("renders chart with provided data on success", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: [
        { id: "3.1.0", data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 8 }] },
      ],
      status: "success",
      error: null,
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" />);
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    expect(lastLineProps.data[0].id).toBe("3.1.0");
    expect(lastLineProps.data[0].data[0].y).toBe(8);
    expect(lastLineProps.axisLeft.legend).toBe("Error instances");
  });

  it("uses demo data and bypasses query in demo mode", () => {
    useFiltersStore.setState({ filters });
    // Even if the query reports pending, demo mode shows the chart.
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" demo />);
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    // Demo dataset has two series with version-build labels
    const seriesIds = lastLineProps.data.map((d: any) => d.id);
    expect(seriesIds).toContain("1.0.0 (100)");
    expect(seriesIds).toContain("2.0.0 (200)");
  });

  it("selects axis precision from filter range", () => {
    const dayFilters = {
      ...filters,
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-03-15T00:00:00Z",
    };
    useFiltersStore.setState({ filters: dayFilters });
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: [{ id: "v", data: [{ id: "p", x: "2026-02-01", y: 1 }] }],
      status: "success",
      error: null,
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" />);
    expect(lastLineProps.xScale.precision).toBe("day");
  });

  it("renders tooltip with instances/instance pluralization", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDetailsPlotQuery.mockReturnValue({
      data: [
        { id: "3.1.0", data: [{ id: "p1", x: "2026-02-01T01:00:00", y: 5 }] },
      ],
      status: "success",
      error: null,
    });
    render(<ErrorsDetailsPlot errorGroupId="g1" />);

    const many = lastLineProps.sliceTooltip({
      slice: {
        points: [
          {
            id: "p1",
            serieColor: "#111",
            serieId: "3.1.0",
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
            serieColor: "#111",
            serieId: "3.1.0",
            data: { xFormatted: "2026-02-01T01:00:00", y: 1, yFormatted: 1 },
          },
        ],
      },
    });

    expect(render(many).container.textContent).toContain("instances");
    expect(render(one).container.textContent).toContain("instance");
  });
});
