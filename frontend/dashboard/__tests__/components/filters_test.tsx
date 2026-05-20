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

jest.mock("@/app/components/pill", () => ({
  __esModule: true,
  default: ({ title }: any) => <span data-testid="pill">{title}</span>,
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
    os_name: "android",
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

  it("renders Type, Severity and Custom errors when all three show flags are on", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Type")).toBeInTheDocument();
    });
    expect(screen.getByTestId("dropdown-Severity")).toBeInTheDocument();
    expect(screen.getByText("Custom errors only")).toBeInTheDocument();
  });

  it("hides all three new controls when none of the show flags are passed", async () => {
    await renderFilters({ filterSource: FilterSource.Errors });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("dropdown-Type")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom errors only")).not.toBeInTheDocument();
  });

  it("does NOT render the new controls when filterSource is not Errors", async () => {
    await renderFilters({
      filterSource: FilterSource.Events,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("dropdown-Type")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom errors only")).not.toBeInTheDocument();
  });

  it("hides Severity and Custom checkbox when only 'anr' is in selectedErrorTypes (Type stays visible)", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Type")).toBeInTheDocument();
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["anr"]);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("dropdown-Severity")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Custom errors only")).not.toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Type")).toBeInTheDocument();
  });

  it("shows all three controls when only 'error' is in selectedErrorTypes", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Type")).toBeInTheDocument();
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error"]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Severity")).toBeInTheDocument();
    });
    expect(screen.getByText("Custom errors only")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Type")).toBeInTheDocument();
  });

  it("preserves severity/custom in the store when the user removes 'error' from selectedErrorTypes", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
      showSeverity: true,
      showCustomErrors: true,
    });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-Type")).toBeInTheDocument();
    });
    // Seed both error types with severity and custom set.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error", "anr"]);
      storeInstance.getState().setSelectedSeverities(["fatal"]);
      storeInstance.getState().setCustomErrorsOnly(true);
    });
    // Now drop 'error' (leave only 'anr') — controls hide but state stays.
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

describe("Filters — Errors filter source: ANRs and Errors pills", () => {
  beforeEach(() => {
    setAppsSuccess([makeApp("a")]);
    setFiltersSuccess();
  });

  it("renders both ANRs and Errors pills when both error types are selected", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    // Default is error only; opt ANR in for this test.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error", "anr"]);
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs")).toBeInTheDocument();
    });
    // Errors pill includes the default Fatal severity.
    expect(screen.getByText("Errors - Fatal")).toBeInTheDocument();
  });

  it("hides the ANRs pill when 'anr' is not in selectedErrorTypes", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    // Start with both selected so we can observe ANRs disappearing.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error", "anr"]);
    });
    await waitFor(() => {
      expect(screen.getByText("ANRs")).toBeInTheDocument();
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error"]);
    });
    await waitFor(() => {
      expect(screen.queryByText("ANRs")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Errors - Fatal")).toBeInTheDocument();
  });

  it("hides the Errors pill when 'error' is not in selectedErrorTypes", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await waitFor(() => {
      expect(screen.getByText("Errors - Fatal")).toBeInTheDocument();
    });
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["anr"]);
    });
    await waitFor(() => {
      expect(screen.queryByText(/^Errors/)).not.toBeInTheDocument();
    });
    expect(screen.getByText("ANRs")).toBeInTheDocument();
  });

  it("does not render either pill when filterSource is not Errors", async () => {
    await renderFilters({ filterSource: FilterSource.Events });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(screen.queryByText("ANRs")).not.toBeInTheDocument();
    expect(screen.queryByText("Errors")).not.toBeInTheDocument();
  });

  it("renders the Errors pill with only 'Errors' when no severities or custom flag are set", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    // Clear the default Fatal severity so the pill has no subfilters.
    await act(async () => {
      storeInstance.getState().setSelectedSeverities([]);
    });
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Errors - /)).not.toBeInTheDocument();
  });

  it("renders 'Errors - Custom' when only customErrorsOnly is set", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedSeverities([]);
      storeInstance.getState().setCustomErrorsOnly(true);
    });
    await waitFor(() => {
      expect(screen.getByText("Errors - Custom")).toBeInTheDocument();
    });
  });

  it("renders 'Errors - Custom, Fatal, Handled' when both custom and multiple severities are set", async () => {
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
        screen.getByText("Errors - Custom, Fatal, Handled"),
      ).toBeInTheDocument();
    });
  });

  it("renders just the severity names in the Errors pill when custom is off", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedSeverities(["fatal"]);
    });
    await waitFor(() => {
      expect(screen.getByText("Errors - Fatal")).toBeInTheDocument();
    });
  });

  it("removes 'anr' from selectedErrorTypes when the X on ANRs pill is clicked", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    // Opt ANR in first; default is error only.
    await act(async () => {
      storeInstance.getState().setSelectedErrorTypes(["error", "anr"]);
    });
    fireEvent.click(await screen.findByLabelText("Clear ANRs"));
    await waitFor(() => {
      expect(storeInstance.getState().selectedErrorTypes).not.toContain("anr");
    });
  });

  it("clears errors + severities + customErrorsOnly when X on Errors pill is clicked", async () => {
    await renderFilters({
      filterSource: FilterSource.Errors,
      showErrorType: true,
    });
    await act(async () => {
      storeInstance.getState().setSelectedSeverities(["fatal"]);
      storeInstance.getState().setCustomErrorsOnly(true);
    });
    await waitFor(() => {
      expect(screen.getByText("Errors - Custom, Fatal")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Clear Errors - Custom, Fatal"));
    await waitFor(() => {
      expect(storeInstance.getState().selectedErrorTypes).not.toContain(
        "error",
      );
    });
    expect(storeInstance.getState().selectedSeverities).toEqual([]);
    expect(storeInstance.getState().customErrorsOnly).toBe(false);
  });

  it("hides both pills on Errors filter source when showErrorType is false (e.g. error detail page)", async () => {
    await renderFilters({ filterSource: FilterSource.Errors });
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
    });
    expect(screen.queryByText("ANRs")).not.toBeInTheDocument();
    expect(screen.queryByText("Errors")).not.toBeInTheDocument();
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
