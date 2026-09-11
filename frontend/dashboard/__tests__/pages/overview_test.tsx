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
  data: undefined as any,
  status: "pending" as string,
  error: null as Error | null,
});

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseMetricsQuery = jest.fn((..._args: unknown[]) =>
  pendingQueryState(),
);
const mockUseAppHealthPlotQuery = jest.fn((..._args: unknown[]) =>
  pendingQueryState(),
);
const mockUseAppThresholdPrefsQuery = jest.fn((_appId: string | undefined) =>
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
  useMetricsQuery: (...args: unknown[]) => mockUseMetricsQuery(...args),
  useAppHealthPlotQuery: (...args: unknown[]) =>
    mockUseAppHealthPlotQuery(...args),
  useAppThresholdPrefsQuery: (appId: string | undefined) =>
    mockUseAppThresholdPrefsQuery(appId),
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
        onClick={() => props.onChange({ filterExpr: "version_name:in:1.0" })}
      >
        apply
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

jest.mock("@/app/components/app_health_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="app-health-plot-mock"
      data-status={props.status}
      data-points={props.plot?.[0]?.data.length ?? "none"}
      data-start={props.startDate}
      data-end={props.endDate}
    />
  ),
  demoPlot: [{ id: "Sessions", data: [{ id: "s.1", x: "2026-01-01", y: 1 }] }],
}));

jest.mock("@/app/components/metrics_overview", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="metrics-overview-mock"
      data-status={props.status}
      data-adoption={props.metrics?.adoption?.adoption}
      data-good-threshold={props.appThresholdPrefs?.error_good_threshold}
    />
  ),
  demoMetrics: { adoption: { adoption: 41 } },
}));

import { ApiError, invalidFilterExpr } from "@/app/api/api_error";
import Overview, { OverviewDemo } from "@/app/components/overview";

const mockApp = { id: "app-1", name: "Sample" };

const versionNameKey = {
  name: "version_name",
  label: "Version name",
  key_group: "",
  description: "The app version",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

const settled = { a: "app-1", d: "Last 6 Hours" };

function metricsLoaded() {
  mockUseMetricsQuery.mockReturnValue({
    data: { adoption: { adoption: 41, no_data: false } },
    status: "success",
    error: null,
  });
}

function healthPlotLoaded() {
  mockUseAppHealthPlotQuery.mockReturnValue({
    data: [{ id: "Sessions", data: [{ id: "s.1", x: "2026-04-01", y: 10 }] }],
    status: "success",
    error: null,
  });
}

describe("OverviewDemo", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockUseAppsQuery.mockReset();
    mockUseMetricsQuery.mockReset();
    mockUseAppHealthPlotQuery.mockReset();
  });

  it("draws the demo sections without a filter bar or any query", () => {
    render(<OverviewDemo />);

    expect(screen.getByText("App Health")).toBeInTheDocument();
    expect(screen.getByTestId("app-health-plot-mock")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-overview-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("filter-bar-mock")).toBeNull();
    expect(mockUseAppsQuery).not.toHaveBeenCalled();
    expect(mockUseMetricsQuery).not.toHaveBeenCalled();
    expect(mockUseAppHealthPlotQuery).not.toHaveBeenCalled();
  });

  it("hides the title when asked", () => {
    render(<OverviewDemo hideTitle />);
    expect(screen.queryByText("App Health")).not.toBeInTheDocument();
  });
});

describe("Overview page", () => {
  function renderPage() {
    return render(<Overview params={{ teamId: "123" }} />);
  }

  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [versionNameKey], key_groups: [] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseMetricsQuery.mockReset();
    mockUseMetricsQuery.mockReturnValue(pendingQueryState());
    mockUseAppHealthPlotQuery.mockReset();
    mockUseAppHealthPlotQuery.mockReturnValue(pendingQueryState());
    mockUseAppThresholdPrefsQuery.mockReset();
    mockUseAppThresholdPrefsQuery.mockReturnValue({
      data: { error_good_threshold: 99, error_caution_threshold: 95 },
      status: "success",
      error: null,
    });
  });

  it("renders the filter bar for the app_health entity", () => {
    renderPage();

    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent(
      "app_health",
    );
    expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
      "app-1",
      "app_health",
      [],
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    renderPage();

    expect(mockUseMetricsQuery).toHaveBeenLastCalledWith(null);
    expect(mockUseAppHealthPlotQuery).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("app-health-plot-mock")).toBeNull();
  });

  it("asks for metrics and the health plot filtered by what it settled on", () => {
    mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.0");
    metricsLoaded();
    healthPlotLoaded();
    renderPage();

    const params = expect.objectContaining({
      appId: "app-1",
      filterExpr: "version_name:in:1.0",
    });
    expect(mockUseMetricsQuery).toHaveBeenLastCalledWith(params);
    expect(mockUseAppHealthPlotQuery).toHaveBeenLastCalledWith(params);
    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      filter_expr: "version_name:in:1.0",
    });
  });

  it("draws the plot and cards the server sent", () => {
    metricsLoaded();
    healthPlotLoaded();
    renderPage();

    const plot = screen.getByTestId("app-health-plot-mock");
    expect(plot).toHaveAttribute("data-status", "success");
    expect(plot).toHaveAttribute("data-points", "1");
    const metrics = screen.getByTestId("metrics-overview-mock");
    expect(metrics).toHaveAttribute("data-status", "success");
    expect(metrics).toHaveAttribute("data-adoption", "41");
    expect(metrics).toHaveAttribute("data-good-threshold", "99");
  });

  it("falls back to the default thresholds when the prefs query has no data", () => {
    metricsLoaded();
    healthPlotLoaded();
    mockUseAppThresholdPrefsQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new Error("prefs failed"),
    });
    renderPage();

    const metrics = screen.getByTestId("metrics-overview-mock");
    expect(metrics).toHaveAttribute("data-good-threshold", "95");
  });

  it("refetches for the filter the bar applies", async () => {
    metricsLoaded();
    healthPlotLoaded();
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId("filter-bar-apply"));
    });

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      filter_expr: "version_name:in:1.0",
    });
    expect(mockUseMetricsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ filterExpr: "version_name:in:1.0" }),
    );
  });

  it("hands a refused filter's issues to the bar", () => {
    mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.0");
    mockUseMetricsQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new ApiError(400, invalidFilterExpr, [
        { message: 'Unknown key "os_name"', span: { start: 0, end: 7 } },
      ]),
    });
    healthPlotLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-issues")).toHaveTextContent(
      'Unknown key "os_name"',
    );
  });

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
    });

    it("is said by the page, in place of the plot and cards", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("app-health-plot-mock")).toBeNull();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseMetricsQuery).toHaveBeenLastCalledWith(null);
      expect(mockUseAppHealthPlotQuery).toHaveBeenLastCalledWith(null);
    });
  });
});
