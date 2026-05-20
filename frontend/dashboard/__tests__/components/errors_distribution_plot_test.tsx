import ErrorsDistributionPlot from "@/app/components/errors_distribution_plot";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let lastBarProps: any = null;

jest.mock("@nivo/bar", () => ({
  ResponsiveBar: (props: any) => {
    lastBarProps = props;
    return <div data-testid="bar-mock" />;
  },
}));

jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div>,
}));

const mockUseErrorsDistributionPlotQuery = jest.fn(
  (): { data: any; status: string; error: Error | null } => ({
    data: undefined,
    status: "pending",
    error: null,
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorsDistributionPlotQuery: () => mockUseErrorsDistributionPlotQuery(),
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: "" },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

const { useFiltersStore } = require("@/app/stores/provider") as any;

const filters = { ready: true, serialisedFilters: "test" };

describe("ErrorsDistributionPlot", () => {
  beforeEach(() => {
    lastBarProps = null;
    useFiltersStore.setState({
      filters: { ready: false, serialisedFilters: "" },
    });
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
  });

  it("renders loading state when query is pending", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorsDistributionPlot errorGroupId="g1" />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state when query errors", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new Error("boom"),
    });
    render(<ErrorsDistributionPlot errorGroupId="g1" />);
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders No Data state when data is null", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
    });
    render(<ErrorsDistributionPlot errorGroupId="g1" />);
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("renders bar chart with parsed plot and keys on success", () => {
    useFiltersStore.setState({ filters });
    const parsed = {
      plot: [
        { attribute: "Country", US: 700, IN: 300 },
        { attribute: "Device Manufacturer", Google: 600, Samsung: 400 },
      ],
      plotKeys: ["US", "IN", "Google", "Samsung"],
    };
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: parsed,
      status: "success",
      error: null,
    });
    render(<ErrorsDistributionPlot errorGroupId="g1" />);

    expect(screen.getByTestId("bar-mock")).toBeInTheDocument();
    expect(lastBarProps.data).toEqual(parsed.plot);
    expect(lastBarProps.keys).toEqual(parsed.plotKeys);
    expect(lastBarProps.axisLeft.legend).toBe("Error instances");
    expect(lastBarProps.axisBottom.legend).toBe("Attributes");
  });

  it("uses demo data and bypasses query in demo mode", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorsDistributionPlot errorGroupId="g1" demo />);

    expect(screen.getByTestId("bar-mock")).toBeInTheDocument();
    // Demo data has an `App Version` row (formatted from `app_version`)
    const attributes = lastBarProps.data.map((d: any) => d.attribute);
    expect(attributes).toContain("App Version");
    // os_version with Android keys becomes "API Level"
    expect(attributes).toContain("API Level");
    // Keys include both Pixel/Galaxy device names from demo
    expect(lastBarProps.keys).toContain("Google - Pixel 7 Pro");
  });

  it("renders tooltip with instances/instance pluralization", () => {
    useFiltersStore.setState({ filters });
    mockUseErrorsDistributionPlotQuery.mockReturnValue({
      data: { plot: [{ attribute: "Country", US: 5 }], plotKeys: ["US"] },
      status: "success",
      error: null,
    });
    render(<ErrorsDistributionPlot errorGroupId="g1" />);

    const many = lastBarProps.tooltip({ id: "US", value: 5, color: "#111" });
    const one = lastBarProps.tooltip({ id: "IN", value: 1, color: "#111" });

    expect(render(many).container.textContent).toContain("instances");
    expect(render(one).container.textContent).toContain("instance");
  });
});
