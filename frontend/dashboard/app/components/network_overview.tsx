"use client";

import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import InfoTooltip from "@/app/components/info_tooltip";
import NetworkEndpointSearch from "@/app/components/network_endpoint_search";
import NetworkStatusDistributionPlot from "@/app/components/network_status_distribution_plot";
import NetworkTimelinePlot, {
  NetworkTimelineData,
  NetworkTimelineDataPoint,
} from "@/app/components/network_timeline_plot";
import NetworkTrends from "@/app/components/network_trends";
import { SkeletonListPage, SkeletonPlot } from "@/app/components/skeleton";
import {
  useNetworkStatusCodesQuery,
  useNetworkTimelineQuery,
} from "@/app/query/hooks";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { getPlotTimeGroupForRange } from "@/app/utils/time_utils";
import { DateTime } from "luxon";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function generateDemoStatusData() {
  const now = DateTime.now().toUTC();
  const data = [];
  const spikeDay = 10;

  for (let i = 0; i < 14; i++) {
    const datetime = now.minus({ days: 13 - i }).toFormat("yyyy-MM-dd");
    const isSpike = i === spikeDay;
    const total = Math.round(4200 + Math.random() * 1800);

    const errorMultiplier = isSpike ? 6 : 1;
    const count_5xx = Math.round(
      total * (0.005 + Math.random() * 0.01) * errorMultiplier,
    );
    const count_4xx = Math.round(
      total * (0.02 + Math.random() * 0.02) * errorMultiplier,
    );
    const count_3xx = Math.round(total * (0.01 + Math.random() * 0.01));
    const count_2xx = total - count_5xx - count_4xx - count_3xx;
    data.push({
      datetime,
      total_count: total,
      count_2xx,
      count_3xx,
      count_4xx,
      count_5xx,
    });
  }

  return data;
}

function generateDemoTimelineData(): NetworkTimelineData {
  // Each endpoint has a time range where it's active and a base intensity
  const endpoints: {
    domain: string;
    path_pattern: string;
    startSec: number;
    endSec: number;
    baseCount: number;
  }[] = [
    // Auth/config: concentrated in first 5 seconds
    {
      domain: "store.demo-provider.com",
      path_pattern: "/v1/auth/token",
      startSec: 0,
      endSec: 5,
      baseCount: 2.5,
    },
    {
      domain: "store.demo-provider.com",
      path_pattern: "/v1/config",
      startSec: 0,
      endSec: 3,
      baseCount: 1.8,
    },
    // Catalog content: early-mid session
    {
      domain: "store.demo-provider.com",
      path_pattern: "/v1/products",
      startSec: 3,
      endSec: 30,
      baseCount: 1.5,
    },
    {
      domain: "cdn.demo-provider.com",
      path_pattern: "/images/*",
      startSec: 4,
      endSec: 35,
      baseCount: 3.0,
    },
    {
      domain: "store.demo-provider.com",
      path_pattern: "/v1/users/*/profile",
      startSec: 5,
      endSec: 20,
      baseCount: 0.8,
    },
    // Commerce: late session
    {
      domain: "store.demo-provider.com",
      path_pattern: "/v1/products/*",
      startSec: 25,
      endSec: 80,
      baseCount: 1.2,
    },
    {
      domain: "store.demo-provider.com",
      path_pattern: "/v1/cart",
      startSec: 50,
      endSec: 90,
      baseCount: 0.9,
    },
    {
      domain: "payments.demo-provider.com",
      path_pattern: "/*/payment-methods",
      startSec: 55,
      endSec: 90,
      baseCount: 0.7,
    },
    {
      domain: "payments.demo-provider.com",
      path_pattern: "/v1/checkout",
      startSec: 70,
      endSec: 100,
      baseCount: 0.6,
    },
    // Analytics: spread throughout
    {
      domain: "analytics.demo-provider.com",
      path_pattern: "/v1/events",
      startSec: 0,
      endSec: 100,
      baseCount: 1.0,
    },
    {
      domain: "analytics.demo-provider.com",
      path_pattern: "/v1/screen_view",
      startSec: 2,
      endSec: 95,
      baseCount: 0.7,
    },
  ];
  const points: NetworkTimelineDataPoint[] = [];
  for (const ep of endpoints) {
    for (let sec = ep.startSec; sec <= ep.endSec; sec++) {
      // Higher intensity near the center of the active window
      const mid = (ep.startSec + ep.endSec) / 2;
      const range = (ep.endSec - ep.startSec) / 2;
      const falloff = 1 - 0.5 * Math.pow((sec - mid) / range, 2);
      const count =
        Math.round(ep.baseCount * falloff * (0.6 + Math.random() * 0.8) * 100) /
        100;
      if (count > 0.05) {
        points.push({
          elapsed: sec,
          domain: ep.domain,
          path_pattern: ep.path_pattern,
          count,
        });
      }
    }
  }
  return { interval: 5, points };
}

type PlotStatus = "pending" | "success" | "error" | "nodata";

const demoStatusData = generateDemoStatusData();
const demoTimelineData = generateDemoTimelineData();

export function NetworkOverviewDemo({
  hideTitle = false,
}: {
  hideTitle?: boolean;
}) {
  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">
        {hideTitle ? "" : "Network Performance"}
      </p>
      {!hideTitle && <div className="py-4" />}
      <div className="py-8" />

      <NetworkOverviewSections
        statusPlotStatus="success"
        statusPlotData={demoStatusData}
        plotTimeGroup="days"
        trends={<NetworkTrends demo />}
        timelinePlotStatus="success"
        timelinePlotData={demoTimelineData}
        timelineTooltip="Distribution of when endpoint patterns are typically called in a session."
      />
    </div>
  );
}

export default function NetworkOverview({
  params,
}: {
  params: { teamId: string };
}) {
  const { teamId } = params;
  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    onChange,
  } = useFilterPage({ teamId, entity: "network" });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const statusCodesQuery = useNetworkStatusCodesQuery(filterParams, "", "");
  const timelineQuery = useNetworkTimelineQuery(filterParams, "", "");

  const filterExprIssues =
    filterExprIssuesIn(statusCodesQuery.error) ??
    filterExprIssuesIn(timelineQuery.error);

  const statusPlotStatus =
    statusCodesQuery.status === "success" && statusCodesQuery.data === null
      ? ("nodata" as const)
      : statusCodesQuery.status;
  const statusPlotData = statusCodesQuery.data ?? [];
  const timelinePlotStatus =
    timelineQuery.status === "success" && timelineQuery.data === null
      ? ("nodata" as const)
      : timelineQuery.status;
  const timelinePlotData = timelineQuery.data ?? null;

  const plotTimeGroup = getPlotTimeGroupForRange(
    readyValue?.date.startDate ?? "",
    readyValue?.date.endDate ?? "",
  );

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="network"
        teamId={teamId}
        placeholder="Filter network requests…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
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
          <div className="py-8" />
          <div className="flex items-center gap-2">
            <p className="font-display text-xl">Explore Endpoints</p>
            <InfoTooltip
              content={
                <>
                  <Link
                    href="/docs/network-monitoring/endpoint-patterns#searching-for-endpoints"
                    className={underlineLinkStyle}
                  >
                    Learn more
                  </Link>{" "}
                  about endpoint search and using wildcards.
                </>
              }
            />
          </div>
          <div className="py-4" />
          <NetworkEndpointSearch
            key={teamId}
            teamId={teamId}
            filterParams={filterParams}
          />

          <div className="py-8" />

          <NetworkOverviewSections
            statusPlotStatus={statusPlotStatus}
            statusPlotData={statusPlotData}
            plotTimeGroup={plotTimeGroup}
            trends={
              <NetworkTrends
                teamId={teamId}
                filterParams={filterParams}
                active
              />
            }
            timelinePlotStatus={timelinePlotStatus}
            timelinePlotData={timelinePlotData}
            timelineTooltip={
              <>
                Distribution of when endpoint patterns are typically called in a
                session.{" "}
                <Link
                  href="/docs/network-monitoring/endpoint-patterns#request-timeline"
                  className={underlineLinkStyle}
                >
                  Learn more
                </Link>{" "}
                about how the timeline is generated
              </>
            }
          />
        </>
      )}
    </div>
  );
}

function NetworkOverviewSections({
  statusPlotStatus,
  statusPlotData,
  plotTimeGroup,
  trends,
  timelinePlotStatus,
  timelinePlotData,
  timelineTooltip,
}: {
  statusPlotStatus: PlotStatus;
  statusPlotData: ComponentProps<typeof NetworkStatusDistributionPlot>["data"];
  plotTimeGroup: ComponentProps<
    typeof NetworkStatusDistributionPlot
  >["plotTimeGroup"];
  trends: ReactNode;
  timelinePlotStatus: PlotStatus;
  timelinePlotData: NetworkTimelineData | null;
  timelineTooltip: ReactNode;
}) {
  const shouldRenderStatusPlot =
    statusPlotStatus === "success" && statusPlotData.length > 0;
  const shouldRenderTimeline =
    timelinePlotStatus === "success" &&
    timelinePlotData !== null &&
    timelinePlotData.points.length > 0;

  return (
    <>
      <div className="w-full">
        <p className="font-display text-xl">Status Distribution</p>
        <div className="py-2" />
        <div className="flex font-body items-center justify-center w-full h-144">
          {(statusPlotStatus === "pending" ||
            (statusPlotStatus === "success" && !shouldRenderStatusPlot)) && (
            <SkeletonPlot />
          )}
          {shouldRenderStatusPlot && (
            <NetworkStatusDistributionPlot
              data={statusPlotData}
              plotTimeGroup={plotTimeGroup}
            />
          )}
          {statusPlotStatus === "nodata" && (
            <p className="font-body text-sm">
              No data available for the selected filters
            </p>
          )}
          {statusPlotStatus === "error" && (
            <p className="font-body text-sm">
              Error fetching status distribution, please change filters & try
              again
            </p>
          )}
        </div>
      </div>

      <div className="py-8" />

      <div className="w-full">{trends}</div>

      <div className="py-10" />

      <div className="w-full">
        <div className="flex items-center gap-2">
          <p className="font-display text-xl">Timeline</p>
          <InfoTooltip content={timelineTooltip} />
        </div>
        {shouldRenderTimeline && (
          <div className="py-8">
            <NetworkTimelinePlot data={timelinePlotData!} />
          </div>
        )}
        {!shouldRenderTimeline && (
          <div className="flex font-body items-center justify-center w-full h-144">
            {timelinePlotStatus === "pending" && <SkeletonPlot />}
            {(timelinePlotStatus === "nodata" ||
              timelinePlotStatus === "success") && (
              <p className="font-body text-sm">
                No data available for the selected filters
              </p>
            )}
            {timelinePlotStatus === "error" && (
              <p className="font-body text-sm">
                Error fetching requests timeline, please change filters & try
                again
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
