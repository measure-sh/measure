import { mockFiltersStore } from "@/__tests__/helpers/mock_filters_store";
import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

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
const mockUseJourneyQuery = jest.fn((_filter: any) => pendingQueryState());

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
  useJourneyQuery: (filter: any) => mockUseJourneyQuery(filter),
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
      <span data-testid="filter-bar-issues">
        {props.filterExprIssues
          ? props.filterExprIssues
              .map((issue: { message: string }) => issue.message)
              .join(", ")
          : "none"}
      </span>
      <button
        data-testid="filter-bar-apply"
        onClick={() => props.onChange({ filterExpr: "version_name:in:1.2.0" })}
      >
        apply
      </button>
      <button
        data-testid="filter-bar-clear"
        onClick={() => props.onChange({ filterExpr: null })}
      >
        clear
      </button>
      <button
        data-testid="filter-bar-switch-app"
        onClick={() =>
          props.onChange({
            appId: "app-2",
            filterExpr: null,
            rootSpanName: null,
          })
        }
      >
        switch app
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

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

import UserJourneysPage from "@/app/[teamId]/journeys/page";
import { ApiError, invalidFilterExpr } from "@/app/api/api_error";

const mockApp = { id: "app-1", name: "Sample" };
const mockOtherApp = { id: "app-2", name: "Other" };

const versionKey = {
  name: "version_name",
  label: "App version",
  key_group: "Version",
  description: "The app version",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

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

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(<UserJourneysPage params={promiseParams({ teamId: "123" })} />);
}

describe("UserJourneys page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({
      status: "success",
      data: [mockApp, mockOtherApp],
    });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [versionKey], key_groups: ["Version"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
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

  it("hands the bar the app and filter it settled on", () => {
    mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.2.0");
    journeyLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "version_name:in:1.2.0",
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.2.0");
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    journeyLoaded();
    renderPage();

    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
  });

  it("fetches the journey filtered by what it settled on", () => {
    mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.2.0");
    journeyLoaded();
    renderPage();

    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "version_name:in:1.2.0",
      }),
    );
  });

  it("never fetches a filter it discarded on mount", async () => {
    mockRouter.setUrl(
      "?filter_expr=device_cohort%3Ain%3Anew&a=app-1&d=Last+6+Hours",
    );
    mockRouter.deferReplace = true;
    journeyLoaded();
    renderPage();

    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(null);
    expect(mockRouter.urlParams()).toEqual(settled);

    await act(async () => {
      mockRouter.applyDeferredReplace();
    });

    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1", filterExpr: null }),
    );
    for (const [params] of mockUseJourneyQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("device_cohort:in:new");
    }
  });

  it("records what it settled on without a pagination offset", () => {
    mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.2.0");
    journeyLoaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      filter_expr: "version_name:in:1.2.0",
    });
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

  it("links the issue buttons to the team and app it settled on", () => {
    journeyLoaded();
    renderPage();

    const journey = screen.getByTestId("journey-mock-Paths");
    expect(journey).toHaveAttribute("data-team", "123");
    expect(journey).toHaveAttribute("data-app", mockApp.id);
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
      mockRouter.setUrl("?jt=Exceptions");
      journeyLoaded();
      renderPage();

      expect(screen.getByTestId("tab-select-mock")).toHaveAttribute(
        "data-selected",
        "Exceptions",
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();
    });

    it("survives what the page settled on being written into the URL", () => {
      mockRouter.setUrl("?jt=Exceptions");
      journeyLoaded();
      renderPage();

      expect(mockRouter.urlParams()).toEqual({ ...settled, jt: "Exceptions" });
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
    });

    it("is written into the URL when a tab is clicked, keeping the filter", async () => {
      mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.2.0");
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-Exceptions"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        filter_expr: "version_name:in:1.2.0",
        jt: "Exceptions",
      });
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-Paths"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        filter_expr: "version_name:in:1.2.0",
        jt: "Paths",
      });
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
        expect(params).toEqual(
          expect.objectContaining({ appId: "app-1", filterExpr: null }),
        );
      }
    });

    it("is kept when the filter changes", async () => {
      mockRouter.setUrl("?jt=Exceptions");
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        filter_expr: "version_name:in:1.2.0",
        jt: "Exceptions",
      });
      expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterExpr: "version_name:in:1.2.0" }),
      );
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
    });

    it("is kept when the filter is cleared", async () => {
      mockRouter.setUrl("?jt=Exceptions&filter_expr=version_name%3Ain%3A1.2.0");
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, jt: "Exceptions" });
      expect(screen.getByTestId("journey-mock-Exceptions")).toBeInTheDocument();
    });
  });

  it("refetches for the app the bar switches to", async () => {
    journeyLoaded();
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId("filter-bar-switch-app"));
    });

    expect(mockRouter.urlParams()).toEqual({ a: "app-2", d: "Last 6 Hours" });
    expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: mockOtherApp.id, filterExpr: null }),
    );
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
      mockRouter.setUrl("?filter_expr=version_name%3Ain%3A1.2.0");
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

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      journeyLoaded();
    });

    it("is said by the page, in place of the journey", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("journey-mock-Paths")).toBeNull();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseJourneyQuery).toHaveBeenLastCalledWith(null);
    });

    it("leaves the URL where the link had it", () => {
      renderPage();

      expect(mockRouter.urlParams()).toEqual(settled);
    });
  });
});
