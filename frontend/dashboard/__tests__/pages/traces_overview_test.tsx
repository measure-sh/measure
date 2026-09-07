import { mockFiltersStore } from "@/__tests__/helpers/mock_filters_store";
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

const pendingQueryState = () => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
});

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseRootSpanNamesQuery = jest.fn();
const mockUseSpansQuery = jest.fn(
  (_filter: any, _spanName: string | null, _offset: number) =>
    pendingQueryState(),
);
const mockUseSpanMetricsPlotQuery = jest.fn(
  (_filter: any, _spanName: string | null) => pendingQueryState(),
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
  useRootSpanNamesQuery: (app: unknown) => mockUseRootSpanNamesQuery(app),
  useSpansQuery: (filter: any, spanName: string | null, offset: number) =>
    mockUseSpansQuery(filter, spanName, offset),
  useSpanMetricsPlotQuery: (filter: any, spanName: string | null) =>
    mockUseSpanMetricsPlotQuery(filter, spanName),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-app">
        {props.value?.app.name ?? "none"}
      </span>
      <span data-testid="filter-bar-expr">
        {props.value?.filterExpr ?? "none"}
      </span>
      <span data-testid="filter-bar-name">
        {props.value?.rootSpanName ?? "none"}
      </span>
      <span data-testid="filter-bar-span-names">
        {props.spanNames === undefined
          ? "hidden"
          : props.spanNames === null
            ? "loading"
            : props.spanNames.join(",")}
      </span>
      <button
        data-testid="filter-bar-apply"
        onClick={() => props.onChange({ filterExpr: "span_status:in:error" })}
      >
        apply
      </button>
      <button
        data-testid="filter-bar-pick-name"
        onClick={() => props.onChange({ rootSpanName: "span.second" })}
      >
        pick name
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

jest.mock("@/app/components/span_metrics_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="span-metrics-plot-mock">
      {props.query.status === "pending" ? (
        <div data-testid="skeleton-plot-mock" />
      ) : (
        "TracesOverviewPlot Rendered"
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

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDate: jest.fn(() => "Jan 1, 2020"),
  formatDateToHumanReadableTime: jest.fn(() => "12:00 AM"),
  formatMillisToHumanReadable: jest.fn(() => "5s"),
}));

import TracesOverview from "@/app/[teamId]/traces/page";

const mockApp = { id: "app-1", name: "Sample" };

const spanStatusKey = {
  name: "span_status",
  label: "Status",
  key_group: "Span",
  description: "The status of the span",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

const mockSpanData = {
  results: [
    {
      app_id: "app1",
      span_name: "Test Span",
      span_id: "span1",
      trace_id: "trace1",
      status: 1,
      start_time: "2020-01-01T00:00:00Z",
      end_time: "2020-01-01T00:05:00Z",
      duration: 5000,
      app_version: "1.0",
      app_build: "1",
      os_name: "ios",
      os_version: "15",
      device_manufacturer: "Apple",
      device_model: "iPhone 12",
    },
  ],
  meta: { previous: true, next: true },
};

function spansLoaded(data: any = mockSpanData) {
  mockUseSpansQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

function namesLoaded(names: string[] | null) {
  mockUseRootSpanNamesQuery.mockReturnValue({
    data: names,
    isSuccess: true,
    isError: false,
  });
}

const settled = { a: "app-1", d: "Last 6 Hours", r: "span.first" };

function renderPage() {
  return render(<TracesOverview params={promiseParams({ teamId: "123" })} />);
}

describe("TracesOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [spanStatusKey], key_groups: ["Span"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    namesLoaded(["span.first", "span.second"]);
    mockUseSpansQuery.mockReset();
    mockUseSpansQuery.mockReturnValue(pendingQueryState());
    mockUseSpanMetricsPlotQuery.mockReset();
    mockUseSpanMetricsPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar with the span names and what it settled on", () => {
    mockRouter.setUrl("?po=0&filter_expr=span_status%3Ain%3Aerror");
    spansLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "span_status:in:error",
    );
    expect(screen.getByTestId("filter-bar-name")).toHaveTextContent(
      "span.first",
    );
    expect(screen.getByTestId("filter-bar-span-names")).toHaveTextContent(
      "span.first,span.second",
    );
  });

  it("hands the bar the trace name the URL opened on", () => {
    mockRouter.setUrl("?po=0&a=app-1&r=span.second");
    spansLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-name")).toHaveTextContent(
      "span.second",
    );
  });

  it("fetches nothing until it settles on an app, a range and a name", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    spansLoaded();
    renderPage();

    expect(mockUseSpansQuery).toHaveBeenLastCalledWith(null, null, 0);
    expect(mockUseSpanMetricsPlotQuery).toHaveBeenLastCalledWith(null, null);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(mockRouter.urlParams()).toEqual({});
  });

  it("fetches spans and the plot for the name it settled on", () => {
    spansLoaded();
    renderPage();

    expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1", filterExpr: null }),
      "span.first",
      0,
    );
    expect(mockUseSpanMetricsPlotQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1" }),
      "span.first",
    );
  });

  it("records what it settled on, keeping the page the link asked for", () => {
    mockRouter.setUrl("?po=20&filter_expr=span_status%3Ain%3Aerror");
    spansLoaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      po: "20",
      filter_expr: "span_status:in:error",
    });
    expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ filterExpr: "span_status:in:error" }),
      "span.first",
      20,
    );
  });

  it("keeps the plot area up with paging disabled while the spans load", () => {
    renderPage();
    expect(screen.getByTestId("span-metrics-plot-mock")).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeDisabled();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
  });

  it("shows the plot skeleton while what it settled on waits to reach the URL", () => {
    mockRouter.deferReplace = true;
    spansLoaded();
    renderPage();

    expect(mockUseSpansQuery).toHaveBeenLastCalledWith(null, "span.first", 0);
    expect(screen.getByTestId("span-metrics-plot-mock")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-plot-mock")).toBeInTheDocument();
  });

  it("renders the plot, paginator and table headers once ready", async () => {
    spansLoaded();
    renderPage();

    expect(
      await screen.findByTestId("span-metrics-plot-mock"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();
    expect(screen.getByText("Start Time")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("displays span data correctly", () => {
    spansLoaded();
    renderPage();

    expect(screen.getByText("Test Span")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2020")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(
      screen.getByText("1.0(1), iOS 15, Apple iPhone 12"),
    ).toBeInTheDocument();
  });

  it.each([
    [2, "Error"],
    [0, "Unset"],
  ])("renders status pill %s as %s", (status, label) => {
    spansLoaded({
      ...mockSpanData,
      results: [{ ...mockSpanData.results[0], status }],
    });
    renderPage();

    expect(screen.getByText(label as string)).toBeInTheDocument();
  });

  it.each([
    [
      "android",
      "14",
      "Google",
      "Pixel 8",
      "1.0(1), Android API Level 14, Google Pixel 8",
    ],
    ["ipados", "17", "Apple", "iPad Pro", "1.0(1), iPadOS 17, Apple iPad Pro"],
    ["harmonyos", "4", "Huawei", "P60", "1.0(1), harmonyos 4, Huawei P60"],
  ])(
    "renders the %s device string",
    (os_name, os_version, device_manufacturer, device_model, expected) => {
      spansLoaded({
        ...mockSpanData,
        results: [
          {
            ...mockSpanData.results[0],
            os_name,
            os_version,
            device_manufacturer,
            device_model,
          },
        ],
      });
      renderPage();

      expect(screen.getByText(expected as string)).toBeInTheDocument();
    },
  );

  it("renders an empty table when no spans match", () => {
    spansLoaded({ results: [], meta: { previous: false, next: false } });
    renderPage();

    expect(screen.getByText("Trace")).toBeInTheDocument();
    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument();
  });

  it("shows an error message when the spans request fails", () => {
    mockUseSpansQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of traces/),
    ).toBeInTheDocument();
  });

  it("renders appropriate link for each span", async () => {
    spansLoaded();
    renderPage();

    const link = screen.getByRole("link", { name: /ID: trace1/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/traces/app1/trace1");

    const row = link.closest("tr");
    await act(async () => {
      fireEvent.keyDown(row!, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/traces/app1/trace1");

    await act(async () => {
      fireEvent.keyDown(row!, { key: " " });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/traces/app1/trace1");
  });

  describe("a filter it could not settle", () => {
    it("says there is no data for an app that never reported a trace, and still writes the URL", () => {
      namesLoaded(null);
      mockRouter.setUrl("?po=10&a=app-1");
      spansLoaded();
      renderPage();

      expect(
        screen.getByText("No traces received for this app yet"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Trace")).toBeNull();
      expect(mockRouter.urlParams()).toEqual({
        a: "app-1",
        d: "Last 6 Hours",
        po: "10",
      });
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        null,
        10,
      );
      expect(screen.getByTestId("filter-bar-span-names")).toHaveTextContent("");
    });

    it("says so in place of the list, fetches nothing and leaves the URL alone", () => {
      mockRouter.setUrl("?po=10&a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      spansLoaded();
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(null, null, 10);
      expect(mockRouter.urlParams()).toEqual({
        a: "app-1",
        d: "Last 6 Hours",
        po: "10",
      });
    });

    it("says so when the trace names cannot be fetched", () => {
      mockUseRootSpanNamesQuery.mockReturnValue({
        data: undefined,
        isSuccess: false,
        isError: true,
      });
      spansLoaded();
      renderPage();

      expect(
        screen.getByText(/Error fetching traces list/),
      ).toBeInTheDocument();
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(null, null, 0);
    });
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.setUrl("?po=0&r=span.first&a=app-1&d=Last+6+Hours");
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "5" });
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ appId: "app-1" }),
        "span.first",
        5,
      );
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.setUrl("?po=5&r=span.first&a=app-1");
      spansLoaded();
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
      mockRouter.setUrl("?po=30&a=app-1&r=span.first");
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "span_status:in:error",
      });
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterExpr: "span_status:in:error" }),
        "span.first",
        0,
      );
      for (const [filter, , offset] of mockUseSpansQuery.mock.calls) {
        if (filter?.filterExpr === "span_status:in:error") {
          expect(offset).toBe(0);
        }
      }
    });

    it("goes back to the first page when another name is picked", async () => {
      mockRouter.setUrl("?po=30&a=app-1&d=Last+6+Hours");
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-pick-name"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        r: "span.second",
        po: "0",
      });
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        "span.second",
        0,
      );
      for (const [, spanName, offset] of mockUseSpansQuery.mock.calls) {
        if (spanName === "span.second") {
          expect(offset).toBe(0);
        }
      }
    });

    it("goes back to the first page when the URL names a span the app does not have", async () => {
      mockRouter.setUrl("?po=30&r=span.gone&a=app-1&d=Last+6+Hours");
      mockRouter.deferReplace = true;
      spansLoaded();
      renderPage();

      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        null,
        "span.first",
        30,
      );
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );

      await act(async () => {
        mockRouter.applyDeferredReplace();
      });

      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ appId: "app-1" }),
        "span.first",
        0,
      );
      for (const [filter, spanName, offset] of mockUseSpansQuery.mock.calls) {
        if (filter !== null) {
          expect(spanName).toBe("span.first");
          expect(offset).toBe(0);
        }
      }
    });

    it("cannot be used while a refetch is in flight", () => {
      mockUseSpansQuery.mockReturnValue({
        data: mockSpanData,
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
    mockUseSpansQuery.mockReturnValue({
      data: mockSpanData,
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
      spansLoaded();
      rerender(<TracesOverview params={promiseParams({ teamId: "123" })} />);
    });

    await screen.findByText("Test Span");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});
