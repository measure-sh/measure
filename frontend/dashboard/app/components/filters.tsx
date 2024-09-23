"use client"

import { useRouter } from "next/navigation";
import { formatDateToHumanReadableDateTime, formatIsoDateForDateTimeInputField, isValidTimestamp } from "../utils/time_utils";
import { useEffect, useState } from "react";
import { AppVersion, AppsApiStatus, FiltersApiStatus, FiltersApiType, OsVersion, SessionType, emptyApp, fetchAppsFromServer, fetchFiltersFromServer } from "../api/api_calls";
import { DateTime } from "luxon";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import FilterPill from "./filter_pill";
import CreateApp from "./create_app";
import DebounceTextInput from "./debounce_text_input";

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
  showDates: boolean
  showAppVersions: boolean
  showOsVersions: boolean
  showCountries: boolean
  showNetworkProviders: boolean
  showNetworkTypes: boolean
  showNetworkGenerations: boolean
  showLocales: boolean
  showDeviceManufacturers: boolean
  showDeviceNames: boolean
  showFreeText: boolean
  showSessionType: boolean
  onFiltersChanged: (filters: Filters) => void
}

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
  startDate: string
  endDate: string
  versions: AppVersion[]
  sessionType: SessionType
  osVersions: OsVersion[]
  countries: string[]
  networkProviders: string[]
  networkTypes: string[]
  networkGenerations: string[]
  locales: string[]
  deviceManufacturers: string[]
  deviceNames: string[]
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
  startDate: '',
  endDate: '',
  versions: [],
  sessionType: SessionType.All,
  osVersions: [],
  countries: [],
  networkProviders: [],
  networkTypes: [],
  networkGenerations: [],
  locales: [],
  deviceManufacturers: [],
  deviceNames: [],
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
  showAppVersions,
  showDates,
  showSessionType,
  showCountries,
  showOsVersions,
  showNetworkTypes,
  showNetworkProviders,
  showNetworkGenerations,
  showLocales,
  showDeviceManufacturers,
  showDeviceNames,
  showFreeText,
  onFiltersChanged }) => {

  const router = useRouter()

  const persistedFiltersStorageKey = 'measurePersistedFilters'
  const persistedFilters: PersistedFilters = sessionStorage.getItem(persistedFiltersStorageKey) === null ? null : JSON.parse(sessionStorage.getItem(persistedFiltersStorageKey)!)

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);

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

  const [selectedFreeText, setSelectedFreeText] = useState('');

  const [selectedDateRange, setSelectedDateRange] = useState(persistedFilters === null ? DateRange.LastWeek : persistedFilters.dateRange)

  const [selectedStartDate, setSelectedStartDate] = useState(persistedFilters === null ? DateTime.now().minus({ days: 7 }).toISO() : persistedFilters.startDate);
  const [selectedFormattedStartDate, setSelectedFormattedStartDate] = useState(formatDateToHumanReadableDateTime(selectedStartDate));

  const [selectedEndDate, setSelectedEndDate] = useState(persistedFilters === null ? DateTime.now().toISO() : persistedFilters.endDate);
  const [selectedFormattedEndDate, setSelectedFormattedEndDate] = useState(formatDateToHumanReadableDateTime(selectedEndDate));

  useEffect(() => {
    setSelectedFormattedStartDate(formatDateToHumanReadableDateTime(selectedStartDate));
    setSelectedFormattedEndDate(formatDateToHumanReadableDateTime(selectedEndDate));
  }, [selectedStartDate, selectedEndDate]);

  useEffect(() => {
    let today = DateTime.now()
    let newDate

    switch (selectedDateRange) {
      case DateRange.Last15Mins:
        newDate = today.minus({ minutes: 15 })
        break
      case DateRange.Last30Mins:
        newDate = today.minus({ minutes: 30 })
        break
      case DateRange.LastHour:
        newDate = today.minus({ hours: 1 })
        break
      case DateRange.Last3Hours:
        newDate = today.minus({ hours: 3 })
        break
      case DateRange.Last6Hours:
        newDate = today.minus({ hours: 6 })
        break
      case DateRange.Last12Hours:
        newDate = today.minus({ hours: 12 })
        break
      case DateRange.Last24Hours:
        newDate = today.minus({ hours: 24 })
        break
      case DateRange.LastWeek:
        newDate = today.minus({ days: 7 })
        break
      case DateRange.Last15Days:
        newDate = today.minus({ days: 15 })
        break
      case DateRange.LastMonth:
        newDate = today.minus({ months: 1 })
        break
      case DateRange.Last3Months:
        newDate = today.minus({ months: 3 })
        break
      case DateRange.Last6Months:
        newDate = today.minus({ months: 6 })
        break
      case DateRange.LastYear:
        newDate = today.minus({ years: 1 })
        break
      case DateRange.Custom:
        return
    }

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
        // If appId is provided, set selected app to given appId. If no app Id is provided but we have a saved appId from
        // saved filters and we can find the corresponding app in the results, set selected app to the one from saved filters.
        // If not, set to the first app id.
        if (appId !== undefined) {
          setSelectedApp(result.data.find((e: typeof emptyApp) => e.id === appId))
        } else if (persistedFilters !== null) {
          const appMatchingPersisted = result.data.find((e: typeof emptyApp) => e.id === persistedFilters.appId)
          if (appMatchingPersisted !== undefined) {
            setSelectedApp(appMatchingPersisted)
          } else {
            setSelectedApp(result.data[0])
          }
        } else {
          setSelectedApp(result.data[0])
        }
        break
    }
  }

  useEffect(() => {
    getApps()
  }, []);

  const getFilters = async () => {
    setFiltersApiStatus(FiltersApiStatus.Loading)

    const result = await fetchFiltersFromServer(selectedApp, filtersApiType, router)

    switch (result.status) {
      case FiltersApiStatus.NotOnboarded:
        setFiltersApiStatus(FiltersApiStatus.NotOnboarded)
        break
      case FiltersApiStatus.NoData:
        setFiltersApiStatus(FiltersApiStatus.NoData)
        break
      case FiltersApiStatus.Error:
        setFiltersApiStatus(FiltersApiStatus.Error)
        break
      case FiltersApiStatus.Success:
        setFiltersApiStatus(FiltersApiStatus.Success)

        let versions = result.data.versions.map((v: { name: string; code: string; }) => new AppVersion(v.name, v.code))
        setVersions(versions)

        if (appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All) {
          setSelectedVersions(versions)
        } else {
          setSelectedVersions(versions.slice(0, 1))
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
    // Don't persist filters or fire change listener if selected app is not yet set
    if (selectedApp.id === "") {
      return
    }

    const updatedPersistedFilters: PersistedFilters = {
      appId: selectedApp.id,
      dateRange: selectedDateRange,
      startDate: selectedStartDate,
      endDate: selectedEndDate
    }

    const updatedSelectedFilters: Filters = {
      ready: appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success,
      app: selectedApp,
      startDate: selectedStartDate,
      endDate: selectedEndDate,
      versions: selectedVersions,
      sessionType: selectedSessionType,
      osVersions: selectedOsVersions,
      countries: selectedCountries,
      networkProviders: selectedNetworkProviders,
      networkTypes: selectedNetworkTypes,
      networkGenerations: selectedNetworkGenerations,
      locales: selectedLocales,
      deviceManufacturers: selectedDeviceManufacturers,
      deviceNames: selectedDeviceNames,
      freeText: selectedFreeText
    }

    onFiltersChanged(updatedSelectedFilters)
    sessionStorage.setItem(persistedFiltersStorageKey, JSON.stringify(updatedPersistedFilters))
  }, [appsApiStatus, filtersApiStatus, selectedApp, selectedStartDate, selectedEndDate, selectedVersions, selectedSessionType, selectedOsVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames, selectedFreeText]);

  return (
    <div>
      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps &&
        <div>
          <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>
          {showCreateApp && <div className="py-4" />}
          {showCreateApp && <CreateApp teamId={teamId} />}
        </div>}

      {/* Error states for app success but filters fetch failure */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus !== FiltersApiStatus.Success &&
        <div className="flex flex-col">
          {/* only show app selector if appId is not provided */}
          {appId === undefined ?
            <div className="flex flex-wrap gap-8 items-center">
              <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
            </div>
            : null}
          <div className="py-8" />
          {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}
          {filtersApiStatus === FiltersApiStatus.NoData && <p className="text-lg font-display">No {filtersApiType === FiltersApiType.Crash ? 'crashes' : filtersApiType === FiltersApiType.Anr ? 'ANRs' : 'data'} received for this app yet</p>}
          {filtersApiStatus === FiltersApiStatus.NotOnboarded && <CreateApp teamId={teamId} existingAppName={selectedApp.name} existingApiKey={selectedApp.api_key.key} />}
        </div>
      }

      {/* Success states for app & filters fetch */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success &&
        <div>
          <div className="flex flex-wrap gap-8 items-center">
            {/* only show app selector if appId is not provided */}
            {appId === undefined ? <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} /> : null}
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
            {showOsVersions && osVersions.length > 0 && <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={osVersions} onChangeSelected={(items) => setSelectedOsVersions(items as OsVersion[])} />}
            {showCountries && countries.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={countries} initialSelected={countries} onChangeSelected={(items) => setSelectedCountries(items as string[])} />}
            {showNetworkProviders && networkProviders.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network Provider" items={networkProviders} initialSelected={networkProviders} onChangeSelected={(items) => setSelectedNetworkProviders(items as string[])} />}
            {showNetworkTypes && networkTypes.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network type" items={networkTypes} initialSelected={networkTypes} onChangeSelected={(items) => setSelectedNetworkTypes(items as string[])} />}
            {showNetworkGenerations && networkGenerations.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network generation" items={networkGenerations} initialSelected={networkGenerations} onChangeSelected={(items) => setSelectedNetworkGenerations(items as string[])} />}
            {showLocales && locales.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Locale" items={locales} initialSelected={locales} onChangeSelected={(items) => setSelectedLocales(items as string[])} />}
            {showDeviceManufacturers && deviceManufacturers.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Manufacturer" items={deviceManufacturers} initialSelected={deviceManufacturers} onChangeSelected={(items) => setSelectedDeviceManufacturers(items as string[])} />}
            {showDeviceNames && deviceNames.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Name" items={deviceNames} initialSelected={deviceNames} onChangeSelected={(items) => setSelectedDeviceNames(items as string[])} />}
            {showFreeText && <DebounceTextInput id="free-text" placeholder="Search User/Session ID, Logs, Event Type, Target View ID, File/Class name or Exception Traces..." onChange={(input) => setSelectedFreeText(input)} />}
          </div>
          <div className="py-4" />
          <div className="flex flex-wrap gap-2 items-center">
            {showDates && <FilterPill title={`${selectedFormattedStartDate} to ${selectedFormattedEndDate}`} />}
            {showAppVersions && selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).map((v) => v.displayName).join(', ')} />}
            {showSessionType && <FilterPill title={selectedSessionType} />}
            {showOsVersions && selectedOsVersions.length > 0 && <FilterPill title={Array.from(selectedOsVersions).map((v) => v.displayName).join(', ')} />}
            {showCountries && selectedCountries.length > 0 && <FilterPill title={Array.from(selectedCountries).join(', ')} />}
            {showNetworkProviders && selectedNetworkProviders.length > 0 && <FilterPill title={Array.from(selectedNetworkProviders).join(', ')} />}
            {showNetworkTypes && selectedNetworkTypes.length > 0 && <FilterPill title={Array.from(selectedNetworkTypes).join(', ')} />}
            {showNetworkGenerations && selectedNetworkGenerations.length > 0 && <FilterPill title={Array.from(selectedNetworkGenerations).join(', ')} />}
            {showLocales && selectedLocales.length > 0 && <FilterPill title={Array.from(selectedLocales).join(', ')} />}
            {showDeviceManufacturers && selectedDeviceManufacturers.length > 0 && <FilterPill title={Array.from(selectedDeviceManufacturers).join(', ')} />}
            {showDeviceNames && selectedDeviceNames.length > 0 && <FilterPill title={Array.from(selectedDeviceNames).join(', ')} />}
            {showFreeText && selectedFreeText !== '' && <FilterPill title={"Search Text: " + selectedFreeText} />}
          </div>
        </div>
      }
    </div>
  );
};

export default Filters;