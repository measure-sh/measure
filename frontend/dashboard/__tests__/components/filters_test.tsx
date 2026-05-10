import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";

// --- Mutable mock state ---

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

// --- API mock functions ---

const mockFetchApps = jest.fn();
const mockFetchFilters = jest.fn();
const mockFetchRootSpanNames = jest.fn();

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  AppsApiStatus: { Loading: 0, Success: 1, Error: 2, NoApps: 3, Cancelled: 4 },
  FiltersApiStatus: {
    Loading: 0,
    Success: 1,
    Error: 2,
    NotOnboarded: 3,
    NoData: 4,
    Cancelled: 5,
  },
  RootSpanNamesApiStatus: {
    Loading: 0,
    Success: 1,
    Error: 2,
    NoData: 3,
    Cancelled: 4,
  },
  FilterSource: { Events: 0, Crashes: 1, Anrs: 2, Spans: 3 },
  SessionType: {
    Crashes: "Crash Sessions",
    ANRs: "ANR Sessions",
    BugReports: "Bug Report Sessions",
    UserInteraction: "User Interaction Sessions",
    Foreground: "Foreground Sessions",
    Background: "Background Sessions",
  },
  SpanStatus: { Unset: "Unset", Ok: "Ok", Error: "Error" },
  BugReportStatus: { Open: "Open", Closed: "Closed" },
  HttpMethod: {
    GET: "get",
    POST: "post",
    PUT: "put",
    PATCH: "patch",
    DELETE: "delete",
  },
  AppVersion: class AppVersion {
    name: string;
    code: string;
    displayName: string;
    constructor(name: string, code: string) {
      this.name = name;
      this.code = code;
      this.displayName = `${name} (${code})`;
    }
  },
  OsVersion: class OsVersion {
    name: string;
    version: string;
    displayName: string;
    constructor(name: string, version: string) {
      this.name = name;
      this.version = version;
      this.displayName =
        (name === "android"
          ? "Android API Level"
          : name === "ios"
            ? "iOS"
            : name === "ipados"
              ? "iPadOS"
              : name) +
        " " +
        version;
    }
  },
  UserDefAttr: {},
  UdAttrMatcher: {},
  defaultFilters: {
    ready: false,
    app: null,
    rootSpanName: "",
    startDate: "",
    endDate: "",
    versions: { selected: [], all: false },
    sessionTypes: { selected: [], all: false },
    spanStatuses: { selected: [], all: false },
    bugReportStatuses: { selected: [], all: false },
    httpMethods: { selected: [], all: false },
    osVersions: { selected: [], all: false },
    countries: { selected: [], all: false },
    networkProviders: { selected: [], all: false },
    networkTypes: { selected: [], all: false },
    networkGenerations: { selected: [], all: false },
    locales: { selected: [], all: false },
    deviceManufacturers: { selected: [], all: false },
    deviceNames: { selected: [], all: false },
    udAttrMatchers: [],
    freeText: "",
    serialisedFilters: null,
  },
  fetchAppsFromServer: (...args: any[]) => mockFetchApps(...args),
  fetchFiltersFromServer: (...args: any[]) => mockFetchFilters(...args),
  fetchRootSpanNamesFromServer: (...args: any[]) =>
    mockFetchRootSpanNames(...args),
  saveListFiltersToServer: jest.fn(() => Promise.resolve(null)),
  buildShortFiltersPostBody: jest.fn(() => null),
}));

// --- Sub-component mocks ---

jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  default: ({ title, items, initialSelected, onChangeSelected }: any) => (
    <div data-testid={`dropdown-${title}`}>
      <span data-testid={`dropdown-${title}-selected`}>
        {typeof initialSelected === "string"
          ? initialSelected
          : JSON.stringify(initialSelected)}
      </span>
      <button
        data-testid={`dropdown-${title}-trigger`}
        onClick={() => {
          // For tests that need to simulate selection, we expose onChangeSelected
          // Tests can call it directly via the element's dataset
        }}
      />
    </div>
  ),
  DropdownSelectType: {
    SingleString: "SingleString",
    MultiString: "MultiString",
    MultiAppVersion: "MultiAppVersion",
    SingleAppVersion: "SingleAppVersion",
    MultiOsVersion: "MultiOsVersion",
    SingleOsVersion: "SingleOsVersion",
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
  default: ({ id, placeholder, initialValue, onChange }: any) => (
    <input
      data-testid={`debounce-input-${id}`}
      placeholder={placeholder}
      defaultValue={initialValue}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

jest.mock("@/app/components/user_def_attr_selector", () => ({
  __esModule: true,
  default: ({ attrs, ops, initialSelected, onChangeSelected }: any) => (
    <div data-testid="ud-attr-selector">
      <span data-testid="ud-attr-count">{initialSelected?.length ?? 0}</span>
    </div>
  ),
  UdAttrMatcher: {},
}));

jest.mock("@/app/components/input", () => ({
  __esModule: true,
  Input: (props: any) => (
    <input {...props} data-testid={`input-${props.type}`} />
  ),
}));

jest.mock("@/app/stores/provider", () => {
  const { useStore } = jest.requireActual("zustand");
  const { createFiltersStore } = jest.requireActual(
    "@/app/stores/filters_store",
  );
  const vanillaStore = createFiltersStore();
  // Create a hook that delegates to the vanilla store
  function useFiltersStore(selector?: any) {
    return useStore(vanillaStore, selector ?? ((s: any) => s));
  }
  // Expose vanilla store methods on the hook for test-side usage
  useFiltersStore.getState = () => vanillaStore.getState();
  useFiltersStore.setState = (partial: any) => vanillaStore.setState(partial);
  useFiltersStore.subscribe = (listener: any) =>
    vanillaStore.subscribe(listener);
  return { __esModule: true, useFiltersStore };
});

// --- Imports (must be after jest.mock) ---

import {
  AppsApiStatus,
  FiltersApiStatus,
  FilterSource,
  RootSpanNamesApiStatus,
} from "@/app/api/api_calls";
import Filters, {
  AppVersionsInitialSelectionType,
  Filters as FiltersType,
} from "@/app/components/filters";
const { useFiltersStore } = require("@/app/stores/provider") as any;

// --- Mock factories ---

function mockApp(overrides: Record<string, any> = {}) {
  return {
    id: "app-1",
    team_id: "team-1",
    name: "Test App",
    api_key: {
      created_at: "2024-01-01",
      key: "key-1",
      last_seen: null,
      revoked: false,
    },
    onboarded: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    os_name: "android",
    onboarded_at: "2024-01-01",
    unique_identifier: "com.test.app",
    ...overrides,
  };
}

function mockAppsSuccess(apps = [mockApp()]) {
  return Promise.resolve({ status: AppsApiStatus.Success, data: apps });
}

function mockAppsError() {
  return Promise.resolve({ status: AppsApiStatus.Error, data: null });
}

function mockAppsNoApps() {
  return Promise.resolve({ status: AppsApiStatus.NoApps, data: null });
}

function mockFiltersSuccess(overrides: Record<string, any> = {}) {
  return Promise.resolve({
    status: FiltersApiStatus.Success,
    data: {
      versions: [
        { name: "1.0", code: "1" },
        { name: "2.0", code: "2" },
      ],
      os_versions: [{ name: "android", version: "33" }],
      countries: ["US", "IN"],
      network_providers: ["Verizon"],
      network_types: ["WiFi"],
      network_generations: ["4G"],
      locales: ["en_US"],
      device_manufacturers: ["Samsung"],
      device_names: ["Galaxy S21"],
      ud_attrs: { key_types: [], operator_types: {} },
      ...overrides,
    },
  });
}

function mockFiltersError() {
  return Promise.resolve({ status: FiltersApiStatus.Error, data: null });
}

function mockFiltersNoData() {
  return Promise.resolve({ status: FiltersApiStatus.NoData, data: null });
}

function mockFiltersNotOnboarded() {
  return Promise.resolve({ status: FiltersApiStatus.NotOnboarded, data: null });
}

function mockRootSpanNamesSuccess(names = ["trace-1", "trace-2"]) {
  return Promise.resolve({
    status: RootSpanNamesApiStatus.Success,
    data: { results: names },
  });
}

function mockRootSpanNamesError() {
  return Promise.resolve({ status: RootSpanNamesApiStatus.Error, data: null });
}

function mockRootSpanNamesNoData() {
  return Promise.resolve({ status: RootSpanNamesApiStatus.NoData, data: null });
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
  const mergedProps = defaultProps(props);
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Filters {...(mergedProps as any)} />);
  });
  return { ...result!, props: mergedProps };
}

function getFilters(): FiltersType {
  return useFiltersStore.getState().filters;
}

// --- Session storage mock ---

let sessionStorageData: Record<string, string> = {};

beforeEach(() => {
  useFiltersStore.getState().reset(true);
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
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe("Filters", () => {
  // --- Apps API states ---

  describe("Apps API states", () => {
    it("shows loading spinner while apps are being fetched", async () => {
      mockFetchApps.mockReturnValue(new Promise(() => {})); // never resolves
      await act(async () => {
        render(<Filters {...(defaultProps() as any)} />);
      });
      expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(0);
    });

    it("shows error message when apps API returns error", async () => {
      mockFetchApps.mockReturnValue(mockAppsError());
      await renderFilters();
      await waitFor(() => {
        expect(screen.getByText(/Error fetching apps/)).toBeInTheDocument();
      });
    });

    it('shows "create first app" as plain text when on /apps path', async () => {
      mockPathname = "/team-1/apps";
      mockFetchApps.mockReturnValue(mockAppsNoApps());
      await renderFilters();
      await waitFor(() => {
        expect(screen.getByText(/creating your first app/)).toBeInTheDocument();
        expect(
          screen.queryByRole("link", { name: /creating your first app/ }),
        ).not.toBeInTheDocument();
      });
    });

    it('shows "create first app" as link when not on /apps path', async () => {
      mockPathname = "/team-1/overview";
      mockFetchApps.mockReturnValue(mockAppsNoApps());
      await renderFilters();
      await waitFor(() => {
        const link = screen.getByRole("link", {
          name: /creating your first app/,
        });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "apps");
      });
    });

    it("calls fetchAppsFromServer with the teamId prop", async () => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ teamId: "my-team" });
      expect(mockFetchApps).toHaveBeenCalledWith("my-team");
    });
  });

  // --- Filters API states ---

  describe("Filters API states", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
    });

    it("calls fetchFiltersFromServer with the selected app and filterSource", async () => {
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ filterSource: FilterSource.Crashes });
      await waitFor(() => {
        expect(mockFetchFilters).toHaveBeenCalledTimes(1);
        const [app, source] = mockFetchFilters.mock.calls[0];
        expect(app.id).toBe("app-1");
        expect(source).toBe(FilterSource.Crashes);
      });
    });

    it("shows loading spinner alongside app selector while filters load", async () => {
      mockFetchFilters.mockReturnValue(new Promise(() => {}));
      await renderFilters();
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
        expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(
          0,
        );
      });
    });

    it("shows error message when filters API returns error", async () => {
      mockFetchFilters.mockReturnValue(mockFiltersError());
      await renderFilters();
      await waitFor(() => {
        expect(screen.getByText(/Error fetching filters/)).toBeInTheDocument();
      });
    });

    it('shows "no data" message when NoData and showNoData is true', async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNoData());
      await renderFilters({ showNoData: true });
      await waitFor(() => {
        expect(screen.getByText(/No.*data.*received/i)).toBeInTheDocument();
      });
    });

    it('does not show "no data" message when NoData and showNoData is false', async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNoData());
      await renderFilters({ showNoData: false });
      await waitFor(() => {
        expect(screen.queryByText(/No.*received/i)).not.toBeInTheDocument();
      });
    });

    it('shows "no crashes" when filterSource is Crashes and NoData', async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNoData());
      await renderFilters({
        showNoData: true,
        filterSource: FilterSource.Crashes,
      });
      await waitFor(() => {
        expect(screen.getByText(/No.*crashes.*received/i)).toBeInTheDocument();
      });
    });

    it('shows "no ANRs" when filterSource is Anrs and NoData', async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNoData());
      await renderFilters({
        showNoData: true,
        filterSource: FilterSource.Anrs,
      });
      await waitFor(() => {
        expect(screen.getByText(/No.*ANRs.*received/i)).toBeInTheDocument();
      });
    });

    it("renders Onboarding when NotOnboarded and showNotOnboarded is true", async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNotOnboarded());
      await renderFilters({ showNotOnboarded: true });
      await waitFor(() => {
        expect(screen.getByTestId("onboarding-mock")).toBeInTheDocument();
      });
    });

    it("does not render Onboarding when NotOnboarded and showNotOnboarded is false", async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNotOnboarded());
      await renderFilters({ showNotOnboarded: false });
      await waitFor(() => {
        expect(screen.queryByTestId("onboarding-mock")).not.toBeInTheDocument();
      });
    });

    it("clears all filters to defaults when filters API returns error", async () => {
      mockFetchFilters.mockReturnValue(mockFiltersError());
      await renderFilters({
        showNoData: false,
        showNotOnboarded: false,
        showCountries: true,
        showFreeText: true,
      });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.versions.selected).toEqual([]);
        expect(filters.countries.selected).toEqual([]);
        expect(filters.osVersions.selected).toEqual([]);
        expect(filters.freeText).toBe("");
        expect(filters.udAttrMatchers).toEqual([]);
      });
    });

    it("clears all filters to defaults when filters API returns NoData", async () => {
      mockFetchFilters.mockReturnValue(mockFiltersNoData());
      await renderFilters({ showNoData: false, showNotOnboarded: false });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.versions.selected).toEqual([]);
        expect(filters.countries.selected).toEqual([]);
        expect(filters.spanStatuses.selected).toEqual([]);
        expect(filters.bugReportStatuses.selected).toEqual([]);
      });
    });
  });

  // --- Root span names API states ---

  describe("Root span names API states (filterSource=Spans)", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("shows loading spinner while root span names load", async () => {
      mockFetchRootSpanNames.mockReturnValue(new Promise(() => {}));
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(
          0,
        );
      });
    });

    it("shows error message when root span names API returns error", async () => {
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesError());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(
          screen.getByText(/Error fetching traces list/),
        ).toBeInTheDocument();
      });
    });

    it('shows "no traces" message when NoData', async () => {
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesNoData());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(screen.getByText(/No traces received/)).toBeInTheDocument();
      });
    });

    it("renders Trace Name dropdown on success", async () => {
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesSuccess());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Trace Name")).toBeInTheDocument();
      });
    });
  });

  // --- App selection priority ---

  describe("App selection priority", () => {
    const app1 = mockApp({ id: "app-1", name: "App One" });
    const app2 = mockApp({ id: "app-2", name: "App Two" });
    const app3 = mockApp({ id: "app-3", name: "App Three" });
    const apps = [app1, app2, app3];

    beforeEach(() => {
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("selects app from URL filters when appId is in URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-2");
      mockFetchApps.mockReturnValue(mockAppsSuccess(apps));
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-2");
      });
    });

    it("selects app from appId prop when no URL param", async () => {
      mockFetchApps.mockReturnValue(mockAppsSuccess(apps));
      await renderFilters({ appId: "app-2" });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-2");
      });
    });

    it("preserves the previously selected app from the store across re-mounts", async () => {
      // Seed the store as if app-2 was selected on a previous page.
      useFiltersStore.setState({ selectedApp: app2 } as any);
      mockFetchApps.mockReturnValue(mockAppsSuccess(apps));
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-2");
      });
    });

    it("falls back to first app when previously selected app no longer exists", async () => {
      useFiltersStore.setState({ selectedApp: { id: "deleted-app" } as any });
      mockFetchApps.mockReturnValue(mockAppsSuccess(apps));
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-1");
      });
    });

    it("falls back to first app when no other source available", async () => {
      mockFetchApps.mockReturnValue(mockAppsSuccess(apps));
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-1");
      });
    });
  });

  // --- Filter readiness ---

  describe("Filter readiness", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
    });

    describe("when showNoData=true and showNotOnboarded=true", () => {
      it("sets ready=true when filtersApiStatus is Success", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersSuccess());
        await renderFilters({ showNoData: true, showNotOnboarded: true });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(true);
        });
      });

      it("sets ready=false when filtersApiStatus is NoData", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersNoData());
        await renderFilters({ showNoData: true, showNotOnboarded: true });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(false);
        });
      });

      it("sets ready=false when filtersApiStatus is NotOnboarded", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersNotOnboarded());
        await renderFilters({ showNoData: true, showNotOnboarded: true });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(false);
        });
      });
    });

    describe("when only showNoData is true", () => {
      it("sets ready=true when filtersApiStatus is NotOnboarded", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersNotOnboarded());
        await renderFilters({ showNoData: true, showNotOnboarded: false });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(true);
        });
      });
    });

    describe("when only showNotOnboarded is true", () => {
      it("sets ready=true when filtersApiStatus is NoData", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersNoData());
        await renderFilters({ showNoData: false, showNotOnboarded: true });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(true);
        });
      });
    });

    describe("when neither showNoData nor showNotOnboarded", () => {
      it("sets ready=true when filtersApiStatus is NoData", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersNoData());
        await renderFilters({ showNoData: false, showNotOnboarded: false });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(true);
        });
      });

      it("sets ready=true when filtersApiStatus is NotOnboarded", async () => {
        mockFetchFilters.mockReturnValue(mockFiltersNotOnboarded());
        await renderFilters({ showNoData: false, showNotOnboarded: false });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(true);
        });
      });
    });

    describe("Span-specific readiness", () => {
      it("sets ready=false when filterSource is Spans and rootSpanNames is not Success", async () => {
        mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesNoData());
        mockFetchFilters.mockReturnValue(mockFiltersSuccess());
        await renderFilters({
          filterSource: FilterSource.Spans,
          showNoData: true,
          showNotOnboarded: true,
        });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(false);
        });
      });

      it("sets ready=true when filterSource is Spans and both filters and rootSpanNames succeed", async () => {
        mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesSuccess());
        mockFetchFilters.mockReturnValue(mockFiltersSuccess());
        await renderFilters({
          filterSource: FilterSource.Spans,
          showNoData: true,
          showNotOnboarded: true,
        });
        await waitFor(() => {
          const filters = getFilters();
          expect(filters.ready).toBe(true);
        });
      });
    });
  });

  // --- Conditional rendering (show* flags) ---

  describe("Conditional rendering (show* flags)", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("renders App Name dropdown when showAppSelector is true", async () => {
      await renderFilters({ showAppSelector: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-App Name")).toBeInTheDocument();
      });
    });

    it("does not render App Name dropdown when showAppSelector is false", async () => {
      await renderFilters({ showAppSelector: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-App Name"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Date Range dropdown when showDates is true", async () => {
      await renderFilters({ showDates: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Date Range")).toBeInTheDocument();
      });
    });

    it("does not render Date Range dropdown when showDates is false", async () => {
      await renderFilters({ showDates: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Date Range"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders App versions dropdown when showAppVersions is true", async () => {
      await renderFilters({ showAppVersions: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-App versions")).toBeInTheDocument();
      });
    });

    it("does not render App versions dropdown when showAppVersions is false", async () => {
      await renderFilters({ showAppVersions: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-App versions"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders OS Versions dropdown when showOsVersions is true and data exists", async () => {
      await renderFilters({ showOsVersions: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-OS Versions")).toBeInTheDocument();
      });
    });

    it("does not render OS Versions dropdown when showOsVersions is false", async () => {
      await renderFilters({ showOsVersions: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-OS Versions"),
        ).not.toBeInTheDocument();
      });
    });

    it("does not render OS Versions dropdown when showOsVersions is true but no data", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({ os_versions: null }),
      );
      await renderFilters({ showOsVersions: true });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-OS Versions"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Session Types dropdown when showSessionTypes is true", async () => {
      await renderFilters({ showSessionTypes: true });
      await waitFor(() => {
        expect(
          screen.getByTestId("dropdown-Session Types"),
        ).toBeInTheDocument();
      });
    });

    it("does not render Session Types dropdown when showSessionTypes is false", async () => {
      await renderFilters({ showSessionTypes: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Session Types"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Country dropdown when showCountries is true and data exists", async () => {
      await renderFilters({ showCountries: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Country")).toBeInTheDocument();
      });
    });

    it("does not render Country dropdown when showCountries is false", async () => {
      await renderFilters({ showCountries: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Country"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Network Provider dropdown when showNetworkProviders is true and data exists", async () => {
      await renderFilters({ showNetworkProviders: true });
      await waitFor(() => {
        expect(
          screen.getByTestId("dropdown-Network Provider"),
        ).toBeInTheDocument();
      });
    });

    it("does not render Network Provider dropdown when showNetworkProviders is false", async () => {
      await renderFilters({ showNetworkProviders: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Network Provider"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Network type dropdown when showNetworkTypes is true and data exists", async () => {
      await renderFilters({ showNetworkTypes: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Network type")).toBeInTheDocument();
      });
    });

    it("renders Network generation dropdown when showNetworkGenerations is true and data exists", async () => {
      await renderFilters({ showNetworkGenerations: true });
      await waitFor(() => {
        expect(
          screen.getByTestId("dropdown-Network generation"),
        ).toBeInTheDocument();
      });
    });

    it("renders Locale dropdown when showLocales is true and data exists", async () => {
      await renderFilters({ showLocales: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Locale")).toBeInTheDocument();
      });
    });

    it("renders Device Manufacturer dropdown when showDeviceManufacturers is true and data exists", async () => {
      await renderFilters({ showDeviceManufacturers: true });
      await waitFor(() => {
        expect(
          screen.getByTestId("dropdown-Device Manufacturer"),
        ).toBeInTheDocument();
      });
    });

    it("renders Device Name dropdown when showDeviceNames is true and data exists", async () => {
      await renderFilters({ showDeviceNames: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Device Name")).toBeInTheDocument();
      });
    });

    it("does not render Device Name dropdown when showDeviceNames is false", async () => {
      await renderFilters({ showDeviceNames: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Device Name"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Bug Report Status dropdown when showBugReportStatus is true", async () => {
      await renderFilters({ showBugReportStatus: true });
      await waitFor(() => {
        expect(
          screen.getByTestId("dropdown-Bug Report Status"),
        ).toBeInTheDocument();
      });
    });

    it("does not render Bug Report Status dropdown when showBugReportStatus is false", async () => {
      await renderFilters({ showBugReportStatus: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Bug Report Status"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders HTTP Method dropdown when showHttpMethods is true", async () => {
      await renderFilters({ showHttpMethods: true });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-HTTP Method")).toBeInTheDocument();
      });
    });

    it("does not render HTTP Method dropdown when showHttpMethods is false", async () => {
      await renderFilters({ showHttpMethods: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-HTTP Method"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders UdAttr selector when showUdAttrs is true and attrs exist", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          ud_attrs: {
            key_types: [{ key: "user_id", type: "string" }],
            operator_types: { string: ["eq", "neq"] },
          },
        }),
      );
      await renderFilters({ showUdAttrs: true });
      await waitFor(() => {
        expect(screen.getByTestId("ud-attr-selector")).toBeInTheDocument();
      });
    });

    it("does not render UdAttr selector when showUdAttrs is false", async () => {
      await renderFilters({ showUdAttrs: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("ud-attr-selector"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders free text input when showFreeText is true", async () => {
      await renderFilters({ showFreeText: true });
      await waitFor(() => {
        expect(
          screen.getByTestId("debounce-input-free-text"),
        ).toBeInTheDocument();
      });
    });

    it("does not render free text input when showFreeText is false", async () => {
      await renderFilters({ showFreeText: false });
      await waitFor(() => {
        expect(
          screen.queryByTestId("debounce-input-free-text"),
        ).not.toBeInTheDocument();
      });
    });

    it("uses custom freeTextPlaceholder when provided", async () => {
      await renderFilters({
        showFreeText: true,
        freeTextPlaceholder: "Search traces...",
      });
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search traces..."),
        ).toBeInTheDocument();
      });
    });

    it("uses default placeholder when freeTextPlaceholder is not provided", async () => {
      await renderFilters({ showFreeText: true });
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search anything..."),
        ).toBeInTheDocument();
      });
    });
  });

  // --- Pill display ---

  describe("Pill display", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("renders date range pill when showDates is true", async () => {
      await renderFilters({ showDates: true });
      await waitFor(() => {
        const pills = screen.getAllByTestId("pill");
        const datePill = pills.find((p) => p.textContent?.includes(" to "));
        expect(datePill).toBeTruthy();
      });
    });

    it("renders version pill with display names", async () => {
      await renderFilters({ showAppVersions: true });
      await waitFor(() => {
        const pills = screen.getAllByTestId("pill");
        const versionPill = pills.find((p) =>
          p.textContent?.includes("1.0 (1)"),
        );
        expect(versionPill).toBeTruthy();
      });
    });

    it("renders root span name pill when filterSource is Spans", async () => {
      mockFetchRootSpanNames.mockReturnValue(
        mockRootSpanNamesSuccess(["my-trace"]),
      );
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        const pills = screen.getAllByTestId("pill");
        const spanPill = pills.find((p) => p.textContent === "my-trace");
        expect(spanPill).toBeTruthy();
      });
    });

    it("does not render free text pill when text is empty", async () => {
      await renderFilters({ showFreeText: true });
      await waitFor(() => {
        const pills = screen.getAllByTestId("pill");
        const freeTextPill = pills.find((p) =>
          p.textContent?.includes("Search Text:"),
        );
        expect(freeTextPill).toBeUndefined();
      });
    });
  });

  // --- Version selection behaviour ---

  describe("Version selection behaviour", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
    });

    it("selects only first version when type is Latest", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
            { name: "3.0", code: "3" },
          ],
        }),
      );
      await renderFilters({
        appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
      });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.versions.selected).toHaveLength(1);
        expect(filters.versions.selected[0].name).toBe("1.0");
        expect(filters.versions.all).toBe(false);
      });
    });

    it("selects all versions when type is All", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
          ],
        }),
      );
      await renderFilters({
        appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
      });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.versions.selected).toHaveLength(2);
        expect(filters.versions.all).toBe(true);
      });
    });
  });

  // --- Default initial filter values ---

  describe("Default initial filter values", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("selects all session types except Background by default", async () => {
      await renderFilters({ showSessionTypes: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.sessionTypes.selected).toContain("Crash Sessions");
        expect(filters.sessionTypes.selected).toContain("ANR Sessions");
        expect(filters.sessionTypes.selected).toContain("Bug Report Sessions");
        expect(filters.sessionTypes.selected).toContain("Foreground Sessions");
        expect(filters.sessionTypes.selected).toContain(
          "User Interaction Sessions",
        );
        expect(filters.sessionTypes.selected).not.toContain(
          "Background Sessions",
        );
      });
    });

    it("selects only Open bug report status by default", async () => {
      await renderFilters({ showBugReportStatus: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.bugReportStatuses.selected).toEqual(["Open"]);
        expect(filters.bugReportStatuses.all).toBe(false);
      });
    });

    it("selects all HTTP methods by default", async () => {
      await renderFilters({ showHttpMethods: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.httpMethods.selected).toEqual([
          "get",
          "post",
          "put",
          "patch",
          "delete",
        ]);
        expect(filters.httpMethods.all).toBe(true);
      });
    });

    it("selects all span statuses when filterSource is Spans", async () => {
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesSuccess());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.spanStatuses.selected).toEqual(["Unset", "Ok", "Error"]);
        expect(filters.spanStatuses.all).toBe(true);
      });
    });

    it("selects no span statuses when filterSource is not Spans", async () => {
      await renderFilters({ filterSource: FilterSource.Events });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.spanStatuses.selected).toEqual([]);
      });
    });

    it("selects all OS versions by default", async () => {
      await renderFilters({ showOsVersions: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.osVersions.selected).toHaveLength(1);
        expect(filters.osVersions.all).toBe(true);
      });
    });
  });

  // --- Filters store updates ---

  describe("Filters store updates", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("writes the selected app to the store", async () => {
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app).not.toBeNull();
        expect(filters.app?.id).toBe("app-1");
      });
    });

    it("sets all=true when all items of a filter are selected", async () => {
      await renderFilters({ showCountries: true });
      await waitFor(() => {
        const filters = getFilters();
        // By default, all countries are selected
        expect(filters.countries.all).toBe(true);
        expect(filters.countries.selected).toEqual(["US", "IN"]);
      });
    });

    it("sets all=false when a subset is selected (versions with Latest)", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
          ],
        }),
      );
      await renderFilters({
        appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
      });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.versions.all).toBe(false);
      });
    });

    it("includes non-null serialisedFilters", async () => {
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.serialisedFilters).not.toBeNull();
        expect(typeof filters.serialisedFilters).toBe("string");
        expect(filters.serialisedFilters!.length).toBeGreaterThan(0);
      });
    });
  });

  // --- URL serialization (via serialisedFilters) ---

  describe("URL serialization (via serialisedFilters)", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it('uses minified key "a" for app id', async () => {
      await renderFilters({ showAppSelector: true });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        expect(params.get("a")).toBe("app-1");
      });
    });

    it('uses minified key "d" for date range', async () => {
      await renderFilters({ showDates: true });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        expect(params.has("d")).toBe(true);
      });
    });

    it("compresses consecutive version indices into ranges", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
            { name: "3.0", code: "3" },
          ],
        }),
      );
      await renderFilters({
        appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
      });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        // 3 consecutive versions (indices 0,1,2) should be compressed to "0-2"
        expect(params.get("v")).toBe("0-2");
      });
    });

    it("serialises non-consecutive indices as comma-separated values", async () => {
      // Restore versions 0 and 2 (skipping 1) from URL so they get re-serialised
      mockSearchParams = new URLSearchParams("a=app-1&v=0,2");
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
            { name: "3.0", code: "3" },
          ],
        }),
      );
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        // Non-consecutive indices 0,2 should stay as "0,2" (not a range)
        expect(params.get("v")).toBe("0,2");
      });
    });

    it("omits rootSpanName and spanStatuses from serialisation when filterSource is not Spans", async () => {
      await renderFilters({ filterSource: FilterSource.Events });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        expect(params.has("r")).toBe(false); // rootSpanName
        expect(params.has("ss")).toBe(false); // spanStatuses
      });
    });

    it("omits keys for filters whose show* flag is false", async () => {
      await renderFilters({
        showCountries: false,
        showLocales: false,
        showFreeText: false,
      });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        expect(params.has("c")).toBe(false); // countries
        expect(params.has("l")).toBe(false); // locales
        expect(params.has("ft")).toBe(false); // freeText
      });
    });

    it("serialises udAttrMatchers with tilde and pipe delimiters", async () => {
      // Set up URL with udAttrMatchers so they get restored and then re-serialised
      const ud = "user_id~string~eq~abc123";
      mockSearchParams = new URLSearchParams(`a=app-1&ud=${ud}`);
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          ud_attrs: {
            key_types: [{ key: "user_id", type: "string" }],
            operator_types: { string: ["eq", "neq"] },
          },
        }),
      );
      await renderFilters({ showUdAttrs: true });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        const udParam = params.get("ud");
        expect(udParam).toBeTruthy();
        // Should contain tilde-separated fields
        expect(udParam).toContain("~");
        expect(udParam).toContain("user_id");
        expect(udParam).toContain("eq");
        expect(udParam).toContain("abc123");
      });
    });

    it('serialises session types with minified key "st"', async () => {
      await renderFilters({ showSessionTypes: true });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        expect(params.has("st")).toBe(true);
        expect(params.get("st")).toContain("Crash Sessions");
      });
    });

    it("omits keys for empty arrays", async () => {
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          countries: null,
          network_providers: null,
        }),
      );
      await renderFilters({ showCountries: true, showNetworkProviders: true });
      await waitFor(() => {
        const filters = getFilters();
        const params = new URLSearchParams(filters.serialisedFilters!);
        expect(params.has("c")).toBe(false);
        expect(params.has("np")).toBe(false);
      });
    });
  });

  // --- URL deserialization and restoration ---

  describe("URL deserialization and restoration", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
    });

    it("restores version selection from URL with range expansion", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&v=0-1");
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
            { name: "3.0", code: "3" },
          ],
        }),
      );
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.versions.selected).toHaveLength(2);
        expect(filters.versions.selected[0].name).toBe("1.0");
        expect(filters.versions.selected[1].name).toBe("2.0");
      });
    });

    it("filters out out-of-bounds indices", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&v=0-5");
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
          ],
        }),
      );
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        // Only indices 0 and 1 are valid
        expect(filters.versions.selected).toHaveLength(2);
      });
    });

    it("restores country selection from URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&c=0");
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          countries: ["US", "IN", "GB"],
        }),
      );
      await renderFilters({ showCountries: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.countries.selected).toEqual(["US"]);
        expect(filters.countries.all).toBe(false);
      });
    });

    it("restores freeText from URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&ft=hello+world");
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ showFreeText: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.freeText).toBe("hello world");
      });
    });

    it("restores sessionTypes from URL, ignoring invalid values", async () => {
      mockSearchParams = new URLSearchParams(
        "a=app-1&st=Crash Sessions,InvalidType,ANR Sessions",
      );
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ showSessionTypes: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.sessionTypes.selected).toEqual([
          "Crash Sessions",
          "ANR Sessions",
        ]);
      });
    });

    it("restores spanStatuses from URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&ss=Ok,Error");
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.spanStatuses.selected).toEqual(["Ok", "Error"]);
      });
    });

    it("restores bugReportStatuses from URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&bs=Closed");
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ showBugReportStatus: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.bugReportStatuses.selected).toEqual(["Closed"]);
      });
    });

    it("restores httpMethods from URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&hm=get,post");
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ showHttpMethods: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.httpMethods.selected).toEqual(["get", "post"]);
      });
    });

    it("restores root span name from URL", async () => {
      mockSearchParams = new URLSearchParams("a=app-1&r=my-custom-trace");
      mockFetchRootSpanNames.mockReturnValue(
        mockRootSpanNamesSuccess(["my-custom-trace", "other-trace"]),
      );
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.rootSpanName).toBe("my-custom-trace");
      });
    });

    it("restores udAttrMatchers from URL with validation", async () => {
      // Encode: key~type~op~value separated by |
      const ud =
        encodeURIComponent("user_id") +
        "~" +
        encodeURIComponent("string") +
        "~" +
        encodeURIComponent("eq") +
        "~" +
        encodeURIComponent("abc123");
      mockSearchParams = new URLSearchParams(`a=app-1&ud=${ud}`);
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          ud_attrs: {
            key_types: [{ key: "user_id", type: "string" }],
            operator_types: { string: ["eq", "neq", "contains"] },
          },
        }),
      );
      await renderFilters({ showUdAttrs: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.udAttrMatchers).toHaveLength(1);
        expect(filters.udAttrMatchers[0].key).toBe("user_id");
        expect(filters.udAttrMatchers[0].op).toBe("eq");
        expect(filters.udAttrMatchers[0].value).toBe("abc123");
      });
    });

    it("filters out udAttrMatchers with invalid key or op from URL", async () => {
      // Two matchers: one valid (user_id eq abc), one with invalid op (user_id badop xyz)
      const validMatcher = "user_id~string~eq~abc";
      const invalidOpMatcher = "user_id~string~badop~xyz";
      mockSearchParams = new URLSearchParams(
        `a=app-1&ud=${validMatcher}|${invalidOpMatcher}`,
      );
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          ud_attrs: {
            key_types: [{ key: "user_id", type: "string" }],
            operator_types: { string: ["eq", "neq"] },
          },
        }),
      );
      await renderFilters({ showUdAttrs: true });
      await waitFor(() => {
        const filters = getFilters();
        // Only the valid matcher should remain
        expect(filters.udAttrMatchers).toHaveLength(1);
        expect(filters.udAttrMatchers[0].op).toBe("eq");
      });
    });

    it("only applies URL filters when URL appId matches selected app", async () => {
      // URL has app-2's id with version filter v=0, but we select app-1 via prop.
      // Since URL appId (app-2) != selected app (app-1), the version filter from URL should be ignored.
      const app1 = mockApp({ id: "app-1", name: "App One" });
      const app2 = mockApp({ id: "app-2", name: "App Two" });
      mockSearchParams = new URLSearchParams("a=app-2&v=0");
      mockFetchApps.mockReturnValue(mockAppsSuccess([app1, app2]));
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({
          versions: [
            { name: "1.0", code: "1" },
            { name: "2.0", code: "2" },
            { name: "3.0", code: "3" },
          ],
        }),
      );
      await renderFilters({
        appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
      });
      await waitFor(() => {
        const filters = getFilters();
        // App-2 is selected from URL, and since URL appId matches, v=0 applies:
        // only version at index 0 is selected
        expect(filters.app?.id).toBe("app-2");
        expect(filters.versions.selected).toHaveLength(1);
        expect(filters.versions.selected[0].name).toBe("1.0");
      });
    });
  });

  // --- Date range handling ---

  describe("Date range handling", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("defaults to Last6Hours when no URL or session date range", async () => {
      await renderFilters({ showDates: true });
      await waitFor(() => {
        const filters = getFilters();
        // Start date should be approximately 6 hours before end date
        const start = new Date(filters.startDate).getTime();
        const end = new Date(filters.endDate).getTime();
        const diffHours = (end - start) / (1000 * 60 * 60);
        expect(diffHours).toBeGreaterThan(5.9);
        expect(diffHours).toBeLessThan(6.1);
      });
    });

    it("uses URL date range over the existing store date range", async () => {
      useFiltersStore.setState({
        selectedDateRange: "Last 24 Hours",
        selectedStartDate: "2024-01-01T00:00:00.000Z",
        selectedEndDate: "2024-01-02T00:00:00.000Z",
      } as any);
      mockSearchParams = new URLSearchParams("d=Last Week");
      await renderFilters({ showDates: true });
      await waitFor(() => {
        const filters = getFilters();
        const start = new Date(filters.startDate).getTime();
        const end = new Date(filters.endDate).getTime();
        const diffDays = (end - start) / (1000 * 60 * 60 * 24);
        // Last Week = ~7 days
        expect(diffDays).toBeGreaterThan(6.9);
        expect(diffDays).toBeLessThan(7.1);
      });
    });

    it("preserves the existing store date range when URL has none (cross-page nav)", async () => {
      // Simulate the user having selected Last 24 Hours on a previous page;
      // the store survives, the new page mounts without URL date params.
      useFiltersStore.setState({
        selectedDateRange: "Last 24 Hours",
        selectedStartDate: "2024-01-01T00:00:00.000Z",
        selectedEndDate: "2024-01-02T00:00:00.000Z",
      } as any);
      await renderFilters({ showDates: true });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.startDate).toBe("2024-01-01T00:00:00.000Z");
        expect(filters.endDate).toBe("2024-01-02T00:00:00.000Z");
      });
    });

    it("renders datetime-local inputs for Custom range", async () => {
      mockSearchParams = new URLSearchParams(
        "d=Custom+Range&sd=2024-01-01T00:00:00.000Z&ed=2024-01-02T00:00:00.000Z",
      );
      await renderFilters({ showDates: true });
      await waitFor(() => {
        const dateInputs = screen.getAllByTestId("input-datetime-local");
        expect(dateInputs.length).toBe(2);
      });
    });
  });

  // --- Store survives across re-mounts ---

  describe("Store survives across re-mounts", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("does not touch sessionStorage", async () => {
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-1");
      });
      expect(sessionStorageData["sessionPersistedFilters"]).toBeUndefined();
    });

    it("reuses the previously selected app from the store on re-mount", async () => {
      const app2 = mockApp({ id: "app-2", name: "Second App" });
      mockFetchApps.mockReturnValue(mockAppsSuccess([mockApp(), app2]));
      useFiltersStore.setState({ selectedApp: app2 } as any);
      await renderFilters();
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-2");
      });
    });
  });

  // --- Effect ordering: setConfig must run before fetchApps+selectApp ---
  // Regression guard for the cross-page navigation flow. If the two
  // useEffects in filters.tsx are reordered (mount/team before
  // config-sync), selectApp.applyFilterOptions would preserve the
  // previous page's selections and setConfig's wipe would land after,
  // leaving the UI with empty per-page selections.
  describe("Cross-source navigation effect order", () => {
    it("applies new-source defaults on remount with a different filterSource", async () => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());

      // First page (Events) returns one set of countries. User narrows
      // selectedCountries to ['US'].
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({ countries: ["US", "IN"] }),
      );
      const { unmount } = await renderFilters({
        filterSource: FilterSource.Events,
      });
      await waitFor(() => {
        expect(getFilters().countries.all).toBe(true);
      });
      await act(async () => {
        useFiltersStore.getState().setSelectedCountries(["US"]);
      });
      expect(useFiltersStore.getState().selectedCountries).toEqual(["US"]);
      unmount();

      // Second page (Crashes) returns a different country set. With the
      // correct effect order, setConfig wipes per-page selections first,
      // then selectApp.applyFilterOptions installs Crashes' defaults
      // (all countries selected). A regression would leave the UI with
      // empty selectedCountries (preserved-then-wiped).
      mockFetchFilters.mockReturnValue(
        mockFiltersSuccess({ countries: ["US", "IN", "UK"] }),
      );
      await renderFilters({ filterSource: FilterSource.Crashes });
      await waitFor(() => {
        expect(getFilters().countries.all).toBe(true);
      });
      expect(useFiltersStore.getState().selectedCountries.length).toBe(3);
    });
  });

  // --- Imperative handle ---

  describe("Imperative handle", () => {
    beforeEach(() => {
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("re-fetches apps when ref.refresh() is called", async () => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      const ref = React.createRef<{ refresh: () => void }>();
      const props = defaultProps();
      await act(async () => {
        render(<Filters {...(props as any)} ref={ref} />);
      });
      await waitFor(() => {
        expect(mockFetchApps).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        ref.current?.refresh();
      });
      await waitFor(() => {
        expect(mockFetchApps).toHaveBeenCalledTimes(2);
      });
    });

    it("selects specified app via ref.refresh(appId)", async () => {
      const app1 = mockApp({ id: "app-1", name: "App One" });
      const app2 = mockApp({ id: "app-2", name: "App Two" });
      mockFetchApps.mockReturnValue(mockAppsSuccess([app1, app2]));

      const ref = React.createRef<{ refresh: (appId?: string) => void }>();
      const props = defaultProps();
      await act(async () => {
        render(<Filters {...(props as any)} ref={ref} />);
      });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-1");
      });
      await act(async () => {
        ref.current?.refresh("app-2");
      });
      await waitFor(() => {
        const filters = getFilters();
        expect(filters.app?.id).toBe("app-2");
      });
    });
  });

  // --- Span-specific behaviour ---

  describe("Span-specific behaviour", () => {
    beforeEach(() => {
      mockFetchApps.mockReturnValue(mockAppsSuccess());
      mockFetchFilters.mockReturnValue(mockFiltersSuccess());
    });

    it("fetches root span names when filterSource is Spans", async () => {
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesSuccess());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(mockFetchRootSpanNames).toHaveBeenCalled();
      });
    });

    it("does not fetch root span names when filterSource is Events", async () => {
      await renderFilters({ filterSource: FilterSource.Events });
      await waitFor(() => {
        expect(mockFetchRootSpanNames).not.toHaveBeenCalled();
      });
    });

    it("renders Span Status dropdown when filterSource is Spans", async () => {
      mockFetchRootSpanNames.mockReturnValue(mockRootSpanNamesSuccess());
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Span Status")).toBeInTheDocument();
      });
    });

    it("does not render Span Status dropdown when filterSource is Events", async () => {
      await renderFilters({ filterSource: FilterSource.Events });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Span Status"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders Trace Name dropdown when filterSource is Spans", async () => {
      mockFetchRootSpanNames.mockReturnValue(
        mockRootSpanNamesSuccess(["my-trace"]),
      );
      await renderFilters({ filterSource: FilterSource.Spans });
      await waitFor(() => {
        expect(screen.getByTestId("dropdown-Trace Name")).toBeInTheDocument();
      });
    });

    it("does not render Trace Name dropdown when filterSource is Events", async () => {
      await renderFilters({ filterSource: FilterSource.Events });
      await waitFor(() => {
        expect(
          screen.queryByTestId("dropdown-Trace Name"),
        ).not.toBeInTheDocument();
      });
    });
  });
});
