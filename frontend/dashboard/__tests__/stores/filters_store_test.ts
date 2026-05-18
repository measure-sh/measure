import { beforeEach, describe, expect, it } from "@jest/globals";

import {
  App,
  AppsApiStatus,
  AppVersion,
  BugReportStatus,
  FiltersApiStatus,
  FilterSource,
  HttpMethod,
  OsVersion,
  RootSpanNamesApiStatus,
  SessionType,
  SpanStatus,
} from "@/app/api/api_calls";

const mockFetchQuery = jest.fn((..._args: any[]) => Promise.resolve(null));
jest.mock("@/app/query/query_client", () => ({
  queryClient: { fetchQuery: (...args: any[]) => mockFetchQuery(...args) },
  SHORT_CODE_STALE_TIME: 5 * 60 * 1000,
}));

import {
  applyFilterOptions,
  AppVersionsInitialSelectionType,
  createFiltersStore,
  type FilterOptionsData,
  type InitConfig,
  pickApp,
  resolveRootSpanName,
} from "@/app/stores/filters_store";

function makeApp(id: string, overrides: Partial<App> = {}): App {
  return {
    id,
    team_id: "t1",
    name: `App ${id}`,
    api_key: {
      created_at: "",
      key: "k",
      last_seen: null,
      revoked: false,
    },
    onboarded: true,
    created_at: "",
    updated_at: "",
    os_name: "android",
    onboarded_at: null,
    unique_identifier: null,
    ...overrides,
  };
}

const baseConfig = {
  filterSource: FilterSource.Crashes,
  showNoData: false,
  showNotOnboarded: false,
  showAppSelector: true,
  showDates: true,
  showAppVersions: true,
  showOsVersions: true,
  showSessionTypes: true,
  showCountries: true,
  showNetworkProviders: true,
  showNetworkTypes: true,
  showNetworkGenerations: true,
  showLocales: true,
  showDeviceManufacturers: true,
  showDeviceNames: true,
  showBugReportStatus: true,
  showHttpMethods: true,
  showUdAttrs: true,
  showFreeText: true,
};

function emptyOptions(
  overrides: Partial<FilterOptionsData> = {},
): FilterOptionsData {
  return {
    versions: [],
    osVersions: [],
    countries: [],
    networkProviders: [],
    networkTypes: [],
    networkGenerations: [],
    locales: [],
    deviceManufacturers: [],
    deviceNames: [],
    userDefAttrs: [],
    userDefAttrOps: new Map(),
    ...overrides,
  };
}

function initConfig(urlFilters: any = {}, appId?: string): InitConfig {
  return {
    urlFilters,
    appId,
    appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
    filterSource: FilterSource.Crashes,
  };
}

beforeEach(() => {
  mockFetchQuery.mockClear();
});

describe("pickApp", () => {
  const apps = [makeApp("a"), makeApp("b"), makeApp("c")];

  it("picks the URL appId when present in apps", () => {
    const picked = pickApp(apps, initConfig({ appId: "b" }), null);
    expect(picked?.id).toBe("b");
  });

  it("falls back to prop appId when URL appId is missing", () => {
    const picked = pickApp(apps, initConfig({}, "c"), null);
    expect(picked?.id).toBe("c");
  });

  it("falls back to previously selected app when neither URL nor prop is set", () => {
    const picked = pickApp(apps, initConfig({}), makeApp("a"));
    expect(picked?.id).toBe("a");
  });

  it("falls back to the first app when no other hint is available", () => {
    const picked = pickApp(apps, initConfig({}), null);
    expect(picked?.id).toBe("a");
  });

  it("returns undefined when apps list is empty", () => {
    expect(pickApp([], initConfig({}), null)).toBeUndefined();
  });

  it("skips invalid URL appId and falls through to next priority", () => {
    const picked = pickApp(apps, initConfig({ appId: "no-such" }, "b"), null);
    expect(picked?.id).toBe("b");
  });
});

describe("resolveRootSpanName", () => {
  const app = makeApp("a");

  it("returns the URL rootSpanName when the URL appId matches", () => {
    expect(
      resolveRootSpanName(
        ["root.a", "root.b"],
        initConfig({ appId: "a", rootSpanName: "root.b" }),
        app,
      ),
    ).toBe("root.b");
  });

  it("falls back to first when URL rootSpanName is invalid for current data", () => {
    expect(
      resolveRootSpanName(
        ["root.a", "root.b"],
        initConfig({ appId: "a", rootSpanName: "missing" }),
        app,
      ),
    ).toBe("root.a");
  });

  it("returns first when no URL rootSpanName", () => {
    expect(resolveRootSpanName(["root.a", "root.b"], initConfig({}), app)).toBe(
      "root.a",
    );
  });
});

describe("applyFilterOptions", () => {
  const app = makeApp("a");

  function state(): any {
    return createFiltersStore().getState();
  }

  it("Latest selects the first version when nothing in URL", () => {
    const data = emptyOptions({
      versions: [new AppVersion("2.0", "200"), new AppVersion("1.0", "100")],
    });
    const cfg = {
      ...initConfig({}),
      appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
    };
    const patch = applyFilterOptions(data, app, cfg, state());
    expect(patch.selectedVersions).toEqual([data.versions[0]]);
  });

  it("All selects every version when nothing in URL", () => {
    const data = emptyOptions({
      versions: [new AppVersion("2.0", "200"), new AppVersion("1.0", "100")],
    });
    const cfg = {
      ...initConfig({}),
      appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
    };
    const patch = applyFilterOptions(data, app, cfg, state());
    expect(patch.selectedVersions).toEqual(data.versions);
  });

  it("uses URL version indices when the URL appId matches", () => {
    const data = emptyOptions({
      versions: [
        new AppVersion("2.0", "200"),
        new AppVersion("1.0", "100"),
        new AppVersion("0.9", "90"),
      ],
    });
    const patch = applyFilterOptions(
      data,
      app,
      initConfig({ appId: "a", versions: [0, 2] }),
      state(),
    );
    expect(patch.selectedVersions).toEqual([
      data.versions[0],
      data.versions[2],
    ]);
  });

  it("falls back to default versions when URL indices are all invalid", () => {
    const data = emptyOptions({
      versions: [new AppVersion("2.0", "200")],
    });
    const cfg = {
      ...initConfig({ appId: "a", versions: [99, 100] }),
      appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
    };
    const patch = applyFilterOptions(data, app, cfg, state());
    expect(patch.selectedVersions).toEqual(data.versions);
  });

  it("treats URL filters as applicable when appId is omitted (details pages)", () => {
    const data = emptyOptions({
      osVersions: [
        new OsVersion("android", "13"),
        new OsVersion("android", "14"),
        new OsVersion("android", "15"),
      ],
    });
    const patch = applyFilterOptions(
      data,
      app,
      initConfig({ osVersions: [0, 2] }),
      state(),
    );
    expect(patch.selectedOsVersions).toEqual([
      data.osVersions[0],
      data.osVersions[2],
    ]);
  });

  it("ignores URL filters when URL appId is for a different app", () => {
    const data = emptyOptions({
      osVersions: [
        new OsVersion("android", "13"),
        new OsVersion("android", "14"),
      ],
    });
    const patch = applyFilterOptions(
      data,
      app,
      initConfig({ appId: "other-app", osVersions: [0] }),
      state(),
    );
    expect(patch.selectedOsVersions).toEqual(data.osVersions);
  });

  it("defaults every index-based selection when no URL filters", () => {
    const data = emptyOptions({
      countries: ["US", "IN"],
      networkTypes: ["wifi", "4g"],
      locales: ["en-US"],
      deviceNames: ["Pixel 8"],
    });
    const patch = applyFilterOptions(data, app, initConfig({}), state());
    expect(patch.selectedCountries).toEqual(["US", "IN"]);
    expect(patch.selectedNetworkTypes).toEqual(["wifi", "4g"]);
    expect(patch.selectedLocales).toEqual(["en-US"]);
    expect(patch.selectedDeviceNames).toEqual(["Pixel 8"]);
  });

  it("filters out invalid udAttrMatchers from the URL", () => {
    const data = emptyOptions({
      userDefAttrs: [{ key: "plan", type: "string" }],
      userDefAttrOps: new Map([["string", ["eq"]]]),
    });
    const patch = applyFilterOptions(
      data,
      app,
      initConfig({
        udAttrMatchers: [
          { key: "plan", type: "string", op: "eq", value: "pro" },
          { key: "missing-key", type: "string", op: "eq", value: "x" },
          { key: "plan", type: "string", op: "unknown-op", value: "x" },
        ],
      }),
      state(),
    );
    expect(patch.selectedUdAttrMatchers).toEqual([
      { key: "plan", type: "string", op: "eq", value: "pro" },
    ]);
  });

  it("defaults span statuses to all when filterSource is Spans", () => {
    const cfg = { ...initConfig({}), filterSource: FilterSource.Spans };
    const patch = applyFilterOptions(emptyOptions(), app, cfg, state());
    expect(patch.selectedSpanStatuses).toEqual([
      SpanStatus.Unset,
      SpanStatus.Ok,
      SpanStatus.Error,
    ]);
  });

  it("defaults span statuses to [] for non-Spans filterSource", () => {
    const patch = applyFilterOptions(
      emptyOptions(),
      app,
      initConfig({}),
      state(),
    );
    expect(patch.selectedSpanStatuses).toEqual([]);
  });

  it("defaults bug report statuses to [Open]", () => {
    const patch = applyFilterOptions(
      emptyOptions(),
      app,
      initConfig({}),
      state(),
    );
    expect(patch.selectedBugReportStatuses).toEqual([BugReportStatus.Open]);
  });

  it("honors URL bug report statuses when valid", () => {
    const patch = applyFilterOptions(
      emptyOptions(),
      app,
      initConfig({ bugReportStatuses: [BugReportStatus.Closed] }),
      state(),
    );
    expect(patch.selectedBugReportStatuses).toEqual([BugReportStatus.Closed]);
  });

  it("honors URL session types when valid", () => {
    const patch = applyFilterOptions(
      emptyOptions(),
      app,
      initConfig({ sessionTypes: [SessionType.Crashes, SessionType.ANRs] }),
      state(),
    );
    expect(patch.selectedSessionTypes).toEqual([
      SessionType.Crashes,
      SessionType.ANRs,
    ]);
  });

  it("honors URL http methods when valid", () => {
    const patch = applyFilterOptions(
      emptyOptions(),
      app,
      initConfig({ httpMethods: [HttpMethod.GET] }),
      state(),
    );
    expect(patch.selectedHttpMethods).toEqual([HttpMethod.GET]);
  });

  it("honors URL freeText", () => {
    const patch = applyFilterOptions(
      emptyOptions(),
      app,
      initConfig({ freeText: "oom" }),
      state(),
    );
    expect(patch.selectedFreeText).toBe("oom");
  });
});

describe("filtersStore actions", () => {
  it("setSelectedApp wipes versions and osVersions on app switch", () => {
    const store = createFiltersStore();
    const a = makeApp("a");
    const b = makeApp("b");
    store.getState().setSelectedApp(a);
    store.getState().setSelectedVersions([new AppVersion("1.0", "100")]);
    store.getState().setSelectedOsVersions([new OsVersion("android", "13")]);

    store.getState().setSelectedApp(b);

    expect(store.getState().selectedApp?.id).toBe("b");
    expect(store.getState().selectedVersions).toEqual([]);
    expect(store.getState().selectedOsVersions).toEqual([]);
  });

  it("setSelectedApp does NOT wipe selections when called with the same app", () => {
    const store = createFiltersStore();
    const a = makeApp("a");
    store.getState().setSelectedApp(a);
    const versions = [new AppVersion("1.0", "100")];
    store.getState().setSelectedVersions(versions);

    store.getState().setSelectedApp({ ...a, name: "Same App, New Ref" });

    expect(store.getState().selectedVersions).toEqual(versions);
  });

  it("setSelectedApp does NOT wipe when transitioning from null to a value", () => {
    const store = createFiltersStore();
    const versions = [new AppVersion("1.0", "100")];
    store.getState().setSelectedVersions(versions);
    store.getState().setSelectedApp(makeApp("a"));
    expect(store.getState().selectedVersions).toEqual(versions);
  });

  it("markAppOnboarded flips the cached app and selectedApp", () => {
    const store = createFiltersStore();
    const a = makeApp("a", { onboarded: false });
    const b = makeApp("b", { onboarded: false });
    store.getState().setApps([a, b], AppsApiStatus.Success);
    store.getState().setSelectedApp(a);

    store.getState().markAppOnboarded("a");

    expect(store.getState().apps.find((x) => x.id === "a")?.onboarded).toBe(
      true,
    );
    expect(store.getState().apps.find((x) => x.id === "b")?.onboarded).toBe(
      false,
    );
    expect(store.getState().selectedApp?.onboarded).toBe(true);
  });

  it("markAppOnboarded leaves selectedApp untouched when ids differ", () => {
    const store = createFiltersStore();
    const a = makeApp("a", { onboarded: false });
    const b = makeApp("b", { onboarded: false });
    store.getState().setApps([a, b], AppsApiStatus.Success);
    store.getState().setSelectedApp(b);

    store.getState().markAppOnboarded("a");

    expect(store.getState().selectedApp?.id).toBe("b");
    expect(store.getState().selectedApp?.onboarded).toBe(false);
  });

  it("resetForTeamChange clears apps and selections but keeps config", () => {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    store.getState().setApps([makeApp("a")], AppsApiStatus.Success);
    store.getState().setSelectedApp(makeApp("a"));
    store.getState().setSelectedVersions([new AppVersion("1.0", "100")]);

    store.getState().resetForTeamChange("new-team");

    expect(store.getState().currentTeamId).toBe("new-team");
    expect(store.getState().apps).toEqual([]);
    expect(store.getState().selectedApp).toBeNull();
    expect(store.getState().selectedVersions).toEqual([]);
    expect(store.getState().config).toEqual(baseConfig);
  });

  it("reset wipes everything back to initial state", () => {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    store.getState().setApps([makeApp("a")], AppsApiStatus.Success);
    store.getState().setSelectedApp(makeApp("a"));

    store.getState().reset();

    expect(store.getState().apps).toEqual([]);
    expect(store.getState().selectedApp).toBeNull();
    expect(store.getState().config).toBeNull();
  });

  it("setFilterOptions stores option lists and status", () => {
    const store = createFiltersStore();
    const data = {
      versions: [new AppVersion("1.0", "100")],
      osVersions: [new OsVersion("android", "13")],
      countries: ["US"],
      networkProviders: ["Verizon"],
      networkTypes: ["wifi"],
      networkGenerations: ["4G"],
      locales: ["en-US"],
      deviceManufacturers: ["Pixel"],
      deviceNames: ["Pixel 8"],
      userDefAttrs: [{ key: "plan", type: "string" }],
      userDefAttrOps: new Map([["string", ["eq"]]]),
    };
    store.getState().setFilterOptions(data, FiltersApiStatus.Success);

    expect(store.getState().filtersApiStatus).toBe(FiltersApiStatus.Success);
    expect(store.getState().versions).toEqual(data.versions);
    expect(store.getState().osVersions).toEqual(data.osVersions);
    expect(store.getState().userDefAttrs).toEqual(data.userDefAttrs);
  });

  it("setFilterOptions with null data only updates status", () => {
    const store = createFiltersStore();
    store.getState().setFilterOptions(null, FiltersApiStatus.NotOnboarded);
    expect(store.getState().filtersApiStatus).toBe(
      FiltersApiStatus.NotOnboarded,
    );
    expect(store.getState().versions).toEqual([]);
  });

  it("setRootSpanNames stores list and status", () => {
    const store = createFiltersStore();
    store
      .getState()
      .setRootSpanNames(["a", "b"], RootSpanNamesApiStatus.Success);
    expect(store.getState().rootSpanNames).toEqual(["a", "b"]);
    expect(store.getState().rootSpanNamesApiStatus).toBe(
      RootSpanNamesApiStatus.Success,
    );
  });

  it("setRootSpanNames with null data only updates status", () => {
    const store = createFiltersStore();
    store.getState().setRootSpanNames(null, RootSpanNamesApiStatus.NoData);
    expect(store.getState().rootSpanNamesApiStatus).toBe(
      RootSpanNamesApiStatus.NoData,
    );
    expect(store.getState().rootSpanNames).toEqual([]);
  });

  it("setConfig wipes per-page selections when filterSource changes", () => {
    const store = createFiltersStore();
    store
      .getState()
      .setConfig({ ...baseConfig, filterSource: FilterSource.Crashes });
    store.getState().setSelectedCountries(["US"]);
    store.getState().setSelectedSessionTypes([SessionType.Crashes]);
    store.getState().setSelectedFreeText("oom");

    store
      .getState()
      .setConfig({ ...baseConfig, filterSource: FilterSource.Anrs });

    expect(store.getState().selectedCountries).toEqual([]);
    expect(store.getState().selectedSessionTypes).toEqual([]);
    expect(store.getState().selectedFreeText).toBe("");
  });

  it("setConfig leaves selections alone when filterSource is unchanged", () => {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    store.getState().setSelectedCountries(["US"]);

    store.getState().setConfig({ ...baseConfig, showAppSelector: false });

    expect(store.getState().selectedCountries).toEqual(["US"]);
  });

  it("applySelections writes the patch into state", () => {
    const store = createFiltersStore();
    store.getState().applySelections({
      selectedFreeText: "crash",
      selectedCountries: ["US"],
    });
    expect(store.getState().selectedFreeText).toBe("crash");
    expect(store.getState().selectedCountries).toEqual(["US"]);
  });
});

describe("computed filters object", () => {
  function readyStore() {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    store.getState().setApps([makeApp("a")], AppsApiStatus.Success);
    store.getState().setSelectedApp(makeApp("a"));
    store.getState().setFilterOptions(
      {
        versions: [new AppVersion("1.0", "100")],
        osVersions: [new OsVersion("android", "13")],
        countries: ["US"],
        networkProviders: [],
        networkTypes: [],
        networkGenerations: [],
        locales: [],
        deviceManufacturers: [],
        deviceNames: [],
        userDefAttrs: [],
        userDefAttrOps: new Map(),
      },
      FiltersApiStatus.Success,
    );
    return store;
  }

  it("filters.ready is true once apps + filter options resolve", () => {
    const store = readyStore();
    expect(store.getState().filters.ready).toBe(true);
  });

  it("filters.ready is false while apps are loading", () => {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    store.getState().setApps([], AppsApiStatus.Loading);
    expect(store.getState().filters.ready).toBe(false);
  });

  it("filters.app reflects selectedApp", () => {
    const store = readyStore();
    expect(store.getState().filters.app?.id).toBe("a");
  });

  it("filters.osVersions.all is true when all are selected", () => {
    const store = readyStore();
    const all = store.getState().osVersions;
    store.getState().setSelectedOsVersions(all);
    expect(store.getState().filters.osVersions.all).toBe(true);
  });

  it("filters.osVersions.all is false when a subset is selected", () => {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    store.getState().setSelectedApp(makeApp("a"));
    const osVersions = [
      new OsVersion("android", "13"),
      new OsVersion("android", "14"),
    ];
    store.getState().setFilterOptions(
      {
        versions: [],
        osVersions,
        countries: [],
        networkProviders: [],
        networkTypes: [],
        networkGenerations: [],
        locales: [],
        deviceManufacturers: [],
        deviceNames: [],
        userDefAttrs: [],
        userDefAttrOps: new Map(),
      },
      FiltersApiStatus.Success,
    );
    store.getState().setSelectedOsVersions([osVersions[0]]);
    expect(store.getState().filters.osVersions.all).toBe(false);
  });

  it("triggers shortFilters fetchQuery once filters are ready", () => {
    readyStore();
    expect(mockFetchQuery).toHaveBeenCalled();
    const lastCall = mockFetchQuery.mock.calls.at(-1)![0] as any;
    expect(lastCall.queryKey[0]).toBe("shortFilters");
  });

  it("does not trigger shortFilters fetchQuery while not ready", () => {
    const store = createFiltersStore();
    store.getState().setConfig(baseConfig);
    mockFetchQuery.mockClear();
    store.getState().setApps([], AppsApiStatus.Loading);
    expect(mockFetchQuery).not.toHaveBeenCalled();
  });

  it("filters.ready is false when both showNoData+showNotOnboarded require Success but status is NoData", () => {
    const store = createFiltersStore();
    store
      .getState()
      .setConfig({ ...baseConfig, showNoData: true, showNotOnboarded: true });
    store.getState().setApps([makeApp("a")], AppsApiStatus.Success);
    store.getState().setSelectedApp(makeApp("a"));
    store.getState().setFilterOptions(null, FiltersApiStatus.NoData);
    expect(store.getState().filters.ready).toBe(false);
  });

  it("filters.ready is false on NoData when showNoData is set (filters component renders the NoData UI)", () => {
    const store = createFiltersStore();
    store.getState().setConfig({ ...baseConfig, showNoData: true });
    store.getState().setApps([makeApp("a")], AppsApiStatus.Success);
    store.getState().setSelectedApp(makeApp("a"));
    store.getState().setFilterOptions(null, FiltersApiStatus.NoData);
    expect(store.getState().filters.ready).toBe(false);
  });

  it("filters.ready is true on NoData when neither show* flag is set (page handles it)", () => {
    const store = createFiltersStore();
    store
      .getState()
      .setConfig({ ...baseConfig, showNoData: false, showNotOnboarded: false });
    store.getState().setApps([makeApp("a")], AppsApiStatus.Success);
    store.getState().setSelectedApp(makeApp("a"));
    store.getState().setFilterOptions(null, FiltersApiStatus.NoData);
    expect(store.getState().filters.ready).toBe(true);
  });
});
