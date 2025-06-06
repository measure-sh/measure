"use client"

import { emptyAnrExceptionsDetailsResponse, emptyCrashExceptionsDetailsResponse, ExceptionsDetailsApiStatus, ExceptionsType, fetchExceptionsDetailsFromServer, FilterSource } from '@/app/api/api_calls'
import Paginator from '@/app/components/paginator'
import Image from 'next/image'
import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { cn } from '../utils/shadcn_utils'
import { formatDateToHumanReadableDateTime } from '../utils/time_utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'
import { buttonVariants } from './button'
import CopyAiContext from './copy_ai_context'
import ExceptionspDetailsPlot from './exceptions_details_plot'
import ExceptionsDistributionPlot from './exceptions_distribution_plot'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from './filters'
import LoadingSpinner from './loading_spinner'

interface PageState {
  exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus
  filters: typeof defaultFilters
  exceptionsDetails: typeof emptyCrashExceptionsDetailsResponse | typeof emptyAnrExceptionsDetailsResponse
  keyId: string | null
  keyTimestamp: string | null
  limit: number
}

interface ExceptionsDetailsProps {
  exceptionsType: ExceptionsType,
  teamId: string,
  appId: string,
  exceptionsGroupId: string,
  exceptionsGroupName: string,
}

const stackTraceAccordionContentStyle = 'whitespace-pre-wrap font-body leading-5.5 bg-gray-50 p-4'

export const ExceptionsDetails: React.FC<ExceptionsDetailsProps> = ({ exceptionsType, teamId, appId, exceptionsGroupId, exceptionsGroupName }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const keyIdUrlKey = "kId"
  const keyTimestampUrlKey = "kTs"
  const paginationLimitUrlKey = "pl"
  const defaultPaginationLimit = 1

  const initialState: PageState = {
    exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus.Loading,
    filters: defaultFilters,
    exceptionsDetails: exceptionsType === ExceptionsType.Crash ? emptyCrashExceptionsDetailsResponse : emptyAnrExceptionsDetailsResponse,
    keyId: searchParams.get('keyId') || null,
    keyTimestamp: searchParams.get('keyTimestamp') || null,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1
  }

  const [pageState, setPageState] = useState<PageState>(initialState)

  const updatePageState = (newState: Partial<PageState>) => {
    setPageState(prevState => ({ ...prevState, ...newState }))
  }

  const getExceptionsDetails = async () => {
    updatePageState({ exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus.Loading })

    const result = await fetchExceptionsDetailsFromServer(exceptionsType, exceptionsGroupId, pageState.filters, pageState.keyId, pageState.keyTimestamp, pageState.limit)

    switch (result.status) {
      case ExceptionsDetailsApiStatus.Error:
        updatePageState({ exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus.Error })
        break
      case ExceptionsDetailsApiStatus.Success:
        updatePageState({
          exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus.Success,
          exceptionsDetails: result.data
        })
        break
    }
  }

  const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
    if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
      updatePageState({
        filters: updatedFilters,
        keyId: pageState.filters.serialisedFilters && searchParams.get(keyIdUrlKey) ? searchParams.get(keyIdUrlKey) : pageState.keyId,
        keyTimestamp: pageState.filters.serialisedFilters && searchParams.get(keyTimestampUrlKey) ? searchParams.get(keyTimestampUrlKey) : pageState.keyTimestamp,
        limit: pageState.filters.serialisedFilters && searchParams.get(paginationLimitUrlKey) ? defaultPaginationLimit : pageState.limit
      })
    }
  }

  const handleNextPage = () => {
    if (pageState.exceptionsDetails.results?.length > 0) {
      const currentItem = pageState.exceptionsDetails.results[0]
      updatePageState({
        keyId: currentItem.id,
        keyTimestamp: currentItem.timestamp,
        limit: defaultPaginationLimit
      })
    }
  }

  const handlePrevPage = () => {
    if (pageState.exceptionsDetails.results?.length > 0) {
      const currentItem = pageState.exceptionsDetails.results[0]
      updatePageState({
        keyId: currentItem.id,
        keyTimestamp: currentItem.timestamp,
        limit: -defaultPaginationLimit
      })
    }
  }

  useEffect(() => {
    if (!pageState.filters.ready) {
      return
    }

    // update url
    const queryParams = [
      pageState.keyId ? `keyId=${encodeURIComponent(pageState.keyId)}` : '',
      pageState.keyTimestamp ? `keyTimestamp=${encodeURIComponent(pageState.keyTimestamp)}` : '',
      `limit=${pageState.limit}`,
      pageState.filters.serialisedFilters || ''
    ].filter(Boolean).join('&')

    router.replace(`?${queryParams}`, { scroll: false })

    getExceptionsDetails()
  }, [pageState.filters, pageState.keyId, pageState.keyTimestamp, pageState.limit])

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      {pageState.filters.ready && <p className="font-display font-normal text-4xl max-w-6xl text-center">{pageState.filters.app!.name}</p>}
      <div className="py-1" />
      <p className="font-display font-light text-3xl max-w-6xl text-center">{decodeURIComponent(exceptionsGroupName)}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        appId={appId}
        filterSource={exceptionsType === ExceptionsType.Crash ? FilterSource.Crashes : FilterSource.Anrs}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
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
        showBugReportStatus={false}
        showUdAttrs={true}
        showFreeText={false}
        onFiltersChanged={handleFiltersChanged} />

      <div className="py-4" />

      {pageState.filters.ready &&
        <div className='w-full'>
          <div className="flex flex-col md:flex-row w-full">
            <ExceptionspDetailsPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              filters={pageState.filters} />
            <div className="p-2" />
            <ExceptionsDistributionPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              filters={pageState.filters} />
          </div>

          {pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Error &&
            <p className="font-body text-sm">Error fetching list of {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

          {(pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Success || pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading) &&
            <div className='flex flex-col'>
              <div className="flex flex-col md:flex-row md:items-center w-full">
                <p className="font-body text-3xl"> Stack traces</p>
                <div className="grow" />
                <Paginator
                  prevEnabled={pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading ? false : pageState.exceptionsDetails.meta.previous}
                  nextEnabled={pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading ? false : pageState.exceptionsDetails.meta.next}
                  displayText=""
                  onNext={handleNextPage}
                  onPrev={handlePrevPage} />
              </div>

              <div className="py-2" />

              {pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading && <LoadingSpinner />}

              {pageState.exceptionsDetails.results?.length > 0 &&
                <div className={`${pageState.exceptionsDetailsApiStatus === ExceptionsDetailsApiStatus.Loading ? 'invisible' : 'visible'}`}>
                  <p className="font-display text-xl"> Id: {pageState.exceptionsDetails.results[0].id}</p>
                  <p className="font-body"> Date & time: {formatDateToHumanReadableDateTime(pageState.exceptionsDetails.results[0].timestamp)}</p>
                  <p className="font-body"> Device: {pageState.exceptionsDetails.results[0].attribute.device_manufacturer + pageState.exceptionsDetails.results[0].attribute.device_model}</p>
                  <p className="font-body"> App version: {pageState.exceptionsDetails.results[0].attribute.app_version}</p>
                  <p className="font-body"> Network type: {pageState.exceptionsDetails.results[0].attribute.network_type}</p>
                  {pageState.exceptionsDetails.results[0].attachments?.length > 0 &&
                    <div className='flex mt-8 flex-wrap gap-8 items-center'>
                      {pageState.exceptionsDetails.results[0].attachments.map((attachment, index) => (
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
                    <Link
                      key={pageState.exceptionsDetails.results[0].id}
                      href={`/${teamId}/sessions/${appId}/${pageState.exceptionsDetails.results[0].session_id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit font-display border border-black rounded-md select-none")}>
                      View Session
                    </Link>
                    <div className='px-2' />
                    <CopyAiContext
                      appName={pageState.filters.app!.name}
                      exceptionsType={exceptionsType}
                      exceptionsDetails={pageState.exceptionsDetails} />
                  </div>
                  <div className="py-4" />
                  <Accordion type="single" collapsible defaultValue={
                    exceptionsType === ExceptionsType.Crash
                      ? 'Thread: ' + pageState.exceptionsDetails.results[0].attribute.thread_name
                      : exceptionsType === ExceptionsType.Anr
                        ? 'Thread: ' + pageState.exceptionsDetails.results[0].attribute.thread_name
                        : undefined
                  }>
                    {exceptionsType === ExceptionsType.Crash &&
                      <AccordionItem value={'Thread: ' + pageState.exceptionsDetails.results[0].attribute.thread_name}>
                        <AccordionTrigger className='font-display'>{'Thread: ' + pageState.exceptionsDetails.results[0].attribute.thread_name}</AccordionTrigger>
                        <AccordionContent className={stackTraceAccordionContentStyle}>
                          {(pageState.exceptionsDetails as typeof emptyCrashExceptionsDetailsResponse).results[0].exception.stacktrace}
                        </AccordionContent>
                      </AccordionItem>
                    }
                    {exceptionsType === ExceptionsType.Anr &&
                      <AccordionItem value={'Thread: ' + pageState.exceptionsDetails.results[0].attribute.thread_name}>
                        <AccordionTrigger className='font-display'>{'Thread: ' + pageState.exceptionsDetails.results[0].attribute.thread_name}</AccordionTrigger>
                        <AccordionContent className={stackTraceAccordionContentStyle}>
                          {(pageState.exceptionsDetails as typeof emptyAnrExceptionsDetailsResponse).results[0].anr.stacktrace}
                        </AccordionContent>
                      </AccordionItem>
                    }
                    {pageState.exceptionsDetails.results[0].threads?.map((e, index) => (
                      <AccordionItem value={`${e.name}-${index}`} key={`${e.name}-${index}`}>
                        <AccordionTrigger className='font-display'>{'Thread: ' + e.name}</AccordionTrigger>
                        <AccordionContent className={stackTraceAccordionContentStyle}>
                          {e.frames.join('\n')}
                        </AccordionContent>
                      </AccordionItem>
                    )) || []}
                  </Accordion>
                </div>}
            </div>}
        </div>}
    </div>
  )
}