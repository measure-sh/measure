import { queryClient, SHORT_CODE_STALE_TIME } from "@/app/query/query_client"
import { createStore } from "zustand/vanilla"
import {
  App,
  AppsApiStatus,
  AppVersion,
  BugReportStatus,
  buildShortFiltersPostBody,
  defaultFilters,
  fetchAppsFromServer,
  fetchFiltersFromServer,
  fetchRootSpanNamesFromServer,
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
} from "../api/api_calls"
import { createInFlightTracker } from "./utils/in_flight"

export enum AppVersionsInitialSelectionType {
  Latest,
  All,
}

export { defaultFilters }
export type { Filters }

// --- Types ---

export type FilterConfig = {
  filterSource: FilterSource
  showNoData: boolean
  showNotOnboarded: boolean
  showAppSelector: boolean
  showDates: boolean
  showAppVersions: boolean
  showOsVersions: boolean
  showSessionTypes: boolean
  showCountries: boolean
  showNetworkProviders: boolean
  showNetworkTypes: boolean
  showNetworkGenerations: boolean
  showLocales: boolean
  showDeviceManufacturers: boolean
  showDeviceNames: boolean
  showBugReportStatus: boolean
  showHttpMethods: boolean
  showUdAttrs: boolean
  showFreeText: boolean
}


export type URLFilters = {
  appId?: string
  rootSpanName?: string
  startDate?: string
  endDate?: string
  dateRange?: string
  versions?: number[]
  sessionTypes?: SessionType[]
  spanStatuses?: SpanStatus[]
  bugReportStatuses?: BugReportStatus[]
  httpMethods?: HttpMethod[]
  osVersions?: number[]
  countries?: number[]
  networkProviders?: number[]
  networkTypes?: number[]
  networkGenerations?: number[]
  locales?: number[]
  deviceManufacturers?: number[]
  deviceNames?: number[]
  udAttrMatchers?: UdAttrMatcher[]
  freeText?: string
}

export type InitConfig = {
  urlFilters: URLFilters
  appId?: string
  appVersionsInitialSelectionType: AppVersionsInitialSelectionType
  filterSource: FilterSource
}


type FilterOptionsData = {
  versions: AppVersion[]
  osVersions: OsVersion[]
  countries: string[]
  networkProviders: string[]
  networkTypes: string[]
  networkGenerations: string[]
  locales: string[]
  deviceManufacturers: string[]
  deviceNames: string[]
  userDefAttrs: UserDefAttr[]
  userDefAttrOps: Map<string, string[]>
}

// --- Constants ---

const allHttpMethods = [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE]
const allSessionTypes = [SessionType.Crashes, SessionType.ANRs, SessionType.BugReports, SessionType.Foreground, SessionType.Background, SessionType.UserInteraction]
const defaultSessionTypes = [SessionType.Crashes, SessionType.ANRs, SessionType.BugReports, SessionType.Foreground, SessionType.UserInteraction]
const allSpanStatuses = [SpanStatus.Unset, SpanStatus.Ok, SpanStatus.Error]
const allBugReportStatuses = [BugReportStatus.Open, BugReportStatus.Closed]

// --- URL serialization ---

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
}

function compressArrayToRanges(arr: number[]): string {
  /* v8 ignore next */
  if (arr.length === 0) return ""
  const sorted = [...new Set(arr)].sort((a, b) => a - b)
  let ranges: string[] = []
  let start = sorted[0]
  let current = start

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === current + 1) {
      current = sorted[i]
    } else {
      ranges.push(start === current ? `${start}` : `${start}-${current}`)
      start = sorted[i]
      current = start
    }
  }
  ranges.push(start === current ? `${start}` : `${start}-${current}`)
  return ranges.join(",")
}

export function expandRangesToArray(str: string): number[] {
  if (!str) return []
  const parts = str.split(",")
  const result: number[] = []
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number)
      for (let i = start; i <= end; i++) {
        result.push(i)
      }
    } else {
      const num = Number(part)
      if (!isNaN(num)) result.push(num)
    }
  }
  return result
}

function serializeUrlFilters(urlFilters: URLFilters, config: FilterConfig): string {
  const params = new URLSearchParams()

  Object.entries(urlFilters).forEach(([key, value]) => {
    const minifiedKey = urlFiltersKeyMap[key as keyof typeof urlFiltersKeyMap]
    if (!minifiedKey || value === undefined || value === null) return

    let serializedValue: string

    switch (key) {
      case "versions": if (!config.showAppVersions) return; break
      case "osVersions": if (!config.showOsVersions) return; break
      case "sessionTypes": if (!config.showSessionTypes) return; break
      case "countries": if (!config.showCountries) return; break
      case "networkProviders": if (!config.showNetworkProviders) return; break
      case "networkTypes": if (!config.showNetworkTypes) return; break
      case "networkGenerations": if (!config.showNetworkGenerations) return; break
      case "locales": if (!config.showLocales) return; break
      case "deviceManufacturers": if (!config.showDeviceManufacturers) return; break
      case "deviceNames": if (!config.showDeviceNames) return; break
      case "bugReportStatuses": if (!config.showBugReportStatus) return; break
      case "httpMethods": if (!config.showHttpMethods) return; break
      case "udAttrMatchers": if (!config.showUdAttrs) return; break
      case "freeText": if (!config.showFreeText) return; break
      case "startDate": case "endDate": case "dateRange": if (!config.showDates) return; break
      case "appId": if (!config.showAppSelector) return; break
      case "rootSpanName": case "spanStatuses":
        if (config.filterSource !== FilterSource.Spans) return; break
      /* v8 ignore next */
      default: break
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
        if ((value as number[]).length === 0) return
        serializedValue = compressArrayToRanges(value as number[])
        break
      case "udAttrMatchers":
        const validMatchers = (value as UdAttrMatcher[]).filter(
          (m) => m?.key && m?.type && m?.op && m.value !== undefined,
        )
        if (validMatchers.length === 0) return
        serializedValue = validMatchers
          .map((m) => `${encodeURIComponent(m.key)}~${encodeURIComponent(m.type)}~${encodeURIComponent(m.op)}~${encodeURIComponent(m.value)}`)
          .join("|")
        break
      case "spanStatuses":
      case "bugReportStatuses":
      case "httpMethods":
        if ((value as string[]).length === 0) return
        serializedValue = (value as string[]).join(",")
        break
      case "sessionTypes":
        if ((value as SessionType[]).length === 0) return
        serializedValue = (value as SessionType[]).join(",")
        break
      case "dateRange":
        serializedValue = value.toString()
        break
      default:
        if (value === "") return
        serializedValue = value.toString()
    }

    if (serializedValue) params.set(minifiedKey, serializedValue)
  })

  return params.toString()
}

// Exported for use in the Filters component's URL deserialization
export { urlFiltersKeyMap }

// --- State ---

interface FiltersStoreState {
  // Computed filters object (auto-updated on every state change)
  filters: Filters

  // Config (set by Filters component from its props)
  config: FilterConfig | null

  // API statuses
  appsApiStatus: AppsApiStatus
  filtersApiStatus: FiltersApiStatus
  rootSpanNamesApiStatus: RootSpanNamesApiStatus

  // Available option lists
  apps: App[]
  versions: AppVersion[]
  rootSpanNames: string[]
  osVersions: OsVersion[]
  countries: string[]
  networkProviders: string[]
  networkTypes: string[]
  networkGenerations: string[]
  locales: string[]
  deviceManufacturers: string[]
  deviceNames: string[]
  userDefAttrs: UserDefAttr[]
  userDefAttrOps: Map<string, string[]>

  // Global selected values — same on every page for the current app
  selectedApp: App | null
  selectedDateRange: string
  selectedStartDate: string
  selectedEndDate: string
  selectedVersions: AppVersion[]

  // Filter selections — reset to defaults on page navigation, persisted
  // within a page. App, versions, and dates above are persisted across pages.
  selectedRootSpanName: string
  selectedSessionTypes: SessionType[]
  selectedSpanStatuses: SpanStatus[]
  selectedBugReportStatuses: BugReportStatus[]
  selectedHttpMethods: HttpMethod[]
  selectedOsVersions: OsVersion[]
  selectedCountries: string[]
  selectedNetworkProviders: string[]
  selectedNetworkTypes: string[]
  selectedNetworkGenerations: string[]
  selectedLocales: string[]
  selectedDeviceManufacturers: string[]
  selectedDeviceNames: string[]
  selectedUdAttrMatchers: UdAttrMatcher[]
  selectedFreeText: string

  // Cache
  filterOptionsCache: Map<string, FilterOptionsData>
  rootSpanNamesCache: Map<string, string[]>
}

interface FiltersStoreActions {
  setConfig: (config: FilterConfig) => void
  fetchApps: (teamId: string, initConfig: InitConfig) => Promise<void>
  selectApp: (app: App, initConfig: InitConfig, forceRefresh?: boolean) => Promise<void>
  refresh: (teamId: string, initConfig: InitConfig, appIdToSelect?: string) => Promise<void>

  setSelectedRootSpanName: (name: string) => void
  setSelectedDateRange: (range: string) => void
  setSelectedStartDate: (date: string) => void
  setSelectedEndDate: (date: string) => void
  setSelectedVersions: (versions: AppVersion[]) => void
  setSelectedSessionTypes: (types: SessionType[]) => void
  setSelectedSpanStatuses: (statuses: SpanStatus[]) => void
  setSelectedBugReportStatuses: (statuses: BugReportStatus[]) => void
  setSelectedHttpMethods: (methods: HttpMethod[]) => void
  setSelectedOsVersions: (versions: OsVersion[]) => void
  setSelectedCountries: (countries: string[]) => void
  setSelectedNetworkProviders: (providers: string[]) => void
  setSelectedNetworkTypes: (types: string[]) => void
  setSelectedNetworkGenerations: (gens: string[]) => void
  setSelectedLocales: (locales: string[]) => void
  setSelectedDeviceManufacturers: (manufacturers: string[]) => void
  setSelectedDeviceNames: (names: string[]) => void
  setSelectedUdAttrMatchers: (matchers: UdAttrMatcher[]) => void
  setSelectedFreeText: (text: string) => void

  reset: (clearCache?: boolean) => void
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

  filterOptionsCache: new Map(),
  rootSpanNamesCache: new Map(),
}

// --- Derived state ---

function computeFilters(state: FiltersStoreState): Filters {
  if (!state.config || !state.selectedApp) {
    return defaultFilters
  }

  const config = state.config

  let ready = false
  if (config.showNoData && config.showNotOnboarded) {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      state.filtersApiStatus === FiltersApiStatus.Success
  } else if (config.showNoData) {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      (state.filtersApiStatus === FiltersApiStatus.Success ||
        state.filtersApiStatus === FiltersApiStatus.NotOnboarded)
  } else if (config.showNotOnboarded) {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      (state.filtersApiStatus === FiltersApiStatus.Success ||
        state.filtersApiStatus === FiltersApiStatus.NoData)
  } else {
    ready =
      state.appsApiStatus === AppsApiStatus.Success &&
      ((config.filterSource === FilterSource.Spans &&
        state.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
        config.filterSource !== FilterSource.Spans) &&
      (state.filtersApiStatus === FiltersApiStatus.Success ||
        state.filtersApiStatus === FiltersApiStatus.NoData ||
        state.filtersApiStatus === FiltersApiStatus.NotOnboarded)
  }

  const updatedUrlFilters: URLFilters = {
    appId: state.selectedApp.id,
    rootSpanName: state.selectedRootSpanName,
    startDate: state.selectedStartDate,
    endDate: state.selectedEndDate,
    dateRange: state.selectedDateRange || undefined,
    versions: state.selectedVersions.map((v) =>
      state.versions.findIndex((ver) => ver.name === v.name && ver.code === v.code),
    ),
    sessionTypes: state.selectedSessionTypes,
    spanStatuses: state.selectedSpanStatuses,
    bugReportStatuses: state.selectedBugReportStatuses,
    httpMethods: state.selectedHttpMethods,
    osVersions: state.selectedOsVersions.map((os) =>
      state.osVersions.findIndex((o) => o.name === os.name && o.version === os.version),
    ),
    countries: state.selectedCountries.map((c) => state.countries.indexOf(c)),
    networkProviders: state.selectedNetworkProviders.map((np) => state.networkProviders.indexOf(np)),
    networkTypes: state.selectedNetworkTypes.map((nt) => state.networkTypes.indexOf(nt)),
    networkGenerations: state.selectedNetworkGenerations.map((ng) => state.networkGenerations.indexOf(ng)),
    locales: state.selectedLocales.map((l) => state.locales.indexOf(l)),
    deviceManufacturers: state.selectedDeviceManufacturers.map((dm) => state.deviceManufacturers.indexOf(dm)),
    deviceNames: state.selectedDeviceNames.map((dn) => state.deviceNames.indexOf(dn)),
    udAttrMatchers: state.selectedUdAttrMatchers,
    freeText: state.selectedFreeText,
  }

  return {
    ready,
    app: state.selectedApp,
    rootSpanName: state.selectedRootSpanName,
    startDate: state.selectedStartDate,
    endDate: state.selectedEndDate,
    versions: { selected: state.selectedVersions, all: state.versions.length === state.selectedVersions.length },
    sessionTypes: { selected: state.selectedSessionTypes, all: state.selectedSessionTypes.length === allSessionTypes.length },
    spanStatuses: { selected: state.selectedSpanStatuses, all: state.selectedSpanStatuses.length === allSpanStatuses.length },
    bugReportStatuses: { selected: state.selectedBugReportStatuses, all: state.selectedBugReportStatuses.length === allBugReportStatuses.length },
    httpMethods: { selected: state.selectedHttpMethods, all: state.selectedHttpMethods.length === allHttpMethods.length },
    osVersions: { selected: state.selectedOsVersions, all: state.selectedOsVersions.length === state.osVersions.length },
    countries: { selected: state.selectedCountries, all: state.selectedCountries.length === state.countries.length },
    networkProviders: { selected: state.selectedNetworkProviders, all: state.selectedNetworkProviders.length === state.networkProviders.length },
    networkTypes: { selected: state.selectedNetworkTypes, all: state.selectedNetworkTypes.length === state.networkTypes.length },
    networkGenerations: { selected: state.selectedNetworkGenerations, all: state.selectedNetworkGenerations.length === state.networkGenerations.length },
    locales: { selected: state.selectedLocales, all: state.selectedLocales.length === state.locales.length },
    deviceManufacturers: { selected: state.selectedDeviceManufacturers, all: state.selectedDeviceManufacturers.length === state.deviceManufacturers.length },
    deviceNames: { selected: state.selectedDeviceNames, all: state.selectedDeviceNames.length === state.deviceNames.length },
    udAttrMatchers: state.selectedUdAttrMatchers,
    freeText: state.selectedFreeText,
    serialisedFilters: serializeUrlFilters(updatedUrlFilters, config),
    // Placeholder; the wrapped `set` overwrites this with a real POST promise
    // when serialisedFilters changes (and otherwise carries the existing one
    // forward via state.filters).
    filterShortCodePromise: state.filters.filterShortCodePromise,
  }
}

// --- Helpers ---

function clearSelections(): Partial<FiltersStoreState> {
  return {
    selectedVersions: [],
    selectedSessionTypes: [],
    selectedOsVersions: [],
    selectedCountries: [],
    selectedNetworkProviders: [],
    selectedNetworkTypes: [],
    selectedNetworkGenerations: [],
    selectedLocales: [],
    selectedDeviceManufacturers: [],
    selectedDeviceNames: [],
    selectedFreeText: "",
    selectedSpanStatuses: [],
    selectedRootSpanName: "",
    selectedBugReportStatuses: [],
    selectedHttpMethods: allHttpMethods,
    selectedUdAttrMatchers: [],
  }
}

// Resolve filter selections for the current app and filter data.
// Priority: URL params > existing selections > defaults.
// App, versions, and dates are handled by the caller.
function applyFilterOptions(
  data: FilterOptionsData,
  app: App,
  initConfig: InitConfig,
  currentState: FiltersStoreState,
): Partial<FiltersStoreState> {
  const { urlFilters, appVersionsInitialSelectionType, filterSource } = initConfig
  const isUrlMatch = urlFilters.appId === app.id
  // Preserve current selections if any have been set before (i.e. this
  // isn't the very first load for this app). All selections are shared
  // across pages — only the UI visibility changes per page.
  // We check selectedOsVersions as a proxy: it's populated on every
  // successful filter load and cleared on app switch.
  const hasExistingSelections = currentState.selectedOsVersions.length > 0

  // --- selectedVersions (global): URL > preserved > default ---
  // `selectedVersions` carries across all pages for the current app. Only
  // reset to the default on a fresh app (selectAppImpl does that before
  // calling this function).
  let selectedVersions: AppVersion[]
  if (isUrlMatch && urlFilters.versions) {
    selectedVersions = urlFilters.versions
      .filter((index) => index >= 0 && index < data.versions.length)
      .map((index) => data.versions[index])
    if (selectedVersions.length === 0) {
      // URL indices were all invalid for this data — fall through to global preserve / default.
      selectedVersions = currentState.selectedVersions.length > 0
        ? currentState.selectedVersions
        : appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All
          ? data.versions
          : data.versions.slice(0, 1)
    }
  } else if (currentState.selectedVersions.length > 0) {
    selectedVersions = currentState.selectedVersions
  } else if (appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All) {
    selectedVersions = data.versions
  } else {
    selectedVersions = data.versions.slice(0, 1)
  }

  // --- Filter selection helpers ---

  // Index-based lists (URL carries indices into `data.X`).
  const resolveIndexList = <T>(
    urlValue: number[] | undefined,
    newAvailable: T[],
    currentSelected: T[],
    defaultValue: T[],
  ): T[] => {
    if (isUrlMatch && urlValue !== undefined) {
      const fromUrl = urlValue
        .filter((index) => index >= 0 && index < newAvailable.length)
        .map((index) => newAvailable[index])
      if (fromUrl.length > 0) {
        return fromUrl
      }
    }
    if (hasExistingSelections) {
      return currentSelected
    }
    return defaultValue
  }

  const selectedOsVersions = resolveIndexList(
    urlFilters.osVersions,
    data.osVersions,
    currentState.selectedOsVersions,
    data.osVersions,
  )
  const selectedCountries = resolveIndexList(
    urlFilters.countries,
    data.countries,
    currentState.selectedCountries,
    data.countries,
  )
  const selectedNetworkProviders = resolveIndexList(
    urlFilters.networkProviders,
    data.networkProviders,
    currentState.selectedNetworkProviders,
    data.networkProviders,
  )
  const selectedNetworkTypes = resolveIndexList(
    urlFilters.networkTypes,
    data.networkTypes,
    currentState.selectedNetworkTypes,
    data.networkTypes,
  )
  const selectedNetworkGenerations = resolveIndexList(
    urlFilters.networkGenerations,
    data.networkGenerations,
    currentState.selectedNetworkGenerations,
    data.networkGenerations,
  )
  const selectedLocales = resolveIndexList(
    urlFilters.locales,
    data.locales,
    currentState.selectedLocales,
    data.locales,
  )
  const selectedDeviceManufacturers = resolveIndexList(
    urlFilters.deviceManufacturers,
    data.deviceManufacturers,
    currentState.selectedDeviceManufacturers,
    data.deviceManufacturers,
  )
  const selectedDeviceNames = resolveIndexList(
    urlFilters.deviceNames,
    data.deviceNames,
    currentState.selectedDeviceNames,
    data.deviceNames,
  )

  // udAttrMatchers — URL validates; preserved carries over; default is [].
  const isMatcherValid = (m: UdAttrMatcher): boolean => {
    const attr = data.userDefAttrs.find((a) => a.key === m.key)
    if (!attr || attr.type !== m.type) {
      return false
    }
    const ops = data.userDefAttrOps.get(attr.type)
    /* v8 ignore next */
    return ops ? ops.includes(m.op) : false
  }
  let selectedUdAttrMatchers: UdAttrMatcher[]
  if (isUrlMatch && urlFilters.udAttrMatchers && data.userDefAttrs.length > 0) {
    selectedUdAttrMatchers = urlFilters.udAttrMatchers.filter(isMatcherValid)
  } else if (hasExistingSelections) {
    // Drop any matchers whose attr key no longer exists in the new data.
    selectedUdAttrMatchers = currentState.selectedUdAttrMatchers.filter(isMatcherValid)
  } else {
    selectedUdAttrMatchers = []
  }

  // Enum / string lists without indices.
  let selectedSpanStatuses: SpanStatus[]
  if (isUrlMatch && urlFilters.spanStatuses) {
    selectedSpanStatuses = urlFilters.spanStatuses
      .filter((s: string) => Object.values(SpanStatus).includes(s as SpanStatus))
      .map((s: string) => s as SpanStatus)
  } else if (hasExistingSelections) {
    selectedSpanStatuses = currentState.selectedSpanStatuses
  } else {
    selectedSpanStatuses = filterSource === FilterSource.Spans ? allSpanStatuses : []
  }

  let selectedBugReportStatuses: BugReportStatus[]
  if (isUrlMatch && urlFilters.bugReportStatuses) {
    selectedBugReportStatuses = urlFilters.bugReportStatuses
      .filter((s: string) => Object.values(BugReportStatus).includes(s as BugReportStatus))
      .map((s: string) => s as BugReportStatus)
  } else if (hasExistingSelections) {
    selectedBugReportStatuses = currentState.selectedBugReportStatuses
  } else {
    selectedBugReportStatuses = [BugReportStatus.Open]
  }

  let selectedHttpMethods: HttpMethod[]
  if (isUrlMatch && urlFilters.httpMethods) {
    selectedHttpMethods = urlFilters.httpMethods
      .filter((s: string) => Object.values(HttpMethod).includes(s as HttpMethod))
      .map((s: string) => s as HttpMethod)
  } else if (hasExistingSelections) {
    selectedHttpMethods = currentState.selectedHttpMethods
  } else {
    selectedHttpMethods = allHttpMethods
  }

  let selectedSessionTypes: SessionType[]
  if (isUrlMatch && urlFilters.sessionTypes) {
    selectedSessionTypes = urlFilters.sessionTypes
      .filter((s: string) => Object.values(SessionType).includes(s as SessionType))
      .map((s: string) => s as SessionType)
  } else if (hasExistingSelections) {
    selectedSessionTypes = currentState.selectedSessionTypes
  } else {
    selectedSessionTypes = defaultSessionTypes
  }

  let selectedFreeText: string
  if (isUrlMatch && urlFilters.freeText) {
    selectedFreeText = urlFilters.freeText
  } else if (hasExistingSelections) {
    selectedFreeText = currentState.selectedFreeText
  } else {
    selectedFreeText = ""
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
  }
}

function parseFilterResponse(data: any): FilterOptionsData {
  const versions = data.versions !== null
    ? data.versions.map((v: { name: string; code: string }) => new AppVersion(v.name, v.code))
    : []

  const osVersions = data.os_versions !== null
    ? data.os_versions.map((v: { name: string; version: string }) => new OsVersion(v.name, v.version))
    : []

  let userDefAttrs: UserDefAttr[] = []
  let userDefAttrOps = new Map<string, string[]>()
  if (data.ud_attrs !== null && data.ud_attrs.key_types !== null && data.ud_attrs.operator_types !== null) {
    userDefAttrs = data.ud_attrs.key_types
    userDefAttrOps = new Map<string, string[]>(Object.entries(data.ud_attrs.operator_types))
  }

  return {
    versions,
    osVersions,
    countries: data.countries ?? [],
    networkProviders: data.network_providers ?? [],
    networkTypes: data.network_types ?? [],
    networkGenerations: data.network_generations ?? [],
    locales: data.locales ?? [],
    deviceManufacturers: data.device_manufacturers ?? [],
    deviceNames: data.device_names ?? [],
    userDefAttrs,
    userDefAttrOps,
  }
}

function pickApp(apps: App[], initConfig: InitConfig, currentSelectedApp: App | null): App | undefined {
  const { urlFilters, appId } = initConfig

  if (urlFilters.appId) {
    const app = apps.find((e: App) => e.id === urlFilters.appId)
    if (app) {
      return app
    }
  }

  if (appId !== undefined) {
    const app = apps.find((e: App) => e.id === appId)
    if (app) {
      return app
    }
  }

  // Preserve the user's app selection across page navigations. The store
  // survives navigation, so the previously selected app is still here.
  if (currentSelectedApp) {
    const app = apps.find((e: App) => e.id === currentSelectedApp.id)
    if (app) {
      return app
    }
  }

  return apps[0]
}

// Signature of the exact /shortFilters POST that saveListFiltersToServer
// would send — computed by hashing the body that buildShortFiltersPostBody
// produces. Used to decide whether a fresh POST is needed. Because the key
// is a 1:1 mirror of the POST body, it automatically ignores every field
// that doesn't affect the server-side filter (dates, `show*` config flags,
// freeText, session types, span/bug-report statuses, http methods, etc.)
// and stays correct as long as buildShortFiltersPostBody stays correct.
function filterShortCodeBodyKey(filters: Filters): string {
  const body = buildShortFiltersPostBody(filters)
  // URL path (app id) is also part of the server request, so include it
  // alongside the body — two different apps with the same body are still
  // different short codes. `filters.app` is always set here (the wrapped
  // `set` only invokes this when filters.ready is true, which requires an
  // app selection), so the `?? null` fallback is purely defensive.
  /* v8 ignore next */
  return JSON.stringify({ app: filters.app?.id ?? null, body })
}

// --- Store ---

export type FiltersStore = FiltersStoreState & FiltersStoreActions

export function createFiltersStore() {
  return createStore<FiltersStore>()((rawSet, get) => {
    const set: typeof rawSet = (partial) => {
      rawSet((state) => {
        const updates = typeof partial === 'function' ? partial(state) : partial
        const newState = { ...state, ...updates }
        const filters = computeFilters(newState)

        if (filters.ready) {
          const bodyKey = filterShortCodeBodyKey(filters)
          // queryClient.fetchQuery deduplicates in-flight calls with the same
          // key and caches results for staleTime (5 min). No manual Map needed.
          filters.filterShortCodePromise = queryClient.fetchQuery({
            queryKey: ["shortFilters", bodyKey],
            queryFn: () => saveListFiltersToServer(filters),
            staleTime: SHORT_CODE_STALE_TIME,
          })
        }

        return { ...updates, filters }
      })
    }

    const fetchAppsTracker = createInFlightTracker()
    const selectAppTracker = createInFlightTracker()

    const selectAppImpl = async (app: App, initConfig: InitConfig, forceRefresh?: boolean) => {
      const { filterSource } = initConfig
      const prevApp = get().selectedApp

      // App switch: the new app has its own filter data, so any prior
      // selections are meaningless. Wipe them before applying defaults.
      if (prevApp !== null && prevApp.id !== app.id) {
        set({
          selectedApp: app,
          filtersApiStatus: FiltersApiStatus.Loading,
          selectedVersions: [],
          selectedOsVersions: [],
        })
      } else {
        set({ selectedApp: app, filtersApiStatus: FiltersApiStatus.Loading })
      }

      const cacheKey = `${app.id}:${filterSource}`
      const cached = get().filterOptionsCache.get(cacheKey)

      if (cached && !forceRefresh) {
        const selections = applyFilterOptions(cached, app, initConfig, get())
        set({
          filtersApiStatus: FiltersApiStatus.Success,
          ...selections,
        })
      } else {
        const result = await fetchFiltersFromServer(app, filterSource)

        switch (result.status) {
          case FiltersApiStatus.NotOnboarded:
            set({
              filtersApiStatus: FiltersApiStatus.NotOnboarded,
              ...clearSelections(),
            })
            break
          case FiltersApiStatus.NoData:
            set({
              filtersApiStatus: FiltersApiStatus.NoData,
              ...clearSelections(),
            })
            break
          case FiltersApiStatus.Error:
            set({
              filtersApiStatus: FiltersApiStatus.Error,
              ...clearSelections(),
            })
            break
          case FiltersApiStatus.Success: {
            const filterOptions = parseFilterResponse(result.data)

            const newCache = new Map(get().filterOptionsCache)
            newCache.set(cacheKey, filterOptions)

            const selections = applyFilterOptions(filterOptions, app, initConfig, get())
            set({
              filtersApiStatus: FiltersApiStatus.Success,
              filterOptionsCache: newCache,
              ...selections,
            })
            break
          }
        }
      }

      if (filterSource === FilterSource.Spans) {
        const cachedSpanNames = get().rootSpanNamesCache.get(app.id)

        if (cachedSpanNames && !forceRefresh) {
          let selectedRootSpanName: string
          if (initConfig.urlFilters.appId === app.id && initConfig.urlFilters.rootSpanName) {
            const found = cachedSpanNames.find((name: string) => name === initConfig.urlFilters.rootSpanName)
            selectedRootSpanName = found ?? cachedSpanNames[0]
          } else {
            selectedRootSpanName = cachedSpanNames[0]
          }
          set({
            rootSpanNamesApiStatus: RootSpanNamesApiStatus.Success,
            rootSpanNames: cachedSpanNames,
            selectedRootSpanName,
          })
        } else {
          set({ rootSpanNamesApiStatus: RootSpanNamesApiStatus.Loading })

          const result = await fetchRootSpanNamesFromServer(app)

          switch (result.status) {
            case RootSpanNamesApiStatus.NoData:
              set({ rootSpanNamesApiStatus: RootSpanNamesApiStatus.NoData })
              break
            case RootSpanNamesApiStatus.Error:
              set({ rootSpanNamesApiStatus: RootSpanNamesApiStatus.Error })
              break
            case RootSpanNamesApiStatus.Success:
              if (result.data.results !== null) {
                const parsedRootSpanNames = result.data.results

                const newSpanCache = new Map(get().rootSpanNamesCache)
                newSpanCache.set(app.id, parsedRootSpanNames)

                let selectedRootSpanName: string
                if (initConfig.urlFilters.appId === app.id && initConfig.urlFilters.rootSpanName) {
                  const found = parsedRootSpanNames.find((name: string) => name === initConfig.urlFilters.rootSpanName)
                  selectedRootSpanName = found ?? parsedRootSpanNames[0]
                } else {
                  selectedRootSpanName = parsedRootSpanNames[0]
                }

                set({
                  rootSpanNamesApiStatus: RootSpanNamesApiStatus.Success,
                  rootSpanNames: parsedRootSpanNames,
                  rootSpanNamesCache: newSpanCache,
                  selectedRootSpanName,
                })
              }
              break
          }
        }
      }
    }

    const selectApp = (app: App, initConfig: InitConfig, forceRefresh?: boolean): Promise<void> => {
      if (forceRefresh) {
        return selectAppImpl(app, initConfig, forceRefresh)
      }
      return selectAppTracker(`${app.id}:${initConfig.filterSource}`, () => selectAppImpl(app, initConfig, forceRefresh))
    }

    return {
      ...initialState,

      setConfig: (config: FilterConfig) => {
        const state = get()
        const oldConfig = state.config

        // Same source or first mount — just update config.
        if (!oldConfig || oldConfig.filterSource === config.filterSource) {
          set({ config })
          return
        }

        // Source changed — clear per-page selections so applyFilterOptions
        // applies fresh defaults. App, versions, and dates are preserved.
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
        })
      },

      fetchApps: (teamId: string, initConfig: InitConfig) => fetchAppsTracker(teamId, async () => {
        if (get().apps.length > 0) {
          const app = pickApp(get().apps, initConfig, get().selectedApp)
          if (app) {
            await get().selectApp(app, initConfig)
          }
          return
        }

        set({ appsApiStatus: AppsApiStatus.Loading })

        const result = await fetchAppsFromServer(teamId)

        switch (result.status) {
          case AppsApiStatus.NoApps:
            set({ appsApiStatus: AppsApiStatus.NoApps })
            break
          case AppsApiStatus.Error:
            set({ appsApiStatus: AppsApiStatus.Error })
            break
          case AppsApiStatus.Success:
            set({ appsApiStatus: AppsApiStatus.Success, apps: result.data })
            const app = pickApp(result.data, initConfig, get().selectedApp)
            if (app) {
              await get().selectApp(app, initConfig)
            }
            break
        }
      }),

      selectApp,

      refresh: async (teamId: string, initConfig: InitConfig, appIdToSelect?: string) => {
        set({
          filterOptionsCache: new Map(),
          rootSpanNamesCache: new Map(),
          apps: [],
        })

        set({ appsApiStatus: AppsApiStatus.Loading })

        const result = await fetchAppsFromServer(teamId)

        switch (result.status) {
          case AppsApiStatus.NoApps:
            set({ appsApiStatus: AppsApiStatus.NoApps })
            break
          case AppsApiStatus.Error:
            set({ appsApiStatus: AppsApiStatus.Error })
            break
          case AppsApiStatus.Success:
            set({ appsApiStatus: AppsApiStatus.Success, apps: result.data })

            let app: App | undefined
            if (appIdToSelect !== undefined) {
              app = result.data.find((e: App) => e.id === appIdToSelect)
              if (app === undefined) {
                throw Error("Invalid app Id: " + appIdToSelect + " provided to refresh")
              }
            } else {
              app = pickApp(result.data, initConfig, get().selectedApp)
            }

            if (app) {
              await get().selectApp(app, initConfig, true)
            }
            break
        }
      },

      setSelectedRootSpanName: (name) => set({ selectedRootSpanName: name }),
      setSelectedDateRange: (range) => set({ selectedDateRange: range }),
      setSelectedStartDate: (date) => set({ selectedStartDate: date }),
      setSelectedEndDate: (date) => set({ selectedEndDate: date }),
      setSelectedVersions: (versions) => set({ selectedVersions: versions }),
      setSelectedSessionTypes: (types) => set({ selectedSessionTypes: types }),
      setSelectedSpanStatuses: (statuses) => set({ selectedSpanStatuses: statuses }),
      setSelectedBugReportStatuses: (statuses) => set({ selectedBugReportStatuses: statuses }),
      setSelectedHttpMethods: (methods) => set({ selectedHttpMethods: methods }),
      setSelectedOsVersions: (versions) => set({ selectedOsVersions: versions }),
      setSelectedCountries: (countries) => set({ selectedCountries: countries }),
      setSelectedNetworkProviders: (providers) => set({ selectedNetworkProviders: providers }),
      setSelectedNetworkTypes: (types) => set({ selectedNetworkTypes: types }),
      setSelectedNetworkGenerations: (gens) => set({ selectedNetworkGenerations: gens }),
      setSelectedLocales: (locales) => set({ selectedLocales: locales }),
      setSelectedDeviceManufacturers: (manufacturers) => set({ selectedDeviceManufacturers: manufacturers }),
      setSelectedDeviceNames: (names) => set({ selectedDeviceNames: names }),
      setSelectedUdAttrMatchers: (matchers) => set({ selectedUdAttrMatchers: matchers }),
      setSelectedFreeText: (text) => set({ selectedFreeText: text }),

      reset: (clearCache?: boolean) => {
        fetchAppsTracker.clear()
        selectAppTracker.clear()
        set((state) => ({
          ...initialState,
          filterOptionsCache: clearCache ? new Map() : state.filterOptionsCache,
          rootSpanNamesCache: clearCache ? new Map() : state.rootSpanNamesCache,
        }))
      },
    }
  })
}

