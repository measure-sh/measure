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
const mockUseBugReportsOverviewQuery = jest.fn(
  (_filter: any, _offset: number) => pendingQueryState(),
);
const mockUseBugReportsOverviewPlotQuery = jest.fn((_filter: any) =>
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
  useBugReportsOverviewQuery: (filter: any, offset: number) =>
    mockUseBugReportsOverviewQuery(filter, offset),
  useBugReportsOverviewPlotQuery: (filter: any) =>
    mockUseBugReportsOverviewPlotQuery(filter),
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
      <button
        data-testid="filter-bar-apply"
        onClick={() =>
          props.onChange({ filterExpr: "bug_report_status:in:open" })
        }
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

import BugReportsOverview from "@/app/[teamId]/bug_reports/page";

const mockApp = { id: "app-1", name: "Sample", onboarded: true };

const statusKey = {
  name: "bug_report_status",
  label: "Bug report status",
  key_group: "Bug Report",
  description: "Whether the report is open",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

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

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(
    <BugReportsOverview params={promiseParams({ teamId: "123" })} />,
  );
}

describe("BugReportsOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [statusKey], key_groups: ["Bug Report"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseBugReportsOverviewQuery.mockReset();
    mockUseBugReportsOverviewQuery.mockReturnValue(pendingQueryState());
    mockUseBugReportsOverviewPlotQuery.mockReset();
    mockUseBugReportsOverviewPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
  });

  it("hands the bar the app and filter it settled on", () => {
    mockRouter.setUrl("?po=0&filter_expr=bug_report_status%3Ain%3Aopen");
    bugReportsLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "bug_report_status:in:open",
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockRouter.setUrl("?po=20&filter_expr=bug_report_status%3Ain%3Aopen");
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    bugReportsLoaded();
    renderPage();

    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(null, 20);
    expect(mockUseBugReportsOverviewPlotQuery).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
  });

  it("fetches the page the URL names, filtered by what it settled on", () => {
    mockRouter.setUrl("?po=20&filter_expr=bug_report_status%3Ain%3Aopen");
    bugReportsLoaded();
    renderPage();

    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "bug_report_status:in:open",
      }),
      20,
    );
    expect(mockUseBugReportsOverviewPlotQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "bug_report_status:in:open",
      }),
    );
  });

  it("never fetches a filter it discarded on mount", async () => {
    mockRouter.setUrl(
      "?po=30&filter_expr=device_cohort%3Ain%3Anew&a=app-1&d=Last+6+Hours",
    );
    mockRouter.deferReplace = true;
    bugReportsLoaded();
    renderPage();

    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(null, 30);
    expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });

    await act(async () => {
      mockRouter.applyDeferredReplace();
    });

    expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1", filterExpr: null }),
      0,
    );
    for (const [params] of mockUseBugReportsOverviewQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("device_cohort:in:new");
    }
  });

  it("records what it settled on, keeping the page the link asked for", () => {
    mockRouter.setUrl("?po=20&filter_expr=bug_report_status%3Ain%3Aopen");
    bugReportsLoaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      po: "20",
      filter_expr: "bug_report_status:in:open",
    });
  });

  it("keeps the plot area up with paging disabled while the reports load", () => {
    renderPage();
    expect(
      screen.getByTestId("bug-reports-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeDisabled();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
  });

  it("shows the plot skeleton while what it settled on waits to reach the URL", () => {
    mockRouter.deferReplace = true;
    bugReportsLoaded();
    renderPage();

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

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?po=10&a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      bugReportsLoaded();
    });

    it("is said by the page, in place of the list", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Bug Report")).toBeNull();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseBugReportsOverviewQuery).toHaveBeenLastCalledWith(null, 10);
    });

    it("leaves the URL where the link had it", () => {
      renderPage();

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "10" });
    });
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.setUrl("?po=0&a=app-1&d=Last+6+Hours");
      bugReportsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "5" });
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.setUrl("?po=5&a=app-1");
      bugReportsLoaded();
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
      bugReportsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "bug_report_status:in:open",
      });
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
      mockRouter.setUrl("?po=30&filter_expr=bug_report_status%3Ain%3Aopen");
      bugReportsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
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
