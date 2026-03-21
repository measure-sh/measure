"use client"

import { FilterSource, NetworkEndpointLatencyPlotApiStatus, NetworkEndpointStatusCodesPlotApiStatus, NetworkEndpointTimelinePlotApiStatus, fetchNetworkEndpointLatencyPlotFromServer, fetchNetworkEndpointStatusCodesPlotFromServer, fetchNetworkEndpointTimelinePlotFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkLatencyPlot from '@/app/components/network_latency_plot'
import NetworkTimelinePlot, { NetworkTimelineData } from '@/app/components/network_timeline_plot'
import NetworkEndpointStatusCodesPlot from '@/app/components/network_endpoint_status_codes_plot'
import { getPlotTimeGroupForRange, PlotTimeGroup } from '@/app/utils/time_utils'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LatencyDataPoint {
    datetime: string
    p50: number | null
    p90: number | null
    p95: number | null
    p99: number | null
    count: number
}

interface EndpointStatusCodesResponse {
    status_codes: number[]
    data_points: { datetime: string; total_count: number; [key: string]: any }[]
}

interface PageState {
    filters: typeof defaultFilters
    latencyApiStatus: NetworkEndpointLatencyPlotApiStatus
    latencyData: LatencyDataPoint[] | null
    latencyPlotDataKey: string | null
    statusDistributionApiStatus: NetworkEndpointStatusCodesPlotApiStatus
    statusDistributionData: EndpointStatusCodesResponse | null
    statusDistributionPlotDataKey: string | null
    timelineApiStatus: NetworkEndpointTimelinePlotApiStatus
    timelineData: NetworkTimelineData | null
    timelinePlotDataKey: string | null
}

interface NetworkDetailsProps {
    params: { teamId: string }
}

export default function NetworkDetails({ params }: NetworkDetailsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const domain = searchParams.get("domain") ?? ""
    const path = searchParams.get("path") ?? ""

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
        latencyApiStatus: NetworkEndpointLatencyPlotApiStatus.Loading,
        latencyData: null,
        latencyPlotDataKey: null,
        statusDistributionApiStatus: NetworkEndpointStatusCodesPlotApiStatus.Loading,
        statusDistributionData: null,
        statusDistributionPlotDataKey: null,
        timelineApiStatus: NetworkEndpointTimelinePlotApiStatus.Loading,
        timelineData: null,
        timelinePlotDataKey: null,
    })

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => ({ ...prevState, ...newState }))
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters
            })
        }
    }

    const plotTimeGroup: PlotTimeGroup = getPlotTimeGroupForRange(pageState.filters.startDate, pageState.filters.endDate)
    const currentPlotKey = `${domain}|${path}|${pageState.filters.serialisedFilters}|${plotTimeGroup}`
    const shouldRenderLatencyPlot = pageState.latencyApiStatus === NetworkEndpointLatencyPlotApiStatus.Success && pageState.latencyData !== null && pageState.latencyPlotDataKey === currentPlotKey
    const shouldRenderStatusDistributionPlot = pageState.statusDistributionApiStatus === NetworkEndpointStatusCodesPlotApiStatus.Success && pageState.statusDistributionData !== null && pageState.statusDistributionPlotDataKey === currentPlotKey

    const currentTimelineKey = `${domain}|${path}|${pageState.filters.serialisedFilters}`
    const shouldRenderTimelinePlot = pageState.timelineApiStatus === NetworkEndpointTimelinePlotApiStatus.Success && pageState.timelineData !== null && pageState.timelineData.points.length > 0 && pageState.timelinePlotDataKey === currentTimelineKey

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        const params = new URLSearchParams(pageState.filters.serialisedFilters!)
        params.set("domain", domain)
        params.set("path", path)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || !domain || !path) {
            return
        }

        updatePageState({ latencyApiStatus: NetworkEndpointLatencyPlotApiStatus.Loading })

        fetchNetworkEndpointLatencyPlotFromServer(pageState.filters, domain, path).then(result => {
            switch (result.status) {
                case NetworkEndpointLatencyPlotApiStatus.Success:
                    updatePageState({
                        latencyApiStatus: NetworkEndpointLatencyPlotApiStatus.Success,
                        latencyData: result.data as LatencyDataPoint[],
                        latencyPlotDataKey: currentPlotKey,
                    })
                    break
                case NetworkEndpointLatencyPlotApiStatus.NoData:
                    updatePageState({
                        latencyApiStatus: NetworkEndpointLatencyPlotApiStatus.NoData,
                        latencyData: null,
                        latencyPlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        latencyApiStatus: NetworkEndpointLatencyPlotApiStatus.Error,
                        latencyData: null,
                        latencyPlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || !domain || !path) {
            return
        }

        updatePageState({ statusDistributionApiStatus: NetworkEndpointStatusCodesPlotApiStatus.Loading })

        fetchNetworkEndpointStatusCodesPlotFromServer(pageState.filters, domain, path).then(result => {
            switch (result.status) {
                case NetworkEndpointStatusCodesPlotApiStatus.Success:
                    updatePageState({
                        statusDistributionApiStatus: NetworkEndpointStatusCodesPlotApiStatus.Success,
                        statusDistributionData: result.data as EndpointStatusCodesResponse,
                        statusDistributionPlotDataKey: currentPlotKey,
                    })
                    break
                case NetworkEndpointStatusCodesPlotApiStatus.NoData:
                    updatePageState({
                        statusDistributionApiStatus: NetworkEndpointStatusCodesPlotApiStatus.NoData,
                        statusDistributionData: null,
                        statusDistributionPlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        statusDistributionApiStatus: NetworkEndpointStatusCodesPlotApiStatus.Error,
                        statusDistributionData: null,
                        statusDistributionPlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || !domain || !path) {
            return
        }
        if (pageState.timelinePlotDataKey === currentTimelineKey) return

        updatePageState({ timelineApiStatus: NetworkEndpointTimelinePlotApiStatus.Loading, timelineData: null })

        fetchNetworkEndpointTimelinePlotFromServer(pageState.filters, domain, path).then(result => {
            switch (result.status) {
                case NetworkEndpointTimelinePlotApiStatus.Success:
                    updatePageState({
                        timelineApiStatus: NetworkEndpointTimelinePlotApiStatus.Success,
                        timelineData: result.data as NetworkTimelineData,
                        timelinePlotDataKey: currentTimelineKey,
                    })
                    break
                case NetworkEndpointTimelinePlotApiStatus.NoData:
                    updatePageState({
                        timelineApiStatus: NetworkEndpointTimelinePlotApiStatus.NoData,
                        timelineData: null,
                        timelinePlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        timelineApiStatus: NetworkEndpointTimelinePlotApiStatus.Error,
                        timelineData: null,
                        timelinePlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start w-full">
            <p className="font-display text-4xl max-w-6xl text-center">Network Performance</p>
            {pageState.filters.ready && <p className="font-code text-lg max-w-6xl text-center text-muted-foreground">{domain + path}</p>}
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
                onFiltersChanged={handleFiltersChanged} />

            <div className="py-4" />

            {/* Latency Section */}
            {pageState.filters.ready && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Latency</p>
                <div className="py-2" />
                <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    {(pageState.latencyApiStatus === NetworkEndpointLatencyPlotApiStatus.Loading || (pageState.latencyApiStatus === NetworkEndpointLatencyPlotApiStatus.Success && !shouldRenderLatencyPlot)) &&
                        <LoadingSpinner />
                    }
                    {pageState.latencyApiStatus === NetworkEndpointLatencyPlotApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching latency data, please change filters & try again</p>
                    }
                    {pageState.latencyApiStatus === NetworkEndpointLatencyPlotApiStatus.NoData &&
                        <p className="font-body text-sm">No data available for the selected filters</p>
                    }
                    {shouldRenderLatencyPlot &&
                        <NetworkLatencyPlot data={pageState.latencyData!} plotTimeGroup={plotTimeGroup} />
                    }
                </div>
            </div>}

            {/* Status Distribution Section */}
            {pageState.filters.ready && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Status Distribution</p>
                <div className="py-6" />
                <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    {(pageState.statusDistributionApiStatus === NetworkEndpointStatusCodesPlotApiStatus.Loading || (pageState.statusDistributionApiStatus === NetworkEndpointStatusCodesPlotApiStatus.Success && !shouldRenderStatusDistributionPlot)) &&
                        <LoadingSpinner />
                    }
                    {pageState.statusDistributionApiStatus === NetworkEndpointStatusCodesPlotApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching status distribution data, please change filters & try again</p>
                    }
                    {pageState.statusDistributionApiStatus === NetworkEndpointStatusCodesPlotApiStatus.NoData &&
                        <p className="font-body text-sm">No data available for the selected filters</p>
                    }
                    {shouldRenderStatusDistributionPlot &&
                        <NetworkEndpointStatusCodesPlot statusCodes={pageState.statusDistributionData!.status_codes} data={pageState.statusDistributionData!.data_points} plotTimeGroup={plotTimeGroup} />
                    }
                </div>
            </div>}

            {/* Timeline Section - only shown when pattern exists */}
            {pageState.filters.ready && pageState.timelineApiStatus !== NetworkEndpointTimelinePlotApiStatus.NoData && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Timeline</p>
                <p className="mt-2 font-body text-xs text-muted-foreground">Distribution of when this endpoint is typically called in a session.{' '}<Link href="/docs/features/feature-network-monitoring#request-timeline" className={underlineLinkStyle}>Learn more</Link> about how the timeline is generated.</p>
                {shouldRenderTimelinePlot && <div className="py-8">
                    <NetworkTimelinePlot data={pageState.timelineData!} />
                </div>}
                {!shouldRenderTimelinePlot && <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    {(pageState.timelineApiStatus === NetworkEndpointTimelinePlotApiStatus.Loading) &&
                        <LoadingSpinner />
                    }
                    {pageState.timelineApiStatus === NetworkEndpointTimelinePlotApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching timeline data, please change filters & try again</p>
                    }
                </div>}
            </div>}
        </div>
    )
}
