"use client"

import { DateTime } from "luxon"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react"
import {
  App,
  AppsApiStatus,
  AppVersion,
  BugReportStatus,
  fetchAppsFromServer,
  fetchFiltersFromServer,
  fetchRootSpanNamesFromServer,
  FiltersApiStatus,
  FilterSource,
  OsVersion,
  RootSpanNamesApiStatus,
  SessionType,
  SpanStatus,
  UserDefAttr,
} from "../api/api_calls"
import { underlineLinkStyle } from "../utils/shared_styles"
import {
  formatDateToHumanReadableDateTime,
  formatIsoDateForDateTimeInputField,
  isValidTimestamp,
} from "../utils/time_utils"
import DebounceTextInput from "./debounce_text_input"
import DropdownSelect, { DropdownSelectType } from "./dropdown_select"
import FilterPill from "./filter_pill"
import { Input } from "./input"
import LoadingSpinner from "./loading_spinner"
import UserDefAttrSelector, { UdAttrMatcher } from "./user_def_attr_selector"

export enum AppVersionsInitialSelectionType {
  Latest,
  All,
}

interface FiltersProps {
  ref?: React.RefObject<HTMLDivElement>
  teamId: string
  appId?: string
  filterSource: FilterSource
  appVersionsInitialSelectionType: AppVersionsInitialSelectionType
  showNoData: boolean
  showNotOnboarded: boolean
  showAppSelector: boolean
  showDates: boolean
  showAppVersions: boolean
  showOsVersions: boolean
  showSessionType: boolean
  showCountries: boolean
  showNetworkProviders: boolean
  showNetworkTypes: boolean
  showNetworkGenerations: boolean
  showLocales: boolean
  showDeviceManufacturers: boolean
  showDeviceNames: boolean
  showBugReportStatus: boolean
  showUdAttrs: boolean
  showFreeText: boolean
  freeTextPlaceholder?: string
  onFiltersChanged: (filters: Filters) => void
}

const defaultFreeTextPlaceholder = "Search anything..."

enum DateRange {
  Last15Mins = "Last 15 Minutes",
  Last30Mins = "Last 30 Minutes",
  LastHour = "Last hour",
  Last3Hours = "Last 3 Hours",
  Last6Hours = "Last 6 Hours",
  Last12Hours = "Last 12 Hours",
  Last24Hours = "Last 24 Hours",
  LastWeek = "Last Week",
  Last15Days = "Last 15 Days",
  LastMonth = "Last Month",
  Last3Months = "Last 3 Months",
  Last6Months = "Last 6 Months",
  LastYear = "Last Year",
  Custom = "Custom Range",
}

export type Filters = {
  ready: boolean
  app: App | null
  rootSpanName: string
  startDate: string
  endDate: string
  versions: { selected: AppVersion[], all: boolean }
  sessionType: SessionType
  spanStatuses: { selected: SpanStatus[], all: boolean }
  bugReportStatuses: { selected: BugReportStatus[], all: boolean }
  osVersions: { selected: OsVersion[], all: boolean }
  countries: { selected: string[], all: boolean }
  networkProviders: { selected: string[], all: boolean }
  networkTypes: { selected: string[], all: boolean }
  networkGenerations: { selected: string[], all: boolean }
  locales: { selected: string[], all: boolean }
  deviceManufacturers: { selected: string[], all: boolean }
  deviceNames: { selected: string[], all: boolean }
  udAttrMatchers: UdAttrMatcher[]
  freeText: string
  serialisedFilters: string | null
}

type SessionPersistedFilters = {
  app: App
  dateRange: string
  startDate: string
  endDate: string
}

type URLFilters = {
  appId?: string
  rootSpanName?: string
  startDate?: string
  endDate?: string
  dateRange?: DateRange
  versions?: number[]
  sessionType?: SessionType
  spanStatuses?: SpanStatus[]
  bugReportStatuses?: BugReportStatus[]
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

export const defaultFilters: Filters = {
  ready: false,
  app: null,
  rootSpanName: "",
  startDate: "",
  endDate: "",
  versions: { selected: [], all: false },
  sessionType: SessionType.All,
  spanStatuses: { selected: [], all: false },
  bugReportStatuses: { selected: [], all: false },
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
}

const Filters = forwardRef<{ refresh: () => void }, FiltersProps>(
  (
    {
      teamId,
      appId,
      filterSource,
      appVersionsInitialSelectionType,
      showNoData,
      showNotOnboarded,
      showAppSelector,
      showDates,
      showAppVersions,
      showOsVersions,
      showSessionType,
      showCountries,
      showNetworkTypes,
      showNetworkProviders,
      showNetworkGenerations,
      showLocales,
      showDeviceManufacturers,
      showDeviceNames,
      showBugReportStatus,
      showUdAttrs,
      showFreeText,
      freeTextPlaceholder,
      onFiltersChanged,
    },
    ref,
  ) => {
    const urlFiltersKeyMap = {
      appId: "a",
      rootSpanName: "r",
      dateRange: "d",
      startDate: "sd",
      endDate: "ed",
      versions: "v",
      sessionType: "st",
      spanStatuses: "ss",
      bugReportStatuses: "bs",
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

    function expandRangesToArray(str: string): number[] {
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

    function serializeUrlFilters(urlFilters: URLFilters): string {
      const params = new URLSearchParams()

      Object.entries(urlFilters).forEach(([key, value]) => {
        const minifiedKey =
          urlFiltersKeyMap[key as keyof typeof urlFiltersKeyMap]
        if (!minifiedKey || value === undefined || value === null) return

        let serializedValue: string

        // only add keys whose show flags are true
        switch (key) {
          case "versions":
            if (!showAppVersions) return
            break
          case "osVersions":
            if (!showOsVersions) return
            break
          case "sessionType":
            if (!showSessionType) return
            break
          case "countries":
            if (!showCountries) return
            break
          case "networkProviders":
            if (!showNetworkProviders) return
            break
          case "networkTypes":
            if (!showNetworkTypes) return
            break
          case "networkGenerations":
            if (!showNetworkGenerations) return
            break
          case "locales":
            if (!showLocales) return
            break
          case "deviceManufacturers":
            if (!showDeviceManufacturers) return
            break
          case "deviceNames":
            if (!showDeviceNames) return
            break
          case "bugReportStatuses":
            if (!showBugReportStatus) return
            break
          case "udAttrMatchers":
            if (!showUdAttrs) return
            break
          case "freeText":
            if (!showFreeText) return
            break
          case "startDate":
          case "endDate":
          case "dateRange":
            if (!showDates) return
            break
          case "appId":
            if (!showAppSelector) return
            break
          case "rootSpanName":
          case "spanStatuses":
            if (filterSource !== FilterSource.Spans) return
            break
          default:
            break
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
              .map(
                (m) =>
                  `${encodeURIComponent(m.key)}~${encodeURIComponent(m.type)}~${encodeURIComponent(m.op)}~${encodeURIComponent(m.value)}`,
              )
              .join("|")
            break

          case "spanStatuses":
          case "bugReportStatuses":
            if ((value as string[]).length === 0) return
            serializedValue = (value as string[]).join(",")
            break

          case "sessionType":
            if (value === SessionType.All) return
            serializedValue = value.toString()
            break

          case "dateRange":
            if (value === DateRange.Last6Hours) return // Or your default date range
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

    function deserializeUrlFilters(queryString: string): URLFilters {
      const params = new URLSearchParams(queryString)
      const result: URLFilters = {}

      for (const [minifiedKey, value] of params.entries()) {
        const originalKey = Object.entries(urlFiltersKeyMap).find(
          ([_, v]) => v === minifiedKey,
        )?.[0] as keyof URLFilters
        if (!originalKey) continue

        try {
          switch (originalKey) {
            case "versions":
            case "osVersions":
            case "countries":
            case "networkProviders":
            case "networkTypes":
            case "networkGenerations":
            case "locales":
            case "deviceManufacturers":
            case "deviceNames":
              result[originalKey] = expandRangesToArray(value)
              break

            case "udAttrMatchers":
              result[originalKey] = value
                .split("|")
                .filter((part) => part)
                .map((part) => {
                  const [key, type, op, val] = part
                    .split("~")
                    .map(decodeURIComponent)
                  return { key, type, op, value: val } as UdAttrMatcher
                })
                .filter((m) => m.key && m.type && m.op && m.value)
              break

            case "spanStatuses":
              result[originalKey] = value
                .split(",")
                .filter((s): s is SpanStatus =>
                  Object.values(SpanStatus).includes(s as SpanStatus),
                )
              break

            case "bugReportStatuses":
              result[originalKey] = value
                .split(",")
                .filter((s): s is BugReportStatus =>
                  Object.values(BugReportStatus).includes(s as BugReportStatus),
                )
              break

            case "sessionType":
              result[originalKey] = getSessionTypeFromString(value)
              break

            case "dateRange":
              result[originalKey] = Object.values(DateRange).includes(
                value as DateRange,
              )
                ? (value as DateRange)
                : undefined
              break

            default:
              if (isStringKey(originalKey)) {
                result[originalKey] = value
              }
              break
          }
        } catch (error) {
          console.warn(`Failed to parse ${originalKey}`, error)
        }
      }

      return result
    }

    // Type guard for string-based URLFilter keys
    function isStringKey(
      key: string,
    ): key is "appId" | "rootSpanName" | "startDate" | "endDate" | "freeText" {
      return [
        "appId",
        "rootSpanName",
        "startDate",
        "endDate",
        "freeText",
      ].includes(key)
    }

    function getSessionTypeFromString(value: string): SessionType {
      const enumValues = Object.values(SessionType) as string[]
      const enumKeys = Object.keys(SessionType) as Array<
        keyof typeof SessionType
      >

      const index = enumValues.indexOf(value)
      if (index !== -1) {
        return SessionType[enumKeys[index]]
      }

      throw "Invalid string cannot be mapped to SessionType: " + value
    }

    function mapDateRangeToDate(dateRange: string) {
      let today = DateTime.now()

      switch (dateRange) {
        case DateRange.Last15Mins:
          return today.minus({ minutes: 15 })
        case DateRange.Last30Mins:
          return today.minus({ minutes: 30 })
        case DateRange.LastHour:
          return today.minus({ hours: 1 })
        case DateRange.Last3Hours:
          return today.minus({ hours: 3 })
        case DateRange.Last6Hours:
          return today.minus({ hours: 6 })
        case DateRange.Last12Hours:
          return today.minus({ hours: 12 })
        case DateRange.Last24Hours:
          return today.minus({ hours: 24 })
        case DateRange.LastWeek:
          return today.minus({ days: 7 })
        case DateRange.Last15Days:
          return today.minus({ days: 15 })
        case DateRange.LastMonth:
          return today.minus({ months: 1 })
        case DateRange.Last3Months:
          return today.minus({ months: 3 })
        case DateRange.Last6Months:
          return today.minus({ months: 6 })
        case DateRange.LastYear:
          return today.minus({ years: 1 })
        case DateRange.Custom:
          throw Error("Custom date range cannot be mapped to date")
      }
    }

    const searchParams = useSearchParams()
    const pathName = usePathname()

    const urlFilters = deserializeUrlFilters(searchParams.toString())
    const sessionPersistedFiltersKey = "sessionPersistedFilters"
    const sessionPersistedFilters: SessionPersistedFilters | null =
      typeof window !== "undefined" &&
        sessionStorage.getItem(sessionPersistedFiltersKey) !== null
        ? JSON.parse(sessionStorage.getItem(sessionPersistedFiltersKey)!)
        : null

    const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading)
    const [rootSpanNamesApiStatus, setRootSpanNamesApiStatus] = useState(
      RootSpanNamesApiStatus.Loading,
    )
    const [filtersApiStatus, setFiltersApiStatus] = useState(
      FiltersApiStatus.Loading,
    )

    const [apps, setApps] = useState<App[]>([])
    const [selectedApp, setSelectedApp] = useState<App | null>(null)

    const [rootSpanNames, setRootSpanNames] = useState([] as string[])
    const [selectedRootSpanName, setSelectedRootSpanName] = useState("")

    const spanStatuses = [SpanStatus.Unset, SpanStatus.Ok, SpanStatus.Error]
    const [selectedSpanStatuses, setSelectedSpanStatuses] = useState(
      filterSource === FilterSource.Spans
        ? spanStatuses
        : [],
    )

    const bugReportStatuses = [BugReportStatus.Open, BugReportStatus.Closed]
    const [selectedBugReportStatuses, setSelectedBugReportStatuses] = useState([
      BugReportStatus.Open,
    ])

    const [versions, setVersions] = useState([] as AppVersion[])
    const [selectedVersions, setSelectedVersions] = useState(
      [] as AppVersion[],
    )

    const [selectedSessionType, setSelectedSessionType] = useState(
      SessionType.All,
    )

    const [osVersions, setOsVersions] = useState([] as OsVersion[])
    const [selectedOsVersions, setSelectedOsVersions] = useState(
      [] as OsVersion[],
    )

    const [countries, setCountries] = useState([] as string[])
    const [selectedCountries, setSelectedCountries] = useState([] as string[])

    const [networkProviders, setNetworkProviders] = useState([] as string[])
    const [selectedNetworkProviders, setSelectedNetworkProviders] = useState(
      [] as string[],
    )

    const [networkTypes, setNetworkTypes] = useState([] as string[])
    const [selectedNetworkTypes, setSelectedNetworkTypes] = useState(
      [] as string[],
    )

    const [networkGenerations, setNetworkGenerations] = useState(
      [] as string[],
    )
    const [selectedNetworkGenerations, setSelectedNetworkGenerations] =
      useState([] as string[])

    const [locales, setLocales] = useState([] as string[])
    const [selectedLocales, setSelectedLocales] = useState([] as string[])

    const [deviceManufacturers, setDeviceManufacturers] = useState(
      [] as string[],
    )
    const [selectedDeviceManufacturers, setSelectedDeviceManufacturers] =
      useState([] as string[])

    const [deviceNames, setDeviceNames] = useState([] as string[])
    const [selectedDeviceNames, setSelectedDeviceNames] = useState(
      [] as string[],
    )

    const [userDefAttrs, setUserDefAttrs] = useState([] as UserDefAttr[])
    const [userDefAttrOps, setUserDefAttrOps] = useState<Map<string, string[]>>(
      new Map(),
    )
    const [selectedUdAttrMatchers, setSelectedUdAttrMatchers] = useState<
      UdAttrMatcher[]
    >([])

    const [selectedFreeText, setSelectedFreeText] = useState("")

    const initDateRange = urlFilters.dateRange
      ? urlFilters.dateRange
      : sessionPersistedFilters
        ? sessionPersistedFilters.dateRange
        : DateRange.Last6Hours
    const [selectedDateRange, setSelectedDateRange] = useState(initDateRange)
    const [selectedStartDate, setSelectedStartDate] = useState(
      urlFilters.startDate
        ? urlFilters.startDate
        : sessionPersistedFilters
          ? sessionPersistedFilters.dateRange === DateRange.Custom
            ? sessionPersistedFilters.startDate
            : mapDateRangeToDate(initDateRange)!.toISO()
          : DateTime.now().minus({ hours: 6 }).toISO(),
    )
    const [selectedEndDate, setSelectedEndDate] = useState(
      urlFilters.endDate
        ? urlFilters.endDate
        : sessionPersistedFilters
          ? sessionPersistedFilters.dateRange === DateRange.Custom
            ? sessionPersistedFilters.endDate
            : DateTime.now().toISO()
          : DateTime.now().toISO(),
    )

    const getApps = async (appIdToSelect?: string) => {
      setAppsApiStatus(AppsApiStatus.Loading)

      const result = await fetchAppsFromServer(teamId)

      switch (result.status) {
        case AppsApiStatus.NoApps:
          setAppsApiStatus(AppsApiStatus.NoApps)
          break
        case AppsApiStatus.Error:
          setAppsApiStatus(AppsApiStatus.Error)
          break
        case AppsApiStatus.Success:
          setAppsApiStatus(AppsApiStatus.Success)
          setApps(result.data)
          // Prefer app from function call, then url filters, then provided appId from props, then global persisted filters and finally first one in list
          if (appIdToSelect !== undefined) {
            let appFromGivenId = result.data.find(
              (e: App) => e.id === appIdToSelect,
            )
            if (appFromGivenId === undefined) {
              throw Error(
                "Invalid app Id: " +
                appIdToSelect +
                " provided to getApps function",
              )
            } else {
              setSelectedApp(appFromGivenId)
            }
          } else if (urlFilters.appId) {
            let appFromUrlFilters = result.data.find(
              (e: App) => e.id === urlFilters.appId,
            )
            if (appFromUrlFilters === undefined) {
              throw Error(
                "Invalid app Id: " + urlFilters.appId + " provided in URL",
              )
            } else {
              setSelectedApp(appFromUrlFilters)
            }
            break
          } else if (appId !== undefined) {
            let appFromGivenId = result.data.find((e: App) => e.id === appId)
            if (appFromGivenId === undefined) {
              throw Error(
                "Invalid app Id: " + appId + " provided to filters component",
              )
            } else {
              setSelectedApp(appFromGivenId)
            }
          } else if (sessionPersistedFilters) {
            let appFromSessionPersistedFilters = result.data.find(
              (e: App) => e.id === sessionPersistedFilters.app.id,
            )
            if (appFromSessionPersistedFilters === undefined) {
              setSelectedApp(result.data[0])
            } else {
              setSelectedApp(appFromSessionPersistedFilters)
            }
          } else {
            setSelectedApp(result.data[0])
          }
          break
      }
    }

    useEffect(() => {
      getApps()
    }, [])

    function refresh(appIdToSelect?: string) {
      getApps(appIdToSelect)
    }

    useImperativeHandle(ref, () => ({
      refresh,
    }))

    const getRootSpanNames = async () => {
      setRootSpanNamesApiStatus(RootSpanNamesApiStatus.Loading)

      const result = await fetchRootSpanNamesFromServer(selectedApp!)

      switch (result.status) {
        case RootSpanNamesApiStatus.NoData:
          setRootSpanNamesApiStatus(RootSpanNamesApiStatus.NoData)
          break
        case RootSpanNamesApiStatus.Error:
          setRootSpanNamesApiStatus(RootSpanNamesApiStatus.Error)
          break
        case RootSpanNamesApiStatus.Success:
          setRootSpanNamesApiStatus(RootSpanNamesApiStatus.Success)

          if (
            JSON.stringify(rootSpanNames) !==
            JSON.stringify(result.data.results)
          ) {
            setRootSpanNames(result.data.results)
            setSelectedRootSpanName(result.data.results[0])
          }

          if (result.data.results !== null) {
            const parsedRootSpanNames = result.data.results
            setRootSpanNames(parsedRootSpanNames)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.rootSpanName
            ) {
              const selectedRootSpanName = parsedRootSpanNames.find(
                (name: string) => name === urlFilters.rootSpanName,
              )
              if (selectedRootSpanName === undefined) {
                setSelectedRootSpanName(parsedRootSpanNames[0])
              } else {
                setSelectedRootSpanName(selectedRootSpanName)
              }
            } else {
              setSelectedRootSpanName(parsedRootSpanNames[0])
            }
          }
          break
      }
    }

    const clearFiltersOnFilterApiFail = () => {
      console.log("Filters API failed, clearing filters")
      setSelectedVersions(defaultFilters.versions.selected)
      setSelectedSessionType(defaultFilters.sessionType)
      setSelectedOsVersions(defaultFilters.osVersions.selected)
      setSelectedCountries(defaultFilters.countries.selected)
      setSelectedNetworkProviders(defaultFilters.networkProviders.selected)
      setSelectedNetworkTypes(defaultFilters.networkTypes.selected)
      setSelectedNetworkGenerations(defaultFilters.networkGenerations.selected)
      setSelectedLocales(defaultFilters.locales.selected)
      setSelectedDeviceManufacturers(defaultFilters.deviceManufacturers.selected)
      setSelectedDeviceNames(defaultFilters.deviceNames.selected)
      setSelectedFreeText(defaultFilters.freeText)
      setSelectedSpanStatuses(defaultFilters.spanStatuses.selected)
      setSelectedRootSpanName(defaultFilters.rootSpanName)
      setSelectedBugReportStatuses(defaultFilters.bugReportStatuses.selected)
      setSelectedUdAttrMatchers(defaultFilters.udAttrMatchers)
    }

    const getFilters = async () => {
      setFiltersApiStatus(FiltersApiStatus.Loading)

      const result = await fetchFiltersFromServer(selectedApp!, filterSource)

      switch (result.status) {
        case FiltersApiStatus.NotOnboarded:
          setFiltersApiStatus(FiltersApiStatus.NotOnboarded)
          clearFiltersOnFilterApiFail()
          break
        case FiltersApiStatus.NoData:
          setFiltersApiStatus(FiltersApiStatus.NoData)
          clearFiltersOnFilterApiFail()
          break
        case FiltersApiStatus.Error:
          setFiltersApiStatus(FiltersApiStatus.Error)
          clearFiltersOnFilterApiFail()
          break
        case FiltersApiStatus.Success:
          setFiltersApiStatus(FiltersApiStatus.Success)

          if (result.data.versions !== null) {
            const parsedVersions = result.data.versions.map(
              (v: { name: string; code: string }) =>
                new AppVersion(v.name, v.code),
            )

            setVersions(parsedVersions)

            if (urlFilters.appId === selectedApp!.id && urlFilters.versions) {
              const selectedVersions = urlFilters.versions
                .filter((index) => index >= 0 && index < parsedVersions.length)
                .map((index) => parsedVersions[index])
              setSelectedVersions(selectedVersions)
            } else if (
              appVersionsInitialSelectionType ===
              AppVersionsInitialSelectionType.All
            ) {
              setSelectedVersions(parsedVersions)
            } else {
              setSelectedVersions(parsedVersions.slice(0, 1))
            }
          }

          if (result.data.os_versions !== null) {
            const parsedOsVersions = result.data.os_versions.map(
              (v: { name: string; version: string }) =>
                new OsVersion(v.name, v.version),
            )

            setOsVersions(parsedOsVersions)

            if (urlFilters.appId === selectedApp!.id && urlFilters.osVersions) {
              const selectedOsVersions = urlFilters.osVersions
                .filter(
                  (index) => index >= 0 && index < parsedOsVersions.length,
                )
                .map((index) => parsedOsVersions[index])
              setSelectedOsVersions(selectedOsVersions)
            } else {
              setSelectedOsVersions(parsedOsVersions)
            }
          }

          if (result.data.countries !== null) {
            const parsedCountries = result.data.countries
            setCountries(parsedCountries)

            if (urlFilters.appId === selectedApp!.id && urlFilters.countries) {
              const selectedCountries = urlFilters.countries
                .filter((index) => index >= 0 && index < parsedCountries.length)
                .map((index) => parsedCountries[index])
              setSelectedCountries(selectedCountries)
            } else {
              setSelectedCountries(parsedCountries)
            }
          }

          if (result.data.network_providers !== null) {
            const parsedNetworkProviders = result.data.network_providers
            setNetworkProviders(parsedNetworkProviders)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.networkProviders
            ) {
              const selectedNetworkProviders = urlFilters.networkProviders
                .filter(
                  (index) =>
                    index >= 0 && index < parsedNetworkProviders.length,
                )
                .map((index) => parsedNetworkProviders[index])
              setSelectedNetworkProviders(selectedNetworkProviders)
            } else {
              setSelectedNetworkProviders(parsedNetworkProviders)
            }
          }

          if (result.data.network_types !== null) {
            const parsedNetworkTypes = result.data.network_types
            setNetworkTypes(parsedNetworkTypes)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.networkTypes
            ) {
              const selectedNetworkTypes = urlFilters.networkTypes
                .filter(
                  (index) => index >= 0 && index < parsedNetworkTypes.length,
                )
                .map((index) => parsedNetworkTypes[index])
              setSelectedNetworkTypes(selectedNetworkTypes)
            } else {
              setSelectedNetworkTypes(parsedNetworkTypes)
            }
          }

          if (result.data.network_generations !== null) {
            const parsedNetworkGenerations = result.data.network_generations
            setNetworkGenerations(parsedNetworkGenerations)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.networkGenerations
            ) {
              const selectedNetworkGenerations = urlFilters.networkGenerations
                .filter(
                  (index) =>
                    index >= 0 && index < parsedNetworkGenerations.length,
                )
                .map((index) => parsedNetworkGenerations[index])
              setSelectedNetworkGenerations(selectedNetworkGenerations)
            } else {
              setSelectedNetworkGenerations(parsedNetworkGenerations)
            }
          }

          if (result.data.locales !== null) {
            const parsedLocales = result.data.locales
            setLocales(parsedLocales)

            if (urlFilters.appId === selectedApp!.id && urlFilters.locales) {
              const selectedLocales = urlFilters.locales
                .filter((index) => index >= 0 && index < parsedLocales.length)
                .map((index) => parsedLocales[index])
              setSelectedLocales(selectedLocales)
            } else {
              setSelectedLocales(parsedLocales)
            }
          }

          if (result.data.device_manufacturers !== null) {
            const parsedDeviceManufacturers = result.data.device_manufacturers
            setDeviceManufacturers(parsedDeviceManufacturers)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.deviceManufacturers
            ) {
              const selectedDeviceManufacturers = urlFilters.deviceManufacturers
                .filter(
                  (index) =>
                    index >= 0 && index < parsedDeviceManufacturers.length,
                )
                .map((index) => parsedDeviceManufacturers[index])
              setSelectedDeviceManufacturers(selectedDeviceManufacturers)
            } else {
              setSelectedDeviceManufacturers(parsedDeviceManufacturers)
            }
          }

          if (result.data.device_names !== null) {
            const parsedDeviceNames = result.data.device_names
            setDeviceNames(parsedDeviceNames)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.deviceNames
            ) {
              const selectedDeviceNames = urlFilters.deviceNames
                .filter(
                  (index) => index >= 0 && index < parsedDeviceNames.length,
                )
                .map((index) => parsedDeviceNames[index])
              setSelectedDeviceNames(selectedDeviceNames)
            } else {
              setSelectedDeviceNames(parsedDeviceNames)
            }
          }

          if (
            result.data.ud_attrs !== null &&
            result.data.ud_attrs.key_types !== null &&
            result.data.ud_attrs.operator_types !== null
          ) {
            const parsedUserDefAttrs = result.data.ud_attrs.key_types
            const parsedUserDefAttrOps = new Map<string, string[]>(
              Object.entries(result.data.ud_attrs.operator_types),
            )

            setUserDefAttrs(parsedUserDefAttrs)
            setUserDefAttrOps(parsedUserDefAttrOps)

            if (
              urlFilters.appId === selectedApp!.id &&
              urlFilters.udAttrMatchers
            ) {
              const selectedUdAttrMatchers = urlFilters.udAttrMatchers.filter(
                (m: UdAttrMatcher) => {
                  // Find the attribute definition for this matcher
                  const attr = parsedUserDefAttrs.find(
                    (attr: UserDefAttr) => attr.key === m.key,
                  )
                  if (!attr) return false
                  // Use the type from the attribute definition and check if the op is valid for this type
                  const ops = parsedUserDefAttrOps.get(attr.type)
                  const opExists = ops ? ops.includes(m.op) : false
                  // Accept if key exists, op exists for the type, and value is not undefined
                  return opExists && m.value !== undefined
                },
              )
              setSelectedUdAttrMatchers(selectedUdAttrMatchers)
            } else {
              setSelectedUdAttrMatchers([])
            }
          } else {
            setUserDefAttrs([])
            setUserDefAttrOps(new Map<string, string[]>())
            setSelectedUdAttrMatchers([])
          }

          if (urlFilters.appId === selectedApp!.id && urlFilters.spanStatuses) {
            const selectedSpanStatuses = urlFilters.spanStatuses
              .filter((s: string) =>
                Object.values(SpanStatus).includes(s as SpanStatus),
              )
              .map((s: string) => s as SpanStatus)
            setSelectedSpanStatuses(selectedSpanStatuses)
          } else {
            setSelectedSpanStatuses(
              filterSource === FilterSource.Spans
                ? [SpanStatus.Unset, SpanStatus.Ok, SpanStatus.Error]
                : [],
            )
          }

          if (
            urlFilters.appId === selectedApp!.id &&
            urlFilters.bugReportStatuses
          ) {
            const selectedBugReportStatuses = urlFilters.bugReportStatuses
              .filter((s: string) =>
                Object.values(BugReportStatus).includes(s as BugReportStatus),
              )
              .map((s: string) => s as BugReportStatus)
            setSelectedBugReportStatuses(selectedBugReportStatuses)
          } else {
            setSelectedBugReportStatuses([BugReportStatus.Open])
          }

          if (urlFilters.appId === selectedApp!.id && urlFilters.sessionType) {
            setSelectedSessionType(urlFilters.sessionType)
          } else {
            setSelectedSessionType(SessionType.All)
          }

          if (urlFilters.appId === selectedApp!.id && urlFilters.freeText) {
            setSelectedFreeText(urlFilters.freeText)
          } else {
            setSelectedFreeText("")
          }

          break
      }
    }

    useEffect(() => {
      if (!selectedApp) {
        return
      }

      getFilters()

      if (filterSource === FilterSource.Spans) {
        getRootSpanNames()
      }
    }, [selectedApp])

    useEffect(() => {
      if (!selectedApp) {
        return
      }

      let ready = false
      if (showNoData && showNotOnboarded) {
        ready =
          AppsApiStatus.Success &&
          ((filterSource === FilterSource.Spans &&
            rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
            filterSource !== FilterSource.Spans) &&
          filtersApiStatus === FiltersApiStatus.Success
      } else if (showNoData) {
        ready =
          AppsApiStatus.Success &&
          ((filterSource === FilterSource.Spans &&
            rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
            filterSource !== FilterSource.Spans) &&
          (filtersApiStatus === FiltersApiStatus.Success ||
            filtersApiStatus === FiltersApiStatus.NotOnboarded)
      } else if (showNotOnboarded) {
        ready =
          AppsApiStatus.Success &&
          ((filterSource === FilterSource.Spans &&
            rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
            filterSource !== FilterSource.Spans) &&
          (filtersApiStatus === FiltersApiStatus.Success ||
            filtersApiStatus === FiltersApiStatus.NoData)
      } else {
        ready =
          AppsApiStatus.Success &&
          ((filterSource === FilterSource.Spans &&
            rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
            filterSource !== FilterSource.Spans) &&
          (filtersApiStatus === FiltersApiStatus.Success ||
            filtersApiStatus === FiltersApiStatus.NoData ||
            filtersApiStatus === FiltersApiStatus.NotOnboarded)
      }

      const updatedUrlFilters: URLFilters = {
        appId: selectedApp!.id,
        rootSpanName: selectedRootSpanName,
        startDate: selectedStartDate,
        endDate: selectedEndDate,
        dateRange: Object.values(DateRange).includes(
          selectedDateRange as DateRange,
        )
          ? (selectedDateRange as DateRange)
          : undefined,
        versions: selectedVersions.map((v) =>
          versions.findIndex(
            (ver) => ver.name === v.name && ver.code === v.code,
          ),
        ),
        sessionType: selectedSessionType,
        spanStatuses: selectedSpanStatuses,
        bugReportStatuses: selectedBugReportStatuses,
        osVersions: selectedOsVersions.map((os) =>
          osVersions.findIndex(
            (o) => o.name === os.name && o.version === os.version,
          ),
        ),
        countries: selectedCountries.map((c) => countries.indexOf(c)),
        networkProviders: selectedNetworkProviders.map((np) =>
          networkProviders.indexOf(np),
        ),
        networkTypes: selectedNetworkTypes.map((nt) =>
          networkTypes.indexOf(nt),
        ),
        networkGenerations: selectedNetworkGenerations.map((ng) =>
          networkGenerations.indexOf(ng),
        ),
        locales: selectedLocales.map((l) => locales.indexOf(l)),
        deviceManufacturers: selectedDeviceManufacturers.map((dm) =>
          deviceManufacturers.indexOf(dm),
        ),
        deviceNames: selectedDeviceNames.map((dn) => deviceNames.indexOf(dn)),
        udAttrMatchers: selectedUdAttrMatchers,
        freeText: selectedFreeText,
      }

      const updatedSelectedFilters: Filters = {
        ready: ready,
        app: selectedApp,
        rootSpanName: selectedRootSpanName,
        startDate: selectedStartDate,
        endDate: selectedEndDate,
        versions: { selected: selectedVersions, all: versions.length === selectedVersions.length },
        sessionType: selectedSessionType,
        spanStatuses: { selected: selectedSpanStatuses, all: selectedSpanStatuses.length === spanStatuses.length },
        bugReportStatuses: { selected: selectedBugReportStatuses, all: selectedBugReportStatuses.length === bugReportStatuses.length },
        osVersions: { selected: selectedOsVersions, all: selectedOsVersions.length === osVersions.length },
        countries: { selected: selectedCountries, all: selectedCountries.length === countries.length },
        networkProviders: { selected: selectedNetworkProviders, all: selectedNetworkProviders.length === networkProviders.length },
        networkTypes: { selected: selectedNetworkTypes, all: selectedNetworkTypes.length === networkTypes.length },
        networkGenerations: { selected: selectedNetworkGenerations, all: selectedNetworkGenerations.length === networkGenerations.length },
        locales: { selected: selectedLocales, all: selectedLocales.length === locales.length },
        deviceManufacturers: { selected: selectedDeviceManufacturers, all: selectedDeviceManufacturers.length === deviceManufacturers.length },
        deviceNames: { selected: selectedDeviceNames, all: selectedDeviceNames.length === deviceNames.length },
        udAttrMatchers: selectedUdAttrMatchers,
        freeText: selectedFreeText,
        serialisedFilters: serializeUrlFilters(updatedUrlFilters),
      }

      // update global persisted filters
      const updatedSessionPersistedFilters: SessionPersistedFilters = {
        app: selectedApp!,
        dateRange: selectedDateRange,
        startDate: selectedStartDate,
        endDate: selectedEndDate,
      }
      sessionStorage.setItem(
        sessionPersistedFiltersKey,
        JSON.stringify(updatedSessionPersistedFilters),
      )

      // fire callback
      onFiltersChanged(updatedSelectedFilters)
    }, [
      filtersApiStatus,
      selectedStartDate,
      selectedEndDate,
      selectedVersions,
      selectedSessionType,
      selectedOsVersions,
      selectedCountries,
      selectedNetworkProviders,
      selectedNetworkTypes,
      selectedNetworkGenerations,
      selectedLocales,
      selectedDeviceManufacturers,
      selectedDeviceNames,
      selectedUdAttrMatchers,
      selectedFreeText,
      selectedRootSpanName,
      selectedSpanStatuses,
      selectedBugReportStatuses,
    ])

    return (
      <div>
        {appsApiStatus === AppsApiStatus.Loading && <LoadingSpinner />}

        {/* Error states for apps fetch */}
        {appsApiStatus === AppsApiStatus.Error && (
          <p className="font-body text-sm">
            Error fetching apps, please check if Team ID is valid or refresh
            page to try again
          </p>
        )}
        {appsApiStatus === AppsApiStatus.NoApps && (
          <p className="font-body text-sm">
            Looks like you don&apos;t have any apps yet. Get started by{" "}
            {pathName.includes("apps") ? (
              "creating your first app!"
            ) : (
              <Link
                className={underlineLinkStyle}
                href={`apps`}
              >
                creating your first app!
              </Link>
            )}
          </p>
        )}

        {/* Error states for app success but filters fetch loading or failure */}
        {appsApiStatus === AppsApiStatus.Success &&
          filtersApiStatus !== FiltersApiStatus.Success && (
            <div className="flex flex-col">
              {showAppSelector && (
                <div className="flex flex-wrap gap-8 items-center">
                  <DropdownSelect
                    title="App Name"
                    type={DropdownSelectType.SingleString}
                    items={apps.map((e) => e.name)}
                    initialSelected={selectedApp!.name}
                    onChangeSelected={(item) =>
                      setSelectedApp(apps.find((e) => e.name === item)!)
                    }
                  />
                  {filtersApiStatus === FiltersApiStatus.Loading && (
                    <LoadingSpinner />
                  )}
                </div>
              )}
              <div className="py-4" />
              {filtersApiStatus === FiltersApiStatus.Error && (
                <p className="font-body text-sm">
                  Error fetching filters, please refresh page or select a
                  different app to try again
                </p>
              )}
              {showNoData && filtersApiStatus === FiltersApiStatus.NoData && (
                <p className="font-body text-sm">
                  No{" "}
                  {filterSource === FilterSource.Crashes
                    ? "crashes"
                    : filterSource === FilterSource.Anrs
                      ? "ANRs"
                      : "data"}{" "}
                  received for this app yet
                </p>
              )}
              {showNotOnboarded &&
                filtersApiStatus === FiltersApiStatus.NotOnboarded && (
                  <p className="font-body text-sm">
                    Follow our{" "}
                    <Link
                      target="_blank"
                      className={underlineLinkStyle}
                      href="https://github.com/measure-sh/measure?tab=readme-ov-file#docs"
                    >
                      docs
                    </Link>{" "}
                    to finish setting up your app.
                  </p>
                )}
            </div>
          )}

        {/* Error states for app success and filter success but traces loading or failure */}
        {appsApiStatus === AppsApiStatus.Success &&
          filtersApiStatus === FiltersApiStatus.Success &&
          filterSource === FilterSource.Spans &&
          rootSpanNamesApiStatus !== RootSpanNamesApiStatus.Success && (
            <div className="flex flex-col">
              {showAppSelector && (
                <div className="flex flex-wrap gap-8 items-center">
                  <DropdownSelect
                    title="App Name"
                    type={DropdownSelectType.SingleString}
                    items={apps.map((e) => e.name)}
                    initialSelected={selectedApp!.name}
                    onChangeSelected={(item) =>
                      setSelectedApp(apps.find((e) => e.name === item)!)
                    }
                  />
                  {rootSpanNamesApiStatus ===
                    RootSpanNamesApiStatus.Loading && <LoadingSpinner />}
                </div>
              )}
              <div className="py-4" />
              {rootSpanNamesApiStatus === RootSpanNamesApiStatus.Error && (
                <p className="font-body text-sm">
                  Error fetching traces list, please refresh page or select a
                  different app to try again
                </p>
              )}
              {rootSpanNamesApiStatus === RootSpanNamesApiStatus.NoData && (
                <p className="font-body text-sm">
                  No traces received for this app yet
                </p>
              )}
            </div>
          )}

        {/* Success states for app, trace and filters fetch */}
        {appsApiStatus === AppsApiStatus.Success &&
          ((filterSource === FilterSource.Spans &&
            rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
            filterSource !== FilterSource.Spans) &&
          filtersApiStatus === FiltersApiStatus.Success && (
            <div>
              <div className="flex flex-wrap gap-8 items-center">
                {showAppSelector && (
                  <DropdownSelect
                    title="App Name"
                    type={DropdownSelectType.SingleString}
                    items={apps.map((e) => e.name)}
                    initialSelected={selectedApp!.name}
                    onChangeSelected={(item) =>
                      setSelectedApp(apps.find((e) => e.name === item)!)
                    }
                  />
                )}

                {filterSource === FilterSource.Spans && (
                  <DropdownSelect
                    title="Trace Name"
                    type={DropdownSelectType.SingleString}
                    items={rootSpanNames}
                    initialSelected={selectedRootSpanName}
                    onChangeSelected={(item) =>
                      setSelectedRootSpanName(item as string)
                    }
                  />
                )}

                <div className="flex flex-row items-center">
                  {showDates && (
                    <DropdownSelect
                      title="Date Range"
                      type={DropdownSelectType.SingleString}
                      items={Object.values(DateRange)}
                      initialSelected={selectedDateRange}
                      onChangeSelected={(item) => {
                        const range = item as string

                        // do nothing if same range is selected
                        if (range === selectedDateRange) {
                          return
                        }

                        if (range === DateRange.Custom) {
                          setSelectedDateRange(range)
                          return
                        }

                        let today = DateTime.now()
                        let newDate = mapDateRangeToDate(range)

                        setSelectedStartDate(newDate!.toISO())
                        setSelectedEndDate(today.toISO())
                        setSelectedDateRange(range)
                      }}
                    />
                  )}
                  {showDates && selectedDateRange === DateRange.Custom && (
                    <p className="font-display px-2">:</p>
                  )}
                  {showDates && selectedDateRange === DateRange.Custom && (
                    <Input
                      type="datetime-local"
                      defaultValue={formatIsoDateForDateTimeInputField(
                        selectedStartDate,
                      )}
                      max={formatIsoDateForDateTimeInputField(selectedEndDate)}
                      onChange={(e) => {
                        if (isValidTimestamp(e.target.value)) {
                          setSelectedStartDate(
                            DateTime.fromISO(e.target.value).toISO()!,
                          )
                        }
                      }}
                    />
                  )}
                  {showDates && selectedDateRange === DateRange.Custom && (
                    <p className="font-display px-2">to</p>
                  )}
                  {showDates && selectedDateRange === DateRange.Custom && (
                    <Input
                      type="datetime-local"
                      defaultValue={formatIsoDateForDateTimeInputField(
                        selectedEndDate,
                      )}
                      min={formatIsoDateForDateTimeInputField(
                        selectedStartDate,
                      )}
                      max={formatIsoDateForDateTimeInputField(
                        DateTime.now().toISO(),
                      )}
                      onChange={(e) => {
                        if (isValidTimestamp(e.target.value)) {
                          // If "To" date is greater than now, ignore the change and reset to current end date.
                          // We need to do this since setting "max" isn't enough in some browsers
                          if (
                            DateTime.fromISO(e.target.value) <= DateTime.now()
                          ) {
                            setSelectedEndDate(
                              DateTime.fromISO(e.target.value).toISO()!,
                            )
                          } else {
                            e.target.value =
                              formatIsoDateForDateTimeInputField(
                                selectedEndDate,
                              )
                          }
                        }
                      }}
                    />
                  )}
                </div>
                {showAppVersions && (
                  <DropdownSelect
                    title="App versions"
                    type={DropdownSelectType.MultiAppVersion}
                    items={versions}
                    initialSelected={selectedVersions}
                    onChangeSelected={(items) =>
                      setSelectedVersions(items as AppVersion[])
                    }
                  />
                )}
                {showSessionType && (
                  <DropdownSelect
                    title="Session Types"
                    type={DropdownSelectType.SingleString}
                    items={Object.values(SessionType)}
                    initialSelected={selectedSessionType}
                    onChangeSelected={(item) =>
                      setSelectedSessionType(
                        getSessionTypeFromString(item as string),
                      )
                    }
                  />
                )}
                {filterSource === FilterSource.Spans && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Span Status"
                    items={Object.values(SpanStatus)}
                    initialSelected={selectedSpanStatuses}
                    onChangeSelected={(items) =>
                      setSelectedSpanStatuses(items as SpanStatus[])
                    }
                  />
                )}
                {showBugReportStatus && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Bug Report Status"
                    items={Object.values(BugReportStatus)}
                    initialSelected={selectedBugReportStatuses}
                    onChangeSelected={(items) =>
                      setSelectedBugReportStatuses(items as BugReportStatus[])
                    }
                  />
                )}
                {showOsVersions && osVersions.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiOsVersion}
                    title="OS Versions"
                    items={osVersions}
                    initialSelected={selectedOsVersions}
                    onChangeSelected={(items) =>
                      setSelectedOsVersions(items as OsVersion[])
                    }
                  />
                )}
                {showCountries && countries.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Country"
                    items={countries}
                    initialSelected={selectedCountries}
                    onChangeSelected={(items) =>
                      setSelectedCountries(items as string[])
                    }
                  />
                )}
                {showNetworkProviders && networkProviders.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Network Provider"
                    items={networkProviders}
                    initialSelected={selectedNetworkProviders}
                    onChangeSelected={(items) =>
                      setSelectedNetworkProviders(items as string[])
                    }
                  />
                )}
                {showNetworkTypes && networkTypes.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Network type"
                    items={networkTypes}
                    initialSelected={selectedNetworkTypes}
                    onChangeSelected={(items) =>
                      setSelectedNetworkTypes(items as string[])
                    }
                  />
                )}
                {showNetworkGenerations && networkGenerations.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Network generation"
                    items={networkGenerations}
                    initialSelected={selectedNetworkGenerations}
                    onChangeSelected={(items) =>
                      setSelectedNetworkGenerations(items as string[])
                    }
                  />
                )}
                {showLocales && locales.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Locale"
                    items={locales}
                    initialSelected={selectedLocales}
                    onChangeSelected={(items) =>
                      setSelectedLocales(items as string[])
                    }
                  />
                )}
                {showDeviceManufacturers && deviceManufacturers.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Device Manufacturer"
                    items={deviceManufacturers}
                    initialSelected={selectedDeviceManufacturers}
                    onChangeSelected={(items) =>
                      setSelectedDeviceManufacturers(items as string[])
                    }
                  />
                )}
                {showDeviceNames && deviceNames.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Device Name"
                    items={deviceNames}
                    initialSelected={selectedDeviceNames}
                    onChangeSelected={(items) =>
                      setSelectedDeviceNames(items as string[])
                    }
                  />
                )}
                {showUdAttrs && userDefAttrs.length > 0 && (
                  <UserDefAttrSelector
                    attrs={userDefAttrs}
                    ops={userDefAttrOps}
                    initialSelected={selectedUdAttrMatchers}
                    onChangeSelected={(udAttrMatchers) =>
                      setSelectedUdAttrMatchers(udAttrMatchers)
                    }
                  />
                )}
                {showFreeText && (
                  <DebounceTextInput
                    id="free-text"
                    placeholder={
                      freeTextPlaceholder
                        ? freeTextPlaceholder
                        : defaultFreeTextPlaceholder
                    }
                    initialValue={selectedFreeText}
                    onChange={(input) => setSelectedFreeText(input)}
                  />
                )}
              </div>
              <div className="py-4" />
              <div className="flex flex-wrap gap-2 items-center">
                {filterSource === FilterSource.Spans && (
                  <FilterPill title={selectedRootSpanName} />
                )}
                {showDates && (
                  <FilterPill
                    title={`${formatDateToHumanReadableDateTime(selectedStartDate)} to ${formatDateToHumanReadableDateTime(selectedEndDate)}`}
                  />
                )}
                {showAppVersions && selectedVersions.length > 0 && (
                  <FilterPill
                    title={Array.from(selectedVersions)
                      .map((v) => v.displayName)
                      .join(", ")}
                  />
                )}
                {showSessionType && <FilterPill title={selectedSessionType} />}
                {filterSource === FilterSource.Spans &&
                  selectedSpanStatuses.length > 0 && (
                    <FilterPill
                      title={Array.from(selectedSpanStatuses).join(", ")}
                    />
                  )}
                {showBugReportStatus &&
                  selectedBugReportStatuses.length > 0 && (
                    <FilterPill
                      title={Array.from(selectedBugReportStatuses).join(", ")}
                    />
                  )}
                {showOsVersions && selectedOsVersions.length > 0 && (
                  <FilterPill
                    title={Array.from(selectedOsVersions)
                      .map((v) => v.displayName)
                      .join(", ")}
                  />
                )}
                {showCountries && selectedCountries.length > 0 && (
                  <FilterPill
                    title={Array.from(selectedCountries).join(", ")}
                  />
                )}
                {showNetworkProviders &&
                  selectedNetworkProviders.length > 0 && (
                    <FilterPill
                      title={Array.from(selectedNetworkProviders).join(", ")}
                    />
                  )}
                {showNetworkTypes && selectedNetworkTypes.length > 0 && (
                  <FilterPill
                    title={Array.from(selectedNetworkTypes).join(", ")}
                  />
                )}
                {showNetworkGenerations &&
                  selectedNetworkGenerations.length > 0 && (
                    <FilterPill
                      title={Array.from(selectedNetworkGenerations).join(", ")}
                    />
                  )}
                {showLocales && selectedLocales.length > 0 && (
                  <FilterPill title={Array.from(selectedLocales).join(", ")} />
                )}
                {showDeviceManufacturers &&
                  selectedDeviceManufacturers.length > 0 && (
                    <FilterPill
                      title={Array.from(selectedDeviceManufacturers).join(", ")}
                    />
                  )}
                {showDeviceNames && selectedDeviceNames.length > 0 && (
                  <FilterPill
                    title={Array.from(selectedDeviceNames).join(", ")}
                  />
                )}
                {showUdAttrs && selectedUdAttrMatchers.length > 0 && (
                  <FilterPill
                    title={selectedUdAttrMatchers
                      .map(
                        (matcher) =>
                          `${matcher.key} (${matcher.type}) ${matcher.op} ${matcher.value}`,
                      )
                      .join(", ")}
                  />
                )}
                {showFreeText && selectedFreeText !== "" && (
                  <FilterPill title={"Search Text: " + selectedFreeText} />
                )}
              </div>
            </div>
          )}
      </div>
    )
  },
)

Filters.displayName = "Filters"
export default Filters
