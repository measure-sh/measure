"use client"

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import { ExceptionsOverviewApiStatus, ExceptionsType, FiltersApiType, emptyExceptionsOverviewResponse, fetchExceptionsOverviewFromServer } from '@/app/api/api_calls';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from './filters';
import ExceptionsOverviewPlot from './exceptions_overview_plot';

interface ExceptionsOverviewProps {
  exceptionsType: ExceptionsType,
  teamId: string,
}

export const ExceptionsOverview: React.FC<ExceptionsOverviewProps> = ({ exceptionsType, teamId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [exceptionsOverviewApiStatus, setExceptionsOverviewApiStatus] = useState(ExceptionsOverviewApiStatus.Loading);

  const [filters, setFilters] = useState(defaultFilters);

  const [exceptionsOverview, setExceptionsOverview] = useState(emptyExceptionsOverviewResponse);
  const paginationOffset = 10

  const getDefaultPaginatorStart = () => {
    let start = searchParams.get('paginatorStart')
    if (start) {
      return parseInt(start)
    } else {
      return 1
    }
  }

  const getDefaultPaginatorEnd = () => {
    let end = searchParams.get('paginatorEnd')
    if (end) {
      return parseInt(end)
    } else {
      return paginationOffset
    }
  }

  const [paginationRange, setPaginationRange] = useState({ start: getDefaultPaginatorStart(), end: getDefaultPaginatorEnd() })
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

  const getKeyId = () => {
    var keyId = searchParams.get('keyId')
    if (exceptionsOverview.results !== null && exceptionsOverview.results.length > 0) {
      if (paginationDirection === PaginationDirection.Forward) {
        keyId = exceptionsOverview.results[exceptionsOverview.results.length - 1].id
      } else if (paginationDirection === PaginationDirection.Backward) {
        keyId = exceptionsOverview.results[0].id
      }
    }
    return keyId
  }

  const getLimit = () => {
    // Invert limit if paginating backward
    var limit = paginationOffset
    if (paginationDirection === PaginationDirection.Backward) {
      limit = - limit
    }
    return limit
  }

  const updateUrlWithPaginatorData = () => {
    const params = new URLSearchParams(searchParams.toString());

    const keyId = getKeyId()

    if (!keyId) {
      return
    }

    params.set('keyId', keyId)
    params.set('paginatorStart', paginationRange.start.toString())
    params.set('paginatorEnd', paginationRange.end.toString())

    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const clearUrlPaginatorData = () => {
    const params = new URLSearchParams(searchParams.toString());

    params.delete('keyId')
    params.delete('paginatorStart')
    params.delete('paginatorEnd')

    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const getExceptionsOverview = async () => {
    setExceptionsOverviewApiStatus(ExceptionsOverviewApiStatus.Loading)

    const keyId = getKeyId()
    const limit = getLimit()

    const result = await fetchExceptionsOverviewFromServer(exceptionsType, filters, keyId, limit, router)

    switch (result.status) {
      case ExceptionsOverviewApiStatus.Error:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setExceptionsOverviewApiStatus(ExceptionsOverviewApiStatus.Error)
        clearUrlPaginatorData()
        break
      case ExceptionsOverviewApiStatus.Success:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setExceptionsOverviewApiStatus(ExceptionsOverviewApiStatus.Success)
        setExceptionsOverview(result.data)
        updateUrlWithPaginatorData()
        break
    }
  }

  useEffect(() => {
    if (!filters.ready) {
      return
    }

    getExceptionsOverview()
  }, [paginationRange, filters]);

  // Reset pagination range on filters change
  useEffect(() => {
    // If we reset pagination range even if values haven't change, we will trigger
    // and unnecessary getExceptionsOverview effect
    if (paginationRange.start === getDefaultPaginatorStart()
      && paginationRange.end === getDefaultPaginatorEnd()) {
      return
    }

    setPaginationRange({ start: 1, end: paginationOffset })
  }, [filters]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">{exceptionsType === ExceptionsType.Crash ? 'Crashes' : 'ANRs'}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        filtersApiType={exceptionsType === ExceptionsType.Crash ? FiltersApiType.Crash : FiltersApiType.Anr}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
        showCreateApp={true}
        showNoData={true}
        showNotOnboarded={true}
        showAppSelector={true}
        showAppVersions={true}
        showDates={true}
        showSessionType={false}
        showOsVersions={true}
        showCountries={true}
        showNetworkTypes={true}
        showNetworkProviders={true}
        showNetworkGenerations={true}
        showLocales={true}
        showDeviceManufacturers={true}
        showDeviceNames={true}
        showFreeText={false}
        onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />
      <div className="py-4" />

      {/* Error state for crash groups fetch */}
      {filters.ready
        && exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Error
        && <p className="text-lg font-display">Error fetching list of {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

      {/* Empty state for crash groups fetch */}
      {filters.ready
        && exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Success
        && exceptionsOverview.results === null
        && <p className="text-lg font-display">It seems there are no {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'} for the current combination of filters. Please change filters to try again</p>}

      {/* Main crash groups list UI */}
      {filters.ready
        && (exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Success || exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading)
        && exceptionsOverview.results !== null &&
        <div className="flex flex-col items-center w-full">
          <div className="py-4" />
          <ExceptionsOverviewPlot
            exceptionsType={exceptionsType}
            filters={filters} />
          <div className="py-4" />
          <div className='self-end'>
            <Paginator prevEnabled={exceptionsOverview.meta.previous} nextEnabled={exceptionsOverview.meta.next} displayText={paginationRange.start + ' - ' + paginationRange.end}
              onNext={() => {
                setPaginationRange({ start: paginationRange.start + paginationOffset, end: paginationRange.end + paginationOffset })
                setPaginationDirection(PaginationDirection.Forward)
              }}
              onPrev={() => {
                setPaginationRange({ start: paginationRange.start - paginationOffset, end: paginationRange.end - paginationOffset })
                setPaginationDirection(PaginationDirection.Backward)
              }} />
          </div>
          <div className="py-1" />
          <div className="table border border-black rounded-md w-full" style={{ tableLayout: "fixed" }}>
            <div className="table-header-group bg-neutral-950">
              <div className="table-row text-white font-display">
                <div className="table-cell w-96 p-4">{exceptionsType === ExceptionsType.Crash ? 'Crash' : 'ANR'} Name</div>
                <div className="table-cell w-48 p-4 text-center">Instances</div>
                <div className="table-cell w-48 p-4 text-center">Percentage contribution</div>
              </div>
            </div>
            <div className="table-row-group font-sans">
              {exceptionsOverview.results.map(({ id, type, message, method_name, file_name, line_number, count, percentage_contribution }) => (
                <Link key={id} href={`/${teamId}/${exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'}/${filters.app.id}/${id}/${type + (file_name !== "" ? "@" + file_name : "")}`} className="table-row border-b-2 border-black hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300 ">
                  <div className="table-cell p-4">
                    <p className='truncate'>{(file_name !== "" ? file_name : "unknown_file") + ": " + (method_name !== "" ? method_name : "unknown_method") + "()"}</p>
                    <div className='py-1' />
                    <p className='text-xs truncate text-gray-500'>{type + ":" + message}</p>
                  </div>
                  <div className="table-cell p-4 text-center">{count}</div>
                  <div className="table-cell p-4 text-center">{percentage_contribution}%</div>
                </Link>
              ))}
            </div>
          </div>
        </div>}
    </div>
  )
}
