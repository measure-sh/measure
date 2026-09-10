"use client";

import { emptyErrorGroupDetails } from "@/app/api/api_calls";
import { type FilterExprIssue, filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import Paginator from "@/app/components/paginator";
import {
  useErrorsDetailsPlotQuery,
  useErrorsDetailsQuery,
  useErrorsDistributionPlotQuery,
} from "@/app/query/hooks";
import { DateTime } from "luxon";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../utils/shadcn_utils";
import { formatDateToHumanReadableDateTime } from "../utils/time_utils";
import { track } from "../utils/analytics/track";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { buttonVariants } from "./button_variants";
import CodeBlock, { CODE_BLOCK_CARD_CLASS } from "./code_block";
import CopyAgentPrompt from "./copy_agent_prompt";
import ErrorGroupCommonPath from "./error_group_common_path";
import ErrorsDetailsPlot from "./errors_details_plot";
import ErrorsDistributionPlot from "./errors_distribution_plot";
import Pill, { PillType } from "./pill";
import { Skeleton, SkeletonPlot } from "./skeleton";

const demoErrorDetails = {
  meta: { next: false, previous: false },
  results: [
    {
      id: "d58064f1-80d9-4a6a-9f0f-1af51ccfcb19",
      session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
      timestamp: DateTime.now()
        .toUTC()
        .minus({ minutes: 7.5 })
        .plus({ seconds: 13 })
        .toISO(),
      type: "exception",
      attribute: {
        installation_id: "00000000-0000-0000-0000-000000000000",
        app_version: "2.0.0",
        app_build: "200",
        app_unique_id: "sh.measure.demo",
        measure_sdk_version: "",
        platform: "",
        thread_name: "main",
        user_id: "demo-user-id",
        device_name: "sunfish",
        device_model: "Pixel 7 Pro",
        device_manufacturer: "Google",
        device_type: "",
        device_is_foldable: false,
        device_is_physical: false,
        device_density_dpi: 0,
        device_width_px: 0,
        device_height_px: 0,
        device_density: 0,
        device_locale: "en-US",
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
        stacktrace:
          "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)\n\tat android.view.View.performClick(View.java:6294)\n\tat android.view.View$PerformClick.run(View.java:24774)\n\tat android.os.Handler.handleCallback(Handler.java:790)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loop(Looper.java:164)\n\tat android.app.ActivityThread.main(ActivityThread.java:6518)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.IllegalStateException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:448)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)",
        message: "Payment method must be specified",
      },
      anr: null,
      severity: "",
      num_code: null,
      code: "",
      meta: null,
      attachments: [
        {
          id: "85082bcc-8242-4ac3-a03d-17436c87fdb6",
          name: "screenshot.png",
          type: "screenshot",
          key: "85082bcc-8242-4ac3-a03d-17436c87fdb6.png",
          location: "/images/demo_checkout_screenshot.webp",
        },
      ],
      threads: [
        {
          name: "ConnectivityThread",
          frames: [
            "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
            "android.os.MessageQueue.next(MessageQueue.java:325)",
            "android.os.Looper.loop(Looper.java:142)",
            "android.os.HandlerThread.run(HandlerThread.java:65)",
          ],
        },
        {
          name: "queued-work-looper",
          frames: [
            "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
            "android.os.MessageQueue.next(MessageQueue.java:325)",
            "android.os.Looper.loop(Looper.java:142)",
            "android.os.HandlerThread.run(HandlerThread.java:65)",
          ],
        },
        {
          name: "OkHttp ConnectionPool",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "com.android.okhttp.ConnectionPool$1.run(ConnectionPool.java:101)",
            "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1162)",
            "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:636)",
            "java.lang.Thread.run(Thread.java:764)",
          ],
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
            "java.lang.Thread.run(Thread.java:764)",
          ],
        },
        {
          name: "Okio Watchdog",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "com.android.okhttp.okio.AsyncTimeout.awaitTimeout(AsyncTimeout.java:323)",
            "com.android.okhttp.okio.AsyncTimeout.-wrap0",
            "com.android.okhttp.okio.AsyncTimeout$Watchdog.run(AsyncTimeout.java:286)",
          ],
        },
        {
          name: "ReferenceQueueDaemon",
          frames: [
            "java.lang.Object.wait(Object.java:-2)",
            "java.lang.Daemons$ReferenceQueueDaemon.runInternal(Daemons.java:178)",
            "java.lang.Daemons$Daemon.run(Daemons.java:103)",
            "java.lang.Thread.run(Thread.java:764)",
          ],
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
            "java.lang.Thread.run(Thread.java:764)",
          ],
        },
      ],
    },
  ],
} as any;

const stackTraceCodeBlockClassName = cn(
  CODE_BLOCK_CARD_CLASS,
  "text-sm leading-relaxed",
);

function renderAttributeRow(key: string, value: unknown): ReactNode {
  const isObject = typeof value === "object" && value !== null;
  return (
    <div
      key={key}
      data-testid="exception-detail-attribute"
      className="flex flex-col gap-0.5 py-2 border-b border-border/40 last:border-b-0"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
        {key}
      </p>
      {isObject ? (
        <pre className="text-xs font-code whitespace-pre-wrap wrap-break-word m-0">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="text-xs wrap-break-word font-code">{String(value)}</p>
      )}
    </div>
  );
}

interface ErrorsDetailsViewProps {
  teamId?: string;
  appId?: string;
  appName?: string;
  errorGroupId?: string;
  startDate?: string;
  endDate?: string;
  data?: typeof emptyErrorGroupDetails;
  status?: "pending" | "success" | "error";
  isFetching?: boolean;
  filterExprIssues?: FilterExprIssue[] | null;
  onNext?: () => void;
  onPrev?: () => void;
  detailsPlotQuery?: ReturnType<typeof useErrorsDetailsPlotQuery>;
  distributionPlotQuery?: ReturnType<typeof useErrorsDistributionPlotQuery>;
  demo?: boolean;
  hideDemoTitle?: boolean;
}

// Rendering only. The demo pages use it with no filter hook or queries.
export const ErrorsDetailsView: React.FC<ErrorsDetailsViewProps> = ({
  teamId = "demo-team",
  appId = "demo-app",
  appName = "Demo App",
  errorGroupId = "demo-error-group",
  startDate = "",
  endDate = "",
  data = demoErrorDetails as typeof emptyErrorGroupDetails,
  status = "success",
  isFetching = false,
  filterExprIssues = null,
  onNext = () => {},
  onPrev = () => {},
  detailsPlotQuery,
  distributionPlotQuery,
  demo = false,
  hideDemoTitle = false,
}) => {
  const searchParams = useSearchParams();

  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (key: string) => {
    setImageErrors((prev) => new Set(prev).add(key));
  };

  const firstResult = data.results?.[0];
  const stacktrace =
    firstResult?.exception?.stacktrace ?? firstResult?.anr?.stacktrace ?? "";

  const extraAttributeRows: Array<[string, unknown]> = [];
  if (firstResult) {
    if (typeof firstResult.num_code === "number") {
      extraAttributeRows.push(["num_code", firstResult.num_code]);
    }
    if (typeof firstResult.code === "string" && firstResult.code !== "") {
      extraAttributeRows.push(["code", firstResult.code]);
    }
    if (firstResult.meta && Object.keys(firstResult.meta).length > 0) {
      extraAttributeRows.push(["meta", firstResult.meta]);
    }
    if (
      firstResult.user_defined_attribute &&
      Object.keys(firstResult.user_defined_attribute).length > 0
    ) {
      extraAttributeRows.push([
        "user_defined_attribute",
        firstResult.user_defined_attribute,
      ]);
    }
  }

  const entryPoint = searchParams.get("from") ?? "direct";

  // Fire `error_investigated` once per error group, after the first result
  // loads. Ref keyed by errorGroupId covers within-route navigation between
  // groups without a remount, mirroring the session_investigated pattern.
  const investigatedGroupRef = useRef<string | null>(null);
  useEffect(() => {
    if (demo || !firstResult || !errorGroupId) {
      return;
    }
    if (investigatedGroupRef.current === errorGroupId) {
      return;
    }
    investigatedGroupRef.current = errorGroupId;
    track("error_investigated", {
      team_id: teamId,
      app_id: appId,
      app_platform: firstResult.attribute?.os_name,
      type: firstResult.anr ? "anr" : "crash",
      severity: firstResult.severity,
      feature_area: "errors",
      entry_point: entryPoint,
    });
  }, [demo, errorGroupId, firstResult, teamId, appId, entryPoint]);

  return (
    <div className="flex flex-col items-start w-full">
      {demo && (
        <>
          {!hideDemoTitle && (
            <p className="font-display font-normal text-4xl max-w-6xl text-center">
              Error Details
            </p>
          )}
          <div className="py-4" />
        </>
      )}

      <div className="w-full">
        <div className="flex flex-col md:flex-row w-full">
          <ErrorsDetailsPlot
            startDate={startDate}
            endDate={endDate}
            query={detailsPlotQuery}
            demo={demo}
          />
          <ErrorsDistributionPlot query={distributionPlotQuery} demo={demo} />
        </div>

        <div className="py-8" />
        <ErrorGroupCommonPath
          appId={appId}
          groupId={errorGroupId}
          demo={demo}
        />
        <div className="py-12" />

        {status === "error" && filterExprIssues === null && (
          <p className="font-body text-sm">
            Error fetching list of errors, please change filters, refresh page
            or select a different app to try again
          </p>
        )}

        {(status === "success" || status === "pending") && (
          <div className="flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center w-full">
              <p className="font-body text-3xl"> Stack traces</p>
              <div className="grow" />
              <Paginator
                prevEnabled={isFetching ? false : data.meta.previous}
                nextEnabled={isFetching ? false : data.meta.next}
                displayText=""
                onNext={onNext}
                onPrev={onPrev}
              />
            </div>

            <div className="py-2" />

            {isFetching && (
              <div className="flex flex-col gap-3 w-full py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}

            {firstResult && (
              <div className={`${isFetching ? "invisible" : "visible"}`}>
                <p
                  data-testid="exception-detail-id"
                  className="font-display text-xl"
                >
                  {" "}
                  Id: {firstResult.id}
                </p>
                <div
                  data-testid="exception-detail-pills"
                  className="flex flex-wrap gap-2 py-2 items-center"
                >
                  <Pill
                    type={
                      firstResult.anr
                        ? PillType.Anr
                        : firstResult.severity === "fatal"
                          ? PillType.Crash
                          : PillType.Error
                    }
                  />
                  {firstResult.severity === "fatal" && (
                    <Pill type={PillType.Fatal} />
                  )}
                  {firstResult.severity === "unhandled" && (
                    <Pill type={PillType.Unhandled} />
                  )}
                  {firstResult.severity === "handled" && (
                    <Pill type={PillType.Handled} />
                  )}
                  <Pill
                    data-testid="exception-detail-timestamp"
                    tooltip
                  >{`Time: ${formatDateToHumanReadableDateTime(firstResult.timestamp)}`}</Pill>
                  <Pill
                    data-testid="exception-detail-app-version"
                    tooltip
                  >{`App version: ${firstResult.attribute.app_version}`}</Pill>
                  <Pill
                    data-testid="exception-detail-device"
                    tooltip
                  >{`Device: ${firstResult.attribute.device_manufacturer + firstResult.attribute.device_model}`}</Pill>
                  <Pill
                    data-testid="exception-detail-network-type"
                    tooltip
                  >{`Network type: ${firstResult.attribute.network_type}`}</Pill>
                </div>
                {firstResult.attachments?.length > 0 && (
                  <div className="flex mt-8 flex-wrap gap-8 items-center">
                    {firstResult.attachments
                      .filter((attachment) => !imageErrors.has(attachment.key))
                      .map((attachment, index) => (
                        <Image
                          key={attachment.key}
                          className="border border-black"
                          src={attachment.location}
                          width={200}
                          height={200}
                          unoptimized={true}
                          alt={`Screenshot ${index}`}
                          onError={() => handleImageError(attachment.key)}
                        />
                      ))}
                  </div>
                )}
                <div className="py-4" />
                <div className="flex flex-row items-center">
                  {demo ? (
                    <div
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "justify-center w-fit",
                      )}
                    >
                      View Session Replay
                    </div>
                  ) : (
                    <Link
                      key={firstResult.id}
                      href={`/${teamId}/session_replays/${appId}/${firstResult.session_id}`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "justify-center w-fit",
                      )}
                    >
                      View Session Replay
                    </Link>
                  )}
                  {!demo && (
                    <>
                      <div className="px-2" />
                      <CopyAgentPrompt
                        appId={appId}
                        appName={appName}
                        errorEvent={firstResult}
                      />
                    </>
                  )}
                </div>
                <div className="py-4" />
                {extraAttributeRows.length > 0 && (
                  <>
                    <div className="flex flex-col">
                      {extraAttributeRows.map(([k, v]) =>
                        renderAttributeRow(k, v),
                      )}
                    </div>
                    <div className="py-4" />
                  </>
                )}
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={"Thread: " + firstResult.attribute.thread_name}
                >
                  {stacktrace && (
                    <AccordionItem
                      value={"Thread: " + firstResult.attribute.thread_name}
                    >
                      <AccordionTrigger className="font-display">
                        {"Thread: " + firstResult.attribute.thread_name}
                      </AccordionTrigger>
                      <AccordionContent data-testid="exception-detail-main-stacktrace">
                        <CodeBlock
                          language="java"
                          className={stackTraceCodeBlockClassName}
                          code={stacktrace}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {firstResult.threads?.map((e, index) => (
                    <AccordionItem
                      value={`${e.name}-${index}`}
                      key={`${e.name}-${index}`}
                    >
                      <AccordionTrigger className="font-display">
                        {"Thread: " + e.name}
                      </AccordionTrigger>
                      <AccordionContent>
                        <CodeBlock
                          language="java"
                          className={stackTraceCodeBlockClassName}
                          code={e.frames.join("\n")}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  )) || []}
                </Accordion>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface ErrorsDetailsProps {
  teamId: string;
  appId: string;
  errorGroupId: string;
  errorGroupName?: string;
}

export const ErrorsDetails: React.FC<ErrorsDetailsProps> = ({
  teamId,
  appId,
  errorGroupId,
}) => {
  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    paginationOffset,
    onChange,
    nextPage,
    prevPage,
  } = useExprFilterPage({
    teamId,
    entity: "error_group_events",
    paginationLimit: 1,
    appId,
  });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const detailsQuery = useErrorsDetailsQuery(
    filterParams,
    errorGroupId,
    paginationOffset,
  );
  const detailsPlotQuery = useErrorsDetailsPlotQuery(
    filterParams,
    errorGroupId,
  );
  const distributionPlotQuery = useErrorsDistributionPlotQuery(
    filterParams,
    errorGroupId,
  );

  const filterExprIssues =
    filterExprIssuesIn(detailsQuery.error) ??
    filterExprIssuesIn(detailsPlotQuery.error) ??
    filterExprIssuesIn(distributionPlotQuery.error);

  const {
    data: errorsDetails = emptyErrorGroupDetails,
    status,
    isFetching,
  } = detailsQuery;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="error_group_events"
        placeholder="Filter events…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        showAppSelect={false}
        onChange={onChange}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind === "loading" && (
        <div className="w-full">
          <div className="flex flex-col md:flex-row w-full">
            <div className="flex font-body items-center justify-center w-full md:w-1/2 h-128">
              <SkeletonPlot />
            </div>
            <div className="flex font-body items-center justify-center w-full md:w-1/2 h-128">
              <SkeletonPlot />
            </div>
          </div>

          <div className="py-8" />
          <Skeleton className="h-8 w-40" />
          <div className="py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-96 w-full rounded-sm mt-3" />
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
      )}

      {readyValue !== null && (
        <ErrorsDetailsView
          teamId={teamId}
          appId={readyValue.app.id}
          appName={readyValue.app.name}
          errorGroupId={errorGroupId}
          startDate={readyValue.date.startDate}
          endDate={readyValue.date.endDate}
          data={errorsDetails}
          status={status}
          isFetching={isFetching}
          filterExprIssues={filterExprIssues}
          onNext={nextPage}
          onPrev={prevPage}
          detailsPlotQuery={detailsPlotQuery}
          distributionPlotQuery={distributionPlotQuery}
        />
      )}
    </div>
  );
};
