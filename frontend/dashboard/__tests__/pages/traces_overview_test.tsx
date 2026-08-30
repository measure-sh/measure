import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import TracesOverview from "@/app/[teamId]/traces/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const replaceMock = mockRouter.replaceMock;
const pushMock = mockRouter.pushMock;
const applyReplaceUrl = mockRouter.applyReplaceUrl;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptySpansResponse: {
    meta: { next: false, previous: false },
    results: [],
  },
}));

jest.mock("@/app/stores/filters_store", () => ({
  __esModule: true,
  urlFiltersKeyMap: {
    appId: "a",
    dateRange: "d",
    startDate: "sd",
    endDate: "ed",
    rootSpanName: "r",
  },
}));

const pendingQueryState = () => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
});

const mockUseSpansQuery = jest.fn(
  (_filter: any, _spanName: string | null, _offset: number) =>
    pendingQueryState(),
);
const mockUseSpanMetricsPlotQuery = jest.fn(
  (_filter: any, _spanName: string | null) => pendingQueryState(),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useSpansQuery: (filter: any, spanName: string | null, offset: number) =>
    mockUseSpansQuery(filter, spanName, offset),
  useSpanMetricsPlotQuery: (filter: any, spanName: string | null) =>
    mockUseSpanMetricsPlotQuery(filter, spanName),
  paginationOffsetUrlKey: "po",
}));

const mockReportedApp = { id: "app-1", name: "Sample" };
const mockReportedDate = {
  dateRange: "Last 6 Hours",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-01T06:00:00.000Z",
};

// Set before render to make the stub open with a trace name of its own in
// place of the URL's, the way the real bar substitutes a default when the
// app no longer has the requested name.
let mockMountSubstitutesName = false;

// Like the real bar, this stub reports an app, a range and a resolved trace
// name as it mounts, and offers buttons that report a changed filter, a
// changed trace name, or a failure. Only the mount report carries
// appliedAsRequested true, and only when nothing was substituted; a report
// from a button models a user edit.
jest.mock("@/app/components/filter_bar/filter_bar", () => {
  const { useEffect } = require("react");

  function FilterBarMock(props: any) {
    const ready = (
      filterExpr: string | null,
      // The real bar restores the URL's name when it can, so the stub
      // reports it back too and falls back to a first name of its own.
      rootSpanName: string = props.requestedRootSpanName ?? "span.first",
      appliedAsRequested: boolean = false,
    ) => ({
      status: "ready",
      app: mockReportedApp,
      date: mockReportedDate,
      filterExpr,
      rootSpanName,
      appliedAsRequested,
    });

    useEffect(() => {
      if (mockMountSubstitutesName) {
        props.onFilterChange(
          ready(props.requestedFilterExpr, "span.substitute", false),
        );
      } else {
        props.onFilterChange(ready(props.requestedFilterExpr, undefined, true));
      }
    }, []);

    return (
      <div data-testid="filter-bar-mock">
        <span data-testid="filter-bar-expr">
          {props.requestedFilterExpr ?? "none"}
        </span>
        <span data-testid="filter-bar-requested-name">
          {props.requestedRootSpanName ?? "none"}
        </span>
        <span data-testid="filter-bar-selector-shown">
          {String(props.showRootSpanSelector ?? false)}
        </span>
        <button
          data-testid="filter-bar-apply"
          onClick={() => props.onFilterChange(ready("span_status:in:error"))}
        >
          apply
        </button>
        <button
          data-testid="filter-bar-pick-name"
          onClick={() =>
            props.onFilterChange(
              ready(props.requestedFilterExpr, "span.second"),
            )
          }
        >
          pick name
        </button>
        <button
          data-testid="filter-bar-fail"
          onClick={() =>
            props.onFilterChange({
              status: "error",
              message: "Error fetching apps, please refresh page to try again",
            })
          }
        >
          fail
        </button>
      </div>
    );
  }

  return {
    __esModule: true,
    default: FilterBarMock,
    filterExprUrlKey: "filter_expr",
  };
});

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

// The real plot shows a skeleton while its query is pending, so the stub
// distinguishes that case for tests that check what fills the plot area.
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

// What the stub bar reports, as the page writes it into the URL.
const selectionParams =
  "a=app-1&d=Last+6+Hours&sd=2026-01-01T00%3A00%3A00.000Z&ed=2026-01-01T06%3A00%3A00.000Z";

// The names in these tests are URL-safe, so they appear in the URL as-is.
const selectionUrl = (
  offset: number,
  spanName = "span.first",
  filterParam?: string,
) =>
  `?po=${offset}&${selectionParams}&r=${spanName}${filterParam ? `&${filterParam}` : ""}`;

function renderPage() {
  return render(<TracesOverview params={promiseParams({ teamId: "123" })} />);
}

describe("TracesOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockMountSubstitutesName = false;
    mockUseSpansQuery.mockReset();
    mockUseSpansQuery.mockReturnValue(pendingQueryState());
    mockUseSpanMetricsPlotQuery.mockReset();
    mockUseSpanMetricsPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
  });

  it("asks the bar to show the trace name selector", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-selector-shown")).toHaveTextContent(
      "true",
    );
  });

  it("hands the bar the filter the URL opened on", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=0&filter_expr=span_status%3Ain%3Aerror",
    );
    spansLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "span_status:in:error",
    );
  });

  it("hands the bar the trace name the URL opened on", () => {
    mockRouter.searchParams = new URLSearchParams("po=0&a=app-1&r=span.second");
    spansLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-requested-name")).toHaveTextContent(
      "span.second",
    );
  });

  it("fetches nothing until the bar settles on an app, a range and a name", () => {
    spansLoaded();
    renderPage();

    expect(mockUseSpansQuery).toHaveBeenNthCalledWith(1, null, null, 0);
  });

  it("fetches spans and the plot for the name the bar reported", () => {
    spansLoaded();
    renderPage();

    expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
      {
        appId: mockReportedApp.id,
        startDate: mockReportedDate.startDate,
        endDate: mockReportedDate.endDate,
        filterExpr: null,
      },
      "span.first",
      0,
    );
    expect(mockUseSpanMetricsPlotQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: mockReportedApp.id }),
      "span.first",
    );
  });

  it("records what the bar settled on, keeping the page the link asked for", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=span_status%3Ain%3Aerror",
    );
    spansLoaded();
    renderPage();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      selectionUrl(20, "span.first", "filter_expr=span_status%3Ain%3Aerror"),
      { scroll: false },
    );
  });

  it("keeps the plot area up with paging disabled while the spans load", () => {
    renderPage();
    expect(screen.getByTestId("span-metrics-plot-mock")).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeDisabled();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
  });

  it("shows the plot skeleton while the bar's report waits to reach the URL", () => {
    mockRouter.deferReplace = true;
    spansLoaded();
    renderPage();

    // The URL write has not landed, so the bar's report does not match the
    // URL yet and the queries stay disabled with a null filter.
    expect(mockUseSpansQuery).toHaveBeenLastCalledWith(null, null, 0);
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

  describe("a filter the bar could not settle", () => {
    beforeEach(() => {
      mockRouter.searchParams = new URLSearchParams(`po=10&${selectionParams}`);
      spansLoaded();
    });

    it("is said by the page, in place of the list", async () => {
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
    });

    it("stops the page fetching anything", async () => {
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      // The name stays readable from the URL, but the null filter keeps the
      // query disabled.
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        null,
        "span.first",
        10,
      );
    });

    it("leaves the URL where the link had it", async () => {
      renderPage();
      replaceMock.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&r=span.first&${selectionParams}`,
      );
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      // Paging keeps everything else the URL was carrying.
      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(5), {
        scroll: false,
      });
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "po=5&r=span.first&a=app-1",
      );
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
        scroll: false,
      });

      mockRouter.searchParams = new URLSearchParams(
        "po=0&r=span.first&a=app-1",
      );
      renderPage();
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("prev-button")[1]);
      });
      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
        scroll: false,
      });
    });

    it("goes back to the first page when the filter changes", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "po=30&a=app-1&r=span.first",
      );
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "span.first", "filter_expr=span_status%3Ain%3Aerror"),
        { scroll: false },
      );
    });

    it("goes back to the first page when the bar reports another name", async () => {
      mockRouter.searchParams = new URLSearchParams(`po=30&${selectionParams}`);
      spansLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-pick-name"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "span.second"),
        { scroll: false },
      );
      // The changed name and the reset offset reach the queries together,
      // through the URL, so the new name is never fetched at the page the
      // old name was on.
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

    it("goes back to the first page when the bar opens on a substituted name", async () => {
      mockMountSubstitutesName = true;
      mockRouter.deferReplace = true;
      mockRouter.searchParams = new URLSearchParams(
        `po=30&r=span.gone&${selectionParams}`,
      );
      spansLoaded();
      renderPage();

      // The write has not landed, so the URL still holds the dead name
      // and the queries stay disabled.
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(null, "span.gone", 30);

      await act(async () => {
        applyReplaceUrl(mockRouter.deferredReplaceUrl!);
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "span.substitute"),
        { scroll: false },
      );
      // The substituted name is never fetched at the page the URL's name
      // was on.
      expect(mockUseSpansQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        "span.substitute",
        0,
      );
      for (const [filter, spanName, offset] of mockUseSpansQuery.mock.calls) {
        if (spanName === "span.substitute") {
          expect(offset).toBe(0);
        }
        if (spanName === "span.gone") {
          expect(filter).toBeNull();
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
