import type { Funnel } from "@/app/api/api_calls";
import { ApiError } from "@/app/api/api_error";
import type FunnelEditor from "@/app/components/funnel/editor";
import FunnelsOverview from "@/app/components/funnel/overview";
import type FunnelPinnedCard from "@/app/components/funnel/pinned_card";
import type { FunnelPinButton } from "@/app/components/funnel/pinned_card";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DateTime, Settings } from "luxon";

type EditorProps = React.ComponentProps<typeof FunnelEditor>;
type PinnedCardProps = React.ComponentProps<typeof FunnelPinnedCard>;
type PinButtonProps = React.ComponentProps<typeof FunnelPinButton>;

const mockPush = jest.fn();
const mockSetPageUrlKey = jest.fn();
const mockUseFunnelsQuery = jest.fn();
const mockUsePinnedFunnelsQuery = jest.fn();
const mockSetPinnedMutateAsync = jest.fn();
const mockReorderMutateAsync = jest.fn();
const mockToastNegative = jest.fn();
const mockUseAuthzAndMembersQuery = jest.fn();
let mockSearchParams = new URLSearchParams();
let mockFilterPage: ReturnType<typeof readyFilterPage>;
let mockSetPinned: {
  isPending: boolean;
  variables: { appId: string; funnelId: string; pinned: boolean } | undefined;
  mutateAsync: typeof mockSetPinnedMutateAsync;
};
let mockEditorProps: EditorProps | undefined;
let mockCardProps: Record<string, PinnedCardProps>;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: () => <div data-testid="filter-bar-mock" />,
}));

jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  __esModule: true,
  useFilterPage: () => mockFilterPage,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  FUNNELS_LIMIT: 5,
  paginationOffsetUrlKey: "po",
  useAuthzAndMembersQuery: (...args: unknown[]) =>
    mockUseAuthzAndMembersQuery(...args),
  useFunnelsQuery: (...args: unknown[]) => mockUseFunnelsQuery(...args),
  usePinnedFunnelsQuery: (...args: unknown[]) =>
    mockUsePinnedFunnelsQuery(...args),
  useSetFunnelPinnedMutation: () => mockSetPinned,
  useReorderPinnedFunnelsMutation: () => ({
    mutateAsync: mockReorderMutateAsync,
  }),
}));

const trackMock = jest.fn();
jest.mock("@/app/utils/analytics/track", () => ({
  __esModule: true,
  track: (...args: unknown[]) => trackMock(...args),
}));

jest.mock("@/app/components/toast", () => ({
  toastNegative: (...args: unknown[]) => mockToastNegative(...args),
}));

jest.mock("@/app/components/loading_bar", () => ({
  __esModule: true,
  default: () => <div data-testid="loading-bar-mock" />,
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: () => <div data-testid="skeleton-mock" />,
  SkeletonTable: () => <div data-testid="skeleton-table-mock" />,
}));

jest.mock("@/app/components/funnel/editor", () => ({
  __esModule: true,
  default: (props: EditorProps) => {
    mockEditorProps = props;
    return props.open ? <div data-testid="funnel-editor-mock" /> : null;
  },
}));

jest.mock("@/app/components/funnel/pinned_card", () => ({
  __esModule: true,
  default: (props: PinnedCardProps) => {
    mockCardProps[props.funnel.id] = props;
    return (
      <div data-testid="pinned-card-mock">
        <p>{props.funnel.name}</p>
        <button disabled={props.isFirst} onClick={props.onMoveUp}>
          Move up
        </button>
        <button disabled={props.isLast} onClick={props.onMoveDown}>
          Move down
        </button>
        <button onClick={props.onUnpin}>Unpin card</button>
      </div>
    );
  },
  FunnelPinButton: ({ pinned, disabled, onClick }: PinButtonProps) => (
    <button
      aria-label={pinned ? "Unpin funnel" : "Pin funnel"}
      disabled={disabled}
      onClick={onClick}
    />
  ),
}));

// FunnelSteps measures its layout with ResizeObserver, which jsdom lacks.
jest.mock("@/app/components/funnel/steps", () => ({
  __esModule: true,
  default: ({ funnel }: { funnel: Funnel }) => (
    <div>{funnel.steps.map((step) => step.event_name).join(" > ")}</div>
  ),
}));

const makeFunnel = (overrides: Partial<Funnel>): Funnel => ({
  id: "funnel-id",
  app_id: "app-1",
  name: "Funnel",
  steps: [{ event_name: "app_open" }, { event_name: "purchase" }],
  conversion_window_seconds: 3_600,
  pinned: false,
  pin_order: null,
  created_by: "user-1",
  created_by_email: "ana@example.com",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-10-06T12:00:00Z",
  ...overrides,
});

const checkout = makeFunnel({
  id: "f-checkout",
  name: "Checkout flow",
  pinned: true,
  pin_order: 0,
});
const signup = makeFunnel({
  id: "f-signup",
  name: "Signup",
  steps: [
    { event_name: "app_open" },
    { event_name: "signup_start" },
    { event_name: "signup_done" },
  ],
  conversion_window_seconds: 172_800,
  created_by: null,
  created_by_email: null,
});
const onboarding = makeFunnel({
  id: "f-onboarding",
  name: "Onboarding",
  pinned: true,
  pin_order: 1,
});
const search = makeFunnel({
  id: "f-search",
  name: "Search",
  pinned: true,
  pin_order: 2,
});

const filterParams = {
  appId: "app-1",
  startDate: "2026-09-08T12:00:00Z",
  endDate: "2026-10-08T12:00:00Z",
  filterExpr: null,
};

const readyFilterPage = (overrides: Record<string, unknown> = {}) => ({
  value: { app: { id: "app-1", os_names: ["android"] } },
  apps: [
    { id: "app-1", os_names: ["android"] },
    { id: "app-2", os_names: ["ios"] },
  ],
  keys: [],
  keyGroups: [],
  keysUnavailable: false,
  status: { kind: "ready" },
  filterParams,
  paginationOffset: 0,
  onChange: jest.fn(),
  nextPage: jest.fn(),
  prevPage: jest.fn(),
  setPageUrlKey: mockSetPageUrlKey,
  ...overrides,
});

const mockFunnels = (
  results: Funnel[] | undefined,
  overrides: Record<string, unknown> = {},
) =>
  mockUseFunnelsQuery.mockReturnValue({
    data:
      results === undefined
        ? undefined
        : { results, meta: { next: false, previous: false } },
    isPending: false,
    isFetching: false,
    isError: false,
    ...overrides,
  });

const mockPinned = (
  results: Funnel[] | undefined,
  overrides: Record<string, unknown> = {},
) =>
  mockUsePinnedFunnelsQuery.mockReturnValue({
    data: results === undefined ? undefined : { results },
    isPending: false,
    isFetching: false,
    isError: false,
    ...overrides,
  });

const renderOverview = () => render(<FunnelsOverview teamId="team-1" />);

const pinnedCardNames = () =>
  screen
    .queryAllByTestId("pinned-card-mock")
    .map((card) => within(card).getByRole("paragraph").textContent);

const card = (name: string) =>
  screen
    .getAllByTestId("pinned-card-mock")
    .find((el) => within(el).queryByText(name) !== null)!;

const row = (name: string) =>
  screen.getByRole("link", { name }).closest("tr") as HTMLElement;

const originalNow = Settings.now;

beforeAll(() => {
  const now = DateTime.fromISO("2026-10-08T12:00:00Z").toMillis();
  Settings.now = () => now;
});

afterAll(() => {
  Settings.now = originalNow;
});

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  mockFilterPage = readyFilterPage();
  mockSetPinned = {
    isPending: false,
    variables: undefined,
    mutateAsync: mockSetPinnedMutateAsync,
  };
  mockEditorProps = undefined;
  mockCardProps = {};
  mockFunnels([checkout, signup]);
  mockPinned([checkout, onboarding, search]);
  mockUseAuthzAndMembersQuery.mockReturnValue({
    data: { can_change_funnels: true },
  });
});

describe("FunnelsOverview filter states", () => {
  it("shows a table skeleton and nothing app specific while filters load", () => {
    mockFilterPage = readyFilterPage({ status: { kind: "loading" } });
    mockFunnels(undefined, { isPending: true });
    mockPinned(undefined, { isPending: true });
    renderOverview();

    expect(screen.getByTestId("skeleton-table-mock")).toBeInTheDocument();
    expect(mockUseFunnelsQuery).toHaveBeenCalledWith(undefined, "", 0);
    expect(mockUsePinnedFunnelsQuery).toHaveBeenCalledWith(undefined);
    expect(
      screen.queryByRole("button", { name: "Create Funnel" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Pinned Funnels")).not.toBeInTheDocument();
    expect(mockEditorProps).toBeUndefined();
  });

  it("shows the filter error and nothing app specific", () => {
    mockFilterPage = readyFilterPage({
      status: { kind: "error", message: "Error fetching apps" },
    });
    renderOverview();

    expect(screen.getByText("Error fetching apps")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-table-mock")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Pinned Funnels")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create Funnel" }),
    ).not.toBeInTheDocument();
  });
});

describe("FunnelsOverview funnel list states", () => {
  it("shows a table skeleton while the funnels load", () => {
    mockFunnels(undefined, { isPending: true, isFetching: true });
    renderOverview();

    expect(screen.getByTestId("skeleton-table-mock")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByTestId("loading-bar-mock").parentElement).toHaveClass(
      "invisible",
    );
  });

  it("shows the loading bar while a later page loads over the current one", () => {
    mockFunnels([checkout], { isFetching: true });
    renderOverview();

    expect(screen.getByTestId("loading-bar-mock").parentElement).toHaveClass(
      "visible",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("hides the loading bar when nothing is fetching", () => {
    renderOverview();

    expect(screen.getByTestId("loading-bar-mock").parentElement).toHaveClass(
      "invisible",
    );
  });

  it("shows an error when the funnels fail to load", () => {
    mockFunnels(undefined, { isError: true });
    renderOverview();

    expect(
      screen.getByText(
        "Error fetching list of funnels, please change filters, refresh page or select a different app to try again",
      ),
    ).toBeInTheDocument();
  });

  it("shows only the create prompt when the app has no funnels", () => {
    mockFunnels([]);
    mockPinned([]);
    renderOverview();

    expect(screen.getByText("No funnels yet")).toBeInTheDocument();
    expect(screen.queryByText("Pinned Funnels")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Pin a funnel to see it here"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search funnels..."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No funnels match your search"),
    ).not.toBeInTheDocument();
  });

  it("says no funnels match when a search finds none", () => {
    mockSearchParams = new URLSearchParams({ q: "nothing" });
    mockFunnels([]);
    renderOverview();

    expect(
      screen.getByText("No funnels match your search"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No funnels yet")).not.toBeInTheDocument();
    expect(screen.getByText("Pinned Funnels")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search funnels...")).toHaveValue(
      "nothing",
    );
  });

  it("says no funnels match on an empty later page", () => {
    mockFilterPage = readyFilterPage({ paginationOffset: 5 });
    mockFunnels([]);
    renderOverview();

    expect(
      screen.getByText("No funnels match your search"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No funnels yet")).not.toBeInTheDocument();
  });
});

describe("FunnelsOverview funnels table", () => {
  it("shows each funnel's name, steps, window, creator and last update", () => {
    renderOverview();

    const checkoutRow = row("Checkout flow");
    expect(within(checkoutRow).getByText("app_open > purchase")).toBeVisible();
    expect(within(checkoutRow).getByText("1 hour")).toBeInTheDocument();
    expect(
      within(checkoutRow).getByText("ana@example.com"),
    ).toBeInTheDocument();
    expect(within(checkoutRow).getByText("2 days ago")).toBeInTheDocument();

    const signupRow = row("Signup");
    expect(
      within(signupRow).getByText("app_open > signup_start > signup_done"),
    ).toBeInTheDocument();
    expect(within(signupRow).getByText("2 days")).toBeInTheDocument();
    expect(within(signupRow).getByText("Deleted user")).toBeInTheDocument();
  });

  it("links every cell of a row to the funnel", () => {
    renderOverview();

    const hrefs = Array.from(row("Signup").querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toHaveLength(5);
    expect(new Set(hrefs)).toEqual(
      new Set(["/team-1/funnels/app-1/f-signup?from=funnels"]),
    );
  });

  it("opens the funnel when Enter or Space is pressed on a row", () => {
    renderOverview();

    fireEvent.keyDown(row("Checkout flow"), { key: "Enter" });
    fireEvent.keyDown(row("Signup"), { key: " " });
    fireEvent.keyDown(row("Signup"), { key: "a" });

    expect(mockPush.mock.calls).toEqual([
      ["/team-1/funnels/app-1/f-checkout?from=funnels"],
      ["/team-1/funnels/app-1/f-signup?from=funnels"],
    ]);
  });

  it("does not open the funnel when Enter is pressed on the pin button", () => {
    renderOverview();

    fireEvent.keyDown(
      within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
      { key: "Enter" },
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("enables each paginator direction the page meta has a page for", () => {
    mockFunnels([checkout], {
      data: { results: [checkout], meta: { next: true, previous: false } },
    });
    renderOverview();

    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables the paginator while a page is fetching", () => {
    mockFunnels([checkout], {
      data: { results: [checkout], meta: { next: true, previous: true } },
      isFetching: true,
    });
    renderOverview();

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});

describe("FunnelsOverview search", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("puts the search in the URL and returns to the first page", () => {
    jest.useFakeTimers();
    mockFilterPage = readyFilterPage({ paginationOffset: 10 });
    renderOverview();

    fireEvent.change(screen.getByPlaceholderText("Search funnels..."), {
      target: { value: "check" },
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockSetPageUrlKey.mock.calls).toEqual([
      ["q", "check"],
      ["po", "0"],
    ]);
  });

  it("keeps the page when the input reports the search it started with", () => {
    jest.useFakeTimers();
    mockSearchParams = new URLSearchParams({ q: "check" });
    mockFilterPage = readyFilterPage({ paginationOffset: 10 });
    renderOverview();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockSetPageUrlKey).not.toHaveBeenCalled();
  });
});

describe("FunnelsOverview pinned funnels", () => {
  it("shows a skeleton while the pinned funnels load", () => {
    mockPinned(undefined, { isPending: true });
    renderOverview();

    expect(screen.getByTestId("skeleton-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("pinned-card-mock")).not.toBeInTheDocument();
  });

  it("shows an error when the pinned funnels fail to load", () => {
    mockPinned(undefined, { isError: true });
    renderOverview();

    expect(
      screen.getByText(
        "Error fetching pinned funnels, please refresh page to try again",
      ),
    ).toBeInTheDocument();
  });

  it("prompts to pin a funnel when none are pinned", () => {
    mockPinned([]);
    renderOverview();

    expect(screen.getByText("Pin a funnel to see it here")).toBeInTheDocument();
    expect(screen.queryByTestId("pinned-card-mock")).not.toBeInTheDocument();
  });

  it("shows a card per pinned funnel in pin order with the page filters", () => {
    renderOverview();

    expect(pinnedCardNames()).toEqual([
      "Checkout flow",
      "Onboarding",
      "Search",
    ]);
    expect(mockCardProps["f-checkout"]).toMatchObject({
      teamId: "team-1",
      params: filterParams,
      reordering: false,
      isFirst: true,
      isLast: false,
      pinDisabled: false,
    });
    expect(mockCardProps["f-onboarding"]).toMatchObject({
      isFirst: false,
      isLast: false,
    });
    expect(mockCardProps["f-search"]).toMatchObject({
      isFirst: false,
      isLast: true,
    });
  });
});

describe("FunnelsOverview pinning", () => {
  it("flips the pin of the funnel whose row button is clicked", async () => {
    renderOverview();

    await act(async () => {
      fireEvent.click(
        within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
      );
    });
    await act(async () => {
      fireEvent.click(
        within(row("Checkout flow")).getByRole("button", {
          name: "Unpin funnel",
        }),
      );
    });

    expect(mockSetPinnedMutateAsync.mock.calls).toEqual([
      [{ appId: "app-1", funnelId: "f-signup", pinned: true }],
      [{ appId: "app-1", funnelId: "f-checkout", pinned: false }],
    ]);
  });

  it("tracks a pin and an unpin", async () => {
    renderOverview();

    await act(async () => {
      fireEvent.click(
        within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
      );
    });
    await act(async () => {
      fireEvent.click(
        within(card("Checkout flow")).getByRole("button", {
          name: "Unpin card",
        }),
      );
    });

    const props = {
      team_id: "team-1",
      app_id: "app-1",
      app_platform: "android",
      feature_area: "funnels",
      entry_point: "direct",
    };
    expect(trackMock.mock.calls).toEqual([
      ["funnel_pinned", props],
      ["funnel_unpinned", props],
    ]);
  });

  it("tracks a pin with the platform of the funnel's app while another app's funnels load", async () => {
    mockFilterPage = readyFilterPage({
      value: { app: { id: "app-2", os_names: ["ios"] } },
    });
    renderOverview();

    await act(async () => {
      fireEvent.click(
        within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
      );
    });

    expect(trackMock).toHaveBeenCalledWith(
      "funnel_pinned",
      expect.objectContaining({ app_id: "app-1", app_platform: "android" }),
    );
  });

  it("disables pinning only for the funnel whose change is pending", () => {
    mockSetPinned = {
      isPending: true,
      variables: { appId: "app-1", funnelId: "f-checkout", pinned: false },
      mutateAsync: mockSetPinnedMutateAsync,
    };
    renderOverview();

    expect(
      within(row("Checkout flow")).getByRole("button", {
        name: "Unpin funnel",
      }),
    ).toBeDisabled();
    expect(
      within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
    ).toBeEnabled();
    expect(mockCardProps["f-checkout"].pinDisabled).toBe(true);
    expect(mockCardProps["f-onboarding"].pinDisabled).toBe(false);
  });

  it("shows an error when pinning fails", async () => {
    mockSetPinnedMutateAsync.mockRejectedValueOnce(new Error("boom"));
    renderOverview();

    await act(async () => {
      fireEvent.click(
        within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
      );
    });

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Error pinning funnel: boom",
    );
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("shows an error when unpinning fails", async () => {
    mockSetPinnedMutateAsync.mockRejectedValueOnce(new Error("boom"));
    renderOverview();

    await act(async () => {
      fireEvent.click(
        within(card("Checkout flow")).getByRole("button", {
          name: "Unpin card",
        }),
      );
    });

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Error unpinning funnel: boom",
    );
  });

  it("shows an unknown error when the failure is not an Error", async () => {
    mockSetPinnedMutateAsync.mockRejectedValueOnce("offline");
    renderOverview();

    await act(async () => {
      fireEvent.click(
        within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
      );
    });

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Error pinning funnel: Unknown error",
    );
  });
});

describe("FunnelsOverview reordering pinned funnels", () => {
  const startReorder = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Reorder pinned funnels" }),
    );

  it("offers reordering only when more than one funnel is pinned", () => {
    mockPinned([checkout]);
    renderOverview();

    expect(
      screen.queryByRole("button", { name: "Reorder pinned funnels" }),
    ).not.toBeInTheDocument();
  });

  it("disables reordering while the pinned funnels are refetching", () => {
    mockPinned([checkout, onboarding], { isFetching: true });
    renderOverview();

    expect(
      screen.getByRole("button", { name: "Reorder pinned funnels" }),
    ).toBeDisabled();
  });

  it("puts the cards in reorder mode and locks the pin buttons", () => {
    renderOverview();
    startReorder();

    expect(mockCardProps["f-checkout"].reordering).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Reorder pinned funnels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel reorder" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save order" }),
    ).toBeInTheDocument();
    expect(
      within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
    ).toBeDisabled();
    expect(
      within(row("Checkout flow")).getByRole("button", {
        name: "Unpin funnel",
      }),
    ).toBeDisabled();
  });

  it("moves cards up and down and keeps the first and last flags in step", () => {
    renderOverview();
    startReorder();

    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );
    expect(pinnedCardNames()).toEqual([
      "Onboarding",
      "Checkout flow",
      "Search",
    ]);
    expect(mockCardProps["f-onboarding"]).toMatchObject({
      isFirst: true,
      isLast: false,
    });
    expect(mockCardProps["f-checkout"]).toMatchObject({
      isFirst: false,
      isLast: false,
    });

    fireEvent.click(
      within(card("Search")).getByRole("button", { name: "Move up" }),
    );
    expect(pinnedCardNames()).toEqual([
      "Onboarding",
      "Search",
      "Checkout flow",
    ]);
    expect(mockCardProps["f-checkout"].isLast).toBe(true);
  });

  it("leaves reorder mode and shows the new app's pinned funnels when another app is picked", () => {
    const { rerender } = renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );

    mockFilterPage = readyFilterPage({
      value: { app: { id: "app-2" } },
      filterParams: { ...filterParams, appId: "app-2" },
    });
    mockPinned([search, onboarding]);
    rerender(<FunnelsOverview teamId="team-1" />);

    expect(pinnedCardNames()).toEqual(["Search", "Onboarding"]);
    expect(mockCardProps["f-search"].reordering).toBe(false);
    expect(
      screen.getByRole("button", { name: "Reorder pinned funnels" }),
    ).toBeInTheDocument();
  });

  it("saves the new order and leaves reorder mode", async () => {
    renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    });

    expect(mockReorderMutateAsync).toHaveBeenCalledWith({
      appId: "app-1",
      funnels: [onboarding, checkout, search],
    });
    expect(mockCardProps["f-checkout"].reordering).toBe(false);
    expect(
      screen.getByRole("button", { name: "Reorder pinned funnels" }),
    ).toBeInTheDocument();
  });

  it("leaves reorder mode without saving when the order is unchanged", async () => {
    renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move up" }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    });

    expect(mockReorderMutateAsync).not.toHaveBeenCalled();
    expect(mockCardProps["f-checkout"].reordering).toBe(false);
  });

  it("restores the saved order on cancel", () => {
    renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel reorder" }));

    expect(pinnedCardNames()).toEqual([
      "Checkout flow",
      "Onboarding",
      "Search",
    ]);
    expect(mockCardProps["f-checkout"].reordering).toBe(false);
    expect(mockReorderMutateAsync).not.toHaveBeenCalled();
  });

  it("asks to try again when a teammate changed the pinned funnels", async () => {
    mockReorderMutateAsync.mockRejectedValueOnce(
      new ApiError(409, "pinned funnels changed"),
    );
    renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    });

    expect(mockToastNegative).toHaveBeenCalledTimes(1);
    expect(mockToastNegative).toHaveBeenCalledWith(
      "A teammate changed the pinned funnels before your order was saved, please try again",
    );
  });

  it("shows the error when saving the order fails otherwise", async () => {
    mockReorderMutateAsync.mockRejectedValueOnce(new ApiError(500, "boom"));
    renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    });

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Error reordering pinned funnels: boom",
    );
  });

  it("shows an unknown error when saving the order fails with a non Error", async () => {
    mockReorderMutateAsync.mockRejectedValueOnce("offline");
    renderOverview();
    startReorder();
    fireEvent.click(
      within(card("Checkout flow")).getByRole("button", { name: "Move down" }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    });

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Error reordering pinned funnels: Unknown error",
    );
  });
});

describe("FunnelsOverview permissions", () => {
  const expectChangesDisabled = () => {
    expect(
      screen.getByRole("button", { name: "Create Funnel" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reorder pinned funnels" }),
    ).toBeDisabled();
    expect(
      within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
    ).toBeDisabled();
    expect(
      within(row("Checkout flow")).getByRole("button", {
        name: "Unpin funnel",
      }),
    ).toBeDisabled();
    for (const id of ["f-checkout", "f-onboarding", "f-search"]) {
      expect(mockCardProps[id].pinDisabled).toBe(true);
    }
  };

  it("reads the permissions of the team", () => {
    renderOverview();

    expect(mockUseAuthzAndMembersQuery).toHaveBeenCalledWith("team-1");
  });

  it("enables every funnel change when the role can change funnels", () => {
    renderOverview();

    expect(screen.getByRole("button", { name: "Create Funnel" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Reorder pinned funnels" }),
    ).toBeEnabled();
    expect(
      within(row("Signup")).getByRole("button", { name: "Pin funnel" }),
    ).toBeEnabled();
    expect(mockCardProps["f-checkout"].pinDisabled).toBe(false);
  });

  it("disables every funnel change when the role cannot change funnels", () => {
    mockUseAuthzAndMembersQuery.mockReturnValue({
      data: { can_change_funnels: false },
    });
    renderOverview();

    expectChangesDisabled();
  });

  it("disables every funnel change until the permissions load", () => {
    mockUseAuthzAndMembersQuery.mockReturnValue({ data: undefined });
    renderOverview();

    expectChangesDisabled();
  });

  it("disables creating from the empty state when the role cannot change funnels", () => {
    mockUseAuthzAndMembersQuery.mockReturnValue({
      data: { can_change_funnels: false },
    });
    mockFunnels([]);
    mockPinned([]);
    renderOverview();

    for (const button of screen.getAllByRole("button", {
      name: "Create Funnel",
    })) {
      expect(button).toBeDisabled();
    }
  });
});

describe("FunnelsOverview creating a funnel", () => {
  it("opens an empty editor for the selected app from the header", () => {
    renderOverview();
    expect(mockEditorProps).toMatchObject({
      appId: "app-1",
      funnel: null,
      open: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Funnel" }));

    expect(screen.getByTestId("funnel-editor-mock")).toBeInTheDocument();
  });

  it("opens the editor from the empty state when the app has no funnels", () => {
    mockFunnels([]);
    mockPinned([]);
    renderOverview();

    const [, emptyStateButton] = screen.getAllByRole("button", {
      name: "Create Funnel",
    });
    fireEvent.click(emptyStateButton);

    expect(screen.getByTestId("funnel-editor-mock")).toBeInTheDocument();
  });

  it("closes the editor when it asks to", () => {
    renderOverview();
    fireEvent.click(screen.getByRole("button", { name: "Create Funnel" }));

    act(() => mockEditorProps!.onOpenChange(false));

    expect(screen.queryByTestId("funnel-editor-mock")).not.toBeInTheDocument();
  });

  it("opens the new funnel once it is saved", () => {
    renderOverview();

    act(() =>
      mockEditorProps!.onSaved!(makeFunnel({ id: "f-new", name: "New one" })),
    );

    expect(mockPush).toHaveBeenCalledWith(
      "/team-1/funnels/app-1/f-new?from=created",
    );
    expect(trackMock).toHaveBeenCalledWith("funnel_created", {
      team_id: "team-1",
      app_id: "app-1",
      app_platform: "android",
      feature_area: "funnels",
      entry_point: "direct",
    });
  });
});
