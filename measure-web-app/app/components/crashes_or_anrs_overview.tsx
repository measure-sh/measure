"use client"

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { CrashOrAnrGroupsApiStatus, CrashOrAnrType, FiltersApiType, emptyCrashOrAnrGroupsResponse, fetchCrashOrAnrGroupsFromServer } from '@/app/api/api_calls';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import Filters, { defaultSelectedFilters } from './filters';
import ExceptionsOverviewPlot from './exceptions_overview_plot';

interface CrashOrAnrsOverviewProps {
  crashOrAnrType: CrashOrAnrType,
  teamId: string,
}

export const CrashesOrAnrsOverview: React.FC<CrashOrAnrsOverviewProps> = ({ crashOrAnrType, teamId }) => {
  const router = useRouter()
  const [crashOrAnrGroupsApiStatus, setCrashOrAnrGroupsApiStatus] = useState(CrashOrAnrGroupsApiStatus.Loading);

  const [selectedFilters, setSelectedFilters] = useState(defaultSelectedFilters);

  const [crashOrAnrGroups, setCrashOrAnrGroups] = useState(emptyCrashOrAnrGroupsResponse);
  const paginationOffset = 10
  const [paginationRange, setPaginationRange] = useState({ start: 1, end: paginationOffset })
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)


  const getCrashOrAnrGroups = async () => {
    // Don't try to fetch crashes or ANRs if app id is not yet set
    if (selectedFilters.selectedApp.id === "") {
      return
    }

    setCrashOrAnrGroupsApiStatus(CrashOrAnrGroupsApiStatus.Loading)

    // Set key id if user has paginated. Last index of current list if forward navigation, first index if backward
    var keyId = null
    if (crashOrAnrGroups.results !== null && crashOrAnrGroups.results.length > 0) {
      if (paginationDirection === PaginationDirection.Forward) {
        keyId = crashOrAnrGroups.results[crashOrAnrGroups.results.length - 1].id
      } else if (paginationDirection === PaginationDirection.Backward) {
        keyId = crashOrAnrGroups.results[0].id
      }
    }

    // Invert limit if paginating backward
    var limit = paginationOffset
    if (paginationDirection === PaginationDirection.Backward) {
      limit = - limit
    }

    const result = await fetchCrashOrAnrGroupsFromServer(crashOrAnrType, selectedFilters.selectedApp.id, selectedFilters.selectedStartDate, selectedFilters.selectedEndDate, selectedFilters.selectedVersions, keyId, limit, router)

    switch (result.status) {
      case CrashOrAnrGroupsApiStatus.Error:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashOrAnrGroupsApiStatus(CrashOrAnrGroupsApiStatus.Error)
        break
      case CrashOrAnrGroupsApiStatus.Success:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashOrAnrGroupsApiStatus(CrashOrAnrGroupsApiStatus.Success)
        setCrashOrAnrGroups(result.data)
        break
    }
  }

  useEffect(() => {
    getCrashOrAnrGroups()
  }, [paginationRange, selectedFilters]);

  // Reset pagination range if any filters change
  useEffect(() => {
    setPaginationRange({ start: 1, end: paginationOffset })
  }, [selectedFilters]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">{crashOrAnrType === CrashOrAnrType.Crash ? 'Crashes' : 'ANRs'}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        filtersApiType={crashOrAnrType === CrashOrAnrType.Crash ? FiltersApiType.Crash : FiltersApiType.Anr}
        showCountries={false}
        showNetworkTypes={false}
        showNetworkProviders={false}
        showNetworkGenerations={false}
        showLocales={false}
        showDeviceManufacturers={false}
        showDeviceNames={false}
        onFiltersChanged={(updatedFilters) => setSelectedFilters(updatedFilters)} />
      <div className="py-4" />

      {/* Error state for crash groups fetch */}
      {selectedFilters.ready
        && crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Error
        && <p className="text-lg font-display">Error fetching list of {crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

      {/* Empty state for crash groups fetch */}
      {selectedFilters.ready
        && crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Success
        && crashOrAnrGroups.results === null
        && <p className="text-lg font-display">It seems there are no {crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'ANRs'} for the current combination of filters. Please change filters to try again</p>}

      {/* Main crash groups list UI */}
      {selectedFilters.ready
        && (crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Success || crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Loading)
        && crashOrAnrGroups.results !== null &&
        <div className="flex flex-col items-center">
          <div className="py-4" />
          <ExceptionsOverviewPlot
            appId={selectedFilters.selectedApp.id}
            crashOrAnrType={crashOrAnrType}
            startDate={selectedFilters.selectedStartDate}
            endDate={selectedFilters.selectedEndDate}
            appVersions={selectedFilters.selectedVersions} />
          <div className="py-8" />
          <div className="table font-sans border border-black w-full">
            <div className="table-header-group border border-black">
              <div className="table-row">
                <div className="table-cell border border-black p-2 font-display">{crashOrAnrType === CrashOrAnrType.Crash ? 'Crash' : 'ANR'} Name</div>
                <div className="table-cell border border-black p-2 font-display text-center">Instances</div>
                <div className="table-cell border border-black p-2 font-display text-center">Percentage contribution</div>
              </div>
            </div>
            <div className="table-row-group">
              {crashOrAnrGroups.results.map(({ id, name, count, percentage_contribution }) => (
                <Link key={id} href={`/${teamId}/${crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'anrs'}/${selectedFilters.selectedApp.id}/${id}/${name}?start_date=${selectedFilters.selectedStartDate}&end_date=${selectedFilters.selectedEndDate}`} className="table-row hover:bg-yellow-200 active:bg-yellow-300">
                  <div className="table-cell border border-black p-2 hover:bg-yellow-200 active:bg-yellow-300">{name}</div>
                  <div className="table-cell border border-black p-2 text-center">{count} instances</div>
                  <div className="table-cell border border-black p-2 text-center">{percentage_contribution}%</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="py-2" />
          <Paginator prevEnabled={crashOrAnrGroups.meta.previous} nextEnabled={crashOrAnrGroups.meta.next} displayText={paginationRange.start + ' - ' + paginationRange.end}
            onNext={() => {
              setPaginationRange({ start: paginationRange.start + paginationOffset, end: paginationRange.end + paginationOffset })
              setPaginationDirection(PaginationDirection.Forward)
            }}
            onPrev={() => {
              setPaginationRange({ start: paginationRange.start - paginationOffset, end: paginationRange.end - paginationOffset })
              setPaginationDirection(PaginationDirection.Backward)
            }} />
        </div>}
    </div>
  )
}
