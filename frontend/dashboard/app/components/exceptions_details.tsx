"use client"

import { emptyAnrExceptionsDetailsResponse, emptyCrashExceptionsDetailsResponse, ExceptionsType, FilterSource } from '@/app/api/api_calls'
import Paginator from '@/app/components/paginator'
import { paginationOffsetUrlKey, useAnrDetailsQuery, useCrashDetailsQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import { DateTime } from 'luxon'
import Image from 'next/image'
import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../utils/shadcn_utils'
import { formatDateToHumanReadableDateTime } from '../utils/time_utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'
import { buttonVariants } from './button'
import CopyAiContext from './copy_ai_context'
import ExceptionGroupCommonPath from './exception_group_common_path'
import ExceptionsDetailsPlot from './exceptions_details_plot'
import ExceptionsDistributionPlot from './exceptions_distribution_plot'
import Filters, { AppVersionsInitialSelectionType } from './filters'
import { Skeleton, SkeletonPlot } from './skeleton'

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

  const filters = useFiltersStore(state => state.filters)

  // Pagination is component-local state, initialized from URL
  const [paginationOffset, setPaginationOffset] = useState(() => {
    const po = searchParams.get(paginationOffsetUrlKey)
    return po ? parseInt(po) : 0
  })

  // Reset pagination when filters change (skip pre-ready transitions)
  const prevFiltersRef = useRef<string | null>(null)
  useEffect(() => {
    if (!filters.ready) return
    if (prevFiltersRef.current !== null && prevFiltersRef.current !== filters.serialisedFilters) {
      setPaginationOffset(0)
    }
    prevFiltersRef.current = filters.serialisedFilters
  }, [filters.ready, filters.serialisedFilters])

  // URL sync
  useEffect(() => {
    if (demo) {
      return
    }

    if (!filters.ready) {
      return
    }

    router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(paginationOffset)}&${filters.serialisedFilters!}`, { scroll: false })
  }, [paginationOffset, filters.ready, filters.serialisedFilters])

  // Both hooks must be called unconditionally (rules of hooks)
  const crashQuery = useCrashDetailsQuery(exceptionsGroupId!, paginationOffset)
  const anrQuery = useAnrDetailsQuery(exceptionsGroupId!, paginationOffset)
  const { data: queryData, status, isFetching } = exceptionsType === ExceptionsType.Crash ? crashQuery : anrQuery

  const emptyDefault = exceptionsType === ExceptionsType.Crash ? emptyCrashExceptionsDetailsResponse : emptyAnrExceptionsDetailsResponse
  const exceptionsDetails = (demo ? demoExceptionDetails : (queryData ?? emptyDefault)) as typeof emptyCrashExceptionsDetailsResponse | typeof emptyAnrExceptionsDetailsResponse
  const effectiveStatus = demo ? 'success' as const : status
  const effectiveFetching = demo ? false : isFetching

  const nextPage = () => setPaginationOffset(o => o + 1)
  const prevPage = () => setPaginationOffset(o => Math.max(0, o - 1))

  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (key: string) => {
    setImageErrors(prev => new Set(prev).add(key))
  }

  return (
    <div className="flex flex-col items-start">
      {demo && !hideDemoTitle && <p className="font-display font-normal text-4xl max-w-6xl text-center">Crash Details</p>}
      {!demo && filters.ready && <p className="font-display font-normal text-4xl max-w-6xl text-center">{filters.app!.name}</p>}
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
          showSessionTypes={false}
          showOsVersions={true}
          showCountries={true}
          showNetworkTypes={true}
          showNetworkProviders={true}
          showNetworkGenerations={true}
          showLocales={true}
          showDeviceManufacturers={true}
          showDeviceNames={true}
          showBugReportStatus={false}
          showHttpMethods={false}
          showUdAttrs={true}
          showFreeText={false} />}

      <div className="py-4" />

      {/* Full page skeleton when filters not ready */}
      {!demo && filters.loading &&
        <div className="w-full">
          <div className="flex flex-col md:flex-row w-full">
            <div className="flex font-body items-center justify-center w-full md:w-1/2 h-[32rem]">
              <SkeletonPlot />
            </div>
            <div className="flex font-body items-center justify-center w-full md:w-1/2 h-[32rem]">
              <SkeletonPlot />
            </div>
          </div>

          <div className="py-8" />
          <Skeleton className="h-8 w-40" />
          <div className="py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-[24rem] w-full rounded-sm mt-3" />
          </div>

          <div className="py-12" />
          <Skeleton className="h-8 w-32" />
          <div className="flex flex-col gap-3 w-full py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      }

      {(demo || filters.ready) &&
        <div className='w-full'>
          <div className="flex flex-col md:flex-row w-full">
            <ExceptionsDetailsPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              demo={demo} />
            <ExceptionsDistributionPlot
              exceptionsType={exceptionsType}
              exceptionsGroupId={exceptionsGroupId}
              demo={demo} />
          </div>

          <div className="py-8" />
          <ExceptionGroupCommonPath
            type={exceptionsType}
            groupId={exceptionsGroupId}
            appId={demo ? 'demo-app-id' : filters.app!.id}
            demo={demo}
          />
          <div className="py-12" />

          {effectiveStatus === 'error' &&
            <p className="font-body text-sm">Error fetching list of {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

          {(effectiveStatus === 'success' || effectiveStatus === 'pending') &&
            <div className='flex flex-col'>
              <div className="flex flex-col md:flex-row md:items-center w-full">
                <p className="font-body text-3xl"> Stack traces</p>
                <div className="grow" />
                <Paginator
                  prevEnabled={effectiveFetching ? false : exceptionsDetails.meta.previous}
                  nextEnabled={effectiveFetching ? false : exceptionsDetails.meta.next}
                  displayText=""
                  onNext={nextPage}
                  onPrev={prevPage} />
              </div>

              <div className="py-2" />

              {effectiveFetching &&
                <div className="flex flex-col gap-3 w-full py-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              }

              {exceptionsDetails.results?.length > 0 &&
                <div className={`${effectiveFetching ? 'invisible' : 'visible'}`}>
                  <p className="font-display text-xl"> Id: {exceptionsDetails.results[0].id}</p>
                  <p className="font-body"> Date & time: {formatDateToHumanReadableDateTime(exceptionsDetails.results[0].timestamp)}</p>
                  <p className="font-body"> Device: {exceptionsDetails.results[0].attribute.device_manufacturer + exceptionsDetails.results[0].attribute.device_model}</p>
                  <p className="font-body"> App version: {exceptionsDetails.results[0].attribute.app_version}</p>
                  <p className="font-body"> Network type: {exceptionsDetails.results[0].attribute.network_type}</p>
                  {exceptionsDetails.results[0].attachments?.length > 0 &&
                    <div className='flex mt-8 flex-wrap gap-8 items-center'>
                      {exceptionsDetails.results[0].attachments
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
                        key={exceptionsDetails.results[0].id}
                        href={`/${teamId}/session_timelines/${appId}/${exceptionsDetails.results[0].session_id}`}
                        className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit")}>
                        View Session Timeline
                      </Link>
                    )}
                    <div className='px-2' />
                    {!demo &&
                      <CopyAiContext
                        appName={filters.app!.name}
                        exceptionsType={exceptionsType}
                        exceptionsDetails={exceptionsDetails} />}
                  </div>
                  <div className="py-4" />
                  <Accordion type="single" collapsible defaultValue={
                    exceptionsType === ExceptionsType.Crash
                      ? 'Thread: ' + exceptionsDetails.results[0].attribute.thread_name
                      : exceptionsType === ExceptionsType.Anr
                        ? 'Thread: ' + exceptionsDetails.results[0].attribute.thread_name
                        : undefined
                  }>
                    {exceptionsType === ExceptionsType.Crash &&
                      <AccordionItem value={'Thread: ' + exceptionsDetails.results[0].attribute.thread_name}>
                        <AccordionTrigger className='font-display'>{'Thread: ' + exceptionsDetails.results[0].attribute.thread_name}</AccordionTrigger>
                        <AccordionContent className={stackTraceAccordionContentStyle}>
                          {(exceptionsDetails as typeof emptyCrashExceptionsDetailsResponse).results[0].exception.stacktrace}
                        </AccordionContent>
                      </AccordionItem>
                    }
                    {exceptionsType === ExceptionsType.Anr &&
                      <AccordionItem value={'Thread: ' + exceptionsDetails.results[0].attribute.thread_name}>
                        <AccordionTrigger className='font-display'>{'Thread: ' + exceptionsDetails.results[0].attribute.thread_name}</AccordionTrigger>
                        <AccordionContent className={stackTraceAccordionContentStyle}>
                          {(exceptionsDetails as typeof emptyAnrExceptionsDetailsResponse).results[0].anr.stacktrace}
                        </AccordionContent>
                      </AccordionItem>
                    }
                    {exceptionsDetails.results[0].threads?.map((e, index) => (
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