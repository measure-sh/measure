"use client";

import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import InfoTooltip from "@/app/components/info_tooltip";
import NetworkEndpointStatusCodesPlot from "@/app/components/network_endpoint_status_codes_plot";
import NetworkLatencyPlot from "@/app/components/network_latency_plot";
import NetworkTimelinePlot from "@/app/components/network_timeline_plot";
import { SkeletonListPage, SkeletonPlot } from "@/app/components/skeleton";
import {
  useNetworkEndpointStatusCodesQuery,
  useNetworkLatencyQuery,
  useNetworkTimelineQuery,
} from "@/app/query/hooks";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { getPlotTimeGroupForRange } from "@/app/utils/time_utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface NetworkDetailsProps {
  params: { teamId: string };
}

export default function NetworkDetails({ params }: NetworkDetailsProps) {
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain") ?? "";
  const path = searchParams.get("path") ?? "";

  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    onChange,
  } = useFilterPage({ teamId: params.teamId, entity: "network" });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const latencyQuery = useNetworkLatencyQuery(filterParams, domain, path);
  const statusCodesQuery = useNetworkEndpointStatusCodesQuery(
    filterParams,
    domain,
    path,
  );
  const timelineQuery = useNetworkTimelineQuery(filterParams, domain, path);

  const filterExprIssues =
    filterExprIssuesIn(latencyQuery.error) ??
    filterExprIssuesIn(statusCodesQuery.error) ??
    filterExprIssuesIn(timelineQuery.error);

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
    readyValue?.date.startDate ?? "",
    readyValue?.date.endDate ?? "",
  );
  const shouldRenderLatencyPlot = latencyStatus === "success";
  const shouldRenderStatusCodesPlot = statusCodesStatus === "success";
  const shouldRenderTimelinePlot = timelineStatus === "success";
  const hasNoData =
    latencyStatus === "nodata" &&
    statusCodesStatus === "nodata" &&
    timelineStatus === "nodata";

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FilterBar
        entity="network"
        teamId={params.teamId}
        placeholder="Filter network requests…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        showAppSelect={false}
        status={filterStatus}
        onChange={onChange}
      />

      {filterStatus.kind === "error" && (
        <>
          <div className="py-4" />
          <p className="text-lg font-display">{filterStatus.message}</p>
        </>
      )}

      {filterStatus.kind === "loading" && (
        <>
          <div className="py-4" />
          <SkeletonListPage />
        </>
      )}

      {readyValue !== null && (
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
