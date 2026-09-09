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
const mockUseSessionReplayOverviewQuery = jest.fn(
  (_filter: any, _offset: number) => pendingQueryState(),
);
const mockUseSessionReplayOverviewPlotQuery = jest.fn((_filter: any) =>
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
  useSessionReplayOverviewQuery: (filter: any, offset: number) =>
    mockUseSessionReplayOverviewQuery(filter, offset),
  useSessionReplayOverviewPlotQuery: (filter: any) =>
    mockUseSessionReplayOverviewPlotQuery(filter),
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
        onClick={() =>
          props.onChange({ filterExpr: "session_events:in:fatal_error" })
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
jest.mock("@/app/components/session_replay_overview_plot", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="session-replay-overview-plot-mock">
      {props.query.status === "pending" ? (
        <div data-testid="skeleton-plot-mock" />
      ) : (
        "SessionReplayOverviewPlot Rendered"
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
  formatMillisToHumanReadable: jest.fn(() => "5m 30s"),
}));

import SessionReplayOverview from "@/app/[teamId]/session_replays/page";

const mockApp = { id: "app-1", name: "Sample" };

const eventsKey = {
  name: "session_events",
  label: "Events",
  key_group: "Session",
  description: "What the session contains",
  value_type: "enum",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
  enum_values: ["fatal_error", "anr"],
};

const mockSessionResult = {
  session_id: "session1",
  app_id: "app1",
  first_event_time: "2020-01-01T00:00:00Z",
  last_event_time: "2020-01-01T00:05:30Z",
  duration: 330000,
  attribute: {
    app_version: "1.0",
    app_build: "1",
    os_name: "ios",
    os_version: "15.0",
    device_manufacturer: "Apple",
    device_model: "iPhone 12",
  },
};

const mockSessionsData = {
  results: [mockSessionResult],
  meta: { previous: true, next: true },
};

function sessionsLoaded(data: any = mockSessionsData) {
  mockUseSessionReplayOverviewQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(
    <SessionReplayOverview params={promiseParams({ teamId: "123" })} />,
  );
}

describe("SessionReplayOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [eventsKey], key_groups: ["Session"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseSessionReplayOverviewQuery.mockReset();
    mockUseSessionReplayOverviewQuery.mockReturnValue(pendingQueryState());
    mockUseSessionReplayOverviewPlotQuery.mockReset();
    mockUseSessionReplayOverviewPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar for the sessions entity", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent(
      "sessions",
    );
  });

  it("hands the bar the app and filter it settled on", () => {
    mockRouter.setUrl("?po=0&filter_expr=session_events%3Ain%3Afatal_error");
    sessionsLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "session_events:in:fatal_error",
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockRouter.setUrl("?po=20&filter_expr=session_events%3Ain%3Afatal_error");
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    sessionsLoaded();
    renderPage();

    expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(
      null,
      20,
    );
    expect(mockUseSessionReplayOverviewPlotQuery).toHaveBeenLastCalledWith(
      null,
    );
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
  });

  it("fetches the page the URL names, filtered by what it settled on", () => {
    mockRouter.setUrl("?po=20&filter_expr=session_events%3Ain%3Afatal_error");
    sessionsLoaded();
    renderPage();

    expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "session_events:in:fatal_error",
      }),
      20,
    );
    expect(mockUseSessionReplayOverviewPlotQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "session_events:in:fatal_error",
      }),
    );
  });

  it("never fetches a filter it discarded on mount", async () => {
    mockRouter.setUrl(
      "?po=30&filter_expr=device_cohort%3Ain%3Anew&a=app-1&d=Last+6+Hours",
    );
    mockRouter.deferReplace = true;
    sessionsLoaded();
    renderPage();

    expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(
      null,
      30,
    );
    expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });

    await act(async () => {
      mockRouter.applyDeferredReplace();
    });

    expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1", filterExpr: null }),
      0,
    );
    for (const [params] of mockUseSessionReplayOverviewQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("device_cohort:in:new");
    }
  });

  it("records what it settled on, keeping the page the link asked for", () => {
    mockRouter.setUrl("?po=20&filter_expr=session_events%3Ain%3Afatal_error");
    sessionsLoaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      po: "20",
      filter_expr: "session_events:in:fatal_error",
    });
  });

  it("keeps the plot area up with paging disabled while the sessions load", () => {
    renderPage();
    expect(
      screen.getByTestId("session-replay-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeDisabled();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
  });

  it("shows the plot skeleton while what it settled on waits to reach the URL", () => {
    mockRouter.deferReplace = true;
    sessionsLoaded();
    renderPage();

    expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(null, 0);
    expect(
      screen.getByTestId("session-replay-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-plot-mock")).toBeInTheDocument();
  });

  it("renders the plot, paginator and table headers once ready", async () => {
    sessionsLoaded();
    renderPage();

    expect(
      await screen.findByTestId("session-replay-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();
    expect(screen.getByText("Session Replay")).toBeInTheDocument();
    expect(screen.getByText("Start Time")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("displays session data correctly", () => {
    sessionsLoaded();
    renderPage();

    expect(screen.getByText("Session ID: session1")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2020")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("5m 30s")).toBeInTheDocument();
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
      sessionsLoaded({
        results: [
          {
            ...mockSessionResult,
            attribute: {
              ...mockSessionResult.attribute,
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

  it("shows N/A for a session with no duration", () => {
    sessionsLoaded({
      results: [{ ...mockSessionResult, duration: 0 }],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders table headers but no rows when results are empty", () => {
    sessionsLoaded({
      results: [],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getByText("Session Replay")).toBeInTheDocument();
    expect(screen.queryByText("Session ID: session1")).not.toBeInTheDocument();
  });

  it("shows an error message when the sessions request fails", () => {
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of sessions/),
    ).toBeInTheDocument();
  });

  it("renders appropriate link for each session", async () => {
    sessionsLoaded();
    renderPage();

    const link = screen.getByRole("link", { name: /Session ID: session1/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/session_replays/app1/session1");

    const row = link.closest("tr");
    await act(async () => {
      fireEvent.keyDown(row!, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/session_replays/app1/session1");

    await act(async () => {
      fireEvent.keyDown(row!, { key: " " });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/session_replays/app1/session1");
  });

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?po=10&a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      sessionsLoaded();
    });

    it("is said by the page, in place of the list", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Start Time")).toBeNull();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(
        null,
        10,
      );
    });

    it("leaves the URL where the link had it", () => {
      renderPage();

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "10" });
    });
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.setUrl("?po=0&a=app-1&d=Last+6+Hours");
      sessionsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "5" });
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.setUrl("?po=5&a=app-1");
      sessionsLoaded();
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
      sessionsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "session_events:in:fatal_error",
      });
      expect(mockUseSessionReplayOverviewQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filterExpr: "session_events:in:fatal_error",
        }),
        0,
      );
      for (const [params, offset] of mockUseSessionReplayOverviewQuery.mock
        .calls) {
        if (params?.filterExpr === "session_events:in:fatal_error") {
          expect(offset).toBe(0);
        }
      }
    });

    it("goes back to the first page when the filter is cleared", async () => {
      mockRouter.setUrl("?po=30&filter_expr=session_events%3Ain%3Afatal_error");
      sessionsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    });

    it("cannot be used while a refetch is in flight", () => {
      mockUseSessionReplayOverviewQuery.mockReturnValue({
        data: mockSessionsData,
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
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: mockSessionsData,
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
      sessionsLoaded();
      rerender(
        <SessionReplayOverview params={promiseParams({ teamId: "123" })} />,
      );
    });

    await screen.findByText("Session ID: session1");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});
