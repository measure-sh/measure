"use client"

import React, { useState, useEffect } from 'react';
import Accordion from "@/app/components/accordion";
import Link from "next/link";
import { ExceptionsDetailsApiStatus, ExceptionsType, emptyCrashExceptionsDetailsResponse, emptyAnrExceptionsDetailsResponse, fetchExceptionsDetailsFromServer, FiltersApiType } from '@/app/api/api_calls';
import { useRouter } from 'next/navigation';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import { formatDateToHumanReadableDateTime } from '../utils/time_utils';
import ExceptionspDetailsPlot from './exceptions_details_plot';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from './filters';
import Image from 'next/image';
import CopyAiContext from './copy_ai_context';
import LoadingSpinner from './loading_spinner';
import ExceptionsDistributionPlot from './exceptions_distribution_plot';

interface ExceptionsDetailsProps {
  exceptionsType: ExceptionsType,
  teamId: string,
  appId: string,
  exceptionsGroupId: string,
  exceptionsGroupName: string,
}

export const ExceptionsDetails: React.FC<ExceptionsDetailsProps> = ({ exceptionsType, teamId, appId, exceptionsGroupId, exceptionsGroupName }) => {
  const router = useRouter()

  const [exceptionsDetailsApiStatus, setExceptionsDetailsApiStatus] = useState(ExceptionsDetailsApiStatus.Loading);

  const [filters, setFilters] = useState(defaultFilters);

  const [exceptionsDetails, setExceptionsDetails] = useState(exceptionsType === ExceptionsType.Crash ? emptyCrashExceptionsDetailsResponse : emptyAnrExceptionsDetailsResponse)
  const [paginationIndex, setPaginationIndex] = useState(0)
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

  const getExceptionsDetails = async () => {
    setExceptionsDetailsApiStatus(ExceptionsDetailsApiStatus.Loading)

    // Set key id if user has paginated
    var keyId = null
    var keyTimestamp = null
    if (paginationDirection != PaginationDirection.None && exceptionsDetails.results !== null && exceptionsDetails?.results.length > 0) {
      keyId = exceptionsDetails.results[0].id
      keyTimestamp = exceptionsDetails.results[0].timestamp
    }

    // Invert limit if paginating backward
    var limit = 1
    if (paginationDirection === PaginationDirection.Backward) {
      limit = - limit
    }

    const result = await fetchExceptionsDetailsFromServer(exceptionsType, exceptionsGroupId, filters, keyId, keyTimestamp, limit, router)

    switch (result.status) {
      case ExceptionsDetailsApiStatus.Error:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setExceptionsDetailsApiStatus(ExceptionsDetailsApiStatus.Error)
        break
      case ExceptionsDetailsApiStatus.Success:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setExceptionsDetailsApiStatus(ExceptionsDetailsApiStatus.Success)
        setExceptionsDetails(result.data)
        break
    }
  }

  useEffect(() => {
    if (!filters.ready) {
      return
    }

    getExceptionsDetails()
  }, [paginationIndex, filters]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-normal text-4xl max-w-6xl text-center">{filters.app.name}</p>
      <div className="py-1" />
      <p className="font-display font-light text-3xl max-w-6xl text-center">{decodeURIComponent(exceptionsGroupName)}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        appId={appId}
        filtersApiType={exceptionsType === ExceptionsType.Crash ? FiltersApiType.Crash : FiltersApiType.Anr}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
        showCreateApp={true}
        showNoData={true}
        showNotOnboarded={true}
        showAppSelector={false}
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
        showUdAttrs={true}
        showFreeText={false}
        onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />

      <div className="py-4" />

      {filters.ready &&
        <div className='w-full'>
          <div className="py-6" />
          <div className="flex flex-col md:flex-row w-full">
            <ExceptionspDetailsPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              filters={filters} />
            <div className="p-2" />
            <ExceptionsDistributionPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              filters={filters} />
          </div>
          <div className="py-4" />

          {exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Error && <p className="text-lg font-display">Error fetching list of {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

          {(exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Success || exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading) &&
            <div className='flex flex-col'>
              <div className="flex flex-col md:flex-row md:items-center w-full">
                <p className="font-sans text-3xl"> Stack traces</p>
                <div className="grow" />
                <Paginator prevEnabled={exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading ? false : exceptionsDetails.meta.previous} nextEnabled={exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading ? false : exceptionsDetails.meta.next} displayText=""
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

              {exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading && <LoadingSpinner />}

              {exceptionsDetails.results?.length > 0 &&
                <div className={`${exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading ? 'invisible' : 'visible'}`}>
                  <p className="font-display text-xl"> Id: {exceptionsDetails.results[0].id}</p>
                  <p className="font-sans"> Date & time: {formatDateToHumanReadableDateTime(exceptionsDetails.results[0].timestamp)}</p>
                  <p className="font-sans"> Device: {exceptionsDetails.results[0].attribute.device_manufacturer + exceptionsDetails.results[0].attribute.device_model}</p>
                  <p className="font-sans"> App version: {exceptionsDetails.results[0].attribute.app_version}</p>
                  <p className="font-sans"> Network type: {exceptionsDetails.results[0].attribute.network_type}</p>
                  {/* show screenshots if they exist */}
                  {exceptionsDetails.results[0].attachments !== undefined && exceptionsDetails.results[0].attachments !== null && exceptionsDetails.results[0].attachments.length > 0 &&
                    <div className='flex mt-8 flex-wrap gap-8 items-center'>
                      {exceptionsDetails.results[0].attachments.map((attachment, index) => (
                        <Image
                          key={attachment.key}
                          className='border border-black'
                          src={attachment.location}
                          width={200}
                          height={200}
                          unoptimized={true}
                          alt={`Screenshot ${index}`}
                        />
                      ))}
                    </div>}
                  <div className="py-4" />
                  <div className='flex flex-row items-center'>
                    <Link key={exceptionsDetails.results[0].id} href={`/${teamId}/sessions/${appId}/${exceptionsDetails.results[0].session_id}`} className="outline-none justify-center w-fit hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4">View Session</Link>
                    <div className='px-2' />
                    <CopyAiContext appName={filters.app.name} exceptionsType={exceptionsType} exceptionsDetails={exceptionsDetails} />
                  </div>
                  <div className="py-2" />
                  {exceptionsType === ExceptionsType.Crash &&
                    <Accordion key='crash-thread' title={'Thread: ' + exceptionsDetails.results[0].attribute.thread_name} id='crash' active={true}>
                      {(exceptionsDetails as typeof emptyCrashExceptionsDetailsResponse).results[0].exception.stacktrace}
                    </Accordion>
                  }
                  {exceptionsType === ExceptionsType.Anr &&
                    <Accordion key='anr-thread' title={'Thread: ' + exceptionsDetails.results[0].attribute.thread_name} id='anr' active={true}>
                      {(exceptionsDetails as typeof emptyAnrExceptionsDetailsResponse).results[0].anr.stacktrace}
                    </Accordion>
                  }
                  <div>
                    {exceptionsDetails.results[0].threads.map((e, index) => (
                      <Accordion key={index} title={'Thread: ' + e.name} id={`${e.name}-${index}`} active={false}>
                        {e.frames.join('\n')}
                      </Accordion>
                    ))}
                  </div>
                </div>}
            </div>}
        </div>}
    </div>
  )
}
