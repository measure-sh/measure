"use client";

import { FilterSource } from "@/app/api/api_calls";
import Filters, {
  AppVersionsInitialSelectionType,
} from "@/app/components/filters";
import InfoTooltip from "@/app/components/info_tooltip";
import NetworkEndpointStatusCodesPlot from "@/app/components/network_endpoint_status_codes_plot";
import NetworkLatencyPlot from "@/app/components/network_latency_plot";
import NetworkTimelinePlot from "@/app/components/network_timeline_plot";
import { Skeleton, SkeletonPlot } from "@/app/components/skeleton";
import {
  useNetworkLatencyQuery,
  useNetworkEndpointStatusCodesQuery,
  useNetworkTimelineQuery,
} from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { getPlotTimeGroupForRange } from "@/app/utils/time_utils";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface NetworkDetailsProps {
  params: { teamId: string };
}

export default function NetworkDetails({ params }: NetworkDetailsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useFiltersStore((state) => state.filters);
  const domain = searchParams.get("domain") ?? "";
  const path = searchParams.get("path") ?? "";

  const latencyQuery = useNetworkLatencyQuery(domain, path);
  const statusCodesQuery = useNetworkEndpointStatusCodesQuery(domain, path);
  const timelineQuery = useNetworkTimelineQuery(domain, path);

  const latencyStatus =
    latencyQuery.status === "success" &&
    (latencyQuery.data === null || latencyQuery.data.length === 0)
      ? ("nodata" as const)
      : latencyQuery.status;
  const statusCodesStatus =
    statusCodesQuery.status === "success" && statusCodesQuery.data === null
      ? ("nodata" as const)
      : statusCodesQuery.status;
  const timelineStatus =
    timelineQuery.status === "success" && timelineQuery.data === null
      ? ("nodata" as const)
      : timelineQuery.status;

  const plotTimeGroup = getPlotTimeGroupForRange(
    filters.startDate,
    filters.endDate,
  );
  const shouldRenderLatencyPlot = latencyStatus === "success";
  const shouldRenderStatusCodesPlot = statusCodesStatus === "success";
  const shouldRenderTimelinePlot = timelineStatus === "success";
  const hasNoData =
    latencyStatus === "nodata" &&
    statusCodesStatus === "nodata" &&
    timelineStatus === "nodata";

  useEffect(() => {
    if (!filters.ready) {
      return;
    }

    const query = new URLSearchParams(filters.serialisedFilters!);
    query.set("domain", domain);
    query.set("path", path);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }, [domain, filters.ready, filters.serialisedFilters, path, pathname]);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <Filters
        teamId={params.teamId}
        filterSource={FilterSource.Events}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
        showAppSelector={false}
        showOsVersions={true}
        showCountries={true}
        showNetworkTypes={true}
        showNetworkProviders={true}
        showNetworkGenerations={true}
        showLocales={true}
        showDeviceManufacturers={true}
        showDeviceNames={true}
        showHttpMethods={true}
      />

      {filters.loading && (
        <div className="mt-6 flex flex-col w-full">
          <Skeleton className="h-9 w-full" />
          <div className="py-6" />
          <SkeletonPlot />
          <div className="py-6" />
          <SkeletonPlot />
        </div>
      )}

      {filters.ready && (
        <>
          <div className="py-4" />
          {hasNoData ? (
            <div className="flex min-h-144 w-full items-center justify-center">
              <p className="font-body text-sm">
                No data available for the selected filters
              </p>
            </div>
          ) : (
            <>
              <div className="w-full">
                <p className="font-display text-xl">Latency</p>
                <div className="py-2" />
                <div className="flex font-body items-center justify-center w-full h-144">
                  {latencyStatus === "pending" && <SkeletonPlot />}
                  {shouldRenderLatencyPlot && (
                    <NetworkLatencyPlot
                      data={latencyQuery.data!}
                      plotTimeGroup={plotTimeGroup}
                    />
                  )}
                  {latencyStatus === "nodata" && (
                    <p className="font-body text-sm">
                      No data available for the selected filters
                    </p>
                  )}
                  {latencyStatus === "error" && (
                    <p className="font-body text-sm">
                      Error fetching latency, please change filters & try again
                    </p>
                  )}
                </div>
              </div>

              <div className="py-8" />
              <div className="w-full">
                <p className="font-display text-xl">Status Codes</p>
                <div className="py-2" />
                <div className="flex font-body items-center justify-center w-full h-144">
                  {statusCodesStatus === "pending" && <SkeletonPlot />}
                  {shouldRenderStatusCodesPlot && (
                    <NetworkEndpointStatusCodesPlot
                      statusCodes={statusCodesQuery.data!.status_codes}
                      data={statusCodesQuery.data!.data_points}
                      plotTimeGroup={plotTimeGroup}
                    />
                  )}
                  {statusCodesStatus === "nodata" && (
                    <p className="font-body text-sm">
                      No data available for the selected filters
                    </p>
                  )}
                  {statusCodesStatus === "error" && (
                    <p className="font-body text-sm">
                      Error fetching status distribution, please change filters
                      & try again
                    </p>
                  )}
                </div>
              </div>

              <div className="py-8" />
              <div className="w-full">
                <div className="flex items-center gap-2">
                  <p className="font-display text-xl">Timeline</p>
                  <InfoTooltip
                    content={
                      <>
                        Distribution of when this endpoint is typically called
                        in a session.{" "}
                        <Link
                          href="/docs/network-monitoring/endpoint-patterns#request-timeline"
                          className={underlineLinkStyle}
                        >
                          Learn more
                        </Link>{" "}
                        about how the timeline is generated.
                      </>
                    }
                  />
                </div>
                {shouldRenderTimelinePlot && (
                  <div className="py-8">
                    <NetworkTimelinePlot data={timelineQuery.data!} />
                  </div>
                )}
                {!shouldRenderTimelinePlot && (
                  <div className="flex font-body items-center justify-center w-full h-144">
                    {timelineStatus === "pending" && <SkeletonPlot />}
                    {timelineStatus === "nodata" && (
                      <p className="font-body text-sm">
                        No data available for the selected filters
                      </p>
                    )}
                    {timelineStatus === "error" && (
                      <p className="font-body text-sm">
                        Error fetching timeline, please change filters & try
                        again
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
