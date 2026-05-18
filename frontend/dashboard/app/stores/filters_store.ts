import { queryClient, SHORT_CODE_STALE_TIME } from "@/app/query/query_client";
import { createStore } from "zustand/vanilla";
import {
  App,
  AppsApiStatus,
  AppVersion,
  BugReportStatus,
  buildShortFiltersPostBody,
  defaultFilters,
  Filters,
  FiltersApiStatus,
  FilterSource,
  HttpMethod,
  OsVersion,
  RootSpanNamesApiStatus,
  saveListFiltersToServer,
  SessionType,
  SpanStatus,
  UdAttrMatcher,
  UserDefAttr,
} from "../api/api_calls";

export enum AppVersionsInitialSelectionType {
  Latest,
  All,
}

export { defaultFilters };
export type { Filters };

export type FilterConfig = {
  filterSource: FilterSource;
  showNoData: boolean;
  showNotOnboarded: boolean;
  showAppSelector: boolean;
  showDates: boolean;
  showAppVersions: boolean;
  showOsVersions: boolean;
  showSessionTypes: boolean;
  showCountries: boolean;
  showNetworkProviders: boolean;
  showNetworkTypes: boolean;
  showNetworkGenerations: boolean;
  showLocales: boolean;
  showDeviceManufacturers: boolean;
  showDeviceNames: boolean;
  showBugReportStatus: boolean;
  showHttpMethods: boolean;
  showUdAttrs: boolean;
  showFreeText: boolean;
};

export type URLFilters = {
  appId?: string;
  rootSpanName?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: string;
  versions?: number[];
  sessionTypes?: SessionType[];
  spanStatuses?: SpanStatus[];
  bugReportStatuses?: BugReportStatus[];
  httpMethods?: HttpMethod[];
  osVersions?: number[];
  countries?: number[];
  networkProviders?: number[];
  networkTypes?: number[];
  networkGenerations?: number[];
  locales?: number[];
  deviceManufacturers?: number[];
  deviceNames?: number[];
  udAttrMatchers?: UdAttrMatcher[];
  freeText?: string;
};

export type InitConfig = {
  urlFilters: URLFilters;
  appId?: string;
  appVersionsInitialSelectionType: AppVersionsInitialSelectionType;
  filterSource: FilterSource;
};

export type FilterOptionsData = {
  versions: AppVersion[];
  osVersions: OsVersion[];
  countries: string[];
  networkProviders: string[];
  networkTypes: string[];
  networkGenerations: string[];
  locales: string[];
  deviceManufacturers: string[];
  deviceNames: string[];
  userDefAttrs: UserDefAttr[];
  userDefAttrOps: Map<string, string[]>;
};

const allHttpMethods = [
  HttpMethod.GET,
  HttpMethod.POST,
  HttpMethod.PUT,
  HttpMethod.PATCH,
  HttpMethod.DELETE,
];
const allSessionTypes = [
  SessionType.Crashes,
  SessionType.ANRs,
  SessionType.BugReports,
  SessionType.Foreground,
  SessionType.Background,
  SessionType.UserInteraction,
];
const defaultSessionTypes = [
  SessionType.Crashes,
  SessionType.ANRs,
  SessionType.BugReports,
  SessionType.Foreground,
  SessionType.UserInteraction,
];
const allSpanStatuses = [SpanStatus.Unset, SpanStatus.Ok, SpanStatus.Error];
const allBugReportStatuses = [BugReportStatus.Open, BugReportStatus.Closed];

const urlFiltersKeyMap = {
  appId: "a",
  rootSpanName: "r",
  dateRange: "d",
  startDate: "sd",
  endDate: "ed",
  versions: "v",
  sessionTypes: "st",
  spanStatuses: "ss",
  bugReportStatuses: "bs",
  httpMethods: "hm",
  osVersions: "os",
  countries: "c",
  networkProviders: "np",
  networkTypes: "nt",
  networkGenerations: "ng",
  locales: "l",
  deviceManufacturers: "dm",
  deviceNames: "dn",
  udAttrMatchers: "ud",
  freeText: "ft",
};

function compressArrayToRanges(arr: number[]): string {
  /* v8 ignore next */
  if (arr.length === 0) return "";
  const sorted = [...new Set(arr)].sort((a, b) => a - b);
  let ranges: string[] = [];
  let start = sorted[0];
  let current = start;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === current + 1) {
      current = sorted[i];
    } else {
      ranges.push(start === current ? `${start}` : `${start}-${current}`);
      start = sorted[i];
      current = start;
    }
  }
  ranges.push(start === current ? `${start}` : `${start}-${current}`);
  return ranges.join(",");
}

export function expandRangesToArray(str: string): number[] {
  if (!str) return [];
  const parts = str.split(",");
  const result: number[] = [];
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
    } else {
      const num = Number(part);
      if (!isNaN(num)) result.push(num);
    }
  }
  return result;
}

function serializeUrlFilters(
  urlFilters: URLFilters,
  config: FilterConfig,
): string {
  const params = new URLSearchParams();

  Object.entries(urlFilters).forEach(([key, value]) => {
    const minifiedKey = urlFiltersKeyMap[key as keyof typeof urlFiltersKeyMap];
    if (!minifiedKey || value === undefined || value === null) return;

    let serializedValue: string;

    switch (key) {
      case "versions":
        if (!config.showAppVersions) return;
        break;
      case "osVersions":
        if (!config.showOsVersions) return;
        break;
      case "sessionTypes":
        if (!config.showSessionTypes) return;
        break;
      case "countries":
        if (!config.showCountries) return;
        break;
      case "networkProviders":
        if (!config.showNetworkProviders) return;
        break;
      case "networkTypes":
        if (!config.showNetworkTypes) return;
        break;
      case "networkGenerations":
        if (!config.showNetworkGenerations) return;
        break;
      case "locales":
        if (!config.showLocales) return;
        break;
      case "deviceManufacturers":
        if (!config.showDeviceManufacturers) return;
        break;
      case "deviceNames":
        if (!config.showDeviceNames) return;
        break;
      case "bugReportStatuses":
        if (!config.showBugReportStatus) return;
        break;
      case "httpMethods":
        if (!config.showHttpMethods) return;
        break;
      case "udAttrMatchers":
        if (!config.showUdAttrs) return;
        break;
      case "freeText":
        if (!config.showFreeText) return;
        break;
      case "startDate":
      case "endDate":
      case "dateRange":
        if (!config.showDates) return;
        break;
      case "appId":
        if (!config.showAppSelector) return;
        break;
      case "rootSpanName":
      case "spanStatuses":
        if (config.filterSource !== FilterSource.Spans) return;
        break;
      /* v8 ignore next */
      default:
        break;
    }

    switch (key) {
      case "versions":
      case "osVersions":
      case "countries":
      case "networkProviders":
      case "networkTypes":
      case "networkGenerations":
      case "locales":
      case "deviceManufacturers":
      case "deviceNames":
        if ((value as number[]).length === 0) return;
        serializedValue = compressArrayToRanges(value as number[]);
        break;
      case "udAttrMatchers":
        const validMatchers = (value as UdAttrMatcher[]).filter(
          (m) => m?.key && m?.type && m?.op && m.value !== undefined,
        );
        if (validMatchers.length === 0) return;
        serializedValue = validMatchers
          .map(
            (m) =>
              `${encodeURIComponent(m.key)}~${encodeURIComponent(m.type)}~${encodeURIComponent(m.op)}~${encodeURIComponent(m.value)}`,
          )
          .join("|");
        break;
      case "spanStatuses":
      case "bugReportStatuses":
      case "httpMethods":
        if ((value as string[]).length === 0) return;
        serializedValue = (value as string[]).join(",");
        break;
      case "sessionTypes":
        if ((value as SessionType[]).length === 0) return;
        serializedValue = (value as SessionType[]).join(",");
        break;
      case "dateRange":
        serializedValue = value.toString();
        break;
      default:
        if (value === "") return;
        serializedValue = value.toString();
    }

    if (serializedValue) params.set(minifiedKey, serializedValue);
  });

  return params.toString();
}

export { urlFiltersKeyMap };

interface FiltersStoreState {
  filters: Filters;

  config: FilterConfig | null;

  appsApiStatus: AppsApiStatus;
  filtersApiStatus: FiltersApiStatus;
  rootSpanNamesApiStatus: RootSpanNamesApiStatus;

  apps: App[];
  versions: AppVersion[];
  rootSpanNames: string[];
  osVersions: OsVersion[];
  countries: string[];
  networkProviders: string[];
  networkTypes: string[];
  networkGenerations: string[];
  locales: string[];
  deviceManufacturers: string[];
  deviceNames: string[];
  userDefAttrs: UserDefAttr[];
  userDefAttrOps: Map<string, string[]>;

  // Cross-page selections — preserved across sidebar navigation.
  selectedApp: App | null;
  selectedDateRange: string;
  selectedStartDate: string;
  selectedEndDate: string;

  // Per-page selections — reset to URL filter (if present) or default on
  // every Filters mount via applyFilterOptions.
  selectedVersions: AppVersion[];
  selectedRootSpanName: string;
  selectedSessionTypes: SessionType[];
  selectedSpanStatuses: SpanStatus[];
  selectedBugReportStatuses: BugReportStatus[];
  selectedHttpMethods: HttpMethod[];
  selectedOsVersions: OsVersion[];
  selectedCountries: string[];
  selectedNetworkProviders: string[];
  selectedNetworkTypes: string[];
  selectedNetworkGenerations: string[];
  selectedLocales: string[];
  selectedDeviceManufacturers: string[];
  selectedDeviceNames: string[];
  selectedUdAttrMatchers: UdAttrMatcher[];
  selectedFreeText: string;

  currentTeamId: string;
}

interface FiltersStoreActions {
  setConfig: (config: FilterConfig) => void;

  setApps: (apps: App[], status: AppsApiStatus) => void;
  setFilterOptions: (
    data: FilterOptionsData | null,
    status: FiltersApiStatus,
  ) => void;
  setRootSpanNames: (
    rootSpanNames: string[] | null,
    status: RootSpanNamesApiStatus,
  ) => void;
  setCurrentTeamId: (teamId: string) => void;

  setSelectedApp: (app: App | null) => void;
  setSelectedRootSpanName: (name: string) => void;
  setSelectedDateRange: (range: string) => void;
  setSelectedStartDate: (date: string) => void;
  setSelectedEndDate: (date: string) => void;
  setSelectedVersions: (versions: AppVersion[]) => void;
  setSelectedSessionTypes: (types: SessionType[]) => void;
  setSelectedSpanStatuses: (statuses: SpanStatus[]) => void;
  setSelectedBugReportStatuses: (statuses: BugReportStatus[]) => void;
  setSelectedHttpMethods: (methods: HttpMethod[]) => void;
  setSelectedOsVersions: (versions: OsVersion[]) => void;
  setSelectedCountries: (countries: string[]) => void;
  setSelectedNetworkProviders: (providers: string[]) => void;
  setSelectedNetworkTypes: (types: string[]) => void;
  setSelectedNetworkGenerations: (gens: string[]) => void;
  setSelectedLocales: (locales: string[]) => void;
  setSelectedDeviceManufacturers: (manufacturers: string[]) => void;
  setSelectedDeviceNames: (names: string[]) => void;
  setSelectedUdAttrMatchers: (matchers: UdAttrMatcher[]) => void;
  setSelectedFreeText: (text: string) => void;

  applySelections: (patch: Partial<FiltersStoreState>) => void;

  // Flips the in-memory app's onboarded flag without waiting for the apps
  // query to refetch — so consumers see the verified state immediately.
  markAppOnboarded: (appId: string) => void;

  // Clears team-scoped state (apps, filter options, selections); keeps config.
  resetForTeamChange: (newTeamId: string) => void;

  reset: () => void;
}

const initialState: FiltersStoreState = {
  filters: defaultFilters,
  config: null,

  appsApiStatus: AppsApiStatus.Loading,
  filtersApiStatus: FiltersApiStatus.Loading,
  rootSpanNamesApiStatus: RootSpanNamesApiStatus.Loading,

  apps: [],
  versions: [],
  rootSpanNames: [],
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

  selectedApp: null,
  selectedRootSpanName: "",
  selectedDateRange: "",
  selectedStartDate: "",
  selectedEndDate: "",
  selectedVersions: [],
  selectedSessionTypes: defaultSessionTypes,
  selectedSpanStatuses: [],
  selectedBugReportStatuses: [BugReportStatus.Open],
  selectedHttpMethods: allHttpMethods,
  selectedOsVersions: [],
  selectedCountries: [],
  selectedNetworkProviders: [],
  selectedNetworkTypes: [],
  selectedNetworkGenerations: [],
  selectedLocales: [],
  selectedDeviceManufacturers: [],
  selectedDeviceNames: [],
  selectedUdAttrMatchers: [],
  selectedFreeText: "",
  currentTeamId: "",
};

function computeFilters(state: FiltersStoreState): Filters {
  if (!state.config || !state.selectedApp) {
    return {
      ...defaultFilters,
      loading: state.appsApiStatus === AppsApiStatus.Loading,
    };
  }

  const config = state.config;

  let ready = false;
  if (config.showNoData && config.showNotOnboarded) {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      state.filtersApiStatus === FiltersApiStatus.Success;
  } else if (config.showNoData) {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      (state.filtersApiStatus === FiltersApiStatus.Success ||
        state.filtersApiStatus === FiltersApiStatus.NotOnboarded);
  } else if (config.showNotOnboarded) {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      (state.filtersApiStatus === FiltersApiStatus.Success ||
        state.filtersApiStatus === FiltersApiStatus.NoData);
  } else {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      (state.filtersApiStatus === FiltersApiStatus.Success ||
        state.filtersApiStatus === FiltersApiStatus.NoData ||
        state.filtersApiStatus === FiltersApiStatus.NotOnboarded);
  }

  const updatedUrlFilters: URLFilters = {
    appId: state.selectedApp.id,
    rootSpanName: state.selectedRootSpanName,
    startDate: state.selectedStartDate,
    endDate: state.selectedEndDate,
    dateRange: state.selectedDateRange || undefined,
    versions: state.selectedVersions.map((v) =>
      state.versions.findIndex(
        (ver) => ver.name === v.name && ver.code === v.code,
      ),
    ),
    sessionTypes: state.selectedSessionTypes,
    spanStatuses: state.selectedSpanStatuses,
    bugReportStatuses: state.selectedBugReportStatuses,
    httpMethods: state.selectedHttpMethods,
    osVersions: state.selectedOsVersions.map((os) =>
      state.osVersions.findIndex(
        (o) => o.name === os.name && o.version === os.version,
      ),
    ),
    countries: state.selectedCountries.map((c) => state.countries.indexOf(c)),
    networkProviders: state.selectedNetworkProviders.map((np) =>
      state.networkProviders.indexOf(np),
    ),
    networkTypes: state.selectedNetworkTypes.map((nt) =>
      state.networkTypes.indexOf(nt),
    ),
    networkGenerations: state.selectedNetworkGenerations.map((ng) =>
      state.networkGenerations.indexOf(ng),
    ),
    locales: state.selectedLocales.map((l) => state.locales.indexOf(l)),
    deviceManufacturers: state.selectedDeviceManufacturers.map((dm) =>
      state.deviceManufacturers.indexOf(dm),
    ),
    deviceNames: state.selectedDeviceNames.map((dn) =>
      state.deviceNames.indexOf(dn),
    ),
    udAttrMatchers: state.selectedUdAttrMatchers,
    freeText: state.selectedFreeText,
  };

  const loading =
    state.appsApiStatus === AppsApiStatus.Loading ||
    (state.appsApiStatus === AppsApiStatus.Success &&
      state.filtersApiStatus === FiltersApiStatus.Loading) ||
    (state.appsApiStatus === AppsApiStatus.Success &&
      state.filtersApiStatus === FiltersApiStatus.Success &&
      config.filterSource === FilterSource.Spans &&
      state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Loading);

  return {
    ready,
    loading,
    app: state.selectedApp,
    rootSpanName: state.selectedRootSpanName,
    startDate: state.selectedStartDate,
    endDate: state.selectedEndDate,
    versions: {
      selected: state.selectedVersions,
      all: state.versions.length === state.selectedVersions.length,
    },
    sessionTypes: {
      selected: state.selectedSessionTypes,
      all: state.selectedSessionTypes.length === allSessionTypes.length,
    },
    spanStatuses: {
      selected: state.selectedSpanStatuses,
      all: state.selectedSpanStatuses.length === allSpanStatuses.length,
    },
    bugReportStatuses: {
      selected: state.selectedBugReportStatuses,
      all:
        state.selectedBugReportStatuses.length === allBugReportStatuses.length,
    },
    httpMethods: {
      selected: state.selectedHttpMethods,
      all: state.selectedHttpMethods.length === allHttpMethods.length,
    },
    osVersions: {
      selected: state.selectedOsVersions,
      all: state.selectedOsVersions.length === state.osVersions.length,
    },
    countries: {
      selected: state.selectedCountries,
      all: state.selectedCountries.length === state.countries.length,
    },
    networkProviders: {
      selected: state.selectedNetworkProviders,
      all:
        state.selectedNetworkProviders.length === state.networkProviders.length,
    },
    networkTypes: {
      selected: state.selectedNetworkTypes,
      all: state.selectedNetworkTypes.length === state.networkTypes.length,
    },
    networkGenerations: {
      selected: state.selectedNetworkGenerations,
      all:
        state.selectedNetworkGenerations.length ===
        state.networkGenerations.length,
    },
    locales: {
      selected: state.selectedLocales,
      all: state.selectedLocales.length === state.locales.length,
    },
    deviceManufacturers: {
      selected: state.selectedDeviceManufacturers,
      all:
        state.selectedDeviceManufacturers.length ===
        state.deviceManufacturers.length,
    },
    deviceNames: {
      selected: state.selectedDeviceNames,
      all: state.selectedDeviceNames.length === state.deviceNames.length,
    },
    udAttrMatchers: state.selectedUdAttrMatchers,
    freeText: state.selectedFreeText,
    serialisedFilters: serializeUrlFilters(updatedUrlFilters, config),
    // Placeholder; the wrapped `set` overwrites this with a real POST promise
    // when serialisedFilters changes (and otherwise carries the existing one
    // forward via state.filters).
    filterShortCodePromise: state.filters.filterShortCodePromise,
  };
}

// Resolve filter selections for the current app and filter data.
// Priority for every selection: URL params > defaults.
export function applyFilterOptions(
  data: FilterOptionsData,
  app: App,
  initConfig: InitConfig,
  _currentState: FiltersStoreState,
): Partial<FiltersStoreState> {
  const { urlFilters, appVersionsInitialSelectionType, filterSource } =
    initConfig;
  // Pages that hide the app selector (e.g. crash/trace details) don't write
  // `a=appId` into the URL, but they DO write filter selections. Treat URL
  // filters as applicable when the URL has no appId at all — the indices
  // are intended for the app the page is already pinned to. Reject only
  // when the URL explicitly names a different app.
  const isUrlMatch = !urlFilters.appId || urlFilters.appId === app.id;

  let selectedVersions: AppVersion[];
  if (isUrlMatch && urlFilters.versions) {
    selectedVersions = urlFilters.versions
      .filter((index) => index >= 0 && index < data.versions.length)
      .map((index) => data.versions[index]);
    if (selectedVersions.length === 0) {
      selectedVersions =
        appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All
          ? data.versions
          : data.versions.slice(0, 1);
    }
  } else if (
    appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All
  ) {
    selectedVersions = data.versions;
  } else {
    selectedVersions = data.versions.slice(0, 1);
  }

  // Index-based lists (URL carries indices into `data.X`). URL > default.
  const resolveIndexList = <T>(
    urlValue: number[] | undefined,
    newAvailable: T[],
    defaultValue: T[],
  ): T[] => {
    if (isUrlMatch && urlValue !== undefined) {
      const fromUrl = urlValue
        .filter((index) => index >= 0 && index < newAvailable.length)
        .map((index) => newAvailable[index]);
      if (fromUrl.length > 0) {
        return fromUrl;
      }
    }
    return defaultValue;
  };

  const selectedOsVersions = resolveIndexList(
    urlFilters.osVersions,
    data.osVersions,
    data.osVersions,
  );
  const selectedCountries = resolveIndexList(
    urlFilters.countries,
    data.countries,
    data.countries,
  );
  const selectedNetworkProviders = resolveIndexList(
    urlFilters.networkProviders,
    data.networkProviders,
    data.networkProviders,
  );
  const selectedNetworkTypes = resolveIndexList(
    urlFilters.networkTypes,
    data.networkTypes,
    data.networkTypes,
  );
  const selectedNetworkGenerations = resolveIndexList(
    urlFilters.networkGenerations,
    data.networkGenerations,
    data.networkGenerations,
  );
  const selectedLocales = resolveIndexList(
    urlFilters.locales,
    data.locales,
    data.locales,
  );
  const selectedDeviceManufacturers = resolveIndexList(
    urlFilters.deviceManufacturers,
    data.deviceManufacturers,
    data.deviceManufacturers,
  );
  const selectedDeviceNames = resolveIndexList(
    urlFilters.deviceNames,
    data.deviceNames,
    data.deviceNames,
  );

  const isMatcherValid = (m: UdAttrMatcher): boolean => {
    const attr = data.userDefAttrs.find((a) => a.key === m.key);
    if (!attr || attr.type !== m.type) {
      return false;
    }
    const ops = data.userDefAttrOps.get(attr.type);
    /* v8 ignore next */
    return ops ? ops.includes(m.op) : false;
  };
  let selectedUdAttrMatchers: UdAttrMatcher[];
  if (isUrlMatch && urlFilters.udAttrMatchers && data.userDefAttrs.length > 0) {
    selectedUdAttrMatchers = urlFilters.udAttrMatchers.filter(isMatcherValid);
  } else {
    selectedUdAttrMatchers = [];
  }

  let selectedSpanStatuses: SpanStatus[];
  if (isUrlMatch && urlFilters.spanStatuses) {
    selectedSpanStatuses = urlFilters.spanStatuses
      .filter((s: string) =>
        Object.values(SpanStatus).includes(s as SpanStatus),
      )
      .map((s: string) => s as SpanStatus);
  } else {
    selectedSpanStatuses =
      filterSource === FilterSource.Spans ? allSpanStatuses : [];
  }

  let selectedBugReportStatuses: BugReportStatus[];
  if (isUrlMatch && urlFilters.bugReportStatuses) {
    selectedBugReportStatuses = urlFilters.bugReportStatuses
      .filter((s: string) =>
        Object.values(BugReportStatus).includes(s as BugReportStatus),
      )
      .map((s: string) => s as BugReportStatus);
  } else {
    selectedBugReportStatuses = [BugReportStatus.Open];
  }

  let selectedHttpMethods: HttpMethod[];
  if (isUrlMatch && urlFilters.httpMethods) {
    selectedHttpMethods = urlFilters.httpMethods
      .filter((s: string) =>
        Object.values(HttpMethod).includes(s as HttpMethod),
      )
      .map((s: string) => s as HttpMethod);
  } else {
    selectedHttpMethods = allHttpMethods;
  }

  let selectedSessionTypes: SessionType[];
  if (isUrlMatch && urlFilters.sessionTypes) {
    selectedSessionTypes = urlFilters.sessionTypes
      .filter((s: string) =>
        Object.values(SessionType).includes(s as SessionType),
      )
      .map((s: string) => s as SessionType);
  } else {
    selectedSessionTypes = defaultSessionTypes;
  }

  let selectedFreeText: string;
  if (isUrlMatch && urlFilters.freeText) {
    selectedFreeText = urlFilters.freeText;
  } else {
    selectedFreeText = "";
  }

  return {
    versions: data.versions,
    osVersions: data.osVersions,
    countries: data.countries,
    networkProviders: data.networkProviders,
    networkTypes: data.networkTypes,
    networkGenerations: data.networkGenerations,
    locales: data.locales,
    deviceManufacturers: data.deviceManufacturers,
    deviceNames: data.deviceNames,
    userDefAttrs: data.userDefAttrs,
    userDefAttrOps: data.userDefAttrOps,
    selectedVersions,
    selectedOsVersions,
    selectedCountries,
    selectedNetworkProviders,
    selectedNetworkTypes,
    selectedNetworkGenerations,
    selectedLocales,
    selectedDeviceManufacturers,
    selectedDeviceNames,
    selectedUdAttrMatchers,
    selectedSpanStatuses,
    selectedBugReportStatuses,
    selectedHttpMethods,
    selectedSessionTypes,
    selectedFreeText,
  };
}

// Priority: URL appId > prop appId > previously selected > first.
export function pickApp(
  apps: App[],
  initConfig: InitConfig,
  currentSelectedApp: App | null,
): App | undefined {
  const { urlFilters, appId } = initConfig;

  if (urlFilters.appId) {
    const app = apps.find((e: App) => e.id === urlFilters.appId);
    if (app) {
      return app;
    }
  }

  if (appId !== undefined) {
    const app = apps.find((e: App) => e.id === appId);
    if (app) {
      return app;
    }
  }

  if (currentSelectedApp) {
    const app = apps.find((e: App) => e.id === currentSelectedApp.id);
    if (app) {
      return app;
    }
  }

  return apps[0];
}

export function resolveRootSpanName(
  rootSpanNames: string[],
  initConfig: InitConfig,
  app: App,
): string {
  if (
    initConfig.urlFilters.appId === app.id &&
    initConfig.urlFilters.rootSpanName
  ) {
    const found = rootSpanNames.find(
      (name) => name === initConfig.urlFilters.rootSpanName,
    );
    return found ?? rootSpanNames[0];
  }
  return rootSpanNames[0];
}

// Signature of the exact /shortFilters POST that saveListFiltersToServer
// would send — computed by hashing the body that buildShortFiltersPostBody
// produces. Used as a TanStack cache key for the short-code POST so two
// renders with the same body share the same in-flight promise.
function filterShortCodeBodyKey(filters: Filters): string {
  const body = buildShortFiltersPostBody(filters);
  /* v8 ignore next */
  return JSON.stringify({ app: filters.app?.id ?? null, body });
}

export type FiltersStore = FiltersStoreState & FiltersStoreActions;

export function createFiltersStore() {
  return createStore<FiltersStore>()((rawSet, get) => {
    const set: typeof rawSet = (partial) => {
      rawSet((state) => {
        const updates =
          typeof partial === "function" ? partial(state) : partial;
        const newState = { ...state, ...updates };
        const filters = computeFilters(newState);

        if (filters.ready) {
          const bodyKey = filterShortCodeBodyKey(filters);
          // gcTime must be set explicitly here: queryClient.fetchQuery adds
          // no React subscriber, so under the global gcTime: 0 the cache
          // entry would be evicted the instant the promise resolves, and
          // every subsequent set() would POST /shortFilters again.
          filters.filterShortCodePromise = queryClient.fetchQuery({
            queryKey: ["shortFilters", bodyKey],
            queryFn: () => saveListFiltersToServer(filters),
            staleTime: SHORT_CODE_STALE_TIME,
            gcTime: SHORT_CODE_STALE_TIME,
          });
        }

        return { ...updates, filters };
      });
    };

    return {
      ...initialState,

      setConfig: (config: FilterConfig) => {
        const state = get();
        const oldConfig = state.config;

        if (!oldConfig || oldConfig.filterSource === config.filterSource) {
          set({ config });
          return;
        }

        set({
          config,
          selectedOsVersions: [],
          selectedCountries: [],
          selectedNetworkProviders: [],
          selectedNetworkTypes: [],
          selectedNetworkGenerations: [],
          selectedLocales: [],
          selectedDeviceManufacturers: [],
          selectedDeviceNames: [],
          selectedSessionTypes: [],
          selectedSpanStatuses: [],
          selectedBugReportStatuses: [],
          selectedHttpMethods: [],
          selectedUdAttrMatchers: [],
          selectedFreeText: "",
          selectedRootSpanName: "",
        });
      },

      setApps: (apps, status) => set({ apps, appsApiStatus: status }),

      setFilterOptions: (data, status) => {
        if (data === null) {
          set({ filtersApiStatus: status });
          return;
        }
        set({
          filtersApiStatus: status,
          versions: data.versions,
          osVersions: data.osVersions,
          countries: data.countries,
          networkProviders: data.networkProviders,
          networkTypes: data.networkTypes,
          networkGenerations: data.networkGenerations,
          locales: data.locales,
          deviceManufacturers: data.deviceManufacturers,
          deviceNames: data.deviceNames,
          userDefAttrs: data.userDefAttrs,
          userDefAttrOps: data.userDefAttrOps,
        });
      },

      setRootSpanNames: (rootSpanNames, status) => {
        if (rootSpanNames === null) {
          set({ rootSpanNamesApiStatus: status });
          return;
        }
        set({ rootSpanNamesApiStatus: status, rootSpanNames });
      },

      setCurrentTeamId: (teamId) => set({ currentTeamId: teamId }),

      setSelectedApp: (app) => {
        const prevApp = get().selectedApp;
        // App switch: the new app has its own filter data, so any prior
        // selections are meaningless. Wipe them before fresh defaults arrive.
        if (prevApp !== null && app !== null && prevApp.id !== app.id) {
          set({
            selectedApp: app,
            filtersApiStatus: FiltersApiStatus.Loading,
            selectedVersions: [],
            selectedOsVersions: [],
          });
        } else {
          set({ selectedApp: app });
        }
      },

      setSelectedRootSpanName: (name) => set({ selectedRootSpanName: name }),
      setSelectedDateRange: (range) => set({ selectedDateRange: range }),
      setSelectedStartDate: (date) => set({ selectedStartDate: date }),
      setSelectedEndDate: (date) => set({ selectedEndDate: date }),
      setSelectedVersions: (versions) => set({ selectedVersions: versions }),
      setSelectedSessionTypes: (types) => set({ selectedSessionTypes: types }),
      setSelectedSpanStatuses: (statuses) =>
        set({ selectedSpanStatuses: statuses }),
      setSelectedBugReportStatuses: (statuses) =>
        set({ selectedBugReportStatuses: statuses }),
      setSelectedHttpMethods: (methods) =>
        set({ selectedHttpMethods: methods }),
      setSelectedOsVersions: (versions) =>
        set({ selectedOsVersions: versions }),
      setSelectedCountries: (countries) =>
        set({ selectedCountries: countries }),
      setSelectedNetworkProviders: (providers) =>
        set({ selectedNetworkProviders: providers }),
      setSelectedNetworkTypes: (types) => set({ selectedNetworkTypes: types }),
      setSelectedNetworkGenerations: (gens) =>
        set({ selectedNetworkGenerations: gens }),
      setSelectedLocales: (locales) => set({ selectedLocales: locales }),
      setSelectedDeviceManufacturers: (manufacturers) =>
        set({ selectedDeviceManufacturers: manufacturers }),
      setSelectedDeviceNames: (names) => set({ selectedDeviceNames: names }),
      setSelectedUdAttrMatchers: (matchers) =>
        set({ selectedUdAttrMatchers: matchers }),
      setSelectedFreeText: (text) => set({ selectedFreeText: text }),

      applySelections: (patch) => set(patch),

      markAppOnboarded: (appId) => {
        set((state) => {
          const apps = state.apps.map((a) =>
            a.id === appId ? { ...a, onboarded: true } : a,
          );
          const selectedApp =
            state.selectedApp?.id === appId
              ? { ...state.selectedApp, onboarded: true }
              : state.selectedApp;
          return { apps, selectedApp };
        });
      },

      resetForTeamChange: (newTeamId) => {
        set((state) => ({
          ...initialState,
          config: state.config,
          currentTeamId: newTeamId,
        }));
      },

      reset: () => {
        set((state) => ({
          ...initialState,
        }));
      },
    };
  });
}
