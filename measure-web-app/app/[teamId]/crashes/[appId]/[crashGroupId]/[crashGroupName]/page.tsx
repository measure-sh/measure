"use client"

import React, { useState, useEffect } from 'react';
import Accordion from "@/app/components/accordion";
import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import ExceptionCountChart from "@/app/components/exception_count_chart";
import FilterPill from "@/app/components/filter_pill";
import UserFlowCrashDetails from "@/app/components/user_flow_crash_details";
import Link from "next/link";
import { AppsApiStatus, CrashDetailsApiStatus, FiltersApiStatus, emptyApp, emptyCrashDetailsResponse, fetchAppsFromServer, fetchCrashDetailsFromServer, fetchFiltersFromServer } from '@/app/api/api_calls';
import { useRouter } from 'next/navigation';
import Paginator, { PaginationDirection } from '@/app/components/paginator';

export default function CrashDetails({ params }: { params: { teamId: string, appId: string, crashGroupId: string, crashGroupName: string } }) {
  const router = useRouter()

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);
  const [crashDetailsApiStatus, setCrashDetailsApiStatus] = useState(CrashDetailsApiStatus.Loading);

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

  const [crashDetails, setCrashDetails] = useState(emptyCrashDetailsResponse)
  const [paginationIndex, setPaginationIndex] = useState(0)
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

  const today = new Date();
  var initialEndDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [endDate, setEndDate] = useState(initialEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(endDate);

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  var initialStartDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(startDate);

  useEffect(() => {
    setFormattedStartDate(new Date(startDate).toLocaleDateString());
    setFormattedEndDate(new Date(endDate).toLocaleDateString());
  }, [startDate, endDate]);

  const getApps = async () => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const result = await fetchAppsFromServer(params.teamId, router)

    switch (result.status) {
      case AppsApiStatus.NoApps:
        setAppsApiStatus(AppsApiStatus.NoApps)
        break
      case AppsApiStatus.Error:
        setAppsApiStatus(AppsApiStatus.Error)
        break
      case AppsApiStatus.Success:
        setAppsApiStatus(AppsApiStatus.Success)
        setSelectedApp(result.data.find((e: typeof emptyApp) => e.id === params.appId))
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

  const getCrashDetails = async () => {
    setCrashDetailsApiStatus(CrashDetailsApiStatus.Loading)

    // Set key id if user has paginated
    var keyId = null
    var keyTimestamp = null
    if (crashDetails.results !== null && crashDetails?.results.length > 0) {
      keyId = crashDetails.results[0].id
      keyTimestamp = crashDetails.results[0].timestamp
    }

    // Invert limit if paginating backward
    var limit = 1
    if (paginationDirection === PaginationDirection.Backward) {
      limit = - limit
    }

    const result = await fetchCrashDetailsFromServer(params.appId, params.crashGroupId, startDate, endDate, selectedVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames, keyId, keyTimestamp, limit, router)

    switch (result.status) {
      case CrashDetailsApiStatus.Error:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashDetailsApiStatus(CrashDetailsApiStatus.Error)
        break
      case CrashDetailsApiStatus.Success:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashDetailsApiStatus(CrashDetailsApiStatus.Success)
        setCrashDetails(result.data)
        break
    }
  }

  useEffect(() => {
    getCrashDetails()
  }, [paginationIndex, startDate, endDate, selectedVersions, selectedCountries, selectedNetworkProviders, selectedNetworkTypes, selectedNetworkGenerations, selectedLocales, selectedDeviceManufacturers, selectedDeviceNames]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-normal text-4xl max-w-6xl text-center">{selectedApp.name}</p>
      <div className="py-1" />
      <p className="font-display font-light text-3xl max-w-6xl text-center">{params.crashGroupName}</p>
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
              <UserFlowCrashDetails />
            </div>
          </div>
          <div className="py-8" />

          {/* Error state for crash details fetch */}
          {crashDetailsApiStatus === CrashDetailsApiStatus.Error && <p className="text-lg font-display">Error fetching list of crashes, please change filters, refresh page or select a different app to try again</p>}

          {/* Empty state for crash details fetch */}
          {crashDetailsApiStatus === CrashDetailsApiStatus.Success && crashDetails.results === null && <p className="text-lg font-display">It seems there are no crashes for the current combination of filters. Please change filters to try again</p>}

          {(crashDetailsApiStatus === CrashDetailsApiStatus.Success || crashDetailsApiStatus === CrashDetailsApiStatus.Loading) && crashDetails.results !== null &&
            <div>
              <div className="flex flex-col md:flex-row md:items-center w-full">
                <p className="font-sans text-3xl"> Stack traces</p>
                <div className="grow" />
                <Paginator prevEnabled={crashDetails.meta.previous} nextEnabled={crashDetails.meta.next} displayText=""
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

              {/* We should ... in loading state for exception ID so that user knows some API call is happening */}
              <p className="font-display text-xl"> Exception Id: {crashDetailsApiStatus == CrashDetailsApiStatus.Loading ? '...' : crashDetails.results[0].id}</p>

              <p className="font-sans"> Date & time: {new Date(crashDetails.results[0].timestamp).toLocaleDateString()}, {new Date(crashDetails.results[0].timestamp).toLocaleTimeString()}</p>
              <p className="font-sans"> Device: {crashDetails.results[0].resource.device_manufacturer + crashDetails.results[0].resource.device_model}</p>
              <p className="font-sans"> App version: {crashDetails.results[0].resource.app_version}</p>
              <p className="font-sans"> Network type: {crashDetails.results[0].resource.network_type}</p>
              <div className="py-2" />
              <Link key={crashDetails.results[0].id} href={`/${params.teamId}/sessions/${crashDetails.results[0].session_id}`} className="outline-none justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">View Session </Link>
              <div className="py-4" />
              <div>
                {crashDetails.results[0].exceptions.map((e, index) => (
                  <Accordion key={index} title={"Thread: Main"} id={`${e.type}-${index}`} active={true}>
                    {e.stacktrace}
                  </Accordion>
                ))}
              </div>
              <div>
                {crashDetails.results[0].threads.map((e, index) => (
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
