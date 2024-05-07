"use client"

import React, { useState, useEffect } from 'react';
import Accordion from "@/app/components/accordion";
import ExceptionCountChart from "@/app/components/exception_count_chart";
import FilterPill from "@/app/components/filter_pill";
import UserFlowCrashOrAnrGroupDetails from "@/app/components/user_flow_crash_details";
import Link from "next/link";
import { AppsApiStatus, CrashOrAnrGroupDetailsApiStatus, CrashOrAnrType, FiltersApiStatus, emptyApp, emptyCrashGroupDetailsResponse, emptyAnrGroupDetailsResponse, fetchAppsFromServer, fetchCrashOrAnrGroupDetailsFromServer, fetchFiltersFromServer, AppVersion } from '@/app/api/api_calls';
import { useRouter, useSearchParams } from 'next/navigation';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import { updateDateQueryParams } from '../utils/router_utils';
import { formatDateToHumanReadable, formatTimeToHumanReadable } from '../utils/time_utils';
import DropdownSelect, { DropdownSelectType } from './dropdown_select';
import { DateTime } from 'luxon';

interface CrashOrAnrGroupDetailsProps {
  crashOrAnrType: CrashOrAnrType,
  teamId: string,
  appId: string,
  crashOrAnrGroupId: string,
  crashOrAnrGroupName: string,
}

export const CrashOrAnrGroupDetails: React.FC<CrashOrAnrGroupDetailsProps> = ({ crashOrAnrType, teamId, appId, crashOrAnrGroupId, crashOrAnrGroupName }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);
  const [crashOrAnrGroupDetailsApiStatus, setCrashOrAnrGroupDetailsApiStatus] = useState(CrashOrAnrGroupDetailsApiStatus.Loading);

  const [versions, setVersions] = useState([] as AppVersion[]);
  const [selectedVersions, setSelectedVersions] = useState([] as AppVersion[]);

  const [selectedApp, setSelectedApp] = useState(emptyApp);

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

  const [crashOrAnrGroupDetails, setCrashOrAnrGroupDetails] = useState(crashOrAnrType === CrashOrAnrType.Crash ? emptyCrashGroupDetailsResponse : emptyAnrGroupDetailsResponse)
  const [paginationIndex, setPaginationIndex] = useState(0)
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

  const today = DateTime.now();
  var initialEndDate = today.toFormat('yyyy-MM-dd');
  const [endDate, setEndDate] = useState(searchParams.has("end_date") ? searchParams.get("end_date")! : initialEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(formatDateToHumanReadable(endDate));

  const sevenDaysAgo = today.minus({ days: 7 });
  var initialStartDate = sevenDaysAgo.toFormat('yyyy-MM-dd');
  const [startDate, setStartDate] = useState(searchParams.has("start_date") ? searchParams.get("start_date")! : initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(formatDateToHumanReadable(startDate));

  useEffect(() => {
    setFormattedStartDate(formatDateToHumanReadable(startDate));
    setFormattedEndDate(formatDateToHumanReadable(endDate));

    updateDateQueryParams(router, searchParams, startDate, endDate)
  }, [startDate, endDate]);

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
        setSelectedApp(result.data.find((e: typeof emptyApp) => e.id === appId))
        break
    }
  }

  useEffect(() => {
    getApps()
  }, []);

  const getFilters = async () => {
    // Don't try to fetch filters if app id is not yet set
    if (selectedApp.id === "") {
      return
    }

    setFiltersApiStatus(FiltersApiStatus.Loading)

    const result = await fetchFiltersFromServer(selectedApp, router)

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
        setSelectedVersions(versions)

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
    getFilters()
  }, [selectedApp]);

  const getCrashOrAnrGroupDetails = async () => {
    // Don't try to fetch crashes or ANR group details if app id is not yet set
    if (selectedApp.id === "") {
      return
    }

    setCrashOrAnrGroupDetailsApiStatus(CrashOrAnrGroupDetailsApiStatus.Loading)

    // Set key id if user has paginated
    var keyId = null
    var keyTimestamp = null
    if (paginationDirection != PaginationDirection.None && crashOrAnrGroupDetails.results !== null && crashOrAnrGroupDetails?.results.length > 0) {
      keyId = crashOrAnrGroupDetails.results[0].id
      keyTimestamp = crashOrAnrGroupDetails.results[0].timestamp
    }

    // Invert limit if paginating backward
    var limit = 1
    if (paginationDirection === PaginationDirection.Backward) {
      limit = - limit
    }

    const result = await fetchCrashOrAnrGroupDetailsFromServer(crashOrAnrType, appId, crashOrAnrGroupId, startDate, endDate, selectedVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames, keyId, keyTimestamp, limit, router)

    switch (result.status) {
      case CrashOrAnrGroupDetailsApiStatus.Error:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashOrAnrGroupDetailsApiStatus(CrashOrAnrGroupDetailsApiStatus.Error)
        break
      case CrashOrAnrGroupDetailsApiStatus.Success:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashOrAnrGroupDetailsApiStatus(CrashOrAnrGroupDetailsApiStatus.Success)
        setCrashOrAnrGroupDetails(result.data)
        break
    }
  }

  useEffect(() => {
    getCrashOrAnrGroupDetails()
  }, [paginationIndex, startDate, endDate, selectedVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-normal text-4xl max-w-6xl text-center">{selectedApp.name}</p>
      <div className="py-1" />
      <p className="font-display font-light text-3xl max-w-6xl text-center">{crashOrAnrGroupName}</p>
      <div className="py-6" />

      {/* Error state for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}

      {/* Error state for filters fetch */}
      {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}

      {/* Main UI */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success &&
        <div>
          <div className="flex flex-wrap gap-8 items-center w-5/6">
            <div className="flex flex-row items-center">
              <input type="date" defaultValue={startDate} max={endDate} className="font-display border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
              <p className="font-display px-2">to</p>
              <input type="date" defaultValue={endDate} min={startDate} className="font-display border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <DropdownSelect title="App versions" type={DropdownSelectType.MultiAppVersion} items={versions} initialSelected={selectedVersions} onChangeSelected={(items) => setSelectedVersions(items as AppVersion[])} />
            {countries.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={countries} initialSelected={countries} onChangeSelected={(items) => setSelectedCountries(items as string[])} />}
            {networkProviders.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network Provider" items={networkProviders} initialSelected={networkProviders} onChangeSelected={(items) => setSelectedNetworkProviders(items as string[])} />}
            {networkTypes.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network type" items={networkTypes} initialSelected={networkTypes} onChangeSelected={(items) => setSelectedNetworkTypes(items as string[])} />}
            {networkGenerations.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Network generation" items={networkGenerations} initialSelected={networkGenerations} onChangeSelected={(items) => setSelectedNetworkGenerations(items as string[])} />}
            {locales.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Locale" items={locales} initialSelected={locales} onChangeSelected={(items) => setSelectedLocales(items as string[])} />}
            {deviceManufacturers.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Manufacturer" items={deviceManufacturers} initialSelected={deviceManufacturers} onChangeSelected={(items) => setSelectedDeviceManufacturers(items as string[])} />}
            {deviceNames.length > 0 && <DropdownSelect type={DropdownSelectType.MultiString} title="Device Name" items={deviceNames} initialSelected={deviceNames} onChangeSelected={(items) => setSelectedDeviceNames(items as string[])} />}
          </div>
          <div className="py-4" />
          <div className="flex flex-wrap gap-2 items-center w-5/6">
            <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
            {selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).map((v) => v.displayName).join(', ')} />}
            {selectedCountries.length > 0 && <FilterPill title={Array.from(selectedCountries).join(', ')} />}
            {selectedNetworkProviders.length > 0 && <FilterPill title={Array.from(selectedNetworkProviders).join(', ')} />}
            {selectedNetworkTypes.length > 0 && <FilterPill title={Array.from(selectedNetworkTypes).join(', ')} />}
            {selectedNetworkGenerations.length > 0 && <FilterPill title={Array.from(selectedNetworkGenerations).join(', ')} />}
            {selectedLocales.length > 0 && <FilterPill title={Array.from(selectedLocales).join(', ')} />}
            {selectedDeviceManufacturers.length > 0 && <FilterPill title={Array.from(selectedDeviceManufacturers).join(', ')} />}
            {selectedDeviceNames.length > 0 && <FilterPill title={Array.from(selectedDeviceNames).join(', ')} />}
          </div>
          <div className="py-6" />
          <div className="flex flex-col md:flex-row w-full">
            <div className="border border-black font-sans text-sm w-full h-[24rem]">
              <ExceptionCountChart />
            </div>
            <div className="p-2" />
            <div className="border border-black font-sans text-sm w-full h-[24rem]">
              <UserFlowCrashOrAnrGroupDetails />
            </div>
          </div>
          <div className="py-8" />

          {/* Error state for crash details fetch */}
          {crashOrAnrGroupDetailsApiStatus === CrashOrAnrGroupDetailsApiStatus.Error && <p className="text-lg font-display">Error fetching list of {crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

          {/* Empty state for crash details fetch */}
          {crashOrAnrGroupDetailsApiStatus === CrashOrAnrGroupDetailsApiStatus.Success && crashOrAnrGroupDetails.results === null && <p className="text-lg font-display">It seems there are no {crashOrAnrType === CrashOrAnrType.Crash ? 'Crashes' : 'ANRs'} for the current combination of filters. Please change filters to try again</p>}

          {(crashOrAnrGroupDetailsApiStatus === CrashOrAnrGroupDetailsApiStatus.Success || crashOrAnrGroupDetailsApiStatus === CrashOrAnrGroupDetailsApiStatus.Loading) && crashOrAnrGroupDetails.results !== null && crashOrAnrGroupDetails.results.length > 0 &&
            <div>
              <div className="flex flex-col md:flex-row md:items-center w-full">
                <p className="font-sans text-3xl"> Stack traces</p>
                <div className="grow" />
                <Paginator prevEnabled={crashOrAnrGroupDetails.meta.previous} nextEnabled={crashOrAnrGroupDetails.meta.next} displayText=""
                  onNext={() => {
                    setPaginationDirection(PaginationDirection.Forward)
                    setPaginationIndex(paginationIndex + 1)
                  }}
                  onPrev={() => {
                    setPaginationDirection(PaginationDirection.Backward)
                    setPaginationIndex(paginationIndex - 1)
                  }} />
              </div>
              <div className="py-2" />

              {/* We show ... in loading state for Crash/Anr ID so that user knows some API call is happening */}
              <p className="font-display text-xl"> Id: {crashOrAnrGroupDetailsApiStatus == CrashOrAnrGroupDetailsApiStatus.Loading ? '...' : crashOrAnrGroupDetails.results[0].id}</p>
              <p className="font-sans"> Date & time: {formatDateToHumanReadable(crashOrAnrGroupDetails.results[0].timestamp)}, {formatTimeToHumanReadable(crashOrAnrGroupDetails.results[0].timestamp)}</p>
              <p className="font-sans"> Device: {crashOrAnrGroupDetails.results[0].resource.device_manufacturer + crashOrAnrGroupDetails.results[0].resource.device_model}</p>
              <p className="font-sans"> App version: {crashOrAnrGroupDetails.results[0].resource.app_version}</p>
              <p className="font-sans"> Network type: {crashOrAnrGroupDetails.results[0].resource.network_type}</p>
              <div className="py-2" />
              <Link key={crashOrAnrGroupDetails.results[0].id} href={`/${teamId}/sessions/${appId}/${crashOrAnrGroupDetails.results[0].session_id}`} className="outline-none justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">View Session </Link>
              <div className="py-4" />
              {crashOrAnrType === CrashOrAnrType.Crash &&
                <div>
                  {(crashOrAnrGroupDetails as typeof emptyCrashGroupDetailsResponse).results[0].exceptions.map((e, index) => (
                    <Accordion key={index} title={'Thread: ' + crashOrAnrGroupDetails.results[0].thread_name} id={`${e.type}-${index}`} active={true}>
                      {e.stacktrace}
                    </Accordion>
                  ))}
                </div>
              }
              {crashOrAnrType === CrashOrAnrType.Anr &&
                <div>
                  {(crashOrAnrGroupDetails as typeof emptyAnrGroupDetailsResponse).results[0].anrs.map((e, index) => (
                    <Accordion key={index} title={'Thread: ' + crashOrAnrGroupDetails.results[0].thread_name} id={`${e.type}-${index}`} active={true}>
                      {e.stacktrace}
                    </Accordion>
                  ))}
                </div>
              }
              <div>
                {crashOrAnrGroupDetails.results[0].threads.map((e, index) => (
                  <Accordion key={index} title={'Thread: ' + e.name} id={`${e.name}-${index}`} active={false}>
                    {e.frames.join('\n')}
                  </Accordion>
                ))}
              </div>
            </div>}
        </div>}
    </div>
  )
}
