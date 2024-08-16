"use client"

import { useRouter } from "next/navigation";
import { formatDateToHumanReadable, isValidTimestamp } from "../utils/time_utils";
import { useEffect, useState } from "react";
import { AppVersion, AppsApiStatus, FiltersApiStatus, FiltersApiType, emptyApp, fetchAppsFromServer, fetchFiltersFromServer } from "../api/api_calls";
import { DateTime } from "luxon";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import FilterPill from "./filter_pill";
import CreateApp from "./create_app";

export enum AppVersionsInitialSelectionType {
  Latest,
  All
}

interface FiltersProps {
  teamId: string,
  appId?: string,
  filtersApiType: FiltersApiType,
  appVersionsInitialSelectionType: AppVersionsInitialSelectionType,
  showCountries: boolean
  showNetworkProviders: boolean
  showNetworkTypes: boolean
  showNetworkGenerations: boolean
  showLocales: boolean
  showDeviceManufacturers: boolean
  showDeviceNames: boolean
  onFiltersChanged: (selectedFilters: SelectedFilters) => void
}

export type SelectedFilters = {
  ready: boolean
  selectedApp: typeof emptyApp
  selectedStartDate: string
  selectedEndDate: string
  selectedVersions: AppVersion[]
  selectedCountries: string[]
  selectedNetworkProviders: string[]
  selectedNetworkTypes: string[]
  selectedNetworkGenerations: string[]
  selectedLocales: string[]
  selectedDeviceManufacturers: string[]
  selectedDeviceNames: string[]
}

type PersistedFilters = {
  selectedAppId: string
  selectedDateRange: string
  selectedStartDate: string
  selectedEndDate: string
}

export const defaultSelectedFilters: SelectedFilters = {
  ready: false,
  selectedApp: emptyApp,
  selectedStartDate: '',
  selectedEndDate: '',
  selectedVersions: [],
  selectedCountries: [],
  selectedNetworkProviders: [],
  selectedNetworkTypes: [],
  selectedNetworkGenerations: [],
  selectedLocales: [],
  selectedDeviceManufacturers: [],
  selectedDeviceNames: []
}

enum DateRange {
  Last24Hours = 'Last 24 Hours',
  LastWeek = 'Last Week',
  Last15Days = 'Last 15 Days',
  LastMonth = 'Last Month',
  Last3Months = 'Last 3 Months',
  LastYear = 'Last Year',
  Custom = 'Custom Range'
}

const Filters: React.FC<FiltersProps> = ({
  teamId,
  appId,
  filtersApiType,
  appVersionsInitialSelectionType,
  showCountries,
  showNetworkTypes,
  showNetworkProviders,
  showNetworkGenerations,
  showLocales,
  showDeviceManufacturers,
  showDeviceNames,
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

  const [dateRange, setDateRange] = useState(persistedFilters === null ? DateRange.LastWeek : persistedFilters.selectedDateRange)

  const [startDate, setStartDate] = useState(persistedFilters === null ? DateTime.now().minus({ days: 7 }).toFormat('yyyy-MM-dd') : persistedFilters.selectedStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(formatDateToHumanReadable(startDate));

  const [endDate, setEndDate] = useState(persistedFilters === null ? DateTime.now().toFormat('yyyy-MM-dd') : persistedFilters.selectedEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(formatDateToHumanReadable(endDate));

  useEffect(() => {
    setFormattedStartDate(formatDateToHumanReadable(startDate));
    setFormattedEndDate(formatDateToHumanReadable(endDate));
  }, [startDate, endDate]);

  useEffect(() => {
    let today = DateTime.now()
    let daysAgoDate

    switch (dateRange) {
      case DateRange.Last24Hours:
        daysAgoDate = today.minus({ days: 1 })
        break
      case DateRange.LastWeek:
        daysAgoDate = today.minus({ days: 7 })
        break
      case DateRange.Last15Days:
        daysAgoDate = today.minus({ days: 15 })
        break
      case DateRange.LastMonth:
        daysAgoDate = today.minus({ months: 1 })
        break
      case DateRange.Last3Months:
        daysAgoDate = today.minus({ months: 3 })
        break
      case DateRange.LastYear:
        daysAgoDate = today.minus({ years: 1 })
        break
      case DateRange.Custom:
        return
    }

    setStartDate(daysAgoDate!.toFormat('yyyy-MM-dd'))
    setEndDate(today.toFormat('yyyy-MM-dd'))
  }, [dateRange]);

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
          const appMatchingPersisted = result.data.find((e: typeof emptyApp) => e.id === persistedFilters.selectedAppId)
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
      selectedAppId: selectedApp.id,
      selectedDateRange: dateRange,
      selectedStartDate: startDate,
      selectedEndDate: endDate
    }

    const updatedSelectedFilters: SelectedFilters = {
      ready: appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success,
      selectedApp: selectedApp,
      selectedStartDate: startDate,
      selectedEndDate: endDate,
      selectedVersions: selectedVersions,
      selectedCountries: selectedCountries,
      selectedNetworkProviders: selectedNetworkProviders,
      selectedNetworkTypes: selectedNetworkTypes,
      selectedNetworkGenerations: selectedNetworkGenerations,
      selectedLocales: selectedLocales,
      selectedDeviceManufacturers: selectedDeviceManufacturers,
      selectedDeviceNames: selectedDeviceNames
    }

    onFiltersChanged(updatedSelectedFilters)
    sessionStorage.setItem(persistedFiltersStorageKey, JSON.stringify(updatedPersistedFilters))
  }, [appsApiStatus, filtersApiStatus, selectedApp, startDate, endDate, selectedVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames]);

  return (
    <div>
      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps &&
        <div>
          <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>
          <div className="py-4" />
          <CreateApp teamId={teamId} />
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
              <DropdownSelect title="Date Range" type={DropdownSelectType.SingleString} items={Object.values(DateRange)} initialSelected={dateRange} onChangeSelected={(item) => setDateRange(item as string)} />
              {dateRange === DateRange.Custom && <p className="font-display px-2">:</p>}
              {dateRange === DateRange.Custom && <input type="date" defaultValue={startDate} max={endDate} className="font-display border border-black rounded-md p-2" onChange={(e) => {
                if (isValidTimestamp(e.target.value)) {
                  setStartDate(e.target.value)
                }
              }} />}
              {dateRange === DateRange.Custom && <p className="font-display px-2">to</p>}
              {dateRange === DateRange.Custom && <input type="date" defaultValue={endDate} min={startDate} max={DateTime.now().toFormat('yyyy-MM-dd')} className="font-display border border-black rounded-md p-2" onChange={(e) => {
                if (isValidTimestamp(e.target.value)) {
                  setEndDate(e.target.value)
                }
              }} />}
            </div>
            <DropdownSelect title="App versions" type={DropdownSelectType.MultiAppVersion} items={versions} initialSelected={selectedVersions} onChangeSelected={(items) => setSelectedVersions(items as AppVersion[])} />
            {showCountries && countries.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={countries} initialSelected={countries} onChangeSelected={(items) => setSelectedCountries(items as string[])} />}
            {showNetworkProviders && networkProviders.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network Provider" items={networkProviders} initialSelected={networkProviders} onChangeSelected={(items) => setSelectedNetworkProviders(items as string[])} />}
            {showNetworkTypes && networkTypes.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network type" items={networkTypes} initialSelected={networkTypes} onChangeSelected={(items) => setSelectedNetworkTypes(items as string[])} />}
            {showNetworkGenerations && networkGenerations.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network generation" items={networkGenerations} initialSelected={networkGenerations} onChangeSelected={(items) => setSelectedNetworkGenerations(items as string[])} />}
            {showLocales && locales.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Locale" items={locales} initialSelected={locales} onChangeSelected={(items) => setSelectedLocales(items as string[])} />}
            {showDeviceManufacturers && deviceManufacturers.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Manufacturer" items={deviceManufacturers} initialSelected={deviceManufacturers} onChangeSelected={(items) => setSelectedDeviceManufacturers(items as string[])} />}
            {showDeviceNames && deviceNames.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Name" items={deviceNames} initialSelected={deviceNames} onChangeSelected={(items) => setSelectedDeviceNames(items as string[])} />}
          </div>
          <div className="py-4" />
          <div className="flex flex-wrap gap-2 items-center">
            <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
            {selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).map((v) => v.displayName).join(', ')} />}
            {showCountries && selectedCountries.length > 0 && <FilterPill title={Array.from(selectedCountries).join(', ')} />}
            {showNetworkProviders && selectedNetworkProviders.length > 0 && <FilterPill title={Array.from(selectedNetworkProviders).join(', ')} />}
            {showNetworkTypes && selectedNetworkTypes.length > 0 && <FilterPill title={Array.from(selectedNetworkTypes).join(', ')} />}
            {showNetworkGenerations && selectedNetworkGenerations.length > 0 && <FilterPill title={Array.from(selectedNetworkGenerations).join(', ')} />}
            {showLocales && selectedLocales.length > 0 && <FilterPill title={Array.from(selectedLocales).join(', ')} />}
            {showDeviceManufacturers && selectedDeviceManufacturers.length > 0 && <FilterPill title={Array.from(selectedDeviceManufacturers).join(', ')} />}
            {showDeviceNames && selectedDeviceNames.length > 0 && <FilterPill title={Array.from(selectedDeviceNames).join(', ')} />}
          </div>
        </div>
      }
    </div>
  );
};

export default Filters;