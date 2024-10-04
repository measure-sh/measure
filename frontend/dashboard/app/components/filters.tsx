"use client"

import { useRouter, useSearchParams } from "next/navigation";
import { formatDateToHumanReadableDateTime, formatIsoDateForDateTimeInputField, isValidTimestamp } from "../utils/time_utils";
import { useEffect, useState } from "react";
import { AppVersion, AppsApiStatus, FiltersApiStatus, FiltersApiType, OsVersion, SessionType, emptyApp, fetchAppsFromServer, fetchFiltersFromServer } from "../api/api_calls";
import { DateTime, Interval } from "luxon";
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
  showFreeText: boolean
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
  showFreeText,
  onFiltersChanged }) => {

  const router = useRouter()
  const searchParams = useSearchParams()

  const persistedFiltersStorageKey = 'measurePersistedFilters'
  const persistedFilters: PersistedFilters = sessionStorage.getItem(persistedFiltersStorageKey) === null ? null : JSON.parse(sessionStorage.getItem(persistedFiltersStorageKey)!)

  const updateUrlWithFilters = (filters: Partial<Filters>) => {
    const params = new URLSearchParams(searchParams.toString());

    if (filters.app?.id) {
      params.set('appId', filters.app.id)
    } else {
      params.delete('appId')
    }
    if (filters.startDate && showDates) {
      params.set('startDate', filters.startDate)
    } else {
      params.delete('startDate')
    }
    if (filters.endDate && showDates) {
      params.set('endDate', filters.endDate)
    } else {
      params.delete('endDate')
    }
    if (filters.versions?.length && showAppVersions) {
      params.set('versions', filters.versions.map(v => v.displayName).join(','))
    } else {
      params.delete('versions')
    }
    if (filters.sessionType && showSessionType) {
      params.set('sessionType', filters.sessionType)
    } else {
      params.delete('sessionType')
    }
    if (filters.osVersions?.length && showOsVersions) {
      params.set('osVersions', filters.osVersions.map(v => v.displayName).join(','))
    } else {
      params.delete('osVersions')
    }
    if (filters.countries?.length && showCountries) {
      params.set('countries', filters.countries.join(','))
    } else {
      params.delete('countries')
    }
    if (filters.networkProviders?.length && showNetworkProviders) {
      params.set('networkProviders', filters.networkProviders.join(','))
    } else {
      params.delete('networkProviders')
    }
    if (filters.networkTypes?.length && showNetworkTypes) {
      params.set('networkTypes', filters.networkTypes.join(','))
    } else {
      params.delete('networkTypes')
    }
    if (filters.networkGenerations?.length && showNetworkGenerations) {
      params.set('networkGenerations', filters.networkGenerations.join(','))
    } else {
      params.delete('networkGenerations')
    }
    if (filters.locales?.length && showLocales) {
      params.set('locales', filters.locales.join(','))
    } else {
      params.delete('locales')
    }
    if (filters.deviceManufacturers?.length && showDeviceManufacturers) {
      params.set('deviceManufacturers', filters.deviceManufacturers.join(','))
    } else {
      params.delete('deviceManufacturers')
    }
    if (filters.deviceNames?.length && showDeviceNames) {
      params.set('deviceNames', filters.deviceNames.join(','))
    } else {
      params.delete('deviceNames')
    }
    if (filters.freeText && showFreeText) {
      params.set('freeText', filters.freeText)
    } else {
      params.delete('freeText')
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const getFiltersFromUrl = () => {
    const appIdFromUrl = searchParams.get('appId');
    const startDateFromUrl = searchParams.get('startDate');
    const endDateFromUrl = searchParams.get('endDate');
    const versionsFromUrl = searchParams.get('versions')?.split(',') || [];
    const sessionTypeFromUrl = searchParams.get('sessionType');
    const osVersionsFromUrl = searchParams.get('osVersions')?.split(',') || [];
    const countriesFromUrl = searchParams.get('countries')?.split(',') || [];
    const networkProvidersFromUrl = searchParams.get('networkProviders')?.split(',') || [];
    const networkTypesFromUrl = searchParams.get('networkTypes')?.split(',') || [];
    const networkGenerationsFromUrl = searchParams.get('networkGenerations')?.split(',') || [];
    const localesFromUrl = searchParams.get('locales')?.split(',') || [];
    const deviceManufacturersFromUrl = searchParams.get('deviceManufacturers')?.split(',') || [];
    const deviceNamesFromUrl = searchParams.get('deviceNames')?.split(',') || [];
    const freeTextFromUrl = searchParams.get('freeText') || '';

    return {
      appId: appIdFromUrl,
      startDate: startDateFromUrl,
      endDate: endDateFromUrl,
      versions: versionsFromUrl,
      sessionType: sessionTypeFromUrl as SessionType,
      osVersions: osVersionsFromUrl,
      countries: countriesFromUrl,
      networkProviders: networkProvidersFromUrl,
      networkTypes: networkTypesFromUrl,
      networkGenerations: networkGenerationsFromUrl,
      locales: localesFromUrl,
      deviceManufacturers: deviceManufacturersFromUrl,
      deviceNames: deviceNamesFromUrl,
      freeText: freeTextFromUrl
    };
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

  function mapDatesToDateRange(startDateIso: string, endDateIso: string): DateRange {
    const startDate = DateTime.fromISO(startDateIso);
    const endDate = DateTime.fromISO(endDateIso);

    if (!startDate.isValid || !endDate.isValid) {
      throw new Error("Invalid date string provided");
    }

    if (startDate > endDate) {
      throw new Error("Start date must be earlier than or equal to end date")
    }

    const interval = Interval.fromDateTimes(startDate, endDate);
    const duration = interval.toDuration(['years', 'months', 'days', 'hours', 'minutes']);

    const totalMinutes = duration.as('minutes');

    switch (true) {
      case totalMinutes === 15:
        return DateRange.Last15Mins;
      case totalMinutes === 30:
        return DateRange.Last30Mins;
      case totalMinutes === 60:
        return DateRange.LastHour;
      case totalMinutes === 3 * 60:
        return DateRange.Last3Hours;
      case totalMinutes === 6 * 60:
        return DateRange.Last6Hours;
      case totalMinutes === 12 * 60:
        return DateRange.Last12Hours;
      case totalMinutes === 24 * 60:
        return DateRange.Last24Hours;
      case totalMinutes === 7 * 24 * 60:
        return DateRange.LastWeek;
      case totalMinutes === 15 * 24 * 60:
        return DateRange.Last15Days;
      case duration.months === 1 && duration.days === 0:
        return DateRange.LastMonth;
      case duration.months === 3 && duration.days === 0:
        return DateRange.Last3Months;
      case duration.months === 6 && duration.days === 0:
        return DateRange.Last6Months;
      case duration.years === 1 && duration.months === 0 && duration.days === 0:
        return DateRange.LastYear;
      default:
        return DateRange.Custom;
    }
  }

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
        // Prefer provided appId if present, then appId from url if present,
        // then appId from persisted filters if present. If all else fails,
        // set app to first one
        let appIdFromUrl = getFiltersFromUrl().appId

        if (appId !== undefined) {
          let appFromGivenId = result.data.find((e: typeof emptyApp) => e.id === appId)
          if (appFromGivenId === undefined) {
            throw Error("Invalid app Id: " + appId + " provided to filters component")
          } else {
            setSelectedApp(appFromGivenId)
          }
        } else if (appIdFromUrl !== null) {
          let appFromUrl = result.data.find((e: typeof emptyApp) => e.id === appIdFromUrl)
          setSelectedApp(appFromUrl !== undefined ? appFromUrl : result.data[0])
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
  }

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

        let urlFilters = getFiltersFromUrl()

        if (showDates) {
          if (urlFilters.startDate
            && urlFilters.endDate
            && DateTime.fromISO(urlFilters.startDate).isValid
            && DateTime.fromISO(urlFilters.endDate).isValid
            && DateTime.fromISO(urlFilters.startDate) < DateTime.fromISO(urlFilters.endDate)) {
            setSelectedStartDate(urlFilters.startDate)
            setSelectedEndDate(urlFilters.endDate)
            setSelectedDateRange(mapDatesToDateRange(urlFilters.startDate, urlFilters.endDate))
          } else if (urlFilters.startDate
            && DateTime.fromISO(urlFilters.startDate).isValid
            && DateTime.fromISO(urlFilters.startDate) < DateTime.fromISO(selectedEndDate)) {
            setSelectedStartDate(urlFilters.startDate)
            setSelectedDateRange(mapDatesToDateRange(urlFilters.startDate, selectedEndDate))
          } else if (urlFilters.endDate
            && DateTime.fromISO(urlFilters.endDate).isValid
            && DateTime.fromISO(urlFilters.endDate) > DateTime.fromISO(selectedStartDate)) {
            setSelectedEndDate(urlFilters.endDate)
            setSelectedDateRange(mapDatesToDateRange(selectedStartDate, urlFilters.endDate))
          }
        }

        if (result.data.versions !== null && showAppVersions) {
          let versions = result.data.versions.map((v: { name: string; code: string; }) => new AppVersion(v.name, v.code))
          setVersions(versions)

          if (urlFilters.versions.length > 0) {
            const versionsFromUrl = versions.filter((v: AppVersion) => urlFilters.versions.includes(v.displayName))
            if (versionsFromUrl.length > 0) {
              setSelectedVersions(versionsFromUrl)
            } else if (appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All) {
              setSelectedVersions(versions)
            } else {
              setSelectedVersions(versions.slice(0, 1))
            }
          }
          else if (appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All) {
            setSelectedVersions(versions)
          } else {
            setSelectedVersions(versions.slice(0, 1))
          }
        }

        if (showSessionType) {
          if (urlFilters.sessionType) {
            setSelectedSessionType(urlFilters.sessionType)
          }
        }

        if (result.data.os_versions !== null && showOsVersions) {
          let osVersions = result.data.os_versions.map((v: { name: string; version: string; }) => new OsVersion(v.name, v.version))
          setOsVersions(osVersions)

          if (urlFilters.osVersions.length > 0) {
            const osVersionsFromUrl = osVersions.filter((o: OsVersion) => urlFilters.osVersions.includes(o.displayName))
            if (osVersionsFromUrl.length > 0) {
              setSelectedOsVersions(osVersionsFromUrl)
            } else {
              setSelectedOsVersions(osVersions)
            }
          } else {
            setSelectedOsVersions(osVersions)
          }
        }

        if (result.data.countries !== null && showCountries) {
          setCountries(result.data.countries)
          if (urlFilters.countries) {
            const countriesFromUrl = result.data.countries.filter((v: string) => urlFilters.countries.includes(v))
            if (countriesFromUrl.length > 0) {
              setSelectedCountries(countriesFromUrl)
            } else {
              setSelectedCountries(result.data.countries)
            }
          } else {
            setSelectedCountries(result.data.countries)
          }
        }

        if (result.data.network_providers !== null && showNetworkProviders) {
          setNetworkProviders(result.data.network_providers)
          if (urlFilters.networkProviders) {
            const networkProvidersFromUrl = result.data.network_providers.filter((v: string) => urlFilters.networkProviders.includes(v))
            if (networkProvidersFromUrl.length > 0) {
              setSelectedNetworkProviders(networkProvidersFromUrl)
            } else {
              setSelectedNetworkProviders(result.data.network_providers)
            }
          } else {
            setSelectedNetworkProviders(result.data.network_providers)
          }
        }

        if (result.data.network_types !== null && showNetworkTypes) {
          setNetworkTypes(result.data.network_types)
          if (urlFilters.networkTypes) {
            const networkTypesFromUrl = result.data.network_types.filter((v: string) => urlFilters.networkTypes.includes(v))
            if (networkTypesFromUrl.length > 0) {
              setSelectedNetworkTypes(networkTypesFromUrl)
            } else {
              setSelectedNetworkTypes(result.data.network_types)
            }
          } else {
            setSelectedNetworkTypes(result.data.network_types)
          }
        }

        if (result.data.network_generations !== null && showNetworkGenerations) {
          setNetworkGenerations(result.data.network_generations)
          if (urlFilters.networkGenerations) {
            const networkGenerationsFromUrl = result.data.network_generations.filter((v: string) => urlFilters.networkGenerations.includes(v))
            if (networkGenerationsFromUrl.length > 0) {
              setSelectedNetworkGenerations(networkGenerationsFromUrl)
            } else {
              setSelectedNetworkGenerations(result.data.network_generations)
            }
          } else {
            setSelectedNetworkGenerations(result.data.network_generations)
          }
        }

        if (result.data.locales !== null && showLocales) {
          setLocales(result.data.locales)
          if (urlFilters.locales) {
            const localesFromUrl = result.data.locales.filter((v: string) => urlFilters.locales.includes(v))
            if (localesFromUrl.length > 0) {
              setSelectedLocales(localesFromUrl)
            } else {
              setSelectedLocales(result.data.locales)
            }
          } else {
            setSelectedLocales(result.data.locales)
          }
        }

        if (result.data.device_manufacturers !== null && showDeviceManufacturers) {
          setDeviceManufacturers(result.data.device_manufacturers)
          if (urlFilters.deviceManufacturers) {
            const deviceManufacturersFromUrl = result.data.device_manufacturers.filter((v: string) => urlFilters.deviceManufacturers.includes(v))
            if (deviceManufacturersFromUrl.length > 0) {
              setSelectedDeviceManufacturers(deviceManufacturersFromUrl)
            } else {
              setSelectedDeviceManufacturers(result.data.device_manufacturers)
            }
          } else {
            setSelectedDeviceManufacturers(result.data.device_manufacturers)
          }
        }

        if (result.data.device_names !== null && showDeviceNames) {
          setDeviceNames(result.data.device_names)
          if (urlFilters.deviceNames) {
            const deviceNamesFromUrl = result.data.device_names.filter((v: string) => urlFilters.deviceNames.includes(v))
            if (deviceNamesFromUrl.length > 0) {
              setSelectedDeviceNames(deviceNamesFromUrl)
            } else {
              setSelectedDeviceNames(result.data.device_names)
            }
          } else {
            setSelectedDeviceNames(result.data.device_names)
          }
        }

        if (showFreeText) {
          if (urlFilters.freeText) {
            setSelectedFreeText(urlFilters.freeText)
          }
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
    // Don't update url filters or fire change listener if selected app is not yet set
    if (selectedApp.id === "") {
      return
    }

    let ready = false
    if (showNoData && showNotOnboarded) {
      ready = AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success
    } else if (showNoData) {
      ready = AppsApiStatus.Success && (filtersApiStatus === FiltersApiStatus.Success || filtersApiStatus === FiltersApiStatus.NotOnboarded)
    } else if (showNotOnboarded) {
      ready = AppsApiStatus.Success && (filtersApiStatus === FiltersApiStatus.Success || filtersApiStatus === FiltersApiStatus.NoData)
    } else {
      ready = AppsApiStatus.Success && (filtersApiStatus === FiltersApiStatus.Success || filtersApiStatus === FiltersApiStatus.NoData || filtersApiStatus === FiltersApiStatus.NotOnboarded)
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

    sessionStorage.setItem(persistedFiltersStorageKey, JSON.stringify(updatedPersistedFilters))
    onFiltersChanged(updatedSelectedFilters)
    updateUrlWithFilters(updatedSelectedFilters)
  }, [appsApiStatus, filtersApiStatus, selectedApp, selectedStartDate, selectedEndDate, selectedVersions, selectedSessionType, selectedOsVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames, selectedFreeText])

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
          {showAppSelector &&
            <div className="flex flex-wrap gap-8 items-center">
              <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
            </div>}
          <div className="py-4" />
          {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}
          {showNoData && filtersApiStatus === FiltersApiStatus.NoData && <p className="text-lg font-display">No {filtersApiType === FiltersApiType.Crash ? 'crashes' : filtersApiType === FiltersApiType.Anr ? 'ANRs' : 'data'} received for this app yet</p>}
          {showNotOnboarded && filtersApiStatus === FiltersApiStatus.NotOnboarded && <CreateApp teamId={teamId} existingAppName={selectedApp.name} existingApiKey={selectedApp.api_key.key} />}
        </div>
      }

      {/* Success states for app & filters fetch */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success &&
        <div>
          <div className="flex flex-wrap gap-8 items-center">
            {/* only show app selector if appId is not provided */}
            {showAppSelector && <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={selectedApp.name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />}
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
            {showOsVersions && osVersions.length > 0 && <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={selectedOsVersions} onChangeSelected={(items) => setSelectedOsVersions(items as OsVersion[])} />}
            {showCountries && countries.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={countries} initialSelected={selectedCountries} onChangeSelected={(items) => setSelectedCountries(items as string[])} />}
            {showNetworkProviders && networkProviders.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network Provider" items={networkProviders} initialSelected={selectedNetworkProviders} onChangeSelected={(items) => setSelectedNetworkProviders(items as string[])} />}
            {showNetworkTypes && networkTypes.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network type" items={networkTypes} initialSelected={selectedNetworkTypes} onChangeSelected={(items) => setSelectedNetworkTypes(items as string[])} />}
            {showNetworkGenerations && networkGenerations.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network generation" items={networkGenerations} initialSelected={selectedNetworkGenerations} onChangeSelected={(items) => setSelectedNetworkGenerations(items as string[])} />}
            {showLocales && locales.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Locale" items={locales} initialSelected={selectedLocales} onChangeSelected={(items) => setSelectedLocales(items as string[])} />}
            {showDeviceManufacturers && deviceManufacturers.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Manufacturer" items={deviceManufacturers} initialSelected={selectedDeviceManufacturers} onChangeSelected={(items) => setSelectedDeviceManufacturers(items as string[])} />}
            {showDeviceNames && deviceNames.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Name" items={deviceNames} initialSelected={selectedDeviceNames} onChangeSelected={(items) => setSelectedDeviceNames(items as string[])} />}
            {showFreeText && <DebounceTextInput id="free-text" placeholder="Search User/Session ID, Logs, Event Type, Target View ID, File/Class name or Exception Traces..." initialValue={selectedFreeText} onChange={(input) => setSelectedFreeText(input)} />}
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