import { mockRouter } from "@/__tests__/helpers/mock_router";
import { ApiError, invalidFilterExpr } from "@/app/api/api_error";
import type {
  Journey,
  JourneyNode,
  JourneySelection,
} from "@/app/api/api_calls";
import type { FilterChange } from "@/app/components/filter_bar/filter_bar";
import JourneysOverview from "@/app/components/journey/overview";
import { encodeNodeIds } from "@/app/components/journey/url_state";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";

type GraphProps = {
  journey: Journey;
  selection: JourneySelection | null;
  onSelect: (selection: JourneySelection | null) => void;
  toolbarStart: React.ReactNode;
  placeholder?: React.ReactNode;
  summary: React.ReactNode[];
};
type PickerProps = {
  items: { value: string; label: string }[];
  initialSelected: string[];
  disabled: boolean;
  onChangeSelected: (ids: string[]) => Promise<void>;
};
type FilterBarProps = {
  filterExprIssues: unknown;
  onChange: (change: FilterChange) => void;
};
type DetailsProps = {
  params: unknown;
  journey: Journey;
  selection: JourneySelection;
};
type JourneyQuery = {
  status: "pending" | "error" | "success";
  data: Journey | undefined;
  error: unknown;
  isPlaceholderData: boolean;
};

let mockFilterPage: ReturnType<typeof filterPage>;
let mockJourneyQuery: JourneyQuery;
let mockJourneyParams: unknown;
let mockGraph: GraphProps | undefined;
let mockPicker: PickerProps;
let mockFilterBar: FilterBarProps;
let mockDetails: DetailsProps | undefined;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  __esModule: true,
  useFilterPage: () => mockFilterPage,
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: FilterBarProps) => {
    mockFilterBar = props;
    return null;
  },
}));

jest.mock("@/app/query/hooks", () => ({
  ...jest.requireActual("@/app/query/hooks"),
  useJourneyQuery: (params: unknown) => {
    mockJourneyParams = params;
    return mockJourneyQuery;
  },
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonPlot: () => <div data-testid="skeleton-plot" />,
  SkeletonListPage: () => <div data-testid="skeleton-list-page" />,
}));

jest.mock("@/app/components/journey/graph", () => ({
  __esModule: true,
  default: (props: GraphProps) => {
    mockGraph = props;
    return (
      <div data-testid="graph">
        {props.toolbarStart}
        {props.placeholder}
        {props.summary}
      </div>
    );
  },
}));

jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  ...jest.requireActual("@/app/components/dropdown_select"),
  default: (props: PickerProps) => {
    mockPicker = props;
    return null;
  },
}));

jest.mock("@/app/components/journey/selection_details", () => ({
  __esModule: true,
  ...jest.requireActual("@/app/components/journey/selection_details"),
  default: (props: DetailsProps) => {
    mockDetails = props;
    return <div data-testid="selection-details" />;
  },
}));

const filterParams = (appId: string, startDate: string) => ({
  appId,
  startDate,
  endDate: "2026-10-31T00:00:00Z",
  filterExpr: null,
});

function filterPage(
  appId = "app-1",
  startDate = "2026-10-01T00:00:00Z",
  status: Record<string, unknown> = { kind: "ready" },
) {
  return {
    value: { app: { id: appId } },
    apps: [{ id: "app-1" }, { id: "app-2" }],
    keys: [],
    keyGroups: [],
    keysUnavailable: false,
    status,
    filterParams:
      status.kind === "ready" ? filterParams(appId, startDate) : null,
    onChange: jest.fn(),
    setPageUrlKeys: mockRouter.setPageUrlKeys,
    discardPageUrlKeys: mockRouter.discardPageUrlKeys,
  };
}

const node = (name: string, users: number, kind = "screen"): JourneyNode => ({
  id: kind === "fatal" ? "fatal" : `${kind}:${name}`,
  name,
  kind: kind as JourneyNode["kind"],
  step: 0,
  users,
  continuing: 0,
  median_ms_from_previous: null,
});

const journeyOf = (names: string[]): Journey => ({
  nodes: names.map((name, i) => node(name, 100 - i)),
  links: [],
  sample_percent: 100,
});

const loaded = (journey: Journey): JourneyQuery => ({
  status: "success",
  data: journey,
  error: null,
  isPlaceholderData: false,
});

const shownIds = () => mockGraph!.journey.nodes.map((node) => node.id);

const renderOverview = () => {
  const view = render(<JourneysOverview teamId="team-1" />);
  return (
    appId: string,
    journey: Journey,
    startDate = "2026-10-01T00:00:00Z",
  ) => {
    mockFilterPage = filterPage(appId, startDate);
    mockJourneyQuery = loaded(journey);
    view.rerender(<JourneysOverview teamId="team-1" />);
  };
};

// Picking nodes encodes them before writing the URL, which finishes after the
// picker's change.
const pick = (ids: string[]) =>
  act(async () => {
    await mockPicker.onChangeSelected(ids);
  });

beforeEach(() => {
  mockRouter.reset();
  mockFilterPage = filterPage();
  mockJourneyQuery = loaded(journeyOf(["Home", "Cart", "Checkout"]));
  mockJourneyParams = undefined;
  mockGraph = undefined;
  mockDetails = undefined;
});

describe("JourneysOverview filters", () => {
  it("reads the journey of the filters", () => {
    renderOverview();

    expect(mockJourneyParams).toEqual(
      filterParams("app-1", "2026-10-01T00:00:00Z"),
    );
  });

  it("shows a list skeleton and no graph while the filters load", () => {
    mockFilterPage = filterPage("app-1", "2026-10-01T00:00:00Z", {
      kind: "loading",
    });
    renderOverview();

    expect(screen.getByTestId("skeleton-list-page")).toBeInTheDocument();
    expect(screen.queryByTestId("graph")).not.toBeInTheDocument();
  });

  it("shows the filter error and no graph when the filters fail", () => {
    mockFilterPage = filterPage("app-1", "2026-10-01T00:00:00Z", {
      kind: "error",
      message: "Error fetching apps, please refresh page to try again",
    });
    renderOverview();

    expect(
      screen.getByText("Error fetching apps, please refresh page to try again"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("graph")).not.toBeInTheDocument();
  });

  it("gives the filter bar the issues of a refused filter and hides the graph", () => {
    const issues = [{ message: "unknown key", span: { start: 0, end: 3 } }];
    mockJourneyQuery = {
      status: "error",
      data: undefined,
      error: new ApiError(400, invalidFilterExpr, issues),
      isPlaceholderData: false,
    };
    renderOverview();

    expect(mockFilterBar.filterExprIssues).toEqual(issues);
    expect(screen.queryByTestId("graph")).not.toBeInTheDocument();
  });

  it("passes a filter change on and clears the selection", () => {
    renderOverview();
    act(() => mockGraph!.onSelect({ node: "screen:Home" }));
    expect(mockGraph!.selection).toEqual({ node: "screen:Home" });

    const change = { filterExpr: "os_name = 'android'" };
    act(() => mockFilterBar.onChange(change));

    expect(mockFilterPage.onChange).toHaveBeenCalledWith(change);
    expect(mockGraph!.selection).toBeNull();
  });
});

describe("JourneysOverview graph placeholder", () => {
  it("shows a skeleton and disables the node picker while the journey loads", () => {
    mockJourneyQuery = {
      status: "pending",
      data: undefined,
      error: null,
      isPlaceholderData: false,
    };
    renderOverview();

    expect(screen.getByTestId("skeleton-plot")).toBeInTheDocument();
    expect(mockPicker.disabled).toBe(true);
  });

  it("shows a skeleton over the journey of the previous filters", () => {
    mockJourneyQuery = {
      ...loaded(journeyOf(["Home"])),
      isPlaceholderData: true,
    };
    renderOverview();

    expect(screen.getByTestId("skeleton-plot")).toBeInTheDocument();
  });

  it("shows the fallback message when the journey fails", () => {
    mockJourneyQuery = {
      status: "error",
      data: undefined,
      error: new Error("network down"),
      isPlaceholderData: false,
    };
    renderOverview();

    expect(
      screen.getByText(
        "Error fetching journey. Please refresh page or change filters to try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the server's message when the journey is over the query limits", () => {
    mockJourneyQuery = {
      status: "error",
      data: undefined,
      error: new ApiError(422, "The journey needs too much memory"),
      isPlaceholderData: false,
    };
    renderOverview();

    expect(
      screen.getByText("The journey needs too much memory"),
    ).toBeInTheDocument();
  });

  it("says no journeys were found when the journey has no nodes", () => {
    mockJourneyQuery = loaded(journeyOf([]));
    renderOverview();

    expect(screen.getByText("No journeys found")).toBeInTheDocument();
  });

  it("says no journeys were found when the only node is the fatal error node", () => {
    mockJourneyQuery = loaded({
      ...journeyOf([]),
      nodes: [node("Fatal error", 5, "fatal")],
    });
    renderOverview();

    expect(screen.getByText("No journeys found")).toBeInTheDocument();
  });

  it("says no nodes are shown when the user picks none", async () => {
    renderOverview();
    await pick([]);

    expect(screen.getByText("No nodes shown")).toBeInTheDocument();
  });

  it("has no placeholder when nodes are shown", () => {
    renderOverview();

    expect(mockGraph!.placeholder).toBeUndefined();
  });
});

describe("JourneysOverview nodes", () => {
  it("shows the 25 nodes with the most users until the user picks nodes", () => {
    const names = Array.from({ length: 30 }, (_, i) => `S${i}`);
    mockJourneyQuery = loaded({
      ...journeyOf(names),
      nodes: names.map((name, i) => node(name, i + 1)),
    });
    renderOverview();

    expect(shownIds()).toHaveLength(25);
    expect(shownIds()).not.toContain("screen:S0");
    expect(shownIds()).toContain("screen:S29");
    expect(mockPicker.initialSelected).toHaveLength(25);
    expect(screen.getByText("25 of 30 nodes")).toBeInTheDocument();
  });

  it("offers the screens and custom events by short name, without the fatal error node", () => {
    mockJourneyQuery = loaded({
      nodes: [
        node("com.acme.HomeActivity", 10),
        node("checkout_started", 8, "event"),
        node("Fatal error", 5, "fatal"),
      ],
      links: [],
      sample_percent: 100,
    });
    renderOverview();

    expect(mockPicker.items.map((item) => [item.value, item.label])).toEqual([
      ["screen:com.acme.HomeActivity", "HomeActivity"],
      ["event:checkout_started", "checkout_started"],
    ]);
    expect(screen.getByText("2 of 2 nodes")).toBeInTheDocument();
  });

  it("shows the fatal error node when a shown node links to it", async () => {
    mockJourneyQuery = loaded({
      nodes: [
        node("Home", 10),
        node("Cart", 8),
        node("Fatal error", 5, "fatal"),
      ],
      links: [
        { source: "screen:Home", target: "screen:Cart", users: 6 },
        { source: "screen:Cart", target: "fatal", users: 5 },
      ],
      sample_percent: 100,
    });
    renderOverview();
    await pick(["screen:Cart"]);

    expect(shownIds()).toEqual(["screen:Cart", "fatal"]);
    expect(mockGraph!.journey.links).toEqual([
      { source: "screen:Cart", target: "fatal", users: 5 },
    ]);
  });

  it("shows only the picked nodes and clears the selection", async () => {
    renderOverview();
    act(() => mockGraph!.onSelect({ node: "screen:Cart" }));

    await pick(["screen:Home"]);

    expect(shownIds()).toEqual(["screen:Home"]);
    expect(mockGraph!.selection).toBeNull();
    expect(screen.getByText("1 of 3 nodes")).toBeInTheDocument();
  });

  it("shows the sample percent of the journey", () => {
    mockJourneyQuery = loaded({ ...journeyOf(["Home"]), sample_percent: 25 });
    renderOverview();

    expect(screen.getByText("Sampled at: 25%")).toBeInTheDocument();
  });
});

describe("JourneysOverview selection details", () => {
  it("shows no details without a selection", () => {
    renderOverview();

    expect(screen.queryByTestId("selection-details")).not.toBeInTheDocument();
  });

  it("shows the details of a selection with the shown journey and the filters", async () => {
    mockJourneyQuery = loaded({
      ...journeyOf(["Home", "Cart", "Checkout"]),
      links: [{ source: "screen:Home", target: "screen:Cart", users: 6 }],
    });
    renderOverview();
    await pick(["screen:Home", "screen:Cart"]);
    act(() => mockGraph!.onSelect({ path: ["screen:Home", "screen:Cart"] }));

    expect(screen.getByTestId("selection-details")).toBeInTheDocument();
    expect(mockDetails!.selection).toEqual({
      path: ["screen:Home", "screen:Cart"],
    });
    expect(mockDetails!.journey.nodes.map((node) => node.id)).toEqual([
      "screen:Home",
      "screen:Cart",
    ]);
    expect(mockDetails!.params).toEqual(
      filterParams("app-1", "2026-10-01T00:00:00Z"),
    );
  });

  it("closes the details when the selection is cleared", () => {
    renderOverview();
    act(() => mockGraph!.onSelect({ node: "screen:Home" }));
    act(() => mockGraph!.onSelect(null));

    expect(screen.queryByTestId("selection-details")).not.toBeInTheDocument();
  });
});

describe("JourneysOverview app switch", () => {
  it("shows the new app's nodes and clears the selection when another app is picked", async () => {
    const show = renderOverview();
    await pick(["screen:Home"]);
    act(() => mockGraph!.onSelect({ node: "screen:Home" }));
    expect(shownIds()).toEqual(["screen:Home"]);

    act(() => mockFilterBar.onChange({ appId: "app-2" }));
    show("app-2", journeyOf(["Feed", "Profile"]));

    expect(shownIds()).toEqual(["screen:Feed", "screen:Profile"]);
    expect(mockPicker.initialSelected).toEqual([
      "screen:Feed",
      "screen:Profile",
    ]);
    expect(mockGraph!.selection).toBeNull();
  });

  it("does not bring the picked nodes back after switching to another app and back", async () => {
    const show = renderOverview();
    await pick(["screen:Home"]);

    act(() => mockFilterBar.onChange({ appId: "app-2" }));
    show("app-2", journeyOf(["Feed", "Profile"]));
    act(() => mockFilterBar.onChange({ appId: "app-1" }));
    show("app-1", journeyOf(["Home", "Cart", "Checkout"]));

    expect(shownIds()).toEqual([
      "screen:Home",
      "screen:Cart",
      "screen:Checkout",
    ]);
  });

  it("keeps the picked nodes that a new date range has", async () => {
    const show = renderOverview();
    await pick(["screen:Home", "screen:Cart"]);

    act(() =>
      mockFilterBar.onChange({
        dateRange: {
          dateRange: "Custom",
          startDate: "2026-10-20T00:00:00Z",
          endDate: "2026-10-31T00:00:00Z",
        },
      } as FilterChange),
    );
    show("app-1", journeyOf(["Home", "Checkout"]), "2026-10-20T00:00:00Z");

    expect(shownIds()).toEqual(["screen:Home"]);
  });
});

describe("JourneysOverview URL state", () => {
  const linked: Journey = {
    nodes: [node("Home", 100), node("Cart", 90), node("Checkout", 80)],
    links: [
      { source: "screen:Home", target: "screen:Cart", users: 60 },
      { source: "screen:Cart", target: "screen:Checkout", users: 40 },
    ],
    sample_percent: 100,
  };

  beforeEach(() => {
    mockJourneyQuery = loaded(linked);
  });

  it.each([
    ["a node", "jn=screen:Cart", { node: "screen:Cart" }],
    [
      "a link",
      "js=screen:Home&jt=screen:Cart",
      { source: "screen:Home", target: "screen:Cart" },
    ],
    [
      "a path",
      "jp=screen:Home&jp=screen:Cart&jp=screen:Checkout",
      { path: ["screen:Home", "screen:Cart", "screen:Checkout"] },
    ],
  ])("restores %s from the URL", (_, search, expected) => {
    mockRouter.setUrl(search);
    renderOverview();

    expect(mockGraph!.selection).toEqual(expected);
    expect(mockDetails!.selection).toEqual(expected);
  });

  it.each([
    ["a node the journey doesn't have", "jn=screen:Profile"],
    ["a link the journey doesn't have", "js=screen:Home&jt=screen:Checkout"],
    ["a link without a target", "js=screen:Home"],
    [
      "a path with a step the journey has no link for",
      "jp=screen:Home&jp=screen:Checkout",
    ],
    ["a path of one node", "jp=screen:Home"],
  ])("ignores %s in the URL and removes it with its lists", (_, search) => {
    mockRouter.setUrl(`${search}&jl=Traces&jot=5&d=Last+7+Days`);
    renderOverview();

    expect(mockGraph!.selection).toBeNull();
    expect(screen.queryByTestId("selection-details")).not.toBeInTheDocument();
    expect(mockRouter.urlParams()).toEqual({ d: "Last 7 Days" });
  });

  it("removes the keys of other selections and keeps the one it uses", () => {
    mockRouter.setUrl(
      "jn=screen:Cart&js=screen:Home&jt=screen:Cart&jp=screen:Home&jl=Traces",
    );
    renderOverview();

    expect(mockGraph!.selection).toEqual({ node: "screen:Cart" });
    expect(mockRouter.urlParams()).toEqual({
      jn: "screen:Cart",
      jl: "Traces",
    });
  });

  it("removes the lists of a selection when the URL has no selection", () => {
    mockRouter.setUrl("jl=Traces&jq=p95&joe=5");
    renderOverview();

    expect(mockRouter.urlParams()).toEqual({});
  });

  it.each([
    [
      "loads",
      {
        status: "pending" as const,
        data: undefined,
        error: null,
        isPlaceholderData: false,
      },
    ],
    [
      "fails",
      {
        status: "error" as const,
        data: undefined,
        error: new Error("network down"),
        isPlaceholderData: false,
      },
    ],
    [
      "is still the one of the previous filters",
      { ...loaded(journeyOf(["Home"])), isPlaceholderData: true },
    ],
  ])("keeps a selection in the URL while the journey %s", (_, query) => {
    mockJourneyQuery = query;
    mockRouter.setUrl("jn=screen:Cart&jl=Traces");
    renderOverview();

    expect(mockRouter.urlParams()).toEqual({ jn: "screen:Cart", jl: "Traces" });
  });

  it("keeps a selection in the URL until the picked nodes are read", async () => {
    mockRouter.setUrl(
      `jk=${await encodeNodeIds(["screen:Cart"])}&jn=screen:Cart`,
    );
    renderOverview();
    expect(mockRouter.urlParams().jn).toBe("screen:Cart");

    await waitFor(() =>
      expect(mockGraph!.selection).toEqual({ node: "screen:Cart" }),
    );
    expect(mockRouter.urlParams().jn).toBe("screen:Cart");
  });

  it("keeps picked nodes the journey doesn't have in the URL", async () => {
    const value = await encodeNodeIds(["screen:Cart", "screen:Profile"]);
    mockRouter.setUrl(`jk=${value}`);
    renderOverview();

    await waitFor(() => expect(shownIds()).toEqual(["screen:Cart"]));
    expect(mockRouter.urlParams()).toEqual({ jk: value });
  });

  it("writes a selection to the URL and starts its lists over", () => {
    mockRouter.setUrl("jn=screen:Home&jl=Traces&jq=p95&jot=10&d=Last+7+Days");
    renderOverview();

    act(() => mockGraph!.onSelect({ path: ["screen:Home", "screen:Cart"] }));

    expect(mockRouter.urlParams()).toEqual({
      d: "Last 7 Days",
      jp: "screen:Cart",
    });
    expect(new URLSearchParams(window.location.search).getAll("jp")).toEqual([
      "screen:Home",
      "screen:Cart",
    ]);
    expect(mockGraph!.selection).toEqual({
      path: ["screen:Home", "screen:Cart"],
    });
  });

  it("keeps the lists in the URL when the selected link is selected again", () => {
    mockRouter.setUrl("js=screen:Home&jt=screen:Cart&jl=Traces&jq=p95&jot=5");
    renderOverview();

    act(() =>
      mockGraph!.onSelect({ source: "screen:Home", target: "screen:Cart" }),
    );

    expect(mockRouter.urlParams()).toEqual({
      js: "screen:Home",
      jt: "screen:Cart",
      jl: "Traces",
      jq: "p95",
      jot: "5",
    });
  });

  it("starts the lists over when a path of the selected link's nodes is selected", () => {
    mockRouter.setUrl("js=screen:Home&jt=screen:Cart&jl=Traces");
    renderOverview();

    act(() => mockGraph!.onSelect({ path: ["screen:Home", "screen:Cart"] }));

    expect(mockRouter.urlParams()).toEqual({ jp: "screen:Cart" });
  });

  it("removes the selection and its lists from the URL when it is cleared", () => {
    mockRouter.setUrl("jn=screen:Home&jl=Traces&jos=5");
    renderOverview();

    act(() => mockGraph!.onSelect(null));

    expect(mockRouter.urlParams()).toEqual({});
  });

  it("removes the selection and keeps the picked nodes when the filters change", async () => {
    renderOverview();
    await pick(["screen:Home", "screen:Cart"]);
    act(() => mockGraph!.onSelect({ node: "screen:Home" }));
    const picked = mockRouter.urlParams().jk;

    act(() => mockFilterBar.onChange({ filterExpr: "os_name:eq:android" }));

    expect(mockRouter.urlParams()).toEqual({ jk: picked });
  });

  it("removes the picked nodes from the URL when the app changes", async () => {
    renderOverview();
    await pick(["screen:Home"]);

    act(() => mockFilterBar.onChange({ appId: "app-2" }));

    expect(mockRouter.urlParams()).toEqual({});
  });

  it("restores the picked nodes from the URL, with a skeleton until they are read", async () => {
    mockRouter.setUrl(`jk=${await encodeNodeIds(["screen:Checkout"])}`);
    renderOverview();

    expect(screen.getByTestId("skeleton-plot")).toBeInTheDocument();
    expect(mockPicker.disabled).toBe(true);

    await waitFor(() => expect(shownIds()).toEqual(["screen:Checkout"]));
    expect(mockPicker.initialSelected).toEqual(["screen:Checkout"]);
    expect(mockPicker.disabled).toBe(false);
  });

  it("restores a selection of picked nodes outside the nodes shown first", async () => {
    const names = Array.from({ length: 30 }, (_, i) => `S${i}`);
    mockJourneyQuery = loaded({
      nodes: names.map((name, i) => node(name, 100 - i)),
      links: [{ source: "screen:S28", target: "screen:S29", users: 1 }],
      sample_percent: 100,
    });
    mockRouter.setUrl(
      `jk=${await encodeNodeIds(["screen:S28", "screen:S29"])}&js=screen:S28&jt=screen:S29`,
    );
    renderOverview();

    await waitFor(() =>
      expect(mockGraph!.selection).toEqual({
        source: "screen:S28",
        target: "screen:S29",
      }),
    );
  });

  it("writes the picked nodes to the URL so they are restored", async () => {
    const view = render(<JourneysOverview teamId="team-1" />);
    await pick(["screen:Checkout", "screen:Home"]);
    view.unmount();

    renderOverview();

    await waitFor(() =>
      expect(shownIds()).toEqual(["screen:Home", "screen:Checkout"]),
    );
  });

  it("shows the nodes with the most users for picked nodes it can't read, and removes them", async () => {
    mockRouter.setUrl("jk=not-deflate");
    renderOverview();

    await waitFor(() => expect(mockRouter.urlParams()).toEqual({}));
    expect(shownIds()).toEqual([
      "screen:Home",
      "screen:Cart",
      "screen:Checkout",
    ]);
    expect(mockPicker.disabled).toBe(false);
  });

  it("writes only the last of two quick picks", async () => {
    renderOverview();

    await act(async () => {
      const first = mockPicker.onChangeSelected(["screen:Home"]);
      const second = mockPicker.onChangeSelected(["screen:Cart"]);
      await Promise.all([first, second]);
    });

    expect(shownIds()).toEqual(["screen:Cart"]);
  });
});
