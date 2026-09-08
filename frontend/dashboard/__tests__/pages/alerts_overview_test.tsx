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
const mockUseAlertsOverviewQuery = jest.fn((_filter: any, _offset: number) =>
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
  useAlertsOverviewQuery: (filter: any, offset: number) =>
    mockUseAlertsOverviewQuery(filter, offset),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-app">
        {props.value?.app.name ?? "none"}
      </span>
      <span data-testid="filter-bar-date">
        {props.value?.date.dateRange ?? "none"}
      </span>
      <span data-testid="filter-bar-show-expr">
        {String(props.showFilterExpr)}
      </span>
      <button
        data-testid="filter-bar-other-app"
        onClick={() => props.onChange({ appId: props.apps[1].id })}
      >
        pick the other app
      </button>
      <button
        data-testid="filter-bar-last-week"
        onClick={() =>
          props.onChange({
            dateRange: {
              dateRange: "Last Week",
              startDate: null,
              endDate: null,
            },
          })
        }
      >
        last week
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
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

import AlertsOverview from "@/app/[teamId]/alerts/page";

const mockApps = [
  { id: "app-1", name: "Sample" },
  { id: "app-2", name: "Second" },
];

const mockAlertResult = {
  id: "alert1",
  team_id: "team1",
  app_id: "app1",
  entity_id: "crash1",
  type: "crash_spike",
  message: "message1",
  url: "http://example.com/alert1",
  created_at: "2020-01-01T00:00:00Z",
  updated_at: "2020-01-01T00:00:00Z",
};

const mockAlertsData = {
  results: [mockAlertResult],
  meta: { previous: true, next: true },
};

function alertsLoaded(data: any = mockAlertsData) {
  mockUseAlertsOverviewQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(<AlertsOverview params={promiseParams({ teamId: "123" })} />);
}

describe("AlertsOverview page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: mockApps });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [], key_groups: [] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseAlertsOverviewQuery.mockReset();
    mockUseAlertsOverviewQuery.mockReturnValue(pendingQueryState());
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("none");
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(mockUseAlertsOverviewQuery).toHaveBeenLastCalledWith(null, 0);
  });

  it("hands the bar the app and range it settled on", () => {
    alertsLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-date")).toHaveTextContent(
      "Last 6 Hours",
    );
  });

  it("asks the bar for the app and range alone", () => {
    alertsLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-show-expr")).toHaveTextContent(
      "false",
    );
  });

  it("asks for the alerts entity's keys, and says so when they cannot be fetched", () => {
    mockUseFilterKeysQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isPlaceholderData: false,
    });
    renderPage();

    expect(mockUseFilterKeysQuery).toHaveBeenCalledWith("app-1", "alerts", []);
    expect(
      screen.getByText(
        "Error fetching filters, please refresh page to try again",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
  });

  it("fetches the alerts of the app and range it settled on", () => {
    alertsLoaded();
    renderPage();

    expect(mockUseAlertsOverviewQuery).toHaveBeenLastCalledWith(
      {
        appId: "app-1",
        startDate: expect.any(String),
        endDate: expect.any(String),
        filterExpr: null,
      },
      0,
    );
  });

  it("records the app and range it settled on in the URL", () => {
    alertsLoaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual(settled);
  });

  it("fetches the page the URL names", () => {
    mockRouter.setUrl("?po=5&a=app-1&d=Last+6+Hours");
    alertsLoaded();
    renderPage();

    expect(mockUseAlertsOverviewQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1" }),
      5,
    );
  });

  it("discards a filter expression a link carried, and starts from page one", () => {
    mockRouter.setUrl(
      "?po=30&a=app-1&d=Last+6+Hours&filter_expr=version_name%3Ain%3A1.0",
    );
    alertsLoaded();
    renderPage();

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Some filters were invalid, page reset to defaults",
    );
    expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    for (const [params] of mockUseAlertsOverviewQuery.mock.calls) {
      expect(params?.filterExpr ?? null).toBeNull();
    }
  });

  it("shows an error message when the alerts request fails", () => {
    mockUseAlertsOverviewQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of alerts/),
    ).toBeInTheDocument();
  });

  it("renders the table headers and the alerts the server sent", () => {
    alertsLoaded();
    renderPage();

    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("ID: alert1")).toBeInTheDocument();
    expect(screen.getByText("message1")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2020")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
  });

  it("links each alert to where it happened, by click and by keyboard", async () => {
    alertsLoaded();
    renderPage();

    const link = screen.getByRole("link", { name: /ID: alert1/i });
    expect(link).toHaveAttribute("href", "http://example.com/alert1");

    const row = link.closest("tr");
    await act(async () => {
      fireEvent.keyDown(row!, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalledWith("http://example.com/alert1");

    await act(async () => {
      fireEvent.keyDown(row!, { key: " " });
    });
    expect(pushMock).toHaveBeenCalledWith("http://example.com/alert1");
  });

  it("renders the table shell with paging off when there are no alerts", () => {
    alertsLoaded({ results: [], meta: { previous: false, next: false } });
    renderPage();

    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument();
    expect(screen.getByTestId("prev-button")).toBeDisabled();
    expect(screen.getByTestId("next-button")).toBeDisabled();
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.setUrl("?po=0&a=app-1&d=Last+6+Hours");
      alertsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "5" });
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.setUrl("?po=5&a=app-1&d=Last+6+Hours");
      alertsLoaded();
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

    it("goes back to the first page when another app is picked", async () => {
      mockRouter.setUrl("?po=30&a=app-1&d=Last+6+Hours");
      alertsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-other-app"));
      });

      expect(mockRouter.urlParams()).toEqual({
        a: "app-2",
        d: "Last 6 Hours",
        po: "0",
      });
    });

    it("goes back to the first page when another range is picked", async () => {
      mockRouter.setUrl("?po=30&a=app-1&d=Last+6+Hours");
      alertsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-last-week"));
      });

      expect(mockRouter.urlParams()).toEqual({
        a: "app-1",
        d: "Last Week",
        po: "0",
      });
    });

    it("cannot be used while a refetch is in flight", () => {
      mockUseAlertsOverviewQuery.mockReturnValue({
        data: mockAlertsData,
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
    mockUseAlertsOverviewQuery.mockReturnValue({
      data: mockAlertsData,
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
      alertsLoaded();
      rerender(<AlertsOverview params={promiseParams({ teamId: "123" })} />);
    });

    await screen.findByText("message1");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});
