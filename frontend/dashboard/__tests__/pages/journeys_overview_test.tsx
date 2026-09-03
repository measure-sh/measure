import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import UserJourneysPage from "@/app/[teamId]/journeys/page";
import { ApiError, invalidFilterExpr } from "@/app/api/api_error";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const replaceMock = mockRouter.replaceMock;
const applyReplaceUrl = mockRouter.applyReplaceUrl;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

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

const mockUseJourneyQuery = jest.fn((_filter: any) => pendingQueryState());

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useJourneyQuery: (filter: any) => mockUseJourneyQuery(filter),
  paginationOffsetUrlKey: "po",
}));

const mockReportedApp = { id: "app-1", name: "Sample" };
const mockOtherApp = { id: "app-2", name: "Other" };
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
// appliedAsRequested false. The issues the page hands back are rendered so
// tests can see them reach the bar.
jest.mock("@/app/components/filter_bar/filter_bar", () => {
  const { useEffect } = require("react");

  function FilterBarMock(props: any) {
    const ready = (
      filterExpr: string | null,
      appliedAsRequested: boolean = false,
      app: { id: string; name: string } = mockReportedApp,
    ) => ({
      status: "ready",
      app,
      date: mockReportedDate,
      filterExpr,
      appliedAsRequested,
    });
    const requestedApp =
      props.requestedAppId === mockOtherApp.id ? mockOtherApp : mockReportedApp;
    const request = (filterExpr: string | null, appId = mockReportedApp.id) =>
      props.onRequestChange({
        appId,
        dateRange: mockReportedDate,
        filterExpr,
        rootSpanName: null,
      });

    useEffect(() => {
      if (mockMountDiscardsFilter) {
        props.onFilterChange(ready(null, false));
      } else {
        props.onFilterChange(
          ready(props.requestedFilterExpr, true, requestedApp),
        );
      }
    }, [props.requestedAppId, props.requestedFilterExpr]);

    return (
      <div data-testid="filter-bar-mock">
        <span data-testid="filter-bar-entity">{props.entity}</span>
        <span data-testid="filter-bar-expr">
          {props.requestedFilterExpr ?? "none"}
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
          onClick={() => request("version_name:in:1.2.0")}
        >
          apply
        </button>
        <button data-testid="filter-bar-clear" onClick={() => request(null)}>
          clear
        </button>
        <button
          data-testid="filter-bar-switch-app"
          onClick={() => request(props.requestedFilterExpr, mockOtherApp.id)}
        >
          switch app
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

// The stub records the plot it was asked for, the search text, the query
// status and the app the issue buttons would link to.
jest.mock("@/app/components/journey", () => ({
  __esModule: true,
  JourneyType: { Paths: "Paths", Exceptions: "Exceptions" },
  PlotType: { Paths: "Paths", Exceptions: "Exceptions" },
  default: (props: any) => (
    <div
      data-testid={`journey-mock-${props.journeyType}`}
      data-search-text={props.searchText}
      data-status={props.query.status}
      data-app={props.errorDetailContext.appId}
      data-team={props.errorDetailContext.teamId}
    >{`Journey Rendered: ${props.journeyType}`}</div>
  ),
}));

jest.mock("@/app/components/tab_select", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="tab-select-mock" data-selected={props.selected}>
      {props.items.map((item: string) => (
        <button
          key={item}
          data-testid={`tab-${item}`}
          onClick={() => props.onChangeSelected(item)}
        >
          {item}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/debounce_text_input", () => ({
  __esModule: true,
  default: (props: any) => (
    <input
      data-testid="debounce-text-input-mock"
      placeholder={props.placeholder}
      defaultValue={props.initialValue}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
}));

const mockJourneyData = {
  nodes: [
    { id: "sh.measure.demo.MainActivity", issues: { crashes: [], anrs: [] } },
  ],
  links: [],
  totalIssues: 0,
};

function journeyLoaded(data: any = mockJourneyData) {
  mockUseJourneyQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

function journeyFailed(error: Error) {
  mockUseJourneyQuery.mockReturnValue({
    data: undefined,
    status: "error",
    isFetching: false,
    error,
  });
}

// What the stub bar reports, as the page writes it into the URL.
const selectionParams = "a=app-1&d=Last+6+Hours";

const selectionUrl = (...trailingParams: string[]) =>
  `?${[selectionParams, ...trailingParams].join("&")}`;

const reportedFilterParams = (filterExpr: string | null) => ({
  appId: mockReportedApp.id,
  startDate: mockReportedDate.startDate,
  endDate: mockReportedDate.endDate,
  filterExpr,
});

function renderPage() {
  return render(<UserJourneysPage params={promiseParams({ teamId: "123" })} />);
}

describe("UserJourneys page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockMountDiscardsFilter = false;
    mockUseJourneyQuery.mockReset();
    mockUseJourneyQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar for the journeys entity", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent(
      "journeys",
    );
  });

  it("hands the bar the filter the URL opened on", () => {
    mockRouter.searchParams = new URLSearchParams(
      "filter_expr=version_name%3Ain%3A1.2.0",
    );
    journeyLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "version_name:in:1.2.0",
    );
  });

  it("fetches nothing until the bar settles on an app and a range", () => {
    mockRouter.searchParams = new URLSearchParams(
      "filter_expr=version_name%3Ain%3A1.2.0",
    );
    journeyLoaded();
    renderPage();

    expect(mockUseJourneyQuery).toHaveBeenNthCalledWith(1, null);
  });

  it("fetches the journey filtered by what the bar reported", () => {
    mockRouter.searchParams = new URLSearchParams(
      "filter_expr=version_name%3Ain%3A1.2.0",
    );
    journeyLoaded();
    renderPage();

    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
      reportedFilterParams("version_name:in:1.2.0"),
    );
  });

  it("never fetches a filter the bar discarded on mount", async () => {
    mockMountDiscardsFilter = true;
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(
      `filter_expr=version_name%3Ain%3A1.2.0&${selectionParams}`,
    );
    journeyLoaded();
    renderPage();

    // The write has not landed, so the URL still holds the discarded
    // filter and the query stays disabled.
    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(null);

    await act(async () => {
      applyReplaceUrl(mockRouter.deferredReplaceUrl!);
    });

    expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(), {
      scroll: false,
    });
    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
      reportedFilterParams(null),
    );
    for (const [params] of mockUseJourneyQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("version_name:in:1.2.0");
    }
  });

  it("records what the bar settled on without a pagination offset", () => {
    mockRouter.searchParams = new URLSearchParams(
      "filter_expr=version_name%3Ain%3A1.2.0",
    );
    journeyLoaded();
    renderPage();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      selectionUrl("filter_expr=version_name%3Ain%3A1.2.0"),
      { scroll: false },
    );
    expect(mockRouter.searchParams.has("po")).toBe(false);
  });

  it("renders the tabs, the search input and the journey once ready", () => {
    journeyLoaded();
    renderPage();

    expect(screen.getByTestId("tab-select-mock")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search nodes...")).toBeInTheDocument();
    expect(screen.getByTestId("journey-mock-Paths")).toHaveAttribute(
      "data-status",
      "success",
    );
    expect(screen.queryByTestId("journey-mock-Exceptions")).toBeNull();
  });

  it("keeps the tabs and the journey up while the journey loads", () => {
    renderPage();

    expect(screen.getByTestId("tab-select-mock")).toBeInTheDocument();
    expect(screen.getByTestId("journey-mock-Paths")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  it("links the issue buttons to the team and app the bar settled on", () => {
    journeyLoaded();
    renderPage();

    const journey = screen.getByTestId("journey-mock-Paths");
    expect(journey).toHaveAttribute("data-team", "123");
    expect(journey).toHaveAttribute("data-app", mockReportedApp.id);
  });

  it("passes the typed search text to the journey", async () => {
    journeyLoaded();
    renderPage();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Search nodes..."), {
        target: { value: "search term" },
      });
    });

    expect(screen.getByTestId("journey-mock-Paths")).toHaveAttribute(
      "data-search-text",
      "search term",
    );
  });

  describe("the plot type", () => {
    it("opens on the plot the URL names", () => {
      mockRouter.searchParams = new URLSearchParams("jt=Exceptions");
      journeyLoaded();
      renderPage();

      expect(screen.getByTestId("tab-select-mock")).toHaveAttribute(
        "data-selected",
        "Exceptions",
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();
    });

    it("survives the bar's report being written into the URL", () => {
      mockRouter.searchParams = new URLSearchParams("jt=Exceptions");
      journeyLoaded();
      renderPage();

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl("jt=Exceptions"),
        { scroll: false },
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
    });

    it("is written into the URL when a tab is clicked, keeping the filter", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "filter_expr=version_name%3Ain%3A1.2.0",
      );
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-Exceptions"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl("filter_expr=version_name%3Ain%3A1.2.0", "jt=Exceptions"),
        { scroll: false },
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-Paths"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl("filter_expr=version_name%3Ain%3A1.2.0", "jt=Paths"),
        { scroll: false },
      );
      expect(screen.getByTestId("journey-mock-Paths")).toBeInTheDocument();
    });

    it("does not change the query when a tab is clicked", async () => {
      journeyLoaded();
      renderPage();
      const callsBefore = mockUseJourneyQuery.mock.calls.length;

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-Exceptions"));
      });

      for (const [params] of mockUseJourneyQuery.mock.calls.slice(
        callsBefore,
      )) {
        expect(params).toEqual(reportedFilterParams(null));
      }
    });

    it("is kept when the filter changes", async () => {
      mockRouter.searchParams = new URLSearchParams("jt=Exceptions");
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl("filter_expr=version_name%3Ain%3A1.2.0", "jt=Exceptions"),
        { scroll: false },
      );
      expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
        reportedFilterParams("version_name:in:1.2.0"),
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
    });

    it("is kept when the filter is cleared", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "jt=Exceptions&filter_expr=version_name%3Ain%3A1.2.0",
      );
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl("jt=Exceptions"),
        { scroll: false },
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
    });
  });

  it("refetches for the app the bar switches to", async () => {
    journeyLoaded();
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId("filter-bar-switch-app"));
    });

    expect(replaceMock).toHaveBeenLastCalledWith(
      `?${selectionParams.replace("a=app-1", "a=app-2")}`,
      { scroll: false },
    );
    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith({
      ...reportedFilterParams(null),
      appId: mockOtherApp.id,
    });
    expect(screen.getByTestId("journey-mock-Paths")).toHaveAttribute(
      "data-app",
      mockOtherApp.id,
    );
  });

  describe("when the journey request fails", () => {
    it("shows the error message", () => {
      journeyFailed(new Error("fail"));
      renderPage();

      expect(screen.getByText(/Error fetching journey/)).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();
      expect(screen.getByTestId("filter-bar-issues")).toHaveTextContent("none");
    });

    it("hands a refused filter's issues to the bar in place of the message", () => {
      mockRouter.searchParams = new URLSearchParams(
        "filter_expr=version_name%3Ain%3A1.2.0",
      );
      journeyFailed(
        new ApiError(400, invalidFilterExpr, [
          { message: 'Unknown key "os_name"', span: { start: 0, end: 7 } },
        ]),
      );
      renderPage();

      expect(screen.getByTestId("filter-bar-issues")).toHaveTextContent(
        'Unknown key "os_name"',
      );
      expect(screen.queryByText(/Error fetching journey/)).toBeNull();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();
    });
  });

  describe("a filter the bar could not settle", () => {
    beforeEach(() => {
      mockRouter.searchParams = new URLSearchParams(selectionParams);
      journeyLoaded();
    });

    it("is said by the page, in place of the journey", async () => {
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();
    });

    it("stops the page fetching anything", async () => {
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(null);
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
});
