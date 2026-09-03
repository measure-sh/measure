import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import BugReportsOverview from "@/app/[teamId]/bug_reports/page";
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
  emptyBugReportsOverviewResponse: {
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
  },
}));

const pendingQueryState = () => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
});

const mockUseBugReportsOverviewQuery = jest.fn(
  (_filter: any, _offset: number) => pendingQueryState(),
);
const mockUseBugReportsOverviewPlotQuery = jest.fn((_filter: any) =>
  pendingQueryState(),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useBugReportsOverviewQuery: (filter: any, offset: number) =>
    mockUseBugReportsOverviewQuery(filter, offset),
  useBugReportsOverviewPlotQuery: (filter: any) =>
    mockUseBugReportsOverviewPlotQuery(filter),
  paginationOffsetUrlKey: "po",
}));

const mockReportedApp = { id: "app-1", name: "Sample" };
const mockReportedDate = {
  dateRange: "Last 6 Hours",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-01T06:00:00.000Z",
};

// Makes the stub drop the URL's filter on mount, like the bar discarding
// a filter it cannot read.
let mockMountDiscardsFilter = false;

// Like the real bar, this stub reports the request it is handed, on mount
// and whenever it changes; its buttons hand the page a request the way a
// pick does, or report a failure. Only a discarded mount report carries
// appliedAsRequested false.
jest.mock("@/app/components/filter_bar/filter_bar", () => {
  const { useEffect } = require("react");

  function FilterBarMock(props: any) {
    const ready = (
      filterExpr: string | null,
      appliedAsRequested: boolean = false,
    ) => ({
      status: "ready",
      app: mockReportedApp,
      date: mockReportedDate,
      filterExpr,
      appliedAsRequested,
    });
    const request = (filterExpr: string | null) =>
      props.onRequestChange({
        appId: mockReportedApp.id,
        dateRange: mockReportedDate,
        filterExpr,
        rootSpanName: null,
      });

    useEffect(() => {
      if (mockMountDiscardsFilter) {
        props.onFilterChange(ready(null, false));
      } else {
        props.onFilterChange(ready(props.requestedFilterExpr, true));
      }
    }, [props.requestedFilterExpr]);

    return (
      <div data-testid="filter-bar-mock">
        <span data-testid="filter-bar-expr">
          {props.requestedFilterExpr ?? "none"}
        </span>
        <button
          data-testid="filter-bar-apply"
          onClick={() => request("bug_report_status:in:open")}
        >
          apply
        </button>
        <button data-testid="filter-bar-clear" onClick={() => request(null)}>
          clear
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
jest.mock("@/app/components/bug_reports_overview_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="bug-reports-overview-plot-mock">
      {props.query.status === "pending" ? (
        <div data-testid="skeleton-plot-mock" />
      ) : (
        "BugReportsOverviewPlot Rendered"
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
}));

const mockBugReportResult = {
  session_id: "session1",
  app_id: "app1",
  event_id: "bug1",
  description: "Test Bug Report",
  status: 0,
  timestamp: "2020-01-01T00:00:00Z",
  attribute: {
    app_version: "1.0",
    app_build: "1",
    os_name: "ios",
    os_version: "15.0",
    device_manufacturer: "Apple",
    device_model: "iPhone 12",
  },
  user_defined_attribute: null,
  attachments: null,
};

const mockBugReportsData = {
  results: [mockBugReportResult],
  meta: { previous: true, next: true },
};

function bugReportsLoaded(data: any = mockBugReportsData) {
  mockUseBugReportsOverviewQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

// What the stub bar reports, as the page writes it into the URL.
const selectionParams = "a=app-1&d=Last+6+Hours";

const selectionUrl = (offset: number, filterParam?: string) =>
  `?po=${offset}&${selectionParams}${filterParam ? `&${filterParam}` : ""}`;

function renderPage() {
  return render(
    <BugReportsOverview params={promiseParams({ teamId: "123" })} />,
  );
}

describe("BugReportsOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockMountDiscardsFilter = false;
    mockUseBugReportsOverviewQuery.mockReset();
    mockUseBugReportsOverviewQuery.mockReturnValue(pendingQueryState());
    mockUseBugReportsOverviewPlotQuery.mockReset();
    mockUseBugReportsOverviewPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
  });

  it("hands the bar the filter the URL opened on", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=0&filter_expr=bug_report_status%3Ain%3Aopen",
    );
    bugReportsLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "bug_report_status:in:open",
    );
  });

  it("fetches nothing until the bar settles on an app and a range", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=bug_report_status%3Ain%3Aopen",
    );
    bugReportsLoaded();
    renderPage();

    expect(mockUseBugReportsOverviewQuery).toHaveBeenNthCalledWith(1, null, 20);
    expect(mockUseBugReportsOverviewPlotQuery).toHaveBeenNthCalledWith(1, null);
  });

  it("fetches the page the URL names, filtered by what the bar reported", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=bug_report_status%3Ain%3Aopen",
    );
    bugReportsLoaded();
    renderPage();

    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(
      {
        appId: mockReportedApp.id,
        startDate: mockReportedDate.startDate,
        endDate: mockReportedDate.endDate,
        filterExpr: "bug_report_status:in:open",
      },
      20,
    );
    expect(mockUseBugReportsOverviewPlotQuery).toHaveBeenLastCalledWith({
      appId: mockReportedApp.id,
      startDate: mockReportedDate.startDate,
      endDate: mockReportedDate.endDate,
      filterExpr: "bug_report_status:in:open",
    });
  });

  it("never fetches a filter the bar discarded on mount", async () => {
    mockMountDiscardsFilter = true;
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(
      `po=30&filter_expr=bug_report_status%3Ain%3Aopen&${selectionParams}`,
    );
    bugReportsLoaded();
    renderPage();

    // The write has not landed, so the URL still holds the discarded
    // filter and the queries stay disabled, at the offset the page wrote.
    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(null, 0);

    await act(async () => {
      applyReplaceUrl(mockRouter.deferredReplaceUrl!);
    });

    expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
      scroll: false,
    });
    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(
      {
        appId: mockReportedApp.id,
        startDate: mockReportedDate.startDate,
        endDate: mockReportedDate.endDate,
        filterExpr: null,
      },
      0,
    );
    for (const [params] of mockUseBugReportsOverviewQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("bug_report_status:in:open");
    }
  });

  it("records what the bar settled on, keeping the page the link asked for", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=bug_report_status%3Ain%3Aopen",
    );
    bugReportsLoaded();
    renderPage();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      selectionUrl(20, "filter_expr=bug_report_status%3Ain%3Aopen"),
      { scroll: false },
    );
  });

  it("keeps the plot area up with paging disabled while the reports load", () => {
    renderPage();
    expect(
      screen.getByTestId("bug-reports-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeDisabled();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
  });

  it("shows the plot skeleton while the bar's report waits to reach the URL", () => {
    mockRouter.deferReplace = true;
    bugReportsLoaded();
    renderPage();

    // The URL write has not landed, so the bar's report does not match the
    // URL yet and the queries stay disabled with a null filter.
    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(null, 0);
    expect(
      screen.getByTestId("bug-reports-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-plot-mock")).toBeInTheDocument();
  });

  it("renders the plot, paginator and table headers once ready", async () => {
    bugReportsLoaded();
    renderPage();

    expect(
      await screen.findByTestId("bug-reports-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();
    expect(screen.getByText("Bug Report")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("displays bug report data correctly", () => {
    bugReportsLoaded();
    renderPage();

    expect(screen.getByText("Test Bug Report")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2020")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("ID: bug1")).toBeInTheDocument();
    expect(
      screen.getByText("1.0(1), iOS 15.0, Apple iPhone 12"),
    ).toBeInTheDocument();
  });

  // The device info line maps os_name to a display label: android becomes
  // "Android API Level", ios "iOS", ipados "iPadOS", and any other value is
  // shown as-is.
  it.each([
    {
      osName: "ipados",
      osVersion: "17",
      expected: "1.0(1), iPadOS 17, Apple iPhone 12",
    },
    {
      osName: "android",
      osVersion: "14",
      expected: "1.0(1), Android API Level 14, Apple iPhone 12",
    },
    {
      osName: "harmonyos",
      osVersion: "4",
      expected: "1.0(1), harmonyos 4, Apple iPhone 12",
    },
  ])(
    "formats device info line for os_name $osName",
    ({ osName, osVersion, expected }) => {
      bugReportsLoaded({
        results: [
          {
            ...mockBugReportResult,
            attribute: {
              ...mockBugReportResult.attribute,
              os_name: osName,
              os_version: osVersion,
            },
          },
        ],
        meta: { previous: false, next: false },
      });
      renderPage();

      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it("handles bug reports with no description properly", () => {
    bugReportsLoaded({
      results: [{ ...mockBugReportResult, description: null }],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getByText("No Description")).toBeInTheDocument();
  });

  it("renders table headers but no rows when results are empty", () => {
    bugReportsLoaded({
      results: [],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getByText("Bug Report")).toBeInTheDocument();
    expect(screen.queryByText("ID: bug1")).not.toBeInTheDocument();
  });

  it("shows an error message when the bug reports request fails", () => {
    mockUseBugReportsOverviewQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of bug reports/),
    ).toBeInTheDocument();
  });

  it("renders appropriate link for each bug report", async () => {
    bugReportsLoaded();
    renderPage();

    const link = screen.getByRole("link", { name: /ID: bug1/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/bug_reports/app1/bug1");

    const row = link.closest("tr");
    expect(row).toHaveAttribute("data-testid", "bug-report-row");
    await act(async () => {
      fireEvent.keyDown(row!, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/bug_reports/app1/bug1");

    await act(async () => {
      fireEvent.keyDown(row!, { key: " " });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/bug_reports/app1/bug1");
  });

  it('renders "Open" and "Closed" status correctly based on status value', () => {
    bugReportsLoaded();
    const { unmount } = renderPage();

    const openStatusBadge = screen
      .getByText("Open")
      .closest('[data-slot="badge"]');
    expect(openStatusBadge).toHaveClass("border-green-400");
    expect(openStatusBadge).toHaveClass("text-green-700");
    expect(openStatusBadge).toHaveClass("bg-green-100");

    unmount();

    bugReportsLoaded({
      results: [{ ...mockBugReportResult, status: 1 }],
      meta: { previous: true, next: true },
    });
    renderPage();

    const closedStatusBadge = screen
      .getByText("Closed")
      .closest('[data-slot="badge"]');
    expect(closedStatusBadge).toHaveClass("border-indigo-400");
    expect(closedStatusBadge).toHaveClass("text-indigo-700");
    expect(closedStatusBadge).toHaveClass("bg-indigo-100");
  });

  describe("a filter the bar could not settle", () => {
    beforeEach(() => {
      mockRouter.searchParams = new URLSearchParams(`po=10&${selectionParams}`);
      bugReportsLoaded();
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

      expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(null, 10);
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
      mockRouter.searchParams = new URLSearchParams(`po=0&${selectionParams}`);
      bugReportsLoaded();
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
      mockRouter.searchParams = new URLSearchParams("po=5&a=app-1");
      bugReportsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
        scroll: false,
      });

      mockRouter.searchParams = new URLSearchParams("po=0&a=app-1");
      renderPage();
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("prev-button")[1]);
      });
      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
        scroll: false,
      });
    });

    it("goes back to the first page when the filter changes", async () => {
      mockRouter.searchParams = new URLSearchParams("po=30&a=app-1");
      bugReportsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "filter_expr=bug_report_status%3Ain%3Aopen"),
        { scroll: false },
      );
      // The changed filter and the reset offset reach the query together,
      // through the URL, so the new filter is never fetched at the page the
      // old filter was on.
      expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterExpr: "bug_report_status:in:open" }),
        0,
      );
      for (const [params, offset] of mockUseBugReportsOverviewQuery.mock
        .calls) {
        if (params?.filterExpr === "bug_report_status:in:open") {
          expect(offset).toBe(0);
        }
      }
    });

    it("goes back to the first page when the filter is cleared", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "po=30&filter_expr=bug_report_status%3Ain%3Aopen",
      );
      bugReportsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
        scroll: false,
      });
    });

    it("cannot be used while a refetch is in flight", () => {
      mockUseBugReportsOverviewQuery.mockReturnValue({
        data: mockBugReportsData,
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
    mockUseBugReportsOverviewQuery.mockReturnValue({
      data: mockBugReportsData,
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
      bugReportsLoaded();
      rerender(
        <BugReportsOverview params={promiseParams({ teamId: "123" })} />,
      );
    });

    await screen.findByText("Test Bug Report");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});
