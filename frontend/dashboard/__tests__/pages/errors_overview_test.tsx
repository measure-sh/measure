import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const pushMock = mockRouter.pushMock;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/stores/provider", () =>
  require("@/__tests__/helpers/mock_filters_store").filtersProviderMock(),
);

const mockToastNegative = jest.fn();
jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: (text: string) => mockToastNegative(text),
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyErrorsOverviewResponse: {
    meta: { next: false, previous: false },
    results: [],
  },
}));

const pendingQueryState = () => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
});

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseErrorsOverviewQuery = jest.fn((_filter: any, _offset: number) =>
  pendingQueryState(),
);
const mockUseErrorsOverviewPlotQuery = jest.fn((_filter: any) =>
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
  useErrorsOverviewQuery: (filter: any, offset: number) =>
    mockUseErrorsOverviewQuery(filter, offset),
  useErrorsOverviewPlotQuery: (filter: any) =>
    mockUseErrorsOverviewPlotQuery(filter),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-entity">{props.entity}</span>
      <span data-testid="filter-bar-app">
        {props.value?.app.name ?? "none"}
      </span>
      <span data-testid="filter-bar-expr">
        {props.value?.filterExpr ?? "none"}
      </span>
      <button
        data-testid="filter-bar-apply"
        onClick={() => props.onChange({ filterExpr: "error_type:in:Crash" })}
      >
        apply
      </button>
      <button
        data-testid="filter-bar-clear"
        onClick={() => props.onChange({ filterExpr: null })}
      >
        clear
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

jest.mock("@/app/components/errors_overview_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="errors-overview-plot-mock">
      {props.query.status === "pending" ? (
        <div data-testid="skeleton-plot-mock" />
      ) : (
        "ErrorsOverviewPlot Rendered"
      )}
    </div>
  ),
}));

jest.mock("@/app/components/paginator", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="paginator-mock">
      <button
        data-testid="prev-button"
        onClick={props.onPrev}
        disabled={!props.prevEnabled}
      >
        Prev
      </button>
      <button
        data-testid="next-button"
        onClick={props.onNext}
        disabled={!props.nextEnabled}
      >
        Next
      </button>
      <span>{props.displayText}</span>
    </div>
  ),
}));

jest.mock("@/app/components/loading_bar", () => () => (
  <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
));

import ErrorsOverviewPage from "@/app/[teamId]/errors/page";

const mockApp = { id: "app-1", name: "Sample" };

const errorTypeKey = {
  name: "error_type",
  label: "Error Type",
  key_group: "Error",
  description: "The kind and severity of the error",
  value_type: "enum",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
  enum_values: ["Crash", "ANR", "Handled Error", "Unhandled Error"],
};

const sampleErrorGroup = {
  id: "group-1",
  type: "java.lang.NullPointerException",
  message: "something went wrong",
  method_name: "onClick",
  file_name: "CheckoutActivity.kt",
  count: 1523,
  percentage_contribution: 45.2,
};

const sampleErrorsOverview = {
  results: [sampleErrorGroup],
  meta: { previous: false, next: true },
};

function errorsLoaded(data: any = sampleErrorsOverview) {
  mockUseErrorsOverviewQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(
    <ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />,
  );
}

describe("ErrorsOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [errorTypeKey], key_groups: ["Error"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseErrorsOverviewQuery.mockReset();
    mockUseErrorsOverviewQuery.mockReturnValue(pendingQueryState());
    mockUseErrorsOverviewPlotQuery.mockReset();
    mockUseErrorsOverviewPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar for the errors entity", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent("errors");
  });

  it("hands the bar the app and filter it settled on", () => {
    mockRouter.setUrl(
      `?po=0&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
    );
    errorsLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "error_type:in:Crash",
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockRouter.setUrl("?po=20");
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    errorsLoaded();
    renderPage();

    expect(mockUseErrorsOverviewQuery).toHaveBeenLastCalledWith(null, 20);
    expect(mockUseErrorsOverviewPlotQuery).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
  });

  it("fetches the page the URL names, filtered by what it settled on", () => {
    mockRouter.setUrl(
      `?po=20&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
    );
    errorsLoaded();
    renderPage();

    expect(mockUseErrorsOverviewQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "error_type:in:Crash",
      }),
      20,
    );
    expect(mockUseErrorsOverviewPlotQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "error_type:in:Crash",
      }),
    );
  });

  it("records what it settled on, keeping the page the link asked for", () => {
    mockRouter.setUrl(
      `?po=20&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
    );
    errorsLoaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      po: "20",
      filter_expr: "error_type:in:Crash",
    });
  });

  it("keeps the plot area up with paging disabled while errors load", () => {
    renderPage();
    expect(screen.getByTestId("errors-overview-plot-mock")).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeDisabled();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
  });

  it("renders the plot, paginator and table headers once ready", async () => {
    errorsLoaded();
    renderPage();

    expect(
      await screen.findByTestId("errors-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Instances")).toBeInTheDocument();
    expect(screen.getByText("Percentage contribution")).toBeInTheDocument();
  });

  it("renders error group data rows from the query result", () => {
    errorsLoaded();
    renderPage();

    expect(
      screen.getByText("CheckoutActivity.kt: onClick()"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("java.lang.NullPointerException:something went wrong"),
    ).toBeInTheDocument();
    expect(screen.getByText("1523")).toBeInTheDocument();
    expect(screen.getByText("45.2%")).toBeInTheDocument();
  });

  it("renders table headers without rows for an empty result set", () => {
    errorsLoaded({ results: [], meta: { previous: false, next: false } });
    renderPage();

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(
      screen.queryByText("CheckoutActivity.kt: onClick()"),
    ).not.toBeInTheDocument();
  });

  it("shows an error message when the errors request fails", () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of errors/),
    ).toBeInTheDocument();
  });

  it("row link points to the detail route with teamId/appId/errorGroupId/encoded name", () => {
    errorsLoaded();
    renderPage();

    const link = screen.getByRole("link", {
      name: /CheckoutActivity\.kt: onClick\(\)/i,
    });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href");
    expect(href).toContain("/123/errors/app-1/group-1/");
    expect(href).toContain(
      encodeURIComponent("java.lang.NullPointerException@CheckoutActivity.kt"),
    );
  });

  it("carries the date range into the row link, not the filter", () => {
    mockRouter.setUrl(
      `?po=0&d=Last+6+Hours&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
    );
    errorsLoaded();
    renderPage();

    const link = screen.getByRole("link", {
      name: /CheckoutActivity\.kt: onClick\(\)/i,
    });
    const href = link.getAttribute("href")!;
    expect(href).toContain(`d=${encodeURIComponent("Last 6 Hours")}`);
    expect(href).not.toContain("filter_expr");
  });

  it("Enter key on a data row navigates to the detail page", async () => {
    errorsLoaded();
    renderPage();

    const link = screen.getByRole("link", {
      name: /CheckoutActivity\.kt: onClick\(\)/i,
    });
    const row = link.closest("tr")!;
    await act(async () => {
      fireEvent.keyDown(row, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalled();
    const target = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(target).toContain("/123/errors/app-1/group-1/");
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.setUrl("?po=0&a=app-1&d=Last+6+Hours");
      errorsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "5" });
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.setUrl("?po=5&a=app-1");
      errorsLoaded({
        ...sampleErrorsOverview,
        meta: { previous: true, next: true },
      });
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    });

    it("goes back to the first page when the filter changes", async () => {
      mockRouter.setUrl("?po=30&a=app-1");
      errorsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "error_type:in:Crash",
      });
    });

    it("goes back to the first page when the filter is cleared", async () => {
      mockRouter.setUrl(
        `?po=30&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
      );
      errorsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    });

    it("cannot be used while a refetch is in flight", () => {
      mockUseErrorsOverviewQuery.mockReturnValue({
        data: sampleErrorsOverview,
        status: "success",
        isFetching: true,
        error: null,
      });
      renderPage();

      expect(screen.getByTestId("next-button")).toBeDisabled();
      expect(screen.getByTestId("prev-button")).toBeDisabled();
    });
  });

  it("shows the loading bar only while a refetch is in flight", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: sampleErrorsOverview,
      status: "success",
      isFetching: true,
      error: null,
    });
    const { rerender } = renderPage();

    const loadingBarContainer =
      screen.getByTestId("loading-bar-mock").parentElement;
    expect(loadingBarContainer).toHaveClass("visible");
    expect(loadingBarContainer).not.toHaveClass("invisible");

    await act(async () => {
      errorsLoaded();
      rerender(
        <ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />,
      );
    });

    await screen.findByText("CheckoutActivity.kt: onClick()");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?po=10&a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      errorsLoaded();
    });

    it("is said by the page, in place of the list", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Instances")).toBeNull();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseErrorsOverviewQuery).toHaveBeenLastCalledWith(null, 10);
    });
  });
});
