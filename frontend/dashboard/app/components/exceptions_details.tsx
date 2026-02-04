"use client"

import { emptyAnrExceptionsDetailsResponse, emptyCrashExceptionsDetailsResponse, ExceptionsDetailsApiStatus, ExceptionsType, fetchExceptionsDetailsFromServer, FilterSource } from '@/app/api/api_calls'
import Paginator from '@/app/components/paginator'
import { DateTime } from 'luxon'
import Image from 'next/image'
import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { cn } from '../utils/shadcn_utils'
import { formatDateToHumanReadableDateTime } from '../utils/time_utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'
import { buttonVariants } from './button'
import CopyAiContext from './copy_ai_context'
import ExceptionGroupCommonPath from './exception_group_common_path'
import ExceptionsDetailsPlot from './exceptions_details_plot'
import ExceptionsDistributionPlot from './exceptions_distribution_plot'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from './filters'
import LoadingSpinner from './loading_spinner'

const demoExceptionDetails = {
  meta: { next: false, previous: false },
  results: [
    {
      id: "d58064f1-80d9-4a6a-9f0f-1af51ccfcb19",
      session_id: "df45556c-1a00-452b-bc0b-7ccc65f5a148",
      timestamp: DateTime.now().toUTC().minus({ minutes: 7.5 }).plus({ seconds: 13 }).toISO(),
      type: "exception",
      attribute: {
        installation_id: "00000000-0000-0000-0000-000000000000",
        app_version: "1.0.0",
        app_build: "100",
        app_unique_id: "",
        measure_sdk_version: "",
        platform: "",
        thread_name: "main",
        user_id: "",
        device_name: "",
        device_model: "Pixel 7 Pro",
        device_manufacturer: "Google",
        device_type: "",
        device_is_foldable: false,
        device_is_physical: false,
        device_density_dpi: 0,
        device_width_px: 0,
        device_height_px: 0,
        device_density: 0,
        device_locale: "en_UK",
        device_low_power_mode: false,
        device_thermal_throttling_enabled: false,
        device_cpu_arch: "",
        os_name: "",
        os_version: "",
        os_page_size: 0,
        network_type: "wifi",
        network_provider: "",
        network_generation: "",
      },
      exception: {
        title: "java.lang.IllegalStateException@CheckoutActivity.kt",
        stacktrace: "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)\n\tat android.view.View.performClick(View.java:6294)\n\tat android.view.View$PerformClick.run(View.java:24774)\n\tat android.os.Handler.handleCallback(Handler.java:790)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loop(Looper.java:164)\n\tat android.app.ActivityThread.main(ActivityThread.java:6518)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.IllegalStateException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:448)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)",
        message: "Payment method must be specified",
      },
      attachments: [
        {
          id: "85082bcc-8242-4ac3-a03d-17436c87fdb6",
          name: "screenshot.png",
          type: "screenshot",
          key: "85082bcc-8242-4ac3-a03d-17436c87fdb6.png",
          location: "/images/demo_checkout_screenshot.png"
        }
      ],
      threads: [
        {
          name: "ConnectivityThread",
          frames: [
            "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
            "android.os.MessageQueue.next(MessageQueue.java:325)",
            "android.os.Looper.loop(Looper.java:142)",
            "android.os.HandlerThread.run(HandlerThread.java:65)"
          ]
        },
        {
          name: "queued-work-looper",
          frames: [
            "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
            "android.os.MessageQueue.next(MessageQueue.java:325)",
            "android.os.Looper.loop(Looper.java:142)",
            "android.os.HandlerThread.run(HandlerThread.java:65)"
          ]
        },
        {
          name: "OkHttp ConnectionPool",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "com.android.okhttp.ConnectionPool$1.run(ConnectionPool.java:101)",
            "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1162)",
            "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:636)",
            "java.lang.Thread.run(Thread.java:764)"
          ]
        },
        {
          name: "FinalizerDaemon",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "java.lang.Object.wait(Object.java:422)",
            "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:188)",
            "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:209)",
            "java.lang.Daemons$FinalizerDaemon.runInternal(Daemons.java:232)",
            "java.lang.Daemons$Daemon.run(Daemons.java:103)",
            "java.lang.Thread.run(Thread.java:764)"
          ]
        },
        {
          name: "Okio Watchdog",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "com.android.okhttp.okio.AsyncTimeout.awaitTimeout(AsyncTimeout.java:323)",
            "com.android.okhttp.okio.AsyncTimeout.-wrap0",
            "com.android.okhttp.okio.AsyncTimeout$Watchdog.run(AsyncTimeout.java:286)"
          ]
        },
        {
          name: "ReferenceQueueDaemon",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "java.lang.Daemons$ReferenceQueueDaemon.runInternal(Daemons.java:178)",
            "java.lang.Daemons$Daemon.run(Daemons.java:103)",
            "java.lang.Thread.run(Thread.java:764)"
          ]
        },
        {
          name: "FinalizerWatchdogDaemon",
          frames: [
            "java.lang.Thread.sleep(Thread.java:-2)",
            "java.lang.Thread.sleep(Thread.java:373)",
            "java.lang.Thread.sleep(Thread.java:314)",
            "java.lang.Daemons$FinalizerWatchdogDaemon.sleepFor(Daemons.java:342)",
            "java.lang.Daemons$FinalizerWatchdogDaemon.waitForFinalization(Daemons.java:364)",
            "java.lang.Daemons$FinalizerWatchdogDaemon.runInternal(Daemons.java:281)",
            "java.lang.Daemons$Daemon.run(Daemons.java:103)",
            "java.lang.Thread.run(Thread.java:764)"
          ]
        }
      ]
    }
  ]
} as any

interface PageState {
  exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus
  filters: typeof defaultFilters
  exceptionsDetails: typeof emptyCrashExceptionsDetailsResponse | typeof emptyAnrExceptionsDetailsResponse
  paginationOffset: number
}

const paginationLimit = 1
const paginationOffsetUrlKey = "po"

interface ExceptionsDetailsProps {
  exceptionsType?: ExceptionsType,
  teamId?: string,
  appId?: string,
  exceptionsGroupId?: string,
  exceptionsGroupName?: string,
  demo?: boolean,
  hideDemoTitle?: boolean
}

const stackTraceAccordionContentStyle = 'whitespace-pre-wrap font-code leading-5.5 bg-accent text-accent-foreground p-4 rounded-sm'

export const ExceptionsDetails: React.FC<ExceptionsDetailsProps> = ({ exceptionsType = ExceptionsType.Crash,
  teamId = 'demo-team',
  appId = 'demo-app',
  exceptionsGroupId = 'demo-exception-group',
  exceptionsGroupName = 'java.lang.IllegalStateException@CheckoutActivity.kt',
  demo = false,
  hideDemoTitle = false
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialState: PageState = {
    exceptionsDetailsApiStatus: demo ? ExceptionsDetailsApiStatus.Success : ExceptionsDetailsApiStatus.Loading,
    filters: defaultFilters,
    exceptionsDetails: demo ? demoExceptionDetails : (exceptionsType === ExceptionsType.Crash ? emptyCrashExceptionsDetailsResponse : emptyAnrExceptionsDetailsResponse),
    paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
  }

  const [pageState, setPageState] = useState<PageState>(initialState)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const updatePageState = (newState: Partial<PageState>) => {
    setPageState(prevState => ({ ...prevState, ...newState }))
  }

  const handleImageError = (key: string) => {
    setImageErrors(prev => new Set(prev).add(key))
  }

  const getExceptionsDetails = async () => {
    updatePageState({ exceptionsDetailsApiStatus: ExceptionsDetailsApiStatus.Loading })

    const result = await fetchExceptionsDetailsFromServer(exceptionsType, exceptionsGroupId, pageState.filters, paginationLimit, pageState.paginationOffset)

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
    // update filters only if they have changed
    if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
      updatePageState({
        filters: updatedFilters,
        // Reset pagination on filters change if previous filters were not default filters
        paginationOffset: pageState.filters.serialisedFilters && searchParams.get(paginationOffsetUrlKey) ? 0 : pageState.paginationOffset
      })
    }
  }

  const handleNextPage = () => {
    updatePageState({ paginationOffset: pageState.paginationOffset + paginationLimit })
  }

  const handlePrevPage = () => {
    updatePageState({ paginationOffset: Math.max(0, pageState.paginationOffset - paginationLimit) })
  }

  useEffect(() => {
    if (!pageState.filters.ready) {
      return
    }

    // update url
    router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(pageState.paginationOffset)}&${pageState.filters.serialisedFilters!}`, { scroll: false })

    getExceptionsDetails()
  }, [pageState.paginationOffset, pageState.filters])

  return (
    <div className="flex flex-col items-start">
      {demo && !hideDemoTitle && <p className="font-display font-normal text-4xl max-w-6xl text-center">Crash Details</p>}
      {!demo && pageState.filters.ready && <p className="font-display font-normal text-4xl max-w-6xl text-center">{pageState.filters.app!.name}</p>}
      <div className="py-1" />
      <p className="font-display font-light text-3xl max-w-6xl text-center">{decodeURIComponent(exceptionsGroupName)}</p>
      <div className="py-4" />

      {!demo &&
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
          onFiltersChanged={handleFiltersChanged} />}

      <div className="py-4" />

      {(demo || pageState.filters.ready) &&
        <div className='w-full'>
          <div className="flex flex-col md:flex-row w-full">
            <ExceptionsDetailsPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              filters={pageState.filters}
              demo={demo} />
            <ExceptionsDistributionPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              filters={pageState.filters}
              demo={demo} />
          </div>

          <div className="py-8" />
          <ExceptionGroupCommonPath
            type={exceptionsType}
            groupId={exceptionsGroupId}
            appId={demo ? 'demo-app-id' : pageState.filters.app!.id}
            demo={demo}
          />
          <div className="py-12" />

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
                      {pageState.exceptionsDetails.results[0].attachments
                        .filter(attachment => !imageErrors.has(attachment.key))
                        .map((attachment, index) => (
                          <Image
                            key={attachment.key}
                            className='border border-black'
                            src={attachment.location}
                            width={200}
                            height={200}
                            unoptimized={true}
                            alt={`Screenshot ${index}`}
                            onError={() => handleImageError(attachment.key)}
                          />
                        ))}
                    </div>}
                  <div className="py-4" />
                  <div className='flex flex-row items-center'>
                    {demo ? (
                      <div className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit")}>View Session Timeline</div>
                    ) : (
                      <Link
                        key={pageState.exceptionsDetails.results[0].id}
                        href={`/${teamId}/session_timelines/${appId}/${pageState.exceptionsDetails.results[0].session_id}`}
                        className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit")}>
                        View Session Timeline
                      </Link>
                    )}
                    <div className='px-2' />
                    {!demo &&
                      <CopyAiContext
                        appName={pageState.filters.app!.name}
                        exceptionsType={exceptionsType}
                        exceptionsDetails={pageState.exceptionsDetails} />}
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