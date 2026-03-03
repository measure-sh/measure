"use client"

import { FilterSource, NetworkDetailLatencyPlotApiStatus, NetworkDetailStatusDistributionPlotApiStatus, fetchNetworkDetailLatencyPlotFromServer, fetchNetworkDetailStatusDistributionPlotFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkLatencyPlot from '@/app/components/network_latency_plot'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import { getPlotTimeGroupForRange, PlotTimeGroup } from '@/app/utils/time_utils'
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

interface StatusDistributionDataPoint {
    datetime: string
    total_count: number
    count_2xx: number
    count_3xx: number
    count_4xx: number
    count_5xx: number
}

interface PageState {
    filters: typeof defaultFilters
    latencyApiStatus: NetworkDetailLatencyPlotApiStatus
    latencyData: LatencyDataPoint[] | null
    latencyPlotDataKey: string | null
    statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus
    statusDistributionData: StatusDistributionDataPoint[] | null
    statusDistributionPlotDataKey: string | null
}

interface NetworkDetailsProps {
    params: { teamId: string }
}

export default function NetworkDetails({ params }: NetworkDetailsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const url = searchParams.get("url") ?? ""

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Loading,
        latencyData: null,
        latencyPlotDataKey: null,
        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Loading,
        statusDistributionData: null,
        statusDistributionPlotDataKey: null,
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
    const currentPlotKey = `${url}|${pageState.filters.serialisedFilters}|${plotTimeGroup}`
    const shouldRenderLatencyPlot = pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Success && pageState.latencyData !== null && pageState.latencyPlotDataKey === currentPlotKey
    const shouldRenderStatusDistributionPlot = pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Success && pageState.statusDistributionData !== null && pageState.statusDistributionPlotDataKey === currentPlotKey

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        const params = new URLSearchParams(pageState.filters.serialisedFilters!)
        params.set("url", url)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || !url) {
            return
        }

        updatePageState({ latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Loading })

        fetchNetworkDetailLatencyPlotFromServer(pageState.filters, url).then(result => {
            switch (result.status) {
                case NetworkDetailLatencyPlotApiStatus.Success:
                    updatePageState({
                        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Success,
                        latencyData: result.data as LatencyDataPoint[],
                        latencyPlotDataKey: currentPlotKey,
                    })
                    break
                case NetworkDetailLatencyPlotApiStatus.NoData:
                    updatePageState({
                        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.NoData,
                        latencyData: null,
                        latencyPlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Error,
                        latencyData: null,
                        latencyPlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || !url) {
            return
        }

        updatePageState({ statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Loading })

        fetchNetworkDetailStatusDistributionPlotFromServer(pageState.filters, url).then(result => {
            switch (result.status) {
                case NetworkDetailStatusDistributionPlotApiStatus.Success:
                    updatePageState({
                        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Success,
                        statusDistributionData: result.data as StatusDistributionDataPoint[],
                        statusDistributionPlotDataKey: currentPlotKey,
                    })
                    break
                case NetworkDetailStatusDistributionPlotApiStatus.NoData:
                    updatePageState({
                        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.NoData,
                        statusDistributionData: null,
                        statusDistributionPlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Error,
                        statusDistributionData: null,
                        statusDistributionPlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start w-full">
            <p className="font-display text-4xl max-w-6xl text-center">Network Performance</p>
            {pageState.filters.ready && <p className="font-code text-lg max-w-6xl text-center text-muted-foreground">{url}</p>}
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
                {(pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Loading || (pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Success && !shouldRenderLatencyPlot)) &&
                    <LoadingSpinner />
                }
                {pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Error &&
                    <p className="font-body text-sm">Error fetching latency data, please change filters & try again</p>
                }
                {pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.NoData &&
                    <p className="font-body text-sm">No data available for the selected filters</p>
                }
                {shouldRenderLatencyPlot &&
                    <NetworkLatencyPlot data={pageState.latencyData!} plotTimeGroup={plotTimeGroup} />
                }
            </div>}

            {/* Status Distribution Section */}
            {pageState.filters.ready && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Status Distribution</p>
                <div className="py-6" />
                {(pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Loading || (pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Success && !shouldRenderStatusDistributionPlot)) &&
                    <LoadingSpinner />
                }
                {pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Error &&
                    <p className="font-body text-sm">Error fetching status distribution data, please change filters & try again</p>
                }
                {pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.NoData &&
                    <p className="font-body text-sm">No data available for the selected filters</p>
                }
                {shouldRenderStatusDistributionPlot &&
                    <NetworkStatusDistributionPlot data={pageState.statusDistributionData!} plotTimeGroup={plotTimeGroup} />
                }
            </div>}
        </div>
    )
}
