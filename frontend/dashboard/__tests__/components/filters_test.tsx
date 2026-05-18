import { beforeEach, describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";

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
} from "@/app/components/filters";

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

  it("renders all filter dropdowns once filters load successfully", async () => {
    setFiltersSuccess();
    await renderFilters();
    await waitFor(() => {
      expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-Date Range")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-App versions")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-OS Versions")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-Country")).toBeInTheDocument();
      expect(
        screen.getByTestId("dropdown-Network Provider"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-Network type")).toBeInTheDocument();
      expect(
        screen.getByTestId("dropdown-Network generation"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-Locale")).toBeInTheDocument();
      expect(
        screen.getByTestId("dropdown-Device Manufacturer"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-Device Name")).toBeInTheDocument();
    });
  });

  it("does NOT render the country dropdown when showCountries=false", async () => {
    setFiltersSuccess();
    await renderFilters({ showCountries: false });
    await waitFor(() => {
      expect(screen.queryByTestId("dropdown-Country")).not.toBeInTheDocument();
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
