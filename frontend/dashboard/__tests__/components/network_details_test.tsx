import NetworkDetails from "@/app/components/network_details";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

const replace = jest.fn();
const latencyQuery = jest.fn();
const statusCodesQuery = jest.fn();
const timelineQuery = jest.fn();
const mockFilters = jest.fn((_props: unknown) => <div data-testid="filters" />);
const mockEndpointStatusCodesPlot = jest.fn((_props: unknown) => (
  <div data-testid="status-codes-plot" />
));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/team-1/network/details",
  useSearchParams: () =>
    new URLSearchParams("domain=api.example.com&path=/v1/users"),
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  FilterSource: { Events: "events" },
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: { ready: false, loading: true, serialisedFilters: "" },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useNetworkLatencyQuery: (...args: unknown[]) => latencyQuery(...args),
  useNetworkEndpointStatusCodesQuery: (...args: unknown[]) =>
    statusCodesQuery(...args),
  useNetworkTimelineQuery: (...args: unknown[]) => timelineQuery(...args),
}));

jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: (props: unknown) => mockFilters(props),
  AppVersionsInitialSelectionType: { All: "all" },
}));

jest.mock("@/app/components/network_latency_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="latency-plot" />,
}));

jest.mock("@/app/components/network_endpoint_status_codes_plot", () => ({
  __esModule: true,
  default: (props: unknown) => mockEndpointStatusCodesPlot(props),
}));

jest.mock("@/app/components/network_timeline_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="timeline-plot" />,
}));

jest.mock("@/app/components/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonPlot: () => <div data-testid="skeleton-plot" />,
}));

jest.mock("@/app/components/info_tooltip", () => ({
  __esModule: true,
  default: () => <div data-testid="info-tooltip" />,
}));

jest.mock("@/app/utils/time_utils", () => ({
  getPlotTimeGroupForRange: () => "days",
}));

jest.mock("@/app/utils/shared_styles", () => ({
  underlineLinkStyle: "underline",
}));

const { useFiltersStore } = require("@/app/stores/provider") as any;

const noData = { data: null, status: "success", error: null };

function setReadyFilters() {
  useFiltersStore.setState({
    filters: {
      ready: true,
      loading: false,
      app: { id: "app-1" },
      serialisedFilters: "a=app-1",
      startDate: "2024-01-01",
      endDate: "2024-01-14",
    },
  });
}

describe("NetworkDetails", () => {
  beforeEach(() => {
    replace.mockReset();
    latencyQuery.mockReset();
    statusCodesQuery.mockReset();
    timelineQuery.mockReset();
    mockFilters.mockClear();
    mockEndpointStatusCodesPlot.mockClear();
    latencyQuery.mockReturnValue(noData);
    statusCodesQuery.mockReturnValue(noData);
    timelineQuery.mockReturnValue(noData);
    setReadyFilters();
  });

  it("shows one empty state when the endpoint has no data", () => {
    latencyQuery.mockReturnValue({ data: [], status: "success", error: null });
    render(<NetworkDetails params={{ teamId: "team-1" }} />);

    expect(
      screen.getAllByText("No data available for the selected filters"),
    ).toHaveLength(1);
    expect(screen.queryByText("Latency")).not.toBeInTheDocument();
    expect(screen.queryByText("Status Distribution")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
  });

  it("scopes all plots to the endpoint and synchronizes its URL", async () => {
    latencyQuery.mockReturnValue({
      data: [{}],
      status: "success",
      error: null,
    });
    statusCodesQuery.mockReturnValue({
      data: {
        status_codes: [200, 404],
        data_points: [
          {
            datetime: "2024-01-01",
            total_count: 4,
            count_200: 3,
            count_404: 1,
          },
        ],
      },
      status: "success",
      error: null,
    });
    timelineQuery.mockReturnValue({
      data: { points: [{}] },
      status: "success",
      error: null,
    });

    render(<NetworkDetails params={{ teamId: "team-1" }} />);

    expect(latencyQuery).toHaveBeenCalledWith("api.example.com", "/v1/users");
    expect(statusCodesQuery).toHaveBeenCalledWith(
      "api.example.com",
      "/v1/users",
    );
    expect(timelineQuery).toHaveBeenCalledWith("api.example.com", "/v1/users");
    expect(mockFilters.mock.calls.at(-1)?.[0]).toMatchObject({
      showAppSelector: false,
      showHttpMethods: true,
    });
    expect(
      screen.queryByTestId("network-endpoint-search"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("network-endpoint-results-label"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("latency-plot")).toBeInTheDocument();
    expect(screen.getByTestId("status-codes-plot")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-plot")).toBeInTheDocument();
    expect(screen.getByText("Status Codes")).toBeInTheDocument();
    expect(mockEndpointStatusCodesPlot.mock.calls.at(-1)?.[0]).toMatchObject({
      statusCodes: [200, 404],
      data: [
        { datetime: "2024-01-01", total_count: 4, count_200: 3, count_404: 1 },
      ],
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/team-1/network/details?a=app-1&domain=api.example.com&path=%2Fv1%2Fusers",
        { scroll: false },
      );
    });
  });
});
