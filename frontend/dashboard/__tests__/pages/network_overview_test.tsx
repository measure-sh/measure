import NetworkOverview from "@/app/components/network_overview";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";

// Global router mocks
const replaceMock = jest.fn();
const pushMock = jest.fn();

// Mock next/navigation hooks
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/test-team/network",
}));

// Mock API calls
jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  FilterSource: { Events: "events" },
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: "" },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

const mockUseNetworkLatencyQuery = jest.fn(() => ({
  data: null as any,
  status: "pending" as string,
  error: null as Error | null,
}));

const mockUseNetworkStatusPlotQuery = jest.fn(() => ({
  data: null as any,
  status: "pending" as string,
  error: null as Error | null,
}));

const mockUseNetworkTimelineQuery = jest.fn(() => ({
  data: null as any,
  status: "pending" as string,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useNetworkLatencyQuery: () => mockUseNetworkLatencyQuery(),
  useNetworkStatusCodesQuery: () => mockUseNetworkStatusPlotQuery(),
  useNetworkTimelineQuery: () => mockUseNetworkTimelineQuery(),
}));

// Mock Filters component
jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters-mock" />,
  AppVersionsInitialSelectionType: { Latest: "latest", All: "all" },
}));

const { useFiltersStore } = require("@/app/stores/provider") as any;

// Mock time utils
jest.mock("@/app/utils/time_utils", () => ({
  getPlotTimeGroupForRange: jest.fn(() => "days"),
}));

// Mock child components
jest.mock("@/app/components/skeleton", () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton-mock" className={className} {...props} />
  ),
  SkeletonPlot: () => <div data-testid="skeleton-plot-mock">Loading...</div>,
  SkeletonTable: () => <div data-testid="skeleton-table-mock" />,
}));

jest.mock("@/app/components/network_status_distribution_plot", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="status-distribution-plot-mock">
      StatusDistributionPlot
    </div>
  ),
}));

jest.mock("@/app/components/network_timeline_plot", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="network-timeline-plot-mock">NetworkTimelinePlot</div>
  ),
  NetworkTimelineData: {},
  NetworkTimelineDataPoint: {},
}));

jest.mock("@/app/components/network_endpoint_search", () => ({
  __esModule: true,
  default: () => <div data-testid="endpoint-search-mock" />,
}));

jest.mock("@/app/components/network_latency_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="latency-plot-mock">LatencyPlot</div>,
}));

jest.mock("@/app/components/network_trends", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="network-trends-mock">NetworkTrends</div>
  ),
}));

jest.mock("@/app/components/badge", () => ({
  Badge: (props: any) => <span {...props}>{props.children}</span>,
}));

jest.mock("@/app/components/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));

jest.mock("@/app/components/tooltip", () => ({
  Tooltip: (props: any) => <div>{props.children}</div>,
  TooltipContent: (props: any) => <div>{props.children}</div>,
  TooltipTrigger: (props: any) => <div>{props.children}</div>,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock("@/app/utils/shared_styles", () => ({
  underlineLinkStyle: "underline-link",
}));

const readyFilters = {
  ready: true,
  serialisedFilters: "updated",
  app: { id: "app1" },
  startDate: "2024-01-01",
  endDate: "2024-01-14",
};

// Helper to set queries to a fully successful state
function setupSuccessfulQueryState() {
  mockUseNetworkLatencyQuery.mockReturnValue({
    data: [
      { datetime: "2024-01-01", p50: 1, p90: 2, p95: 3, p99: 4, count: 5 },
    ],
    status: "success",
    error: null as Error | null,
  });
  mockUseNetworkStatusPlotQuery.mockReturnValue({
    data: [
      {
        datetime: "2024-01-01",
        total_count: 100,
        count_2xx: 90,
        count_3xx: 2,
        count_4xx: 5,
        count_5xx: 3,
      },
    ],
    status: "success",
    error: null as Error | null,
  });
  mockUseNetworkTimelineQuery.mockReturnValue({
    data: {
      interval: 5,
      points: [
        {
          elapsed: 1,
          domain: "api.example.com",
          path_pattern: "/v1/users",
          count: 10,
        },
      ],
    },
    status: "success",
    error: null as Error | null,
  });
}

describe("NetworkOverview - Demo mode", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    mockUseNetworkLatencyQuery.mockReset();
    mockUseNetworkStatusPlotQuery.mockReset();
    mockUseNetworkTimelineQuery.mockReset();
    mockUseNetworkLatencyQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
    mockUseNetworkStatusPlotQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
    mockUseNetworkTimelineQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
  });

  it("renders title and sections in demo mode without fetching APIs", () => {
    render(<NetworkOverview demo={true} />);

    expect(screen.getByText("Network Performance")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("status-distribution-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.queryByTestId("filters-mock")).not.toBeInTheDocument();
  });

  it("renders NetworkTrends in demo mode", () => {
    render(<NetworkOverview demo={true} />);
    expect(screen.getByTestId("network-trends-mock")).toBeInTheDocument();
  });

  it("does not render Filters in demo mode", () => {
    render(<NetworkOverview demo={true} />);
    expect(screen.queryByTestId("filters-mock")).not.toBeInTheDocument();
  });

  it("hides title and beta badge when hideDemoTitle is true", () => {
    render(<NetworkOverview demo={true} hideDemoTitle={true} />);
    expect(screen.queryByText("Network Performance")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });
});

describe("NetworkOverview", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    mockUseNetworkLatencyQuery.mockReset();
    mockUseNetworkStatusPlotQuery.mockReset();
    mockUseNetworkTimelineQuery.mockReset();
    mockUseNetworkLatencyQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
    mockUseNetworkStatusPlotQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
    mockUseNetworkTimelineQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
    useFiltersStore.setState({
      filters: { ready: false, serialisedFilters: "" },
    });
  });

  it("renders Filters component and does not render main UI when filters are not ready", () => {
    render(<NetworkOverview params={{ teamId: "123" }} />);

    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
    expect(screen.queryByText("Status Distribution")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("network-domains-mock"),
    ).not.toBeInTheDocument();
  });

  it("shows skeletons while filters are loading", async () => {
    render(<NetworkOverview params={{ teamId: "123" }} />);

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: false,
          loading: true,
          serialisedFilters: "",
        },
      });
    });

    expect(screen.getAllByTestId("skeleton-plot-mock").length).toBeGreaterThan(
      0,
    );
  });

  it("renders main content once filters are ready and updates URL", async () => {
    setupSuccessfulQueryState();
    render(<NetworkOverview params={{ teamId: "123" }} />);

    await act(async () => {
      useFiltersStore.setState({ filters: readyFilters });
    });

    // URL should be updated
    expect(replaceMock).toHaveBeenCalledWith("/test-team/network?updated", {
      scroll: false,
    });

    // Unscoped: the search, the status plot, the ranking and the timeline.
    expect(screen.getByTestId("endpoint-search-mock")).toBeInTheDocument();
    expect(
      screen.getByTestId("status-distribution-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("network-trends-mock")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
  });

  it("shows status plot error message when status codes API fails", async () => {
    mockUseNetworkStatusPlotQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new Error("fail"),
    });
    render(<NetworkOverview params={{ teamId: "123" }} />);

    await act(async () => {
      useFiltersStore.setState({ filters: readyFilters });
    });

    expect(
      screen.getByText(
        "Error fetching status distribution, please change filters & try again",
      ),
    ).toBeInTheDocument();
  });

  it("shows no data message when status codes API returns no data", async () => {
    mockUseNetworkStatusPlotQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
    });
    render(<NetworkOverview params={{ teamId: "123" }} />);

    await act(async () => {
      useFiltersStore.setState({ filters: readyFilters });
    });

    expect(
      screen.getAllByText("No data available for the selected filters").length,
    ).toBeGreaterThan(0);
  });

  it("shows timeline error message when timeline API fails", async () => {
    mockUseNetworkTimelineQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new Error("fail"),
    });
    render(<NetworkOverview params={{ teamId: "123" }} />);

    await act(async () => {
      useFiltersStore.setState({ filters: readyFilters });
    });

    expect(
      screen.getByText(
        "Error fetching requests timeline, please change filters & try again",
      ),
    ).toBeInTheDocument();
  });

  it("updates URL when filters change", async () => {
    setupSuccessfulQueryState();
    render(<NetworkOverview params={{ teamId: "123" }} />);

    await act(async () => {
      useFiltersStore.setState({ filters: readyFilters });
    });

    expect(replaceMock).toHaveBeenCalledWith("/test-team/network?updated", {
      scroll: false,
    });

    // Change filters
    await act(async () => {
      useFiltersStore.setState({
        filters: { ...readyFilters, serialisedFilters: "updated2" },
      });
    });

    expect(replaceMock).toHaveBeenLastCalledWith(
      "/test-team/network?updated2",
      {
        scroll: false,
      },
    );
  });
});
