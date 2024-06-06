"use client"

import React, { useState, useEffect } from 'react';
import Accordion from "@/app/components/accordion";
import UserFlowCrashOrAnrGroupDetails from "@/app/components/user_flow_crash_details";
import Link from "next/link";
import { CrashOrAnrGroupDetailsApiStatus, CrashOrAnrType, emptyCrashGroupDetailsResponse, emptyAnrGroupDetailsResponse, fetchCrashOrAnrGroupDetailsFromServer, FiltersApiType } from '@/app/api/api_calls';
import { useRouter } from 'next/navigation';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import { formatDateToHumanReadable, formatTimeToHumanReadable } from '../utils/time_utils';
import CrashOrAnrGroupDetailsPlot from './crash_or_anr_group_details_plot';
import Filters, { defaultSelectedFilters } from './filters';
import Journey, { JourneyType } from './journey';

interface CrashOrAnrGroupDetailsProps {
  crashOrAnrType: CrashOrAnrType,
  teamId: string,
  appId: string,
  crashOrAnrGroupId: string,
  crashOrAnrGroupName: string,
}

export const CrashOrAnrGroupDetails: React.FC<CrashOrAnrGroupDetailsProps> = ({ crashOrAnrType, teamId, appId, crashOrAnrGroupId, crashOrAnrGroupName }) => {
  const router = useRouter()

  const [crashOrAnrGroupDetailsApiStatus, setCrashOrAnrGroupDetailsApiStatus] = useState(CrashOrAnrGroupDetailsApiStatus.Loading);

  const [selectedFilters, setSelectedFilters] = useState(defaultSelectedFilters);

  const [crashOrAnrGroupDetails, setCrashOrAnrGroupDetails] = useState(crashOrAnrType === CrashOrAnrType.Crash ? emptyCrashGroupDetailsResponse : emptyAnrGroupDetailsResponse)
  const [paginationIndex, setPaginationIndex] = useState(0)
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

  const getCrashOrAnrGroupDetails = async () => {
    // Don't try to fetch crashes or ANR group details if app id is not yet set
    if (selectedFilters.selectedApp.id === "") {
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

    const result = await fetchCrashOrAnrGroupDetailsFromServer(crashOrAnrType, appId, crashOrAnrGroupId, selectedFilters.selectedStartDate, selectedFilters.selectedEndDate, selectedFilters.selectedVersions, selectedFilters.selectedCountries, selectedFilters.selectedNetworkProviders, selectedFilters.selectedNetworkTypes, selectedFilters.selectedNetworkGenerations, selectedFilters.selectedLocales, selectedFilters.selectedDeviceManufacturers, selectedFilters.selectedDeviceNames, keyId, keyTimestamp, limit, router)

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
  }, [paginationIndex, selectedFilters]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-normal text-4xl max-w-6xl text-center">{selectedFilters.selectedApp.name}</p>
      <div className="py-1" />
      <p className="font-display font-light text-3xl max-w-6xl text-center">{crashOrAnrGroupName}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        appId={appId}
        filtersApiType={crashOrAnrType === CrashOrAnrType.Crash ? FiltersApiType.Crash : FiltersApiType.Anr}
        showCountries={true}
        showNetworkTypes={true}
        showNetworkProviders={true}
        showNetworkGenerations={true}
        showLocales={true}
        showDeviceManufacturers={true}
        showDeviceNames={true}
        onFiltersChanged={(updatedFilters) => setSelectedFilters(updatedFilters)} />

      <div className="py-4" />

      {selectedFilters.ready &&
        <div>
          <div className="py-6" />
          <div className="flex flex-col md:flex-row w-full">
            <CrashOrAnrGroupDetailsPlot
              appId={appId}
              crashOrAnrType={crashOrAnrType}
              crashOrAnrGroupId={crashOrAnrGroupId}
              startDate={selectedFilters.selectedStartDate}
              endDate={selectedFilters.selectedEndDate}
              appVersions={selectedFilters.selectedVersions}
              countries={selectedFilters.selectedCountries}
              networkProviders={selectedFilters.selectedNetworkProviders}
              networkTypes={selectedFilters.selectedNetworkTypes}
              networkGenerations={selectedFilters.selectedNetworkGenerations}
              locales={selectedFilters.selectedLocales}
              deviceManufacturers={selectedFilters.selectedDeviceManufacturers}
              deviceNames={selectedFilters.selectedDeviceNames} />
            <div className="p-2" />
            <div className="w-full h-[32rem]">
              <Journey
                teamId={teamId}
                appId={selectedFilters.selectedApp.id}
                bidirectional={false}
                journeyType={crashOrAnrType === CrashOrAnrType.Crash ? JourneyType.CrashDetails : JourneyType.AnrDetails}
                crashOrAnrGroupId={crashOrAnrGroupId}
                startDate={selectedFilters.selectedStartDate}
                endDate={selectedFilters.selectedEndDate}
                appVersions={selectedFilters.selectedVersions}
                countries={selectedFilters.selectedCountries}
                networkProviders={selectedFilters.selectedNetworkProviders}
                networkTypes={selectedFilters.selectedNetworkTypes}
                networkGenerations={selectedFilters.selectedNetworkGenerations}
                locales={selectedFilters.selectedLocales}
                deviceManufacturers={selectedFilters.selectedDeviceManufacturers}
                deviceNames={selectedFilters.selectedDeviceNames} />
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
              <p className="font-sans"> Device: {crashOrAnrGroupDetails.results[0].attribute.device_manufacturer + crashOrAnrGroupDetails.results[0].attribute.device_model}</p>
              <p className="font-sans"> App version: {crashOrAnrGroupDetails.results[0].attribute.app_version}</p>
              <p className="font-sans"> Network type: {crashOrAnrGroupDetails.results[0].attribute.network_type}</p>
              <div className="py-2" />
              <Link key={crashOrAnrGroupDetails.results[0].id} href={`/${teamId}/sessions/${appId}/${crashOrAnrGroupDetails.results[0].session_id}`} className="outline-none justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">View Session </Link>
              <div className="py-4" />
              {crashOrAnrType === CrashOrAnrType.Crash &&
                <Accordion key='crash-thread' title={'Thread: ' + crashOrAnrGroupDetails.results[0].attribute.thread_name} id='crash' active={true}>
                  {(crashOrAnrGroupDetails as typeof emptyCrashGroupDetailsResponse).results[0].exception.stacktrace}
                </Accordion>
              }
              {crashOrAnrType === CrashOrAnrType.Anr &&
                <Accordion key='anr-thread' title={'Thread: ' + crashOrAnrGroupDetails.results[0].attribute.thread_name} id='anr' active={true}>
                  {(crashOrAnrGroupDetails as typeof emptyAnrGroupDetailsResponse).results[0].anr.stacktrace}
                </Accordion>
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
