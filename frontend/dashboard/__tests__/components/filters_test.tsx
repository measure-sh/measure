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
let rootSpanNamesQueryState: any = { status: "pending", data: undefined };

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useAppsQuery: () => appsQueryState,
  useFilterOptionsQuery: () => filterOptionsQueryState,
  useRootSpanNamesQuery: () => rootSpanNamesQueryState,
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

import {
  App,
  AppsApiStatus,
  AppVersion,
  FiltersApiStatus,
  FilterSource,
  OsVersion,
  RootSpanNamesApiStatus,
} from "@/app/api/api_calls";
import Filters, {
  AppVersionsInitialSelectionType,
  deserializeUrlFilters,
  ErrorsTypeFilter,
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
    showAppSelector: true,
    showDates: true,
    showAppVersions: true,
    showOsVersions: true,
    showSessionTypes: false,
    showCountries: true,
    showNetworkProviders: true,
    showNetworkTypes: true,
    showNetworkGenerations: true,
    showLocales: true,
    showDeviceManufacturers: true,
    showDeviceNames: true,
    showBugReportStatus: false,
    showHttpMethods: false,
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
    data: { status: AppsApiStatus.Success, data: apps },
  };
}
function setAppsNoApps() {
  appsQueryState = {
    status: "success",
    data: { status: AppsApiStatus.NoApps, data: [] },
  };
}
function setAppsError() {
  appsQueryState = { status: "error", data: undefined, error: new Error() };
}

function setFiltersSuccess() {
  filterOptionsQueryState = {
    status: "success",
    data: { status: FiltersApiStatus.Success, data: filterOptionsFixture },
  };
}
function setFiltersNoData() {
  filterOptionsQueryState = {
    status: "success",
    data: { status: FiltersApiStatus.NoData, data: null },
  };
}
function setFiltersNotOnboarded() {
  filterOptionsQueryState = {
    status: "success",
    data: { status: FiltersApiStatus.NotOnboarded, data: null },
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

function setRootSpansSuccess(names = ["root.a", "root.b"]) {
  rootSpanNamesQueryState = {
    status: "success",
    data: { status: RootSpanNamesApiStatus.Success, data: names },
  };
}
function setRootSpansPending() {
  rootSpanNamesQueryState = { status: "pending", data: undefined };
}
function setRootSpansError() {
  rootSpanNamesQueryState = {
    status: "error",
    data: undefined,
    error: new Error(),
  };
}

let sessionStorageData: Record<string, string> = {};

beforeEach(() => {
  storeInstance = createFiltersStore();
  setAppsPending();
  setFiltersPending();
  setRootSpansPending();
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

describe("Filters — Span filter source", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
  });

  it("shows the trace name skeleton while root span names load", async () => {
    setRootSpansPending();
    await renderFilters({ filterSource: FilterSource.Spans });
    await waitFor(() => {
      expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(0);
    });
  });

  it("shows the trace name error when the root span names query fails", async () => {
    setRootSpansError();
    await renderFilters({ filterSource: FilterSource.Spans });
    await waitFor(() => {
      expect(
        screen.getByText(/Error fetching traces list/),
      ).toBeInTheDocument();
    });
  });

  it("renders the trace name dropdown once root span names load", async () => {
    setRootSpansSuccess();
    await renderFilters({ filterSource: FilterSource.Spans });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Trace Name")).toBeInTheDocument();
    });
  });

  it("does not render the trace name dropdown when filterSource is not Spans", async () => {
    setRootSpansSuccess();
    await renderFilters({ filterSource: FilterSource.Events });
    await waitFor(() => {
      expect(
        screen.queryByTestId("dropdown-Trace Name"),
      ).not.toBeInTheDocument();
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
      expect(state.appsApiStatus).toBe(AppsApiStatus.Success);
      expect(state.filtersApiStatus).toBe(FiltersApiStatus.Success);
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
      data: { status: FiltersApiStatus.Success, data: fixture },
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

  it("mirrors root span names into the store and selects the first", async () => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
    setRootSpansSuccess(["traceA", "traceB"]);
    await renderFilters({ filterSource: FilterSource.Spans });
    await waitFor(() => {
      const state = storeInstance.getState();
      expect(state.rootSpanNames).toEqual(["traceA", "traceB"]);
      expect(state.selectedRootSpanName).toBe("traceA");
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
      storeInstance.getState().setApps([next], AppsApiStatus.Success);
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
      storeInstance.getState().setApps([next], AppsApiStatus.Success);
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
      storeInstance.getState().setApps([refetched], AppsApiStatus.Success);
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

describe("Filters — Errors filter source: Type/Severity/Custom controls", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
  });

  it("renders Type and Severity when all three show flags are on", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    });
    expect(screen.getByTestId("dropdown-Severity")).toBeInTheDocument();
  });

  it("renders Type when showCustomErrors is off", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: false,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    });
  });

  it("hides all errors-only controls when none of the show flags are passed", async () => {
    await renderFilters({ filterSource: FilterSource.Errors });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
  });

  it("does NOT render the errors-only controls when filterSource is not Errors", async () => {
    await renderFilters({
      filterSource: FilterSource.Events,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
  });

  it("hides Severity when only 'anr' is in selectedErrorTypes (Type stays visible)", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["anr"]);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
  });

  it("shows Type and Severity when only 'error' is in selectedErrorTypes", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error"]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Severity")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
  });

  it("preserves severity/custom in the store when the user removes 'error' from selectedErrorTypes", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    });
    // Seed both error types with severity and custom set.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error", "anr"]);
      storeInstance.getState().setSelectedSeverities(["fatal"]);
      storeInstance.getState().setCustomErrorsOnly(true);
    });
    // Now drop 'error' (leave only 'anr') — Severity hides but state stays.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["anr"]);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
    });
    expect(storeInstance.getState().selectedSeverities).toEqual(["fatal"]);
    expect(storeInstance.getState().customErrorsOnly).toBe(true);
  });
});

describe("Filters — Errors filter source: combined error-types pill", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
  });

  it("renders a single pill 'ANRs, Fatal Errors' at default state", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs, Fatal Errors")).toBeInTheDocument();
    });
  });

  it("omits the reset button at default state", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs, Fatal Errors")).toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText("Reset ANRs, Fatal Errors"),
    ).not.toBeInTheDocument();
  });

  it("shows the reset button when state diverges from defaults", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedSeverities(["unhandled"]);
    });
    await waitFor(() => {
      expect(
        screen.getByLabelText("Reset ANRs, Unhandled Errors"),
      ).toBeInTheDocument();
    });
  });

  it("renders only 'ANRs' when 'error' is not selected", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["anr"]);
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Errors/)).not.toBeInTheDocument();
  });

  it("renders only the Errors portion when 'anr' is not selected", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error"]);
    });
    await waitFor(() => {
      expect(screen.getByText("Fatal Errors")).toBeInTheDocument();
    });
    expect(screen.queryByText(/ANRs/)).not.toBeInTheDocument();
  });

  it("hides the pill on Errors filter source when neither type is selected", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes([]);
    });
    await waitFor(() => {
      expect(screen.queryByText(/Errors/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText("ANRs")).not.toBeInTheDocument();
  });

  it("does not render the pill when filterSource is not Errors", async () => {
    await renderFilters({ filterSource: FilterSource.Events });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(screen.queryByText(/ANRs|Errors/)).not.toBeInTheDocument();
  });

  it("renders 'Errors' alone when no severities or custom flag are set and only error is selected", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error"]);
      storeInstance.getState().setSelectedSeverities([]);
    });
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeInTheDocument();
    });
  });

  it("renders 'ANRs, Custom Errors only' when only customErrorsOnly is set", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedSeverities([]);
      storeInstance.getState().setCustomErrorsOnly(true);
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs, Custom Errors only")).toBeInTheDocument();
    });
  });

  it("renders 'ANRs, Custom Errors only - Fatal, Handled' for custom + multiple severities", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setCustomErrorsOnly(true);
      storeInstance.getState().setSelectedSeverities(["fatal", "handled"]);
    });
    await waitFor(() => {
      expect(
        screen.getByText("ANRs, Custom Errors only - Fatal, Handled"),
      ).toBeInTheDocument();
    });
  });

  it("renders 'ANRs, Errors - Fatal, Unhandled, Handled' for multiple severities without custom", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance
        .getState()
        .setSelectedSeverities(["fatal", "unhandled", "handled"]);
    });
    await waitFor(() => {
      expect(
        screen.getByText("ANRs, Errors - Fatal, Unhandled, Handled"),
      ).toBeInTheDocument();
    });
  });

  it("uses adjective form '<Sev> Errors' for a single severity without custom", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedSeverities(["unhandled"]);
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs, Unhandled Errors")).toBeInTheDocument();
    });
  });

  it("resets to defaults (error + anr, fatal, custom off) when the reset button is clicked", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    // Diverge from defaults so reset has something to do.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error"]);
      storeInstance.getState().setSelectedSeverities(["unhandled"]);
      storeInstance.getState().setCustomErrorsOnly(true);
    });
    await waitFor(() => {
      expect(
        screen.getByText("Custom Errors only - Unhandled"),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByLabelText("Reset Custom Errors only - Unhandled"),
    );
    await waitFor(() => {
      expect(storeInstance.getState().selectedErrorTypes).toEqual([
        "error",
        "anr",
      ]);
    });
    expect(storeInstance.getState().selectedSeverities).toEqual(["fatal"]);
    expect(storeInstance.getState().customErrorsOnly).toBe(false);
  });

  it("hides the pill on Errors filter source when showErrorType is false (e.g. error detail page)", async () => {
    await renderFilters({ filterSource: FilterSource.Errors });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(screen.queryByText(/ANRs|Errors/)).not.toBeInTheDocument();
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

  it("resets a changed filter to its default via the chip", async () => {
    await renderFilters({ showSessionTypes: true });
    const defaults = storeInstance.getState().selectedSessionTypes;
    expect(defaults.length).toBeGreaterThan(1);
    await act(async () => {
      storeInstance.getState().setSelectedSessionTypes([defaults[0]]);
    });
    fireEvent.click(await screen.findByLabelText("Reset Session Types"));
    await waitFor(() => {
      expect(storeInstance.getState().selectedSessionTypes).toEqual(defaults);
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

describe("deserializeUrlFilters — Errors filter source URL keys", () => {
  it("parses et (errorTypes) as a comma-separated string array", () => {
    const result = deserializeUrlFilters("et=error,anr");
    expect(result.errorTypes).toEqual(["error", "anr"]);
  });

  it("parses a single errorTypes value", () => {
    const result = deserializeUrlFilters("et=anr");
    expect(result.errorTypes).toEqual(["anr"]);
  });

  it("parses sv (severities) as a comma-separated string array", () => {
    const result = deserializeUrlFilters("sv=fatal,handled");
    expect(result.severities).toEqual(["fatal", "handled"]);
  });

  it("parses co=1 as customErrorsOnly true", () => {
    const result = deserializeUrlFilters("co=1");
    expect(result.customErrorsOnly).toBe(true);
  });

  it("parses co=0 as customErrorsOnly false", () => {
    const result = deserializeUrlFilters("co=0");
    expect(result.customErrorsOnly).toBe(false);
  });

  it("round-trips all three keys together", () => {
    const result = deserializeUrlFilters("et=error&sv=fatal,unhandled&co=1");
    expect(result.errorTypes).toEqual(["error"]);
    expect(result.severities).toEqual(["fatal", "unhandled"]);
    expect(result.customErrorsOnly).toBe(true);
  });

  it("omits absent keys", () => {
    const result = deserializeUrlFilters("");
    expect(result.errorTypes).toBeUndefined();
    expect(result.severities).toBeUndefined();
    expect(result.customErrorsOnly).toBeUndefined();
  });
});

describe("ErrorsTypeFilter", () => {
  type Handlers = {
    onChangeErrorTypes: jest.Mock<(types: string[]) => void>;
    onChangeCustomErrorsOnly: jest.Mock<(custom: boolean) => void>;
  };

  function renderErrorsTypeFilter(
    overrides: Partial<{
      selectedErrorTypes: string[];
      customErrorsOnly: boolean;
      showCustomToggle: boolean;
      open: boolean;
    }> = {},
  ): Handlers {
    const handlers: Handlers = {
      onChangeErrorTypes: jest.fn() as Handlers["onChangeErrorTypes"],
      onChangeCustomErrorsOnly:
        jest.fn() as Handlers["onChangeCustomErrorsOnly"],
    };
    render(
      <ErrorsTypeFilter
        selectedErrorTypes={overrides.selectedErrorTypes ?? ["error"]}
        customErrorsOnly={overrides.customErrorsOnly ?? false}
        showCustomToggle={overrides.showCustomToggle ?? true}
        onChangeErrorTypes={handlers.onChangeErrorTypes}
        onChangeCustomErrorsOnly={handlers.onChangeCustomErrorsOnly}
        open={overrides.open ?? true}
      />,
    );
    return handlers;
  }

  function getControl(label: string): HTMLElement {
    const text = screen.getByText(label);
    const wrapper = text.closest('[role="checkbox"], label');
    if (!wrapper) {
      throw new Error(`No checkbox/label wrapper found for "${label}"`);
    }
    if (wrapper.getAttribute("role") === "checkbox") {
      return wrapper as HTMLElement;
    }
    const input = wrapper.querySelector('button[role="switch"]');
    if (!input) {
      throw new Error(`No switch control found in label "${label}"`);
    }
    return input as HTMLElement;
  }

  it("renders Type trigger and Error, ANR entries", () => {
    renderErrorsTypeFilter();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("ANR")).toBeInTheDocument();
  });

  it("renders Custom inline on the Error row with a Switch when showCustomToggle is true", () => {
    renderErrorsTypeFilter();
    const custom = screen.getByText("Custom Only");
    expect(custom).toBeInTheDocument();
    const switchEl = custom
      .closest("label")
      ?.querySelector('button[role="switch"]');
    expect(switchEl).not.toBeNull();
  });

  it("renders Error and ANR as multi-select items (matching DropdownSelect)", () => {
    renderErrorsTypeFilter();
    expect(getControl("Error")).toHaveAttribute("role", "checkbox");
    expect(getControl("ANR")).toHaveAttribute("role", "checkbox");
  });

  it("hides Custom when showCustomToggle is false", () => {
    renderErrorsTypeFilter({ showCustomToggle: false });
    expect(screen.queryByText("Custom Only")).not.toBeInTheDocument();
  });

  it("disables the Custom switch when Error is unchecked", () => {
    renderErrorsTypeFilter({ selectedErrorTypes: ["anr"] });
    expect(getControl("Custom Only")).toBeDisabled();
  });

  it("enables the Custom switch when Error is checked", () => {
    renderErrorsTypeFilter({ selectedErrorTypes: ["error"] });
    expect(getControl("Custom Only")).not.toBeDisabled();
  });

  it("reflects checked state for Error, ANR, and Custom from props", () => {
    renderErrorsTypeFilter({
      selectedErrorTypes: ["error", "anr"],
      customErrorsOnly: true,
    });
    expect(getControl("Error")).toHaveAttribute("aria-checked", "true");
    expect(getControl("ANR")).toHaveAttribute("aria-checked", "true");
    expect(getControl("Custom Only")).toHaveAttribute("data-state", "checked");
  });

  it("adds 'error' to the list when Error is checked", () => {
    const h = renderErrorsTypeFilter({ selectedErrorTypes: ["anr"] });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr", "error"]);
  });

  it("removes 'error' from the list when Error is unchecked", () => {
    const h = renderErrorsTypeFilter({
      selectedErrorTypes: ["error", "anr"],
    });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr"]);
  });

  it("clears Custom when Error is unchecked (Custom is scoped to Error)", () => {
    const h = renderErrorsTypeFilter({
      selectedErrorTypes: ["error", "anr"],
      customErrorsOnly: true,
    });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr"]);
    expect(h.onChangeCustomErrorsOnly).toHaveBeenCalledWith(false);
  });

  it("does NOT clear Custom when Error is unchecked if Custom was already off", () => {
    const h = renderErrorsTypeFilter({
      selectedErrorTypes: ["error", "anr"],
      customErrorsOnly: false,
    });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr"]);
    expect(h.onChangeCustomErrorsOnly).not.toHaveBeenCalled();
  });

  it("adds 'anr' to the list when ANR is checked", () => {
    const h = renderErrorsTypeFilter({ selectedErrorTypes: ["error"] });
    fireEvent.click(getControl("ANR"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["error", "anr"]);
  });

  it("removes 'anr' from the list when ANR is unchecked", () => {
    const h = renderErrorsTypeFilter({
      selectedErrorTypes: ["error", "anr"],
    });
    fireEvent.click(getControl("ANR"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["error"]);
  });

  it("forwards Custom Switch changes through onChangeCustomErrorsOnly", () => {
    const h = renderErrorsTypeFilter({
      selectedErrorTypes: ["error"],
      customErrorsOnly: false,
    });
    fireEvent.click(getControl("Custom Only"));
    expect(h.onChangeCustomErrorsOnly).toHaveBeenCalledWith(true);
  });
});
