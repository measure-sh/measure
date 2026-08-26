"use client";

import { FilterSource } from "@/app/api/api_calls";

import Filters, {
  AppVersionsInitialSelectionType,
} from "@/app/components/filters";
import InfoTooltip from "@/app/components/info_tooltip";
import NetworkEndpointSearch from "@/app/components/network_endpoint_search";
import NetworkStatusDistributionPlot from "@/app/components/network_status_distribution_plot";
import NetworkTimelinePlot, {
  NetworkTimelineData,
  NetworkTimelineDataPoint,
} from "@/app/components/network_timeline_plot";
import NetworkTrends from "@/app/components/network_trends";
import {
  Skeleton,
  SkeletonPlot,
  SkeletonTable,
} from "@/app/components/skeleton";
import {
  useNetworkStatusCodesQuery,
  useNetworkTimelineQuery,
} from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { getPlotTimeGroupForRange } from "@/app/utils/time_utils";
import { DateTime } from "luxon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

interface NetworkOverviewProps {
  params?: { teamId: string };
  demo?: boolean;
  hideDemoTitle?: boolean;
}

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

const demoStatusData = generateDemoStatusData();
const demoTimelineData = generateDemoTimelineData();

export default function NetworkOverview({
  params,
  demo = false,
  hideDemoTitle = false,
}: NetworkOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const filters = useFiltersStore((state) => state.filters);

  const statusCodesQuery = useNetworkStatusCodesQuery("", "");
  const timelineQuery = useNetworkTimelineQuery("", "");

  // In demo mode, use static data instead of store data
  const statusPlotStatus = demo
    ? ("success" as const)
    : statusCodesQuery.status === "success" && statusCodesQuery.data === null
      ? ("nodata" as const)
      : statusCodesQuery.status;
  const statusPlotData = demo ? demoStatusData : (statusCodesQuery.data ?? []);
  const timelinePlotStatus = demo
    ? ("success" as const)
    : timelineQuery.status === "success" && timelineQuery.data === null
      ? ("nodata" as const)
      : timelineQuery.status;
  const timelinePlotData = demo
    ? demoTimelineData
    : (timelineQuery.data ?? null);

  const plotTimeGroup = demo
    ? "days"
    : getPlotTimeGroupForRange(filters.startDate, filters.endDate);
  const shouldRenderStatusPlot = demo
    ? true
    : statusPlotStatus === "success" && statusPlotData.length > 0;
  const shouldRenderTimeline = demo
    ? true
    : timelinePlotStatus === "success" &&
      timelinePlotData !== null &&
      timelinePlotData.points.length > 0;

  // Sync filters to URL
  useEffect(() => {
    if (demo) return;
    if (!filters.ready) return;
    router.replace(`${pathname}?${filters.serialisedFilters!}`, {
      scroll: false,
    });
  }, [filters.ready, filters.serialisedFilters, pathname]);

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">
        {demo ? (hideDemoTitle ? "" : "Network Performance") : ""}
      </p>
      {!hideDemoTitle && <div className="py-4" />}

      {!demo && params && (
        <Filters
          teamId={params.teamId}
          filterSource={FilterSource.Events}
          appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
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
      )}

      {!demo && filters.loading && (
        <div className="flex flex-col w-full">
          <div className="py-4" />
          <Skeleton className="h-9 w-full" />
          <div className="py-6" />
          <div className="flex font-body items-center justify-center w-full h-144">
            <SkeletonPlot />
          </div>
          <div className="py-6" />
          <div className="flex font-body items-center justify-center w-full h-144">
            <SkeletonPlot />
          </div>
          <div className="py-8" />
          <Skeleton className="h-6 w-36" />
          <SkeletonTable rows={5} columns={4} />
        </div>
      )}

      {(demo || filters.ready) && (
        <>
          {!demo && params && (
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
                key={params.teamId}
                teamId={params.teamId}
              />
            </>
          )}

          <div className="py-8" />

          {/* Status Distribution Section */}
          <div className="w-full">
            <p className="font-display text-xl">Status Distribution</p>
            <div className="py-2" />
            <div className="flex font-body items-center justify-center w-full h-144">
              {(statusPlotStatus === "pending" ||
                (statusPlotStatus === "success" &&
                  !shouldRenderStatusPlot)) && <SkeletonPlot />}
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
                  Error fetching status distribution, please change filters &
                  try again
                </p>
              )}
            </div>
          </div>

          <div className="py-8" />

          {/* Top Endpoints Section */}
          <div className="w-full">
            <NetworkTrends teamId={params?.teamId} active demo={demo} />
          </div>

          <div className="py-10" />

          {/* Request Timeline Section */}
          <div className="w-full">
            <div className="flex items-center gap-2">
              <p className="font-display text-xl">Timeline</p>
              <InfoTooltip
                content={
                  <>
                    Distribution of when endpoint patterns are typically called
                    in a session.
                    {!demo && (
                      <>
                        {" "}
                        <Link
                          href="/docs/network-monitoring/endpoint-patterns#request-timeline"
                          className={underlineLinkStyle}
                        >
                          Learn more
                        </Link>{" "}
                        about how the timeline is generated
                      </>
                    )}
                  </>
                }
              />
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
                    Error fetching requests timeline, please change filters &
                    try again
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
