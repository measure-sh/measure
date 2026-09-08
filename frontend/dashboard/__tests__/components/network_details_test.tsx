import { mockFiltersStore } from "@/__tests__/helpers/mock_filters_store";
import { mockRouter } from "@/__tests__/helpers/mock_router";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/stores/provider", () =>
  require("@/__tests__/helpers/mock_filters_store").filtersProviderMock(),
);

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: jest.fn(),
}));

const pendingQueryState = () => ({
  data: null as any,
  status: "pending" as string,
  error: null as Error | null,
});

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseNetworkLatencyQuery = jest.fn((..._args: unknown[]) =>
  pendingQueryState(),
);
const mockUseNetworkEndpointStatusCodesQuery = jest.fn((..._args: unknown[]) =>
  pendingQueryState(),
);
const mockUseNetworkTimelineQuery = jest.fn((..._args: unknown[]) =>
  pendingQueryState(),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  paginationOffsetUrlKey: "po",
  useAppsQuery: (teamId: string) => mockUseAppsQuery(teamId),
  useFilterKeysQuery: (
    appId: string | undefined,
    entity: string,
    keyNames: string[],
  ) => mockUseFilterKeysQuery(appId, entity, keyNames),
  useRootSpanNamesQuery: () => ({
    data: undefined,
    isSuccess: false,
    isError: false,
  }),
  useNetworkLatencyQuery: (...args: unknown[]) =>
    mockUseNetworkLatencyQuery(...args),
  useNetworkEndpointStatusCodesQuery: (...args: unknown[]) =>
    mockUseNetworkEndpointStatusCodesQuery(...args),
  useNetworkTimelineQuery: (...args: unknown[]) =>
    mockUseNetworkTimelineQuery(...args),
}));

const mockFilterBar = jest.fn();
jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => {
    mockFilterBar(props);
    return (
      <div data-testid="filter-bar-mock">
        <span data-testid="filter-bar-entity">{props.entity}</span>
        <span data-testid="filter-bar-issues">
          {props.filterExprIssues
            ? props.filterExprIssues
                .map((issue: { message: string }) => issue.message)
                .join(", ")
            : "none"}
        </span>
        <button
          data-testid="filter-bar-apply"
          onClick={() => props.onChange({ filterExpr: "http_method:in:get" })}
        >
          apply
        </button>
      </div>
    );
  },
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
  SkeletonPlot: () => <div data-testid="skeleton-plot-mock" />,
}));

jest.mock("@/app/components/network_latency_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="latency-plot" data-time-group={props.plotTimeGroup} />
  ),
}));

const mockEndpointStatusCodesPlot = jest.fn();
jest.mock("@/app/components/network_endpoint_status_codes_plot", () => ({
  __esModule: true,
  default: (props: any) => {
    mockEndpointStatusCodesPlot(props);
    return <div data-testid="status-codes-plot" />;
  },
}));

jest.mock("@/app/components/network_timeline_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="timeline-plot" />,
}));

import NetworkDetails from "@/app/components/network_details";
import { ApiError, invalidFilterExpr } from "@/app/api/api_error";

const mockApp = { id: "app-1", name: "Sample" };

const httpMethodKey = {
  name: "http_method",
  label: "HTTP method",
  key_group: "Request",
  description: "The HTTP method of the request",
  value_type: "enum",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

const endpoint = "domain=api.example.com&path=%2Fv1%2Fusers";
const selection = { domain: "api.example.com", path: "/v1/users" };
const settled = {
  a: "app-1",
  d: "Last 6 Hours",
  ...selection,
};

const noData = { data: null, status: "success", error: null };

function renderDetails() {
  return render(<NetworkDetails params={{ teamId: "team-1" }} />);
}

function plotsLoaded() {
  mockUseNetworkLatencyQuery.mockReturnValue({
    data: [{ datetime: "2026-04-01", p50: 1, p90: 2, p95: 3, p99: 4 }],
    status: "success",
    error: null,
  });
  mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
    data: {
      status_codes: [200, 404],
      data_points: [
        { datetime: "2026-04-01", total_count: 4, count_200: 3, count_404: 1 },
      ],
    },
    status: "success",
    error: null,
  });
  mockUseNetworkTimelineQuery.mockReturnValue({
    data: { interval: 5, points: [{ elapsed: 1, count: 2 }] },
    status: "success",
    error: null,
  });
}

describe("NetworkDetails", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockRouter.setUrl(`?${endpoint}`);
    mockFiltersStore.reset();
    mockFilterBar.mockClear();
    mockEndpointStatusCodesPlot.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [httpMethodKey], key_groups: ["Request"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseNetworkLatencyQuery.mockReset();
    mockUseNetworkLatencyQuery.mockReturnValue(noData);
    mockUseNetworkEndpointStatusCodesQuery.mockReset();
    mockUseNetworkEndpointStatusCodesQuery.mockReturnValue(noData);
    mockUseNetworkTimelineQuery.mockReset();
    mockUseNetworkTimelineQuery.mockReturnValue(noData);
  });

  it("renders the filter bar for the network entity, without the app control", () => {
    renderDetails();

    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent(
      "network",
    );
    expect(mockFilterBar.mock.calls.at(-1)?.[0]).toMatchObject({
      showAppSelect: false,
    });
  });

  it("scopes every plot to the endpoint the URL names", () => {
    mockRouter.setUrl(`?${endpoint}&filter_expr=http_method%3Ain%3Aget`);
    plotsLoaded();
    renderDetails();

    const params = expect.objectContaining({
      appId: "app-1",
      filterExpr: "http_method:in:get",
    });
    expect(mockUseNetworkLatencyQuery).toHaveBeenLastCalledWith(
      params,
      "api.example.com",
      "/v1/users",
    );
    expect(mockUseNetworkEndpointStatusCodesQuery).toHaveBeenLastCalledWith(
      params,
      "api.example.com",
      "/v1/users",
    );
    expect(mockUseNetworkTimelineQuery).toHaveBeenLastCalledWith(
      params,
      "api.example.com",
      "/v1/users",
    );
  });

  it("keeps the endpoint in the URL beside what it settled on", () => {
    plotsLoaded();
    renderDetails();

    expect(mockRouter.urlParams()).toEqual(settled);
  });

  it("keeps the endpoint when the filter changes", async () => {
    plotsLoaded();
    renderDetails();

    await act(async () => {
      fireEvent.click(screen.getByTestId("filter-bar-apply"));
    });

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      filter_expr: "http_method:in:get",
    });
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    renderDetails();

    expect(mockUseNetworkLatencyQuery).toHaveBeenLastCalledWith(
      null,
      "api.example.com",
      "/v1/users",
    );
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
  });

  it("draws every plot, bucketed for the settled range", () => {
    plotsLoaded();
    renderDetails();

    expect(screen.getByTestId("latency-plot")).toHaveAttribute(
      "data-time-group",
      "minutes",
    );
    expect(screen.getByTestId("status-codes-plot")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-plot")).toBeInTheDocument();
    expect(mockEndpointStatusCodesPlot.mock.calls.at(-1)?.[0]).toMatchObject({
      statusCodes: [200, 404],
      data: [
        { datetime: "2026-04-01", total_count: 4, count_200: 3, count_404: 1 },
      ],
    });
  });

  it("shows one empty state when the endpoint has no data", () => {
    mockUseNetworkLatencyQuery.mockReturnValue({
      data: [],
      status: "success",
      error: null,
    });
    renderDetails();

    expect(
      screen.getAllByText("No data available for the selected filters"),
    ).toHaveLength(1);
    expect(screen.queryByText("Latency")).not.toBeInTheDocument();
    expect(screen.queryByText("Status Codes")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
  });

  it("hands a refused filter's issues to the bar", () => {
    mockRouter.setUrl(`?${endpoint}&filter_expr=http_method%3Ain%3Aget`);
    mockUseNetworkLatencyQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new ApiError(400, invalidFilterExpr, [
        { message: 'Unknown key "os_name"', span: { start: 0, end: 7 } },
      ]),
    });
    renderDetails();

    expect(screen.getByTestId("filter-bar-issues")).toHaveTextContent(
      'Unknown key "os_name"',
    );
  });

  it("says so when a plot request fails", () => {
    mockUseNetworkLatencyQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new Error("fail"),
    });
    renderDetails();

    expect(
      screen.getByText(
        "Error fetching latency, please change filters & try again",
      ),
    ).toBeInTheDocument();
  });
});
