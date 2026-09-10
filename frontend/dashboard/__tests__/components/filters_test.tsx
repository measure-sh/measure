import { beforeEach, describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

let mockSearchParams = new URLSearchParams();
let mockPathname = "/team-1/overview";

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const mockRefetchQueries = jest.fn().mockResolvedValue(undefined);
const mockGetQueryData = jest.fn();
jest.mock("@/app/query/query_client", () => ({
  queryClient: {
    refetchQueries: (...args: any[]) => mockRefetchQueries(...args),
    getQueryData: (...args: any[]) => mockGetQueryData(...args),
    fetchQuery: jest.fn(() => Promise.resolve(null)),
  },
  SHORT_CODE_STALE_TIME: 5 * 60 * 1000,
}));

let appsQueryState: any = { status: "pending", data: undefined };
let filterOptionsQueryState: any = { status: "pending", data: undefined };

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useAppsQuery: () => appsQueryState,
  useFilterOptionsQuery: () => filterOptionsQueryState,
}));

jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  default: ({ title }: any) => <div data-testid={`dropdown-${title}`} />,
  DropdownSelectType: {
    SingleString: "SingleString",
    MultiString: "MultiString",
    MultiAppVersion: "MultiAppVersion",
    MultiOsVersion: "MultiOsVersion",
  },
}));

jest.mock("@/app/components/skeleton", () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton-mock" className={className} {...props} />
  ),
}));

jest.mock("@/app/components/onboarding", () => ({
  __esModule: true,
  default: () => <div data-testid="onboarding-mock" />,
}));

jest.mock("@/app/components/debounce_text_input", () => ({
  __esModule: true,
  default: ({ id }: any) => <input data-testid={`debounce-input-${id}`} />,
}));

jest.mock("@/app/components/user_def_attr_selector", () => ({
  __esModule: true,
  default: () => <div data-testid="ud-attr-selector" />,
  UdAttrMatcher: {},
}));

jest.mock("@/app/components/input", () => ({
  __esModule: true,
  Input: (props: any) => (
    <input {...props} data-testid={`input-${props.type}`} />
  ),
}));

const { useStore } = jest.requireActual("zustand");
const { createFiltersStore } = jest.requireActual("@/app/stores/filters_store");

let storeInstance: ReturnType<typeof createFiltersStore>;

jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useFiltersStore: (selector?: any) =>
    useStore(storeInstance, selector ?? ((s: any) => s)),
}));

import { App, AppVersion, FilterSource, OsVersion } from "@/app/api/api_calls";
import Filters, {
  AppVersionsInitialSelectionType,
  deserializeUrlFilters,
} from "@/app/components/filters";

// jsdom has no scrollIntoView; the More filters modal calls it to bring a
// chip's section into view when the modal is opened from a chip.
Element.prototype.scrollIntoView = jest.fn();

function makeApp(id: string, onboarded = true): App {
  return {
    id,
    team_id: "t1",
    name: `App ${id}`,
    api_key: { created_at: "", key: "k", last_seen: null, revoked: false },
    onboarded,
    created_at: "",
    updated_at: "",
    os_names: ["android"],
    onboarded_at: null,
    unique_identifier: null,
  };
}

function defaultProps(overrides: Record<string, any> = {}) {
  return {
    teamId: "team-1",
    filterSource: FilterSource.Events,
    appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
    showNoData: false,
    showNotOnboarded: false,
    showNoBuilds: false,
    showAppSelector: true,
    showDates: true,
    showAppVersions: true,
    showOsVersions: true,
    showCountries: true,
    showNetworkProviders: true,
    showNetworkTypes: true,
    showNetworkGenerations: true,
    showLocales: true,
    showDeviceManufacturers: true,
    showDeviceNames: true,
    showUdAttrs: false,
    showFreeText: false,
    ...overrides,
  };
}

async function renderFilters(props: Record<string, any> = {}) {
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Filters {...(defaultProps(props) as any)} />
      </QueryClientProvider>,
    );
  });
}

const filterOptionsFixture = {
  versions: [new AppVersion("1.0", "100"), new AppVersion("2.0", "200")],
  osVersions: [new OsVersion("android", "13")],
  countries: ["US", "IN"],
  networkProviders: ["Verizon"],
  networkTypes: ["wifi"],
  networkGenerations: ["4G"],
  locales: ["en-US"],
  deviceManufacturers: ["Samsung"],
  deviceNames: ["Pixel 8"],
  userDefAttrs: [],
  userDefAttrOps: new Map(),
};

function setAppsPending() {
  appsQueryState = { status: "pending", data: undefined };
}
function setAppsSuccess(apps: App[]) {
  appsQueryState = {
    status: "success",
    data: apps,
  };
}
function setAppsNoApps() {
  appsQueryState = {
    status: "success",
    data: [],
  };
}
function setAppsError() {
  appsQueryState = { status: "error", data: undefined, error: new Error() };
}

function setFiltersSuccess() {
  filterOptionsQueryState = {
    status: "success",
    data: { kind: "options", data: filterOptionsFixture },
  };
}
function setFiltersNoData() {
  filterOptionsQueryState = {
    status: "success",
    data: { kind: "no-data" },
  };
}
function setFiltersNoBuilds() {
  filterOptionsQueryState = {
    status: "success",
    data: { kind: "no-builds" },
  };
}
function setFiltersNotOnboarded() {
  filterOptionsQueryState = {
    status: "success",
    data: { kind: "not-onboarded" },
  };
}
function setFiltersError() {
  filterOptionsQueryState = {
    status: "error",
    data: undefined,
    error: new Error(),
  };
}
function setFiltersPending() {
  filterOptionsQueryState = { status: "pending", data: undefined };
}

let sessionStorageData: Record<string, string> = {};

beforeEach(() => {
  storeInstance = createFiltersStore();
  setAppsPending();
  setFiltersPending();
  mockSearchParams = new URLSearchParams();
  mockPathname = "/team-1/overview";
  sessionStorageData = {};
  jest
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation((key: string) => sessionStorageData[key] ?? null);
  jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation((key: string, value: string) => {
      sessionStorageData[key] = value;
    });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Filters — apps query states", () => {
  it("shows skeletons while apps are pending", async () => {
    setAppsPending();
    await renderFilters();
    expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(0);
  });

  it("shows the apps error message when the apps query fails", async () => {
    setAppsError();
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByText(/Error fetching apps/)).toBeInTheDocument();
    });
  });

  it('renders the "create your first app" link when on a non-/apps path with no apps', async () => {
    mockPathname = "/team-1/overview";
    setAppsNoApps();
    await renderFilters();
    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: /creating your first app/,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "apps");
    });
  });

  it("renders plain text on /apps path when there are no apps", async () => {
    mockPathname = "/team-1/apps";
    setAppsNoApps();
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByText(/creating your first app/)).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /creating your first app/ }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders Onboarding when showNotOnboarded and there are no apps", async () => {
    setAppsNoApps();
    await renderFilters({ showNotOnboarded: true });
    await waitFor(() => {
      expect(screen.getByTestId("onboarding-mock")).toBeInTheDocument();
    });
  });
});

describe("Filters — filter options states", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
  });

  it("shows the app selector dropdown plus skeletons while filters load", async () => {
    setFiltersPending();
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(0);
    });
  });

  it("shows the filters error message when the filter options query fails", async () => {
    setFiltersError();
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByText(/Error fetching filters/)).toBeInTheDocument();
    });
  });

  it('renders the "no data" message when showNoData is true and status is NoData', async () => {
    setFiltersNoData();
    await renderFilters({ showNoData: true });
    await waitFor(() => {
      expect(
        screen.getByText(/No .* received for this app yet/),
      ).toBeInTheDocument();
    });
  });

  it('renders the "no builds" message when showNoBuilds is true and status is NoBuilds', async () => {
    setFiltersNoBuilds();
    await renderFilters({ showNoBuilds: true });
    await waitFor(() => {
      expect(
        screen.getByText(/No builds uploaded for this app yet/),
      ).toBeInTheDocument();
    });
  });

  it("renders Onboarding when showNotOnboarded and filters status is NotOnboarded", async () => {
    setFiltersNotOnboarded();
    await renderFilters({ showNotOnboarded: true });
    await waitFor(() => {
      expect(screen.getByTestId("onboarding-mock")).toBeInTheDocument();
    });
  });

  it("renders the filter dropdowns and More filters trigger once filters load successfully", async () => {
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-Date Range")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-App versions")).toBeInTheDocument();
      expect(screen.getByText("More filters")).toBeInTheDocument();
    });
  });
});

describe("Filters — store state after queries resolve", () => {
  it("mirrors apps and statuses into the store on resolve", async () => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      const state = storeInstance.getState();
      expect(state.apps).toHaveLength(1);
      expect(state.appsState).toBe("loaded");
      expect(state.filterOptionsState).toBe("loaded");
    });
  });

  it("mirrors an empty apps response as the no-apps state", async () => {
    setAppsNoApps();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().appsState).toBe("no-apps");
    });
  });

  it("auto-picks the first app on initial apps load", async () => {
    setAppsSuccess([makeApp("first"), makeApp("second")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.id).toBe("first");
    });
  });

  it("picks the URL appId when present", async () => {
    mockSearchParams = new URLSearchParams("a=second");
    setAppsSuccess([makeApp("first"), makeApp("second")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.id).toBe("second");
    });
  });

  it("picks the prop appId when URL has none", async () => {
    setAppsSuccess([makeApp("a"), makeApp("b"), makeApp("c")]);
    setFiltersSuccess();
    await renderFilters({ appId: "c" });
    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.id).toBe("c");
    });
  });

  it("applies URL-provided OS version indices", async () => {
    const fixture = {
      ...filterOptionsFixture,
      osVersions: [
        new OsVersion("android", "13"),
        new OsVersion("android", "14"),
        new OsVersion("android", "15"),
      ],
    };
    mockSearchParams = new URLSearchParams("os=0,2");
    setAppsSuccess([makeApp("a")]);
    filterOptionsQueryState = {
      status: "success",
      data: { kind: "options", data: fixture },
    };
    await renderFilters();
    await waitFor(() => {
      const state = storeInstance.getState();
      expect(state.selectedOsVersions.map((v: any) => v.version)).toEqual([
        "13",
        "15",
      ]);
    });
  });

  it("selects every version covered by a compressed URL index range", async () => {
    const fixture = {
      ...filterOptionsFixture,
      versions: [
        new AppVersion("1.0", "100"),
        new AppVersion("2.0", "200"),
        new AppVersion("3.0", "300"),
      ],
    };
    mockSearchParams = new URLSearchParams("v=0-2");
    setAppsSuccess([makeApp("a")]);
    filterOptionsQueryState = {
      status: "success",
      data: { kind: "options", data: fixture },
    };
    await renderFilters();
    await waitFor(() => {
      expect(
        storeInstance.getState().selectedVersions.map((v: any) => v.name),
      ).toEqual(["1.0", "2.0", "3.0"]);
    });
  });
});

describe("Filters — selectedApp sync on refetch", () => {
  it("updates selectedApp when a refetch returns the same id with a rotated api_key", async () => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.id).toBe("a");
      expect(storeInstance.getState().selectedApp?.api_key.key).toBe("k");
    });

    // Same app id, new key — exactly what an API key rotation produces.
    const next: App = {
      ...makeApp("a"),
      api_key: {
        created_at: "",
        key: "rotated-key",
        last_seen: null,
        revoked: false,
      },
    };
    setAppsSuccess([next]);
    await act(async () => {
      // Mirrors the refetch landing in the store; forces the sync effect
      // (keyed on appsQuery.data) to re-run against the fresh apps list.
      storeInstance.getState().setApps([next], "loaded");
    });

    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.api_key.key).toBe(
        "rotated-key",
      );
    });
  });

  it("updates selectedApp when a refetch flips the onboarded flag for the same id", async () => {
    setAppsSuccess([makeApp("a", false)]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.onboarded).toBe(false);
    });

    const next = makeApp("a", true);
    setAppsSuccess([next]);
    await act(async () => {
      storeInstance.getState().setApps([next], "loaded");
    });

    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.onboarded).toBe(true);
    });
  });

  it("does not replace selectedApp when a refetch returns identical content", async () => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedApp?.id).toBe("a");
    });
    const before = storeInstance.getState().selectedApp;

    // A refetch hands back a fresh object with identical content.
    const refetched = makeApp("a");
    setAppsSuccess([refetched]);
    await act(async () => {
      storeInstance.getState().setApps([refetched], "loaded");
    });

    // appsEqual sees no change, so the store keeps the same object reference.
    expect(storeInstance.getState().selectedApp).toBe(before);
  });
});

describe("Filters — date initialization", () => {
  it("defaults to Last 6 Hours on first-ever mount", async () => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      const state = storeInstance.getState();
      expect(state.selectedDateRange).toBe("Last 6 Hours");
      expect(state.selectedStartDate).toBeTruthy();
      expect(state.selectedEndDate).toBeTruthy();
    });
  });

  it("honors URL dateRange", async () => {
    mockSearchParams = new URLSearchParams("d=Last+Year");
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedDateRange).toBe("Last Year");
    });
  });

  it("falls back to the default range when the URL dateRange is unknown", async () => {
    mockSearchParams = new URLSearchParams("d=Not+A+Real+Range");
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(storeInstance.getState().selectedDateRange).toBe("Last 6 Hours");
    });
  });

  it("re-anchors a preserved dynamic range to now() on remount", async () => {
    storeInstance.getState().setSelectedDateRange("Last Year");
    storeInstance.getState().setSelectedStartDate("2020-01-01T00:00:00.000Z");
    storeInstance.getState().setSelectedEndDate("2020-01-02T00:00:00.000Z");

    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      const state = storeInstance.getState();
      const end = new Date(state.selectedEndDate);
      // End should be roughly now, not the stale 2020 value.
      const diffMs = Math.abs(end.getTime() - Date.now());
      expect(diffMs).toBeLessThan(60 * 1000);
    });
  });

  it("keeps Custom dates intact on remount", async () => {
    storeInstance.getState().setSelectedDateRange("Custom Range");
    const customStart = "2020-01-01T00:00:00.000Z";
    const customEnd = "2020-01-02T00:00:00.000Z";
    storeInstance.getState().setSelectedStartDate(customStart);
    storeInstance.getState().setSelectedEndDate(customEnd);

    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      const state = storeInstance.getState();
      expect(state.selectedStartDate).toBe(customStart);
      expect(state.selectedEndDate).toBe(customEnd);
    });
  });
});

describe("Filters — team change", () => {
  it("resets team-scoped state when teamId differs from the stored one", async () => {
    // Prime the store with state from a previous team.
    storeInstance.getState().setCurrentTeamId("old-team");
    storeInstance.getState().setSelectedApp(makeApp("a"));
    storeInstance
      .getState()
      .setSelectedVersions([new AppVersion("1.0", "100")]);

    setAppsPending();
    setFiltersPending();
    await renderFilters({ teamId: "new-team" });
    await waitFor(() => {
      const state = storeInstance.getState();
      expect(state.currentTeamId).toBe("new-team");
      expect(state.selectedApp).toBeNull();
      expect(state.selectedVersions).toEqual([]);
    });
  });

  it("seeds currentTeamId on first mount without wiping state", async () => {
    // Empty store — no prior team. Mount should just set currentTeamId
    // to the teamId prop without touching anything else.
    setAppsPending();
    setFiltersPending();
    await renderFilters({ teamId: "team-7" });
    await waitFor(() => {
      expect(storeInstance.getState().currentTeamId).toBe("team-7");
    });
  });
});

describe("Filters — filter chips", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
  });

  it("renders a chip for an active filter selection", async () => {
    await renderFilters();
    await act(async () => {
      storeInstance.getState().setSelectedCountries(["US", "IN"]);
    });
    await waitFor(() => {
      expect(screen.getByText("Country: US, IN")).toBeInTheDocument();
    });
  });

  it("renders no chip for a filter left at its default", async () => {
    await renderFilters();
    // The always-on app versions chip confirms the filters have loaded.
    await waitFor(() => {
      expect(screen.getByText(/^App versions:/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Country:/)).not.toBeInTheDocument();
  });

  it("always renders the app versions chip", async () => {
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByText(/^App versions:/)).toBeInTheDocument();
    });
  });

  it("clears the filter when the chip's clear button is clicked", async () => {
    await renderFilters();
    await act(async () => {
      storeInstance.getState().setSelectedCountries(["US", "IN"]);
    });
    fireEvent.click(await screen.findByLabelText("Clear Country"));
    await waitFor(() => {
      expect(storeInstance.getState().selectedCountries).toEqual([]);
      expect(screen.queryByText("Country: US, IN")).not.toBeInTheDocument();
    });
  });

  it("opens the More filters modal from the trigger button", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    await waitFor(() => {
      expect(
        screen.getByText("Narrow down results with additional filters."),
      ).toBeInTheDocument();
    });
  });

  it("opens the More filters modal when a chip is clicked", async () => {
    await renderFilters();
    await act(async () => {
      storeInstance.getState().setSelectedCountries(["US", "IN"]);
    });
    fireEvent.click(await screen.findByText("Country: US, IN"));
    await waitFor(() => {
      expect(
        screen.getByText("Narrow down results with additional filters."),
      ).toBeInTheDocument();
    });
  });
});

describe("Filters — More filters modal pending changes", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
  });

  it("renames the modal commit button from 'Done' to 'Save'", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Done" }),
    ).not.toBeInTheDocument();
  });

  it("does NOT update the store when a modal control is toggled before Save", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    const before = storeInstance.getState().selectedCountries.slice();
    const usChip = await screen.findByRole("checkbox", { name: "US" });
    fireEvent.click(usChip);
    // No commit yet — store stays at its committed value.
    expect(storeInstance.getState().selectedCountries).toEqual(before);
    // And the chip reflects the pending toggle (selected).
    expect(usChip).toHaveAttribute("aria-checked", "true");
  });

  it("commits the pending selections to the store and closes the modal on Save", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "US" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "IN" }));
    expect(storeInstance.getState().selectedCountries).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(storeInstance.getState().selectedCountries.sort()).toEqual([
        "IN",
        "US",
      ]);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("Narrow down results with additional filters."),
      ).not.toBeInTheDocument();
    });
  });

  it("commits OS version toggles to the store on Save", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Android API Level 13" }),
    );
    expect(storeInstance.getState().selectedOsVersions).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(
        storeInstance.getState().selectedOsVersions.map((v: any) => v.version),
      ).toEqual(["13"]);
    });
  });

  it("re-opens with committed store values after a dismiss (discards stale pending state)", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "US" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(
        screen.queryByText("Narrow down results with additional filters."),
      ).not.toBeInTheDocument();
    });
    // Reopen — the chip should reflect the store (still unselected), not the
    // previously-pending selection.
    fireEvent.click(await screen.findByText("More filters"));
    const usChipAfter = await screen.findByRole("checkbox", { name: "US" });
    expect(usChipAfter).toHaveAttribute("aria-checked", "false");
  });

  it("re-opens with the freshly-committed values after a Save", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "US" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(storeInstance.getState().selectedCountries).toEqual(["US"]);
    });
    fireEvent.click(await screen.findByText("More filters"));
    const usChipAfter = await screen.findByRole("checkbox", { name: "US" });
    expect(usChipAfter).toHaveAttribute("aria-checked", "true");
  });

  it("discards pending changes when the modal is dismissed via the X close button", async () => {
    await renderFilters();
    fireEvent.click(await screen.findByText("More filters"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "US" }));
    // Radix renders an additional unlabelled close button (the X icon) with
    // the screen-reader-only label "Close".
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(
        screen.queryByText("Narrow down results with additional filters."),
      ).not.toBeInTheDocument();
    });
    expect(storeInstance.getState().selectedCountries).toEqual([]);
  });

  it("does not update the main-row chip while pending changes are unsaved", async () => {
    await renderFilters();
    // Confirm no Country chip exists yet (no selection committed).
    expect(screen.queryByText(/^Country:/)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText("More filters"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "US" }));
    // Still no chip — selection is pending, not committed.
    expect(screen.queryByText(/^Country:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByText("Country: US")).toBeInTheDocument();
    });
  });
});

describe("deserializeUrlFilters — version index ranges", () => {
  it("expands a compressed range into every index in the range", () => {
    expect(deserializeUrlFilters("v=0-2").versions).toEqual([0, 1, 2]);
  });

  it("expands a mix of single indices and ranges", () => {
    expect(deserializeUrlFilters("v=0,2-4").versions).toEqual([0, 2, 3, 4]);
  });
});
