"use client"

import { useRouter } from "next/navigation";
import { formatDateToHumanReadableDateTime, formatIsoDateForDateTimeInputField, isValidTimestamp } from "../utils/time_utils";
import { useEffect, useState } from "react";
import { AppVersion, AppsApiStatus, FiltersApiStatus, FiltersApiType, OsVersion, SessionType, RootSpanNamesApiStatus, emptyApp, fetchAppsFromServer, fetchFiltersFromServer, fetchRootSpanNamesFromServer, SpanStatus, UserDefAttr, BugReportStatus } from "../api/api_calls";
import { DateTime } from "luxon";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import FilterPill from "./filter_pill";
import CreateApp from "./create_app";
import DebounceTextInput from "./debounce_text_input";
import LoadingSpinner from "./loading_spinner";
import UserDefAttrSelector, { UdAttrMatcher } from "./user_def_attr_selector";

export enum AppVersionsInitialSelectionType {
  Latest,
  All
}

interface FiltersProps {
  teamId: string,
  appId?: string,
  filtersApiType: FiltersApiType,
  appVersionsInitialSelectionType: AppVersionsInitialSelectionType,
  showCreateApp: boolean
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
  Last15Mins = 'Last 15 Minutes',
  Last30Mins = 'Last 30 Minutes',
  LastHour = 'Last hour',
  Last3Hours = 'Last 3 Hours',
  Last6Hours = 'Last 6 Hours',
  Last12Hours = 'Last 12 Hours',
  Last24Hours = 'Last 24 Hours',
  LastWeek = 'Last Week',
  Last15Days = 'Last 15 Days',
  LastMonth = 'Last Month',
  Last3Months = 'Last 3 Months',
  Last6Months = 'Last 6 Months',
  LastYear = 'Last Year',
  Custom = 'Custom Range'
}

export type Filters = {
  ready: boolean
  app: typeof emptyApp
  rootSpanName: string
  startDate: string
  endDate: string
  versions: AppVersion[]
  sessionType: SessionType
  spanStatuses: SpanStatus[]
  bugReportStatuses: BugReportStatus[],
  osVersions: OsVersion[]
  countries: string[]
  networkProviders: string[]
  networkTypes: string[]
  networkGenerations: string[]
  locales: string[]
  deviceManufacturers: string[]
  deviceNames: string[]
  udAttrMatchers: UdAttrMatcher[]
  freeText: string
}

type PersistedFilters = {
  appId: string
  dateRange: string
  startDate: string
  endDate: string
}

export const defaultFilters: Filters = {
  ready: false,
  app: emptyApp,
  rootSpanName: '',
  startDate: '',
  endDate: '',
  versions: [],
  sessionType: SessionType.All,
  spanStatuses: [],
  bugReportStatuses: [],
  osVersions: [],
  countries: [],
  networkProviders: [],
  networkTypes: [],
  networkGenerations: [],
  locales: [],
  deviceManufacturers: [],
  deviceNames: [],
  udAttrMatchers: [],
  freeText: ''
}

function getSessionTypeFromString(value: string): SessionType {
  const enumValues = Object.values(SessionType) as string[];
  const enumKeys = Object.keys(SessionType) as Array<keyof typeof SessionType>;

  const index = enumValues.indexOf(value);
  if (index !== -1) {
    return SessionType[enumKeys[index]];
  }

  throw ("Invalid string cannot be mapped to SessionType: " + value)
}

const Filters: React.FC<FiltersProps> = ({
  teamId,
  appId,
  filtersApiType,
  appVersionsInitialSelectionType,
  showCreateApp,
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
  onFiltersChanged }) => {

  const router = useRouter()

  const persistedFiltersStorageKey = 'measurePersistedFilters'
  const persistedFilters: PersistedFilters = sessionStorage.getItem(persistedFiltersStorageKey) === null ? null : JSON.parse(sessionStorage.getItem(persistedFiltersStorageKey)!)

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

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [rootSpanNamesApiStatus, setRootSpanNamesApiStatus] = useState(RootSpanNamesApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);

  const [rootSpanNames, setRootSpanNames] = useState([] as string[]);
  const [selectedRootSpanName, setSelectedRootSpanName] = useState("");

  const [selectedSpanStatuses, setSelectedSpanStatuses] = useState(filtersApiType === FiltersApiType.Span ? [SpanStatus.Unset, SpanStatus.Ok, SpanStatus.Error] : []);

  const [selectedBugReportStatuses, setSelectedBugReportStatuses] = useState([BugReportStatus.Open]);

  const [versions, setVersions] = useState([] as AppVersion[]);
  const [selectedVersions, setSelectedVersions] = useState([] as AppVersion[]);

  const [selectedSessionType, setSelectedSessionType] = useState(SessionType.All);

  const [osVersions, setOsVersions] = useState([] as OsVersion[]);
  const [selectedOsVersions, setSelectedOsVersions] = useState([] as OsVersion[]);

  const [countries, setCountries] = useState([] as string[]);
  const [selectedCountries, setSelectedCountries] = useState([] as string[]);

  const [networkProviders, setNetworkProviders] = useState([] as string[]);
  const [selectedNetworkProviders, setSelectedNetworkProviders] = useState([] as string[]);

  const [networkTypes, setNetworkTypes] = useState([] as string[]);
  const [selectedNetworkTypes, setSelectedNetworkTypes] = useState([] as string[]);

  const [networkGenerations, setNetworkGenerations] = useState([] as string[]);
  const [selectedNetworkGenerations, setSelectedNetworkGenerations] = useState([] as string[]);

  const [locales, setLocales] = useState([] as string[]);
  const [selectedLocales, setSelectedLocales] = useState([] as string[]);

  const [deviceManufacturers, setDeviceManufacturers] = useState([] as string[]);
  const [selectedDeviceManufacturers, setSelectedDeviceManufacturers] = useState([] as string[]);

  const [deviceNames, setDeviceNames] = useState([] as string[]);
  const [selectedDeviceNames, setSelectedDeviceNames] = useState([] as string[]);

  const [userDefAttrs, setUserDefAttrs] = useState([] as UserDefAttr[]);
  const [userDefAttrOps, setUserDefAttrOps] = useState<Map<string, string[]>>(new Map());
  const [selectedUdAttrMatchers, setSelectedUdAttrMatchers] = useState<UdAttrMatcher[]>([]);

  const [selectedFreeText, setSelectedFreeText] = useState('');

  const [selectedDateRange, setSelectedDateRange] = useState(persistedFilters === null ? DateRange.Last6Hours : persistedFilters.dateRange)

  const [selectedStartDate, setSelectedStartDate] = useState(persistedFilters === null ? DateTime.now().minus({ days: 7 }).toISO() : persistedFilters.startDate);
  const [selectedFormattedStartDate, setSelectedFormattedStartDate] = useState(formatDateToHumanReadableDateTime(selectedStartDate));

  const [selectedEndDate, setSelectedEndDate] = useState(persistedFilters === null ? DateTime.now().toISO() : persistedFilters.endDate);
  const [selectedFormattedEndDate, setSelectedFormattedEndDate] = useState(formatDateToHumanReadableDateTime(selectedEndDate));

  useEffect(() => {
    setSelectedFormattedStartDate(formatDateToHumanReadableDateTime(selectedStartDate))
    setSelectedFormattedEndDate(formatDateToHumanReadableDateTime(selectedEndDate))
  }, [selectedStartDate, selectedEndDate])

  useEffect(() => {
    if (selectedDateRange === DateRange.Custom) {
      return
    }

    let today = DateTime.now()
    let newDate = mapDateRangeToDate(selectedDateRange)

    setSelectedStartDate(newDate!.toISO())
    setSelectedEndDate(today.toISO())
  }, [selectedDateRange]);

  const getApps = async () => {

    setAppsApiStatus(AppsApiStatus.Loading)

    const result = await fetchAppsFromServer(teamId, router)

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
        // Prefer provided appId and then appId from
        // persisted filters if present. If all else fails,
        // set app to first one
        if (appId !== undefined) {
          let appFromGivenId = result.data.find((e: typeof emptyApp) => e.id === appId)
          if (appFromGivenId === undefined) {
            throw Error("Invalid app Id: " + appId + " provided to filters component")
          } else {
            setSelectedApp(appFromGivenId)
          }
        } else if (persistedFilters !== null) {
          let appFromPersistedFilters = result.data.find((e: typeof emptyApp) => e.id === persistedFilters.appId)
          setSelectedApp(appFromPersistedFilters !== undefined ? appFromPersistedFilters : result.data[0])
        } else {
          setSelectedApp(result.data[0])
        }
        break
    }
  }

  useEffect(() => {
    getApps()
  }, []);

  const clearFiltersOnFilterApiFail = () => {
    setSelectedVersions(defaultFilters.versions)
    setSelectedSessionType(defaultFilters.sessionType)
    setSelectedOsVersions(defaultFilters.osVersions)
    setSelectedCountries(defaultFilters.countries)
    setSelectedNetworkProviders(defaultFilters.networkProviders)
    setSelectedNetworkTypes(defaultFilters.networkTypes)
    setSelectedNetworkGenerations(defaultFilters.networkGenerations)
    setSelectedLocales(defaultFilters.locales)
    setSelectedDeviceManufacturers(defaultFilters.deviceManufacturers)
    setSelectedDeviceNames(defaultFilters.deviceNames)
    setSelectedFreeText(defaultFilters.freeText)
    setSelectedSpanStatuses(defaultFilters.spanStatuses)
    setSelectedBugReportStatuses(defaultFilters.bugReportStatuses)
  }

  const getRootSpanNames = async () => {
    setRootSpanNamesApiStatus(RootSpanNamesApiStatus.Loading)

    const result = await fetchRootSpanNamesFromServer(selectedApp, router)

    switch (result.status) {
      case RootSpanNamesApiStatus.NoData:
        setRootSpanNamesApiStatus(RootSpanNamesApiStatus.NoData)
        break
      case RootSpanNamesApiStatus.Error:
        setRootSpanNamesApiStatus(RootSpanNamesApiStatus.Error)
        break
      case RootSpanNamesApiStatus.Success:
        setRootSpanNamesApiStatus(RootSpanNamesApiStatus.Success)
        setRootSpanNames(result.data.results)
        setSelectedRootSpanName(result.data.results[0])
        break
    }
  }

  useEffect(() => {
    // Don't try to fetch trace names if selected app is not yet set or if FilterType is not span
    if (selectedApp.id === "" || filtersApiType !== FiltersApiType.Span) {
      return
    }

    getRootSpanNames()
  }, [selectedApp]);

  const getFilters = async () => {
    setFiltersApiStatus(FiltersApiStatus.Loading)

    const result = await fetchFiltersFromServer(selectedApp, filtersApiType, router)

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
          let versions = result.data.versions.map((v: { name: string; code: string; }) => new AppVersion(v.name, v.code))
          setVersions(versions)

          if (appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All) {
            setSelectedVersions(versions)
          } else {
            setSelectedVersions(versions.slice(0, 1))
          }
        }

        if (result.data.os_versions !== null) {
          let osVersions = result.data.os_versions.map((v: { name: string; version: string; }) => new OsVersion(v.name, v.version))
          setOsVersions(osVersions)
          setSelectedOsVersions(osVersions)
        }

        if (result.data.countries !== null) {
          setCountries(result.data.countries)
          setSelectedCountries(result.data.countries)
        }

        if (result.data.network_providers !== null) {
          setNetworkProviders(result.data.network_providers)
          setSelectedNetworkProviders(result.data.network_providers)
        }

        if (result.data.network_types !== null) {
          setNetworkTypes(result.data.network_types)
          setSelectedNetworkTypes(result.data.network_types)
        }

        if (result.data.network_generations !== null) {
          setNetworkGenerations(result.data.network_generations)
          setSelectedNetworkGenerations(result.data.network_generations)
        }

        if (result.data.locales !== null) {
          setLocales(result.data.locales)
          setSelectedLocales(result.data.locales)
        }

        if (result.data.device_manufacturers !== null) {
          setDeviceManufacturers(result.data.device_manufacturers)
          setSelectedDeviceManufacturers(result.data.device_manufacturers)
        }

        if (result.data.device_names !== null) {
          setDeviceNames(result.data.device_names)
          setSelectedDeviceNames(result.data.device_names)
        }

        if (result.data.ud_attrs !== null && result.data.ud_attrs.key_types !== null && result.data.ud_attrs.operator_types !== null) {
          setUserDefAttrs(result.data.ud_attrs.key_types)
          setUserDefAttrOps(new Map(Object.entries(result.data.ud_attrs.operator_types)))
        }

        break
    }
  }

  useEffect(() => {
    // Don't try to fetch filters if selected app is not yet set
    if (selectedApp.id === "") {
      return
    }

    getFilters()
  }, [selectedApp]);

  useEffect(() => {
    // Don't fire change listener if selected app is not yet set
    if (selectedApp.id === "") {
      return
    }

    let ready = false
    if (showNoData && showNotOnboarded) {
      ready = AppsApiStatus.Success && ((filtersApiType === FiltersApiType.Span && rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) || filtersApiType !== FiltersApiType.Span) && filtersApiStatus === FiltersApiStatus.Success
    } else if (showNoData) {
      ready = AppsApiStatus.Success && ((filtersApiType === FiltersApiType.Span && rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) || filtersApiType !== FiltersApiType.Span) && (filtersApiStatus === FiltersApiStatus.Success || filtersApiStatus === FiltersApiStatus.NotOnboarded)
    } else if (showNotOnboarded) {
      ready = AppsApiStatus.Success && ((filtersApiType === FiltersApiType.Span && rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) || filtersApiType !== FiltersApiType.Span) && (filtersApiStatus === FiltersApiStatus.Success || filtersApiStatus === FiltersApiStatus.NoData)
    } else {
      ready = AppsApiStatus.Success && ((filtersApiType === FiltersApiType.Span && rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) || filtersApiType !== FiltersApiType.Span) && (filtersApiStatus === FiltersApiStatus.Success || filtersApiStatus === FiltersApiStatus.NoData || filtersApiStatus === FiltersApiStatus.NotOnboarded)
    }

    const updatedPersistedFilters: PersistedFilters = {
      appId: selectedApp.id,
      dateRange: selectedDateRange,
      startDate: selectedStartDate,
      endDate: selectedEndDate
    }

    const updatedSelectedFilters: Filters = {
      ready: ready,
      app: selectedApp,
      rootSpanName: selectedRootSpanName,
      startDate: selectedStartDate,
      endDate: selectedEndDate,
      versions: selectedVersions,
      sessionType: selectedSessionType,
      spanStatuses: selectedSpanStatuses,
      bugReportStatuses: selectedBugReportStatuses,
      osVersions: selectedOsVersions,
      countries: selectedCountries,
      networkProviders: selectedNetworkProviders,
      networkTypes: selectedNetworkTypes,
      networkGenerations: selectedNetworkGenerations,
      locales: selectedLocales,
      deviceManufacturers: selectedDeviceManufacturers,
      deviceNames: selectedDeviceNames,
      udAttrMatchers: selectedUdAttrMatchers,
      freeText: selectedFreeText
    }

    sessionStorage.setItem(persistedFiltersStorageKey, JSON.stringify(updatedPersistedFilters))
    onFiltersChanged(updatedSelectedFilters)
  }, [filtersApiStatus, selectedStartDate, selectedEndDate, selectedVersions, selectedSessionType, selectedOsVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames, selectedUdAttrMatchers, selectedFreeText, selectedRootSpanName, selectedSpanStatuses, selectedBugReportStatuses])

  return (
    <div>
      {appsApiStatus === AppsApiStatus.Loading && <LoadingSpinner />}

      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps &&
        <div>
          <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>
          {showCreateApp && <div className="py-4" />}
          {showCreateApp && <CreateApp teamId={teamId} />}
        </div>}

      {/* Error states for app success but filters fetch loading or failure */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus !== FiltersApiStatus.Success &&
        <div className="flex flex-col">
          {showAppSelector &&
            <div className="flex flex-wrap gap-8 items-center">
              <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
              {filtersApiStatus === FiltersApiStatus.Loading && <LoadingSpinner />}
            </div>}
          <div className="py-4" />
          {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}
          {showNoData && filtersApiStatus === FiltersApiStatus.NoData && <p className="text-lg font-display">No {filtersApiType === FiltersApiType.Crash ? 'crashes' : filtersApiType === FiltersApiType.Anr ? 'ANRs' : 'data'} received for this app yet</p>}
          {showNotOnboarded && filtersApiStatus === FiltersApiStatus.NotOnboarded && <CreateApp teamId={teamId} existingAppName={selectedApp.name} existingApiKey={selectedApp.api_key.key} />}
        </div>
      }

      {/* Error states for app success and filter success but traces loading or failure */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && filtersApiType === FiltersApiType.Span && rootSpanNamesApiStatus !== RootSpanNamesApiStatus.Success &&
        <div className="flex flex-col">
          {showAppSelector &&
            <div className="flex flex-wrap gap-8 items-center">
              <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
              {rootSpanNamesApiStatus === RootSpanNamesApiStatus.Loading && <LoadingSpinner />}
            </div>}
          <div className="py-4" />
          {rootSpanNamesApiStatus === RootSpanNamesApiStatus.Error && <p className="text-lg font-display">Error fetching traces list, please refresh page or select a different app to try again</p>}
          {rootSpanNamesApiStatus === RootSpanNamesApiStatus.NoData && <p className="text-lg font-display">No traces received for this app yet</p>}
        </div>
      }

      {/* Success states for app, trace and filters fetch */}
      {appsApiStatus === AppsApiStatus.Success && ((filtersApiType === FiltersApiType.Span && rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) || filtersApiType !== FiltersApiType.Span) && filtersApiStatus === FiltersApiStatus.Success &&
        <div>
          <div className="flex flex-wrap gap-8 items-center">
            {showAppSelector && <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />}

            {filtersApiType === FiltersApiType.Span && <DropdownSelect title="Trace Name" type={DropdownSelectType.SingleString} items={rootSpanNames} initialSelected={selectedRootSpanName} onChangeSelected={(item) => setSelectedRootSpanName(item as string)} />}

            <div className="flex flex-row items-center">
              {showDates && <DropdownSelect title="Date Range" type={DropdownSelectType.SingleString} items={Object.values(DateRange)} initialSelected={selectedDateRange} onChangeSelected={(item) => setSelectedDateRange(item as string)} />}
              {showDates && selectedDateRange === DateRange.Custom && <p className="font-display px-2">:</p>}
              {showDates && selectedDateRange === DateRange.Custom && <input type="datetime-local" defaultValue={formatIsoDateForDateTimeInputField(selectedStartDate)} max={formatIsoDateForDateTimeInputField(selectedEndDate)} className="font-display border border-black rounded-md p-2" onChange={(e) => {
                if (isValidTimestamp(e.target.value)) {
                  setSelectedStartDate(DateTime.fromISO(e.target.value).toISO()!)
                }
              }} />}
              {showDates && selectedDateRange === DateRange.Custom && <p className="font-display px-2">to</p>}
              {showDates && selectedDateRange === DateRange.Custom && <input type="datetime-local" defaultValue={formatIsoDateForDateTimeInputField(selectedEndDate)} min={formatIsoDateForDateTimeInputField(selectedStartDate)} max={formatIsoDateForDateTimeInputField(DateTime.now().toISO())} className="font-display border border-black rounded-md p-2" onChange={(e) => {
                if (isValidTimestamp(e.target.value)) {
                  // If "To" date is greater than now, ignore the change and reset to current end date.
                  // We need to do this since setting "max" isn't enough in some browsers
                  if (DateTime.fromISO(e.target.value) <= DateTime.now()) {
                    setSelectedEndDate(DateTime.fromISO(e.target.value).toISO()!)
                  } else {
                    e.target.value = formatIsoDateForDateTimeInputField(selectedEndDate)
                  }
                }
              }} />}
            </div>
            {showAppVersions && <DropdownSelect title="App versions" type={DropdownSelectType.MultiAppVersion} items={versions} initialSelected={selectedVersions} onChangeSelected={(items) => setSelectedVersions(items as AppVersion[])} />}
            {showSessionType && <DropdownSelect title="Session Types" type={DropdownSelectType.SingleString} items={Object.values(SessionType)} initialSelected={selectedSessionType} onChangeSelected={(item) => setSelectedSessionType(getSessionTypeFromString(item as string))} />}
            {filtersApiType === FiltersApiType.Span && <DropdownSelect type={DropdownSelectType.MultiString} title="Span Status" items={Object.values(SpanStatus)} initialSelected={selectedSpanStatuses} onChangeSelected={(items) => setSelectedSpanStatuses(items as SpanStatus[])} />}
            {showBugReportStatus && <DropdownSelect type={DropdownSelectType.MultiString} title="Bug Report Status" items={Object.values(BugReportStatus)} initialSelected={selectedBugReportStatuses} onChangeSelected={(items) => setSelectedBugReportStatuses(items as BugReportStatus[])} />}
            {showOsVersions && osVersions.length > 0 && <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={selectedOsVersions} onChangeSelected={(items) => setSelectedOsVersions(items as OsVersion[])} />}
            {showCountries && countries.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={countries} initialSelected={selectedCountries} onChangeSelected={(items) => setSelectedCountries(items as string[])} />}
            {showNetworkProviders && networkProviders.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network Provider" items={networkProviders} initialSelected={selectedNetworkProviders} onChangeSelected={(items) => setSelectedNetworkProviders(items as string[])} />}
            {showNetworkTypes && networkTypes.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network type" items={networkTypes} initialSelected={selectedNetworkTypes} onChangeSelected={(items) => setSelectedNetworkTypes(items as string[])} />}
            {showNetworkGenerations && networkGenerations.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network generation" items={networkGenerations} initialSelected={selectedNetworkGenerations} onChangeSelected={(items) => setSelectedNetworkGenerations(items as string[])} />}
            {showLocales && locales.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Locale" items={locales} initialSelected={selectedLocales} onChangeSelected={(items) => setSelectedLocales(items as string[])} />}
            {showDeviceManufacturers && deviceManufacturers.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Manufacturer" items={deviceManufacturers} initialSelected={selectedDeviceManufacturers} onChangeSelected={(items) => setSelectedDeviceManufacturers(items as string[])} />}
            {showDeviceNames && deviceNames.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Name" items={deviceNames} initialSelected={selectedDeviceNames} onChangeSelected={(items) => setSelectedDeviceNames(items as string[])} />}
            {showUdAttrs && userDefAttrs.length > 0 && <UserDefAttrSelector attrs={userDefAttrs} ops={userDefAttrOps} onChangeSelected={(udAttrMatchers) => setSelectedUdAttrMatchers(udAttrMatchers)} />}
            {showFreeText && <DebounceTextInput id="free-text" placeholder={freeTextPlaceholder ? freeTextPlaceholder : defaultFreeTextPlaceholder} initialValue={selectedFreeText} onChange={(input) => setSelectedFreeText(input)} />}
          </div>
          <div className="py-4" />
          <div className="flex flex-wrap gap-2 items-center">
            {filtersApiType === FiltersApiType.Span && <FilterPill title={selectedRootSpanName} />}
            {showDates && <FilterPill title={`${selectedFormattedStartDate} to ${selectedFormattedEndDate}`} />}
            {showAppVersions && selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).map((v) => v.displayName).join(', ')} />}
            {showSessionType && <FilterPill title={selectedSessionType} />}
            {filtersApiType === FiltersApiType.Span && selectedSpanStatuses.length > 0 && <FilterPill title={Array.from(selectedSpanStatuses).join(', ')} />}
            {showBugReportStatus && selectedBugReportStatuses.length > 0 && <FilterPill title={Array.from(selectedBugReportStatuses).join(', ')} />}
            {showOsVersions && selectedOsVersions.length > 0 && <FilterPill title={Array.from(selectedOsVersions).map((v) => v.displayName).join(', ')} />}
            {showCountries && selectedCountries.length > 0 && <FilterPill title={Array.from(selectedCountries).join(', ')} />}
            {showNetworkProviders && selectedNetworkProviders.length > 0 && <FilterPill title={Array.from(selectedNetworkProviders).join(', ')} />}
            {showNetworkTypes && selectedNetworkTypes.length > 0 && <FilterPill title={Array.from(selectedNetworkTypes).join(', ')} />}
            {showNetworkGenerations && selectedNetworkGenerations.length > 0 && <FilterPill title={Array.from(selectedNetworkGenerations).join(', ')} />}
            {showLocales && selectedLocales.length > 0 && <FilterPill title={Array.from(selectedLocales).join(', ')} />}
            {showDeviceManufacturers && selectedDeviceManufacturers.length > 0 && <FilterPill title={Array.from(selectedDeviceManufacturers).join(', ')} />}
            {showDeviceNames && selectedDeviceNames.length > 0 && <FilterPill title={Array.from(selectedDeviceNames).join(', ')} />}
            {showUdAttrs && selectedUdAttrMatchers.length > 0 && <FilterPill title={selectedUdAttrMatchers.map(matcher => `${matcher.key} (${matcher.type}) ${matcher.op} ${matcher.value}`).join(', ')} />}
            {showFreeText && selectedFreeText !== '' && <FilterPill title={"Search Text: " + selectedFreeText} />}
          </div>
        </div>
      }
    </div>
  );
};

export default Filters;