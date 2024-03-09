"use client"

import React, { useState, useEffect } from 'react';
import Accordion from "@/app/components/accordion";
import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import ExceptionCountChart from "@/app/components/exception_count_chart";
import FilterPill from "@/app/components/filter_pill";
import UserFlowCrashOrAnrGroupDetails from "@/app/components/user_flow_crash_details";
import Link from "next/link";
import { AppsApiStatus, CrashOrAnrGroupDetailsApiStatus, CrashOrAnrType, FiltersApiStatus, emptyApp, emptyCrashGroupDetailsResponse, emptyAnrGroupDetailsResponse, fetchAppsFromServer, fetchCrashOrAnrGroupDetailsFromServer, fetchFiltersFromServer } from '@/app/api/api_calls';
import { useRouter, useSearchParams } from 'next/navigation';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import { updateDateQueryParams } from '../utils/router_utils';

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

  const [versions, setVersions] = useState([] as string[]);
  const [selectedVersions, setSelectedVersions] = useState([] as string[]);

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

  const today = new Date();
  var initialEndDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [endDate, setEndDate] = useState(searchParams.has("end_date") ? searchParams.get("end_date")! : initialEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(endDate);

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  var initialStartDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;
  const [startDate, setStartDate] = useState(searchParams.has("start_date") ? searchParams.get("start_date")! : initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(startDate);

  useEffect(() => {
    setFormattedStartDate(new Date(startDate).toLocaleDateString());
    setFormattedEndDate(new Date(endDate).toLocaleDateString());

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

        setVersions(result.data.versions)
        setSelectedVersions(result.data.versions)

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
            <CheckboxDropdown title="App versions" items={versions} initialSelectedItems={versions} onChangeSelectedItems={(items) => setSelectedVersions(items)} />
            {countries.length > 0 && <CheckboxDropdown title="Country" items={countries} initialSelectedItems={countries} onChangeSelectedItems={(items) => setSelectedCountries(items)} />}
            {networkProviders.length > 0 && <CheckboxDropdown title="Network Provider" items={networkProviders} initialSelectedItems={networkProviders} onChangeSelectedItems={(items) => setSelectedNetworkProviders(items)} />}
            {networkTypes.length > 0 && <CheckboxDropdown title="Network type" items={networkTypes} initialSelectedItems={networkTypes} onChangeSelectedItems={(items) => setSelectedNetworkTypes(items)} />}
            {networkGenerations.length > 0 && <CheckboxDropdown title="Network generation" items={networkGenerations} initialSelectedItems={networkGenerations} onChangeSelectedItems={(items) => setSelectedNetworkGenerations(items)} />}
            {locales.length > 0 && <CheckboxDropdown title="Locale" items={locales} initialSelectedItems={locales} onChangeSelectedItems={(items) => setSelectedLocales(items)} />}
            {deviceManufacturers.length > 0 && <CheckboxDropdown title="Device Manufacturer" items={deviceManufacturers} initialSelectedItems={deviceManufacturers} onChangeSelectedItems={(items) => setSelectedDeviceManufacturers(items)} />}
            {deviceNames.length > 0 && <CheckboxDropdown title="Device Name" items={deviceNames} initialSelectedItems={deviceNames} onChangeSelectedItems={(items) => setSelectedDeviceNames(items)} />}
          </div>
          <div className="py-4" />
          <div className="flex flex-wrap gap-2 items-center w-5/6">
            <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
            {selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).join(', ')} />}
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

          {(crashOrAnrGroupDetailsApiStatus === CrashOrAnrGroupDetailsApiStatus.Success || crashOrAnrGroupDetailsApiStatus === CrashOrAnrGroupDetailsApiStatus.Loading) && crashOrAnrGroupDetails.results !== null &&
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
              <p className="font-sans"> Date & time: {new Date(crashOrAnrGroupDetails.results[0].timestamp).toLocaleDateString()}, {new Date(crashOrAnrGroupDetails.results[0].timestamp).toLocaleTimeString()}</p>
              <p className="font-sans"> Device: {crashOrAnrGroupDetails.results[0].resource.device_manufacturer + crashOrAnrGroupDetails.results[0].resource.device_model}</p>
              <p className="font-sans"> App version: {crashOrAnrGroupDetails.results[0].resource.app_version}</p>
              <p className="font-sans"> Network type: {crashOrAnrGroupDetails.results[0].resource.network_type}</p>
              <div className="py-2" />
              <Link key={crashOrAnrGroupDetails.results[0].id} href={`/${teamId}/sessions/${appId}/${crashOrAnrGroupDetails.results[0].session_id}`} className="outline-none justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">View Session </Link>
              <div className="py-4" />
              {crashOrAnrType === CrashOrAnrType.Crash &&
                <div>
                  {(crashOrAnrGroupDetails as typeof emptyCrashGroupDetailsResponse).results[0].exceptions.map((e, index) => (
                    <Accordion key={index} title={"Thread: Main"} id={`${e.type}-${index}`} active={true}>
                      {e.stacktrace}
                    </Accordion>
                  ))}
                </div>
              }
              {crashOrAnrType === CrashOrAnrType.Anr &&
                <div>
                  {(crashOrAnrGroupDetails as typeof emptyAnrGroupDetailsResponse).results[0].anrs.map((e, index) => (
                    <Accordion key={index} title={"Thread: Main"} id={`${e.type}-${index}`} active={true}>
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
