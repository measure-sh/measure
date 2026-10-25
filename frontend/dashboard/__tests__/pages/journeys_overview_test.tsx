import { mockFiltersStore } from "@/__tests__/helpers/mock_filters_store";
import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

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
  SkeletonPlot: () => <div data-testid="skeleton-plot-mock" />,
}));

// The graph stub lists its nodes and offers buttons that select the first
// node or the first link, or clear the selection, the way clicks on the real
// graph do.
jest.mock("@/app/components/journey/graph", () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="journey-graph-mock"
      data-nodes={props.journey.nodes.map((n: any) => n.id).join(",")}
      data-selection={JSON.stringify(props.selection)}
    >
      <button
        onClick={() => props.onSelect({ node: props.journey.nodes[0].id })}
      >
        select node
      </button>
      <button
        onClick={() =>
          props.onSelect({
            source: props.journey.links[0].source,
            target: props.journey.links[0].target,
          })
        }
      >
        select link
      </button>
      <button onClick={() => props.onSelect(null)}>clear selection</button>
      {props.toolbarStart}
      {props.toolbarEnd}
      {props.placeholder}
      <p>{props.summary}</p>
    </div>
  ),
}));

jest.mock("@/app/components/journey/selection_details", () => ({
  __esModule: true,
  detailsUrlKeys: [],
  default: (props: any) => (
    <div
      data-testid="selection-details-mock"
      data-team={props.teamId}
      data-app={props.params.appId}
      data-selection={JSON.stringify(props.selection)}
    />
  ),
}));

import JourneysPage from "@/app/[teamId]/journeys/page";
import { ApiError, invalidFilterExpr } from "@/app/api/api_error";

const mockApp = { id: "app-1", name: "Sample", onboarded: true };
const mockOtherApp = { id: "app-2", name: "Other", onboarded: true };

const versionKey = {
  name: "version_name",
  label: "App version",
  key_group: "Version",
  description: "The app version",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

function journeyNode(id: string, step: number) {
  return {
    id,
    name: id,
    kind: "screen",
    step,
    users: 100,
    continuing: 50,
    median_ms_from_previous: null,
  };
}

const mockJourneyData = {
  nodes: [journeyNode("MainActivity", 0), journeyNode("CartActivity", 1)],
  links: [{ source: "MainActivity", target: "CartActivity", users: 40 }],
  sample_percent: 100,
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
  return render(<JourneysPage params={promiseParams({ teamId: "123" })} />);
}

describe("Journeys page", () => {
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

  it("draws the journey once ready", () => {
    journeyLoaded();
    renderPage();

    expect(screen.getByTestId("journey-graph-mock")).toHaveAttribute(
      "data-nodes",
      "MainActivity,CartActivity",
    );
    expect(screen.queryByTestId("skeleton-plot-mock")).toBeNull();
  });

  it("shows a skeleton in the graph while the journey loads", () => {
    renderPage();

    expect(
      within(screen.getByTestId("journey-graph-mock")).getByTestId(
        "skeleton-plot-mock",
      ),
    ).toBeInTheDocument();
  });

  it("shows a skeleton in the graph while another journey loads", () => {
    mockUseJourneyQuery.mockReturnValue({
      data: mockJourneyData,
      status: "success",
      isFetching: true,
      isPlaceholderData: true,
      error: null,
    } as any);
    renderPage();

    expect(
      within(screen.getByTestId("journey-graph-mock")).getByTestId(
        "skeleton-plot-mock",
      ),
    ).toBeInTheDocument();
  });

  it("says in the graph that no journeys were found when the journey has no nodes", () => {
    journeyLoaded({ nodes: [], links: [], sample_percent: 100 });
    renderPage();

    expect(
      within(screen.getByTestId("journey-graph-mock")).getByText(
        "No journeys found",
      ),
    ).toBeInTheDocument();
  });

  it("shows the sample percent when the journey has no nodes", () => {
    journeyLoaded({ nodes: [], links: [], sample_percent: 100 });
    renderPage();

    expect(screen.getByText("Sampled at: 100%")).toBeInTheDocument();
  });

  describe("the selection", () => {
    it("shows no details until something is selected", () => {
      journeyLoaded();
      renderPage();

      expect(screen.getByTestId("journey-graph-mock")).toHaveAttribute(
        "data-selection",
        "null",
      );
      expect(screen.queryByTestId("selection-details-mock")).toBeNull();
    });

    it("shows the details of a selected node for the team and app", async () => {
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByText("select node"));
      });

      const selection = JSON.stringify({ node: "MainActivity" });
      expect(screen.getByTestId("journey-graph-mock")).toHaveAttribute(
        "data-selection",
        selection,
      );
      const details = screen.getByTestId("selection-details-mock");
      expect(details).toHaveAttribute("data-selection", selection);
      expect(details).toHaveAttribute("data-team", "123");
      expect(details).toHaveAttribute("data-app", "app-1");
    });

    it("replaces a selected node with a selected link", async () => {
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByText("select node"));
      });
      await act(async () => {
        fireEvent.click(screen.getByText("select link"));
      });

      expect(screen.getByTestId("selection-details-mock")).toHaveAttribute(
        "data-selection",
        JSON.stringify({ source: "MainActivity", target: "CartActivity" }),
      );
    });

    it("hides the details when the selection is cleared", async () => {
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByText("select node"));
      });
      await act(async () => {
        fireEvent.click(screen.getByText("clear selection"));
      });

      expect(screen.queryByTestId("selection-details-mock")).toBeNull();
    });

    it("is cleared when the filter changes", async () => {
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByText("select node"));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(screen.getByTestId("journey-graph-mock")).toHaveAttribute(
        "data-selection",
        "null",
      );
      expect(screen.queryByTestId("selection-details-mock")).toBeNull();
    });

    it("is written to the URL", async () => {
      journeyLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByText("select link"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        js: "MainActivity",
        jt: "CartActivity",
      });
    });
  });

  describe("the shown nodes", () => {
    // 30 screens, where S0 has the most users and S29 the fewest.
    const manyNodes = {
      nodes: Array.from({ length: 30 }, (_, i) => ({
        ...journeyNode(`S${i}`, i),
        users: 100 - i,
      })),
      links: [{ source: "S0", target: "S1", users: 40 }],
      sample_percent: 100,
    };
    const shownNodes = () =>
      screen
        .getByTestId("journey-graph-mock")
        .getAttribute("data-nodes")!
        .split(",");

    it("are the 25 nodes with the most users by default", () => {
      journeyLoaded(manyNodes);
      renderPage();

      expect(shownNodes()).toHaveLength(25);
      expect(shownNodes()).toContain("S24");
      expect(shownNodes()).not.toContain("S25");
      expect(screen.getByText("25 of 30 nodes")).toBeInTheDocument();
    });

    it("change with the nodes the user selects and clear the selection", async () => {
      journeyLoaded(manyNodes);
      renderPage();
      await act(async () => {
        fireEvent.click(screen.getByText("select node"));
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Select Nodes"));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("option", { name: "S29" }));
      });

      await waitFor(() => expect(shownNodes()).toContain("S29"));
      expect(screen.getByText("26 of 30 nodes")).toBeInTheDocument();
      expect(screen.queryByTestId("selection-details-mock")).toBeNull();
    });

    it("say so in the graph when the user selects none", async () => {
      journeyLoaded(manyNodes);
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByText("Select Nodes"));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      });

      expect(
        await within(screen.getByTestId("journey-graph-mock")).findByText(
          "No nodes shown",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows the percent of users the journey read", () => {
    journeyLoaded({ ...mockJourneyData, sample_percent: 2.534 });
    renderPage();

    expect(screen.getByText("Sampled at: 2.5%")).toBeInTheDocument();
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
    expect(screen.getByTestId("journey-graph-mock")).toBeInTheDocument();
  });

  describe("when the journey request fails", () => {
    it("shows the error message", () => {
      journeyFailed(new Error("fail"));
      renderPage();

      expect(
        within(screen.getByTestId("journey-graph-mock")).getByText(
          /Error fetching journey/,
        ),
      ).toBeInTheDocument();
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
      expect(screen.queryByTestId("journey-graph-mock")).toBeNull();
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
      expect(screen.queryByTestId("journey-graph-mock")).toBeNull();
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
