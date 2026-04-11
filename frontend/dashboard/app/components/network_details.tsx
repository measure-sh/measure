"use client"

import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkEndpointStatusCodesPlot from '@/app/components/network_endpoint_status_codes_plot'
import NetworkLatencyPlot from '@/app/components/network_latency_plot'
import NetworkTimelinePlot from '@/app/components/network_timeline_plot'
import { useNetworkEndpointLatencyQuery, useNetworkEndpointStatusCodesQuery, useNetworkEndpointTimelineQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { getPlotTimeGroupForRange, PlotTimeGroup } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

interface NetworkDetailsProps {
    params: { teamId: string }
}

export default function NetworkDetails({ params }: NetworkDetailsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const filters = useFiltersStore(state => state.filters)
    const domain = searchParams.get("domain") ?? ""
    const path = searchParams.get("path") ?? ""

    const latencyQuery = useNetworkEndpointLatencyQuery(domain, path)
    const statusDistributionQuery = useNetworkEndpointStatusCodesQuery(domain, path)
    const timelineQuery = useNetworkEndpointTimelineQuery(domain, path)

    const latencyStatus = latencyQuery.status === 'success' && latencyQuery.data === null ? 'nodata' as const : latencyQuery.status
    const statusDistributionStatus = statusDistributionQuery.status === 'success' && statusDistributionQuery.data === null ? 'nodata' as const : statusDistributionQuery.status
    const timelineStatus = timelineQuery.status === 'success' && timelineQuery.data === null ? 'nodata' as const : timelineQuery.status

    const plotTimeGroup: PlotTimeGroup = getPlotTimeGroupForRange(filters.startDate, filters.endDate)
    const shouldRenderLatencyPlot = latencyStatus === 'success' && latencyQuery.data !== null
    const shouldRenderStatusDistributionPlot = statusDistributionStatus === 'success' && statusDistributionQuery.data !== null
    const shouldRenderTimelinePlot = timelineStatus === 'success' && timelineQuery.data !== null && timelineQuery.data.points.length > 0

    // Sync filters to URL
    useEffect(() => {
        if (!filters.ready) {
            return
        }

        const params = new URLSearchParams(filters.serialisedFilters!)
        params.set("domain", domain)
        params.set("path", path)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [filters.ready, filters.serialisedFilters])

    return (
        <div className="flex flex-col items-start w-full">
            <p className="font-display text-4xl max-w-6xl text-center">Network Performance</p>
            {filters.ready && <p className="font-code text-lg max-w-6xl text-center text-muted-foreground">{domain + path}</p>}
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={false}
                showNotOnboarded={true}
                showAppSelector={true}
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
                showHttpMethods={true}
                showUdAttrs={false}
                showFreeText={false}
            />

            <div className="py-4" />

            {/* Latency Section */}
            {filters.ready && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Latency</p>
                <div className="py-2" />
                <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    {latencyStatus === 'pending' &&
                        <LoadingSpinner />
                    }
                    {latencyStatus === 'error' &&
                        <p className="font-body text-sm">Error fetching latency data, please change filters & try again</p>
                    }
                    {latencyStatus === 'nodata' &&
                        <p className="font-body text-sm">No data available for the selected filters</p>
                    }
                    {shouldRenderLatencyPlot &&
                        <NetworkLatencyPlot data={latencyQuery.data!} plotTimeGroup={plotTimeGroup} />
                    }
                </div>
            </div>}

            {/* Status Distribution Section */}
            {filters.ready && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Status Distribution</p>
                <div className="py-6" />
                <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    {statusDistributionStatus === 'pending' &&
                        <LoadingSpinner />
                    }
                    {statusDistributionStatus === 'error' &&
                        <p className="font-body text-sm">Error fetching status distribution data, please change filters & try again</p>
                    }
                    {statusDistributionStatus === 'nodata' &&
                        <p className="font-body text-sm">No data available for the selected filters</p>
                    }
                    {shouldRenderStatusDistributionPlot &&
                        <NetworkEndpointStatusCodesPlot statusCodes={statusDistributionQuery.data!.status_codes} data={statusDistributionQuery.data!.data_points} plotTimeGroup={plotTimeGroup} />
                    }
                </div>
            </div>}

            {/* Timeline Section - only shown when pattern exists */}
            {filters.ready && timelineStatus !== 'nodata' && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Timeline</p>
                <p className="mt-2 font-body text-xs text-muted-foreground">Distribution of when this endpoint is typically called in a session.{' '}<Link href="/docs/features/feature-network-monitoring#request-timeline" className={underlineLinkStyle}>Learn more</Link> about how the timeline is generated.</p>
                {shouldRenderTimelinePlot && <div className="py-8">
                    <NetworkTimelinePlot data={timelineQuery.data!} />
                </div>}
                {!shouldRenderTimelinePlot && <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    {timelineStatus === 'pending' &&
                        <LoadingSpinner />
                    }
                    {timelineStatus === 'error' &&
                        <p className="font-body text-sm">Error fetching timeline data, please change filters & try again</p>
                    }
                </div>}
            </div>}
        </div>
    )
}
