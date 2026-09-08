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
const mockUseNetworkStatusCodesQuery = jest.fn((..._args: unknown[]) =>
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
  useNetworkStatusCodesQuery: (...args: unknown[]) =>
    mockUseNetworkStatusCodesQuery(...args),
  useNetworkTimelineQuery: (...args: unknown[]) =>
    mockUseNetworkTimelineQuery(...args),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-entity">{props.entity}</span>
      <span data-testid="filter-bar-expr">
        {props.value?.filterExpr ?? "none"}
      </span>
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
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
  SkeletonPlot: () => <div data-testid="skeleton-plot-mock" />,
}));

jest.mock("@/app/components/network_endpoint_search", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="endpoint-search-mock"
      data-app={props.filterParams?.appId ?? "none"}
    />
  ),
}));

jest.mock("@/app/components/network_status_distribution_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="status-distribution-plot-mock"
      data-time-group={props.plotTimeGroup}
      data-points={props.data.length}
    />
  ),
}));

jest.mock("@/app/components/network_timeline_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="network-timeline-plot-mock"
      data-points={props.data.points.length}
    />
  ),
}));

jest.mock("@/app/components/network_trends", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="network-trends-mock"
      data-app={props.filterParams?.appId ?? "none"}
    />
  ),
}));

import NetworkOverview, {
  NetworkOverviewDemo,
} from "@/app/components/network_overview";
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

const settled = { a: "app-1", d: "Last 6 Hours" };

function statusCodesLoaded() {
  mockUseNetworkStatusCodesQuery.mockReturnValue({
    data: [
      {
        datetime: "2026-04-01",
        total_count: 100,
        count_2xx: 90,
        count_3xx: 2,
        count_4xx: 5,
        count_5xx: 3,
      },
    ],
    status: "success",
    error: null,
  });
}

function timelineLoaded() {
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
    error: null,
  });
}

describe("NetworkOverviewDemo", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockUseAppsQuery.mockReset();
    mockUseNetworkStatusCodesQuery.mockReset();
    mockUseNetworkTimelineQuery.mockReset();
  });

  it("draws the demo sections without a filter bar or any query", () => {
    render(<NetworkOverviewDemo />);

    expect(screen.getByText("Network Performance")).toBeInTheDocument();
    expect(
      screen.getByTestId("status-distribution-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("network-trends-mock")).toBeInTheDocument();
    expect(
      screen.getByTestId("network-timeline-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("filter-bar-mock")).toBeNull();
    expect(screen.queryByTestId("endpoint-search-mock")).toBeNull();
    expect(mockUseAppsQuery).not.toHaveBeenCalled();
    expect(mockUseNetworkStatusCodesQuery).not.toHaveBeenCalled();
  });

  it("hides the title when asked", () => {
    render(<NetworkOverviewDemo hideTitle />);
    expect(screen.queryByText("Network Performance")).not.toBeInTheDocument();
  });
});

describe("NetworkOverview page", () => {
  function renderPage() {
    return render(<NetworkOverview params={{ teamId: "123" }} />);
  }

  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [httpMethodKey], key_groups: ["Request"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseNetworkStatusCodesQuery.mockReset();
    mockUseNetworkStatusCodesQuery.mockReturnValue(pendingQueryState());
    mockUseNetworkTimelineQuery.mockReset();
    mockUseNetworkTimelineQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar for the network entity", () => {
    renderPage();

    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent(
      "network",
    );
    expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
      "app-1",
      "network",
      [],
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    renderPage();

    expect(mockUseNetworkStatusCodesQuery).toHaveBeenLastCalledWith(
      null,
      "",
      "",
    );
    expect(mockUseNetworkTimelineQuery).toHaveBeenLastCalledWith(null, "", "");
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(screen.queryByText("Status Distribution")).toBeNull();
  });

  it("asks for every endpoint, filtered by what it settled on", () => {
    mockRouter.setUrl("?filter_expr=http_method%3Ain%3Aget");
    statusCodesLoaded();
    timelineLoaded();
    renderPage();

    const params = expect.objectContaining({
      appId: "app-1",
      filterExpr: "http_method:in:get",
    });
    expect(mockUseNetworkStatusCodesQuery).toHaveBeenLastCalledWith(
      params,
      "",
      "",
    );
    expect(mockUseNetworkTimelineQuery).toHaveBeenLastCalledWith(
      params,
      "",
      "",
    );
    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      filter_expr: "http_method:in:get",
    });
  });

  it("hands the endpoint search and the ranking the filter it settled on", () => {
    statusCodesLoaded();
    timelineLoaded();
    renderPage();

    expect(screen.getByTestId("endpoint-search-mock")).toHaveAttribute(
      "data-app",
      "app-1",
    );
    expect(screen.getByTestId("network-trends-mock")).toHaveAttribute(
      "data-app",
      "app-1",
    );
  });

  it("draws the plots the server sent, bucketed for the settled range", () => {
    statusCodesLoaded();
    timelineLoaded();
    renderPage();

    const statusPlot = screen.getByTestId("status-distribution-plot-mock");
    expect(statusPlot).toHaveAttribute("data-points", "1");
    expect(statusPlot).toHaveAttribute("data-time-group", "minutes");
    expect(screen.getByTestId("network-timeline-plot-mock")).toHaveAttribute(
      "data-points",
      "1",
    );
  });

  it("refetches for the filter the bar applies", async () => {
    statusCodesLoaded();
    timelineLoaded();
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId("filter-bar-apply"));
    });

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      filter_expr: "http_method:in:get",
    });
    expect(mockUseNetworkStatusCodesQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ filterExpr: "http_method:in:get" }),
      "",
      "",
    );
  });

  it("says so when the status codes request fails", () => {
    mockUseNetworkStatusCodesQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new Error("fail"),
    });
    timelineLoaded();
    renderPage();

    expect(
      screen.getByText(
        "Error fetching status distribution, please change filters & try again",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-issues")).toHaveTextContent("none");
  });

  it("says so when the timeline request fails", () => {
    statusCodesLoaded();
    mockUseNetworkTimelineQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(
        "Error fetching requests timeline, please change filters & try again",
      ),
    ).toBeInTheDocument();
  });

  it("hands a refused filter's issues to the bar", () => {
    mockRouter.setUrl("?filter_expr=http_method%3Ain%3Aget");
    mockUseNetworkStatusCodesQuery.mockReturnValue({
      data: null,
      status: "error",
      error: new ApiError(400, invalidFilterExpr, [
        { message: 'Unknown key "os_name"', span: { start: 0, end: 7 } },
      ]),
    });
    timelineLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-issues")).toHaveTextContent(
      'Unknown key "os_name"',
    );
  });

  it("says there is no data when both requests come back empty", () => {
    mockUseNetworkStatusCodesQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
    });
    mockUseNetworkTimelineQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
    });
    renderPage();

    expect(
      screen.getAllByText("No data available for the selected filters"),
    ).toHaveLength(2);
  });

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
    });

    it("is said by the page, in place of the plots", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Status Distribution")).toBeNull();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseNetworkStatusCodesQuery).toHaveBeenLastCalledWith(
        null,
        "",
        "",
      );
    });
  });
});
